/**
 * 「입고 처리」 창의 주소 키 — `post=<LOT 번호(내부)>`. 창은 주소가 연다(새로고침·뒤로가기에도 같은 창).
 * 다른 창(`register` · `excess`)과 한 번에 하나만 선다 — 여는 쪽이 다른 키를 걷는다.
 */
const KEY = 'post';

const POSITIVE_INTEGER = /^\d+$/;

/** 주소의 LOT 번호. 양의 정수가 아니면 창이 없다. */
export const readPostEntry = (params: URLSearchParams): number | null => {
  const raw = params.get(KEY) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;
};

export const withPostEntry = (params: URLSearchParams, lotId: number): URLSearchParams => {
  const next = new URLSearchParams(params);
  next.set(KEY, String(lotId));

  return next;
};

export const withoutPostEntry = (params: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(params);
  next.delete(KEY);

  return next;
};

/**
 * 「검사 불합격(IQC)」 알림이 여는 주소 — `lot=<LOT 번호(내부)>`. 알림은 LOT 만 알고 발주를 모르므로 목록을 그 LOT 이
 * 입하된 발주로 좁힌다(기간·조건 없이). 다른 조건으로 조회하면 주소를 새로 쓰므로 이 키는 사라진다.
 */
export const readLotEntry = (params: URLSearchParams): number | null => {
  const raw = params.get('lot') ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;
};
