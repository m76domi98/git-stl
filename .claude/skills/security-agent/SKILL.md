---
description: Full-spectrum security review agent for MeshGit. Covers auth, authorization, DB isolation, API security, input validation, frontend, file uploads, secrets, and infrastructure. Runs multi-agent: identify → parallel false-positive filters → PASS or BLOCK DEPLOYMENT verdict.
---

# /security-agent

Run a comprehensive security review of the codebase using a multi-agent workflow.

## Execution steps

### Step 1 — Launch identification agent

Spawn a single agent with the full SECURITY_AGENT spec below as its instructions. Tell it to read all relevant files across the repo and produce a list of findings.

Files to always include in the agent's read list:
- All files under `packages/backend/src/`
- All files under `packages/frontend/src/`
- All files under `packages/cli/src/`
- `docker-compose.yml`
- `.env.example`
- `packages/geometry/src/main.py`
- Any migration files

### Step 2 — Launch parallel false-positive filter agents

For EACH finding from Step 1, spawn a separate filter agent in parallel (single message, multiple Agent tool calls). Each filter agent receives:
- The finding in full (file, line, description, exploit scenario)
- The false-positive exclusion rules below
- Instructions to read the specific file(s) involved
- Instructions to return: IS_VALID (true/false), confidence (1–10), reasoning

### Step 3 — Filter and report

Discard any finding where the filter agent returned confidence < 8. For remaining findings, output the final report in the required format. End with PASS or BLOCK DEPLOYMENT.

**BLOCK DEPLOYMENT if any P0 or P1 finding survives filtering.**

---

## SECURITY_AGENT spec (give this to the identification agent verbatim)

You are a security review agent for MeshGit — a version control system for 3D STL mesh files. The stack is: React + Vite frontend, Node.js/Express backend, Python/FastAPI geometry microservice, PostgreSQL, Docker Compose.

### Threat model assumptions
- The client/browser is malicious
- Users may intentionally manipulate requests
- URLs, headers, request bodies, cookies, localStorage, uploaded files are all untrusted
- Hidden UI does not equal access control
- Model output is untrusted

### 1. Authentication
Verify:
- Authentication is required where expected
- Sessions expire appropriately
- Tokens are validated server-side
- JWT signatures are verified
- Logout invalidates active sessions

Flag if:
- Client determines logged-in state
- User IDs are trusted from requests
- Tokens never expire
- Secrets exist in frontend code

### 2. Authorization (CRITICAL)
Every protected action must check: who is requesting, what do they own, what are they allowed to do.

Test for:
- URL manipulation (`/user/124` → should be `/user/current` or ownership-checked)
- ID swapping across accounts
- Role elevation
- Cross-account resource access

Flag:
- Broken access control
- Missing ownership checks
- Admin-only actions without backend enforcement

### 3. Database Security
Verify:
- Queries enforce ownership/tenant isolation
- Parameterized queries only — no raw SQL interpolation
- Least privilege DB roles

Flag:
- SQL injection
- `SELECT * FROM table` without `WHERE owner_id = ?`
- Missing tenant scoping

### 4. Multi-Tenant Isolation
Test whether user A can access user B's projects, commits, or meshes by changing IDs in URL or request body.

Flag:
- Cross-user data leakage
- Shared storage paths without user scoping

### 5. API Security
Verify:
- Input validation on all endpoints
- Output minimization (no internal fields returned)
- Schema enforcement

Flag:
- Overfetching / excessive data exposure
- Debug endpoints enabled in production
- Internal fields (passwords, secrets, full DB rows) returned

### 6. Input Validation
Check all entry points: request body, query params, path params, headers, file uploads.

Flag:
- Mass assignment vulnerabilities
- Injection vectors (SQL, command, path traversal)
- Missing file type/size validation on STL uploads

### 7. Frontend Security
Verify:
- No secrets in frontend bundle
- No auth decisions made purely client-side
- Sensitive data not stored in localStorage beyond what's necessary

Flag:
- API keys in frontend code
- Auth bypass via client-side state manipulation
- JWT stored in a way that's accessible to XSS (localStorage vs httpOnly cookie tradeoff)

### 8. File Upload Security (HIGH RELEVANCE — STL uploads are core feature)
Verify:
- File type validated (not just extension — check content/magic bytes where possible)
- File size limits enforced
- Uploaded files not executed
- Storage paths user-scoped (user A cannot read user B's uploads)

Flag:
- Arbitrary file upload without validation
- Path traversal in upload storage
- Executable files accepted

### 9. Secrets Management
Flag:
- Hardcoded credentials anywhere in code
- Secrets in logs
- `.env` files committed
- Fallback secrets that are too weak for production

### 10. Infrastructure
Verify:
- CORS is restricted (not `*`)
- Session cookies have appropriate flags
- No open admin panels

Flag:
- Wildcard CORS with credentials
- Debug mode enabled
- Insecure defaults that would apply in production

### 11. Abuse Testing
Simulate:
- User swaps another user's project/commit ID in the URL
- User uploads a non-STL file (e.g. `.exe`, `.svg`, `.php`)
- User sends oversized payload
- User modifies their JWT payload without re-signing
- User opens the CLI poll endpoint with a guessed device code

If exploit succeeds: FAIL

### Output format per finding
```
Severity: P0/P1/P2/P3/P4
Category: [auth | authz | db | api | input | frontend | upload | secrets | infra]
Exploit: <concrete attack steps>
Affected Component: <file:line>
Root Cause: <why the code is vulnerable>
Fix: <specific code change>
Confidence: <1-10>
```

---

## False-positive filter rules (give these to each filter agent)

Automatically exclude:
- DoS / rate limiting / resource exhaustion
- Secrets stored on disk if otherwise secured (env vars, Docker secrets)
- Theoretical issues with no concrete attack path
- Environment variables are trusted inputs
- React/Angular XSS unless `dangerouslySetInnerHTML` or equivalent
- Client-side auth checks (backend is responsible)
- Log spoofing
- Regex DOS
- A lack of hardening measures without a concrete exploit
- Vulnerabilities that require a prior full compromise as the primary vector

Severity thresholds for BLOCK DEPLOYMENT:
- P0: Data loss, account takeover → BLOCK
- P1: Unauthorized access to another user's data → BLOCK
- P2/P3/P4: Report but do not block

---

## Final report format

```
# MeshGit Security Review

## Findings

[findings in the format above, or "No confirmed findings."]

## Verdict

PASS
```
or
```
BLOCK DEPLOYMENT
Reason: [list P0/P1 findings by title]
```
