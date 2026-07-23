# Copilot Agent Repository Instructions

Apply these rules on every task in this repository:

1. Run **first-click validation** immediately with:
   - `npm run prepush:check`
2. Before any push/PR handoff, run:
   - `npm run prepush:check`
   - `npm run build`
3. If GitHub rejects with **GH013 (creations restricted / branch ruleset policy)**, do not retry blindly.
   - Read the exact GH013 rule violation.
   - Fix that rule requirement first (required checks, branch target, signatures/sign-offs, PR-only flow, etc.).
   - Re-run `npm run prepush:check` before attempting to push again.

These instructions are mandatory for all Copilot agents working in `caortizmx/Aventuras-Medinitas`.
