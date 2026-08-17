/**
 * 진입 맥락 — **주소가 정본이다**(계획 결정 2).
 *
 * 이 화면은 초과 입하 분리에서 넘어온 초과분을 정산하는 자리라, 무엇을 정산하는지가 화면 상태가
 * 아니라 주소에 있어야 한다. 새로고침·뒤로가기·즐겨찾기·공유가 같은 초과분을 열어야 하기 때문이다.
 * 라우터 `state`로 넘기면 그 넷에서 모두 사라진다.
 *
 * **친 값(발주 정보·라인 초안)은 주소에 싣지 않는다.** 글자마다 뒤로가기 기록이 쌓이고,
 * 화면이 진입 맥락과 입력을 같은 통로로 다루게 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  receipt: 'receipt',
  line: 'line',
} as const;

const POSITIVE_INTEGER = /^\d+$/;

/**
 * 못 알아듣는 값은 없는 것으로 본다.
 *
 * 그대로 `Number()`에 넘기면 `NaN`이 조회 경로의 조각으로 나가 요청이 늘 실패하고,
 * 사용자에게는 「이 화면은 안 된다」로만 보인다. 주소를 손으로 고친 경우가 이 자리다.
 */
const readPositiveId = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;
};

/**
 * 정산할 초과 입하 전표. **없으면 맥락이 없는 것이고, 그때는 등록을 잠근다**(계획 결정 3).
 *
 * 「넘어온 전표가 정말 초과분인가」는 판정하지 않는다 — 계약이 그 사실을 내려주지 않는다.
 */
export const readSourceReceiptId = (params: URLSearchParams): number | null =>
  readPositiveId(params, URL_KEYS.receipt);

/** 대상으로 고른 입하 라인. 라인이 한 줄뿐이면 이 값 없이도 그 줄이 대상으로 확정된다. */
export const readSourceLineId = (params: URLSearchParams): number | null =>
  readPositiveId(params, URL_KEYS.line);

/**
 * 고른 줄만 갈아 끼운 주소.
 *
 * **받은 것을 고치지 않는다** — `URLSearchParams`는 가변이라 그대로 고치면 화면이 읽던 값이
 * 렌더 밖에서 바뀐다. 이 결과를 `replace`로 넣어야 선택이 뒤로가기 기록을 쌓지 않는다
 * (사본 체크리스트 1번).
 */
export const withSourceLineId = (
  params: URLSearchParams,
  inboundReceiptLineId: number,
): URLSearchParams => {
  const next = new URLSearchParams(params);
  next.set(URL_KEYS.line, String(inboundReceiptLineId));

  return next;
};
