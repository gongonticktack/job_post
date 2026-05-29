# 求人スキル分析アプリ

Cloudflare Pagesなどで静的ファイルを配信し、`supabase-config.json` のURLとanonキーでSupabase REST APIへ接続する構成です。

## Supabase準備

1. SupabaseのSQL Editorで `schema.sql` を実行します。
2. `supabase-config.json` にSupabase Project URLとanonキーを設定します。

anonキーは公開前提のキーです。書き込みを公開したくない場合は、SupabaseのRLSポリシーやCloudflare Accessで保護してください。

`schema.sql` には求人、スキル、辞書、会社別の求人票構成ルール、RLSポリシーがまとまっています。まっさらなSupabase環境なら、この1ファイルだけで必要なDB構成を作れます。

既存DBを更新する場合も `schema.sql` を再実行できます。過去に元テキスト・雇用形態・想定役職・労働形態の列を追加済みで不要な場合は、`supabase-drop-unused-job-fields.sql` を実行すると削除できます。

## 公開

静的ファイルとして公開できます。Build commandは空、Build output directoryは `/` を指定します。

求人の保存と取得はブラウザからSupabaseへ直接行います。`supabase-config.json` が読み込めない場合は、ブラウザ内のIndexedDBへフォールバックします。

基本のクロール処理は `crawler.js` にあります。ただしAPIなし構成では、取得先サイトがCORSを許可していない場合、ブラウザから求人ページを取得できません。

富士通の求人サイトなどCORSでブラウザ直取得できないサイト向けに、Cloudflare Pages Functions の `functions/api/proxy.js` を追加しています。Pages Functions が有効な環境では、`crawler.js` が直取得に失敗したときだけ `/api/proxy` 経由で取得します。

求人票の直接入力は `company-parsers.js` の会社別ルールとスキル辞書で抽出します。NTT DATA形式を初期対応済みです。抽出後は保存前編集フォームで修正してからDBに保存できます。
