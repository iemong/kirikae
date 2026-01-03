# KIRIKAE 仕様書（最終版 v1.0）

## 1. 目的

本ツールは、`git worktree` を用いた並行開発環境において、 複数起動している local dev server を **1つの固定URL経由で即座に切り替えて確認**するための開発用プロキシである。

- ブラウザの URL / Cookie / ログイン状態を固定する
- 「どの worktree を見ているか」を意識せず切り替えられる
- 自動化・検出は行わず、**手動入力で確実に運用**する

本仕様は「最短で実用」「壊れにくい」「あとから拡張できる」を優先する。

---

## 2. 全体構成

```
Browser
  |
  |  http://localhost:{PROXY_PORT}
  v
[ Hono Proxy Server ]
  |
  |  (active environment)
  v
[ Dev Server (worktree) ]
  http://localhost:4xxx
```

- ブラウザは常に `http://localhost:{PROXY_PORT}` にアクセス
- プロキシが現在アクティブな dev server（エンバイロメント）に全リクエストを転送
- 転送先は管理画面から **手動で切り替える**

---

## 3. 使用技術

- Runtime: **Bun**
- Framework: Hono
- 通信:
  - HTTP Reverse Proxy
  - WebSocket Proxy（HMR 対応）
- 管理画面:
  - Hono が返す静的 HTML
  - JavaScript 極小（基本不要）
- 永続化:
  - ローカル JSON ファイル（Bun の fs で読み書き）

---

## 4. ポート設計

### 4.1 プロキシサーバー

- 待ち受けポートは **可変**
- 起動時に環境変数で指定する

```
PROXY_PORT=3333 bun run proxy.ts
```

- デフォルト値（フォールバック）: `3200`
- 本仕様上の正は `PROXY_PORT`

---

### 4.2 worktree dev server

- 使用ポート帯: **4000–4999（推奨）**
- 完全に手動指定

例:

```
worktree A → 4001
worktree B → 4002
```

- プロキシ側は port の意味付け・検証を行わない

---

## 5. 機能仕様

### 5.1 Reverse Proxy

- `http://localhost:{PROXY_PORT}/*` へのリクエストを 現在設定されている environment URL に転送する

対応内容:

- HTTP 各メソッド（GET / POST / PUT / DELETE 等）
- Header 転送（Host は上流に合わせて調整）
- Redirect の Location ヘッダ書き換え（最小限）
- WebSocket Upgrade 対応（Vite / Next の HMR を想定）

---

### 5.2 管理画面

#### URL

```
GET /__/
```

#### 表示内容

- 現在のアクティブな environment URL（選択中のものが明確に見えること）
- Add Environment フォーム（Name / URL 必須）
- Saved Environments 一覧（ラベル付き）
  - 各行に Activate / Save / Delete / Open

#### 挙動

- 一覧の Activate でエンバイロメントを切り替える
- 切替後は管理画面にリダイレクト
- dev server の起動・停止は行わない
- 切替直後に HMR が不安定な場合は利用者がリロードで対応

---

### 5.3 管理 API

#### 現在状態取得

```
GET /__/status
```

レスポンス例:

```json
{
  "target": "http://localhost:4002"
}
```

#### environment 切り替え（API パラメータ名は `target` のまま）

```
POST /__/switch
```

- Content-Type:
  - `application/x-www-form-urlencoded`
  - `application/json`

Body 例:

```json
{
  "target": "http://localhost:4003"
}
```

---

### 5.4 エンバイロメント保存（ラベル付き・永続化）

本機能は「最近使った履歴」ではなく、**利用者が手で管理する登録リスト**を提供する。

#### データモデル

- `id`: string（ユニーク。生成は UUID 相当でよい）
- `label`: string（表示名。Name として扱う）
- `url`: string（例: `http://localhost:4002`）
- `createdAt`: ISO8601
- `updatedAt`: ISO8601

#### 永続化ストレージ

- JSON ファイルに保存する
- 保存場所（いずれか）:
  - `PROXY_DATA_DIR` がある場合: `{PROXY_DATA_DIR}/targets.json`
  - ない場合: `./.proxy-data/targets.json`

#### API

登録・編集・削除は管理画面から行う。API は内部用途として提供する。

- 一覧取得

  ```
  GET /__/targets
  ```

- 追加

  ```
  POST /__/targets
  { "label": "feature/login", "url": "http://localhost:4002" }
  ```

- 更新

  ```
  PUT /__/targets/:id
  { "label": "feature/login", "url": "http://localhost:4002" }
  ```

- 削除

  ```
  DELETE /__/targets/:id
  ```

---

## 6. 非対応・やらないこと（v1.0）

- dev server の自動検出
- worktree フォルダとの自動紐付け
- port 生存チェック（疎通確認や自動掃除）
- 起動・停止管理
- 複数エンバイロメントの同時表示
- 認証・アクセス制御
- 「最近使った履歴」の自動記録（※代わりに手動登録リストを提供）

---

## 7. 想定ユースケース

```
# プロキシ起動
PROXY_PORT=3333 node proxy.ts

# worktree A
npm run dev -- --port 4001

# worktree B
npm run dev -- --port 4002
```

- 管理画面: `http://localhost:3333/__/`
- アプリ確認: `http://localhost:3333`
- worktree を切り替えながら UI / 挙動を確認

---

## 8. 運用上の注意

- 本ツールは **開発用途限定**
- 指定したエンバイロメントが停止している場合、プロキシはエラーを返す
- HMR 不整合はページリロードで解消する前提
- プロキシポートは個人・業務事情に合わせて自由に変更してよい

---

## 9. 今後の拡張候補（参考）

- エンバイロメントの疎通チェック（生存確認）
- worktree 自己申告ファイル連携（`.devserver.json` 等）
- worktree 名 / branch 名の表示
- ワンクリック切替用の URL パラメータ対応（管理画面を開かず切替）

---

## 10. 設計上の思想（非機能要件）

- 自動化より **確実性**
- 魔法より **可視性**
- 一時的な快適さより **長期の理解しやすさ**

このツールは「賢く振る舞わない」ことを価値とする。
