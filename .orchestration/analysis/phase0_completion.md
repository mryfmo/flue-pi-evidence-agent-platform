# Phase 0 完了サマリ

- 判定: **完了**(orchestrator-fable5, 2026-07-05)
- スコープ: 指示書 §12 Phase 0(調査・読了・オーケストレーション基盤)

## §12 必須成果物の充足

| #   | 成果物                             | 状態 | 場所                                                                                                                                                  |
| --- | ---------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `.orchestration/` ディレクトリ構成 | 済   | P0-T01(accepted)                                                                                                                                      |
| 2   | agmsg チーム・ロール初期化         | 済   | team=flue-pi-productionization。orchestrator-fable5 + 常駐 codex-gpt55-high(herdr w8)+ タスク別ワーカー。双方向疎通実証済み(PING/PONG + 3 タスク往復) |
| 3   | 既存文書読了メモ                   | 済   | analysis/step0_reading_notes.md                                                                                                                       |
| 4   | G1〜G17 ギャップ分析初版           | 済   | analysis/gap_analysis_v1.md(P0-T02/T03 実測追記済み)                                                                                                  |
| 5   | OpenSandbox 実行隔離ポリシー初版   | 済   | sandboxes/POLICY.md(unavailable → §7.7 fallback 運用中)                                                                                               |
| 6   | AutoSkill 導入方針・redaction 契約 | 済   | autoskill/config/ADOPTION_PLAN.md                                                                                                                     |
| 7   | Hermes Skill Subset 方針           | 済   | skills/hermes_subset_policy.md(本体非導入を明記)                                                                                                      |
| 8   | フェーズ/タスクバックログ初版      | 済   | tasks/BACKLOG.md                                                                                                                                      |
| 9   | Codex 委譲開始                     | 済   | P0-T01 / P0-T02 / P0-T03 の 3 件が AGMSG-TASK→RESULT→ACCEPTANCE を完走、全件 accepted                                                                 |

## 受入済みタスクとコミット

| タスク   | 内容                                        | コミット |
| -------- | ------------------------------------------- | -------- |
| baseline | ZIP 取込 + git 化 + tag baseline-v1.1.0     | 6d78447  |
| P0-T01   | orchestration scaffold                      | c8d26e3  |
| P0-O     | 方針文書・バックログ                        | e1add90  |
| P0-T03   | lockfile 公開レジストリ再指向(G11 重大修復) | c34b2f2  |
| P0-T02   | darwin 16 ゲート再現計測                    | 495d8c3  |

## 重要発見(Phase 1 以降への引き継ぎ)

1. **リリース ZIP は社内ミラー依存で外部復元不能だった**(P0-T03 で解消)。lockfile resolved URL 検証を P2-T04 の新設サプライチェーンゲートに含める。
2. darwin ベースライン: 11〜12/16 pass。opa(linux-x64 依存)、vitest_all(OPA 連鎖 + sandbox listen EPERM)、npm_sbom_prod(ホスト npm 依存)が環境起因 fail。製品欠陥ゼロ。fail-closed は実機確認済み。
3. 「既存 16 ゲート passed」の判定基準は git 保全済みの baseline 証跡 + 今後の linux コンテナゲート(P2-T02)とする。
4. 常駐 Codex(herdr w8)連携の運用ノウハウは sandboxes/POLICY.md の herdr 節参照(turn 配信フックは次回 codex セッションから有効)。

## 既知の未完・引き継ぎ事項

- npm_audit_prod は未計測(ネットワーク制約)。P2-T03 の CI 上で実施。
- ~/.codex/config.toml の writable_roots は chezmoi ソース未反映(ユーザー対応待ち)。
- 次フェーズ: Phase 1(G1/G9 — 本番 LLM ゲートウェイ / モデルルーティング)。バックログ P1-T01 から。
