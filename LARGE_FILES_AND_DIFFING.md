# Large File Storage & Diffing — Design Notes

Status: **not implemented**. This is the plan for two related gaps in the current system:
1. Large STL files break the GitHub mirror silently.
2. Geometry diffing (`/diff`) is a 501 stub.

Written for whoever (human or agent) picks these up next.

---

## 1. Large file storage

### Current state
- Uploads accepted up to 500MB (`multer`, `packages/backend/src/routes/commits.js`).
- Cleaned STL bytes are written to a **Docker volume** (`storage.js`), keyed by `<project_id>/<mesh_id>.stl`.
- Postgres never stores geometry — the `meshes` table is `(id, file_size, vertex_count, face_count, created_at)`. Storage backend can change without touching the schema.
- Every commit is also mirrored to the linked GitHub repo (`packages/backend/src/lib/githubSync.js`) via `octokit.git.createBlob()` — the raw bytes, base64-encoded, committed directly into the repo's git history.

### The actual problem
`createBlob()` has no size guard. GitHub's Git Data API blob limit is ~100MB. The mirror call is fire-and-forget:

```js
pushCommitToGitHub({...}).catch((err) => console.error('[github-sync] push failed:', err.message))
```

A large mesh commits fine into MeshGit's own storage, then fails to mirror to GitHub — **silently**, logged server-side only. The user gets no signal their GitHub copy is out of sync.

### Target design

**Storage backend**: replace the Docker volume with S3-compatible object storage.
- `storeMesh(projectId, meshId, buffer)` → `s3.putObject({ Bucket, Key: '<project_id>/<mesh_id>.stl', Body: buffer })`
- `readMesh(projectId, meshId)` → stream from S3, or better: issue a pre-signed URL and let the client fetch directly, bypassing the Node process for large transfers.
- No schema change — `mesh_id` is already the pointer; it just resolves to an S3 key instead of a volume path.
- Multer should move off `memoryStorage()` (full 500MB buffered in RAM per upload, flagged with a `ponytail:` comment in `commits.js`) once uploads route to S3 — stream-to-S3 instead of buffer-then-forward.

**GitHub mirror**: stop pretending every commit can go to GitHub.
- Check size before calling `createBlob()`. Under the cap (leave headroom, e.g. 90MB): mirror as today.
- Over the cap: **skip and surface it** — return a status on the commit response (`github_sync: 'skipped_too_large'`) instead of swallowing the error in a `.catch`. The frontend should show this, not hide it.
- If full-history-on-GitHub for large meshes actually becomes a requirement: implement real Git LFS — commit a pointer file (`oid` + `size`) via the same Git Data API calls, upload the real bytes to the repo's LFS storage via the LFS batch API. Don't build this speculatively; only do it if a real use case needs meshes >100MB to have GitHub history, not just a MeshGit copy.

**Delta storage** (from the PRD, "planned," not started): storing a full STL per commit is wasteful once diffing exists — a commit that only moves a few vertices doesn't need a full duplicate copy. This depends on §2 being built first (you need vertex-level diffs before you can store just the delta). Not worth designing further until diff is real and its output shape is known.

---

## 2. Diffing

### Current state
`packages/geometry/src/main.py`:
```python
@app.post("/diff")
def diff_meshes(before_id: str, after_id: str):
    raise HTTPException(status_code=501, detail="Not implemented")
```
`packages/backend/src/routes/diff.js` is a matching stub. Nothing calls it.

### Target design

**Endpoint contract**
- `GET /api/diff?before=<commit_id>&after=<commit_id>` (backend) — resolves both commits → `mesh_id`s → fetches both files → proxies to geometry service.
- `POST /diff` (geometry service) — takes both mesh files, returns a per-vertex classification.

**Algorithm**
1. Load both meshes into `trimesh`.
2. Build a KD-tree over "before" vertices (fast nearest-neighbor lookup, `scipy.spatial.cKDTree` — already a dependency).
3. For each "after" vertex, query nearest neighbor in "before": distance > epsilon → **added**. Query the reverse direction (before → after) for **removed**. Everything else → **unchanged**.
4. Before running the above at full resolution, do a cheap **bounding-box pre-check**: partition each mesh into a coarse spatial grid; cells with no overlap between before/after are trivially fully added/removed with zero per-vertex math. This is the highest-leverage optimization — most real edits are spatially localized.

**Performance** (target: <5s per PRD)
- Diff a **decimated** copy for the visual overlay (`trimesh.simplify_quadric_decimation`), not the full-resolution mesh — full precision isn't needed for a color overlay, and this is the single biggest lever on large meshes.
- Cache results keyed by `(before_id, after_id)` — diffs are deterministic and re-requested often (page refresh, multiple viewers).
- Move computation off the request/response cycle for large meshes — background job, frontend polls or gets pushed a "ready" event, rather than holding an HTTP request open.
- Response payload: return a compact binary buffer (1 byte per vertex = status code), not a JSON array of vertex classifications — feeds directly into a Three.js `BufferAttribute`, much smaller than JSON for meshes with hundreds of thousands of vertices.

**Frontend**
- `Viewer.jsx` needs to accept diff data alongside mesh data and apply it as a per-vertex color attribute on the `BufferGeometry` — green = added, red = removed, gray = unchanged. Colors are hardcoded (see `CLAUDE.md` — viewport colors are intentionally not theme-driven), consistent with how mesh/edge colors already work.

### Open questions (not decided yet)
- Job queue choice for async diff computation, if/when synchronous proves too slow in practice — don't add one speculatively, measure first.
- Whether large-mesh GitHub mirroring becomes real LFS or stays "skip and tell the user."
- Delta-based commit storage — blocked on diff shipping first.
