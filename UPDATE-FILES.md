# V1_4 更新檔案

請使用完整包。外層資料夾名稱與 ZIP 相同，內部程式檔平放；上傳 GitHub 時，將內部檔案放 repository 根目錄，直接能看到 index.html。

相較 V1_1：

- 新增：browser-auth.mjs、tests-browser-auth.mjs、tests-auth-integration.mjs、AUTH-REFERENCE.md、UPDATE-FILES.md。
- 修改：app.mjs、drive.mjs、index.html、core.mjs、sw.js、version.json、tests.mjs、README.md、CHANGELOG.md。
- 沿用：style.css、sync-state.mjs、search-worker.js、manifest.webmanifest、icon.svg、icon-192.png、icon-512.png、.nojekyll。

從 V1_3 升級時，另外移除 repository 的 auth-session.mjs、auth-config.json、auth-worker.mjs、auth-schema.sql、wrangler.auth.toml、AUTH-SETUP.md、tests-auth.mjs、tests-integration.mjs。V1_4 不會讀取或呼叫這些舊檔案。

從 V1_2 升級時，移除 guest.mjs、guest-config.json、tests-guest.mjs、GUEST-SETUP.md。

不刪除 Drive 的圖片、_meme_data 或備份。不要清除瀏覽器網站資料。完成 GitHub Pages 部署後，PWA → 設定 → 檢查更新，確認目前版本 V1_4。

測試檔與 Markdown 文件可一起放 repository；不影響執行。程式只需要靜態 GitHub Pages，無 npm build、無後端服務部署。
