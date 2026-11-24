import { describe, expect, it } from 'vitest';

import {
  SCAN_CAP,
  applyScan,
  conditionRows,
  initialListState,
  startCondition,
  type LotListState,
} from './lot-list-state';
import type { TraceLotRow, TraceStartMatch } from './types';

const row = (lotId: number, lotNo = `LOT-${String(lotId)}`): TraceLotRow => ({
  lot: {
    lotId,
    lotNo,
    lotTypeCode: 'MATERIAL',
    statusCode: 'NORMAL',
    lifecycleStatusCode: 'ACTIVE',
  },
  item: { itemId: 1, code: 'ITEM-A', name: '품목 A' },
  qty: 100,
  uomCode: 'EA',
  partner: null,
  inboundLotNo: null,
  sortDate: null,
  sortDateKind: null,
});

const match = (
  matchedBy: TraceStartMatch['matchedBy'],
  label: string,
  lots: TraceLotRow[],
  extra: Partial<TraceStartMatch> = {},
): TraceStartMatch => ({
  matchedBy,
  label,
  serialNo: null,
  otherDirection: false,
  truncated: false,
  lots,
  ...extra,
});

const scanState = (...ids: number[]): LotListState => ({
  ...initialListState,
  mode: 'SCAN',
  entries: ids.map((id) => ({ row: row(id), source: null, serialNo: null })),
});

describe('LOT 목록 상태(data-model §4)', () => {
  it('Q1 처음은 최근 목록이고 아무것도 고르지 않는다', () => {
    expect(initialListState.mode).toBe('RECENT');
    expect(initialListState.entries).toEqual([]);
  });

  it('Q5 최근 목록에서 스캔하면 비우고 넣는다 — LOT 하나면 고른다', () => {
    const out = applyScan(initialListState, [match('MATERIAL_LOT_NO', 'A', [row(1, 'A')])]);
    expect(out.state.mode).toBe('SCAN');
    expect(out.state.entries.map((entry) => entry.row.lot.lotId)).toEqual([1]);
    expect(out.select?.row.lot.lotId).toBe(1);
    expect(out.notice).toEqual({
      kind: 'added',
      added: 1,
      label: 'A',
      matchedBy: 'MATERIAL_LOT_NO',
      selected: true,
    });
  });

  it('Q5 조건 목록에서 스캔해도 비우고 넣는다(조건은 풀린다)', () => {
    const condition = startCondition({ partnerId: 5, from: '2026-11-01', to: '2026-11-24' });
    const out = applyScan(condition, [match('MATERIAL_LOT_NO', 'B', [row(2, 'B')])]);
    expect(out.state.mode).toBe('SCAN');
    expect(out.state.condition).toBeNull();
    expect(out.state.entries.map((entry) => entry.row.lot.lotId)).toEqual([2]);
  });

  it('US3-3 스캔 상태에서 이어 스캔하면 아래에 쌓고 그 LOT 을 고른다', () => {
    const out = applyScan(scanState(1), [match('MATERIAL_LOT_NO', 'B', [row(2, 'B')])]);
    expect(out.state.entries.map((entry) => entry.row.lot.lotId)).toEqual([1, 2]);
    expect(out.select?.row.lot.lotId).toBe(2);
  });

  it('US3-3 이미 있는 LOT 을 다시 스캔하면 더하지 않고 고른다', () => {
    const before = scanState(1, 2);
    const out = applyScan(before, [match('MATERIAL_LOT_NO', 'LOT-1', [row(1)])]);
    expect(out.state.entries.map((entry) => entry.row.lot.lotId)).toEqual([1, 2]);
    expect(out.select?.row.lot.lotId).toBe(1);
    expect(out.notice).toEqual({ kind: 'existing', label: 'LOT-1', matchedBy: 'MATERIAL_LOT_NO' });
  });

  it('Q6 묶음 번호는 없는 것만 더하고 고르지 않는다', () => {
    const out = applyScan(scanState(1), [
      match('INBOUND_LOT_NO', 'IL-1', [row(1), row(3), row(4)]),
    ]);
    expect(out.state.entries.map((entry) => entry.row.lot.lotId)).toEqual([1, 3, 4]);
    expect(out.select).toBeNull();
    expect(out.state.entries[1]?.source).toEqual({ matchedBy: 'INBOUND_LOT_NO', label: 'IL-1' });
    expect(out.notice).toMatchObject({ kind: 'added', added: 2, selected: false });
  });

  it('Q6 묶음 번호라도 더해진 LOT 이 하나뿐이면 그 LOT 을 고른다', () => {
    const out = applyScan(scanState(1, 3), [match('SUPPLIER_LOT_NO', 'SUP-A', [row(1), row(5)])]);
    expect(out.state.entries.map((entry) => entry.row.lot.lotId)).toEqual([1, 3, 5]);
    expect(out.select?.row.lot.lotId).toBe(5);
  });

  it('Q6 묶음 번호의 LOT 이 모두 이미 있으면 목록은 그대로, 고르지 않는다', () => {
    const before = scanState(1, 3);
    const out = applyScan(before, [match('INBOUND_LOT_NO', 'IL-1', [row(1), row(3)])]);
    expect(out.state.entries).toBe(before.entries);
    expect(out.select).toBeNull();
  });

  it('US2-2 출하번호로 여러 LOT 이 들어오면 고르지 않고 줄마다 출하번호를 단다', () => {
    const out = applyScan(initialListState, [match('SHIPMENT_NO', 'SH-1', [row(7), row(8)])]);
    expect(out.select).toBeNull();
    expect(out.state.entries.map((entry) => entry.source?.label)).toEqual(['SH-1', 'SH-1']);
  });

  it('US2-3 시리얼은 그 LOT 을 고르고 시리얼을 줄에 둔다', () => {
    const out = applyScan(initialListState, [
      match('SERIAL_NO', 'SN-1', [row(9)], { serialNo: 'SN-1' }),
    ]);
    expect(out.select).toMatchObject({ serialNo: 'SN-1', row: { lot: { lotId: 9 } } });
    expect(out.state.entries[0]?.serialNo).toBe('SN-1');
  });

  it('Q14 찾을 수 없는 번호는 목록과 고른 것을 그대로 둔다', () => {
    const before = scanState(1);
    const out = applyScan(before, []);
    expect(out.state).toBe(before);
    expect(out.select).toBeNull();
    expect(out.notice).toEqual({ kind: 'notFound' });
  });

  it('Q13 반대 방향 번호는 목록을 바꾸지 않고 그 LOT 을 알린다', () => {
    const before = scanState(1);
    const out = applyScan(before, [
      match('PRODUCT_LOT_NO', 'P3', [row(30, 'P3')], { otherDirection: true }),
    ]);
    expect(out.state).toBe(before);
    expect(out.select).toBeNull();
    expect(out.notice).toEqual({ kind: 'otherDirection', label: 'P3', lotId: 30 });
  });

  it('Q13 같은 번호에 바른 방향 묶음이 함께 있으면 그것만 쓴다', () => {
    const out = applyScan(initialListState, [
      match('MATERIAL_LOT_NO', 'X', [row(30, 'X')], { otherDirection: true }),
      match('INBOUND_LOT_NO', 'X', [row(31), row(32)]),
    ]);
    expect(out.state.entries.map((entry) => entry.row.lot.lotId)).toEqual([31, 32]);
  });

  it(`경계-스캔 상한 ${String(SCAN_CAP)}개를 넘는 LOT 은 넣지 않고 「목록이 가득 찼습니다」`, () => {
    const full = scanState(...Array.from({ length: SCAN_CAP - 1 }, (_, index) => index + 1));
    const out = applyScan(full, [
      match('INBOUND_LOT_NO', 'IL-9', [row(1001), row(1002), row(1003)]),
    ]);
    expect(out.state.entries).toHaveLength(SCAN_CAP);
    expect(out.state.entries.at(-1)?.row.lot.lotId).toBe(1001);
    expect(out.notice).toEqual({ kind: 'full', skipped: 2, label: 'IL-9' });
    expect(out.select).toBeNull();
  });

  it('경계-스캔 상한 가득 찬 목록에 새 LOT 하나를 스캔하면 고르지 않는다', () => {
    const full = scanState(...Array.from({ length: SCAN_CAP }, (_, index) => index + 1));
    const out = applyScan(full, [match('MATERIAL_LOT_NO', 'Z', [row(5000, 'Z')])]);
    expect(out.state.entries).toHaveLength(SCAN_CAP);
    expect(out.select).toBeNull();
    expect(out.notice).toEqual({ kind: 'full', skipped: 1, label: 'Z' });
  });

  it('Q8 [최근 목록으로]는 스캔 목록과 조건을 지운다', () => {
    expect(startCondition({ partnerId: 1, from: '2026-11-01', to: '2026-11-02' }).mode).toBe(
      'CONDITION',
    );
    expect(initialListState).toEqual({ mode: 'RECENT', condition: null, entries: [] });
  });

  it('Q7 조건 결과는 [더 보기]로 받은 쪽을 차례로 붙이고 겹친 LOT 은 한 번만 둔다', () => {
    const pages = [
      { mode: 'CONDITION' as const, items: [row(1), row(2)], page: { page: 1, size: 2, total: 3 } },
      { mode: 'CONDITION' as const, items: [row(2), row(3)], page: { page: 2, size: 2, total: 3 } },
    ];
    expect(conditionRows(pages).map((entry) => entry.row.lot.lotId)).toEqual([1, 2, 3]);
  });
});
