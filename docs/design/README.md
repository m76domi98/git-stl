# Design

Screens are designed in Figma first, then built from the same tokens. This folder holds the link to the Figma file and any exported references.

- **Figma file:** [MeshGit](https://www.figma.com/design/r6RysycQdSts0aWMk6jEsK)
- **Screens and requirements:** [screens.md](screens.md)

The file has three pages:

- **Screens** holds the thirteen frames below. The app screens are in the first two rows, and the landing page and sign-in flow are in the third.
- **Foundations** holds the color variables, text styles, icons, and shared components: Button, IconButton, Dropdown, NavItem, Sidebar, CommitRow, Badge, Avatar, InfoRow, LegendItem, ViewportToolbar, AxisGizmo, Logo, TextField, Checkbox, and AuthBrandPanel.
- **Archive** keeps earlier drafts, including the v3 screens with flat vector renders.

## Frames

| # | Frame | Purpose |
| --- | --- | --- |
| 1 | Dashboard | Project card with the latest `main` model on a dark stage, mesh metadata, and recent commits underneath |
| 2 | 3D Viewer | One version full screen on the dark stage, with glass panels for tools, commit, model info, and display settings |
| 3 | Visual Diff | Two versions overlaid, with added and removed geometry colored |
| 4 | Branch Graph | Branch list, commit graph, and ahead/behind for each branch |
| 5 | Merge / Conflict | Auto-merged regions and conflict regions marked on the model |
| 6 | Conflict Resolution | Left and right close-ups, with keep left, keep right, or manual select |
| 7 | Merge Result | Preview of the merged mesh, a summary, and the commit message |
| 8 | Commit History | Commits grouped by day, filterable by branch and author |
| 9 | Landing Page | What MeshGit does, how the commit / compare / merge loop works, and the way in |
| 10 | Sign In | GitHub or email and password, with remember me and a reset link |
| 11 | Create Account | Name, email, password with a strength meter, and the terms checkbox |
| 12 | Reset Password | Email field for the reset link, shown with its error state |
| 13 | Check Your Email | Confirmation after the reset link is sent |

## Tokens

The palette is warm and neutral: beige surfaces, a dark olive nav rail, and forest green for primary actions. Type is Inter, Bold for headings and labels and Regular for body text. The landing page adds three larger styles: Hero (56), Section Title (32), and Lead (17).

| Token | Value | Use |
| --- | --- | --- |
| `bg` | `#F3EEE5` | Page background |
| `surface` | `#FFFCF6` | Cards, panels |
| `tan` | `#E9DFD0` | Soft buttons, selected rows |
| `border` | `#E3D8C6` | Card and input borders |
| `text` | `#30291F` | Primary text |
| `muted` | `#766B5E` | Secondary text |
| `accent` | `#40543B` | Primary actions (forest green) |
| `sage` | `#8C9D76` | Success, auto-merged |
| `clay` | `#C7B89F` | Timeline rail, neutral accents |
| `danger` | `#C9584D` | Conflicts, high severity |
| `sidebar/bg` | `#2F3428` | Nav rail |
| `sidebar/active` | `#45573E` | Active nav item |

## Studio look

The app chrome stays light (beige page, cream cards, olive nav), but every 3D view sits on a dark studio stage: a dark floor with a soft key light and a vignette, like a product render. Panels that float over the model are dark glass: translucent, blurred behind, with a thin border. The viewport toolbar stays cream so it reads as the same control everywhere.

| Token | Value | Use |
| --- | --- | --- |
| `studio/stage` | `#1C1D19` | Viewport background and floor tone |
| `studio/glass` | `#262721` at 80% + background blur | Panels over the viewport |
| `studio/glass-border` | `#3A3B33` | Glass panel borders, inactive toggles |
| `studio/text` | `#EFE8DA` | Text and icons on glass |
| `studio/muted` | `#A39A8B` | Secondary text on glass |
| `studio/toggle-on` | `#8C9D76` | Active toggles and sliders |

These live in the Viewport variable collection with the other fixed colors.

## Viewport colors

The 3D viewport is deliberately independent of the site theme. Scene, mesh, edge, and grid colors are fixed values in the Three.js code, not CSS variables. Diff and merge colors follow the same rule.

| Meaning | Color | On stage `#1C1D19` |
| --- | --- | --- |
| Mesh | `#D8CCB6` | |
| Added geometry | `#5E8A4B` | 4.2:1 |
| Removed geometry | `#C9584D` | 4.0:1 |
| Unchanged geometry | `#D8CCB6` (plain mesh) | |
| Conflict | `#C9584D` | 4.0:1 |
| Auto-merged | `#8C9D76` | 5.8:1 |
| Main side / feature side | `#5B7A4F` / `#D9776B` | 3.5:1 / 5.5:1 |

Every change color clears the 3:1 contrast minimum for graphics on the stage. Main side was lightened from `#40543B` (2.1:1) for this. Unchanged geometry keeps the plain mesh color, so only real changes stand out.

## Conventions

- Unbuilt features stay visible in the nav but disabled. They don't link to placeholder pages.
- Loading states use the on-theme wireframe triangle loader (`MeshLoader`), not a generic spinner.
- The dashboard is the default view, and the full viewer is a secondary screen.
- The renders in the frames are placeholders cropped from the mood board. The app renders the real mesh with Three.js, lit to match: dark floor, warm key light, soft shadow.
