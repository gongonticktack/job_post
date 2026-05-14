# 求人スキル分析アプリ

Cloudflare Pagesで静的ファイルを配信し、`supabase-config.json` のURLとanonキーでSupabase REST APIへ接続する構成です。

## Supabase準備

1. SupabaseのSQL Editorで `schema.sql` を実行します。
2. `supabase-config.json` にSupabase Project URLとanonキーを設定します。

anonキーは公開前提のキーです。書き込みを公開したくない場合は、SupabaseのRLSポリシーやCloudflare Accessで保護してください。

401が出る場合は、`supabase-permissions.sql` をSupabaseのSQL Editorで実行してください。テーブルだけ作成してポリシーが無い状態だと、anonキーでは読み書きできません。

## Cloudflare Pages

リポジトリをPagesに接続し、Build commandは空、Build output directoryは `/` を指定します。

API:

- `POST /api/crawl`: 求人一覧URLから求人詳細を取得して抽出

求人の保存と取得はブラウザからSupabaseへ直接行います。`supabase-config.json` が読み込めない場合は、ブラウザ内のIndexedDBへフォールバックします。
