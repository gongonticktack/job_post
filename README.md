# 求人スキル分析アプリ

2026-10-12 更新:

- クロール画面は企業名を先頭に表示します。企業を選ぶと公式求人一覧URLが自動入力され、開始ボタンだけで取得できます。URLの手動変更も可能です。
- NTTデータの資格・語学欄を保持し、他社では直接入力と同じ企業別パーサーを使用します。HTMLの改行を保持し、必須・歓迎の区切りを解析します。
- 同じ内容（会社、職種、本文、年収、勤務地、資格、スキルなど）は追加しません。取得日時と追跡用URLパラメータは重複判定から除外します。同じURLの内容変更、または会社・職種・勤務地が同じ直接入力の変更は既存レコードを上書きし、古いスキルの紐付けも置き換えます。登録結果に新規・更新・スキップ件数を表示します。
- Supabase保存に失敗した場合は失敗を表示します。保存できたように見えるローカルDBへの切り替えは行いません。
- 実取得確認済み: NTTデータ、富士通、NEC、野村総合研究所、トヨタ自動車、トヨタシステムズ、アクセンチュア。IBMは日本の一覧検索APIに対応していますが、詳細が空のHTTP 202を返す場合は保存せず、直接入力が必要です。

企業別の公式取得先は `company-parsers.js` の `listUrl` にまとめています。トヨタシステムズは[公式採用ページ](https://www.toyotasystems.com/recruit/career/)の求人一覧から確認した公開HTML版を利用し、NRIは[公式キャリアサイト](https://career.nri.co.jp/)の求人一覧を利用します。

検証: `node --test tests/app.test.mjs tests/proxy.test.mjs`、`node tests/run-browser.mjs`。外部接続を含む7社の取得確認は `node tests/run-browser.mjs --live`（実データの保存は行いません）。

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

Cloudflare Workersでは `worker.js` が同じ `/api/proxy` を提供します。静的ファイルだけをWorkersへアップロードするとAPIは404になるため、下記のWrangler設定でWorkerと静的ファイルをまとめて配信してください。取得したHTMLはHTTPヘッダーまたはmetaタグの文字コードで読み込み、NTTデータのEUC-JPにも対応します。プロキシは元のバイト列を維持します。

初期入力には、求人リンクがHTMLに含まれるNTTデータの公開一覧 `https://nttdata-career.jposting.net/u/job.phtml?job_category_code=34` を使っています。`/joblist/` の検索画面はJavaScriptで求人を表示するため、このクローラーでは一覧として取得できません。ブラウザで `index.html` を直接開いた場合、外部サイトのCORS制限によりURL取得が失敗することがあります。URL取得を利用する場合はCloudflare Pages Functionsを含めて配信してください。

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
4. 年収は求人原文に記載された値だけを抽出します。会社単位の固定値は使いません。
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

スキル・資格は応募条件の原文から抽出し、`skillAliases` と資格の別名ルールで同義語を統合します（K8s→Kubernetes、PM→プロジェクトマネジメントなど）。「開発・設計・導入」のような単独の汎用語、職種や製品を誤認した資格、文字化けした辞書項目は表示対象から外します。必須・歓迎の同じ項目は必須側にまとめ、AWSなどの具体名がある場合は汎用の「クラウド」を省きます。資格は種類やレベルを区別し、TOEICの条件は点数・「以上」を保持します。統合前の原文は保持します。

設定画面はスキル・資格・カテゴリ・求人管理の4タブです。辞書は名前・別名検索、カテゴリ、使用中/未使用、使用件数順で探せます。フィルターで非表示の行も保存対象に含め、未保存の編集は画面を切り替えても保持します。「表記・重複を整理」は編集内容を整える操作で、「変更を保存」でDBへ反映します。求人管理には企業・キーワード検索と25件ずつのページ送りを備えます。辞書保存は新しい語を先に保存してから古い語を削除し、1,000件を超える求人にも適用します。

一括整理はバックアップ後、`node scripts/recover-requirements.mjs --organize` で保存済みHTML/API資料をオフラインで再解析し、応募条件が再抽出できない場合は保存済みの条件原文を使います。`node scripts/apply-taxonomy.mjs` で計画を確認し、`--apply` で辞書・抽出項目・スキル紐づけを更新します。全求人の原文・記載年収・推定年収・基本情報の保持と、紐づけを検証してから旧表記や未使用行を削除します。IBMの見出しが失われたAPI全文など、条件区分の判定根拠がない資料は必須・歓迎を推測しません。

年収未取得の求人には、`company-parsers.js` の `incomeBenchmarks` に記録した社員給与投稿の公開集計から参考年収を推定します。求人名から職種を判断できる場合は職種別平均、複数職種・不明な職種・10件未満の集計は会社平均を使用し、50万円単位に丸めた中心値の前後200万円を表示します。この幅は誤差の保証や統計的な信頼区間ではありません。インターンと未調査企業は推定しません。元の求人票年収は変更せず、`reference_info` のJSON内に独立した `salaryEstimate` として根拠・件数・確認日・推定方式を保存します。

一覧は「推定」の表記で区別し、詳細で出典と算出根拠を確認できます。年収絞り込み・並べ替え・平均年収は推定レンジも使い、平均には「推定含む」と表示します。再クロールで求人票に数値が載った場合はそちらを優先し、推定を外します。ベンチマークは2026年10月12日にOpenMoneyの公開ページを確認したスナップショットで、自動更新ではありません。登録済み求人への保存はバックアップ後に `node scripts/estimate-income.mjs` で計画を確認し、`--apply` で反映します。反映時はバックアップ後の変更を検知し、記載年収と原文が保持されていることを全件検証します。

求人全文は抽出結果と一緒にDBへ保存します。HTML求人は求人本文のテキストと再解析用HTML、IBM・アクセンチュアは公式APIの元データと全文テキストを保存し、取得元URL・取得日時も記録します。直接入力は入力全文を保存します。

既存DBとの互換性のため、`jobs.reference_info` のTEXT列に `JOB_SOURCE_ARCHIVE_V1\n` で始まるJSONを格納します。JSONは従来の応募条件原文 `referenceInfo` と、`format`・`fullText`・`html`または`data`・`sourceUrl`・`fetchedAt`を持つ `sourceDocument` で構成します。従来のプレーンテキストも読めるため、SQLマイグレーションは不要です。画面ではJSONを表示せず、求人詳細の「保存した求人全文」で本文を確認できます。

設定の「保存した全文から再解析」は保存済み資料に現在のパーサーと辞書を適用し、同じ求人IDの抽出結果・スキル紐づけを更新します。元の全文は保持するため、取得項目や抽出ルールを変更しても再クロールせず再処理できます。新しい項目を追加する場合はパーサー・画面・DBの出力項目も追加してください。

登録8社の募集中求人への一括入れ替えは、`node scripts/audit-data.mjs --summary` でバックアップし、`node scripts/recover-requirements.mjs --replace` で全社の公式一覧・本文を収集します。`node scripts/apply-replacement.mjs` で件数・営業除外・IT判定・全文を検証した後、`--apply` を付けて反映します。新しい求人の全文とスキル紐づけをDBで検証してから、入れ替え対象の旧求人を削除します。同じURLは更新し、収集失敗やバックアップ後の変更を検出した場合は停止します。収集結果・計画・反映結果も `.data-backups/` に保存します。

営業職はIT営業・アカウント担当・プリセールスを含め、クローリングの保存対象から除外します。「営業領域のアプリケーション開発」のように顧客側の業務領域が営業である開発職は残します。既存データの削除は変更前バックアップと `scripts/delete-sales.mjs` の計画を確認し、`--apply` で実行します。

スキルは必須・歓迎の応募条件から抽出し、業務内容だけに出てくる技術を必須とは扱いません。応募条件の原文は `reference_info` に保存して再整理に使います。資格欄は条件から認識した資格名だけを保存し、SAP S/4HANAなどの製品名や職種としてのプロジェクトマネージャは資格と区別します。クローリング時は制作職中心の3DCGアーティスト、事務中心のBPOなど明確なIT関連外を除外し、判定が曖昧な求人は残します。

管理用の `scripts/audit-data.mjs` はSupabaseの変更前データを `.data-backups/` に保存します。`scripts/recover-requirements.mjs` は保存済み求人とタイトルが一致する公式ページの条件を再取得し、`scripts/clean-data.mjs` は修復計画のみを作ります。`--apply` は計画を反映するため、実行前に最新のバックアップと計画を確認してください。反映時はバックアップ後に変更された求人があれば停止し、更新内容とスキルの紐づけを検証します。バックアップは公開対象・Git管理対象から除外しています。

Supabaseが利用できる場合はSupabaseに保存します。利用できない場合はIndexedDBに保存します。

Supabase保存では求人本体とスキルを分けて保存します。スキルは辞書に登録されている語だけが保存対象になります。抽出したい語が保存されない場合は、設定画面のスキル辞書に追加してください。

## クロール時の注意

求人一覧は職種・企業、年収、勤務地、必須スキル、資格を並べて比較する画面です。左側のスキル・資格・企業、年収範囲、地域選択と検索を組み合わせて絞り込めます。選択中の条件は一覧上部から個別に解除でき、「すべて解除」でまとめて戻せます。勤務地が複数ある求人は各地域で検索対象になり、未取得の勤務地も区別します。職務内容・歓迎スキル・補足は詳細を開いて確認できます。スマホでは条件欄を「絞り込み条件」から開きます。

クローリング画面は企業名を最初に選択します。企業変更時に `company-parsers.js` の `listUrl` が入力され、そのまま「クロール開始」で取得できます。「直接入力」では企業名とURLを自由に入力できます。画面の再描画では手動変更したURLを維持します。

設定済みの求人一覧（2026年10月12日確認）:

| 企業 | 求人一覧 |
| --- | --- |
| NTTデータ | https://nttdata-career.jposting.net/u/job.phtml?job_category_code=34 |
| 富士通 | https://www.jobs.global.fujitsu.com/?locale=ja_JP |
| 日本IBM | https://www.ibm.com/jp-ja/careers/search |
| トヨタ自動車 | https://toyota-career.snar.jp/index.aspx |
| トヨタシステムズ | https://js03.jposting.net/toyotasystems/u/job.phtml |
| NEC | https://jobs.nec-careers.com/u/job.phtml |
| アクセンチュア | https://www.accenture.com/jp-ja/careers/jobsearch |
| 野村総合研究所 | https://progres07.jposting.net/pgnri/u/job.phtml |

富士通・IBM・アクセンチュアは公式求人検索API、トヨタ自動車は求人一覧のフォーム遷移、それ以外は一覧の詳細リンクから取得します。IBMの詳細HTMLはアクセス制限があるため、公式検索APIの全文 `body` を取得します。APIに項目の区切りがないため、IBMでは必須・歓迎スキルや年収を推測せず空欄とし、詳細条件は元の求人ページで確認します。

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

Cloudflare Workersで公開する場合（現在の `jobpostview` 向け）:

- リポジトリのルートで `npx wrangler deploy` を実行します。
- CloudflareのGit連携では、Build commandを空にし、Deploy commandを `npx wrangler deploy`、Root directoryをこのリポジトリのルートに設定します。
- `wrangler.jsonc` が `worker.js` と静的ファイルを配信し、`/api/*` をWorkerで処理します。`.assetsignore` はブラウザで必要なファイルだけを公開対象にします。
- ローカルでAPIも確認する場合は `npx wrangler dev` を使います。簡易HTTPサーバーだけでは `/api/proxy` は動きません。
- 再配信後、`/api/proxy` へのGETが405（`Allow: POST, OPTIONS`）になり、画面のクロールが成功することを確認します。

Workersの配信設定: https://developers.cloudflare.com/workers/static-assets/binding/

修正確認用テスト:

- `node --test tests/proxy.test.mjs`: Workersのルーティングとプロキシの文字コード維持を確認します。
- `node tests/run-browser.mjs`: Chromeで求人抽出とCORSフォールバックを確認します。Chromeが標準パスにない場合は、第1引数にブラウザ実行ファイルのパスを指定します。
- `node tests/run-browser.mjs --live`: 実際のNTTデータ一覧から2件を取得し、Workerのプロキシ経由で日本語・年収・勤務地を確認します。ネット接続が必要です。
- `node tests/run-browser.mjs --deployed`: 公開サイトから配信された画面コードとAPIを使い、企業選択と8社の求人取得を確認します。テストではSupabase設定を読み込まず、公開データの保存は行いません。
- `node tests/check-production.mjs`: 一括入れ替え後、公開画面で実DBの全件・全文・企業数・地域絞り込みを読み取り検証します。期待件数は `.data-backups/replacement-result.json` を使います。`--local` はローカルの画面コードと実DBを組み合わせます。

ローカルで確認する場合は、静的ファイルとして `index.html` を開くか、任意の簡易HTTPサーバーから配信してください。
