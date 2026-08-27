# arifure

Arifure Wiki 向けの補助Webアプリケーションとゲームリソース同期処理を管理するモノレポです。

## 新アーキテクチャ

- `apps/web`: Vite + React Router Framework Mode による静的Webアプリケーション
  - `/gp-calculator`: ガチャポイント計算機
  - `/quiz`: クイズ正誤検索
- `apps/resource-sync`: G123のリソースを取得・差分同期するCloudflare Worker（Cron Trigger想定）
- `packages/gp-calculator`: UIから独立したガチャポイント計算ロジック

UIはshadcn/ui（Base UI）を標準とし、低レベルUI primitiveの独自実装は原則行いません。

## 移行方針

再構築中は旧ディレクトリを参照用として残します。新実装の確認後に、旧 `gp-calculator` / `quiz` / `resource` および不要なレガシーコードを削除します。

Cloudflare上のD1・Worker・Secrets等のremote resourceは、このリポジトリ上の再構築確認後に作成します。
