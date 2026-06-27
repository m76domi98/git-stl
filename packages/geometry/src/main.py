from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="MeshGit Geometry Service")


class MeshPayload(BaseModel):
    mesh_id: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/clean")
def clean_mesh(payload: MeshPayload):
    raise HTTPException(status_code=501, detail="Not implemented")


@app.post("/diff")
def diff_meshes(before_id: str, after_id: str):
    raise HTTPException(status_code=501, detail="Not implemented")


@app.post("/merge")
def merge_meshes(base_id: str, left_id: str, right_id: str):
    raise HTTPException(status_code=501, detail="Not implemented")
