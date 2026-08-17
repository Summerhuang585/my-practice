import { sessionStore, checkinStore } from "./lib/stores.mjs";
import { json } from "./lib/http.mjs";
import {
  cleanName, cleanMessage, isAllowedEmoji, cleanClientId,
  nameEntryId, randomEntryId, entryKey,
} from "./lib/validate.mjs";
import { rateLimit, clientIp } from "./lib/ratelimit.mjs";

// 學員送出一筆（簽到 / 留言 / 提問，依場次模式）
// POST body: { slug, name, message?, emoji?, clientId? }
const RL = { limit: 40, windowMs: 10000 }; // 每 IP 10 秒上限（放寬，僅擋灌爆）

export default async (req) => {
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  const rl = await rateLimit("checkin", clientIp(req), RL);
  if (!rl.allowed) {
    return json({ error: "送出太快了，請稍等幾秒再試" }, 429,
      { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) });
  }

  let body = {};
  try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

  const slug = String(body.slug || "").trim();
  if (!slug) return json({ error: "缺少 slug" }, 400);

  const sessions = sessionStore();
  const session = await sessions.get(slug, { type: "json" });
  if (!session) return json({ error: "找不到這個場次" }, 404);

  const nameRes = cleanName(body.name, { allowAnonymous: session.allowAnonymous });
  if (nameRes.error) return json({ error: nameRes.error }, 400);
  const name = nameRes.name;

  const message = session.mode === "checkin" ? "" : cleanMessage(body.message);
  if (session.mode !== "checkin" && !message) {
    return json({ error: session.mode === "qa" ? "請輸入問題" : "請輸入內容" }, 400);
  }

  const cid = cleanClientId(body.clientId);
  const store = checkinStore();

  // 簽到模式：entry id 直接由名字算出來，所以查重只要讀一次 key，
  // 不用把整場的資料撈出來逐筆比對（人多時那樣會愈來愈慢）。
  let id;
  if (session.mode === "checkin") {
    id = nameEntryId(name);
    const existing = await store.get(entryKey(slug, id), { type: "json" });
    if (existing) {
      if (cid && existing.cid === cid) {
        return json({ error: "你已經完成簽到了", already: true }, 409);
      }
      // 同名不同人：擋死會讓班上第二個同名的人永遠簽不到，所以要告訴他怎麼做
      return json({
        error: "這個名字已經有人簽到了。如果你是另一個人，請在名字後面加上可以分辨的字，例如「王小明-B」。",
        nameTaken: true,
      }, 409);
    }
  } else {
    id = randomEntryId();
  }

  const entry = { id, name, at: Date.now() };
  if (cid) entry.cid = cid;
  if (session.mode !== "checkin") entry.message = message;
  if (session.allowEmoji && isAllowedEmoji(body.emoji)) entry.emoji = body.emoji;
  if (session.mode === "qa") entry.answered = false;

  await store.setJSON(entryKey(slug, id), entry);
  return json(entry);
};
