# Skopeo Studio V4 Design Agent Spec

## Purpose

V4 turns Skopeo Studio from a local visual editor into a local design agent: the user describes an intent, Studio inspects the selected component, compares optional references, and proposes safe code patches that remain fully reviewable before apply.

V4 must stay local-first. It may expose an adapter for AI providers later, but the product must remain useful without OAuth, cloud project storage, CodeSandbox, Storybook, or a required Figma API token.

## Product Goal

Let the user iterate on Skopeo UI with natural design commands while preserving developer control:

1. Select a component or element.
2. Enter an instruction such as "make this card denser", "try a more editorial header", or "align this with the attached Figma reference".
3. Studio produces one or more variants.
4. The user compares variants, reviews diffs, then applies one patch or discards all.

## V4 Features

### 1. Studio Command Palette

Add a compact command surface inside the Studio panel.

Commands should accept:

- selected element context from V1 Inspect
- selected component context from V2 Components
- selected reference context from V3 References
- free-form user intent

Initial commands:

- `Restyle selected element`
- `Create component variant`
- `Compare to reference`
- `Explain design/code differences`
- `Prepare patch proposal`

### 2. Patch History

Persist Studio patch history under:

```txt
.onlook/skopeo-studio/patches.json
```

Patch records:

```ts
type StudioPatchHistoryItem = {
    id: string;
    createdAt: string;
    label: string;
    source: 'manual' | 'variant' | 'design-agent';
    filePath: string;
    oid?: string;
    componentId?: string;
    before: string;
    after: string;
    diff: string;
    status: 'pending' | 'applied' | 'discarded' | 'failed';
};
```

History must never replace Git. It is a Studio activity ledger for discovery and rollback decisions.

### 3. Variant Sandbox

Add lightweight local variants for component experiments.

Variant records:

```ts
type StudioVariant = {
    id: string;
    createdAt: string;
    componentId: string;
    label: string;
    description: string;
    patchIds: string[];
    previewStatus: 'draft' | 'previewed' | 'applied' | 'discarded';
};
```

Variants should allow side-by-side comparison of alternative class patches before writing to the canonical source file.

### 4. Design Review Mode

Before generating or applying patches, Studio should summarize:

- current component role
- visual hierarchy
- spacing density
- typography
- color/surface treatment
- reference alignment gaps
- likely files affected

This review is text-first and local. It can be generated from DOM/source/reference metadata before any AI provider is wired.

### 5. Optional AI Adapter

Define an adapter boundary but do not require a provider:

```ts
type StudioDesignAgentInput = {
    intent: string;
    selection?: StudioElementSource;
    component?: StudioComponentMeta;
    reference?: StudioReference;
    currentClassName?: string;
};

type StudioDesignAgentProposal = {
    label: string;
    rationale: string;
    nextClassName?: string;
    patch?: StudioPatchPreview;
    risks: string[];
};
```

The first implementation can use deterministic local heuristics. Provider-backed generation belongs behind this interface only.

## UX Requirements

- Keep the Studio panel dense and work-focused.
- No landing page or marketing copy.
- Every generated change must produce a diff before apply.
- Never overwrite a source file without explicit user confirmation.
- Show failure states inline and keep failed proposals inspectable.
- Preserve the V1 Inspect, V2 Components, and V3 References tabs.

## Non-Goals

- Full autonomous refactors.
- Full Figma file parser.
- Multi-file AI rewrites without staged diffs.
- Required OpenAI/Figma/GitHub auth.
- Visual vector editing.
- Hosted collaboration.

## Testing Strategy

Unit tests:

- patch history read/write preserves records
- invalid patch history JSON errors instead of silently resetting
- variant creation links patch ids correctly
- deterministic design review summarizes available context

Integration tests:

- local tRPC routes save/list/delete patch history
- variant proposal creates pending patch but does not write source
- applying a variant writes only after explicit apply mutation

Browser smoke:

- open local Skopeo Studio
- select or open a component
- create a variant proposal
- inspect diff
- discard variant
- confirm source file is unchanged

## Suggested V4 Tasks

1. Add local patch history API and tests.
2. Add patch history UI in Studio.
3. Add variant model and local API.
4. Add variant comparison UI.
5. Add design review panel using deterministic local context.
6. Add optional design-agent adapter interface with no required provider.
7. Run Docker/browser smoke.

## Success Criteria

V4 is successful when Skopeo Studio can produce and compare at least two local styling variants for a Skopeo component, preserve a history of proposed/applied/discarded patches, and keep every source edit behind a readable diff and explicit apply action.
