🌐 **Webアプリ：[求人スキル分析アプリを開く](https://jobpostview.gongonticktack.workers.dev/)**

# 求人スキル分析アプリ（job_post）

## 概要

企業の求人情報を取得・整理し、会社、技術スキル、資格などで採用要件を比較するWebアプリです。企業別の解析ルールと辞書を使って求人内容を構造化し、Supabaseまたはブラウザ内DBに保存します。

## 主な機能

- 企業別の公式求人一覧URLからクロール。
- 職務内容、必須・歓迎スキル、資格、勤務地などの整理。
- 求人の検索・絞り込み・編集。
- スキル・資格辞書、企業別パーサー設定の管理。
- Supabase連携とブラウザ内DBへのフォールバック。

## 推奨要件

| 項目 | 環境 |
| --- | --- |
| 閲覧・操作 | JavaScriptとIndexedDB対応の現行ブラウザ |
| 開発・公開 | Node.jsの現行LTS、Wrangler、Cloudflareアカウント |
| 複数端末で共有 | Supabaseプロジェクト |
| クロール | 求人サイトへのインターネット接続、WorkersのプロキシAPI |

## 必要なライブラリ

画面とクローラーはHTML / CSS / JavaScriptで実装されています。SupabaseはREST APIで利用します。npmのビルドは不要で、Workersの実行・公開にはWranglerを使用します。ブラウザ自動テストの追加環境は`tests/run-browser.mjs`を参照してください。

## 使い方

### 起動

リポジトリを取得し、ルートで実行します。

```bash
npx wrangler dev
```

表示されたURLを開きます。公開時は`wrangler.jsonc`の設定を確認して `npx wrangler deploy` を実行します。

### Supabase連携

1. SupabaseのSQL Editorで`schema.sql`を確認・実行します。
2. `supabase-config.json`を次の形式で設定します。

```json
{
  "supabase": {
    "url": "https://YOUR_PROJECT.supabase.co",
    "key": "YOUR_PUBLIC_ANON_KEY"
  }
}
```

3. 求人・辞書・パーサー設定の読み書きが、利用するキーとRLSで許可されているか確認します。

設定を読み込めない場合はブラウザ内DBで動作します。ブラウザ内DBは端末・ブラウザごとの保存なので、共有DBと混同しないでください。ブラウザに配信する設定へservice_roleキーを入れないでください。

### 求人を取得・分析

1. クロール画面で企業を選択します。
2. 自動入力された公式求人一覧URLを確認します。必要なら変更します。
3. 開始ボタンで取得します。
4. 求人の内容・必須条件・歓迎条件を確認し、解析結果を修正します。
5. 企業、スキル、資格などで絞り込んで比較します。

## フォルダ構成

| 相対パス | 役割 |
| --- | --- |
| `index.html`、`styles.css` | 画面とデザイン |
| `app.js` | 求人表示・検索・編集・DB連携 |
| `crawler.js` | 求人ページの取得と解析 |
| `company-parsers.js` | 企業別URL・解析ルール |
| `functions/api/proxy.js` | クロール用プロキシ |
| `worker.js` | API振分けと静的ファイル配信 |
| `schema.sql` | Supabaseテーブルとポリシー |
| `supabase-config.json` | DB接続先 |
| `scripts/` | データ監査・整理・復旧などの運用補助 |
| `tests/` | アプリ・プロキシ・ブラウザの確認 |
| `wrangler.jsonc` | Workers設定 |

## 仕組み

ブラウザがWorkersの`POST /api/proxy`経由で求人ページを取得します。企業別ルールで本文を取り出し、辞書と照合してスキル・資格を整理します。保存データをブラウザで検索・比較します。

## 確認方法

```bash
node --test tests/app.test.mjs tests/proxy.test.mjs
```

本番確認やデータ整理スクリプトは対象環境を確認してから使用してください。`scripts/`には削除・置換を伴う処理もあります。

## トラブル対処

- クロール失敗：Workers経由で起動しているか、対象サイトが応答しているか、企業のURL・パーサー設定を確認します。
- 求人内容が欠ける：サイト構造が変わった可能性があります。元ページと解析結果を照合します。
- 別端末でデータが見えない：ブラウザ内DBで動作していないか確認します。
- Supabaseへの保存失敗：テーブル定義とRLS、Networkのエラーレスポンスを確認します。

取得対象サイトの利用条件を確認し、取得頻度を調整してください。
