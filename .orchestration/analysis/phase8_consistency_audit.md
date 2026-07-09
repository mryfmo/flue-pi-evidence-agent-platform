# Phase 8 整合性監査(仕様 ↔ 実装 ↔ 検証 ↔ 実行結果)

- Auditor: orchestrator-fable5, 2026-07-09
- 対象: P8-T01〜T07 全成果物(commits 91728d1..ab432b4)
- 方法: レビュー文書(litellm_claude_code_integration_review.md)・各タスク仕様・INTEGRATION_BOUNDARY.md を仕様正本とし、実装コード・テストコード・検証ログ/実測実行の 4 面を突合。

## 整合を確認した項目(異常なし)

- **モデル ID 実在性**: config/litellm/config.yaml の `claude-haiku-4-5-20251001` / `claude-sonnet-4-6` / `claude-opus-4-8` は 3 つとも実在の Anthropic モデル ID(モデルカタログで確認)。
- **config.yaml 不変条件**: anthropic/ のみ・fallback リスト内・num_retries=2・turn_off_message_logging・キー 2 種のみ — check-litellm-config.mjs の 5 検査と一致し、負のテスト証跡あり。
- **cc_guard.rego ↔ pretooluse-guard.mjs 組み込み deny**: 判定条件(controlled_path 3 種/リース重なり/release ブランチ git 操作)は完全に同型。OPA 不在時 fail-closed も確認。
- **accept.mjs**: tier 未指定 →review、review→ 拒否、confirm→--user-confirmed 必須、auto→validation 証跡機械確認("failed" 混入で拒否=安全側)。リース解放・events.jsonl 記録あり。
- **P8-T03 契約テスト**: metadata 伝搬・llm_unavailable・deterministic-fallback 非混入・成功監査イベント不記録・restricted deny(OPA `restricted_external_provider`)・redaction/OPA/設定欠落の fail-closed を全てアサート。手元再実行 green。
- **文書整合**: FAILURE_MODE_MATRIX 4 行・RUNBOOK llm_unavailable 手順・PRD Reference Implementation・SLO コスト KPI・OPERATIONS 監査手順・モデル階層規約は実装パス/挙動と一致。`npm run audit:trace -- <id> -- --json` は実装の arg 解釈上正しく機能する(実測済み)。
- **audit-trace.mjs**: 実在 task_id で delegation〜acceptance 一括表示、missing 明示、ゼロ件 exit 1、本文ダイジェスト化を実測確認。

## 不整合(要修正、P8-T08 で対処)

### A-1 [HIGH] platform-health の agmsg 疎通チェックが偽陽性(問題 16 違反)

- 仕様: 委譲前に経路疎通を確認できること(偽の ok を作らない)。
- 実装: `platform-health.mjs` の既定 DB パスが `~/.agents/skills/agmsg/db/agmsg.sqlite`。実 DB は `messages.db`(agmsg storage.sh の agmsg_db_path で確認)。`sqlite3 <不存在パス> "SELECT 1"` は**空ファイルを新規作成して成功**するため、チェックは常に ok になる。実際に 0 バイトの agmsg.sqlite が生成されていた。
- テストも `orchestrator_fail_closed.test.ts:105` で同じ誤パスを「正常系」として固定しており、偽陽性を検証で追認している。
- 修正: 既定パスを `messages.db` に。ファイル実在+`messages` テーブル存在(例: `SELECT count(*) FROM messages`)まで確認し、不存在/空は fail。テスト更新。

### A-2 [HIGH] PreToolUse ガードの Bash パス抽出漏れ(問題 3/12 の部分未達)

- 仕様(P8-T04 §2.5): Edit/Write/**Bash** の対象パスについて統制パスとリース中パスを deny。
- 実装: `extractCommandPaths` は `policy/`・`artifacts/audit/`・`.env` で**始まる**トークンのみ抽出。ゆえに (a) Bash コマンド中の**リース対象パス**(例 `sed -i src/lib/x.ts`)は一切検査されない、(b) 統制パスの**絶対パス表記**(`/…/repo/policy/routing.json`)は抽出前に落ちて素通りする。
- 修正: パス様トークンを全て抽出 →normalizePath→deny 判定(rego/組み込み)に委ねる方式へ。テスト追加: Bash+リース中パス deny、Bash+絶対パス統制パス deny、無害コマンド allow。

### A-3 [MED] LiteLLM の 127.0.0.1 bind が実行手順で担保されない(問題 1/§3.1)

- 仕様: Proxy は 127.0.0.1 bind のみ。
- 実装: config.yaml の `server_settings.host` は **LiteLLM が解釈しない独自キー**(LiteLLM の bind は CLI `--host/--port`)。docs/LITELLM_PROXY.md の起動例 `uvx litellm --config …` にはホスト指定がなく、既定 bind(0.0.0.0)で起動し得る。検査ゲートは「宣言」を検査しているが実行実体を拘束しない。
- 修正: LITELLM_PROXY.md の起動例を `uvx litellm --host 127.0.0.1 --port 4000 --config config/litellm/config.yaml` に修正し、`server_settings` は「リポジトリ検査用の宣言であり、実 bind は CLI フラグで指定する」旨を config.yaml コメントと docs に明記。

### A-4 [MED] 未実装 callback を含む config は起動不能である旨の明示欠落(問題 2 の運用面)

- `success_callback: ["platform_audit_forwarder"]` は未実装の予約名で、このまま起動すると LiteLLM は callback 解決に失敗する。docs は「reserved」としか書いておらず、起動前提条件が不明。
- 修正: LITELLM_PROXY.md に「本番起動には platform_audit_forwarder の実装(カスタム callback モジュール)が前提。実装までは起動不可であり、検証目的の一時起動でも callbacks を外した構成を別途作らず、実装を先行させる(ログ既定有効の素の起動を禁止)」を明記。

### A-5 [MED] confidential の承認要件が未実装(問題 11 のデータ分類マトリクス乖離)

- 仕様(INTEGRATION_BOUNDARY マトリクス): confidential は「redaction+人間確認後に送信可、承認必須」。
- 実装: routing.prod.json は confidential→worker-heavy を無条件許可。routing.rego の `requires_approval` は default false のデッドコードで、承認の強制点が存在しない。
- 修正: routing.rego に「confidential× 外部プロバイダは `input.decision.approval_ref` が無ければ deny(`confidential_requires_approval`)」を追加。`ProductionGatewayRequest` に optional `approval_ref` を追加し authorizeRoute へ伝搬(注意: RoutingInput へ追加すると selectRoute の全キー一致マッチが壊れるため request 側に置く)。テスト: approval_ref なし deny/あり allow。デッドコードの requires_approval は本ルールに置換。

### A-6 [LOW] status.mjs が拡張フィールド `outcome` を無視

- ORCHESTRATOR_INTERFACE.md は `outcome=passed|failed|blocked|open` を定義するが、status.mjs の表示キーに outcome がなく、不整合警告も fields.status のみ検査。
- 修正: outcome を表示リストへ追加し、mismatch 判定を `status+outcome` に拡張。テスト 1 件。

### A-7 [LOW] delegate.mjs の AGMSG-TASK に max_turns が無い

- agmsg オーケストレーション契約(Message Contract v1)は max_turns を含む。delegate.mjs 生成メッセージには無い。
- 修正: `--max-turns`(default 3)を追加してメッセージへ含め、ORCHESTRATOR_INTERFACE.md の Delegate 行を更新。テスト更新。

## 判断メモ

- accept.mjs の auto 判定が検証ログ中の任意の "failed" 文字列で拒否になる点は偽陰性側(安全)であり仕様の fail-closed 原則に合致するため修正しない。
- routing.prod.json の confidential→worker-heavy 割当はモデル階層規約と矛盾しない(A-5 の承認ゲートが入れば整合)。
- `~/.agents/skills/agmsg/db/agmsg.sqlite`(0 バイト)は A-1 の副産物。リポジトリ外のため P8-T08 では触らない。
