import { describe, expect, it } from 'vitest';

import {
  backwardQuery,
  forwardQuery,
  hasEntry,
  openLotParams,
  readPath,
  readTab,
  readTraceFilters,
  toTraceSearchParams,
  tracePeriodReason,
} from './trace-filters';

const params = (query: string) => new URLSearchParams(query);

describe('추적 탭 주소 조건', () => {
  it('탭은 처음 자재 LOT(forward)이다', () => {
    expect(readTab(params(''))).toBe('forward');
    expect(readTab(params('tab=backward'))).toBe('backward');
    expect(readTab(params('tab=movements'))).toBe('movements');
  });

  it('경로는 LOT 종류, 번호, LOT 번호(구분자가 든 번호 포함)를 그대로 되읽는다', () => {
    const query = openLotParams('backward', { lotId: 201, lotNo: 'P-1' }, [
      { lotType: 'MATERIAL', lotId: 101, lotNo: 'A|500|~|1' },
    ]);
    expect(readPath(query)).toEqual([{ lotType: 'MATERIAL', lotId: 101, lotNo: 'A|500|~|1' }]);
    expect(query.get('tab')).toBe('backward');
    expect(query.get('lot')).toBe('P-1');
    expect(query.get('selected')).toBe('201');
  });

  it('읽고 쓰면 같은 주소가 된다(제품 LOT 탭)', () => {
    const query =
      'tab=backward&q=P&item=6&sh=SH-1&wo=WO-1&from=2026-10-01&to=2026-10-26&axis=SHIPPED&partner=5&stage=SHIPPED&page=2';
    expect(
      toTraceSearchParams('backward', readTraceFilters('backward', params(query))).toString(),
    ).toBe(query);
  });

  it('진입점이 없으면 부르지 않는다. 정확 일치 진입점이면 기간은 선택이다', () => {
    const none = readTraceFilters('forward', params('from=2026-10-01'));
    expect(hasEntry(none)).toBe(false);
    expect(tracePeriodReason(readTraceFilters('forward', params('lot=A')))).toBeNull();
    expect(tracePeriodReason(readTraceFilters('forward', params('q=A')))).toBe(
      '기간 시작일을 고르세요',
    );
  });
});

describe('추적 질의', () => {
  it('정방향: 입고 기간과 공급사, 창고, 단계 하나', () => {
    const filters = readTraceFilters(
      'forward',
      params('q=A&ir=IR-1&from=2026-10-01&partner=3&wh=2&stage=SHIPPED'),
    );
    expect(forwardQuery(filters, 1, 50)).toEqual({
      q: 'A',
      inboundReceiptNo: 'IR-1',
      receiptDateFrom: '2026-10-01',
      supplierId: 3,
      warehouseId: 2,
      currentStageCode: ['SHIPPED'],
      page: 1,
      size: 50,
    });
  });

  it('역방향: 기간이 있을 때만 기간 기준을 보낸다', () => {
    expect(backwardQuery(readTraceFilters('backward', params('wo=WO-1')), 1, 50)).toEqual({
      workOrderNo: 'WO-1',
      page: 1,
      size: 50,
    });
    expect(
      backwardQuery(
        readTraceFilters('backward', params('q=P&from=2026-10-01&axis=SHIPPED')),
        1,
        50,
      ),
    ).toMatchObject({ dateAxis: 'SHIPPED', dateFrom: '2026-10-01' });
  });
});
