# 求人スキル分析アプリ

求人票をクロールまたは直接貼り付けで取り込み、企業別・スキル別・資格別に求人傾向を確認するための静的Webアプリです。

主な機能:

- 求人ページURLからの取得
- 求人票テキストの直接入力と保存前編集
- 必須/歓迎スキル、資格、企業、年収、勤務地での絞り込み
- 年収レンジフィルタ
- 求人一覧のソート
- Supabase保存、またはブラウザ内IndexedDBへのフォールバック
- 会社別求人票フォーマットに合わせた抽出ルール

## 使い方

`index.html` をブラウザで開くとアプリを利用できます。Cloudflare Pagesなどに静的ファイルとして配置しても動きます。

Supabaseを使う場合は、`schema.sql` をSupabaseのSQL Editorで実行し、`supabase-config.json` にProject URLとanon keyを設定します。`supabase-config.json` が読めない場合やSupabase取得に失敗した場合は、ブラウザ内のIndexedDBに保存します。

求人クロールは取得先サイトのCORS制限を受けます。Cloudflare Pages Functionsを使える環境では、`functions/api/proxy.js` の許可ホスト経由で一部サイトを取得できます。取得に失敗した場合は、画面に `FETCH_HTTP_403` や `FETCH_NETWORK_ERROR` のようなエラーコードと詳細が表示されます。

## ファイル構成

### `index.html`

画面のHTMLです。ダッシュボード、クロール入力、求人票直接入力、設定画面、求人カードテンプレートを定義しています。

主な要素:

- 上部メトリクス
- 年収フィルタ
- 必須スキル傾向
- 資格傾向
- 企業一覧
- 求人一覧
- クロールフォーム
- 手入力フォーム
- スキル/資格辞書編集

### `styles.css`

画面全体のスタイルです。ダークテーマ、カード、ワードクラウド、年収レンジバー、求人カード、スマホ表示などを管理しています。

スキル傾向・資格傾向・企業一覧の折りたたみ表示もここで制御しています。

### `app.js`

アプリ本体のロジックです。

主な役割:

- Supabase/IndexedDBからの求人読み込み
- 求人保存
- 画面描画
- 検索、フィルタ、ソート
- 年収レンジフィルタ
- 会社名の正規化
- 求人票直接入力の解析
- スキル/資格辞書の編集と保存
- 保存済みデータの整理

UI上のクリックや入力イベントの多くはこのファイルで処理しています。

### `crawler.js`

求人ページの取得と、取得したHTML/本文から求人情報を抽出する処理です。

主な役割:

- URLから求人一覧/詳細ページを取得
- 会社別の特殊な求人ページ形式を解析
- タイトル、職務内容、年収、勤務地、必須スキル、歓迎スキルを抽出
- CORSで直接取得できない場合に `/api/proxy` を試す
- 取得エラーをコード付きで返す

一部の公式採用サイトはJavaScriptやbot確認が必要なため、ページ本文を直接取得できないことがあります。その場合は、対応済み求人であればフォールバック情報を使うか、直接入力フォームに求人票本文を貼り付けて解析します。

### `company-parsers.js`

会社別の求人票抽出ルールとスキル/資格辞書の初期値です。

主な内容:

- 会社名の別名
- 求人タイトルの取り方
- 職務内容、年収、勤務地、必須/歓迎スキルの見出し
- MUST/WANTなど会社固有の区切り
- 抽出対象外にする語句
- スキル辞書
- 資格辞書
- スキルカテゴリと色

新しい会社に対応する場合は、まずこのファイルに会社設定を追加します。Supabaseの初期データにも反映したい場合は、`schema.sql` にも同じ設定を追加します。

### `schema.sql`

Supabase用のテーブル、初期データ、RLSポリシーをまとめたSQLです。

含まれるもの:

- `companies`
- `jobs`
- `skills`
- `job_skills`
- `dictionary_terms`
- `dictionary_categories`
- `company_parser_configs`
- 初期会社別パーサ設定
- 初期スキル/資格辞書
- RLSポリシー

新しいSupabase環境を作る場合は、このファイルをSQL Editorで実行します。

### `supabase-config.json`

Supabase接続情報です。

形式:

```json
{
  "supabase": {
    "url": "https://example.supabase.co",
    "key": "anon-key"
  }
}
```

anon keyはブラウザから読まれる前提の公開キーです。ただし、アプリを公開する場合はSupabase側のRLSポリシーやCloudflare Accessなどで利用範囲を管理してください。

### `functions/api/proxy.js`

Cloudflare Pages Functions用の簡易プロキシです。

ブラウザから直接取得できない求人サイトに対して、許可したホストだけサーバー側で取得します。安全のため、`ALLOWED_HOSTS` に入っているホスト以外は `403` になります。

新しいクロール先をプロキシ経由で取得したい場合は、必要に応じて `ALLOWED_HOSTS` にホスト名を追加します。

### `job_icon.png`

ブラウザタブに表示するfaviconです。

### `.agents/`

作業支援用のメタデータ置き場です。アプリ本体の実行には必須ではありません。

## 会社別パーサを追加する流れ

1. `company-parsers.js` の `companies` に会社設定を追加します。
2. `aliases` に表記ゆれを入れます。
3. `headings` に求人票の見出し名を入れます。
4. 必要なら `fixedAnnualIncomeRaw` で固定年収を設定します。
5. 必要なら `crawler.js` に公式サイト専用の解析関数を追加します。
6. Supabase初期化にも反映する場合は `schema.sql` の `company_parser_configs` seed に追加します。

対応済みの例:

- NTTデータ
- 富士通
- トヨタシステムズ
- NEC
- アクセンチュア
- 野村総合研究所
- トヨタ自動車
- 日本IBM

## データ保存

Supabaseが利用できる場合はSupabaseに保存します。利用できない場合はIndexedDBに保存します。

Supabase保存では求人本体とスキルを分けて保存します。スキルは辞書に登録されている語だけが保存対象になります。抽出したい語が保存されない場合は、設定画面のスキル辞書に追加してください。

## クロール時の注意

採用サイトによっては、CORS、JavaScript必須、bot確認、ログイン制限などによりブラウザやプロキシから本文を取れない場合があります。

その場合の対応:

- 直接入力画面に求人票本文を貼り付ける
- `company-parsers.js` に見出しルールを追加する
- `functions/api/proxy.js` の許可ホストを追加する
- `crawler.js` に専用解析やフォールバックを追加する

## 開発メモ

このアプリはビルドなしで動く構成です。基本的にはHTML/CSS/JavaScriptをそのまま編集します。

Cloudflare Pagesで公開する場合:

- Build command: 空
- Build output directory: `/`

ローカルで確認する場合は、静的ファイルとして `index.html` を開くか、任意の簡易HTTPサーバーから配信してください。
