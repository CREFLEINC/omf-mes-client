/**
 * 인쇄 — **발행과 갈라진 세 걸음**(스펙 §6 · K-4).
 *
 * ```
 * ① 발행 기록을 만든다        POST /app/document-issues        (mutations.ts)
 * ② 그린 것을 받는다           GET  /app/document-issues/{id}/rendition
 * ③ 셸이 프린터로 보낸다       window.pop.rendition.save
 * ④ 결과를 보고한다            POST /app/document-issues/{id}:report-print
 * ```
 *
 * ⛔ **발행과 인쇄를 한 호출로 묶지 않는다.** 인쇄가 실패해도 발행 기록은 남아야 하고, 그
 * 사실이 곧 재인쇄로 복구할 수 있다는 뜻이다.
 *
 * ⛔ **셸이 출력물을 다시 그리지 않는다.** 서버가 그린 바이트를 그대로 넘긴다(결정 18 · K-5).
 *
 * ⭐ **② 와 ③ 사이에 미리보기가 선다** — 이 화면만의 걸음이다(스펙 §3 액션바 · 착수 이슈 §6
 * 「발행 → 미리보기 → 인쇄」). 그리기 경로가 발행 기록 번호를 받으므로 **발행 전 미리보기는
 * 계약에 없다.**
 */

/**
 * POP 셸이 렌더러에 여는 통로 중 이 화면이 쓰는 부분.
 *
 * ⚠ **관리웹(브라우저)에는 이 통로가 없다.** 없는 것이 오류는 아니고 「여기서는 프린터로 보낼
 * 수 없다」는 사실이라, 화면은 그 사유를 말하고 발행·미리보기까지만 진행한다.
 */
export interface RenditionShell {
  save: (bytes: Uint8Array, label: string, now: string, format: 'png' | 'pdf') => Promise<string>;
}

interface ShellCarrier {
  pop?: { rendition?: RenditionShell };
}

/** 셸 통로를 집는다. 없으면 `null` — 지어내지 않는다. */
export const renditionShell = (): RenditionShell | null => {
  if (typeof window === 'undefined') return null;

  const carrier = window as unknown as ShellCarrier;
  const shell = carrier.pop?.rendition;

  return typeof shell?.save === 'function' ? shell : null;
};

/** 실패에서 사람이 읽을 말을 꺼낸다. 빈 말을 사유로 남기지 않는다. */
export const printFailureReason = (error: unknown): string =>
  error instanceof Error && error.message.trim() !== '' ? error.message : '인쇄 실패';
