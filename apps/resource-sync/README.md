# resource-sync

G123から `Localize.json` とお知らせデータを1分ごとに取得し、Cloudflare D1へ同期するScheduled Workerです。

## 同期原則

1. upstreamのraw responseからSHA-256を計算する。
2. `resource_state` のdataset-level `content_hash` 1行だけを読む。
3. hashが一致すれば即終了する。
4. hashが変わった場合だけ、各レコードの `content_hash` を比較する。
5. 変更分だけD1へ書き込み、最後にdataset-level hashを更新する。

dataset-level hashを最後に更新するため、途中で同期が失敗しても次回Cronで自動的に再試行されます。

## D1モデル

- `localize_entries`: 1行 = 1 key-value pair。`(locale, key)` が主キー。
- `notices`: お知らせ本体。`sort:lastsTime` をupstreamにstable IDがない場合のidentityとして使用。
- `notice_translations`: noticeごとの多言語 `title` / `content`。
- `resource_state`: dataset-level hashと件数を保持。

## Cloudflare provisioning

remote resourceはまだ作成しません。再構築レビュー後に以下を設定します。

- D1 binding: `DB`
- Cron Trigger: `* * * * *`
- Secret (optional): `DISCORD_WEBHOOK_LOCALIZE`
- Secret (optional): `DISCORD_WEBHOOK_INDEX`

D1作成後、`migrations/0001_initial.sql` を適用してからWrangler設定を追加します。
