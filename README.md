# PWA-MemeFinder-GD V1_2

公開／私人梗圖庫，GitHub Pages 靜態部署。無需 npm、後端或付費 AI。

## V1_2 更新：免登入訪客模式（2026-11-21）

新增公開圖庫入口。網站管理者在 `guest-config.json` 設定一次 Drive API Key，資料夾開放「知道連結的任何人／檢視者」後，訪客只需貼上資料夾連結，無需 Google 帳號。

可搜尋、放大、複製、分享、下載圖片；個人標記與收藏存本機，可匯出／匯入。讀取既有 `_meme_data` 共用標記，也支援根目錄完整備份作為備援。上傳、共用標記修改與 Drive 備份維持管理者登入模式。

**初次啟用與排錯請先讀 [GUEST-SETUP.md](GUEST-SETUP.md)。** ZIP 預設 Key 留空，不能省略網站管理者的這次設定。

### 升級到 V1_2

將外層資料夾內全部檔案覆蓋 GitHub `PWA-MemeFinder-GD` 根目錄，包含新增的 `guest.mjs`、`guest-config.json`。既有 Client ID 與管理者資料保留。完成 Pages 部署後，設定 → 檢查更新，確認目前版本 V1_2。新版延續開啟自動檢查與安全套用更新，訪客也適用。

若未來再次升級，請保留已填好的 `guest-config.json`，不要以空白範本覆蓋。

新增：guest.mjs、guest-config.json、GUEST-SETUP.md、tests-guest.mjs。
修改：app.mjs、core.mjs、index.html、style.css、sw.js、version.json、tests.mjs、README.md、CHANGELOG.md。
保留：Drive 原始上傳、背景同步、連續標記、雲端備份、圖示、Manifest 與搜尋 Worker。

### 驗證

在解壓後資料夾執行 `node tests.mjs` 及 `node tests-guest.mjs`（Node.js 22+）。涵蓋原本背景同步／備份，以及匿名讀取、分頁、權限錯誤、本機資料隔離與訪客備份。測試不會呼叫真實 Google API。手機尺寸介面已驗證載入、搜尋、開啟預覽；真實 Drive 與實體 iPhone 剪貼簿仍需部署後驗收。

以下保留既有管理者功能操作說明。


## V1_1 更新與操作（2026-11-21）

### 升級

將 ZIP 外層資料夾內的**全部檔案**覆蓋 GitHub repository 根目錄，務必包含新增的 `sync-state.mjs`，不要只上傳 index.html。GitHub Pages 完成部署後，PWA → 設定 → 檢查更新，確認目前版本為 V1_1。沿用原本的網址、Google Client ID、Drive 資料夾及本機資料，不需重新安裝或清除網站資料。建議升級前先匯出原有標記備份。

### 連續標記

標記頁 → 開始連續標記。上方顯示當前圖片縮圖、檔名與「第幾張／共幾張」，下方依序提供備註、關鍵字、場景；其他欄位收在「其他資訊與收藏」。

- 「儲存並下一張」：先可靠儲存至本機，立即顯示下一張。Google Drive 同步獨立在背景處理，不需等待網路。
- 「儲存並完成」：最後一張儲存後返回列表。
- 「儲存關閉」：儲存當前圖片並結束編輯。
- 「略過」：換到下一張；已輸入內容保留為草稿，但不算完成標記。
- 同步中的新標記另留在佇列，雲端合併不覆蓋期間新增的本機記錄。若同一張圖有另一裝置的改動，保留不同修訂供使用者整合。
- 即使只有填「備註」也會算已標記，備註也納入首頁搜尋。

### 標記檔案的雲端備份

設定 → 同步與備份 → **立即備份標記到 Drive**。

目的地就是上方已填寫的 Google Drive 資料夾（根層，不是 GitHub）。每次建立獨立 JSON 檔案，格式：
`MemeFinder-Marks-YYYYMMDD_HHmmss-識別碼.json`（檔名時間為台灣時間）。

包含圖片 ID、檔名、路徑、標題、關鍵字、場景、備註、圖中文字、收藏、全部標記修訂及詞庫；不重複上傳圖片本體，也不包含 OAuth token。可將 JSON 下載後使用既有「匯入標記備份」還原標記；需選取相同 Drive 資料夾，並重整取得圖片清單。原本 `_meme_data` 的修訂同步也會保留。

預設開啟「標記同步後自動建立雲端備份」。最後一批標記同步後約 15 秒建立快照，連續標記期間合併等待，避免每張都產生一份。PWA 必須仍開啟且 Google 授權有效；關閉或失敗時保留待備份狀態，下次連線同步後會再安排。也可隨時使用手動按鈕。所有歷史備份都保留，不自動刪除舊檔。

如果上一次備份中斷，重試使用原本相同檔案 ID，避免不確定寫入結果造成重複檔。若重試時已有新標記，先補完上一份快照，再安排新的快照。設定頁顯示最近成功時間、檔名及錯誤狀態；不同資料夾／帳號的備份狀態分開儲存。

### 頁面與圖片縮放

一般頁面限制雙指、雙擊與常見快捷鍵造成的整頁縮放，輸入框維持 16px 避免 iPhone 聚焦自動放大。圖片預覽仍保留「＋／−／還原」與圖片本身的手勢縮放。瀏覽器選單或系統輔助使用設定仍可能覆寫網站的縮放限制。

### 異常狀態

未連線時可繼續本機標記；畫面顯示等待同步。只有收到 Drive 寫入成功才移除待同步記錄。備份失敗時顯示錯誤，不假稱成功；重新連線後可重試。不要在尚有待同步／待備份資料時清除瀏覽器網站資料。

## 1. 部署 GitHub Pages

1. 在 GitHub 建立 repository：`PWA-MemeFinder-GD`。
2. 解壓縮 ZIP，將內部所有程式檔案放在 repository 根目錄。不要把外層 `PWA-MemeFinder-GD-V1_2` 資料夾整個再包一層上傳。確認根目錄可看到 index.html。
3. Settings → Pages → Build and deployment → Deploy from a branch。
4. 選 main 分支、/(root)，Save。
5. 等待 GitHub Pages 部署完成。以 lihe-source 帳號為例，預期網址為 https://lihe-source.github.io/PWA-MemeFinder-GD/ 。
6. 先在瀏覽器完成 Google 設定；iPhone 使用 Safari 開啟，分享 → 加入主畫面。安裝版可能需再次登入。

## 2. Google Cloud 與 OAuth（管理者模式才需要）

1. 開啟 https://console.cloud.google.com/ ，建立或選取專案。
2. APIs & Services → Library → 搜尋 Google Drive API 並 Enable。
3. Google Auth Platform：設定 Branding（應用程式名稱、支援信箱、聯絡信箱）及 Audience。
4. 個人測試採 External / Testing，在 Test users 加入實際使用的 Google 帳號；若 Google 顯示未驗證提示，先核對專案確為自己建立。組織帳號可能受管理員限制。
5. Data Access 新增 `https://www.googleapis.com/auth/drive` 範圍。這是受限制的廣泛讀寫授權；程式本身只操作指定資料夾及其中的 `_meme_data`，但 Google 授權不是單一資料夾權限。對外公開服務須處理 Google OAuth 驗證要求。
6. Clients → Create client → Web application。
7. Authorized JavaScript origins 填 `https://lihe-source.github.io`（沒有尾斜線、沒有 `/PWA-MemeFinder-GD` 路徑）。使用其他 GitHub 帳號或自訂網域時填實際來源。此程式採 popup token flow，不需設定 redirect URI。
8. 複製 OAuth Client ID，以 `.apps.googleusercontent.com` 結尾。不要填 Client Secret、API Key 或服務帳戶 JSON。
9. 在 Google Drive 建立一個可寫入的梗圖資料夾，取得資料夾網址。建議使用「我的雲端硬碟」自己擁有的資料夾；V1_0 未針對 Workspace Shared Drives 專門驗證。
10. PWA → 設定 → 貼入 Client ID 和資料夾網址 → 儲存設定 → 右上角「連線 Google」。授權後自動掃描。

Google 帳號提示與資料夾設定會記住，但 access token 僅保留於記憶體，不儲存密鑰。重新開啟、token 過期或 Google 要求時，需點擊連線；不保證永久自動登入。只靠 API Key 不能讀取私有 Drive 圖片。

## 3. 使用

- 搜尋：標題、關鍵字、使用場景、備註、回覆語句、圖中文字及檔名。文字索引在本機搜尋，常用標籤一鍵搜尋。多詞全部命中優先，部分命中其次；同義詞在設定編輯。
- 標記：重整讀取新圖，包含子資料夾可關閉。選取多張圖片後可批次新增／移除關鍵字。至少一個關鍵字、場景或備註且經儲存，才算已標記。改檔名不影響關聯；原圖內容變更提示待確認。
- 雲端修訂：標記存成不可變的獨立 JSON 修訂，同步合併歷史。不同裝置同時修改同圖時保留分支；編輯頁展開查看各版本，整合後儲存。更新單一標籤也會形成完整記錄修訂，衝突採整筆人工確認。
- 上傳：先填共同標籤／場景，再選取圖片；每張可個別修改。支援 JPEG/PNG/WebP/GIF，每張最多 30MB。失敗項目按原按鈕重試，可續傳。圖片已成功但標記未完成時不重複上傳。共同標籤只套用到之後選入的圖片。
- 重複檔案：依 SHA-256 檢查本 PWA 上傳歷史與待傳清單。既有 Drive 圖片不會全部下載做雜湊，因此不保證偵測從其他管道加入的重複圖片。
- 複製：點圖片全螢幕預覽，準備完成後按「複製圖片」。支援的瀏覽器會將 PNG 資料寫入系統剪貼簿，電腦 Ctrl+V、iPhone 在支援貼圖的 App 長按貼上。圖片放大／拖曳不會影響複製範圍。GIF 複製為靜態畫面，分享／下載原圖保留動畫。複製版本長邊上限 4096px 且最多 1200 萬像素，以降低行動裝置記憶體用量；原圖不變。
- 分享：依瀏覽器 Web Share 檔案支援度顯示系統分享；不支援時使用下載。接收 App 的貼上支援及 iOS 系統規則仍會影響結果。
- 收藏：在「編輯標記」勾選加入收藏，再於搜尋頁切換收藏。
- 離線：可搜尋已同步文字、查看已快取圖片及編輯標記。未載入的圖片需上網。待同步工作在重新連線、PWA 開啟且 Google 授權有效時補送。iOS 不保證在背景或關閉後繼續工作。
- 備份：設定頁可匯出及匯入 JSON 標記備份。匯入只接受同一資料夾，不包含原圖；同義詞會附在備份供參照，V1_0 詞庫使用本機設定，匯入不自動覆蓋詞庫。

## 4. 資料與隱私

GitHub 只存程式。原圖保存在指定 Drive；`_meme_data` 保存標記修訂。不要刪除此資料夾。程式不刪除原圖，也不追蹤資料夾捷徑的目標。掃描失敗保留舊清單，完整掃描後才標記已移出。

圖片縮圖與看過的原圖緩存在 IndexedDB；快取可能被瀏覽器回收，不能視為正式備份。圖片快取達儲存上限時會清除可重建圖片快取再重試，保留標記及草稿；也可手動使用設定「清除圖片快取」。快取寫入失敗不阻止線上預覽。登出會切離該帳號資料，但同帳號草稿仍保留於裝置。共用電腦可於完成同步後清除網站資料。

V1_0 沒有 AI 辨識或 OCR；標記與圖片文字由使用者輸入，檔名／資料夾提供建議。繁簡處理僅常見詞與可編輯同義詞，不是完整語意搜尋或完整繁簡字典。

## 5. 版本更新

設定頁顯示目前／最新版本，支援手動檢查；每次啟動也自動檢查。Service Worker 完整快取新版才啟用，等待上傳、同步、編輯結束。下載失敗維持舊版。版本資訊走網路不快取。此版使用 schema 1，尚無跨 schema 遷移需求；未來改 schema 必須增加備份及遷移程式。

發布新版需同時修改 `core.mjs`、`sw.js` 的 VERSION 與 `version.json`，並在同一個 Git commit 部署所有更新檔。版本用 V1_0 → V1_1 … V1_9 → V2_0。不同 repository 的 Service Worker cache 範圍獨立。

## 6. 排除問題

- origin_mismatch：檢查 Google OAuth origin 是 `https://帳號.github.io`，不含專案路徑。
- 403 access_denied：確認測試帳號、Drive API 啟用、Drive scope 與組織管理員政策。
- 404／無權限：檢查資料夾 ID 與目前 Google 帳號，勿貼圖片網址。
- 圖片清單正常但圖片未載入：重新連線 Google，再點圖片；下載權限或格式不支援會導致失敗。
- 複製按鈕不可用：使用 HTTPS 與新版 Safari/Chrome/Edge，等待圖片準備完成；不支援時分享或下載。
- 標記同步失敗：本機草稿／待同步記錄保留，先匯出備份，再重新連線並同步。
- 部署後仍舊版：確認 Pages workflow 已成功，再按檢查更新。更新時不要只替換 index.html。

## 7. V1_1 驗證範圍

已通過 JavaScript 語法檢查、同步讀取期間新增標記不被覆蓋、儲存下一張不等待雲端、上傳失敗保留同一 Drive ID 重試、備份檔名及目的資料夾、備份期間新標記保留待備份狀態、備註搜尋及僅備註的已標記判斷。測試程式 `tests.mjs` 可在 Node.js 22+ 執行，不會連線真實 Google。

已在 Chromium 的 390×844 手機尺寸容器驗證三張連續標記、縮圖、備註讀回、預覽按鈕的字色／底色、設定頁與未登入備份錯誤提示。這不是實體 iPhone 測試；iPhone Safari/PWA 的鍵盤、手勢及系統剪貼簿，與真實 Drive 寫入仍需使用者裝置／帳號驗證。

官方參考：
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://webkit.org/blog/10855/async-clipboard-api/

## 檔案

sync-state.mjs（同步合併與備份快照）、index.html（介面）、style.css（響應式樣式）、app.mjs（流程與 UI）、core.mjs（資料與搜尋）、drive.mjs（Google API）、search-worker.js（搜尋背景處理）、sw.js（離線與更新）、manifest.webmanifest、version.json、icon.svg、icon-192.png、icon-512.png、.nojekyll、README.md、CHANGELOG.md。
