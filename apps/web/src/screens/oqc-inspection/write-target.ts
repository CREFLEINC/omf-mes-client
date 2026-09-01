/**
 * 「이 누름이 겨눈 대상」의 서명.
 *
 * ⭐ **되돌릴 수 없는 쓰기가 나가 있는 동안 화면은 계속 움직인다.** 사용자가 다른 의뢰를 고르거나
 * 재검사를 열면, 늦게 도착한 응답이 **누르지도 않은 대상 위에** 「저장했습니다」를 세운다 —
 * 검사자는 안 한 일을 했다고 읽고 자리를 뜬다.
 *
 * 그래서 세 자리를 한 벌로 쓴다:
 *
 * ```
 * write() 호출     → writeTargetRef.current = targetSignatureOf(...)
 * 의뢰 변경 effect → writeTargetRef.current = null      (앞 대상의 쓰기는 이제 남의 것이다)
 * onSuccess 도착   → 겨눈 대상이 그대로일 때만 반영한다
 * ```
 *
 * ⭐ **앞 회차까지 서명에 넣는다.** 같은 의뢰라도 「첫 판정」과 「재검사 회차」는 다른 쓰기다 —
 * 의뢰만 보면 첫 판정이 나가 있는 사이에 재검사를 열었을 때 둘을 같은 것으로 읽는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export type WriteTargetSignature = string;

export const targetSignatureOf = (
  inspectionRequestId: number,
  previousResultId: number | null,
): WriteTargetSignature => `ir:${String(inspectionRequestId)}/prev:${String(previousResultId)}`;
