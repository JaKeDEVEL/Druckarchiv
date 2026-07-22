# Druckarchiv Design Lab

This directory is an isolated design exploration for a future Druckarchiv UI. It does not replace the released interface, is not part of an updater release, and uses synthetic demo content only.

Open `/design-lab/` through the local Vite development server. The review bar switches between all concepts and their light and dark variants without changing application data.

## Round 1: three directions

### A · Strict Material 3

- **Idea:** A close interpretation of Material Design 3 for a desktop library.
- **Color:** Purple primary color, broad tonal surfaces, low-contrast containers.
- **Shape:** Generous corner radii and pill-shaped controls.
- **Layout:** Navigation rail, prominent KPI cards, spacious grouping.
- **Question:** Does the familiar Material grammar make Druckarchiv easier to understand, or does it feel too much like a generic Google product?

### B · Druckarchiv × Material 3

- **Idea:** Material interaction logic with denser desktop ergonomics and a fabrication-focused identity.
- **Color:** Warm orange as the action color, teal for local/success states, graphite surfaces.
- **Shape:** Moderate radii with notched, layered details inspired by print beds and tool labels.
- **Layout:** Compact navigation, clear content frame, efficient cards and controls.
- **Question:** Is this the right balance between a dependable design system and a recognizable Druckarchiv character?

### C · Quiet Desktop Utility

- **Idea:** A calm, professional file tool closer to a native desktop utility than a dashboard.
- **Color:** Cool neutrals with restrained blue emphasis.
- **Shape:** Small radii, crisp separators, minimal decorative surfaces.
- **Layout:** Dense sidebar, direct information hierarchy, reduced KPI prominence.
- **Question:** Does this feel more durable and professional, or too reserved for a visual 3D library?

## Round 2: feedback synthesis

### D · Quiet Material

- **Idea:** Keep Quiet Utility's familiar file-tool hierarchy and density, then add only the useful parts of Material 3: semantic tonal surfaces, softer states, and restrained elevation.
- **Color:** Mineral blue and petrol for actions and files, warm ochre for folders; deliberately no default Material purple.
- **Shape:** Medium radii that clarify grouping without turning every control into a pill.
- **Layout:** Full desktop sidebar, compact KPI row, tool-like content area, and slightly raised active states.
- **Signature:** Asset cards end in a subtle stacked “archive step,” referencing physical drawers and print plates.
- **Question:** Does the added depth make the clean utility interface more approachable without weakening its clarity?

## What to compare

The same synthetic library, states, wording, and interactions are used in every direction. Compare:

1. **Orientation:** Can users immediately distinguish folders, files, formats, favorites, and the current view?
2. **Density:** Is enough information visible without making scanning tiring?
3. **Hierarchy:** Are the current location, primary action, filters, and assets obvious in the right order?
4. **Character:** Does the interface feel like a deliberate Druckarchiv product rather than a generated dashboard?
5. **Accessibility:** Are selected states, focus, text, and controls clear in light and dark mode?
6. **Responsiveness:** Does the interface remain usable when the desktop window becomes narrow?

## Interactive prototype scope

The prototype includes direction and theme switching, KPI format filters, combined favorites, search, sorting, grid/list views, a library settings dialog, and a model preview dialog. Interactions are for design review only and do not access the filesystem, launch slicers, or persist settings.

The Quiet Material high-fidelity round also includes direct folder navigation with breadcrumbs and nested folders, pagination, cross-page file selection, a shared slicer action bar, and explicit loading, empty, and unavailable-folder states. The review bar can switch between these states without affecting the demo library.

The `Dateiverwaltung` switch previews the proposed local-file CRUD workflow: adding files to a chosen library folder, renaming files and folders, moving them to another physical folder, and moving an entry to the operating system trash. The selection states also demonstrate permanently visible favorite and selection controls at the leading edge. These are intentionally non-functional review states; they never read, write, move, or delete local files.

The selected direction's rules and staged migration proposal are documented in [`QUIET_MATERIAL_SPEC.md`](./QUIET_MATERIAL_SPEC.md).

No production implementation or migration has started. The chosen direction can be refined in a second round before individual components are moved into the application.
