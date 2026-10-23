# Design

Screens are designed in Figma first, then built from the same tokens. This folder holds the link to the Figma file and any exported references.

- **Figma file:** [MeshGit](https://www.figma.com/design/r6RysycQdSts0aWMk6jEsK)

The file has two pages. **Screens** holds the five frames below. **Foundations** holds the color variables, text styles, and shared components (Button, NavItem, Sidebar, CommitRow, Avatar, BranchBadge, icons).

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

| Meaning | Color | On viewer `#F5F5F2` | On thumbnail `#0A0C14` |
| --- | --- | --- | --- |
| Added geometry | `#1F9D55` | 3.2:1 | 5.6:1 |
| Removed geometry | `#D93F2B` | 4.1:1 | 4.4:1 |
| Unchanged geometry | `#7C828C` | 3.5:1 | 5.1:1 |
| Conflict zone | `#D4A373` | | |

Each diff color clears the 3:1 contrast minimum for graphics on both backgrounds. The green leans blue and the red leans orange, so the two stay distinguishable for most red-green color blindness.

## Conventions

- Unbuilt features stay visible in the nav but disabled. They don't link to placeholder pages.
- Loading states use the on-theme wireframe triangle loader (`MeshLoader`), not a generic spinner.
- The dashboard is the default view, and the full viewer is a secondary screen.
