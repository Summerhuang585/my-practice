# SDD — 課程簽到牆 Check-in Wall · Summer's Lab

> 軟體設計文件(Software Design Document)
> 最後更新:2026-06-12

## 1. 架構總覽
純前端靜態網頁 + Netlify Functions(serverless)+ Netlify Blobs(儲存),全部部署在 Netlify。無前端建置步驟、無外部資料庫。

```
瀏覽器 (學員/講者)
   │  HTTP / fetch
   ▼
Netlify CDN ── 靜態頁 (public/*.html, brand.css, avatar.png, mascot.svg)
   │
   └── /api/*  ──redirect──►  Netlify Functions (netlify/functions/*.mjs)
                                   │
                                   ▼
                              Netlify Blobs (sessions / checkins)
```

即時更新:前端**每 2 秒輪詢** `/api/list`(非 WebSocket)。

## 2. 路由(`netlify.toml`)
| 對外網址 | 實際檔案 / 目標 |
|---|---|
| `/api/*` | `/.netlify/functions/:splat` |
| `/s/*` | `checkin.html`(網址保留代碼) |
| `/wall/*` | `wall.html` |
| `/ticker/*` | `ticker.html` |
| `/admin.html`, `/`(封面) | 靜態頁 |

代碼(slug)由各頁前端從 `location.pathname` 解析。

## 3. 頁面(`public/`)
| 檔案 | 路徑 | 職責 |
|---|---|---|
| `index.html` | `/` | 品牌封面、像素頭像、進後台入口 |
| `admin.html` | `/admin.html` | 建立/管理場次、連結與 QR、CSV 匯出(場次清單存 localStorage `checkin-wall-sessions`) |
| `checkin.html` | `/s/<slug>` | 學員互動表單 + 即時清單 + 像素頭像 |
| `wall.html` | `/wall/<slug>` | 投影牆;空場大 QR、進行中右下角常駐 QR |
| `ticker.html` | `/ticker/<slug>` | 角落細長條;底部常駐 QR;`?transparent=1` 透明 |
| `brand.css` | — | 共用樣式、像素字、動畫(`hop`/`dash`)、吉祥物 |
| `avatar.png` | — | 講者像素頭像(46px 解析度,全站共用) |
| `summer-avatar.png` | — | 頭像原圖(來源,供重製) |
| `mascot.svg` | — | 通用像素小人(空狀態奔跑 sprite) |

外部相依:Google Fonts、Zpix 像素字、QR 套件(jsdelivr 上的 `qrcodejs`)。

## 4. 後端 API(`netlify/functions/`)
所有回應為 JSON。需講者權限的操作以 **`adminToken`** 驗證(建立場次時產生的 UUID,存在講者 localStorage)。

| Function | 方法 | 用途 | 權限 |
|---|---|---|---|
| `session` | POST | 建立場次(代碼清洗、查重) | — |
| `session` | PUT | 改場次名稱 | adminToken |
| `session` | DELETE | 刪整個場次 + 其下所有資料 | adminToken |
| `session` | GET `?slug=` | 讀公開場次資訊(不含 adminToken) | — |
| `checkin` | POST | 送出簽到/留言/提問(簽到模式查重同名) | — |
| `list` | GET `?slug=` | 取該場次所有項目(含 count) | — |
| `vote` | POST | 對某項目按 ❤️(以 clientId 記名,防重複) | — |
| `answer` | POST | Q&A 標記/取消已回答 | adminToken |
| `remove` | POST | 刪除單筆 | adminToken |
| `export` | GET `?slug=&token=` | 匯出 CSV 名單 | adminToken |

## 5. 資料模型(Netlify Blobs)
兩個 store:

### `sessions`(key = slug)
```jsonc
{
  "slug": "0613",
  "title": "決策者的AI戰略",
  "mode": "checkin",            // checkin | message | qa
  "allowAnonymous": false,       // 簽到一律 false;其餘由講者決定
  "allowEmoji": true,            // 僅 message 模式有意義
  "adminToken": "uuid",          // 權限憑證(不對外回傳)
  "createdAt": 1718000000000
}
```

### `checkins`(key = `<slug>/<id>`)
```jsonc
{
  "id": "uuid",
  "name": "小明",                // 匿名時為預設名
  "message": "到!",              // 簽到模式可無
  "emoji": "🔥",                 // 選填
  "votes": 0,
  "voters": ["clientId", ...],   // 防重複按讚
  "answered": false,             // 僅 Q&A
  "at": 1718000000000
}
```
列表以 key 前綴 `"<slug>/"` 撈取;刪場次時一併刪除同前綴所有 blob。

## 6. 關鍵流程
- **建立場次**:`POST /api/session` → 清洗 slug(`[^a-z0-9-]`→`-`、查重)→ 產生 adminToken → 回傳 → 前端存 localStorage、產生四種連結與 QR。
- **學員送出**:`POST /api/checkin`(簽到模式先以同名查重)→ 寫入 `checkins`。
- **即時顯示**:`/s`、`/wall`、`/ticker` 各自每 2 秒 `GET /api/list`;Q&A 依 votes 排序,其餘依時間。
- **加入 QR**:展示頁前端用 `qrcodejs` 把 `location.origin + "/s/" + slug` 編碼成 QR。

## 7. 安全與限制
- 權限模型輕量:adminToken 即能力憑證,存在講者瀏覽器;清除瀏覽器資料即失去管理權。
- 防同名、防重複按讚為輕量檢查,非強身分驗證。
- 場次清單不跨裝置(localStorage)。
- 即時性以輪詢實作,2 秒延遲為可接受取捨。

## 8. 本機開發
```bash
npm install
npx netlify dev   # http://localhost:8888(含 Functions 與 Blobs 模擬)
```
