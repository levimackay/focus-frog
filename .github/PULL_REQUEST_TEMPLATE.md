## Summary

<!-- What does this PR change, and why? -->

## Related issue

<!-- Closes #123, or "None" -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] CI/CD or tooling

## Checklist

- [ ] `ARCHITECTURE.md` updated if this changes command names, payload shapes, the state machine, or directory layout it documents
- [ ] `npm run typecheck && npm run lint && npm run test && npm run build` pass locally
- [ ] `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` pass locally (from `src-tauri/`)
- [ ] New/changed IPC commands have matching TypeScript types in `src/ipc/types.ts`
- [ ] No new free-text input reaches the DB without a length cap (frontend + backend, per `security/mod.rs`)
- [ ] No secrets, tokens, or local DB files (`*.db`, `*.sqlite`) committed

## How was this tested?

<!-- Manual steps, or which automated tests cover this -->

## Screenshots (if UI-facing)
