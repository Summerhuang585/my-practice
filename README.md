# 課程簽到牆 Check-in Wall · Summer's Lab

給工作坊 / 活動用的即時牆：學員掃 QR、即時上牆，可投影到大螢幕或掛在投影片角落。
一個工具、**三種模式**，部署在 [Netlify](https://www.netlify.com/)，資料存 Netlify Blobs（內建，免另接資料庫）。

## 文件
- [PRD 產品需求文件](docs/PRD.md) — 目標、使用者、功能、成功標準
- [SDD 軟體設計文件](docs/SDD.md) — 架構、路由、API、資料模型
- [隱私說明](docs/PRIVACY.md) ｜ [CHANGELOG](CHANGELOG.md) ｜ [LICENSE](LICENSE)(MIT)

## 測試
```bash
npm test   # node --test，純邏輯單元測試（slug 清洗、防同名、投票、限流）
```
push / PR 會由 GitHub Actions 自動跑(`.github/workflows/ci.yml`)。

## 三種模式（每個場次由講者選一個）

| 模式 | 用途 | 特性 |
|---|---|---|
| 🟢 **簽到** | 算出席、破冰 | 實名・**防同名**・可**匯出 CSV 名單** |
| 💬 **留言** | 打招呼、刷存在感 | 可**匿名**・emoji 心情 |
| ❓ **Q&A** | 收問題 | 可**匿名**・**按讚排序**（熱門浮上來）・**標記已回答** |

## 頁面 / 網址

| 頁面 | 網址 | 用途 |
|---|---|---|
| 老師後台 | `/admin.html` | 建立/管理場次、選模式、QR、匯出 CSV |
| 學員頁 | `/s/<代碼>` | 學員簽到 / 留言 / 提問（QR 指向這裡） |
| 投影牆 | `/wall/<代碼>` | 投影到大螢幕（F11 全螢幕） |
| 角落即時 | `/ticker/<代碼>` | 細長條，常駐小視窗擺投影片旁 |
| OBS 透明疊加 | `/ticker/<代碼>?transparent=1` | OBS browser source，浮在投影片上 |

## 角落即時模式怎麼用

- **常駐小視窗**：開 `/ticker/代碼`，把瀏覽器視窗縮小、設「永遠在最上層」，擺在投影片旁邊。
- **OBS 透明疊加**：在 OBS 加一個 **Browser Source**，網址填 `/ticker/代碼?transparent=1`，背景透明，直接浮在你的投影畫面上。

## 設計

對齊 **Summer's Lab** 品牌：米白紙底、高對比襯線大標（Playfair + 思源宋體）、**珊瑚紅**重點色、霧粉與橄欖點綴、mono 小標、刊頭與編號條目的雜誌 editorial 排版。

## 部署到 Netlify

### 連 GitHub 自動部署（推薦）
1. 這個 repo 已在 GitHub。登入 Netlify → **Add new site → Import an existing project** → 選 `my-practice`。
2. 設定保持預設（`netlify.toml` 已寫好）→ **Deploy**。
3. 打開 `https://你的站台.netlify.app/admin.html` 建立第一個場次。

> Netlify Blobs 會自動啟用，不需額外設定資料庫。

### 本機開發
```bash
npm install
npx netlify dev   # http://localhost:8888
```

## 技術
- 前端：純 HTML/CSS/JS（無建置步驟），共用 `public/brand.css`
- 後端：Netlify Functions（`netlify/functions/*.mjs`），共用純邏輯於 `lib/`
  - `session` 建立/改名/刪除/讀取 ｜ `checkin` 送出 ｜ `list` 列表 ｜ `vote` 按讚 ｜ `answer` 標記已回答 ｜ `remove` 刪除單筆 ｜ `export` 匯出 CSV ｜ `cleanup` 每日排程清理逾期資料
  - 公開寫入端點（`checkin`/`vote`）有限流防濫用
- 儲存：Netlify Blobs ｜ 即時：前端每 2 秒輪詢
