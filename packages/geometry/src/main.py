from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import Response
import trimesh
import io

app = FastAPI(title="MeshGit Geometry Service")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/clean")
async def clean_mesh(file: UploadFile = File(...)):
    data = await file.read()
    try:
        mesh = trimesh.load(io.BytesIO(data), file_type="stl", force="mesh")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid STL: {e}")

    if not isinstance(mesh, trimesh.Trimesh):
        raise HTTPException(status_code=422, detail="STL must contain a single mesh")

    # Repair: deduplicate vertices, remove degenerate/duplicate faces, fix winding/normals
    mesh.process(validate=True)
    trimesh.repair.fill_holes(mesh)
    trimesh.repair.fix_winding(mesh)
    trimesh.repair.fix_normals(mesh)

    cleaned = mesh.export(file_type="stl")

    return Response(
        content=bytes(cleaned),
        media_type="application/octet-stream",
        headers={
            "X-Vertex-Count": str(len(mesh.vertices)),
            "X-Face-Count": str(len(mesh.faces)),
        },
    )


@app.post("/diff")
def diff_meshes(before_id: str, after_id: str):
    raise HTTPException(status_code=501, detail="Not implemented")


@app.post("/merge")
def merge_meshes(base_id: str, left_id: str, right_id: str):
    raise HTTPException(status_code=501, detail="Not implemented")
