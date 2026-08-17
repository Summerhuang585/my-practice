# SDD — 課程簽到牆 Check-in Wall · Summer's Lab

> 軟體設計文件(Software Design Document)
> 最後更新:2026-08-17

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
| `session` | POST | 建立場次(代碼清洗、加隨機尾碼、查重) | 限流 |
| `session` | PUT | 改場次名稱 | adminToken |
| `session` | DELETE | 刪整個場次 + 其下所有資料 | adminToken |
| `session` | GET `?slug=` | 讀公開場次資訊(不含 adminToken) | — |
| `checkin` | POST | 送出簽到/留言/提問(簽到模式查重同名) | 限流 |
| `list` | GET `?slug=&cid=` | 取該場次所有項目(含票數、我投過哪些) | — |
| `vote` | POST | 對某項目按 ❤️(切換) | 限流 |
| `answer` | POST | Q&A 標記/取消已回答 | adminToken |
| `remove` | POST | 刪除單筆(連同該筆的票) | adminToken |
| `export` | GET `?slug=` + `x-admin-token` 標頭 | 匯出 CSV 名單 | adminToken |
| `cleanup` | 排程(每日) | 刪除逾 `MAX_AGE_DAYS`(30 天)的場次與其資料,並清掉過期的限流紀錄 | 排程觸發 |

公開端點(建立場次、`checkin`、`vote`)套用**限流**(`lib/ratelimit`):滑動視窗記錄每個 **IP** 最近請求,超過上限回 `429`。教室常共用對外 IP,故上限刻意放寬,僅攔腳本式灌爆。限流的 key 一律用來源 IP,不用前端送來的 `clientId`(那是它自己給的,換一組就繞過)。

`export` 的權杖走 `x-admin-token` 標頭而不是網址參數:網址會被寫進瀏覽器歷史與伺服器日誌,等於權杖外流。後台改用 `fetch` 取回內容再觸發下載。

共用模組(`netlify/functions/lib/`):`http`(JSON 回應)、`validate`(slug/姓名/訊息/emoji/投票等純邏輯)、`ratelimit-core`(純滑動視窗)、`ratelimit`(Blobs 包裝)。純邏輯模組無外部相依,供單元測試直接載入。

## 5. 資料模型(Netlify Blobs)
兩個 store:

### `sessions`(key = slug)
slug = 講者自訂前綴 + `-` + 6 碼隨機尾碼(自訂留空時為 `s-xxxxxx`)。**尾碼是安全機制不是裝飾**:知道 slug 就看得到名單,所以 slug 本身必須猜不到,見 §7。

```jsonc
{
  "slug": "0613-k3f9pm",
  "title": "決策者的AI戰略",
  "mode": "checkin",            // checkin | message | qa
  "allowAnonymous": false,       // 簽到一律 false;其餘由講者決定
  "allowEmoji": true,            // 僅 message 模式有意義
  "adminToken": "uuid",          // 權限憑證(不對外回傳)
  "createdAt": 1718000000000
}
```

### `checkins`(一個場次兩種 key)
```
<slug>/e/<entryId>              一筆簽到／留言／提問
<slug>/v/<entryId>/<clientId>   一張票(內容只有時間,重點在 key)
```

```jsonc
// <slug>/e/<entryId>
{
  "id": "e-abc123",
  "name": "小明",                // 匿名時為預設名
  "message": "到!",              // 簽到模式無
  "emoji": "🔥",                 // 選填
  "answered": false,             // 僅 Q&A
  "cid": "瀏覽器隨機 ID",         // 判斷「同一台裝置重複送出」用,不對外回傳
  "at": 1718000000000
}
```

兩個設計重點:

- **票各自一個 blob,不寫回項目本身。** 先前是把 `votes`/`voters` 存在項目裡,按讚要「讀出來→改→寫回」,兩個人同時按就會互相蓋掉(投影牆的場景正好是大家同時按)。Netlify Blobs 沒有條件寫入可用,所以改成一人一票一個 key,同時按也互不干擾。票數 = 該前綴的 key 數量,**只看 key 不用讀內容**,所以不會變慢。
- **簽到模式的 entryId 由名字算出來**(`n-` + 名字的 base64url)。同一個名字永遠對到同一個 key,防同名變成查一次 key(O(1)),不必把整場資料撈出來逐筆比對。

列表以 key 前綴 `"<slug>/"` 撈取,再依 `/e/`、`/v/` 分流(`lib/validate.partitionKeys`);刪場次時一併刪除同前綴所有 blob,刪單筆時一併刪該筆的票。

## 6. 關鍵流程
- **建立場次**:`POST /api/session` → 清洗自訂代碼(`[^a-z0-9-]`→`-`)→ 接上隨機尾碼 → 查重(撞了就換一組,最多試 5 次)→ 產生 adminToken → 回傳 → 前端存 localStorage、產生四種連結與 QR。
- **學員送出**:`POST /api/checkin`。簽到模式先用名字算出 entryId 查一次 key:
  - 已存在且 `cid` 相同 → 「你已經完成簽到了」(同一台裝置重複按)。
  - 已存在但 `cid` 不同 → 回 `nameTaken`,請他在名字後面加註記。**不能直接擋死**:班上有兩個同名的人時,第二個會永遠簽不到。
- **即時顯示**:`/s`、`/wall`、`/ticker` 各自每 2 秒 `GET /api/list`;Q&A 依 votes 排序,其餘依時間。展示頁每 30 秒回頭確認場次還在,場次被刪就顯示「已結束」,不會繼續叫人掃一個失效的 QR。
- **加入 QR**:展示頁前端用 `qrcodejs` 把 `location.origin + "/s/" + slug` 編碼成 QR。開場的大 QR 只畫一次,不隨輪詢重畫。

### 5.1 一致性(`lib/stores.mjs`)
Netlify Blobs 預設是**最終一致**:剛寫進去的東西馬上讀不一定讀得到(線上實測建完場次要等數十秒;本機 `netlify dev` 是即時的,所以測不出來)。

本工具幾乎每個關鍵動作都是「寫完馬上有人要讀」:建完場次立刻把 QR 給人掃、送出簽到後下一個同名的人要靠這筆判重、按讚後同一個人再按要讀得到自己那票。因此 `sessions` 與 `checkins` 一律以 `consistency: "strong"` 取得;限流本來就是盡力而為,維持 eventual。

`list()` 沒有一致性選項,清單仍可能慢一拍;展示頁本來就是每 2 秒輪詢,可接受。

## 7. 安全與限制
- **slug 就是鑰匙**:`/api/list` 沒有權限檢查(投影牆與學員頁都要能顯示,加密碼不可行),所以拿到 slug 就看得到那場的名字與內容。防線是 slug 猜不到:一律帶 6 碼隨機尾碼(32 進位字母表,約 10 億組),且不接受純自訂的短代碼。
- **Referrer**:頁面網址帶著 slug,`netlify.toml` 設 `Referrer-Policy: no-referrer`,避免 slug 隨 Referer 外流到 Google Fonts、jsdelivr 等外部主機。
- 權限模型輕量:adminToken 即能力憑證,存在講者瀏覽器;清除瀏覽器資料即失去管理權。
- **限流**:公開端點以滑動視窗限流(見 §4),為盡力而為,非嚴格防護。限流讀寫失敗會 `console.warn`,不會靜默失效。
- **投票不是身分驗證**:`clientId` 是瀏覽器自己產的,清掉重來就能再投一次。這是刻意的取捨(現場工具不做登入),Q&A 排序僅供參考。
- **同名同時送出**仍可能兩筆都過(沒有交易),但兩筆會落在同一個 key,結果等同去重,不會出現重複列。
- **資料保存**:場次逾 30 天由排程 `cleanup` 自動刪除;限流紀錄逾 1 小時一併清掉;講者亦可手動刪除整場(見隱私說明 `docs/PRIVACY.md`)。
- 場次清單不跨裝置(localStorage)。
- 即時性以輪詢實作,2 秒延遲為可接受取捨。

## 8. 測試與 CI
- 單元測試:`node:test`,涵蓋 `lib/validate` 與 `lib/ratelimit-core` 的純邏輯(slug 清洗與尾碼、名字轉 entryId、key 分流與票數統計、CSV 公式中和、clientId 收斂、限流視窗、IP 解析)。
- 執行:`npm test`(`node --test`,免安裝相依)。
- CI:`.github/workflows/ci.yml` 於 push / PR 自動跑測試。
- 部署:推上 `main` 由 Netlify 自動部署(等同 CD)。

## 9. 本機開發
```bash
npm test          # 跑單元測試
npm install
npx netlify dev   # http://localhost:8888(含 Functions 與 Blobs 模擬)
```
