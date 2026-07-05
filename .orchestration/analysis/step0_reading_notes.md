# Step 0 読了メモ — 既存プロトタイプ文書

- 作成: orchestrator-fable5 (Claude Code / Fable 5 / high), 2026-07-05
- 目的: 既存要件・ゲート・設計判断の再発明防止。以後の全タスク設計はこのメモの「再発明禁止」項を前提とする。
- 対象: 指示書 §4 Step 0 の全ファイル + SPECIFICATION.md / TRACEABILITY.md(読了済み。ZIP には AGENT 用 docs はこの 24 ファイル構成)

## 1. 要件 ID 体系(3 系統が併存)

| 体系             | 所在                                                 | 範囲                                                                                                                          |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| PR-001〜PR-008   | docs/PRODUCT_REQUIREMENTS.md, docs/requirements.json | 製品成果(evidence-gated remediation, OPA 認可, データガバナンス, リリースゲート)                                              |
| FR-001〜FR-012   | docs/FUNCTIONAL_REQUIREMENTS.md                      | 実装単位。各行に Implementation / Validation の対応表あり                                                                     |
| NFR-001〜NFR-011 | docs/NON_FUNCTIONAL_REQUIREMENTS.md                  | 信頼性(001-003)/セキュリティ(004-006)/運用性(007-009)/保守性(010-011)                                                         |
| REQ-\*-001       | docs/SPECIFICATION.md, docs/TRACEABILITY.md          | 上記と重複する第 4 の ID 系(REQ-FLUE/PI/OPA/EVIDENCE/PATCH/DATA/OBS/VALIDATION/RELEASE)。本番要件 ID を新設する際は統合が必要 |

## 2. 検証ゲート(再発明禁止)

- `npm run validate-release`(scripts/validate-release.mjs)が唯一のリリース判定コマンド。16 ゲート、fail-fast、artifacts/validation/ に per-gate ログ + final_verification_report.json/.md。
- 16 ゲート: setup_python, spec_traceability, format, lint, typecheck, opa, python_compile, python_ruff, python_mypy, python_bandit, python_tests(cov≥85), vitest_all, flue_build, e2e_artifacts, npm_audit_prod, npm_sbom_prod。
- 現行レポート: status=passed, 16/16, bundled Node v22.19.0, 2026-06-29 生成。
- テスト taxonomy: unit / component / system / e2e / failure / security / regression(tests/ 配下 9 ファイル + tests_py/test_data_guard.py)。

## 3. アーキテクチャ上の確定判断(再発明禁止)

1. **LLM は要約のみ**: Agent loop は自由ループではなくゲート付きシーケンス(AGENT_LOOP_SPEC)。side effect は typed workflow tools + OPA 認可のみ。この境界は本番化でも維持する。
2. **OPA が side effect の唯一の認可者**(POLICY_MODEL)。fail-closed(allow=false, requires_approval=true)は src/lib/opa.ts 実装済み・テスト済み。
3. **データ経路は aggregate-only**: SQLGlot(単一 SELECT のみ)→ DuckDB(in-memory)→ Presidio(regex ベース、モデル DL なし)。返却値に unsafe class 拒否の boolean 証跡を含む。
4. **closure gate**: hypotheses 全 verified + evidence 4 種(source/policy/verification/data)+ patch 候補数 ≥ hypothesis 数 が揃うまで run は閉じない(HYPOTHESIS_LEDGER_SPEC)。
5. **決定論ゲートウェイ**(src/lib/localGateway.ts, OpenAI 互換, 固定応答)は「再現可能な検証」のための意図的設計。DEPLOYMENT.md が「本番モデルルーティングは同じ typed boundary の背後で置換可能」と明記 → G1/G9 の起点。

## 4. 明示的スコープ外宣言(ギャップ分析の出発点)

- PRODUCT_REQUIREMENTS.md: "It does not claim Kubernetes, external OpenMetadata, external Trino, external LiteLLM, or production secret-manager deployment. Those are extension targets behind the same typed tool contracts."
- README.md: "This is not a Docker/Kubernetes deployment. It is a single-host Flue + Pi integrated release..."
- DEPLOYMENT.md: "It does not require Docker or Kubernetes."
- SECURITY_MODEL.md 残余リスク: 本番 LLM ゲートウェイは audit ID / redaction hook / policy boundary を維持すること、新規 side-effect ツールは Rego + typed contract + テスト + traceability 必須、外部モデル接続は threat-model + data-classification レビュー必須。
- OPERATIONS.md 拡張プロトコル: 新ツール/新ポリシー入力/新データ経路/新プロバイダは 6 手順(要件 → 文書 →Rego→ テスト →traceability→validate-release)。

## 5. 実測で確認した事実(文書との差分)

| #   | 事実                                                                                                                                                                                                                                              | 影響                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | README「buggy_calc の divide-by-zero」は旧記述。実際の flue:e2e は buggy_multi(2 欠陥、RUNBOOK には buggy_multi が意図と明記)                                                                                                                     | ドキュメント整合タスク(軽微)。G13 に記録                                           |
| 2   | docs/TRACEABILITY.md のテストパス(tests/opa.test.ts 等)が実パス(tests/component/opa.test.ts)と不一致                                                                                                                                              | 同上                                                                               |
| 3   | OPA npm 依存 `agent-control-specification-opa-linux-x64@0.3.1-beta.0` は os=linux/cpu=x64 宣言のため、darwin/arm64 では `npm ci` 自体が EBADPLATFORM で失敗(2026-07-05 実測、node_modules 0 件)。`npm ci --force` + `EAP_OPA_BINARY` 上書きが必要 | **リリースゲートが linux-x64 でしか再現しない**。G11/G15/G4(CI 環境定義)の主要入力 |
| 4   | policy/agent.rego は tenant を "acme" にハードコード                                                                                                                                                                                              | G6(マルチテナント)の主要入力                                                       |
| 5   | validate-release の vitest_all は GNU `timeout` を前提(macOS 標準に無し。coreutils 必要)                                                                                                                                                          | ゲート再現性、G4/G11                                                               |
| 6   | ホスト git が /usr/local/bin/git 2.31.1(PATH 先頭)で ssh 署名 config を解釈できない。/opt/homebrew/bin/git 2.55 を使用する                                                                                                                        | 開発環境ノート(タスクファイルに記載済み)                                           |

## 6. 後続フェーズが再利用すべき既存資産

- 監査: src/lib/audit.ts(append-only JSONL)。トレース: src/lib/telemetry.ts(OTel JSONL exporter)→ G5 は「集約・アラート」の追加であり形式の再発明はしない。
- SBOM: npm_sbom_prod ゲート(CycloneDX)実装済み → G11 は Python/コンテナ/OPA バイナリ/agmsg への拡張。
- スモーク: src/workflows/smoke.ts(ack:<text>)は本番ゲートウェイ疎通確認の雛形に転用可能。
- spec-check.mjs(spec_traceability ゲート)は本番要件 ID 追加時の traceability 自動検証に拡張可能。
