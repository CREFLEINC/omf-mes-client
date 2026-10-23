import { withoutExcessEntry } from './excess-entry';

/**
 * 「입하 등록」 창의 주소 키 — **창을 여는 것은 주소다.** 새로고침·뒤로가기·공유가 같은 창을 연다.
 *
 * | 키 | 뜻 |
 * | --- | --- |
 * | `register=1` | 창을 연다 |
 * | `po` | 받을 발주 — 목록에서 고른 발주와 같은 키다 |
 *
 * 옛 「초과 입하 분리」 주소(`/logistics/over-receipt-split?po=…`)도 이 두 키로 옮겨 온다(`routes/index.tsx`).
 * **창은 목록 결과에 기대지 않는다** — 조건 밖의 발주(다 받은 발주 등)도 번호만으로 연다.
 */
const PO_ID = /^[1-9]\d{0,15}$/;

/** 창이 닫혀 있거나 발주 번호가 없으면 `null`. */
export const readRegisterEntry = (params: URLSearchParams): number | null => {
  if (params.get('register') !== '1') return null;

  const raw = params.get('po');

  return raw !== null && PO_ID.test(raw) ? Number(raw) : null;
};

/** 그 발주로 창을 연다 — 조회 조건은 그대로 두고, 연결 창은 닫는다(창은 한 번에 하나다). */
export const withRegisterEntry = (
  params: URLSearchParams,
  purchaseOrderId: number,
): URLSearchParams => {
  const next = withoutExcessEntry(params);
  next.set('po', String(purchaseOrderId));
  next.set('register', '1');

  return next;
};

export const withoutRegisterEntry = (params: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(params);
  next.delete('register');

  return next;
};
