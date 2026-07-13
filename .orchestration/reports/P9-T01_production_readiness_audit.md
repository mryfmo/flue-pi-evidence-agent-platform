# P9-T01 製品運用レベル到達度の全面監査

- 対象 revision: `2c6fdb0`
- 監査日: 2026-07-10
- report revision: **rev2**（P9-T01 acceptance rev1 の R1-R8 と severity query を反映）
- 判定: **not production-ready**。決定論的 validation fixture と境界単体テストは強いが、本番 LLM、OpenSandbox remediation、実データ分析、production deployment の実経路が未成立。
- 変更範囲: report-only。product/docs/tests/policy は変更していない。

## サマリ

| 面 | P0 | P1 | P2 | 計 |
| --- | ---: | ---: | ---: | ---: |
| 仕様 | 0 | 7 | 0 | 7 |
| docs | 2 | 6 | 2 | 10 |
| 実装 | 4 | 19 | 0 | 23 |
| 検証 | 0 | 8 | 6 | 14 |
| **計** | **6** | **40** | **8** | **54** |

### P0 一覧

1. `GAP-008`: validation image 以外の production deployment/profile がない。
2. `GAP-009`: LiteLLM の実起動、仮想キー、認証付き smoke を commissioning できない。
3. `GAP-016`: production gateway は Flue/Pi remediation workflow から呼ばれない。
4. `GAP-017`: OpenSandbox runtime で remediation の scan/apply/rescan が成立しない。
5. `GAP-018`: governed data analysis は固定 3 行 fixture だけで、実データ入力を持たない。
6. `GAP-021`: 修復エンジンは fixture 完全一致置換で、実ワークロードを修復できない。

## Gap register

| ID | 面 | 重大度 | 対象 (file:line) | 現状 | 製品レベルに必要な状態 | 既知/新規 | 工数 | 修正リスク / 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-001 | 仕様 | P1 | `docs/AGENT_LOOP_SPEC.md:3-16`; `docs/HYPOTHESIS_LEDGER_SPEC.md:3-18`; `docs/EVIDENCE_GRAPH_SPEC.md:3-11`; `docs/TOOL_REGISTRY_SPEC.md:3-16` | 初期 stub は列挙だけで、schema version、型、ID 一意性、状態遷移、再開、冪等性、競合、invalid input を定義しない。Evidence spec は実装の `test` kind も欠く。 | machine-readable schema と normative state/closure contract、migration/versioning、negative cases を定義し gate で検査する。 | 新規 | L | MED / HIGH |
| GAP-002 | 仕様 | P1 | `docs/SPECIFICATION.md:30-58`; `docs/requirements.json:2-10`; `docs/traceability.json:2-10`; `docs/TRACEABILITY_MATRIX.md:14-29` | Gateway/Sandbox/Phase 8 requirements は Markdown にあるが canonical JSON は legacy PR-001..008 のみ。 | 全 normative ID を一つの catalog に収録し、implementation/test/gate/evidence を双方向に束縛する。 | 新規（G13 対応後の残存） | M | MED / HIGH |
| GAP-003 | 仕様 | P1 | `docs/PRODUCTION_GATEWAY_DESIGN.md:224-255,277-314`; `docs/INTEGRATION_BOUNDARY.md:100-121` | 旧設計は OpenAI/vLLM/local fallback と未決 open questions を残す一方、Phase 8 は LiteLLM alias 限定・production local fallback 禁止。 | current production invariant を一意化し、旧提案は historical/superseded と明示する。 | 既知（Phase 8 問題7/16） | S | LOW / HIGH |
| GAP-004 | 仕様 | P1 | `docs/THREAT_MODEL.md:3-12`; `docs/ABUSE_CASES.md:3-9`; `docs/INTEGRATION_BOUNDARY.md:43-96` | threat/abuse catalog は初期 OPA/SQL/closure のみ。LiteLLM bypass/logging、virtual-key abuse、AGMSG injection、hook bypass、sandbox egress/credential、confidential approval を含まない。 | 各 Phase 8 trust boundary を threat→control→test/evidence で網羅する。 | 既知問題群、文書未反映は新規 | M | LOW / HIGH |
| GAP-005 | 仕様 | P1 | `docs/POLICY_MODEL.md:3-26`; `docs/TOOL_REGISTRY_SPEC.md:3-16`; `src/workflows/remediate.ts:101-119,151-207` | OPA を全 side effect の authority と宣言し4 toolsを列挙するが、workflow が authorize するのは `apply_patch` のみ。verify/metric/rescan の policy point が未定義。 | policy 対象を正確に限定するか、全 side-effect tool を共通 authorization/audit dispatcher に通す。 | 新規 | M | MED / HIGH |
| GAP-006 | 仕様 | P1 | `docs/VALIDATION_PLAN.md:3-5`; `docs/PRODUCTION_GATES.md:69-73`; `RELEASE_MANIFEST.md:39-47` | `validate-release` が唯一の releasable state とする一方、別文書は CI-only 3 jobs と process evidence も必須とする。 | local AND CI-only AND process gates の一意な判定式、主体、revision/evidence freshness を正本化する。 | 新規 | S | LOW / HIGH |
| GAP-007 | 仕様 | P1 | `docs/HYPOTHESIS_LEDGER_SPEC.md:18`; `src/workflows/remediate.ts:37-42`; `src/lib/ledger.ts:139-148` | durable と称するが全 run が固定 ledger/audit path を共有し、同時実行、resume、partial write、retention の semantics がない。 | run/task scoped immutable paths、atomic persistence、resume/idempotency、retention/concurrency contract を定義する。 | 新規 | M | MED / HIGH |
| GAP-008 | docs | P0 | `Dockerfile:3-21`; `docs/DEPLOYMENT.md:35-73`; `scripts/deploy-smoke.sh:1-56` | Dockerfile は validation image で CMD も `validate-release`。production service topology、process supervisor、startup/shutdown、port/auth、resource limits、upgrade/rollback profile がない。 | 単一ホストの最小 production profile（gateway、LiteLLM、OpenSandbox、Flue app、OPA/evidence sink）と再現可能な start/stop/upgrade を提供する。 | 既知 G2、production-serving 不在は現状再確認 | L | HIGH / HIGH |
| GAP-009 | docs | P0 | `docs/LITELLM_PROXY.md:5-39`; `docs/RUNBOOK.md:44-53`; `scripts/orchestrator/platform-health.mjs:87-101` | LiteLLM は未 vendor/install。virtual key の発行/制限/失効コマンドがなく、health は既定 skip、`--live` も無認証 GET だけ。 | version pin、実起動、profile別 virtual key、認証付き approved-alias completion、callback/本文非保存、revoke/cleanup を証跡付きで commissioning する。 | 既知（final judgment:28） | M | MED / HIGH |
| GAP-010 | docs | P1 | `docs/RUNBOOK.md:44-53`; `scripts/orchestrator/platform-health.mjs:13-25,87-101` | runbook の health command は `--live` を付けず `litellm_live: skip`。live でも Gateway/alias/upstream/callback を通らない。 | hop 別 bounded readiness と、再委譲可能条件・期待出力・evidence path を明記する。 | 既知（Phase 8 問題16） | M | MED / HIGH |
| GAP-011 | docs | P1 | `docs/SECRETS_MANAGEMENT.md:13-21`; `.env.example:1-23`; `policy/routing.prod.json:63-68`; `src/lib/sandboxOpenSandbox.ts:34-49` | inventory は Gateway が upstream provider keys を持つ旧構成で、LiteLLM/Gateway/OpenSandbox の process別 custody と `EAP_OPENSANDBOX_API_KEY` 等を網羅しない。 | Proxy master/upstream key、Gateway virtual key、OpenSandbox key を process/owner/rotation/revoke/permissions 別に分離する。 | 既知（Phase 8 問題9）、具体的 drift は新規 | S | LOW / HIGH |
| GAP-012 | docs | P1 | `docs/RUNBOOK.md:55-68`; `docs/OPERATIONS.md:67-75`; `scripts/validate-release.mjs:4-7` | snapshot を `artifacts/` に戻した直後に validation を実行し、復元した validation を削除、audit/ledger を混在・再生成し得る。checksum、immutable staging、restore drill がない。 | snapshot を別 root で checksum 検証し、新 run evidence と分離して restore drill を行う。agmsg/orchestrator state も対象化する。 | 新規 | M | MED / HIGH |
| GAP-013 | docs | P1 | `docs/SLO.md:7,22-50`; `docs/OPERATIONS.md:62-65` | 99%/p95 を宣言するが cost は TBD、production data 未収集、collector/dashboard/paging/evaluator/owner がない。 | SLI query、window、error budget、owner、alert evaluator を実装し、測定後に target を承認する。 | 既知 G5/G12 | L | MED / HIGH |
| GAP-014 | docs | P1 | `docs/DEPLOYMENT.md:7-14`; `scripts/validate-release.mjs:66-79`; `.github/workflows/validate-release.yml:23-27` | fresh checkout prerequisites に GNU `timeout` がなく、Python target は docs/mypy 3.13 に対し CI は3.11。 | darwin/Linux の exact prerequisites を示すか Node native timeout に統一し、support matrix を CI で検証する。 | 既知 G11 + 新規 version drift | S | LOW / HIGH |
| GAP-015 | docs | P2 | `.orchestration/analysis/gap_analysis_v1.md:7-25`; `.orchestration/analysis/phase8_consistency_audit.md:17-57`; `.orchestration/analysis/risk_register.md:13`; `.orchestration/acceptance/P8-T08.acceptance.md:7-13` | historical snapshot が旧現状/「要修正」を現在形で残し、後続監査が解消済み finding を再起票しやすい。 | as-of、status、resolved_by/superseded_by を追記し current register と snapshot を分離する。 | 新規 | S | LOW / HIGH |
| GAP-016 | 実装 | P0 | `src/workflows/remediate.ts:26,43-48`; `src/agents/remediator.ts:33-36`; `src/lib/productionGateway.ts:231-370` | remediation は常に local gateway を起動し agent model も `local-gateway/fixbot`。`callProductionGateway` の caller は contract/failure tests だけ。 | `PI_PROVIDER=prod` で Flue/Pi provider/session が Platform Gateway→LiteLLM を通り、failure を workflow state へ fail-closed 伝搬する。 | 既知（G1、Phase 8 問題8、final judgment:28） | L | HIGH / HIGH |
| GAP-017 | 実装 | P0 | `src/workflows/remediate.ts:55-73,151-197`; `src/lib/sandboxOpenSandbox.ts:21,54-90`; `src/lib/code.ts:94-118,213-287,319-343` | OpenSandbox handle ID を host path として scan/apply/rescan に渡す。remediation image は `local-workspace:validate-release@sha256:local`、remote verification は host absolute `.venv/bin/python` を使う。 | scan/patch/verify/rescan/collect 全工程を remote filesystem/exec contract 内で pinned image 上に完遂する。 | 既知（final judgment:29） | L | HIGH / HIGH |
| GAP-018 | 実装 | P0 | `scripts/data_guard.py:156-203`; `src/lib/dataProxy.ts:15-21`; `src/workflows/remediate.ts:204-213` | `customers`、3 rows、SQL、metric、PII narrative が全て固定。利用者 query/data source/tenant dataset を受けない。 | typed governed-query request、real datasource adapter、tenant/table/schema allowlist、query budget と audit を持つ production path を追加する。 | 既知 G7 | L | HIGH / HIGH |
| GAP-019 | 実装 | P1 | `src/lib/sandbox.ts:93-114,146-174,240-246` | runtime 既定は local。image/cpu/memory/network/env は audit に書くだけで、pytest は host env/network/権限を継承する。 | production profile は OpenSandbox 必須、local は explicit validation-only。production で local を選ぶと fail closed。 | 既知 G15/RR-6 | M | MED / HIGH |
| GAP-020 | 実装 | P1 | `src/lib/code.ts:35-58`; `src/workflows/remediate.ts:45` | user-supplied workspace を `stat`/`readFile` で再帰し symlink を追う。root confinement、file count/total bytes、VCS/venv除外がない。 | `lstat`+realpath containment、symlink policy、件数/byte/depth limit、既定除外を sandbox transfer 前に適用する。 | 新規 | M | MED / HIGH |
| GAP-021 | 実装 | P0 | `src/lib/code.ts:61-166,213-288`; `src/lib/types.ts:11-16`; `docs/PRODUCT_REQUIREMENTS.md:3-4` | scanner は3 regex、patcher は fixture 固有の完全一致関数名。payload `issue` は処理で使われず、別名/複数箇所では localized と patchability が一致しない。**P0 根拠**: code repair は製品の主目的であり、GAP-016/017 の接続・隔離を直しても実入力を修復する能力が存在しないため、これは品質低下ではなく運用不能。 | 対応範囲を明示して非対応入力を安全に拒否し、少なくとも supported repair classes は AST/location と issue scope に基づき一般入力で修復・検証できる状態にする。 | 既知 G13、severity は rev2 で P1→P0 | L | HIGH / HIGH |
| GAP-022 | 実装 | P1 | `src/lib/code.ts:115-164,169-196`; `src/lib/ledger.ts:33-45,61-107` | hypothesis/patch IDs が defect class 固定。実測で2 filesの同型 defectが同じIDを2件生成し、ID-based state update が両方へ作用する。 | run内で location を含む一意ID、per-hypothesis patch/verification association、duplicate rejection を実装する。 | 新規 | M | MED / HIGH |
| GAP-023 | 実装 | P1 | `src/lib/ledger.ts:93-136`; `src/workflows/remediate.ts:169-215,227-235`; `docs/EVIDENCE_GRAPH_SPEC.md:11` | pytest pass で全 hypotheses を verified にし、後続 rescan の remaining を ledger に反映しない。impactGraph/requiredChecks が空でも closure=true（実測）。 | verification、rescan、required checks、impact evidence を hypothesis ごとに閉鎖条件へ反映し、workflow status と ledger closure を一致させる。 | 新規 | M | MED / HIGH |
| GAP-024 | 実装 | P1 | `scripts/data_guard.py:49-62,188-203`; `src/lib/types.ts:81-89`; `src/workflows/remediate.ts:227-233` | Python は non-aggregate/star/non-allowlisted rejection flags を返すが TS type/status は旧3 flags だけ。 | 全 guard invariant を typed result と closure/E2E assertion に含める。 | 新規 | S | LOW / HIGH |
| GAP-025 | 実装 | P1 | `src/lib/productionGateway.ts:197-229,311-367` | provider exception を空 catch で捨て、成功時だけ audit/span を記録する。fallback/outage の attempt reason と latency が残らない。 | body/secret を除いた failure event と ERROR span を attempt ごとに記録し、最終 failure と task_id で相関する。 | 既知要件（Phase 8 問題17）、具体的未実装は新規 | M | LOW / HIGH |
| GAP-026 | 実装 | P1 | `src/lib/productionGateway.ts:110-117,149-163,300-367`; `src/lib/router.ts:54-64` | choicesなしを空 content 成功、非数 cost を許容。missing primary env は fallbackせず即return。default target は fallback先頭と重複し outage 時に同一 request を再試行する。 | response schema/finite cost を検証し malformed response を fallback 対象化。ordered attempts を重複除去し secret failure semantics を定義する。 | 新規 | S | LOW / HIGH |
| GAP-027 | 実装 | P1 | `src/lib/dataProxy.ts:15-49`; `src/lib/opa.ts:42-89` | metric/redaction/OPA child process に timeout がなく、redaction input/stdout/stderr は無制限、OPA temp dir を削除しない。 | bounded timeout/input/output、abort、sanitized fail-closed reason、`finally` cleanup を共通 child-process boundary に入れる。 | 新規 | S | LOW / HIGH |
| GAP-028 | 実装 | P1 | `src/workflows/remediate.ts:37-50,119-148,236-260`; `src/lib/audit.ts:5-14` | `run_start` は raw payload（issue含む）を固定 audit path に書く。policy block/exception は `run_end` なし。ledger は固定 path へ上書き。 | redacted metadata/digest、全終端経路の一度だけの run_end、run-scoped immutable artifacts、atomic write/rotation を実装する。 | 新規 | M | MED / HIGH |
| GAP-029 | 実装 | P1 | `src/app.ts:1-13`; `scripts/deploy-smoke.sh:35-53` | Flue routes に authn/authz middleware がなく、`/health` は依存を見ず常に `{ok:true}`。deploy smoke はその200だけを確認。 | supported bind/firewall、service authentication、liveness/readiness 分離、OPA/LiteLLM/OpenSandbox/evidence sink readiness を定義する。 | 新規 | M | HIGH / HIGH |
| GAP-030 | 実装 | P1 | `scripts/orchestrator/accept.mjs:30-63`; `docs/ORCHESTRATOR_INTERFACE.md:14-18` | accept は tier と validation prose だけを見て machine `status/outcome` を拒否条件にしない。failed/blocked result でも confirm/auto 条件次第で受理・lease release 可能。 | green outcome/status 以外を tier に関係なく拒否し、artifact completeness と acceptance record を機械確認する。 | 新規 | S | LOW / HIGH |
| GAP-031 | 実装 | P1 | `scripts/orchestrator/delegate.mjs:43-55`; `scripts/orchestrator/pretooluse-guard.mjs:129-139` | TASK send 後に lease を追記し、既存 overlap/expiry を検査しない。guard は `expires_at` を無視。 | atomic conflict-check/acquire→send、send failure rollback、expiry/renewal を authoritative store で処理する。 | 既知テーマ（Phase 8 問題12）、具体的欠陥は新規 | M | MED / HIGH |
| GAP-032 | 実装 | P1 | `scripts/orchestrator/pretooluse-guard.mjs:102-115,199-204`; `policy/cc_guard.rego:5-15` | controlled child は deny するが exact directory root `policy` / `artifacts/audit` は許可。実測 `rm -rf policy` input は `allow:true`。 | directory root と descendants を normalize 後に同型 deny し negative test を追加する。 | 新規（A-2 修正後の残存） | S | LOW / HIGH |
| GAP-033 | 実装 | P1 | `requirements.txt:1-14`; `scripts/setup-python.mjs:9-17` | Python top-level dependencies は大半が unpinned で、毎 validation が最新 compatible を install/upgrade。lock/hash がなく同一 revision の環境が再現不能。 | hash付き lock を正本にし、更新 bot/手順と SBOM/audit を同一 lock に束縛する。 | 既知 G11 の残存 | M | MED / HIGH |
| GAP-034 | 検証 | P1 | `scripts/validate-release.mjs:10-113,161-171`; `docs/PRODUCTION_GATES.md:7`; `artifacts/validation/final_verification_report.json:1-150`; `scripts/ops-check.mjs:48-55` | 現行 command は25 gates、docsは23、保存 report は2026-07-07の24 resultsで `litellm_config` なし。reportに revision/tree/gate digest がなく ops-check は `status=passed` だけを見る。 | canonical gate manifest、source revision/tree/dirty state、script/config digest を report に記録し current checkout と全一致を要求する。 | 新規 | M | LOW / HIGH |
| GAP-035 | 検証 | P1 | `scripts/validate-release.mjs:4-7,81-86`; `scripts/assert-e2e-artifacts.mjs:4-30`; `package.json:11` | release command は validation dirだけを消し、`flue:e2e` を実行せず既存 ledger/audit/telemetry の存在を assert する。 | 同一 run で E2E を実行し、run ID/timestamp/source revision で artifacts を束縛してから assert する。 | 新規 | M | LOW / HIGH |
| GAP-036 | 検証 | P1 | `.github/workflows/validate-release.yml:52-121`; `tests/integration/opensandbox.test.ts:20-157`; `tests/e2e/remediate_e2e.test.ts:4-19` | CI OpenSandbox job は executor contract だけ。remediation E2E は default local。 | pinned OpenSandbox server/image 上で full remediation workflow を1件実行し policy、scan/patch/verify/rescan、audit、cleanup を assert する。 | 既知（final judgment:29） | M | MED / HIGH |
| GAP-037 | 検証 | P1 | `tests/contract/llm_contract.test.ts:21-44,271-305`; `docs/VALIDATION_PLAN.md:23`; `.orchestration/analysis/final_release_judgment.md:28` | `PI_PROVIDER=prod` test も localhost mock server。実 Proxy、virtual key、Anthropic、callback の end-to-end evidence がない。 | protected/manual readiness gate で redacted fixture 1件と outage 1件を実経路で証跡化する。通常 PR の deterministic mock gate は維持する。 | 既知 | L | HIGH / HIGH |
| GAP-038 | 検証 | P1 | `scripts/spec-check.mjs:3-47`; `docs/requirements.json:1-12` | spec gate は Markdown 6行、legacy link、file存在だけ。薄い stub と production requirement 欠落が `passed` になる（実測 passed）。 | full ID set、unique/bidirectional links、gate name/evidence、schema/required sections を検査する。 | 新規 | M | MED / HIGH |
| GAP-039 | 検証 | P1 | `src/workflows/remediate.ts:101-149`; `tests/e2e/remediate_e2e.test.ts:4-19`; `docs/traceability.json:5` | E2E は engineer/acme success だけ。OPA deny を workflow が尊重し source不変、verify/data未実行になる結合テストがない。 | guest/cross-tenant/high-risk の negative workflow E2E を1件追加し `needs_review` と no-side-effect を assert する。 | 新規 | S | LOW / HIGH |
| GAP-040 | 検証 | P2 | `package.json:16-21`; `scripts/validate-release.mjs:53-69`; `src/lib/sandbox.ts:249-259` | Python のみ coverage>=85。TypeScript critical path の branch coverage baseline がない。 | productionGateway/router/sandbox/workflow/orchestrator の trust-boundary branch baseline と negative cases を置く。 | 新規 | M | MED / HIGH |
| GAP-041 | 検証 | P2 | `tests/component/code.test.ts:72-76`; `src/lib/code.ts:291-315` | “unpatched verifier failure” test は prepared workspace の返値を捨て、空 tmp dir で pytest failure を確認するだけ。 | 実際の unpatched fixture を verify し、expected failing test/output を assert する。 | 新規 | S | LOW / HIGH |
| GAP-042 | 検証 | P2 | `.github/workflows/validate-release.yml:23-27`; `pyproject.toml:9-13`; `docs/DEPLOYMENT.md:9-10` | CI Python 3.11、documented/mypy target 3.13。 | primary CI を3.13に揃えるか3.11/3.13 matrixとsupport policyを定義する。 | 新規 | S | LOW / HIGH |
| GAP-043 | 検証 | P2 | `docs/VALIDATION_PLAN.md:41-50`; `package.json:11-12`; `tests/component/code.test.ts:49-64` | held-out は direct component test のみ。full `flue:e2e:heldout` は release gate 外で手動。 | scheduled/pre-release で full held-out pipeline を実行し release/promotion evidence にリンクする。 | 既知 G13 | S | LOW / HIGH |
| GAP-044 | 検証 | P1 | `.orchestration/autoskill/runs/p2t07b-acceptance4.autoskill.md:1-11`; `.orchestration/acceptance/P2-T07b.acceptance.md:14-17`; `.orchestration/analysis/final_release_judgment.md:29` | primary run record は create=0/候補1 path、acceptance は182 calls/create×5。P2-T07b自体は accepted だが一次証跡が narrative を裏付けず、2周目もない。 | immutable run manifest に candidates/count/digests/manual correction provenance を残し、新 accepted tasks で2周目を実行する。 | 既知残件 + evidence矛盾は新規 | M | MED / HIGH |
| GAP-045 | 検証 | P2 | `.orchestration/skills/candidates/p2t07b.triage.md:23-29`; `.orchestration/skills/merged/.gitkeep`; `.orchestration/analysis/final_release_judgment.md:29` | `merge_required` 3件が candidates の中間状態に残り、P6予定を過ぎても terminal provenance がない。 | merge task、統合先、validation、元候補の merged terminal record/anti-resubmission を作る。 | 既知 | M | LOW / HIGH |
| GAP-046 | 検証 | P2 | `package.json:52-55`; `.orchestration/analysis/risk_register.md:10` | OPA binary wrapper は4 platformとも `0.3.1-beta.0`、同梱 OPA 0.70 系の更新期限/安定版判断が未完。 | stable candidate を4 platform + Rego compatibility gates で検証し、採否・期限を閉じる。 | 既知 RR-3 | M | MED / HIGH |
| GAP-047 | 実装 | P1 | `scripts/data_guard.py:121-144`; `src/lib/productionGateway.ts:241-246`; `docs/INTEGRATION_BOUNDARY.md:49-54` | outbound redaction の PERSON は literal `Alice Tanaka` だけ、phone は US のみ。実在する他人名・locale の電話が confidential/restricted prompt に含まれても外部 dispatch 前に残り得る。GAP-018 の固定 metric とは別の送信境界欠陥。 | supported locale/person entity の production recognizer と adversarial corpus を用意し、未知/低確度の confidential/restricted data は外部送信を fail closed にする。 | 既知 G7 の具体的残存（R1） | M | MED / HIGH |
| GAP-048 | 実装 | P1 | `scripts/orchestrator/pretooluse-guard.mjs:19-23,143-170`; `docs/INTEGRATION_BOUNDARY.md:16-25` | OPA eval の任意例外を `null` にし、`?? builtinDenyReasons` で silent heuristic fallback。OPA binary 欠落の無害入力が実測 `allow:true` となり、policy unavailable を fail closed にしない。 | OPA unavailable/malformed/no-decision は明示 deny。builtin は defense-in-depth または deterministic parity check に限定し、降格を audit/alert する。 | 新規（R2） | S | LOW / HIGH |
| GAP-049 | 実装 | P1 | `src/lib/sandboxOpenSandbox.ts:216-227`; `docs/INTEGRATION_BOUNDARY.md:49-56` | `EAP_SANDBOX_TENANT` 未設定時に `acme` を silent default として sandbox policy を評価し、実 request tenant と結合しない。 | tenant を validated remediation request から必須伝搬し、missing/mismatch は sandbox create 前に fail closed にする。 | 新規（R3） | S | LOW / HIGH |
| GAP-050 | 実装 | P1 | `src/lib/productionGateway.ts:256-298`; `docs/INTEGRATION_BOUNDARY.md:116-121` | local/deterministic target は placeholder `deterministic-fallback` を `ok:true` で返し、成功 span/audit を記録する。呼出側の success type は実モデル応答と区別できない。 | production policy では deterministic target を拒否し、validation mode でも result に explicit mode/synthetic status を必須化して release/usage evidence から除外する。 | 既知 Phase 8 問題8/16 の具体的未解消（R4） | S | MED / HIGH |
| GAP-051 | 実装 | P1 | `src/lib/audit.ts:1-15`; `docs/PRODUCT_REQUIREMENTS.md:19-20` | “append-only” JSONL は単純 `appendFile` だけで hash chain/署名/sequence/fsync/locking がなく、削除・改変・truncate を検知できない。並行 writer の ordering/line integrity も未定義。 | per-run sequence+previous hash、durable atomic writer、rotation/retention、integrity verifier を実装し、外部 WORM/署名は deployment risk に応じて追加する。 | 新規（R5、GAP-028 を補完） | M | MED / HIGH |
| GAP-052 | 検証 | P1 | `tests/integration/opensandbox.test.ts:138-156`; `.github/workflows/validate-release.yml:105-109` | egress deny は `https://example.com` の `exitCode != 0` だけ。DNS/certificate/remote outage でも green になり、network policy による拒否を識別しない。 | CI 内の到達可能な controlled endpoint を用意し、allow profile では成功、deny profile では policy-specific failure/no connection を対で assert する。 | 新規（R6） | S | LOW / HIGH |
| GAP-053 | docs | P1 | `docs/DEPLOYMENT.md`; `docs/OPERATIONS.md`; `docs/RUNBOOK.md`; `docs/SECRETS_MANAGEMENT.md`; `docs/PRODUCTION_GATEWAY_DESIGN.md:54`; `docs/SANDBOX_INTEGRATION_DESIGN.md:42` | 運用4文書に `PI_PROVIDER=prod` / `EAP_SANDBOX_RUNTIME=opensandbox` がなく（grep 0件）、design docs にだけ存在する。運用者は production behavior を有効化できない。 | production profile の全 env、起動順、preflight、期待出力、停止/rollback を operator docs に集約し design docs から参照する。 | 新規（R7、GAP-008/009 の具体的 activation gap） | S | LOW / HIGH |
| GAP-054 | docs | P2 | `docs/SLO.md:15,28,42`; `docs/FAILURE_MODE_MATRIX.md:3-17`; `docs/NON_FUNCTIONAL_REQUIREMENTS.md:3-20`; `docs/DEPLOYMENT.md:13`; `docs/RUNBOOK.md:46` | (a) latency field 表記が `attributes.gateway.latency_ms` と `gateway.latency_ms` で不一致、(b) sandbox/redaction/telemetry/ledger corruption failure rows がなく2 LLM failure rowsは同じ mock test、(c) NFR に性能/可用性/RTO/RPO がなく全件machine trace外、(d) bundled Node必須と bare `node` が矛盾。 | telemetry schema と query を一意化し、failure rows を独立 scenario/test に結合、measurable NFR+RTO/RPOをtraceし、実行コマンドを bundled toolchain に統一する。 | 新規（R8） | M | LOW / HIGH |

## 必須未了事項の再確認

| 項目 | 現在の判定 | 主証跡 |
| --- | --- | --- |
| LiteLLM Proxy 実起動 | **未了**。config/callback static check のみ。 | `docs/LITELLM_PROXY.md:13`; `scripts/check-litellm-config.mjs:1-116` |
| 仮想キー実発行 | **未了**。要件記述のみで発行・制限・失効 evidence なし。 | `docs/LITELLM_PROXY.md:27-29` |
| ライブ LLM smoke | **未了**。release/contract tests は mock。 | `docs/PRODUCTION_GATES.md:61`; `tests/contract/llm_contract.test.ts:271-305` |
| AutoSkill 2周目 | **未了**。1 dry-run + triage のみ。 | `.orchestration/analysis/final_release_judgment.md:29` |
| OpenSandbox remediation 本番接続 | **未了かつ現コードでは不成立**。executor CIのみ。 | `src/workflows/remediate.ts:72,157,186`; `tests/integration/opensandbox.test.ts:20` |
| skill merge 3件 | **未了**。`merge_required` のまま。 | `.orchestration/skills/candidates/p2t07b.triage.md:26-28` |
| P2-T07b | **task は accepted 済み**。ただし primary run record と acceptance の count が矛盾し、upstream LICENSE/shim、2周目が残る。 | `.orchestration/acceptance/P2-T07b.acceptance.md:4,14-17`; `.orchestration/autoskill/runs/p2t07b-acceptance4.autoskill.md:9-11`; `risk_register.md:8` |

## 製品到達までの推奨タスク分割案

1. **Phase A — release claim を fail closed にする**
   - A1: `GAP-034/035` gate manifest、source binding、同一run E2E artifact。
   - A2: `GAP-002/006/038/054` requirement/NFR catalog、release 判定式、telemetry/failure schema の一意化。
   - 依存: 以後の全 acceptance evidence は A1/A2 後に再生成する。
2. **Phase B — 最小 production profile を一つだけ成立させる**
   - B1: `GAP-008/009/010/011/014/053` single-host topology、production switches、LiteLLM commissioning、secret custody、health。
   - B2: `GAP-016/025/026/027/037/047/050` Flue→Gateway→LiteLLM 実接続、redaction、synthetic fallback 分離、failure audit、live smoke。
   - 依存: B1 → B2。実キー使用は operator-controlled environment のみ。
3. **Phase C — remediation isolation を完成する**
   - C1: `GAP-017/019/020/049` executor内 scan/patch/rescan、tenant必須伝搬、production local禁止、workspace confinement。
   - C2: `GAP-036/052` OpenSandbox full workflow CI と反証可能な egress test。
   - 依存: C1 → C2。B と並行可能だが production acceptance は B+C の両方必須。
4. **Phase D — core correctness を閉じる**
   - D1 (**P0 product capability**): `GAP-021/022/023/024` supported repair scope、一般入力の修復能力、unique IDs、per-hypothesis closure、全 data guard flags。
   - D2: `GAP-039/040/041/043` negative E2E、critical coverage、held-out full pipeline。
   - 依存: D1 → D2。D1 は B/C と並行して進め、B/C/D1 の全完了を production smoke 前提とする。
5. **Phase E — governed data product path**
   - E1: `GAP-018` typed datasource/query contract と tenant authorization。
   - E2: 実データなしの synthetic integration → controlled staging data acceptance。
   - 依存: A2 の requirements、B1 の secrets、C の sandbox policy を先行。
6. **Phase F — operator safety と persistence**
   - F1: `GAP-007/012/013/028/029/051` run-scoped tamper-evident audit、backup/restore drill、readiness/auth、SLO evaluator。
   - F2: `GAP-030/031/032/048` acceptance/lease/hook/OPA-unavailable fail-closed hardening。
   - 依存: A1 の evidence identity を先行。
7. **Phase G — governance debt closeout**
   - G1: `GAP-001/003/004/005/015` normative specs、threat catalog、historical status。
   - G2: `GAP-033/042/046` reproducible Python lock/runtime matrix/OPA update decision。
   - G3: `GAP-044/045` P2-T07b evidence repair、AutoSkill 2周目、skill merge terminal states。

## 監査範囲外

- live provider key、production/customer data、image build、Docker/OpenSandbox server 起動は task constraints により実行していない。
- GitHub branch protection、最新 remote CI run、external secret manager、paging backend は repository-local evidence がないため存在を推定していない。
- dependency audit は current local lock/venv に対して実行し 0 findings だったが、将来 advisory と upstream operational status は本監査で保証しない。
