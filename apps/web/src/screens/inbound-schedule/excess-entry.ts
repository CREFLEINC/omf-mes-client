/**
 * 초과분 연결 창의 주소 키 — **창을 여는 것은 주소다.** 입하 등록 결과의 「초과분 연결」에서 건너오면
 * 창을 연 채로 시작하고, 뒤로가기가 창을 닫는다.
 *
 * | 키 | 뜻 |
 * | --- | --- |
 * | `excess=1` | 창을 연다 |
 * | `excessReceipt` | 이 입하번호의 초과분을 앞에 세운다 — 방금 등록한 전표 |
 * | `excessReceiptLine` | 이 입하 줄의 초과분을 고른 채로 연다 |
 * | `excessLine` | 이 P/O 라인을 고른 채로 연다(서버 후보에 있을 때만) |
 */

export interface ExcessEntry {
  receiptNo: string | null;
  inboundReceiptLineId: number | null;
  purchaseOrderLineId: number | null;
}

/*
 * `excessTab` · `excessId` 는 옛 키다(「연결됨」 탭 · 옛 초과분 번호). 읽지 않되 창을 닫거나 새로 열 때 함께 뗀다 —
 * 즐겨찾기에 남은 옛 주소가 다음 주소로 따라오지 않게.
 */
const EXCESS_KEYS = [
  'excess',
  'excessReceipt',
  'excessReceiptLine',
  'excessLine',
  'excessTab',
  'excessId',
] as const;

const readId = (raw: string | null): number | null => {
  if (raw === null || !/^[1-9]\d{0,15}$/.test(raw)) return null;

  return Number(raw);
};

/** 창이 닫혀 있으면 `null`. */
export const readExcessEntry = (params: URLSearchParams): ExcessEntry | null => {
  if (params.get('excess') !== '1') return null;

  const receiptNo = params.get('excessReceipt')?.trim() ?? '';

  return {
    receiptNo: receiptNo === '' ? null : receiptNo,
    inboundReceiptLineId: readId(params.get('excessReceiptLine')),
    purchaseOrderLineId: readId(params.get('excessLine')),
  };
};

/** 지금 주소에 창 키를 얹는다 — 조회 조건·고른 발주는 그대로 둔다. */
export const withExcessEntry = (
  params: URLSearchParams,
  entry: Partial<ExcessEntry> = {},
): URLSearchParams => {
  const next = withoutExcessEntry(params);
  next.set('excess', '1');
  if (entry.receiptNo != null) next.set('excessReceipt', entry.receiptNo);
  if (entry.inboundReceiptLineId != null) {
    next.set('excessReceiptLine', String(entry.inboundReceiptLineId));
  }
  if (entry.purchaseOrderLineId != null) next.set('excessLine', String(entry.purchaseOrderLineId));

  return next;
};

export const withoutExcessEntry = (params: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(params);
  for (const key of EXCESS_KEYS) next.delete(key);

  return next;
};
