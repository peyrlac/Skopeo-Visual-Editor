# Skopeo Studio Design

## Purpose

Skopeo Studio is a local-first visual editor for `SkopeoAPP/Next`. It turns the current Onlook local mode into a practical product surface for building Skopeo: inspect real pages, edit components visually, preview code patches, and import Figma references in the third product phase.

The product is not a generic Figma clone. It should feel close to Figma where that helps selection, inspection, variants, and visual iteration, but its main job is to produce clean React/Tailwind changes in the Skopeo app.

## Product Principles

- Local-first: no OAuth, no CodeSandbox, no required external runtime.
- Skopeo-specific: optimize for `src/components`, `src/views`, `src/app`, Tailwind classes, and existing `data-oid` markers.
- Patch-driven: every automated edit must produce a readable diff before it is applied.
- Reversible: applied changes must be easy to revert through git or a Studio patch history.
- Useful before magical: prefer reliable class/style/component editing over broad AI generation.
- Figma-adjacent, not Figma-copy: use canvas, layers, inspect panels, component variants, and frames where they map to code.

## V1: Visual Patch Editor

### Goal

Let the user select an element in the live Skopeo preview, identify the source component/file when possible, edit common Tailwind styling from an inspector, preview the diff, and apply or discard the patch.

### User Flow

1. Open Skopeo Studio from Onlook's project editor.
2. The app preview loads `http://localhost:3001`.
3. Select an element in the iframe.
4. The right panel shows:
   - selected element tag and text snippet
   - `data-oid`
   - inferred source file
   - editable style groups
   - current Tailwind class list
5. Change a style control, such as spacing, color, typography, radius, layout, or size.
6. Studio generates a pending patch instead of immediately writing code.
7. Review the patch diff.
8. Apply, discard, or reset the selected field.

### V1 Editing Scope

V1 supports className edits for static string class names first:

- spacing: `p-*`, `px-*`, `py-*`, `m-*`, `gap-*`
- layout: `flex`, `grid`, direction, alignment, justify, display
- size: width, height, max width, aspect ratio
- typography: text size, weight, color, alignment, leading
- surface: background, border, radius, opacity, shadow

V1 should detect but not rewrite complex class expressions automatically unless it can do so safely. For expressions like template strings, conditional classes, or `cn(...)`, V1 shows the matched file and allows opening the code panel. Support for safe `cn(...)` transforms belongs to a dedicated V1 hardening task after static string edits work end to end.

### Source Mapping

The primary mapping key is `data-oid`. Skopeo already contains many injected `data-oid` attributes. Studio should:

- read the selected element's `data-oid` from the iframe
- search local project files for that oid
- identify the closest JSX opening element
- extract its `className`
- record file path, line estimate, component name if detectable, and editability status

If no oid exists, Studio should offer to inject oids into the current file or selected subtree.

### Patch Model

Every edit produces a pending patch:

```ts
type StudioPatch = {
    id: string;
    createdAt: string;
    filePath: string;
    oid: string;
    label: string;
    before: string;
    after: string;
    diff: string;
    status: 'pending' | 'applied' | 'discarded' | 'failed';
};
```

Patches are stored in browser state for the first V1 slice. After patch apply/discard works end to end, V1 hardening persists patch history to `.onlook/skopeo-studio/patches.json`.

### Error Handling

- If the selected element cannot be mapped to code, show a clear non-blocking state: "Source not found".
- If the class expression is too complex for safe editing, show "Open in code" and do not mutate automatically.
- If applying a patch fails, keep the patch pending and show the exact file/error.
- If the preview server is unavailable, keep Studio usable for component/file inspection and show the preview status separately.

## V2: Component Lab

### Goal

Make Skopeo components testable and editable outside full page context.

### Component Discovery

Studio scans:

- `src/components/**/*.tsx`
- `src/views/**/*.tsx`
- `src/components/ui/**/*.tsx`

It builds a catalog of exported React components with:

- component name
- file path
- prop type name if available
- whether it uses `className`
- whether it appears in current pages
- sample import path

### Component Workspace

The Component Lab shows:

- component list
- isolated preview frame
- props editor for primitive props and common mock presets
- variant presets
- style inspector for selected DOM inside the component preview
- patch center shared with V1

### V2 Editing Scope

V2 adds:

- saved style presets for Skopeo cards, sections, headers, tabs, empty states
- component state presets: loading, empty, error, populated
- mock data presets for media cards, stats, feed rows, profile panels
- before/after snapshots for visual comparison

V2 does not need full Storybook compatibility. It can generate lightweight preview routes inside the Skopeo Next app, such as `/__skopeo-studio/component/<componentId>`, and serve mock props from a local Studio registry.

## V3: Figma Import And Compare

### Goal

Use Figma as a source of visual references and component ideas, without making Figma a required runtime dependency.

### Import Modes

V3 supports three modes:

1. Reference import: upload or paste exported Figma JSON/image and attach it to a Studio component.
2. Compare mode: show Figma reference beside Skopeo component preview and list visual differences.
3. Generate draft: create a proposed component or Tailwind class patch from a Figma frame.

### Figma Integration Boundary

Figma import should be optional. If the Figma plugin/API is unavailable, Studio still supports manual import through:

- PNG screenshot
- SVG export
- pasted JSON from a Figma plugin
- design notes pasted into the prompt/patch panel

### Generated Code Rules

Generated Figma code must:

- use existing Skopeo UI primitives when possible
- prefer Tailwind classes and design tokens
- avoid inline styles unless there is no practical Tailwind equivalent
- produce a patch preview before apply
- never overwrite a component without showing a diff

## Architecture

### Frontend Surfaces

Add a Skopeo Studio mode inside the existing project editor:

- `StudioShell`: owns Studio mode layout.
- `SelectionInspector`: shows selected element metadata and edit controls.
- `PatchCenter`: lists pending/applied patches and renders diffs.
- `ComponentCatalog`: V2 component list and search.
- `ComponentPreview`: V2 isolated component frame.
- `FigmaImportPanel`: V3 import/compare/generate surface.

The V1 can live inside the existing Onlook project editor rather than a separate app route, because it needs the active frame, editor engine, and local file provider.

### Backend/Local APIs

Extend the local sandbox tRPC router with Skopeo Studio procedures:

- `studio.resolveElementSource({ sandboxId, oid })`
- `studio.previewClassPatch({ sandboxId, filePath, oid, nextClassName })`
- `studio.applyPatch({ sandboxId, patch })`
- `studio.listComponents({ sandboxId })`
- `studio.readComponentMeta({ sandboxId, componentId })`

V1 can implement these under the existing `sandbox` router if faster, but a dedicated `studio` router is preferred before V2.

### Code Transform Layer

Create a focused transform package/module for Studio:

- parse TSX with existing parser utilities
- find JSX opening elements by `data-oid`
- read and replace string-literal `className`
- detect complex className expressions and mark them unsupported
- generate formatted code
- generate unified diff text

The transform layer must be independently unit-tested with Skopeo-like fixtures.

### Data Flow

Selection:

1. iframe preload sends selected element details to editor engine.
2. Studio inspector reads active element from editor state.
3. Inspector calls `studio.resolveElementSource`.
4. Transform layer maps oid to file/className.
5. Inspector renders controls from parsed Tailwind classes.

Patch:

1. User changes a style control.
2. Inspector computes next class list.
3. Frontend calls `studio.previewClassPatch`.
4. Patch Center shows diff.
5. User applies.
6. Backend writes file through local provider.
7. Next dev server refreshes preview.

## Testing Strategy

### Unit Tests

- oid source resolver finds JSX elements in Skopeo-like TSX.
- className parser handles static string class names.
- className patcher replaces only the intended JSX attribute.
- complex expressions are detected and skipped safely.
- diff generation includes file path and before/after hunks.

### Integration Tests

- local tRPC studio routes can resolve and patch a fixture project.
- applying a patch changes a file and can be reverted.

### Browser Tests

- load local project
- select a known element
- inspector shows file and className
- change a safe Tailwind class
- patch appears
- apply patch updates source file
- preview remains reachable

## Milestones

### Milestone 1: V1 Source Mapping

Deliver a selectable element inspector that resolves `data-oid` to file, line estimate, component name, and current className.

### Milestone 2: V1 Patch Center

Deliver patch preview/apply/discard for static string className edits.

### Milestone 3: V1 Figma-like Inspector

Deliver practical style controls for spacing, layout, typography, surface, and sizing.

### Milestone 4: V2 Component Catalog

Deliver component discovery and a component list with metadata.

### Milestone 5: V2 Component Lab

Deliver isolated component preview with mock props and style patching.

### Milestone 6: V3 Figma Reference Import

Deliver manual Figma reference import and side-by-side compare.

### Milestone 7: V3 Figma Draft Generation

Deliver draft component/patch generation from Figma references.

## Non-Goals For The First Implementation Pass

- Full vector editing.
- Multiplayer collaboration.
- Complete Figma file parser.
- Arbitrary React refactors from visual controls.
- Guaranteed safe editing of every `cn(...)` or conditional class expression.
- Cloud deployment or hosted project storage.

## Product Decisions

- V1 appears as a new right-panel tab named `Studio`, leaving the existing Design inspector intact until Studio proves itself.
- Patch history starts in browser state for the first V1 slice and persists to `.onlook/skopeo-studio/patches.json` during V1 hardening.
- V2 component previews are generated as lightweight Next routes under `/__skopeo-studio/component/<componentId>`, because this keeps previews inside the same runtime, Tailwind config, fonts, and app dependencies as Skopeo.

## Recommended First Cut

Build V1 in three implementation phases:

1. local source mapping by `data-oid`
2. static className patch preview/apply
3. inspector controls that produce those className patches

This gives Skopeo a useful visual editor quickly, while keeping V2 and V3 aligned with the same patch engine.
