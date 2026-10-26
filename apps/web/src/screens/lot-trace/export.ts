import { messages } from '@omf-mes/i18n';

import type { LotTraceFilters, MovementKind } from './filters';
import type { MovementPage } from './queries';
import type { MovementRow } from './rows';

/**
 * 엑셀 내보내기 — **현재 조건 전체**를 쪽 크기 200으로 차례로 받아 파일 하나로 만든다(계획 2-6, 서버 회신
 * 2026-10-26 「화면이 쪽을 돌며 받는다」). 서버에 내려받기 경로가 없다.
 *
 * 파일은 UTF-8 BOM을 붙인 CSV다. 엑셀이 바로 열고, 저장소에 엑셀 파일 라이브러리가 없다
 * (같은 방식: `screens/downtime-summary/download.ts`). 만드는 일(`toCsv`)은 순수 함수, 내보내는 일(`saveCsv`)은 부수 효과만.
 */
const t = messages.lotTrace;

/** 한 번에 받는 줄 수 — 서버 상한과 같다. */
export const EXPORT_PAGE_SIZE = 200;

export interface ExportProgress {
  total: number;
  received: number;
}

/**
 * 끝까지 받는다. `signal`이 끊기면 그 자리에서 멈춘다(받던 요청도 끊는다).
 * 서버가 잘못된 총계를 주더라도 빈 쪽이 오면 멈춘다.
 */
export const fetchAllMovements = async (
  fetchPage: (page: number, size: number, signal: AbortSignal) => Promise<MovementPage>,
  signal: AbortSignal,
  onProgress: (progress: ExportProgress) => void,
): Promise<MovementRow[]> => {
  const rows: MovementRow[] = [];
  let total = 0;
  for (let page = 1; ; page += 1) {
    signal.throwIfAborted();
    const data = await fetchPage(page, EXPORT_PAGE_SIZE, signal);
    total = data.page.total;
    rows.push(...data.rows);
    onProgress({ total, received: rows.length });
    if (data.rows.length === 0 || rows.length >= total) return rows;
  }
};

/** 칸 하나를 RFC 4180으로 감싼다. 큰따옴표, 쉼표, 줄바꿈이 든 값은 감싸고 안쪽 큰따옴표는 두 번 적는다. */
export const escapeCsvField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

interface CsvColumn {
  header: string;
  value: (row: MovementRow) => string;
}

const partnerHeaders = (kind: MovementKind): { code: string; name: string } | null =>
  kind === 'MATERIAL'
    ? { code: t.filters.supplierCode, name: t.filters.supplierName }
    : kind === 'SHIPMENT'
      ? { code: t.filters.customerCode, name: t.filters.customerName }
      : null;

/** 화면 열에 코드 열(창고, 공급사 또는 고객)과 일시, 줄 번호, LOT 수를 더한다. 수량과 단위는 칸을 나눈다. */
const columnsFor = (kind: MovementKind, statusName: (code: string) => string): CsvColumn[] => {
  const c = t.list.columns;
  const partner = partnerHeaders(kind);
  return [
    { header: c.kind, value: (row) => t.kinds[row.kind] },
    { header: t.export.datetime, value: (row) => `${row.date} ${row.time}`.trim() },
    { header: kind === 'SHIPMENT' ? c.shipmentNo : c.receiptNo, value: (row) => row.documentNo },
    { header: t.detail.lineNo, value: (row) => String(row.lineNo) },
    { header: c.itemCode, value: (row) => row.item.code },
    { header: c.itemName, value: (row) => row.item.name },
    { header: c.lotNo, value: (row) => row.lots[0]?.lotNo ?? '' },
    { header: t.export.lotCount, value: (row) => String(row.lotCount) },
    { header: c.qty, value: (row) => String(row.qty) },
    { header: t.export.uom, value: (row) => row.uomCode },
    { header: t.filters.warehouseCode, value: (row) => row.warehouse.code },
    { header: t.filters.warehouseName, value: (row) => row.warehouse.name },
    ...(partner === null
      ? [{ header: c.workOrder, value: (row: MovementRow) => row.workOrderNo ?? '' }]
      : [
          { header: partner.code, value: (row: MovementRow) => row.partner?.code ?? '' },
          { header: partner.name, value: (row: MovementRow) => row.partner?.name ?? '' },
        ]),
    { header: c.status, value: (row) => statusName(row.statusCode) },
  ];
};

/** 줄 끝은 `\r\n`이다 — 표 계산 프로그램이 기대하는 형식이다. */
export const toCsv = (
  kind: MovementKind,
  rows: readonly MovementRow[],
  statusName: (code: string) => string,
): string => {
  const columns = columnsFor(kind, statusName);
  return [
    columns.map((column) => escapeCsvField(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvField(column.value(row))).join(',')),
  ].join('\r\n');
};

export const exportFileName = (filters: LotTraceFilters): string =>
  t.export.fileName(t.kinds[filters.kind], filters.from, filters.to);

/** 한글이 깨지지 않게 앞에 붙이는 표식(UTF-8 BOM). */
const BOM = '﻿';

/** 만든 글자를 파일로 내보낸다. 만든 주소는 돌려준다. */
export const saveCsv = (fileName: string, content: string): void => {
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};
