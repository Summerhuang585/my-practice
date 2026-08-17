// 純函式驗證/清洗邏輯（無外部相依，方便單元測試）
export const NAME_MAX = 40;
export const MESSAGE_MAX = 280;
export const TITLE_MAX = 60;
export const CODE_MAX = 24;   // 講者自訂的部分
export const SUFFIX_LEN = 6;  // 系統加的隨機尾碼
export const ALLOWED_EMOJI = ["👋", "👍", "🎉", "🔥", "✏️", "❤️", "😀", "🙌"];
export const MODES = ["checkin", "message", "qa"];

const SUFFIX_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // 去掉易混淆的 l/o/0/1

// 把使用者輸入清成合法代碼（英數與 -，其餘略過）
export function slugify(input) {
  return String(input || "").trim().toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, CODE_MAX)
    .replace(/-$/, "");
}

// 產生不可猜的隨機尾碼。randomBytes 預設用 crypto，測試時可注入。
export function randomSuffix(len = SUFFIX_LEN, randomBytes = defaultRandomBytes) {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length];
  return out;
}

function defaultRandomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

// 完整代碼 = 講者自訂前綴（可留空）+ 隨機尾碼。
// 尾碼是為了讓代碼猜不到：知道代碼就看得到名單，所以代碼本身必須是秘密。
export function makeSlug(code, randomBytes = defaultRandomBytes) {
  const head = slugify(code);
  const tail = randomSuffix(SUFFIX_LEN, randomBytes);
  return head ? `${head}-${tail}` : `s-${tail}`;
}

export function cleanTitle(input) {
  return String(input || "").trim().slice(0, TITLE_MAX);
}

// 回傳 { name } 或 { error }
export function cleanName(input, { allowAnonymous = false } = {}) {
  const name = String(input || "").trim().slice(0, NAME_MAX);
  if (name) return { name };
  if (allowAnonymous) return { name: "匿名" };
  return { error: "請輸入名字" };
}

export function cleanMessage(input) {
  return String(input || "").trim().slice(0, MESSAGE_MAX);
}

export function isAllowedEmoji(emoji) {
  return ALLOWED_EMOJI.includes(emoji);
}

export function normalizeMode(mode) {
  return MODES.includes(mode) ? mode : "checkin";
}

// 送進來的 clientId 只當識別碼用，長度與字元都要收斂，避免被塞進 blob key 亂搞
export function cleanClientId(input) {
  const v = String(input || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return v || null;
}

// 簽到模式：把名字正規化後編成固定的 entry id。
// 同一個名字永遠對到同一個 id，所以「防同名」= 查一次 key 存不存在（O(1)），
// 不需要把整場資料撈出來比對。
export function normalizeName(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function nameEntryId(name) {
  const bytes = new TextEncoder().encode(normalizeName(name));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `n-${b64}`;
}

export function randomEntryId(randomBytes = defaultRandomBytes) {
  return `e-${Date.now().toString(36)}-${randomSuffix(8, randomBytes)}`;
}

// blob key 不能是空字串、不能以 / 開頭；限流的 key 由 IP 組出來，先收斂字元
export function safeKeyPart(input) {
  const v = String(input || "").replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 80);
  return v || "unknown";
}

// ---- 一個場次底下的 key 佈局 ----
//   <slug>/e/<entryId>            一筆簽到／留言／提問
//   <slug>/v/<entryId>/<clientId> 一張票（一人一票一個 blob，避免同時按讚互相蓋掉）
export const entryKey = (slug, id) => `${slug}/e/${id}`;
export const voteKey = (slug, id, cid) => `${slug}/v/${id}/${cid}`;
export const votePrefix = (slug, id) => `${slug}/v/${id}/`;

// 把 list() 回來的 key 分成「項目」與「票」。票只看 key 就能算數量，不用再讀內容。
export function partitionKeys(keys, slug, clientId) {
  const prefix = `${slug}/`;
  const entryKeys = [];
  const votes = new Map();   // entryId -> 票數
  const voted = new Set();   // 這個 clientId 投過的 entryId
  for (const key of keys || []) {
    if (!key || !key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    if (rest.startsWith("e/")) {
      entryKeys.push(key);
    } else if (rest.startsWith("v/")) {
      const parts = rest.slice(2).split("/");
      if (parts.length !== 2) continue;
      const [id, cid] = parts;
      votes.set(id, (votes.get(id) || 0) + 1);
      if (clientId && cid === clientId) voted.add(id);
    }
  }
  return { entryKeys, votes, voted };
}

// CSV 儲存格：除了跳脫引號逗號換行，還要擋掉會被 Excel 當公式執行的開頭字元。
export function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
