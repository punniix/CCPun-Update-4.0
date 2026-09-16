# FHC legacy calculator contract

This directory is **not** the current `/tools/financial-health-check/` UI/runtime owner.

The current Public tool is owned by `components/ClientFHC.tsx` and `components/LifeCoverageWizard.tsx`. The TypeScript files in this directory are retained only because regression suites use them as the frozen pre-cutover Financial Health Check calculation/reference contract.

Rules:

- Do not import this calculator into new Public UI.
- Do not change formulas here as part of visual/refactor work.
- If the frozen parity contract is retired, migrate its regression evidence first and remove this directory in the same reviewed change.
- New Financial Health Check behavior belongs to the current `LifeCoverageWizard` flow or a clearly named successor domain module, not this legacy contract.
