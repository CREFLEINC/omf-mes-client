import { describe, expect, it, vi } from 'vitest';

import { EXPORT_PAGE_SIZE, escapeCsvField, fetchAllRows, toCsv } from './export';
import type { MovementRow } from './rows';

const row = (id: number, overrides: Partial<MovementRow> = {}): MovementRow => ({
  id,
  kind: 'MATERIAL',
  documentNo: `GR-SYN-${String(id).padStart(4, '0')}`,
  lineNo: 1,
  date: '2026-10-23',
  time: '15:00',
  item: { id: 1, code: 'ITEM-A', name: '품목 A' },
  qty: 500,
  uomCode: 'KG',
  warehouse: { id: 2, code: 'WH-A', name: '창고 A' },
  partner: { id: 3, code: 'SUP-A', name: '공급사 A' },
  workOrderNo: null,
  statusCode: 'POSTED',
  lots: [{ lotId: 10 + id, lotNo: `ITEM-A|500|261023|SUP-A|${String(id)}`, qty: 500 }],
  lotCount: 1,
  ...overrides,
});

const pageOf = (rows: MovementRow[], page: number, total: number) => ({
  rows,
  page: { page, size: EXPORT_PAGE_SIZE, total },
});

describe('엑셀 내보내기 파일(CSV)', () => {
  it('쉼표, 큰따옴표, 줄바꿈이 든 값만 감싼다', () => {
    expect(escapeCsvField('품목 A')).toBe('품목 A');
    expect(escapeCsvField('A, B')).toBe('"A, B"');
    expect(escapeCsvField('5"')).toBe('"5"""');
  });

  it('머리와 줄을 만든다 — 코드 열과 LOT 수를 더하고 상태는 이름으로', () => {
    const csv = toCsv('MATERIAL', [row(1)], (code) => (code === 'POSTED' ? '전기완료' : code));
    const [header, line] = csv.split('\r\n');
    expect(header).toBe(
      '구분,일시,입고 번호,줄 번호,품목 코드,품목명,LOT 번호,LOT 수,수량,단위,창고 코드,창고명,공급사 코드,공급사명,상태',
    );
    expect(line).toBe(
      '자재 입고,2026-10-23 15:00,GR-SYN-0001,1,ITEM-A,품목 A,ITEM-A|500|261023|SUP-A|1,1,500,KG,WH-A,창고 A,SUP-A,공급사 A,전기완료',
    );
  });

  it('생산 입고는 상대 대신 W/O 번호 열이다', () => {
    const csv = toCsv(
      'PRODUCT',
      [row(1, { kind: 'PRODUCT', partner: null, workOrderNo: 'WO-SYN-1' })],
      (c) => c,
    );
    expect(csv.split('\r\n')[0]).toContain('창고명,W/O 번호,상태');
    expect(csv.split('\r\n')[1]).toContain(',WO-SYN-1,');
  });
});

describe('현재 조건 전체 받기', () => {
  it('쪽 크기 200으로 총계까지 받고 진행을 알린다', async () => {
    const pages = [pageOf([row(1), row(2)], 1, 3), pageOf([row(3)], 2, 3)];
    const fetchPage = vi.fn(
      async (page: number, _size: number) => pages[page - 1] as ReturnType<typeof pageOf>,
    );
    const progress: number[] = [];

    const rows = await fetchAllRows(fetchPage, new AbortController().signal, (p) =>
      progress.push(p.received),
    );

    expect(rows.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(fetchPage.mock.calls.map(([page, size]) => [page, size])).toEqual([
      [1, 200],
      [2, 200],
    ]);
    expect(progress).toEqual([2, 3]);
  });

  it('빈 쪽이 오면 총계와 달라도 멈춘다', async () => {
    const fetchPage = vi.fn(async (page: number) =>
      page === 1 ? pageOf([row(1)], 1, 10) : pageOf([], page, 10),
    );
    const rows = await fetchAllRows(fetchPage, new AbortController().signal, () => {});
    expect(rows).toHaveLength(1);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('취소하면 다음 쪽을 부르지 않는다', async () => {
    const abort = new AbortController();
    const fetchPage = vi.fn(async (page: number) => {
      if (page === 1) abort.abort();
      return pageOf([row(page)], page, 5);
    });
    await expect(fetchAllRows(fetchPage, abort.signal, () => {})).rejects.toThrow();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
