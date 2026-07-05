# Abuse Cases

1. A guest user attempts to apply a patch. Expected result: OPA deny.
2. An engineer attempts a shell tool. Expected result: OPA deny.
3. A tenant mismatch is supplied. Expected result: OPA deny.
4. A raw SQL query selects email/name. Expected result: data guard reject.
5. A mutation SQL command is supplied. Expected result: data guard reject.
6. A workflow verifies without evidence. Expected result: closure denied.
7. OPA binary is unavailable. Expected result: fail closed.
