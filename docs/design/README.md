# Design

Screens are designed in Figma first, then built from the same tokens. This folder holds the link to the Figma file and any exported references.

- **Figma file:** _not created yet_ (phase 2 of the [roadmap](../roadmap.md))
- `frontend-plan.png` is the original static mockup that the current screens were built from. It will be replaced by the Figma frames.

## Frames to design

| Frame | Purpose |
| --- | --- |
| Dashboard | Project overview: stats, live mesh thumbnail, recent commits |
| Model viewer | Full-screen 3D view of one version |
| Diff view | Two versions compared, with added / removed / unchanged geometry colored |
| Branches | Branch list and switching, with each branch's head commit |
| Merge / conflict | Conflict zones in the viewport; keep left, keep right, or manual selection |

## Tokens

The site uses a neutral earth-tone palette, chosen over the usual violet/neon "tech" look:

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#F4F6F0` | Page background |
| `--surface` | `#FDFCF8` | Cards, panels |
| `--accent` | `#3B4A3F` | Primary actions, active nav (forest green) |
| `--clay` | `#D4A373` | Secondary accent (terracotta) |

## Viewport colors

The 3D viewport is deliberately independent of the site theme. Scene, mesh, edge, and grid colors are fixed values in the Three.js code, not CSS variables. Diff colors follow the same rule:

| Meaning | Color |
| --- | --- |
| Added geometry | Green |
| Removed geometry | Red |
| Unchanged geometry | Gray |

The exact hex values are to be chosen in Figma, checked for contrast against both the light viewer background and the dark thumbnail background.

## Conventions

- Unbuilt features stay visible in the nav but disabled. They don't link to placeholder pages.
- Loading states use the on-theme wireframe triangle loader (`MeshLoader`), not a generic spinner.
- The dashboard is the default view, and the full viewer is a secondary screen.
