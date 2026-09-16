# CI Planning legacy calculator contract

This directory is **not** the current `/ci-planning/` UI owner.

The current Public calculator is owned by `features/ci-planning/calculator/` plus the current `components/` wizard/result flow. `legacy/calculator.ts` remains only as a frozen parity reference used by regression tests to prove that approved legacy outputs do not drift during refactors.

Rules:

- Do not import the legacy calculator into new Public UI.
- Do not edit this formula as part of visual or architecture cleanup.
- Retire it only after the parity tests are migrated to an equally explicit frozen fixture/contract.
- New calculator behavior belongs to the current calculator domain, not `legacy/`.
