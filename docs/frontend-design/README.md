# BGSC frontend screens and HTML skeletons

[Figma design](https://www.figma.com/design/oLGMtiAnxLElj27lRQciuq) · [Requested folder](https://www.figma.com/files/folder/673686864)

The native Figma file contains **148 editable screen/state frames**, **27 shared control components**, named row/column/container Auto Layout, **936 prototype connections** and six prototype starting points. There are **83 planned HTML skeletons** for unfinished MVP work. Counts include alternate states, dialogs, native handoff illustrations and navigation hubs; they are not counts of completed application features.

## Open the HTML

Open `index.html` directly, or run from the repository root:

```bash
python3 -m http.server 8766 --bind 127.0.0.1 --directory docs/frontend-design
```

Then open [the local preview](http://127.0.0.1:8766/). No build or package installation is required. Inputs, selects, checkboxes and textareas are real HTML controls. Navigation buttons connect pages; local-only demo buttons show a notice. The Layout outlines button reveals the row/column/container structure.

- `screens/`: representations of current frontend routes and states, including demo and placeholder UI.
- `skeletons/`: proposed HTML structure for unfinished MVP screens; clearly marked **PLANNED WIREFRAME**.
- `navigation.html`: every explicit/shared navigation connection, labelled source or proposed.
- `screen-inventory.json`: screen content, source paths, layout tree and navigation edges.
- `figma-manifest.json`: file/page/node IDs and prototype starting points.
- `assets/`: the actual auth cat GIF and editable SVGs extracted from the existing Ionicons font.
- `validation.json`: native Figma structural checks and browser validation evidence.
- `build.py`: regenerates the inventory and HTML from the declarative layout definitions.

## Figma structure

1. **00 — Guide & Source Components**: reading guide, source content asset, navigation summary, shared controls and tokens.
2. **01 — Mobile • Current & Planned**: 88 mobile screen/state frames. Start Current mobile — Login, Current mobile — Home, or Planned mobile workflows in Present mode.
3. **02 — Admin • Current & Planned**: 60 desktop screen/state frames. Start Current admin — Login, Current admin — Dashboard, or Planned admin workflows.

The mobile design follows the source charcoal/orange palette, nested cards, 20px content padding, 16px gaps, rounded controls, DM Serif Display headings, Inter body and JetBrains Mono metrics. Admin follows the source white/black layout and 240px sidebar. Figma uses **Arimo** as the metric-compatible substitute for unavailable Arial; HTML retains the original Arial/Helvetica stack. Runtime content images are editable labelled slots because event/member media is not stored in this repository. The original auth illustration is included.

CURRENT means a route/state exists in source, not that its integration is complete. DEMO identifies source UI with static content. PLACEHOLDER identifies current empty admin modules. DORMANT identifies obsolete OTP/profile-completion routes. SYSTEM identifies a native operating-system handoff, represented as a labelled illustration. PLANNED identifies proposed wireframes. Popups are represented as separate preview frames linked by screen transitions; this is not an implementation of native modal behavior.

Only frontend structure and navigation are modelled. No API, authentication, activity sync, upload, billing or production behavior is implemented. Dynamic screens use representative review content. Post-MVP exclusions from the timeline (social feed, friends, store, unions, sponsors/newsletter and Add Post) are not expanded into new features.

## Validation

- All 148 screen HTML pages loaded successfully in Chromium with no page errors.
- All 150 public HTML documents have valid relative links/assets.
- All 83 planned screens are reachable from the planned workflow hubs.
- Login → Home → Events → Details, planned Form builder → Field configuration, Contact → Confirmation, catalogue filtering and layout outlines were exercised.
- Native Figma checks found no invalid prototype destinations, zero-size text or unexpected font families. Controls and text remain editable; the only raster fills are the original auth GIF.
- Representative mobile, admin and form-builder compositions were visually checked and sizing defects corrected.

Legacy, backend and application source files were not modified. The capture-only `.capture-admin.html` is a temporary reference view with the Figma recapture script; it is excluded from the distributable ZIP and is not part of the screen catalogue.
