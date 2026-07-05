# Failure Mode Matrix

| Failure | Expected outcome | Evidence |
| --- | --- | --- |
| OPA missing | Fail closed, no patch | policy test |
| High risk action | requires approval | failure test |
| Guest user | deny | OPA test |
| Shell tool | deny | failure test |
| Raw SQL | deny | data proxy test |
| Mutation SQL | deny | data proxy + Python tests |
| Multi-statement SQL | deny | data proxy + Python tests |
| Unpatched workspace | verifier fails | component code test |
| Missing evidence | closure denied | ledger unit test |
