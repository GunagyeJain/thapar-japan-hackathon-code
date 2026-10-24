# backend/

API, rules engine and solvers. Scaffolded by module M0 once the plan picks the stack.

Layout rule: each module lives in its own package, e.g. `app/modules/m2_optimizer/`, owned by that module's owner.
The app entry point that registers each module's routes is shared zone: one line per module, don't rewrite.
