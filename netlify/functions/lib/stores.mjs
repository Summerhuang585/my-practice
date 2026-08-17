import { getStore } from "@netlify/blobs";

// Netlify Blobs 預設是「最終一致」：剛寫進去的東西，馬上讀不一定讀得到
// （實測線上建完場次要等數十秒才讀得到，本機開發環境是即時的所以測不出來）。
//
// 這個工具幾乎每個關鍵動作都是「寫完馬上有人要讀」：
//   建立場次 → 老師立刻把 QR 給學員掃（讀不到就是「找不到這個場次」）
//   送出簽到 → 下一個同名的人要靠這筆判斷重複
//   按讚     → 同一個人再按一次要讀得到自己剛剛那票
// 所以這兩個 store 一律用 strong。場次與簽到的量都很小，多這點延遲划算。
//
// 例外：限流紀錄本來就是盡力而為，維持 eventual，省下每次請求的成本。
// 另注意 list() 沒有一致性選項，清單仍可能慢一拍；展示頁本來就是每 2 秒輪詢，可以接受。
export const sessionStore = () => getStore({ name: "sessions", consistency: "strong" });
export const checkinStore = () => getStore({ name: "checkins", consistency: "strong" });
export const rateLimitStore = () => getStore({ name: "ratelimit" });
