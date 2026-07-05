# Hermes Skill Subset Policy

Hermes Agents 本体は導入しない。ここでは Skill 自動化に有用なサブセット方針だけを管理する。

## 取り込む要素

- `SKILL.md` 互換構造。
- Progressive disclosure / on-demand loading。
- Activation hint metadata。
- Task-completion、error-recovery、user-correction を契機とする create / patch / merge 判断。
- Registry 分離。Candidates、promoted、rejected、merged を別ディレクトリで管理する。

## 取り込まない要素

- Hermes Agents ランタイム。
- 永続メモリ、profile、personality、`SOUL.md`。
- Toolsets、plugins、messaging、automation framework。
- Mixture of Agents、UI、runtime。
- Bundled skills、skill hub。

## Hermes Agents 本体を導入しない理由

既存の Claude Code オーケストレーター、Codex ワーカー、agmsg、Agent loop と責務が重複し、機能が巨大化するため。
