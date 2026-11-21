# V1_2 免登入訪客模式：設定與使用

網站管理者完成一次設定後，沒有 Google 帳號的使用者只需貼上公開 Drive 資料夾網址，不需登入、不需 OAuth Client ID，也不需自行申請 API Key。

## 1. 管理者一次設定

### 建立公開讀取用 API Key

1. 開啟 https://console.cloud.google.com/ ，選擇原本 PWA 使用的專案，或建立專案。
2. **APIs & Services → Library → Google Drive API → Enable**。
3. **APIs & Services → Credentials → Create credentials → API key**。建立一般標準 API Key，不要綁定服務帳戶。
4. 編輯這把 Key：
   - **Application restrictions → Websites / HTTP referrers**。
   - GitHub 帳號為 `lihe-source` 時加入 `https://lihe-source.github.io/*`，也可加入來源 `https://lihe-source.github.io`。若使用自訂網域，改填實際網域。
   - 不要只限制到 `/PWA-MemeFinder-GD/` 路徑；瀏覽器的跨站請求可能只提供網域來源。
   - **API restrictions → Restrict key → Google Drive API**。
5. 儲存後複製 Key。這與原本的 OAuth Client ID 是不同的欄位；Client ID 繼續供管理者登入使用。

### 把設定交給網站

1. 將 V1_2 全部檔案部署到 GitHub `PWA-MemeFinder-GD` 專案根目錄。
2. PWA → 設定；如果目前顯示「訪客設定」，先按「切換管理者模式」。不需要先登入才能填網站設定。
3. 在「免登入服務設定」貼上 API Key。
4. 按 **下載 guest-config.json**。按鈕會同時套用至這台裝置供測試。
5. 把下載的 `guest-config.json` 覆蓋 GitHub 根目錄同名檔案，提交更新並等待 Pages 部署成功。
6. 在另一台未登入 Google 的裝置，開啟 PWA，貼上公開資料夾連結測試。

也可以直接編輯 ZIP 內的 `guest-config.json`，再一次部署全部檔案：

```json
{
  "apiKey": "貼上管理者建立並限制好的標準 API Key"
}
```

ZIP 預設 Key 留空，因為每個網站應使用自己的 Google Cloud 專案。只按「套用到這台裝置」不會自動更新 GitHub，其他訪客仍須等設定檔部署。更換 Key 後，重新開啟 PWA 會讀取新設定；管理者裝置若曾儲存個別 Key，需同步改成新的 Key。

此 Key 會隨靜態網站公開，僅供公開資料讀取及配額識別。請設定網站與 API 限制；不要放 OAuth Access Token、Client Secret、服務帳戶私鑰或綁定服務帳戶的授權金鑰。此程式不含後端、代理伺服器或可供訪客寫入私人 Drive 的憑證。

## 2. 圖庫擁有者設定分享

1. Google Drive → 選擇要分享的梗圖資料夾 → 共用。
2. 一般存取權設為 **知道連結的任何人 → 檢視者**。
3. 檢查圖片、需要的子資料夾及 `_meme_data` 標記資料夾可繼承／取得公開檢視權限。
4. 若要讓訪客複製或下載，圖片也必須允許檢視者下載。
5. 複製完整分享連結，包括可能出現的 `resourcekey`，交給訪客。

公開分享的資料夾內若包含 `_meme_data` 或 `MemeFinder-Marks-*.json`，其中的備註及歷史標記也會公開。建議使用專門的公開梗圖資料夾，只放願意分享的圖片與資訊。程式不會自行變更任何 Google Drive 分享權限。

公司／學校管理員可能禁止公開分享；這種資料夾不能以匿名方式讀取。私人資料夾仍需要管理者登入。

## 3. 訪客操作

1. 開啟 PWA 首頁，在「免登入梗圖庫」貼上資料夾網址或 ID。
2. 按 **開啟圖庫**。畫面右上顯示「訪客 · 免登入」。
3. 輸入關鍵字、心情或場景搜尋。若管理者未提供標記，仍可搜尋檔名，或自行補個人標記。
4. 點圖片放大；圖片準備完成後，可複製、分享或下載。系統／瀏覽器必須支援對應功能。
5. 「個人標記」可新增自己的關鍵字、備註、場景與收藏。與公開關鍵字一起搜尋，但只存這台裝置。
6. 要重整時，展開首頁「訪客圖庫…（切換／重整）」按「載入／重整」，或到標記頁按重整。重新開啟 PWA 也會嘗試更新公開清單。

曾載入的文字索引及已快取圖片可離線使用；尚未載入的圖片需要網路。本機快取可能被瀏覽器回收。

## 4. 兩種模式的功能

| 功能 | 訪客：不登入 Google | 管理者：登入 Google |
|---|---|---|
| 讀取公開資料夾 | 支援，網站需先設定 API Key | 支援 |
| 讀取私人資料夾 | 不支援 | 依帳號權限 |
| 搜尋／放大／複製／下載 | 支援，依圖片與瀏覽器權限 | 支援 |
| 標記／備註／收藏 | 本機個人資料 | 同步至 Drive |
| 上傳圖片到 Drive | 不支援 | 依資料夾寫入權限 |
| 修改大家共用的標記 | 不支援 | 支援 |
| 匯出／匯入標記 JSON | 個人標記備份 | 共用標記備份 |
| 雲端完整備份 | 不支援 | 支援 |
| 版本檢查／自動更新 | 支援 | 支援 |

訪客標記與管理者資料以不同的本機儲存範圍保存。切換模式、切換資料夾、重整公開圖庫都不會把個人標記送到 Drive。移出公開圖庫的圖片不再出現在搜尋結果，但其個人備註仍保留在本機備份。

個人關鍵字是補充內容，不能刪除管理者的公開關鍵字。編輯畫面只編輯自己的欄位；公開關鍵字顯示在提示區。訪客收藏只反映自己的選擇。

## 5. 訪客標記備份

訪客設定 → **匯出個人標記**，下載 `MemeFinder-Guest-YYYY-MM-DD.json`。這是下載至裝置的 JSON，不是 Drive 雲端備份，也不含圖片本體。

在另一台裝置開啟同一個公開資料夾後，訪客設定 → **匯入個人標記**。匯入檔僅接受相同資料夾；同一張圖片的個人欄位以匯入內容為準，其餘圖片的標記保留。訪客備份與管理者的雲端備份格式不同，避免誤將個人備註發布。

## 6. 問題排查

| 顯示狀況 | 處理方式 |
|---|---|
| 網站尚未啟用免登入服務 | 管理者填 Key 並將 guest-config.json 部署到 GitHub；確認並非只套用至自己的裝置 |
| HTTP 400／401 | 檢查 API Key 是否填錯或已撤銷，不能填 OAuth Client ID |
| HTTP 403 | 檢查 Drive API 是否啟用、網站／API 限制、讀取與下載權限、配額及組織政策 |
| HTTP 404 | 確認分享為「知道連結的任何人」、是資料夾連結，且 resourcekey 沒有被刪除 |
| 找得到圖片但搜尋不到情境 | 管理者需先同步標記，並確認 _meme_data 可公開讀取；或自行新增本機個人標記 |
| 列表有圖但不能複製 | 等待原圖載入；檢查圖片下載權限、HTTPS 與瀏覽器剪貼簿支援，可改用分享／下載 |
| 清單不完整／網路中斷 | 保留上次本機清單，稍後重整，不會自動清除個人標記 |
| 更新 Key 仍無效 | 確認 Pages 部署完成；重新開啟 PWA，管理者裝置另檢查本機 Key 是否覆寫網站設定 |

本版不追蹤 Drive 捷徑；每個 JSON 標記檔／備份上限 20 MB。公開檔案流量仍受 Google 的配額與下載限制影響。

## 7. 驗證與來源

執行 `node tests.mjs` 與 `node tests-guest.mjs`，測試使用模擬回應，不需要 Google 憑證，也不連線真實 Drive。

已驗證公開分頁／子資料夾／resource key、匿名 GET 不夾帶 OAuth Header、本機標記與帳號範圍分離、儲存失敗回復、私人檔案拒絕存取、備份格式檢查與原有同步／備份回歸測試。另在 Chromium 的 390×844 手機尺寸容器實際操作貼連結載入、關鍵字搜尋及開啟圖片預覽。

未使用真實 Google API Key 或 Drive 帳號做端到端測試；未完成實體 iPhone 的系統剪貼簿測試。正式部署後應用公開測試資料夾在實際手機驗收。

Google 官方文件（2026-11-21 查核）：
- 公開資料夾可使用 API Key 列出檔案：https://developers.google.com/workspace/drive/api/guides/search-files#list-files-in-a-public-folder
- 分享連結 resource key：https://developers.google.com/workspace/drive/api/guides/resource-keys
- API Key 與網站／API 限制：https://docs.cloud.google.com/docs/authentication/api-keys
