// 限流的純邏輯（無外部相依，方便測試）

// 從請求標頭取得來源 IP（Netlify 會帶 x-nf-client-connection-ip）
export function clientIp(req) {
  const h = req.headers;
  return (
    h.get("x-nf-client-connection-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

// 滑動視窗判斷：過濾出視窗內的時間戳，未超過上限就允許並記錄這次
export function withinLimit(timestamps, now, windowMs, limit) {
  const recent = (timestamps || []).filter((t) => now - t < windowMs);
  const allowed = recent.length < limit;
  if (allowed) recent.push(now);
  return {
    allowed,
    timestamps: recent,
    retryAfterMs: allowed ? 0 : Math.max(0, windowMs - (now - recent[0])),
  };
}
