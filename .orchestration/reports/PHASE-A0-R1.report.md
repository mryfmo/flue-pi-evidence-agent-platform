# PHASE-A0-R1 Worker Report

status: ready_for_review
acceptance_tier: review
revision: PHASE-A0-R1-v1

## Result

The mandatory full-register command now validates the exact `SPEC-01..SPEC-20` register and executes every existing per-SPEC semantic validator. It accepts separated and equals forms and fails closed on malformed ranges, mixed modes, missing/duplicate/extra/malformed register records, duplicate trace links, and stale semantic contracts.

The real-CLI regression suite has seven groups, including an isolated stale SPEC-05 document that can pass ID-level checks but is rejected by full-register semantic validation.

## Fresh SPEC-20 local vector

After the 22 bound source paths stabilized and formatting passed, all six actual capability commands were rerun successfully. The refreshed local test vector is:

- source revision: `93aea20d423c350b343afce37df77967bc5224322868b2ffc7eb7ab484556215`
- run ID: `run-spec20-test-vector-007`
- test-only key ID: `spec20-test-vector-rs256-v5`
- six unique machine artifacts with exact byte digests
- six RS256 JWTs binding artifact, source, run, requirement, test, outcome, producer, verifier, and non-synthetic/non-self-attested fields
- exact six-row external trust catalog and sorted attestation bundle
- bundle digest: `sha256:45daa38c0dd2d2db823c63117289a286120d90ad9c50c3291597895ba4756753`

The temporary private key was deleted. Repository scanning found no private key. This is explicitly a local test vector and does not claim CI, KMS, or production provenance.

## Independent verification

Independent native-Node verification recomputed the exact 22-path source digest, all six artifact hashes, all six signatures and payload/body tuples, the exact catalog, run/source equality, sorted attestation set, and bundle digest. A bound-source mutation and an artifact mutation both denied. The source-manifest file remained read-only with SHA-256 `d69ca72f7d34fad9b54ae7d6183f26fa1abddabcd9b99d96f5c69e9eeb7f8880`.

## Validation summary

- register separated and equals forms: passed
- legacy `SPEC-01,SPEC-20`: passed
- no-argument full check: passed
- focused Node tests: 7/7
- OPA suite: 166/166
- six actual capability commands: all exit 0
- independent artifact/signature/catalog/bundle verification: passed
- source and artifact mutations: denied
- typecheck, lint, format, and diff integrity: passed
- invalid reversed range: exit 1 with the expected condition
- private-key scan: no match; temporary key absent

All repository edits are within section 9's allowed files. Policy rules, source manifest, decisions, acceptances, product runtime, dependencies, and production provenance were not altered.
