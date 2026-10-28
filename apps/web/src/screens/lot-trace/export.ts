import { messages } from '@omf-mes/i18n';

import { toCsvText, type CsvColumn } from '../../patterns/csv';
import type { LotTraceFilters } from './filters';
import type { MovementRow } from './rows';

/**
 * 엑셀 내보내기 — **현재 조건 전체**를 쪽 크기 200으로 차례로 받아 파일 하나로 만든다. 서버에 내려받기
 * 경로가 없어 화면이 쪽을 돌며 받는다.
 *
 * 파일은 UTF-8 BOM을 붙인 CSV다(공용 `patterns/csv`). 엑셀이 바로 열고, 저장소에 엑셀 파일 라이브러리가 없다.
 */
const t = messages.lotTrace;

/** 한 번에 받는 줄 수 — 서버 상한과 같다. */
export const EXPORT_PAGE_SIZE = 200;

export interface ExportProgress {
  total: number;
  received: number;
}

/** 한 쪽 — 줄과 쪽 정보. */
export interface RowPage<Row> {
  rows: Row[];
  page: { total: number };
}

/**
 * 끝까지 받는다. `signal`이 끊기면 그 자리에서 멈춘다(받던 요청도 끊는다).
 * 서버가 잘못된 총계를 주더라도 빈 쪽이 오면 멈춘다.
 */
export const fetchAllRows = async <Row>(
  fetchPage: (page: number, size: number, signal: AbortSignal) => Promise<RowPage<Row>>,
  signal: AbortSignal,
  onProgress: (progress: ExportProgress) => void,
): Promise<Row[]> => {
  const rows: Row[] = [];
  for (let page = 1; ; page += 1) {
    signal.throwIfAborted();
    const data = await fetchPage(page, EXPORT_PAGE_SIZE, signal);
    /* 취소 뒤에 도착한 쪽은 버린다. 받던 요청이 끊기지 않고 끝까지 온 경우다. */
    signal.throwIfAborted();
    rows.push(...data.rows);
    onProgress({ total: data.page.total, received: rows.length });
    if (data.rows.length === 0 || rows.length >= data.page.total) return rows;
  }
};

/** 화면 열에 일시, 줄 번호, 품목, 창고, 공급사 또는 고객, W/O 번호, 상태를 더한다. 수량과 단위는 칸을 나눈다. */
const columnsFor = (statusName: (row: MovementRow) => string): CsvColumn<MovementRow>[] => {
  const c = t.list.columns;
  return [
    { header: c.kind, value: (row) => t.kinds[row.kind] },
    { header: t.export.datetime, value: (row) => `${row.date} ${row.time}`.trim() },
    { header: c.documentNo, value: (row) => row.documentNo },
    { header: t.detail.lineNo, value: (row) => String(row.lineNo) },
    { header: c.itemCode, value: (row) => row.item.code },
    { header: c.itemName, value: (row) => row.item.name },
    { header: c.lotNo, value: (row) => row.lots[0]?.lotNo ?? '' },
    { header: t.export.lotCount, value: (row) => String(row.lotCount) },
    { header: c.qty, value: (row) => String(row.qty) },
    { header: t.export.uom, value: (row) => row.uomCode },
    { header: t.filters.warehouseCode, value: (row) => row.warehouse?.code ?? '' },
    { header: t.filters.warehouseName, value: (row) => row.warehouse?.name ?? '' },
    { header: t.export.partnerCode, value: (row) => row.partner?.code ?? '' },
    { header: t.export.partnerName, value: (row) => row.partner?.name ?? '' },
    { header: c.workOrder, value: (row) => row.workOrderNo ?? '' },
    { header: c.status, value: statusName },
  ];
};

export const toCsv = (
  rows: readonly MovementRow[],
  statusName: (row: MovementRow) => string,
): string => toCsvText(columnsFor(statusName), rows);

export const exportFileName = (filters: LotTraceFilters): string =>
  t.export.fileName(t.kinds[filters.kind], filters.from, filters.to);
