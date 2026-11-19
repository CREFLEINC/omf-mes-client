/**
 * 인쇄 — **발행과 갈라진 세 걸음**(스펙 §6 · K-4).
 *
 * ```
 * ① 발행 기록을 만든다        POST /app/document-issues        (mutations.ts)
 * ② 라벨을 그린다             POP 이 직접(packing-label.ts — 포장 라벨은 서버가 그리지 않는다)
 * ③ 셸이 프린터로 보낸다       window.pop.rendition.save
 * ④ 결과를 보고한다            POST /app/document-issues/{id}:report-print
 * ```
 *
 * ⛔ **발행과 인쇄를 한 호출로 묶지 않는다.** 인쇄가 실패해도 발행 기록은 남아야 하고, 그
 * 사실이 곧 재인쇄로 복구할 수 있다는 뜻이다.
 *
 * ⛔ **셸이 출력물을 다시 그리지 않는다.** 화면이 만든 바이트를 그대로 넘긴다.
 *
 * ⭐ **② 와 ③ 사이에 미리보기가 선다** — 이 화면만의 걸음이다(스펙 §3 액션바 · 착수 이슈 §6
 * 「발행 → 미리보기 → 인쇄」). 발행 전 미리보기는 같은 판을 화면에서 그려 보여 줄 뿐 기록을
 * 만들지 않는다(#295 시안 「라벨 발행 미리 보기」).
 */

/*
 * ③ 의 통로(`window.pop.rendition`)는 `patterns/pop-print` 가 갖는다 — 화면마다 선언하던
 * 것을 한 곳으로 모았다. 관리웹(브라우저)에는 그 통로가 없고, 없는 것은 오류가 아니라
 * 「여기서는 프린터로 보낼 수 없다」는 사실이다.
 */

/** 실패에서 사람이 읽을 말을 꺼낸다. 빈 말을 사유로 남기지 않는다. */
export const printFailureReason = (error: unknown): string =>
  error instanceof Error && error.message.trim() !== '' ? error.message : '인쇄 실패';
