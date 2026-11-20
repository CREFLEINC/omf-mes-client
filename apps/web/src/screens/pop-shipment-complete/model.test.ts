import type { ApiError } from '@omf-mes/api-client';
import { ko, setLocale, vi } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { POP_SCREENS } from '../../patterns/pop-screen-catalog';

import { completion, requestRow } from './fixtures';
import {
  STAGING_ROLE,
  blockersOfConflict,
  completeFailureOf,
  directCodeOf,
  groupBlockers,
  isAlreadyCompleted,
  isCompletable,
  lookupFailureOf,
  minusDays,
  orderSearchRows,
  overText,
  portionSummaryOf,
  qtyWithUom,
  searchQueryOf,
  toSearchRow,
  totalsOf,
  uomOf,
} from './model';

/** P-04-07 출하 완료 — 화면 규칙(피처 010 · omf-all-around#305). */

describe('P-04-07 막는 이유 묶기', () => {
  it('US1-4·US1-7·Q8 — 같은 이유는 한 카드로 묶고 피킹 → 미검사 → 불합격 순서로 선다', () => {
    const groups = groupBlockers([
      { code: 'REJECTED', lotNo: 'P-3' },
      { code: 'NOT_INSPECTED', lotNo: 'P-2' },
      { code: 'PICKING_SHORT', lineNo: 2 },
      { code: 'NOT_INSPECTED', lotNo: 'P-5' },
    ]);

    expect(groups).toEqual([
      { code: 'PICKING_SHORT', lineNos: [2], lotNos: [] },
      { code: 'NOT_INSPECTED', lineNos: [], lotNos: ['P-2', 'P-5'] },
      { code: 'REJECTED', lineNos: [], lotNos: ['P-3'] },
    ]);
  });

  it('US1-6·Q11 — 이미 완료는 막는 이유 카드가 아니다', () => {
    expect(groupBlockers([{ code: 'ALREADY_COMPLETED' }])).toEqual([]);
  });

  it('US1-3 — 막는 이유가 없으면 완료할 수 있고, 완료된 출하가 있으면 이미 완료다', () => {
    expect(isCompletable(completion())).toBe(true);
    expect(isCompletable(completion({ blockers: [{ code: 'HELD', lotNo: 'P-1' }] }))).toBe(false);

    const done = completion({
      completedShipment: {
        shipmentId: 9,
        shipmentNo: 'SH-1',
        completedAt: '2026-11-18T07:32:00Z',
        completedTerminal: null,
        completedWorker: null,
      },
    });
    expect(isAlreadyCompleted(done)).toBe(true);
    expect(isCompletable(done)).toBe(false);
  });
});

describe('P-04-07 합계와 초과', () => {
  it('US4-5 — 합계는 라인 피킹 합, 초과는 넘은 라인만 더한다', () => {
    expect(totalsOf(completion())).toEqual({ qty: 160, over: 10, lineCount: 2, lotCount: 4 });
  });

  it('US1-1 — 초과는 「+n」, 못 미치거나 같으면 「0」', () => {
    expect(overText(10)).toBe('+10');
    expect(overText(0)).toBe('0');
    expect(overText(-20)).toBe('0');
  });
});

describe('P-04-07 실패 가르기', () => {
  const validation = (code: string, status: number): ApiError => ({
    kind: 'validation',
    status,
    errors: [{ code, message: '' }] as never,
  });

  it('US4-3·Q10 — 지시서 코드가 아닌 값과 없는 지시서를 가른다', () => {
    expect(lookupFailureOf(validation('NOT_SHIPMENT_REQUEST_CODE', 400))).toBe('notCode');
    expect(lookupFailureOf(validation('SHIPMENT_REQUEST_NOT_FOUND', 404))).toBe('notFound');
    expect(lookupFailureOf({ kind: 'network' })).toBe('failed');
  });

  it('Q11 — 이미 완료 · 막힘 · 바뀜 · 연결 끊김을 가른다', () => {
    const conflict = (code: string): ApiError => ({
      kind: 'conflict',
      cause: 'user',
      code,
      message: '',
    });

    expect(completeFailureOf(conflict('ALREADY_COMPLETED'))).toBe('alreadyCompleted');
    expect(completeFailureOf(conflict('COMPLETION_BLOCKED'))).toBe('blocked');
    expect(completeFailureOf(conflict('VERSION_CONFLICT'))).toBe('changed');
    expect(completeFailureOf(conflict('INVALID_STATE'))).toBe('changed');
    expect(completeFailureOf({ kind: 'network' })).toBe('network');
    expect(completeFailureOf({ kind: 'http', status: 500 })).toBe('other');
  });
});

describe('P-04-07 찾기 조건', () => {
  it('US4-4·Q10 — 「완료 대기만」이면 completionReadyOnly, 끄면 출하가 남은 지시서만 본다', () => {
    expect(searchQueryOf({ q: ' 가나 ', readyOnly: true, page: 1 }, '2026-11-18')).toEqual({
      shipDateFrom: '2026-10-19',
      q: '가나',
      completionReadyOnly: true,
      sort: 'requestedShipDate',
      page: 1,
      size: 20,
    });
    expect(searchQueryOf({ q: '', readyOnly: false, page: 2 }, '2026-11-18')).toEqual({
      shipDateFrom: '2026-10-19',
      shippableRemainderOnly: true,
      sort: 'requestedShipDate',
      page: 2,
      size: 20,
    });
  });

  it('달력 날짜를 시간대와 무관하게 뺀다(달·해 넘김)', () => {
    expect(minusDays('2026-01-05', 30)).toBe('2025-12-06');
  });

  it('US4-4 — 목록 줄은 막는 이유 요약과 피킹 합계를 갖고, 완료 대기가 먼저 선다', () => {
    const blocked = toSearchRow(
      requestRow({
        shipmentRequestId: 2,
        shipmentRequestNo: 'SR-2',
        completionBlockers: [
          { code: 'NOT_INSPECTED', lotNo: 'P-2' },
          { code: 'PICKING_SHORT', lineNo: 2 },
        ],
        blockerSummary: { NOT_INSPECTED: 1, PICKING_SHORT: 1 },
      }),
    );
    const ready = toSearchRow(requestRow());

    expect(blocked).toMatchObject({
      ready: false,
      blockedCount: 2,
      blockerSummary: [
        { code: 'PICKING_SHORT', count: 1 },
        { code: 'NOT_INSPECTED', count: 1 },
      ],
    });
    expect(ready).toMatchObject({
      ready: true,
      lineCount: 2,
      lotCount: 4,
      picked: 160,
      target: 150,
    });
    expect(orderSearchRows([blocked, ready]).map((row) => row.shipmentRequestNo)).toEqual([
      'SR-261118-001',
      'SR-2',
    ]);
  });
});

describe('LOT 몫 요약·단위·409 막는 이유', () => {
  const portion = (
    warehouseName: string,
    qty: number,
    locationSystemRoleCode: string | null = null,
  ) => ({
    warehouseId: warehouseName === 'A' ? 1 : 2,
    warehouseCode: warehouseName,
    warehouseName,
    locationId: qty,
    locationCode: `L-${String(qty)}`,
    locationSystemRoleCode,
    qty,
  });

  it('US4-5 한 창고 한 자리는 요약하지 않고, 여러 창고는 창고별 합, 적치 대기 자리는 따로 센다', () => {
    expect(portionSummaryOf([portion('A', 40)])).toBeNull();
    expect(portionSummaryOf([portion('A', 20), portion('B', 20)])).toEqual({
      warehouses: [
        { name: 'A', qty: 20, staging: 0 },
        { name: 'B', qty: 20, staging: 0 },
      ],
      staging: 0,
    });
    expect(portionSummaryOf([portion('A', 20), portion('A', 10, STAGING_ROLE)])).toEqual({
      warehouses: [{ name: 'A', qty: 30, staging: 10 }],
      staging: 10,
    });
  });

  it('Q2 적치 대기 몫은 그 몫이 있는 창고에만 붙는다 — 다른 창고 몫에 섞이지 않는다', () => {
    expect(
      portionSummaryOf([portion('A', 25), portion('A', 5, STAGING_ROLE), portion('B', 10)]),
    ).toEqual({
      warehouses: [
        { name: 'A', qty: 30, staging: 5 },
        { name: 'B', qty: 10, staging: 0 },
      ],
      staging: 5,
    });
  });

  it('US4-5 라인 단위가 하나면 합계에 붙이고, 섞이면 붙이지 않는다', () => {
    expect(uomOf(completion())).toBe('EA');
    expect(qtyWithUom(160, 'EA')).toBe('160 EA');
    const mixed = completion();
    expect(
      uomOf({
        ...mixed,
        lines: mixed.lines.map((line, index) => ({ ...line, uomCode: index === 0 ? 'EA' : 'KG' })),
      }),
    ).toBe('');
    expect(qtyWithUom(160, '')).toBe('160');
  });

  it('US4-6 409 충돌의 막는 이유를 계약 코드만 남겨 꺼낸다 — 없으면 null', () => {
    expect(
      blockersOfConflict({
        kind: 'conflict',
        cause: 'user',
        code: 'COMPLETION_BLOCKED',
        message: '',
        blockers: [{ code: 'REJECTED', lotNo: 'P-1' }, { code: 'UNKNOWN' }],
      }),
    ).toEqual([{ code: 'REJECTED', lotNo: 'P-1' }]);
    expect(blockersOfConflict({ kind: 'conflict', cause: 'user', message: '' })).toBeNull();
    expect(blockersOfConflict({ kind: 'network' })).toBeNull();
  });
});

describe('둘러보기 보완(T055)', () => {
  it('US4-3·W-2 [직접 입력] 값 — 지시서 번호만이면 SHPREQ: 를 붙이고, 이미 코드면 그대로', () => {
    expect(directCodeOf(' SR-261118-001 ')).toBe('SHPREQ:SR-261118-001');
    expect(directCodeOf('SHPREQ:SR-261118-001')).toBe('SHPREQ:SR-261118-001');
    expect(directCodeOf('shpreq:SR-261118-001')).toBe('SHPREQ:SR-261118-001');
  });

  it('W-7 「출하 완료」 탭 이름은 단말 언어를 따른다 — 다른 탭은 그대로', () => {
    const entry = POP_SCREENS.find((screen) => screen.code === 'P-04-07');
    const rework = POP_SCREENS.find((screen) => screen.code === 'P-04-03');
    try {
      setLocale('vi');
      expect(entry?.name).toBe(vi.popShipmentComplete.title);
      expect(rework?.name).toBe('재작업 실적 등록');
    } finally {
      setLocale('ko');
    }
    expect(entry?.name).toBe(ko.popShipmentComplete.title);
  });
});
