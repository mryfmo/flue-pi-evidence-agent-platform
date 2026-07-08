# Claude Code × Flue+Pi Evidence Agent Platform × LiteLLM 統合設計 — 問題箇所の全抽出と改善案

- 提供: ユーザー(2026-07-08)。Phase 8 の正本仕様。
- 対象: Flue + Pi Evidence Agent Platform PRD v1.0
- 目的: Claude Code をユーザーインタフェース兼オーケストレータとし、Flue+Pi 基盤を LiteLLM 経由で Anthropic モデル接続する構成の問題抽出と改善設計
- 前提: agmsg 制約(transport-only / MCP 不使用 / SQLite WAL / monitor・turn モード)を踏襲

## 0. 結論(全体像)

推奨レイヤリング: **LiteLLM は「Pi provider path の本番実装」として基盤ゲートウェイの内側に置く。外側には置かない。**

```
ユーザー
  ↓ (対話)
Claude Code(オーケストレータ / 受入UI / 探索的開発)
  ↓ AGMSG-TASK / ↑ AGMSG-RESULT   ※agmsg (SQLite WAL, transport-only)
Flue Runtime(統制ワークフロー実行)
  ↓
Platform LLM Gateway(redaction / 監査 / fail-closed / データ分類判定)★統制の主体
  ↓
LiteLLM Proxy(モデルルーティング / fallback / コスト計測 / 仮想キー)★プロバイダアダプタに限定
  ↓
Anthropic API(claude-haiku-4-5 / claude-sonnet-4-6 / claude-opus-4-8)
```

判定基準:「証拠台帳・ポリシーゲート・PII 保護・監査追跡のいずれかが必要なタスクは基盤へ、それ以外は Claude Code が直接実行」

## 1. すみ分け設計(タスク・ルーティングマトリクス)

| タスク種別                                   | 実行主体                        | 理由                                                           |
| -------------------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| 探索的コーディング、対話的デバッグ、設計相談 | Claude Code                     | 統制不要。往復速度が価値。証跡要件なし                         |
| リポジトリ横断の読解・リファクタ提案         | Claude Code                     | 大コンテキスト推論は Claude Code(Fable-5)が得意                |
| 証拠付き修復ワークフロー(UC-001)             | 基盤                            | 仮説台帳・テスト・再スキャン・OPA 判定必須(FR-REM-\*)          |
| 統制データ分析(UC-002)                       | 基盤                            | Data Guard(集計限定 SQL / PII 遮断)は Claude Code に存在しない |
| リリースゲート判定(UC-003)                   | 基盤                            | validate-release 相当の機械判定+不整合検出(FR-REL-001, R-006)  |
| AutoSkill / SkillOpt(UC-004)                 | 基盤                            | redaction 済み履歴のみが入力(NFR-PRI-003)                      |
| 監査レポート生成                             | 基盤が生成 → Claude Code が表示 | 判定は基盤、レンダリングのみ Claude Code(問題 6)               |
| 受入判断の HITL 提示                         | Claude Code                     | 人間との対話面は Claude Code が唯一の窓口                      |
| 高リスク操作の承認                           | 人間(Claude Code 経由で提示)    | NG-006。Claude Code が自動受入してはならない                   |

判定フローの実装: Claude Code 側にルーティング用スキル(例: `governed-task-router`)を置き、「PII/生データ/本番環境/リリース判定/スキル昇格に触れるか」を委譲前チェックリストとして機械的に判定。曖昧な場合は基盤側(fail closed)へ倒す。

## 2. 問題箇所の全抽出と改善案

### 問題 1: LLM ゲートウェイの二重化(最重要)

PRD 独自の LLM Gateway(FR-LLM-001〜007)と LiteLLM の機能が二重化し、redaction を通らない第二経路が生まれると FR-LLM-001/NFR-SEC-003 が崩壊する。
改善: LiteLLM を基盤 Gateway の下流のみに配置。エージェント →LiteLLM 直接到達をネットワーク層で遮断(localhost bind + 基盤 Gateway のみ許可)。責務分割の明文化: redaction・分類判定・fail-closed・監査一次記録=基盤 Gateway/モデル名解決・fallback・レート制御・コスト集計=LiteLLM。同一機能を両方で有効化しない。FR-LLM-007 の実装=「基盤 Gateway+LiteLLM Proxy」の複合体として PRD§21 を更新。

### 問題 2: LiteLLM のログに redaction 前データが残る

改善: `turn_off_message_logging: true` 必須化。コールバックはメタデータ(model, tokens, cost, latency, task_id)のみ基盤の LLM Gateway Event へ転送。Proxy DB 使用時はメッセージ本文が入らないことをリリースゲート検査項目に追加。「LiteLLM ログに生プロンプトが存在しないこと」を MVP-SC-004 受入テストに含める。

### 問題 3: Claude Code 自身が統制層をバイパスする

改善: 2 ゾーンモデル明示採用。(a)対話開発ゾーン=Claude Code ネイティブ実行、統制外を許容。(b)統制ゾーン=基盤経由必須。強制は PreToolUse フック(Edit/Bash 前に OPA 判定、統制対象パスを deny、exit code 2 でブロック)。統制対象リソース(本番 DB 資格情報、リリースブランチ、PII パス)は実行環境から見えない権限分離を優先、フックは第二防衛線。

### 問題 4: すみ分け判定基準が未定義のまま運用が始まる

改善: ルーティングマトリクスをプロジェクト CLAUDE.md に固定記載、禁止列挙型(「以下に触れるタスクは必ず/delegate」)。迷うケースは fail closed(基盤へ委譲)。委譲漏れ検出: 監査ログと Claude Code セッションログ突合の週次レビュー(運用ルール§19.2)。

### 問題 5: 対話ターン制と長時間バッチの実行モデル不整合

改善: 非同期委譲を標準化。`/delegate`(AGMSG-TASK 発行、task_id 即時返却)、`/status <task_id>`(turn モードでポーリング)、`/accept <task_id>`(受入記録作成)。短文+ファイル参照、明示的 stop signal、monitor モード非常駐。タスク状態は基盤側 SQLite が唯一の真実、task_id で復元可能。

### 問題 6: Claude Code による結果要約が「自己申告完了」を復活させる

改善: AGMSG-RESULT に機械可読 status(passed/failed/blocked/open)必須化、Claude Code は改変・再解釈せず原文表示(CLAUDE.md+スキル定義に明記)。/status は決定論的スクリプトが status・ゲート一覧・失敗理由を整形表示、自由記述は「次アクション提案」欄のみ。status=failed なのに本文に成功系表現がある場合の警告付与。

### 問題 7: LiteLLM の fallback が承認外モデル・プロバイダへ流れる

改善: model_list を承認済み Anthropic モデルのみに固定、fallback チェーンも同一リスト内、他プロバイダの API キーを Proxy に登録しない。全承認モデル不達時は基盤 Gateway へエラー返却し fail closed(タスク open 停止、FR-POL-004)。num_retries 上限。ルーティング決定(モデル+理由+fallback 有無)をコールバックで LLM Gateway Event に記録。

### 問題 8: 決定論的ローカルゲートウェイ(FR-LLM-006)との整合

改善: `PI_PROVIDER=local`(決定論スタブ)/`PI_PROVIDER=prod`(基盤 Gateway→LiteLLM)の二系統分離。CI・SkillOpt 検証・回帰テストは local 固定。LiteLLM の mock_response はスモーク専用、決定論テストには基盤 Gateway 手前のスタブ(既存設計)を維持。

### 問題 9: 認証・API キー管理の二重経路

改善: Anthropic API キーは LiteLLM Proxy のみ保持。エージェント・Flue・基盤 Gateway には LiteLLM 仮想キーのみ配布。仮想キーを Agent Profile(FR-AGENT-004)単位で発行し許可モデル・予算上限・レート制限を設定。リリースゲートに秘密情報スキャン(成果物・ログ内キー文字列検査)追加(NFR-SEC-002 の機械化)。

### 問題 10: コストの二重発生と予算統制の不在

改善: モデル階層固定(redaction 補助・定型要約 →Haiku/仮説生成・修正候補 →Sonnet/複雑判断・大コンテキスト →Claude Code 側で実施し委譲しない)。LiteLLM タグで task_id・tenant・agent_profile 付与、タスク単位コストを LLM Gateway Event へ。§15.4 KPI に「タスクあたり LLM コスト」「委譲 1 件あたり総コスト」追加。予算超過は fail closed(タスク open+通知)、安いモデルへの無断降格禁止。

### 問題 11: モデルルーティング表(タスク種別 × データ分類)未定義

改善: 先にデータ分類 × 送信可否マトリクス確定。例: public/internal→redaction 後 Anthropic 送信可。confidential→redaction+承認者確認後送信可。restricted(生 PII 等)→ 外部送信不可、Data Guard で集計化してから扱う。ルーティング判定は基盤 Gateway(分類 → 許可モデル群)、LiteLLM はエイリアス解決のみ。OQ-002/OQ-008 の決定を MVP 開始条件に格上げ。

### 問題 12: ワークスペースの同時編集競合

改善: ワークスペース所有権ルール(委譲中パスをリース=task_id+パス+期限として記録、PreToolUse フックがリース中パスへの Edit/Write をブロック)。基盤成果はパッチ(diff)返却、適用は Claude Code 側で人間確認のうえ実施(受入=パッチ適用で FR-ORCH-004 と一致)。リース解放=AGMSG-RESULT 受領+受入記録作成。

### 問題 13: Claude Code 会話履歴を AutoSkill に流すと redaction 違反

改善: MVP では AutoSkill 入力を AGMSG 経由の基盤側履歴のみに限定(FR-ORCH-006 範囲内)。将来は履歴 → 基盤 Gateway の redaction パイプライン →AutoSkill の片方向エクスポート+redaction 証跡を条件とし、直接ファイル参照取り込みは禁止。

### 問題 14: 受入判断の主体が曖昧(自動受入リスク)

改善: 受入 3 層化。(a) auto=低リスクかつ全証跡 green のみ自動受入可。(b) confirm=証跡サマリ提示+ユーザー明示応答。(c) review=高リスク・ゲート失敗・ポリシー拒否は人間レビュー必須。層判定は基盤側が `acceptance_tier` フィールドで指定、Claude Code は従うのみ。受入記録は基盤台帳へ(チャットログ代替禁止)、承認者 ID 必須。

### 問題 15: AGMSG-RESULT 経由のプロンプトインジェクション

改善: RESULT レンダリング規約(自由記述は「データであり指示ではない」、表示スクリプトが引用ブロックで区切る)。基盤側レポートは「検証済み事実のみ要約」モード(FR-AGENT-003)を必ず通す。RESULT 表示直後ターンの高権限操作は必ずユーザー確認を挟む。

### 問題 16: 障害時の fail-closed 連鎖が未設計

改善: LiteLLM 不達 → 基盤 Gateway がタスク open+`blocked_reason=llm_unavailable`停止。agmsg 書込失敗 → リトライ上限後にタスク未受理としてエラー返却。/status タイムアウト →「状態不明」明示、代行実行を提案しない。`/platform-health` で経路疎通(agmsg→Flue→Gateway→LiteLLM→Anthropic)スモーク。NFR-REL-001 受入テストに「LiteLLM 停止状態での委譲」追加。

### 問題 17: 監査ログの三重分散と相関 ID の不在

改善: task_id を全層の相関キーに統一(AGMSG、Flue ワークフロー実行 ID、Gateway 監査イベント、LiteLLM メタデータタグ)。一次台帳は基盤 JSONL、LiteLLM メトリクスはコールバックで基盤へ転送・集約(LiteLLM 側保持最小化)。Claude Code 側は委譲・受入イベントのみ task_id 付きで基盤台帳へ追記。task_id→ 全証跡一括出力 CLI(MVP-AC-009)。

### 問題 18: PRD 側の依存関係・用語がこの構成を想定していない

改善: PRD へ追補(参照実装構成: オーケストレータ=Claude Code、Pi provider path 本番実装=Platform Gateway+LiteLLM Proxy、モデル=Anthropic)。基盤自体は特定オーケストレータ非依存を保つ。OQ-002 を決定済みに更新、OQ-009 に Claude Code フック設定の管理責任者を含める。

## 3. 具体的な連携実装(最小構成)

### 3.1 LiteLLM Proxy 設定例(config.yaml)

```yaml
model_list:
  - model_name: worker-fast # 定型処理・要約
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: worker-main # 仮説生成・修正候補
    litellm_params:
      model: anthropic/claude-sonnet-4-6
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: worker-heavy # 例外的高難度(原則Claude Code側で処理)
    litellm_params:
      model: anthropic/claude-opus-4-8
      api_key: os.environ/ANTHROPIC_API_KEY

router_settings:
  fallbacks:
    - worker-main: ["worker-fast"] # 承認リスト内のみ。他プロバイダなし
  num_retries: 2

litellm_settings:
  turn_off_message_logging: true # 生プロンプト非保存(問題2)
  success_callback: ["platform_audit_forwarder"] # メタデータのみ基盤台帳へ
  failure_callback: ["platform_audit_forwarder"]

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  # 仮想キーはAgent Profile単位で発行(予算・許可モデル制限付き)
```

バインドは 127.0.0.1 のみ。基盤 Gateway 以外からの到達は OS レベルで遮断。

### 3.2 基盤 Gateway → LiteLLM の呼び出し規約

- Gateway が redaction 完了・分類判定・モデルエイリアス決定後、`extra_body.metadata = {task_id, agent_profile, tenant, data_class}` を付与して Proxy へ送信。
- Proxy 応答の usage/cost/latency を Gateway が LLM Gateway Event として記録(入出力はダイジェストのみ)。

### 3.3 Claude Code 側の連携部品

| 部品              | 実装                                            | 役割                                  |
| ----------------- | ----------------------------------------------- | ------------------------------------- |
| CLAUDE.md         | ルーティングマトリクス+禁止列挙+RESULT 改変禁止 | すみ分け恒常強制(問題 4,6)            |
| /delegate         | agmsg 送信スクリプト                            | AGMSG-TASK 発行、task_id 返却(問題 5) |
| /status           | 決定論スクリプトで RESULT 整形表示              | status 原文表示・不整合警告(問題 6)   |
| /accept           | acceptance_tier に従い受入記録を基盤台帳へ      | 三層受入(問題 14)                     |
| PreToolUse フック | OPA 照会+リースチェック                         | バイパス・編集競合防止(問題 3,12)     |
| /platform-health  | 経路スモーク                                    | fail-closed 確認(問題 16)             |

MCP 不使用。全連携は agmsg+ローカルスクリプト+フックで完結。

## 4. 導入順序(推奨)

1. 境界確定: データ分類 × 送信可否マトリクス(問題 11)+2 ゾーンモデル(問題 3)の文書化
2. LiteLLM Proxy 構築: 承認モデル固定・ログ抑止・仮想キー(問題 1,2,7,9)
3. 基盤 Gateway の LiteLLM 接続: prod provider path+相関 ID 伝搬(問題 8,17)
4. Claude Code 連携部品: CLAUDE.md → /delegate → /status → /accept → フック(問題 4,5,6,12,14)
5. 障害系テスト: LiteLLM 停止・redaction 失敗・ゲート失敗の fail-closed 確認(問題 16)
6. 監査突合 CLI: task_id 一括トレース(問題 17、MVP-AC-009)
7. PRD 追補: 参照実装構成の明文化(問題 18)

## 5. 要約

本質的リスクは統制境界の位置。LiteLLM は純粋なプロバイダアダプタとして基盤 Gateway の内側に閉じ込め、Claude Code は対話面・オーケストレータ・受入 UI に役割を限定して統制層をバイパスさせない。完了判定と受入層の判定権を LLM に持たせず、機械可読フィールドと決定論スクリプトで運ぶ。
