# 課程簽到牆 Check-in Wall

一個給課堂 / 活動用的簽到牆：學員掃 QR Code 或開連結輸入名字，名字會**即時出現在投影牆**上。
用 [Netlify](https://www.netlify.com/) 部署，資料存在 **Netlify Blobs**（內建，免另接資料庫）。

## 功能

- 🧑‍🎓 **學員簽到**：輸入名字（可選填留言 / 打卡心得）
- 📺 **投影牆**：每 2 秒自動更新，適合投影到大螢幕（按 F11 全螢幕）
- 📋 **老師後台**：建立 / 管理多個場次、看簽到人數、刪除簽到
- 🔳 **QR Code**：自動產生學員簽到用的 QR Code

## 網址結構

| 頁面 | 網址 | 用途 |
|---|---|---|
| 首頁 | `/` | 說明 + 進入後台 |
| 老師後台 | `/admin.html` | 建立場次、拿連結與 QR、管理簽到 |
| 學員簽到 | `/s/<代碼>` | 給學員（QR 指向這裡） |
| 投影牆 | `/wall/<代碼>` | 老師投影到大螢幕 |

## 部署到 Netlify（最簡單）

### 方法 A：連 GitHub 自動部署（推薦）
1. 把這個 repo push 到 GitHub（已經是了）。
2. 登入 Netlify → **Add new site → Import an existing project** → 選這個 repo。
3. 設定保持預設即可（`netlify.toml` 已寫好 publish 與 functions 目錄），按 **Deploy**。
4. 部署完成後，打開 `https://你的站台.netlify.app/admin.html` 開始建立場次。

> Netlify Blobs 在 Netlify 上會自動啟用，不需要額外設定資料庫。

### 方法 B：用 Netlify CLI 從本機部署
```bash
npm install
npx netlify login
npx netlify deploy --build --prod
```

## 本機開發 / 測試
```bash
npm install
npx netlify dev      # 會在 http://localhost:8888 啟動（含 Functions 與 Blobs）
```

## 上課流程
1. 進 `/admin.html` 建立場次，填課程名稱（可自訂代碼，如 `python-w3`）。
2. 把畫面上的 **QR Code** 或學員連結 `/s/代碼` 給學員。
3. 自己開 **投影牆** `/wall/代碼`，投影到大螢幕。
4. 學員輸入名字簽到，名字即時出現在牆上 🎉。

## 技術
- 前端：純 HTML / CSS / JS（無建置步驟）
- 後端：Netlify Functions（`netlify/functions/*.mjs`）
- 儲存：Netlify Blobs
- 即時更新：前端每 2 秒輪詢 `/api/list`
