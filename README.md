# Local Dev Proxy Switcher

`git worktree` で並行稼働させた複数の dev server を、1 つの固定 URL 経由で手動スイッチするためのローカル開発用リバースプロキシです。ブラウザの URL や Cookie を保ったまま対象サーバーだけを切り替えられます。

## 必要要件

- Bun 1.1 以降

依存関係は初回のみインストールしてください。

```bash
bun install
```

## 起動方法

```bash
# 例: プロキシを 3333 番ポートで起動
PROXY_PORT=3333 bun run proxy.ts
```

- 管理画面: `http://localhost:{PROXY_PORT}/__/`
- プロキシ経由でアプリ確認: `http://localhost:{PROXY_PORT}`

### 環境変数

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `PROXY_PORT` | `3200` | プロキシが待ち受けるポート番号 |
| `PROXY_DATA_DIR` | `./.proxy-data` | ターゲット一覧を保存するディレクトリ |

## 主な機能

- HTTP/WS 両対応のリバースプロキシ（header 転送・リダイレクト書き換え）
- 管理画面からのターゲット切り替え / 追加 / 編集 / 削除
- ローカル JSON ファイルへのターゲット永続化
- 手動入力による即時スイッチ（保存済みターゲット以外も指定可能）

## 管理 API

| メソッド | パス | 説明 |
| --- | --- | --- |
| `GET` | `/__/status` | 現在アクティブな target URL を返却 |
| `POST` | `/__/switch` | `target` または `targetId` を指定して切り替え |
| `GET` | `/__/targets` | 登録済みターゲットの一覧 |
| `POST` | `/__/targets` | ターゲットを追加（`label`, `url`） |
| `PUT` | `/__/targets/:id` | 既存ターゲットを更新 |
| `DELETE` | `/__/targets/:id` | ターゲットを削除 |

`POST /__/switch` などは `application/json` / `application/x-www-form-urlencoded` の両方に対応しています。管理画面からは追加のヘルパーとして `POST /__/targets/:id/update` / `POST /__/targets/:id/delete` を使用しています。

## データファイル

- 既定: `./.proxy-data/targets.json`
- `PROXY_DATA_DIR` を指定すると `{PROXY_DATA_DIR}/targets.json`

ファイルは `.gitignore` 済みなので、各環境で独立して管理できます。

## 開発メモ

- プロキシはターゲットの死活監視や自動検出を行いません。切り替え後に dev server 側でエラーになった場合は各自で対応してください。
- WebSocket(HMR) は Upgrade リクエストをそのまま転送するだけのシンプルな構成です。
