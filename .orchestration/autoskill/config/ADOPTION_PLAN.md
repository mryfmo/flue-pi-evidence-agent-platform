# AutoSkill 導入方針 v1

- 作成: orchestrator-fable5, 2026-07-05(Phase 0)
- 準拠: 指示書 §7.8.1 / §10.3
- 状態: **未導入**(Phase 0 は受け皿と本方針のみ。導入は Phase 2、運用は Phase 4)

## 原則

1. AutoSkill(ECNU-ICALK/AutoSkill 公式実装)を再実装せず、固定 commit/tag でそのまま利用する。
2. 導入前に必須: ライセンス確認、依存関係・脆弱性レビュー、SBOM 生成(G11 と連動)、実行権限レビュー。
3. 実行は sandbox 内(OpenSandbox 導入後はその中、それまでは fallback sandbox + network deny)。
4. 生成 Skill は直接採用禁止。`.orchestration/skills/candidates/` に保存し、validation-gated promotion のみ。

## 入力データ契約(redaction gate)

- ソース: `.orchestration/agmsg/history.jsonl`、`.orchestration/reports/`、`.orchestration/validation/`、`.orchestration/acceptance/`
- redaction 後のみ `.orchestration/autoskill/inputs/<TaskID>.manifest.json` + 入力ファイルとして配置。
- redaction 対象: 絶対パス中のユーザー名以外の個人情報、資格情報らしき文字列、メールアドレス、未承認の組織固有情報。redaction 実装は既存資産(Presidio regex recognizer, scripts/data_guard.py のパターン)を再利用する。新規 PII エンジンを作らない。

## 出力データ契約

- run log: `.orchestration/autoskill/runs/<TaskID>.autoskill.md`(固定 version、decision: discard/improve/merge/create/version_update、redaction_passed、promotion_allowed=false)
- 生成候補: `.orchestration/skills/candidates/<TaskID>.SKILL.md`(SKILL.md 互換 frontmatter: purpose / activation hint / prerequisites / steps / validation / pitfalls / non-goals / rollback / provenance)

## Skill registry 状態遷移(3 系統共通)

```
observed -> autoskill_generated | hermes_subset_candidate | manual_candidate
         -> candidate -> validated -> promoted
                      -> rejected
                      -> merge_required
                      -> improve
```

昇格条件(指示書 §7.9): 既存 16 ゲート非破壊 / 2 回以上の再利用価値または明示指示 / 狭い適用範囲と明確な activation / 秘密情報なし / run log と source input 保存済み / Hermes 由来はサブセット範囲内。

## Phase 2 導入タスクの DoD(先行定義)

- [x] 固定 commit/tag と SHA を記録し、ライセンスを `.orchestration/autoskill/config/` に保存
- [x] pip-audit / SBOM を artifacts に保存(既存 G11 拡張と同じ形式)
- [x] sandbox 内 dry-run(P0/P1 の実タスクレポートを redacted input として candidate を 1 件以上生成)
- [x] 生成物が promotion されないこと(promotion_allowed=false)をレビューで確認

P2-T07b acceptance confirmed pinned SHA `94c47ca488d4ba4117d20272e66d49b9877e68cf`, dry-run success through the Codex Auth shim, five generated candidates, redaction passed, and `promotion_allowed=false`. SBOM/audit gates are part of the accepted release-validation security gate set.

## Dual-auth dry-run

AutoSkill dry-run は `run_autoskill.sh --auth openai|codex --run-id <id>` で起動する。`openai` は OpenAI-compatible base URL と API key を明示注入し、`codex` は `codex_auth_proxy.mjs` の bearer token 付き local shim を OpenAI-compatible endpoint として使う。コンテナから host shim へは `EAP_SHIM_URL` を明示し、Docker では `host.docker.internal`、Apple `container` では検出済み VM gateway IP または `EAP_SHIM_HOST` override を使う。生成 Skill は引き続き candidates 保存のみで promotion 禁止。

P7-T01 adds native Hermes Skill Subset lifecycle automation (`scripts/skill-lifecycle.mjs` and `scripts/skill-activate.mjs`) for observe/decide/apply recommendations and progressive disclosure; it does not replace AutoSkill dry-run generation or allow automated promotion.
