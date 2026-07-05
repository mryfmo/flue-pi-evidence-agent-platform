# P1-T05: OpenSandbox 配布方法調査(orchestrator 実施)

- 調査: orchestrator-fable5, 2026-07-05
- ソース: github.com/opensandbox-group/OpenSandbox(公式 README)、PyPI

## 調査結果

| 項目                | 事実                                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 提供元 / ライセンス | Alibaba 系 OSS。**Apache 2.0**(ライセンス面の採用障壁なし)                                                                                                                                         |
| 配布形態            | PyPI: `opensandbox`(SDK, 最新 **0.1.13**)+ `opensandbox-cli`。npm `@alibaba-group/opensandbox`。Docker イメージ(例: `opensandbox/code-interpreter:v1.1.0`)。サーバー release **0.2.1**(2026-06-29) |
| ランタイム要件      | **ローカル実行には Docker が必須**。上位環境は Kubernetes、強隔離は gVisor / Kata / Firecracker                                                                                                    |
| Homebrew            | formula なし(Phase 0 で実測済み)→ brew 経由導入は不可、pip + Docker が正規ルート                                                                                                                   |
| 本ホスト適合性      | **Docker ランタイム不在**(docker / orbstack / colima / podman いずれも未検出)。SDK は pip で入るが実行基盤がない                                                                                   |

## 判断(G15)

1. **現時点では導入不可**: 本 Mac にコンテナランタイムがないため、OpenSandbox のローカル実行要件を満たせない。§7.7 fallback(codex workspace-write)継続は妥当。
2. **導入の前提条件はユーザー判断**: Docker Desktop / OrbStack / colima のいずれかのインストール(システムレベル変更)が必要。オーケストレーター側では実施しない。
3. **導入時の固定バージョン(pin 候補)**: SDK `opensandbox==0.1.13`、server `0.2.1`、sandbox image はタグ固定(latest 禁止)。SBOM は pip-audit + イメージ SBOM(P2-T04 と同一形式)。
4. **P2-T06(導入タスク)の着手条件**: コンテナランタイム利用可 → dry-run(コード実行 1 件を sandbox 内で実行し、ログ回収を `.orchestration/sandboxes/` 形式で保存)→ Codex タスク実行経路への組み込み。
5. G2(コンテナ化)と同時に進めるのが効率的: リリースゲートの linux コンテナ実行(P2-T02)と OpenSandbox runtime は同じ Docker 基盤を共有する。

## リスク・留意

- サーバー 0.2.x は若いプロジェクト。API 安定性リスクがあるため、SDK 直結ではなく薄いラッパー(タスク単位 sandbox 作成/回収のみ)で接続し、交換可能に保つ。
- redaction / credential 非注入の原則(sandboxes/POLICY.md)は OpenSandbox 導入後も変わらない。
