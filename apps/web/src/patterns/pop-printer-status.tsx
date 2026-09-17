/** 프린터 상태 코드 → 점 색. 모르는 값은 주의로 둔다. */
const TONE: Record<string, 'success' | 'warning' | 'error'> = {
  READY: 'success',
  BUSY: 'warning',
  OFFLINE: 'error',
  ERROR: 'error',
};

export interface PopPrinterStatusProps {
  /** 프린터 상태 코드(`READY`·`BUSY`·`OFFLINE`·`ERROR`). */
  status: string;
  /** 보이는 글자 — 서버가 준 상태 문구. */
  text: string;
}

/**
 * POP 프린터 칸 아래 장치 상태 — **점 + 글자**(사용자 지시 2026-09-17 · P-06-01 에서 정한 모양).
 * 칸 폭으로 늘어난 칩이 진행 막대처럼 읽혔다. 점 색은 기존 상태 토큰만 쓴다(`pop.css`).
 */
export const PopPrinterStatus = ({ status, text }: PopPrinterStatusProps) => (
  <span className="pop-printer-status" data-status={TONE[status] ?? 'warning'}>
    <span aria-hidden="true">●</span> {text}
  </span>
);
