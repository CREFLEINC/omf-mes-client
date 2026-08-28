/**
 * 이 화면이 주소에서 읽는 값.
 *
 * **작업지시는 주소가 소유한다.** POP에서 작업지시를 고르는 자리는 `P-02-01`(작업 시작)이고
 * 그 화면이 이 저장소에 아직 없다 — 그때까지 진입 경로는 주소뿐이며, 붙었을 때도 넘기는
 * 방식은 같은 주소 키다.
 *
 * ⛔ **작업지시를 기억해 두지 않는다.** 앞서 본 작업지시를 화면이 들고 있으면 주소만 보고는
 * 무엇을 투입하는 화면인지 알 수 없게 되고, 단말을 넘겨받은 다음 작업자가 **남의 작업지시에
 * 자재를 투입한다.**
 */

/** 주소가 작업지시를 담는 키. */
export const WORK_ORDER_PARAM = 'workOrderId';

/**
 * 주소에서 작업지시 번호를 읽는다. 읽을 수 없으면 `null`이다.
 *
 * **양의 정수만 받는다.** 계약이 `int64`를 요구하므로 소수·음수·0은 있을 수 없는 값이고,
 * 그대로 조회에 실으면 서버가 거절할 요청을 화면이 한 번 더 만든다. `Number`는 빈 문자열을
 * 0으로, 공백을 0으로 읽으므로 **자릿수 검사를 먼저 한다.**
 */
const readPositiveId = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key);
  if (raw === null || !/^\d+$/.test(raw)) return null;

  const value = Number(raw);

  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

export const readWorkOrderId = (params: URLSearchParams): number | null =>
  readPositiveId(params, WORK_ORDER_PARAM);
