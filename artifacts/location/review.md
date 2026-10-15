# 勤務地の修正（2026-10-15）

- DBの1,203件を確認。勤務地欄のみ212件修正し、全件再取得でID・件数・修正値・対象外の勤務地が一致することを確認した。
- `before.json` は修正前、`changes.json` は差分、`after.json` は検証後の値。
- 応募導線、参考URL、連絡先、職種名の混入を除去。ID 916 は保存済みの公式求人原文を確認して「東京（高輪）／大阪／名古屋」に復元。
- 都道府県フィルタは都市名の英語・日本語表記と特定の拠点名を統合。複数勤務地の求人は該当する各都道府県に含む。「全国・広域」「海外」は別候補にした。県を特定できない新規データは「地域未取得」とする。
- 出張先・将来の海外赴任はフィルタ判定から除外。求人の詳細な勤務地記載と保存済み原文は保持する。
- ローカル画面で神奈川県334件への絞り込みを確認。画面の変更は未デプロイ。
- 自動テスト25件成功。

拠点名の確認元：

- https://global.fujitsu/ja-jp/about/corporate/facilities/kawasaki
- https://global.fujitsu/ja-jp/subsidiaries/fjj/about/facilities
- https://global.fujitsu/ja-jp/about/corporate/facilities/factories
- https://global.fujitsu/ja-jp/about/corporate/facilities/branches7
- https://www.nttdatabs.co.jp/company/access.html

再検証：`node scripts/review-locations.mjs --verify`
