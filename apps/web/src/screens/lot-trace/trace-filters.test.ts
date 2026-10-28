import { describe, expect, it } from 'vitest';

import {
  backwardQuery,
  forwardQuery,
  hasExactEntry,
  openLotParams,
  pathTo,
  readPath,
  readTab,
  readTraceFilters,
  readTraceSelected,
  toTraceSearchParams,
  tracePeriodReason,
  type PathStep,
} from './trace-filters';

const params = (query: string) => new URLSearchParams(query);

describe('추적 탭 주소 조건', () => {
  it('탭은 처음 기간별 이력(movements)이다. 종전 주소 값은 그대로 읽는다', () => {
    expect(readTab(params(''))).toBe('movements');
    expect(readTab(params('tab=forward'))).toBe('forward');
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

  it('주소의 깨진 값은 버린다: 숫자가 아닌 selected, 모양이 틀린 via, selected 없는 via', () => {
    expect(readTraceSelected(params('selected=abc'))).toBeNull();
    expect(readTraceSelected(params('selected=0'))).toBeNull();
    expect(readTraceSelected(params('selected=12'))).toBe(12);
    expect(
      readPath(params('selected=12&via=X~1~A&via=M~abc~A&via=M~5~&via=P~7~P-1&via=M~0~B')),
    ).toEqual([{ lotType: 'PRODUCTION', lotId: 7, lotNo: 'P-1' }]);
    expect(readPath(params('via=M~5~A'))).toEqual([]);
  });

  it('[보기]의 경로: 이미 지나온 LOT이면 그 자리까지 되돌려 경로가 돌며 늘지 않는다', () => {
    const m: PathStep = { lotType: 'MATERIAL', lotId: 101, lotNo: 'M-1' };
    const p: PathStep = { lotType: 'PRODUCTION', lotId: 201, lotNo: 'P-1' };
    const q: PathStep = { lotType: 'PRODUCTION', lotId: 301, lotNo: 'P-2' };
    expect(pathTo([], m, p)).toEqual([m]);
    expect(pathTo([m], p, q)).toEqual([m, p]);
    /* M → P → 다시 M: 경로는 비고 M이 가운데다. */
    expect(pathTo([m], p, m)).toEqual([]);
    expect(pathTo([m, p], q, p)).toEqual([m]);
  });

  it('읽고 쓰면 같은 주소가 된다(제품 LOT 탭)', () => {
    const query =
      'tab=backward&q=P&item=6&sh=SH-1&wo=WO-1&from=2026-10-01&to=2026-10-26&axis=SHIPPED&partner=5&stage=SHIPPED&page=2';
    expect(
      toTraceSearchParams('backward', readTraceFilters('backward', params(query))).toString(),
    ).toBe(query);
  });

  it('기간만으로 부른다. 정확 일치 번호면 기간은 선택이다', () => {
    expect(tracePeriodReason(readTraceFilters('forward', params('from=2026-10-01')))).toBeNull();
    expect(tracePeriodReason(readTraceFilters('backward', params('')))).toBe(
      '기간 시작일을 고르세요',
    );
    expect(hasExactEntry(readTraceFilters('backward', params('wo=WO-1')))).toBe(true);
    expect(hasExactEntry(readTraceFilters('forward', params('q=A&item=3')))).toBe(false);
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
