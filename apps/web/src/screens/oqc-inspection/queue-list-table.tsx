import { Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { ItemNameLookup } from './reference-lookup';
import { toStatusBadge } from './status-badge';
import { formatDateTime, type InspectionQueueRow } from './types';

/**
 * OQC 검사 대상 목록의 표 — **여섯 칸이고, 의뢰번호 칸이 두 행이다.**
 *
 * ⚠ 종전 표(`queue-table.tsx`)는 W-03-11(PQC) 이 함께 쓰므로 그대로 두고, 이 화면만 이 표로 옮겼다(#136) —
 * OQC 를 고치다 PQC 목록 모양이 바뀌지 않게 한다.
 *
 * 목록이 화면 폭을 다 쓰게 되면서(목록과 상세를 갈아 끼운다 · omf-all-around#136, IQC #133 과 같다) 품목은
 * 번호 대신 이름·코드를, 의뢰 일시를 한 열로 더 싣는다. 의뢰번호 칸은 의뢰번호(위)·대상(아래)의 두 행이다.
 *
 * ⚠ **시리얼 번호 칸은 방금 스캔한 시리얼만 보인다.** 의뢰는 LOT 단위라 시리얼이 여럿이고 목록 계약에
 * 시리얼이 없다 — 스캔한 시리얼의 LOT 을 피킹한 의뢰 줄에만 그 번호를 두고 나머지는 「미등록」이다.
 *
 * ⛔ **회차·검사일 칸을 지어내지 않는다** — 계약이 이 축에 주지 않는 값이다(`types.ts` 머리 참조).
 * 빈 칸으로 세워 두면 「아직 없음」과 「못 불러옴」이 화면에서 같아 보인다.
 *
 * **의뢰번호 칸이 곧 「이 줄을 연다」다.** 저장소의 목록 창들이 쓰는 관용구와 같은 형태이며,
 * 고른 줄은 `aria-current` 로 표시한다. 줄 아무 곳을 눌러도 그 단추로 넘긴다(#136).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.oqcInspection.queue;

const columnsOf = (
  selectedId: number | null,
  onSelect: (inspectionRequestId: number) => void,
  itemNames: ItemNameLookup,
  uomCodeOf: (row: InspectionQueueRow) => string | null,
  serialOf: (row: InspectionQueueRow) => string | null,
): Column<InspectionQueueRow>[] => [
  {
    key: 'serialNo',
    header: t.serialColumn,
    /* 열 폭은 시리얼 15 · 품목 28 · 의뢰 22 · 수량 11 · 상태 9 · 일시 15(%)로 고정한다 — 값 길이로 폭이 흔들리지 않는다(#136). */
    width: '15%',
    render: (row) =>
      serialOf(row) ?? (
        <span className="oqc-inspection-queue-unregistered">{t.serialUnregistered}</span>
      ),
  },
  {
    key: 'itemId',
    header: t.columns.itemId,
    width: '28%',
    /* 「이름 / 코드」 두 줄 — 못 푼 갈래는 줄이 하나뿐이라 풀이가 사유를 그 자리에 낸다(IQC 와 같은 모양). */
    render: (row) => {
      const parts = itemNames.partsOf(row.itemId);
      const label = itemNames.labelOf(row.itemId);

      return parts === null ? (
        <span className="oqc-inspection-queue-item-name">{label}</span>
      ) : (
        <span className="oqc-inspection-queue-item" title={`${parts.name} · ${parts.code}`}>
          <span className="oqc-inspection-queue-item-name">{parts.name}</span>
          <span className="oqc-inspection-queue-sub">{parts.code}</span>
        </span>
      );
    },
  },
  {
    key: 'inspectionRequestNo',
    header: t.columns.inspectionRequestNo,
    width: '22%',
    /*
     * ⛔ **두 행을 인라인으로 붙이지 않는다.** 붙으면 「IR-OQC-0001출하요청 #6101」로 읽힌다 —
     * 번호 칸이라 이어진 글자가 한 값처럼 보인다. `.stacked-cell` 이 그 갈라짐을 만든다.
     */
    render: (row) => (
      <span className="stacked-cell">
        <button
          type="button"
          className="link-cell oqc-inspection-queue-open"
          aria-current={row.inspectionRequestId === selectedId ? 'true' : undefined}
          aria-label={t.openRow(row.inspectionRequestNo)}
          onClick={() => onSelect(row.inspectionRequestId)}
        >
          {row.inspectionRequestNo}
        </button>
        <span className="oqc-inspection-queue-sub">
          {t.target(t.targetTypes[row.targetTypeCode] ?? row.targetTypeCode, row.targetId)}
        </span>
      </span>
    ),
  },
  {
    key: 'targetQty',
    header: t.targetQtyColumn,
    width: '11%',
    render: (row) => {
      const code = uomCodeOf(row);

      return (
        <span className="oqc-inspection-num">
          {code === null ? String(row.targetQty) : `${String(row.targetQty)} ${code}`}
        </span>
      );
    },
  },
  {
    key: 'statusCode',
    header: t.columns.statusCode,
    width: '9%',
    render: (row) => {
      const badge = toStatusBadge(row.statusCode);

      return (
        <Chip variant="status" size="sm" status={badge.tone}>
          {badge.label}
        </Chip>
      );
    },
  },
  {
    key: 'requestedAt',
    header: t.requestedAtColumn,
    width: '15%',
    sortable: true,
    /* 정렬은 원문(RFC3339)으로 한다 — 표기용 문자열로 정렬하면 형식이 아닌 값이 섞일 때 어긋난다. */
    sortAccessor: (row) => row.requestedAt,
    render: (row) => <span className="oqc-inspection-num">{formatDateTime(row.requestedAt)}</span>,
  },
];

export interface QueueListTableProps {
  rows: InspectionQueueRow[];
  /** 품목 풀이 — 번호가 아니라 이름(위)·코드(아래)를 보인다(omf-all-around#40·#136). */
  itemNames: ItemNameLookup;
  /** 줄의 단위 코드. 모르면 `null` — 숫자만 둔다(표시 전용). */
  uomCodeOf?: (row: InspectionQueueRow) => string | null;
  /** 줄의 시리얼 번호 — 스캔한 시리얼이 걸린 줄만 값이 있다. 없으면 `null`(「미등록」). */
  serialOf?: (row: InspectionQueueRow) => string | null;
  /** 고른 의뢰. 없으면 `null` — 아무 줄도 현재가 아니다 */
  selectedId: number | null;
  onSelect: (inspectionRequestId: number) => void;
  /** 결과가 없을 때 표 자리에 그릴 것. 조회 실패와 빈 결과는 부르는 쪽이 가른다 */
  empty: ReactNode;
}

export const QueueListTable = ({
  rows,
  itemNames,
  uomCodeOf = () => null,
  serialOf = () => null,
  selectedId,
  onSelect,
  empty,
}: QueueListTableProps) => (
  /*
   * 줄 아무 곳이나 눌러도 고른다(#136 · IQC #133 과 같다) — DS 표에 줄 클릭이 없어 눌린 줄의 의뢰번호 단추로 넘긴다.
   * 키보드·화면 낭독기는 종전처럼 그 단추 하나로 고른다(줄마다 탭 멈춤을 늘리지 않는다).
   */
  <div
    className="oqc-inspection-queue-rows"
    onClick={(event) => {
      const target = event.target as Element;
      if (target.closest('button, a, input, select, textarea') !== null) return;
      target
        .closest('tbody tr')
        ?.querySelector<HTMLButtonElement>('.oqc-inspection-queue-open')
        ?.click();
    }}
  >
    <Table
      caption={<span className="oqc-inspection-visually-hidden">{t.caption}</span>}
      density="compact"
      columns={columnsOf(selectedId, onSelect, itemNames, uomCodeOf, serialOf)}
      rows={rows}
      getRowId={(row) => String(row.inspectionRequestId)}
      empty={empty}
    />
  </div>
);
