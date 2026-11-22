# V1_3 更新檔案清單

基底：V1_1。這是獨立新版本，未包含 V1_2 訪客功能。不要只覆蓋 index.html。

## 前端部署 GitHub Pages

將以下檔案放 repository 根目錄：

- `index.html`
- `style.css`
- `app.mjs`
- `core.mjs`
- `drive.mjs`
- `sync-state.mjs`
- `auth-session.mjs`
- `auth-config.json`
- `search-worker.js`
- `sw.js`
- `manifest.webmanifest`
- `version.json`
- `icon.svg`
- `icon-192.png`
- `icon-512.png`
- `.nojekyll`
- `README.md`
- `CHANGELOG.md`
- `AUTH-SETUP.md`
- `UPDATE-FILES.md`

## 授權服務部署 Cloudflare

`auth-worker.mjs`、`auth-schema.sql`、`wrangler.auth.toml`。依 AUTH-SETUP.md 建立與設定；這些檔案放 GitHub Pages 不會自動產生後端服務。

## 測試（留本機即可）

`tests.mjs`、`tests-auth.mjs`、`tests-integration.mjs`。Node.js 24，逐一執行。

## 相較 V1_1 修改

- `tests.mjs`
- `CHANGELOG.md`
- `README.md`
- `app.mjs`
- `core.mjs`
- `drive.mjs`
- `index.html`
- `sw.js`
- `version.json`

## 相較 V1_1 新增

- `AUTH-SETUP.md`
- `UPDATE-FILES.md`
- `auth-config.json`
- `auth-schema.sql`
- `auth-session.mjs`
- `auth-worker.mjs`
- `tests-auth.mjs`
- `tests-integration.mjs`
- `wrangler.auth.toml`

## 從 V1_2 更新

移除 `guest.mjs`、`guest-config.json`、`tests-guest.mjs`、`GUEST-SETUP.md`。不刪除 Google Drive 的圖片、`_meme_data` 與備份。本機原帳號資料格式不變，使用原帳號連線即可接續。
