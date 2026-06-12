# Changelog

本專案的重要變更紀錄。格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/),版本依 [語意化版本](https://semver.org/lang/zh-TW/)。

## [Unreleased]

### Added
- **限流防濫用**:公開的 `checkin` / `vote` 端點加入滑動視窗限流(以 IP / clientId 為 key,上限放寬以相容教室共用 IP),擋腳本式灌爆。
- **資料自動清理**:每日排程函式 `cleanup`,自動刪除建立逾 30 天的場次與其所有資料。
- **隱私說明**:學員頁顯示蒐集與保存說明;新增 `docs/PRIVACY.md`。
- **自動化測試 + CI**:抽出純邏輯到 `netlify/functions/lib/`,以 `node:test` 撰寫單元測試;GitHub Actions 於 push / PR 自動跑測試。
- **LICENSE**(MIT)與本 CHANGELOG。

### Changed
- 後端重構:`session` / `checkin` / `vote` 共用 `lib/`(`validate`、`http`、`ratelimit`),去除重複邏輯。

## [1.0.0] - 2026-06-12

### Added
- 三種模式:**簽到**(實名・防同名・匯出 CSV)、**留言**(可匿名・emoji・❤️)、**Q&A**(可匿名・❤️ 排序・標記已回答)。
- 頁面:封面、講者後台 `/admin`、學員頁 `/s/<代碼>`、投影牆 `/wall/<代碼>`、角落即時 `/ticker/<代碼>`(含 OBS 透明模式)。
- 後台:建立/改名/**刪除**場次、自訂代碼**即時預覽**、連結與 QR、CSV 匯出。
- 加入 QR:學員頁頭像、投影牆(開場大 QR / 進行中右下角)、角落即時(底部常駐)。
- 品牌:講者本人**像素頭像**(全站統一 46px)、Zpix 中文像素字、雜誌 editorial 排版;手機 RWD。
- 文件:README、PRD、SDD。
