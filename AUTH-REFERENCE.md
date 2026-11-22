# 附件登入做法對照 · V1_4

實際檢查附件內 `app.js` 的 GDrive 與 `cloud-runtime.js`：

| 附件實作 | 本版對應 |
| --- | --- |
| tryRestoreFromStorage：檢查有效期、Client ID、scope | BrowserAuth.restore：同時核對帳號與有效工作階段 |
| sessionValue / setSessionValue：sessionStorage＋記憶體 | browser-auth.mjs：sessionStorage，寫入失敗時當頁記憶體維持連線 |
| email / lastLogin 等保存在裝置 | 原 mf-config 保留帳號、顯示名稱、Client ID 與資料夾 |
| reconnect：空白 prompt、login_hint | 點「重新連線 Google」直接向 GIS 發起授權 |
| _tokenRequest：共用進行中的請求 | 同一登入 flight 合併重複點擊 |
| _authEpoch：登出後拒絕遲到回應 | epoch 與 app generation 雙重檢查 |
| silentRefresh：只恢復有效快取，失效回 TOKEN_EXPIRED | 過期或 401 顯示重新連線並保留本機佇列，不在背景彈窗 |

差異：日文附件使用 drive.file 與 userinfo.email。梗圖庫要掃描使用者既有資料夾，沿用 V1_1 的完整 Drive scope，並用 Drive about API 確認帳號。不能直接套用 drive.file，否則可能讀不到既有圖片。Google 授權範圍涵蓋整個 Drive，程式只操作設定的資料夾。

這次是依附件調整登入方式，不加入日文教材、AI 或通知功能；沒有訪客／公開圖庫功能。

設定只需 OAuth Web Client ID、Drive 資料夾 ID／網址。首次仍必須完成 Google 授權。一般本機標記可離線進行，並保留目前登入帳號的資料；這不等於新增匿名存取雲端功能。

Google 官方說明：
https://developers.google.com/identity/oauth2/web/guides/use-token-model
https://developers.google.com/identity/oauth2/web/reference/js-reference
