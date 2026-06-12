// 純函式驗證/清洗邏輯（無外部相依，方便單元測試）
export const NAME_MAX = 40;
export const MESSAGE_MAX = 280;
export const TITLE_MAX = 60;
export const SLUG_MAX = 40;
export const ALLOWED_EMOJI = ["👋", "👍", "🎉", "🔥", "✏️", "❤️", "😀", "🙌"];
export const MODES = ["checkin", "message", "qa"];

// 把使用者輸入清成合法代碼（英數與 -，其餘略過）
export function slugify(input) {
  return String(input || "").trim().toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX);
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

// 簽到防同名（大小寫、前後空白不計）
export function isDuplicateName(existingEntries, name) {
  const target = String(name).trim().toLowerCase();
  return (existingEntries || []).some(
    (e) => e && String(e.name).trim().toLowerCase() === target
  );
}

// 按讚切換：回傳新的 voters / 票數 / 是否已投
export function applyVote(voters, clientId) {
  const list = Array.isArray(voters) ? voters.slice() : [];
  const i = list.indexOf(clientId);
  let voted;
  if (i >= 0) { list.splice(i, 1); voted = false; }
  else { list.push(clientId); voted = true; }
  return { voters: list, votes: list.length, voted };
}
