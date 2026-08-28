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
 * 단말·공정을 담는 키.
 *
 * ⚠ **여기가 임시 이음매다.** 게이팅 조회는 경로에 단말 번호를, 판정에 공정 번호를 요구하는데
 * **화면이 그 둘을 아는 자리가 이 저장소에 아직 없다** — 단말 번호는 단말 토큰의 주체이고
 * 그것을 다루는 것은 셸의 몫이다. 셸이 서면 이 두 줄이 그 자리에서 오도록 바꾼다.
 *
 * ⛔ **없으면 지어내지 않는다.** 값이 없으면 게이팅을 「확인할 수 없음」이 아니라
 * 「단말을 모른다」로 말하고 투입 확정을 막는다 — 모르는 것을 통과로 처리하지 않는다(F-6).
 */
export const TERMINAL_PARAM = 'terminalId';
export const PROCESS_PARAM = 'processId';

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

/** 게이팅 조회가 경로로 요구하는 단말 번호. 위 「임시 이음매」 참조. */
export const readTerminalId = (params: URLSearchParams): number | null =>
  readPositiveId(params, TERMINAL_PARAM);

/** 게이팅 판정의 대상 공정. 단말 하나가 여러 공정을 갖는다. */
export const readProcessId = (params: URLSearchParams): number | null =>
  readPositiveId(params, PROCESS_PARAM);
