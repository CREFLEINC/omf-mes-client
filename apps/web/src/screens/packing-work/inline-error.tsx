import { AlertBanner } from '@crefle/web-ui';

/**
 * 칸 아래 인라인 오류 — **안내 문구 형식**(아이콘 + 글, 옅은 바탕 둥근 상자)으로 세운다(사용자 지시
 * 2026-09-17 · 전례 툴 사용실적 ④ `.pop-notice-label`). 글자만 두면 안내 문구와 색으로만 갈려,
 * 무엇이 잘못됐다는 말인지 한눈에 읽히지 않았다.
 */
export const InlineError = ({ children }: { children: string }) => (
  <div className="pop-notice-label pack-work-inline-error">
    <AlertBanner variant="error">{children}</AlertBanner>
  </div>
);
