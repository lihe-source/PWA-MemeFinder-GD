# V1_3 持續登入設定

本 PWA 的前端繼續放 GitHub Pages。持續登入由 Cloudflare Worker + D1 處理；一次設定後，不需每次重開 PWA 都登入。本包已提供完整程式，尚未代你建立雲端資源或填入帳號憑證。

## 1. Google Cloud 設定

1. 進入 https://console.cloud.google.com/ ，選擇原本 PWA 使用的專案，確認 Google Drive API 已啟用。
2. Google Auth Platform → Clients → 選原本 **Web application** OAuth Client，可沿用 Client ID。記下 Client ID 與 Client Secret；Secret 只輸入 Cloudflare Secret。
3. Authorized JavaScript origins 保留 `https://lihe-source.github.io`。其他部署網域請改用實際來源。
4. 等第 2 節取得 Worker 網址後，在 **Authorized redirect URIs** 新增完整網址：`https://你的Worker網域/oauth/callback`。不是 GitHub 網址，且路徑和大小寫必須完全一致。
5. Data Access 包含 `https://www.googleapis.com/auth/drive`。本程式需要掃描既有資料夾與寫入備份，因此沿用 V1_1 的 Drive 讀寫範圍；Google 授權涵蓋整個 Drive，程式操作限制於指定資料夾。
6. Audience／Publishing status 若是 External + Testing，Drive refresh token 通常 7 天到期。長期使用須依專案的適用條件設定正式發布與完成必要驗證；發布本身不保證免驗證或永久有效。測試階段需將實際帳號加入 Test users。

## 2. 部署授權服務（電腦操作）

安裝 Node.js 24 LTS，登入 Cloudflare 帳號。開啟終端機／PowerShell，切換到解壓後的資料夾。以下逐行執行：

```sh
npx wrangler login
npx wrangler d1 create memefinder-auth
```

將建立結果的 `database_id` 填入 `wrangler.auth.toml`，保留 `binding = "DB"`。修改下列欄位：

| 欄位 | 填入內容 |
| --- | --- |
| APP_URL | PWA 完整網址，例 `https://lihe-source.github.io/PWA-MemeFinder-GD/` |
| AUTH_URL | Worker 的 HTTPS 網域，例 `https://memefinder-auth.你的子網域.workers.dev`，不加路徑 |
| GOOGLE_CLIENT_ID | 原本 Web application 的 Client ID |
| ALLOWED_EMAILS | 自用建議填你的 Google 信箱；多帳號用逗號分隔。空白允許所有能完成此 Google 專案授權的帳號 |
| database_id | 剛建立的 D1 ID |

Worker 網址的子網域可在 Cloudflare Workers & Pages 查看。若尚未啟用 workers.dev，先在該處設定。`APP_URL` 和 `AUTH_URL` 必須是實際網址；程式會檢查來源，錯誤時不會接受請求。

建立資料表並部署：

```sh
npx wrangler d1 execute memefinder-auth --remote --file=auth-schema.sql --config wrangler.auth.toml
npx wrangler deploy --config wrangler.auth.toml
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.auth.toml
```

第三行提示輸入時，貼入 Google Client Secret。接著在自己的電腦產生加密金鑰：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put TOKEN_ENCRYPTION_KEY --config wrangler.auth.toml
```

將上一步產生的 **64 字元十六進位** 值貼入 Secret 提示。妥善保管，不要貼到 GitHub；後續一般更新沿用此金鑰。任意更換金鑰會使既有加密工作階段無法解密，需重新授權。

完成後開啟 `https://你的Worker網域/health`，應看到 `{"ok":true,"version":"V1_3"}`。此檢查確認設定完整，不代表已驗證 Google 帳號或資料庫操作；首次授權仍需完成。確認 Google redirect URI 與部署輸出的網址一致。

`wrangler.auth.toml` 包含每日清除過期工作階段的排程。圖片與標記仍直接由 PWA 讀寫 Google Drive；Worker 只處理授權，不將圖片放到 D1。

## 3. 接上 PWA

1. 上傳前端檔案到原 GitHub Pages repository，詳見 UPDATE-FILES.md。
2. PWA → 設定 →「持續登入授權服務網址」貼入 Worker 的 HTTPS 網域，不加 `/oauth/callback`。
3. 保留原 Drive 資料夾；勾選「記住這台裝置並自動恢復連線」→ 儲存設定。
4. 按右上「連線 Google」，完成一次授權。iPhone 若在 Safari 開啟授權頁，完成後切回原本的主畫面 PWA；原 PWA 會輪詢取得結果。
5. 重開 PWA，應顯示「已連線 · 名稱」。正常重開與續期不會再開啟 Google 授權頁。

也可在上傳前修改公開的 `auth-config.json`，讓所有裝置預帶服務網址：

```json
{"workerURL":"https://memefinder-auth.你的子網域.workers.dev"}
```

此檔只能放公開服務網址，不能放密鑰或 token。既有裝置的手動設定優先；更換網址時請同步修改 PWA 設定。第一次登入仍需使用者操作授權。

## 4. 確認運作

- 登入後重新載入頁面、關閉再重開：無需再選 Google 帳號。
- 持續開啟超過一小時，再搜尋、下載／上傳或同步：自動續期。
- 斷網後填寫標記、恢復網路：本機資料保留並補同步。
- 在標記編輯中切回前景：原有文字不應被重設。
- 按設定「登出」，再重開：不自動登入；重新按連線才再次啟用。
- 登入流程未完成：設定 → 取消登入流程，再按連線重試。
- 已授權帳號與本機資料帳號不同：先完成未同步工作，再登出切換。每個裝置／瀏覽器各自保存工作階段，不將授權憑證同步到備份。

## 5. 常見問題

| 畫面或現象 | 處理 |
| --- | --- |
| 尚未設定持續登入服務 | 只有原 Client ID 仍是一般登入；需完成 Worker 設定 |
| redirect_uri_mismatch | 將實際 Worker 網域加 `/oauth/callback` 登記於同一個 Google Web Client |
| origin_not_allowed | Worker APP_URL 的來源需與目前開啟 PWA 完全一致，含 HTTPS／主機／連接埠 |
| wrong_service_origin | AUTH_URL 必須等於實際 Worker 網域 |
| service_not_configured | 檢查 DB binding、兩個 Secret、Client ID 與網址；金鑰為 64 字元 hex |
| service_credentials_invalid | Client ID 與 Client Secret 必須屬於同一個 Google OAuth Web Client |
| service_unavailable | 檢查 D1 schema、binding、服務狀態；保留原 TOKEN_ENCRYPTION_KEY |
| account_not_allowed | 將欲登入帳號加入 ALLOWED_EMAILS |
| 每 7 天要求授權 | 檢查 Google Audience／發布狀態是否仍為 External / Testing |
| 授權取消／失效 | 按連線重新授權；本機標記不會刪除 |
| 網路暫時失敗 | 不會清除裝置工作階段；約 30 秒後或回到前景重試 |
| iPhone 授權頁完成但 PWA 等待 | 切回原本安裝的 PWA；不要另開另一個瀏覽器完成設定 |

工作階段在最近使用後延長 90 天；持續使用會延長，不是每 90 天固定登出。Google 仍可撤銷授權。清除網站資料／移除 App 或使用私密模式，不能保證保留登入。瀏覽器在背景休眠時不會強制持續運作，回到前景才恢復連線與同步。

## 6. 憑證與資料儲存

- Google refresh/access token 在 D1 使用 AES-GCM 加密；裝置 session 在伺服器只存雜湊。
- PWA 的 Google access token 只放記憶體；IndexedDB 保存可撤銷的隨機裝置 session，它仍屬敏感登入憑證。請只在信任的裝置啟用記住登入。
- 不依賴第三方 Cookie。授權以 state、PKCE、裝置 proof 交接，結果可於 10 分鐘內重試。
- 手動登出撤銷當前裝置的服務 session，不強制登出其他裝置，也不刪除 Google 帳戶授權或標記資料。
- 如需停用全部裝置，先在 Google 帳戶的第三方存取權移除此應用程式授權；所有裝置之後需重新授權。

官方文件：
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/protocols/oauth2
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/wrangler/commands/d1/
