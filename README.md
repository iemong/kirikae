# KIRIKAE

`git worktree` で並行稼働させた複数の dev server（エンバイロメント）を、1 つの固定 URL 経由で切り替えるためのローカル開発用リバースプロキシです。ブラウザの URL や Cookie を保ったまま、対象サーバーだけを切り替えられます。プロキシ本体と管理 UI/API は別ポートで待ち受けるため、フロントエンドのルーティングと干渉しません。

## 必要要件

- Bun 1.1 以降

依存関係は初回のみインストールしてください。

```bash
bun install
```

## 起動方法

```bash
# 例: プロキシを 3333 番ポート、管理UIを 3334 番で起動
PROXY_PORT=3333 PROXY_ADMIN_PORT=3334 bun run proxy.ts
```

- 管理画面: `http://localhost:{PROXY_ADMIN_PORT}/`
- プロキシ経由でアプリ確認: `http://localhost:{PROXY_PORT}`

### 環境変数

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `PROXY_PORT` | `3200` | プロキシが待ち受けるポート番号 |
| `PROXY_ADMIN_PORT` | `4000` | 管理UI / 管理API が待ち受けるポート番号 |
| `PROXY_DATA_DIR` | `./.proxy-data` | エンバイロメント一覧を保存するディレクトリ |

## 主な機能

- HTTP/WS 両対応のリバースプロキシ（header 転送・リダイレクト書き換え）
- 管理画面からのエンバイロメント切り替え / 追加 / 編集 / 削除
- ローカル JSON ファイルへのエンバイロメント永続化
- 管理 API からの直接切り替え（`target` / `targetId` を指定）

## 管理 API

| メソッド | パス | 説明 |
| --- | --- | --- |
| `GET` | `/status` | 現在アクティブな environment URL |
| `POST` | `/switch` | `target` または `targetId` を指定して切り替え（パラメータ名は従来のまま） |
| `GET` | `/targets` | 登録済みエンバイロメントの一覧 |
| `POST` | `/targets` | エンバイロメントを追加（`label`, `url`） |
| `PUT` | `/targets/:id` | 既存エンバイロメントを更新 |
| `DELETE` | `/targets/:id` | エンバイロメントを削除 |

`POST /switch` などは `application/json` / `application/x-www-form-urlencoded` の両方に対応しています。管理画面からは追加のヘルパーとして `POST /targets/:id/update` / `POST /targets/:id/delete` を使用しています。

## データファイル

- 既定: `./.proxy-data/targets.json`
- `PROXY_DATA_DIR` を指定すると `{PROXY_DATA_DIR}/targets.json`

ファイルは `.gitignore` 済みなので、各環境で独立して管理できます。

## 開発メモ

- プロキシはエンバイロメントの死活監視や自動検出を行いません。切り替え後に dev server 側でエラーになった場合は各自で対応してください。
- WebSocket(HMR) は Upgrade リクエストをそのまま転送するだけのシンプルな構成です。
