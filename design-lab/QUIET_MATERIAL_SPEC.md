# Quiet Material — design foundation

Status: selected direction, high-fidelity exploration. This specification is not yet a production migration.

## Product thesis

Druckarchiv is a local desktop file tool for people who need to recognize, organize, inspect, and open 3D-print assets quickly. It should feel as dependable as a file manager and as visually legible as a modern model library.

Quiet Material keeps the structure calm and uses depth only to explain state. A surface may rise when it is active, selected, or temporarily important. Static decoration stays flat.

## Core tokens

### Light

- **Archive paper** `#FBFCFB` — primary surface
- **Mineral mist** `#EDF1F1` — workspace background
- **Tonal glass** `#DBE7E5` — active and selected containers
- **Deep mineral** `#315F66` — actions, files, focus
- **Folder ochre** `#94652B` — folders only
- **Ink** `#1C2425` — primary text

### Dark

- **Archive black** `#171D1E` — workspace background
- **Tool surface** `#202829` — primary surface
- **Raised mineral** `#344547` — active and selected containers
- **Pale mineral** `#9ACBD0` — actions, files, focus
- **Warm folder** `#E1B477` — folders only
- **Paper white** `#EEF4F3` — primary text

## Type roles

- **Interface and headings:** the operating-system UI sans stack. This reinforces the desktop-tool character and avoids shipping a decorative web font.
- **Paths, dates, counts, and format labels:** `SFMono-Regular`, `Consolas`, or the platform monospace fallback.
- **Hierarchy:** sentence case for actions and headings; uppercase with restrained tracking only for technical eyebrows and file-format labels.

## Layout model

```text
┌─ Library navigation ─┬─ Current library / folder ───────────────────┐
│ Product + local state│ Header                         Main actions   │
│ Library              ├─ Format KPIs ────────────────────────────────┤
│ Favorites            │ Breadcrumbs                                   │
│ Recent               │ Search · sort · favorites · view             │
│                      │ [conditional selection action bar]            │
│ Source folders       │ Heading                               result  │
│                      │ Assets / loading / empty / error              │
│ Local-only status    │ Pagination                                   │
└──────────────────────┴───────────────────────────────────────────────┘
```

The sidebar is structural, not ornamental. Below 980 px it collapses to a navigation rail. KPIs wrap before controls or labels become unreadable. Folder views start as lists; the user's grid/list choice remains available.

## Signature: archive steps

Model and folder cards end in a two-line stacked edge. It evokes physical archive drawers and stacked print plates without using a decorative illustration. The edge becomes slightly stronger on hover or selection, giving one controlled depth cue to the product.

## Elevation rules

1. **Level 0:** workspace, static cards, dialogs' internal sections.
2. **Level 1:** toolbar, active navigation item, normal archive card edge.
3. **Level 2:** selected KPI, selected file, selection action bar.
4. **Level 3:** modal dialogs only.

No other component receives a shadow. Dark mode uses tonal separation before shadow strength.

## Interaction states

- **Folder:** warm ochre identifies the object type; opening it replaces the mixed library with direct children and breadcrumbs.
- **File:** mineral blue identifies printable assets; clicking the preview opens the model dialog.
- **Favorite:** remains a property of either a file or folder and never replaces the object-type color.
- **Selected entry:** adds a mineral outline and turns the fixed-height search toolbar around its horizontal axis to reveal shared management and slicer actions. Because both toolbar faces occupy the same reserved slot, selecting an entry never moves the result list. Selection is retained across pages.
- **Loading:** the chosen KPI changes immediately while only the content region becomes a restrained skeleton.
- **Empty:** explains which user-controlled filter can be changed and offers one reset action.
- **Unavailable folder:** states the cause class and offers the library management action.

## Local file management proposal

The library mirrors the filesystem, so every management action must describe its physical effect. No additional hover controls are added to cards. Favorite and selection controls form one permanently visible vertical marker rail; they never cover names or metadata. Users select files or folders there and the existing search toolbar reveals contextual actions without changing page geometry.

- **Create:** `Dateien hinzufügen` sits beside the result count. It opens a native file selection followed by an explicit destination inside a registered library root. Files are copied to that real folder.
- **Read:** browsing, search, preview, metadata, and slicer actions remain unchanged.
- **Update:** one selected file or folder can be renamed; one or several entries can be moved. File extensions are preserved by default and destinations use the existing folder hierarchy. A folder cannot be moved into itself or one of its descendants.
- **Delete:** the primary proposal is `In den Papierkorb`, not an immediate permanent delete. The confirmation names the affected file or folder, shows its path, and explains that it is removed from the real storage location. Folder deletion explicitly includes every contained file and subfolder. External volumes warn that recovery may not be available.

### Filesystem safety requirements

1. Canonicalize the source and destination and verify both remain inside a currently registered library root.
2. Reject symlink escapes, stale paths, read-only sources, and unavailable volumes before enabling an action.
3. Check collisions before copy, rename, or move; never overwrite silently.
4. Use atomic filesystem operations where the platform supports them and report partial failures per file for multi-selection.
5. Use the operating system trash API by default. A future permanent-delete option belongs in advanced settings and requires a stronger confirmation.
6. Refresh only the affected folder and cached metadata after a successful mutation, keeping selection and navigation stable.
7. Registered library roots cannot be renamed or deleted from the content view. `Bibliothek verwalten` may detach such a root from Druckarchiv, but never deletes that root from the drive.

## Component constraints

- Controls use 10 px radii; cards use 11 px; large application and dialog surfaces use 15 px.
- Pills are reserved for compact statuses, never used as the default shape for every button.
- File and folder labels always appear as text, not color alone.
- Selected states require at least two signals: tonal surface plus border, icon, or elevation.
- Focus uses the same mineral role in both themes and stays visible outside the control edge.
- Motion is limited to short state transitions and the loading sweep; reduced-motion settings disable both.

## Proposed production migration

1. Introduce semantic tokens without changing layout.
2. Convert shared controls, focus states, and dialogs.
3. Convert navigation, KPIs, and toolbar.
4. Convert cards, list rows, selection, and pagination.
5. Convert viewer and library management.
6. Run cross-platform visual QA before making Quiet Material the default.

Each step should remain independently releasable and reversible. The existing functional behavior and performance tests stay authoritative during the migration.
