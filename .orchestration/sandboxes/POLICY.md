# 実行隔離ポリシー v2(OpenSandbox / fallback)

- 作成: orchestrator-fable5, 2026-07-05(Phase 0)
- 準拠: 指示書 §7.7

## 現状

- **OpenSandbox は product runtime として実装済み**。`EAP_SANDBOX_RUNTIME=opensandbox` と `EAP_OPENSANDBOX_URL` を指定した場合のみ有効化する。未設定または server 到達不能時は fail closed し、local へ silent fallback しない。
- **本ホスト(macOS darwin/arm64)では OpenSandbox server を常時起動しない**。Docker runtime 不在の開発ホストは従来どおり local fallback を使う。
- 全 Codex タスクは fallback で実行する: `codex exec --sandbox workspace-write`、`network_access=false`(~/.codex/config.toml)。
- writable_roots は repo workspace + agmsg の db/teams/run のみ。`.env`・秘密鍵・長期資格情報は渡さない(現行プロトタイプは鍵不要構成)。
- 各タスクは `.orchestration/sandboxes/<TaskID>.sandbox.md` に fallback 理由「OpenSandbox unavailable」、実行コマンド、変更ファイル、残リスクを記録する(P0-T01 で運用開始済み)。
- CI の `opensandbox-integration` job は pinned OpenSandbox server と pinned sandbox image で product runtime の契約テストを実行する。

## pins

- npm SDK: `@alibaba-group/opensandbox@0.1.9`
- server image: `opensandbox/server:v0.2.1@sha256:a41670fa956864f116b9db696bd8d0781b6c709be9cac1e66e2981740b1fbeb4`
- sandbox image: `opensandbox/code-interpreter:v1.1.0@sha256:133a3c1720dd52291a019740c2987e7164ea6de79e23d8198798e58950ae2e6e`
- policy package: `data.eap.sandbox`

## fallback の残リスク

- Codex sandbox は OS レベル(Seatbelt)の書込制限とネットワーク遮断のみ。カーネル分離・イメージ再現性・資格情報 vault はない。
- 依存インストール等ネットワークが必要な操作はオーケストレーターが事前プロビジョニングする(P0 では npm ci / setup-python を orchestrator 側で実施)。

## OpenSandbox 導入計画(G15、Phase 1〜2)

1. P1: 公式配布方法の調査(GitHub releases / コンテナイメージ / ソースビルド)、固定 version、ライセンス・SBOM レビュー。完了。
2. P2: Docker runtime で導入し、タスク単位 sandbox(作業コピー + redacted input のみ mount、egress deny 既定)へ移行。CI job で検証開始。
3. コンテナ基盤(G2)確立後: Kubernetes runtime・強隔離 runtime(gVisor/Kata/Firecracker)の採用可否を再評価。単一 macOS ホストでは強隔離 runtime は適用不可。

## herdr 運用メモ

- Codex ワーカーは herdr workspace(label: "flue-pi codex worker")のペインで起動し、ユーザーが作業を目視できる。
- 起動: `herdr agent start <name> --workspace <id> --cwd <repo> -- codex exec ...`
- 状態監視: agmsg history の AGMSG-RESULT を一次シグナルとする。herdr の agent_status(idle)は codex exec のステップ間で flap するため、単独では完了判定に使わない(P0-T01 で実測)。
