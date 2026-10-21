# MeshGit

## Visual Version Control for 3D Models

MeshGit is an innovative platform designed to bring the power of version control, traditionally used for source code, to 3D mesh files, specifically STL. It addresses the challenges of collaborating on 3D models by providing geometry-aware diffing, branching, and interactive conflict resolution, enabling designers and engineers to track changes, collaborate safely, and manage their 3D assets efficiently.

## Problem Solved

Traditional version control systems like Git are ill-suited for binary 3D model files (e.g., STL) because:

*   **Binary Nature:** STL files are binary, making text-based diffs meaningless.
*   **Unreadable Diffs:** Changes are impossible to interpret without specialized 3D visualization.
*   **Complex Merges:** Merge conflicts are difficult to identify and resolve manually.
*   **Inefficient Storage:** Entire files often need to be stored for each version, leading to large repositories.

MeshGit aims to overcome these limitations by providing a dedicated solution for 3D model versioning.

## Key Features (MVP)

*   **STL Upload & Rendering:** Seamless upload and interactive 3D rendering of STL files in the browser.
*   **Commit Graph & History:** A visual history of all changes, allowing users to track versions and revert to previous states.
*   **Geometry-Aware Visual Diffing:** Highlight additions, removals, and unchanged geometry between two versions using intuitive color coding.
*   **Branching Workflow:** Create and manage branches for isolated experimentation without affecting the main design.
*   **Conflict Identification & Assisted Resolution:** Visually identify overlapping geometry as conflict zones and provide tools for manual resolution (e.g., keep left/right, manual selection).
*   **Robust Mesh Handling:** Automatic cleaning and repair of uploaded meshes to ensure stability for geometry operations.
