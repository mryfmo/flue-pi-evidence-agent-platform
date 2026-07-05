# 実行隔離ポリシー v1(OpenSandbox / fallback)

- 作成: orchestrator-fable5, 2026-07-05(Phase 0)
- 準拠: 指示書 §7.7

## 現状

- **OpenSandbox は本ホスト(macOS darwin/arm64)で利用不可**。ローカル未インストール、Homebrew formula 不存在(2026-07-05 実測)。
- 全 Codex タスクは fallback で実行する: `codex exec --sandbox workspace-write`、`network_access=false`(~/.codex/config.toml)。
- writable_roots は repo workspace + agmsg の db/teams/run のみ。`.env`・秘密鍵・長期資格情報は渡さない(現行プロトタイプは鍵不要構成)。
- 各タスクは `.orchestration/sandboxes/<TaskID>.sandbox.md` に fallback 理由「OpenSandbox unavailable」、実行コマンド、変更ファイル、残リスクを記録する(P0-T01 で運用開始済み)。

## fallback の残リスク

- Codex sandbox は OS レベル(Seatbelt)の書込制限とネットワーク遮断のみ。カーネル分離・イメージ再現性・資格情報 vault はない。
- 依存インストール等ネットワークが必要な操作はオーケストレーターが事前プロビジョニングする(P0 では npm ci / setup-python を orchestrator 側で実施)。

## OpenSandbox 導入計画(G15、Phase 1〜2)

1. P1: 公式配布方法の調査(GitHub releases / コンテナイメージ / ソースビルド)、固定 version、ライセンス・SBOM レビュー。
2. P2: Docker runtime で導入し、タスク単位 sandbox(作業コピー + redacted input のみ mount、egress deny 既定)へ移行。
3. コンテナ基盤(G2)確立後: Kubernetes runtime・強隔離 runtime(gVisor/Kata/Firecracker)の採用可否を再評価。単一 macOS ホストでは強隔離 runtime は適用不可。

## herdr 運用メモ

- Codex ワーカーは herdr workspace(label: "flue-pi codex worker")のペインで起動し、ユーザーが作業を目視できる。
- 起動: `herdr agent start <name> --workspace <id> --cwd <repo> -- codex exec ...`
- 状態監視: agmsg history の AGMSG-RESULT を一次シグナルとする。herdr の agent_status(idle)は codex exec のステップ間で flap するため、単独では完了判定に使わない(P0-T01 で実測)。
