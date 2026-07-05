# タスクバックログ v1(Phase 0〜6)

- 作成: orchestrator-fable5, 2026-07-05
- 規約: 全タスクは指示書 §8 テンプレートで `.orchestration/tasks/<ID>.md` に展開してから委譲。1 タスク = 1 Codex 委譲 = 1 コミット相当。受入者は常に orchestrator-fable5。
- 状態: todo / delegated / accepted / blocked / dropped

## Phase 0(進行中)

| ID     | 内容                                                                  | Gap        | 担当         | 状態         |
| ------ | --------------------------------------------------------------------- | ---------- | ------------ | ------------ |
| P0-T01 | orchestration workspace scaffold + hermes_subset_policy               | G14,G17    | codex        | **accepted** |
| P0-T02 | darwin 環境での 16 ゲート再現ベースライン計測(レポート専用、修正禁止) | G4,G11,G15 | codex        | **accepted** |
| P0-T03 | package-lock.json を社内ミラーから公開レジストリへ再指向(緊急追加)    | G11        | codex        | **accepted** |
| P0-O   | git 化 / agmsg チーム / 読了メモ / gap 分析 / 方針文書 / 受入・履歴   | G14        | orchestrator | 完了         |

## Phase 1: 本番 LLM ゲートウェイ / モデルルーティング(G1, G9, G12, G14, G15)

| ID     | 内容                                                                                                                                                           | 完了条件の要点                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| P1-T01 | 本番ゲートウェイ設計書: provider 契約(openai-completions)の背後に実プロバイダ接続を置く設計、audit ID / redaction hook / trace ID 維持、決定論ゲートウェイ温存 | 設計書 + traceability 更新。コード変更なし                               |
| P1-T02 | ポリシー型モデルルーティング設計: tenant/データ分類/タスク種別/コスト/レイテンシによる選択、フォールバック連鎖、既存 OSS パターン採否記録                      | 採用/見送り理由の記録(§14-6)                                             |
| P1-T03 | ゲートウェイ最小実装(1 プロバイダ、env 鍵、redaction hook、smoke 契約テスト)                                                                                   | 新ゲート「実 LLM 疎通またはモック契約テスト」green、既存 16 ゲート非破壊 |
| P1-T04 | README/TRACEABILITY のドキュメント整合修正(buggy_calc→buggy_multi、テストパス)                                                                                 | spec_traceability green(G13 の軽微分の先行処理)                          |
| P1-T05 | OpenSandbox 配布方法調査 + 固定 version 選定(導入は P2)                                                                                                        | 調査レポート + ライセンス/SBOM レビュー                                  |
| P1-T06 | レイテンシ/トークン計測フックの追加(G12 計測開始)                                                                                                              | telemetry JSONL に計測 span、既存形式維持                                |

## Phase 2: デプロイ / シークレット / CI-CD / サプライチェーン(G2, G3, G4, G11, G15, G16)

| ID     | 内容                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| P2-T01 | OPA 依存の platform 問題解消(darwin-arm64 追加 or optionalDependencies + EAP_OPA_BINARY 文書化)— P0-T02 実測が入力 |
| P2-T02 | Dockerfile + compose(linux コンテナで 16 ゲート完走 = 新設「コンテナビルド検証」ゲート)                            |
| P2-T03 | CI パイプライン(linux ランナーで validate-release、成果物保管、fail 時停止)                                        |
| P2-T04 | Python/コンテナ/OPA バイナリ SBOM 拡張 + 署名方針                                                                  |
| P2-T05 | シークレット注入設計(env → マネージャ移行パス。G1 実鍵の導入期限と連動)                                            |
| P2-T06 | OpenSandbox 導入(Docker runtime、タスク単位 sandbox、egress deny)                                                  |
| P2-T07 | AutoSkill 導入(固定 commit、ライセンス/SBOM、sandbox 内 dry-run)→ ADOPTION_PLAN.md の DoD                          |
| P2-T08 | デプロイスモークテスト(新設ゲート)                                                                                 |

## Phase 3: 認可 / データガバナンス / マルチテナント(G6, G7)

| ID     | 内容                                                                           |
| ------ | ------------------------------------------------------------------------------ |
| P3-T01 | tenant ハードコード除去: OPA data document 化 + テナント境界テスト拡張         |
| P3-T02 | OPA bundle 配布 + ポリシー検証(opa test)ゲート                                 |
| P3-T03 | PII 検出精度向上(regex → NLP recognizer、offline 動作維持)+ 検出精度回帰テスト |
| P3-T04 | クエリ種別拡張(SQLGlot 検証ルールの一般化、aggregate-only 原則維持)            |

## Phase 4: Agent / Skill 継続最適化(G8, G13, G16, G17)

| ID     | 内容                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| P4-T01 | remediator profile の Skill 成果物化(best/candidate、held-out validation、rejected buffer、provenance、rollback)= SkillOpt サイクル |
| P4-T02 | 欠陥種別拡張 + held-out validation セット(G13)                                                                                      |
| P4-T03 | AutoSkill 定常運用(タスクレポート →candidate 生成 →validation-gated promotion)+ 1 回以上の改善サイクル実施(§14-5)                   |
| P4-T04 | Hermes Skill Subset 範囲逸脱検証ゲート(新設)                                                                                        |

## Phase 5: 可観測性 / 運用 / 障害復旧(G5, G10, G12)

| ID     | 内容                                                  |
| ------ | ----------------------------------------------------- |
| P5-T01 | OTLP エクスポート + 集約先接続(JSONL 形式は維持)      |
| P5-T02 | SLO 定義 + アラート(G12 計測データが入力)             |
| P5-T03 | バックアップ/リストア/ロールバック手順 + RUNBOOK 拡充 |

## Phase 6: 統合検証 / リリース判定(G1〜G17)

| ID     | 内容                                                        |
| ------ | ----------------------------------------------------------- |
| P6-T01 | 新設ゲート統合(§14-3 の 9 ゲート)+ 拡張 traceability matrix |
| P6-T02 | リスクレジスタ最終化 + 最終リリース判定レポート             |

## 新設予定ゲート(§14-3 対応表)

コンテナビルド検証(P2-T02)/ デプロイスモーク(P2-T08)/ 実 LLM 疎通・契約テスト(P1-T03)/ 追加サプライチェーン検証(P2-T04)/ agmsg 委譲ログ検証(P6-T01)/ sandbox 実行隔離ログ検証(P6-T01)/ AutoSkill redaction・候補生成ゲート(P2-T07, P4-T03)/ Hermes サブセット範囲逸脱検証(P4-T04)/ SkillOpt 継続改善ゲート(P4-T01)
