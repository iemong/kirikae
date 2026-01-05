# KIRIKAE

`git worktree` で並行稼働させた複数の dev server（エンバイロメント）を、1 つの固定 URL 経由で切り替えるためのローカル開発用リバースプロキシです。ブラウザの URL や Cookie を保ったまま、対象サーバーだけを切り替えられます。プロキシ本体と管理 UI/API は別ポートで待ち受けるため、フロントエンドのルーティングと干渉しません。

## インストール

### JSR から（推奨）

```bash
# 直接実行（インストール不要）
bunx jsr:@iemong/kirikae

# グローバルインストール
bun add -g jsr:@iemong/kirikae
kirikae
```

### バイナリ版

GitHub Releases から OS に応じたバイナリをダウンロードして実行できます。

### 開発版（ソースから）

- Bun 1.1 以降

依存関係は初回のみインストールしてください。

```bash
bun install
```

## 起動方法

```bash
# JSR からインストールした場合
PROXY_PORT=3333 PROXY_ADMIN_PORT=3334 kirikae

# 開発版の場合
PROXY_PORT=3333 PROXY_ADMIN_PORT=3334 bun run proxy.ts
```

- 管理画面: `http://localhost:{PROXY_ADMIN_PORT}/`
- プロキシ経由でアプリ確認: `http://localhost:{PROXY_PORT}`

## バイナリ化（実行ファイル）

ローカル環境で単体バイナリにする場合は以下を使います。

```bash
bun run build:binary
```

生成物:
- `./dist/kirikae`

実行例:

```bash
PROXY_DATA_DIR="$HOME/.kirikae" PROXY_PORT=3333 PROXY_ADMIN_PORT=3334 ./dist/kirikae
```

注意点:
- バイナリは **OS/CPUごとにビルドが必要** です（macOS Intel / Apple Silicon など）。
- 書き込み先に権限が必要なので、`PROXY_DATA_DIR` の指定を推奨します。

## 配布用バイナリセット（GitHub Releases向け）

複数プラットフォーム向けのビルドとアーカイブ作成は以下を使います。

```bash
bun run build:release
```

生成物（`./release`）:
- `kirikae-darwin-arm64.tar.gz`
- `kirikae-darwin-x64.tar.gz`
- `kirikae-linux-x64.tar.gz`
- `kirikae-linux-arm64.tar.gz`
- `kirikae-windows-x64.zip`
- `SHA256SUMS`

GitHub Releasesへアップロードする場合:

```bash
RELEASE_TAG=v1.0.0 bun run release:publish
```

※ `gh` (GitHub CLI) が必要です。

## リリース管理

### JSR への公開

1) バージョン更新
```bash
# jsr.json と package.json のバージョンを手動で更新
```

2) JSR に公開
```bash
bun run publish:jsr
```

### Changesets（バイナリリリース用）

Changesets を導入しています。基本フローは以下です。

1) 変更内容を作成
```bash
bun run changeset
```

2) バージョン更新（`package.json` / `CHANGELOG.md` 生成）
```bash
bun run changeset:version
```

3) タグ作成＆push（例）
```bash
git tag v1.0.0
git push origin v1.0.0
```

タグpushで CI が GitHub Release を作成します。

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
| `POST` | `/switch` | `target` または `targetId` を指定して切り替え（パラメータ名は従来のまま） |
| `GET` | `/targets` | 登録済みエンバイロメントの一覧 |
| `POST` | `/targets` | エンバイロメントを追加（`label`, `url`） |
| `PUT` | `/targets/:id` | 既存エンバイロメントを更新 |
| `DELETE` | `/targets/:id` | エンバイロメントを削除 |

`POST /switch` などは `application/json` / `application/x-www-form-urlencoded` の両方に対応しています。管理画面からは追加のヘルパーとして `POST /targets/:id/update` / `POST /targets/:id/delete` を使用しています。

## データファイル

- 既定: `~/.kirikae/environments.json`
- `PROXY_DATA_DIR` を指定すると `{PROXY_DATA_DIR}/environments.json`
- 互換: 旧ファイル `targets.json` が存在し、`environments.json` がない場合は旧ファイルを優先
- 互換: 旧既定ディレクトリ `./.proxy-data` にデータがある場合はそちらを優先

ファイルは `.gitignore` 済みなので、各環境で独立して管理できます。

## 開発メモ

- プロキシはエンバイロメントの死活監視や自動検出を行いません。切り替え後に dev server 側でエラーになった場合は各自で対応してください。
- WebSocket(HMR) は Upgrade リクエストをそのまま転送するだけのシンプルな構成です。
