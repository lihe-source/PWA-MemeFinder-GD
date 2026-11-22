# PWA-MemeFinder-GD V1_4

以 V1_1 功能為基底，參考附件 `PWA-Japanese-GD-V1_5_13-FLAT(1).zip` 的登入實作。**只填 OAuth Web Client ID 與 Google Drive 資料夾 ID／網址**，不需要 API Key、Client Secret、Cloudflare Worker 或 D1。

## 登入方式

1. 設定填入 Client ID 與 Drive 資料夾，儲存後按「連線 Google」，完成首次授權。
2. 記住帳號與設定；重新整理或返回前景時，自動恢復目前工作階段內尚未過期的授權。
3. 有效期限到期／Google 回傳 401 時，保留帳號、圖片清單、草稿與同步佇列，按右上「重新連線 Google」即可重新取得授權。已知帳號會以 `login_hint` 帶入，使用 `prompt: ''` 減少重複選帳號。
4. 重新連線成功後補送待同步標記。手動登出會停止自動恢復，原帳號草稿保留。

**附件也是「有效授權恢復＋記住帳號＋點擊重連」，並非永久背景續期。** GIS token 模式沒有 refresh token；Google 要求以使用者操作重新取得過期授權。關閉分頁或 PWA 被系統終止後，sessionStorage 可能消失，屆時需點一下重新連線。Safari 與主畫面版可能各有獨立工作階段。此版不自動開啟登入彈窗，也不要求新增任何後端設定。

## 升級

解壓後把外層 `PWA-MemeFinder-GD-V1_4` 裡的所有前端檔案覆蓋 repository 根目錄；新增的 `browser-auth.mjs` 必須一起上傳。保持原網址，PWA → 設定 → 檢查更新，確認版本 V1_4。開啟時也自動檢查並在編輯／同步／登入結束後更新。

從 V1_3 升級請依 UPDATE-FILES.md 移除舊授權服務檔；PWA 不再讀取或呼叫舊 Worker。程式會清掉本機舊 Worker 連線設定與裝置 session，保留原本 Client ID、資料夾、帳號、圖片、標記與草稿。若先前只填 Worker 網址，需補填 OAuth Client ID。舊 Cloudflare 雲端資源不會由 PWA 自動刪除；若先前已部署，可在 Cloudflare 停用不再使用的服務。

升級前可先匯出標記備份。不要清除網站資料或 Drive 的 `_meme_data`。

## 原有功能

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
2. 解壓縮 ZIP，將內部所有程式檔案放在 repository 根目錄。不要把外層 `PWA-MemeFinder-GD-V1_4` 資料夾整個再包一層上傳。確認根目錄可看到 index.html。
3. Settings → Pages → Build and deployment → Deploy from a branch。
4. 選 main 分支、/(root)，Save。
5. 等待 GitHub Pages 部署完成。以 lihe-source 帳號為例，預期網址為 https://lihe-source.github.io/PWA-MemeFinder-GD/ 。
6. 先在瀏覽器完成 Google 設定；iPhone 使用 Safari 開啟，分享 → 加入主畫面。安裝版可能需再次登入。

## 2. Google Cloud 與 OAuth（必要）

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

帳號與資料夾設定會記住。有效 access token 只存於目前頁面的 sessionStorage 與記憶體，重新整理與瀏覽器保留工作階段時自動恢復；不寫入 localStorage、IndexedDB 或備份。授權過期或工作階段被關閉／系統清除時，按「重新連線 Google」，使用 login_hint 與空白 prompt 帶入原帳號。Google 仍可能要求登入或確認，不保證跳過所有視窗。

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

## 7. V1_4 驗證範圍

使用 Node.js 24 執行 `node tests.mjs`、`node tests-browser-auth.mjs`、`node tests-auth-integration.mjs`。涵蓋 V1_1 背景同步／下一張／備份、有效授權恢復、過期／401、同時點擊合併、取消／逾時、權限不足、Client ID／scope／帳號隔離、儲存空間失敗、登出與遲到回應、設定事件及重連補同步。使用模擬 Google 回應，沒有連到真實帳號。

本版已進行 JavaScript 語法與程式整合檢查，尚未以實體 iPhone、Google 帳號與正式 GitHub 網站驗證。

官方參考：
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/identity/oauth2/web/reference/js-reference

