/**
 * 「초과분 발주 연결」 탭의 주소(사용자 지시 2026-10-28 — 입고 관리의 오른쪽 창을 탭 화면으로 뗐다). 입고 관리 라인 표의
 * 「초과분」 칸이나 입하 등록 결과의 「초과분 연결」에서 건너오면 그 초과분 · 라인을 고른 채로 시작한다.
 *
 * | 키 | 뜻 |
 * | --- | --- |
 * | `receipt` | 이 입하번호의 초과분을 앞에 세운다 — 방금 등록한 전표 |
 * | `receiptLine` | 이 입하 줄의 초과분을 고른 채로 연다 |
 * | `line` | 이 P/O 라인을 고른 채로 연다(서버 후보에 있을 때만) |
 * | `po` | 입고 관리에서 보던 발주 — 그 발주의 후보 라인에 표식을 단다 |
 */

export const EXCESS_TAB_PATH = '/logistics/inbound-excess';

export interface ExcessEntry {
  receiptNo: string | null;
  inboundReceiptLineId: number | null;
  purchaseOrderLineId: number | null;
  purchaseOrderId: number | null;
}

const readId = (raw: string | null): number | null => {
  if (raw === null || !/^[1-9]\d{0,15}$/.test(raw)) return null;

  return Number(raw);
};

const readText = (raw: string | null): string | null => {
  const text = raw?.trim() ?? '';

  return text === '' ? null : text;
};

/** 탭 주소의 시작 상태. */
export const readExcessEntry = (params: URLSearchParams): ExcessEntry => ({
  receiptNo: readText(params.get('receipt')),
  inboundReceiptLineId: readId(params.get('receiptLine')),
  purchaseOrderLineId: readId(params.get('line')),
  purchaseOrderId: readId(params.get('po')),
});

/** 탭으로 가는 주소 — 빈 값은 키를 싣지 않는다. */
export const excessTabHref = (entry: Partial<ExcessEntry> = {}): string => {
  const params = new URLSearchParams();
  if (entry.receiptNo != null) params.set('receipt', entry.receiptNo);
  if (entry.inboundReceiptLineId != null) {
    params.set('receiptLine', String(entry.inboundReceiptLineId));
  }
  if (entry.purchaseOrderLineId != null) params.set('line', String(entry.purchaseOrderLineId));
  if (entry.purchaseOrderId != null) params.set('po', String(entry.purchaseOrderId));
  const query = params.toString();

  return query === '' ? EXCESS_TAB_PATH : `${EXCESS_TAB_PATH}?${query}`;
};

/**
 * 옛 창 주소(입고 관리 `?excess=1&excessReceipt=…&excessReceiptLine=…&excessLine=…`) — 즐겨찾기 · 공유한 주소가 죽지 않게
 * 탭으로 옮긴다. 창 키가 없으면 `null`.
 */
export const readLegacyExcessEntry = (params: URLSearchParams): ExcessEntry | null => {
  if (params.get('excess') !== '1') return null;

  return {
    receiptNo: readText(params.get('excessReceipt')),
    inboundReceiptLineId: readId(params.get('excessReceiptLine')),
    purchaseOrderLineId: readId(params.get('excessLine')),
    purchaseOrderId: readId(params.get('po')),
  };
};
