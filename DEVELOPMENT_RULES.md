# Development and change-control rules

These rules apply to all future work in this repository.

1. **Work directly on `main` only while the project is in development.** Do not create feature branches or pull requests for routine development work unless the user explicitly asks to change this rule or a platform restriction makes it necessary. Keep the workflow simple and avoid confusing branch proliferation.
2. **Protect verified working behavior.** Once a feature or flow has been tested and confirmed to work as expected, treat it as frozen. Do not refactor, redesign, replace, or otherwise alter it unless the user explicitly requests that change.
3. **Keep changes scoped.** For each request, change only the requested behavior and the minimum supporting code or configuration. Avoid unrelated cleanup, broad refactors, and drive-by fixes.
4. **Check before changing shared or production data.** Verify the target project, schema, and intended environment before applying database changes. Never assume two apps share a backend.
5. **Verify before release.** Run the production build and relevant focused checks for each change. Report checks that could not be run, known baseline failures, and any manual end-to-end tests still needed. Do not claim a flow is verified unless it was actually tested.
6. **Preserve existing data and behavior.** Prefer additive, reversible changes. Do not modify existing working product, order, seller, or account data unless the request specifically requires it.
7. **No production deployment by implication.** A successful code change or database migration is not, by itself, authorization to deploy a new frontend release. Follow the user's explicit release instruction and state the deployment status clearly.

## Existing lint baseline

The repository-wide ESLint command currently fails on hundreds of existing violations across unrelated files. Do not mass-edit unrelated working files to make the global lint command pass. Use the production build and focused checks for scoped changes, and address the repository-wide lint backlog only when explicitly requested as a separate task.
