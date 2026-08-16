# Local Onlook Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local import flow create and open an Onlook project backed by the user's local Next app instead of CodeSandbox.

**Architecture:** Use a `local:<path>` sandbox id to mark branches that should avoid CodeSandbox. The first working slice creates the project with a local preview URL and prevents the editor from starting a remote sandbox session; later slices can add full local file editing through server-side filesystem APIs.

**Tech Stack:** Next.js app router, tRPC, Drizzle/Supabase schema already present, Docker Compose bind mounts, existing Onlook editor stores.

## Global Constraints

- Do not call CodeSandbox for the local import flow.
- Keep the existing database shape: store the local marker in `branches.sandboxId`.
- Preview should use a browser-accessible local URL, default `http://localhost:3001`.
- The local project path inside Docker should be configurable with `ONLOOK_LOCAL_PROJECT_ROOT`.

---

### Task 1: Local Import Project Creation

**Files:**
- Modify: `docker-compose.yml`
- Modify: `apps/web/client/src/env.ts`
- Modify: `apps/web/client/src/app/projects/import/local/_context/index.tsx`

**Interfaces:**
- Produces: local sandbox id `local:${ONLOOK_LOCAL_PROJECT_ROOT}`.
- Produces: local preview URL from `NEXT_PUBLIC_LOCAL_PROJECT_PREVIEW_URL`.

- [ ] Add Docker env vars and a bind mount for `D:/Development/Skopeo/SkopeoAPP/Next`.
- [ ] Add env schema entries for `ONLOOK_LOCAL_PROJECT_ROOT` and `NEXT_PUBLIC_LOCAL_PROJECT_PREVIEW_URL`.
- [ ] Replace CodeSandbox fork/upload/setup in local import with direct `project.create`.
- [ ] Run `bun run typecheck`.

### Task 2: Editor Remote-Sandbox Guard

**Files:**
- Modify: `apps/web/client/src/components/store/editor/sandbox/index.ts`
- Modify: `apps/web/client/src/app/project/[id]/_hooks/use-start-project.tsx`

**Interfaces:**
- Consumes: branch sandbox ids with `local:` prefix.
- Produces: editor project readiness without CodeSandbox connection for local branches.

- [ ] Add an `isLocal` guard in `SandboxManager`.
- [ ] Skip `session.start()` and sync/preload injection for local branches.
- [ ] Prevent reconnect attempts for local branches.
- [ ] Run `bun run typecheck`.

### Task 3: Runtime Verification

**Files:**
- No code files unless verification exposes a defect.

**Interfaces:**
- Consumes: Docker service `web-client`.
- Produces: working local project creation and project page load.

- [ ] Rebuild Docker image.
- [ ] Recreate `web-client`.
- [ ] Import `D:/Development/Skopeo/SkopeoAPP/Next`.
- [ ] Confirm the project redirects to `/project/<id>`.
- [ ] Confirm no `sandbox.fork`, `sandbox.start`, or CodeSandbox WebSocket is required for local import.
