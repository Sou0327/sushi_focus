# 実装品質ルール

## 禁止事項

- 空実装（`// TODO` のみの関数）でタスクを完了扱いにしない
- `any` 型の乱用禁止（TypeScript strict mode）
- `console.log` デバッグを本番コードに残さない

## 必須事項

- TypeScript strict mode に従う
- ESM モジュールを使用（`"type": "module"`）
- エラーハンドリングは適切に実装
- Chrome API 呼び出しは try-catch でラップ
