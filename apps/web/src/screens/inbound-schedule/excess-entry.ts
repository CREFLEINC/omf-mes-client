/**
 * 초과분 연결 창의 주소 키 — **창을 여는 것은 주소다.** 「초과 입하 분리」의 등록 결과가 이 화면으로 건너와
 * 창을 연 채로 시작하고, 뒤로가기가 창을 닫는다.
 *
 * | 키 | 뜻 |
 * | --- | --- |
 * | `excess=1` | 창을 연다 |
 * | `excessTab=linked` | 「연결됨」 탭으로 연다(없으면 「미연결」) |
 * | `excessReceipt` | 이 입하번호의 초과분을 앞에 세운다 — 방금 등록한 전표 |
 * | `excessId` | 이 초과분을 고른 채로 연다 |
 * | `excessLine` | 이 P/O 라인을 고른 채로 연다(서버 후보에 있을 때만) |
 */

export type ExcessTab = 'unlinked' | 'linked';

export interface ExcessEntry {
  tab: ExcessTab;
  receiptNo: string | null;
  excessId: number | null;
  purchaseOrderLineId: number | null;
}

const EXCESS_KEYS = ['excess', 'excessTab', 'excessReceipt', 'excessId', 'excessLine'] as const;

const readId = (raw: string | null): number | null => {
  if (raw === null || !/^[1-9]\d{0,15}$/.test(raw)) return null;

  return Number(raw);
};

/** 창이 닫혀 있으면 `null`. */
export const readExcessEntry = (params: URLSearchParams): ExcessEntry | null => {
  if (params.get('excess') !== '1') return null;

  const receiptNo = params.get('excessReceipt')?.trim() ?? '';

  return {
    tab: params.get('excessTab') === 'linked' ? 'linked' : 'unlinked',
    receiptNo: receiptNo === '' ? null : receiptNo,
    excessId: readId(params.get('excessId')),
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
  if (entry.tab === 'linked') next.set('excessTab', 'linked');
  if (entry.receiptNo != null) next.set('excessReceipt', entry.receiptNo);
  if (entry.excessId != null) next.set('excessId', String(entry.excessId));
  if (entry.purchaseOrderLineId != null) next.set('excessLine', String(entry.purchaseOrderLineId));

  return next;
};

export const withoutExcessEntry = (params: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(params);
  for (const key of EXCESS_KEYS) next.delete(key);

  return next;
};
