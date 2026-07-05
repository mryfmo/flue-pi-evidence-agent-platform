# P2-T06/T07 実行基盤 判断記録(orchestrator, 2026-07-05)

## 調査事実

| 項目                         | 事実                                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenSandbox ローカル実行     | **Docker デーモン(Docker API)必須**(公式 README: "Docker (required for local execution)"、`uvx opensandbox-server` + docker example config)。代替 OCI ランタイムのサポート記載なし |
| Apple container 1.0          | Docker API ソケットを提供しない(独自 API)。OpenSandbox から直接利用不可                                                                                                            |
| 本ホストの選択済みランタイム | Apple container(ユーザー決定)。linux コンテナのタスク単位分離は実証済み(P2-T02)                                                                                                    |
| AutoSkill(ECNU-ICALK)        | **MIT ライセンス**。PyPI リリースなし → **commit SHA 固定**で採用。Dockerfile/compose 同梱。入力=対話・エージェント軌跡、出力=SKILL.md。実行に **OpenAI 互換 LLM API が必要**      |

## 判断(推奨)

### G15 / P2-T06: OpenSandbox は「条件付き繰延べ」、タスク sandbox は Apple container で代替

- OpenSandbox の導入条件を「Docker API 提供ランタイム(colima 等)または Kubernetes が利用可能になった時点」と定義して繰延べ。
- 代わりに、**Apple container によるタスク単位 sandbox** を §7.7 fallback の上位互換として正式化する: タスクごとに使い捨て linux コンテナ(作業コピー + redacted input を mount、ネットワークは既定 deny=--network none 相当、成果物のみ回収)。隔離強度は codex workspace-write(Seatbelt)より強い(VM 分離)。
- sandboxes/POLICY.md を v2 に更新する(fallback 階層: OpenSandbox > Apple container task sandbox > codex workspace-write)。

### G16 / P2-T07: AutoSkill は commit 固定 + Apple container 内実行で導入

- T07a(LLM 不要・先行可能): pinned commit checkout、ライセンス/依存/SBOM レビュー、コンテナイメージ化、redacted input 生成パイプライン(agmsg history / reports / acceptance → redaction gate → autoskill/inputs)。
- T07b(LLM 必要): dry-run で Skill 候補 ≥1 件生成。**OpenAI 互換 API キーの提供が前提**(P2-T05 の env 注入フローで投入。プロバイダとモデルはユーザー選択)。キー未提供の間は T07a 完了状態で待機。

## ユーザー決定(2026-07-05 確認済み)

1. **OpenSandbox は Pi+Flue 製品の必須コンポーネント**とする。開発時の一時利用は Apple container で代替してよい、という位置づけ。
   - 帰結: G15 は「オーケストレーション用ツール」ではなく**製品要件**(remediation workspace / コード実行の隔離層)として再定義する。P2-T06 は「OpenSandbox 製品統合の設計 + 契約」タスクに改訂。
   - 実行検証の場: **GitHub Actions ubuntu ランナーには Docker があるため、OpenSandbox のローカル(Docker)runtime を CI 上で実行検証できる**。macOS 開発機の制約は CI で回避可能。
   - 開発時のタスク sandbox 階層(暫定): Apple container task sandbox > codex workspace-write。sandboxes/POLICY.md v2 で明文化。
2. **AutoSkill は T07a まで**(pinned commit / ライセンス・SBOM レビュー / コンテナ化 / redacted input パイプライン)。LLM を使う dry-run(T07b)はキー提供後の別セッション。
