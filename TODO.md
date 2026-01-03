# TODO

- [x] 用語統一（target → environment）をコード全体に反映（APIパラメータ名は互換のため維持）
- [x] Admin画面をJSX化（`src/admin.ts` → `src/admin.tsx`）
- [x] 管理画面のHTML/CSSを分割・整理（コンポーネント分割）
- [x] HTTP/WSの共通処理抽出（URL/ヘッダー/selection判定の共通化）
- [x] ユーザー向けメッセージの統一（日本語/英語の混在解消）
- [x] ストア永続化の安全性向上（原子的書き込み or 書き込みキュー）
- [ ] バリデーションの集約（normalize処理をStore側へ寄せる）
- [ ] ルーティングとロジック分離（ハンドラの切り出し）
- [ ] ultracite導入（lint/format/checkのスクリプト整備）
- [ ] 最低限のテスト導入（純関数のユニットテスト）
- [ ] 設定の集約（configの一元化）
