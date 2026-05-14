# 求人スキル分析アプリ

Cloudflare Pagesなどで静的ファイルを配信し、`supabase-config.json` のURLとanonキーでSupabase REST APIへ接続する構成です。

## Supabase準備

1. SupabaseのSQL Editorで `schema.sql` を実行します。
2. `supabase-config.json` にSupabase Project URLとanonキーを設定します。

anonキーは公開前提のキーです。書き込みを公開したくない場合は、SupabaseのRLSポリシーやCloudflare Accessで保護してください。

401が出る場合は、`supabase-permissions.sql` をSupabaseのSQL Editorで実行してください。テーブルだけ作成してポリシーが無い状態だと、anonキーでは読み書きできません。

## 公開

静的ファイルとして公開できます。Build commandは空、Build output directoryは `/` を指定します。

求人の保存と取得はブラウザからSupabaseへ直接行います。`supabase-config.json` が読み込めない場合は、ブラウザ内のIndexedDBへフォールバックします。

API関連ファイルは使っていません。クロール処理は `crawler.js` にあります。ただしAPIなし構成では、取得先サイトがCORSを許可していない場合、ブラウザから求人ページを取得できません。
