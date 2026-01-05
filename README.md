# KIRIKAE

`git worktree` で並行稼働させた複数の dev server（エンバイロメント）を、1 つの固定 URL 経由で切り替えるためのローカル開発用リバースプロキシです。ブラウザの URL や Cookie を保ったまま、対象サーバーだけを切り替えられます。プロキシ本体と管理 UI/API は別ポートで待ち受けるため、フロントエンドのルーティングと干渉しません。

## インストール

```bash
# 直接実行（インストール不要）
bunx jsr:@iemong/kirikae

# グローバルインストール
bun add -g jsr:@iemong/kirikae
kirikae
```

### 開発版（ソースから）

```bash
bun install
bun run proxy.ts
```

## 起動方法

```bash
# 環境変数でポートを指定
PROXY_PORT=3333 PROXY_ADMIN_PORT=3334 kirikae
```

- 管理画面: `http://localhost:{PROXY_ADMIN_PORT}/`
- プロキシ経由でアプリ確認: `http://localhost:{PROXY_PORT}`

### 環境変数

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `PROXY_PORT` | `3200` | プロキシが待ち受けるポート番号 |
| `PROXY_ADMIN_PORT` | `4000` | 管理UI / 管理API が待ち受けるポート番号 |
| `PROXY_DATA_DIR` | `~/.kirikae` | エンバイロメント一覧を保存するディレクトリ |

## 主な機能

- HTTP/WS 両対応のリバースプロキシ（header 転送・リダイレクト書き換え）
- 管理画面からのエンバイロメント切り替え / 追加 / 編集 / 削除
- ローカル JSON ファイルへのエンバイロメント永続化
- 管理 API からの直接切り替え（`target` / `targetId` を指定）

## 管理 API

| メソッド | パス | 説明 |
| --- | --- | --- |
| `GET` | `/status` | 現在アクティブな environment URL |
| `POST` | `/switch` | `target` または `targetId` を指定して切り替え |
| `GET` | `/targets` | 登録済みエンバイロメントの一覧 |
| `POST` | `/targets` | エンバイロメントを追加（`label`, `url`） |
| `PUT` | `/targets/:id` | 既存エンバイロメントを更新 |
| `DELETE` | `/targets/:id` | エンバイロメントを削除 |

## リリース

Changesets と CI を使った自動リリースです。

```bash
# 1. 変更内容を作成
bun run changeset

# 2. バージョン更新
bun run changeset:version

# 3. タグ作成＆push → CI が JSR に自動公開
git tag v1.0.0
git push origin v1.0.0
```

## データファイル

- 既定: `~/.kirikae/environments.json`
- `PROXY_DATA_DIR` を指定すると `{PROXY_DATA_DIR}/environments.json`
