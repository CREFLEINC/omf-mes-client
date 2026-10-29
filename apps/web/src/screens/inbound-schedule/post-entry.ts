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
