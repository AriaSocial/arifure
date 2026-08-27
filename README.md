# arifure

Arifure Wiki 向けの補助Webアプリケーションとゲームリソース同期処理を管理するモノレポです。

## アーキテクチャ

- `apps/web`: Vite + React Router Framework Mode による静的Webアプリケーション
  - `/gp-calculator`: ガチャポイント計算機
  - `/quiz`: クイズ正誤検索
- `apps/resource-sync`: G123のリソースを取得・差分同期するCloudflare Worker（Cron Trigger想定）
- `packages/gp-calculator`: UIから独立したガチャポイント計算ロジック

UIはshadcn/ui（Base UI）を標準とし、低レベルUI primitiveの独自実装は原則行いません。

## Cloudflare

Cloudflare上のD1・Worker・Secrets等のremote resourceは、コードの再構築とは分離してprovisioningします。

- Web: Cloudflare Workers Static Assets
- Resource sync: Cloudflare Workers Cron Trigger
- Data: Cloudflare D1
- Discord Webhook URL: Workers Secrets
