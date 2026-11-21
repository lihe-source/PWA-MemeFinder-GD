# V1_1 · 2026-11-21

1. 修正預覽視窗「分享／下載原圖／編輯標記」白字白底；手機改兩欄按鈕，文字清楚可辨。
2. 增加 viewport、touch-action、手勢與快捷鍵限制，維持頁面大小；圖片本身仍能縮放。
3. 同步與編輯解耦：標記先可靠存本機，雲端獨立背景同步；同步讀取後與最新本機修訂合併，單筆確認完成才清除該筆佇列。
4. 連續標記介面：上方縮圖、檔名與進度，下方備註／標籤／場景及固定操作列；下一張不等待同步。支援略過、草稿與僅備註標記。
5. 設定新增立即備份至 Drive、預設開啟自動備份、最近備份時間及檔名；完整 JSON 快照存到指定資料夾根層，支援失敗後以同一 ID 重試。
6. 累積中的備份狀態按帳號／資料夾保存；同步與備份工作尚在執行時不切換帳號／資料夾或套用更新。

## 檔案異動

新增：sync-state.mjs、tests.mjs。
修改：index.html、style.css、app.mjs、core.mjs、drive.mjs、sw.js、version.json、README.md、CHANGELOG.md。
沿用：manifest.webmanifest、search-worker.js、icon.svg、icon-192.png、icon-512.png、.nojekyll。

完整 ZIP 包含全部檔案；升級時請覆蓋 GitHub 根目錄，並在設定確認版本 V1_1。

## V1_0 · 2026-11-20

首版：Drive 圖片管理、搜尋、標記、上傳、放大與複製、離線索引、修訂同步及版本更新。
