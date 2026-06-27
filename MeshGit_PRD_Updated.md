# Product Requirements Document (PRD)

## Product Name

MeshGit (working title)

Visual version control and collaborative merging for STL/mesh files.

---

# 1. Overview

MeshGit enables users to track, compare, branch, and merge 3D models similarly to source control systems, but with geometry-aware operations instead of text diffs.

Users upload STL files, create commits, inspect visual differences, and manage parallel edits using an interactive 3D interface.

Primary value:

*   Understand what changed in a model
*   Collaborate safely
*   Visually identify geometry conflicts

---

# 2. Problem Statement

Traditional Git performs poorly for STL files because:

*   STL files are binary
*   Diffs are unreadable
*   Merge conflicts are impossible to interpret
*   Entire files must often be replaced

Current workflows rely on:

*   Naming conventions
*   Duplicate files
*   Manual communication

Result:
Slow collaboration and lost work.

---

# 3. Goals

### Primary Goals

*   Visual commit history
*   Geometry-aware diffing
*   Branching workflow
*   Interactive conflict identification and resolution (manual or assisted)

### Secondary Goals

*   Storage efficiency (via binary delta compression)
*   Team collaboration features
*   CAD tool interoperability (future consideration)

---

# 4. Non-Goals (V1)

*   Real-time multiplayer editing
*   CAD parametric editing
*   STEP/SolidWorks native editing
*   Automatic semantic understanding
*   Fully automated, robust 3D mesh merging for all conflict types (will be phased in post-MVP)

---

# 5. Target Users

### Student Teams

Robotics
Engineering design teams
Capstone projects

### Makers

3D printing hobbyists

### Professional Teams

Industrial design
Mechanical engineering

---

# 6. User Stories

### Upload Model

As a user,
I want to upload an STL,
so that I can track versions.

Acceptance:

*   STL loads successfully
*   Metadata stored
*   Mesh is automatically cleaned/repaired upon upload to ensure stability for subsequent operations.

---

### Create Commit

As a user,
I want to save a checkpoint,
so I can revert later.

Acceptance:

*   Commit appears in history
*   Preview generated

---

### View Changes

As a user,
I want to compare two versions,
so I understand modifications.

Acceptance:

*   Added geometry highlighted
*   Removed geometry highlighted
*   Unchanged geometry clearly visible

---

### Branch

As a user,
I want isolated experimentation,
without affecting main.

Acceptance:

*   Branch displayed in graph

---

### Merge (V1 - Manual/Assisted)

As a user,
I want to integrate edits from a branch,
and resolve any conflicts visually.

Acceptance:

*   Visual identification of overlapping geometry (conflicts)
*   Options to manually select 
left/right versions for conflicting regions.

---

# 7. Functional Requirements

## FR1 Upload

Input:
STL

Output:
Mesh object

Additional:
Automatic mesh cleaning and repair (e.g., fixing non-manifold edges, closing holes) to ensure robust geometry operations.

---

## FR2 Commit System

Store:

*   commit_id
*   parent_commit
*   mesh_reference
*   timestamp
*   preview

---

## FR3 Visual Diff

Modes:

*   Before
*   After
*   Overlay
*   Slider

Color Rules:
Green → Added
Red → Removed
Gray → Unchanged

---

## FR4 Branching

Actions:
Create branch
Switch branch
Merge branch (initiates conflict detection and resolution flow)

---

## FR5 Merge Engine (V1 - Conflict Identification & Manual Resolution)

Input:
Base
Left
Right

Output:
Merged mesh (after user resolution)

Rules:

*   Non-overlapping regions → auto merge (via 3D boolean union, with robust error handling)
*   Overlapping regions → identified as conflict zones for user resolution

---

## FR6 Conflict Resolution

Display:
Conflict region highlighted visually

Actions:

*   Keep left version for region
*   Keep right version for region
*   Manual selection of geometry within conflict region

---

# 8. Technical Architecture

Frontend:
React
Three.js

Backend:
Node.js

Geometry:
Python microservice (leveraging libraries like Trimesh or PyMesh for robust mesh operations, cleaning, diffing, and boolean operations)

Storage:
PostgreSQL
Object storage (with consideration for binary delta compression for efficiency)

---

# 9. Data Model

Project

*   id
*   owner

Commit

*   id
*   parent_id
*   mesh_id

Mesh

*   id
*   vertices
*   faces

Delta

*   id
*   commit_before
*   commit_after

Conflict

*   id
*   region

---

# 10. APIs

POST /projects

POST /commit

GET /diff

POST /merge (initiates merge process, may return conflicts)

GET /history

---

# 11. Success Metrics

Technical:

*   Diff generation < 5 sec
*   Conflict identification accuracy > 90%
*   Mesh cleaning/repair success rate > 95%

User:

*   Time to understand changes
*   Merge completion rate (for non-conflicting merges)
*   User satisfaction with conflict resolution UI

---

# 12. MVP Scope (Revised - 10-12 Weeks)

Given the complexity of robust 3D geometry operations, the MVP timeline has been revised to allow for more thorough development and testing of core features, particularly around conflict identification and manual resolution.

| Week | Planned Scope | Notes |
| :--- | :--- | :--- |
| Week 1-2 | Upload + Render + Basic Mesh Cleaning | Focus on stable ingestion and display of STL files, including initial mesh integrity checks. |
| Week 3-4 | Commit Graph + Version History | Implement core version tracking and display of commit history. |
| Week 5-6 | Visual Diffing | Develop robust visual comparison of two mesh versions, highlighting additions, removals, and unchanged areas. |
| Week 7-8 | Branching Support | Enable creation and switching between branches. |
| Week 9-10 | Conflict Identification & Basic Merge | Implement detection of overlapping geometry as conflicts. For non-overlapping changes, attempt auto-merge. For conflicts, mark for manual resolution. |
| Week 11-12 | Manual Conflict Resolution UI | Develop an interactive 3D interface for users to visually resolve identified conflicts (e.g., keep left/right, manual selection). |

Deliverable:
Working browser application with STL versioning, visual diffing, branching, and interactive manual conflict resolution for 3D models.
