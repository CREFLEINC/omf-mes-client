import { Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toStatusBadge } from './status-badge';
import { formatDateTime, type InspectionQueueRow } from './types';

/**
 * 좌측 검사 대기 큐의 표.
 *
 * **네 칸뿐이다.** 이 창이 화면의 약 1/3 폭이라(화면 스펙 §3) 고르는 데 필요한 것만 싣는다 —
 * 품목·수량 같은 나머지는 고른 뒤 우측 창이 보인다.
 *
 * **의뢰번호 칸이 곧 「이 줄을 연다」다.** 저장소의 목록 창들이 쓰는 관용구와 같은 형태이며
 * (`users-roles/user-list-pane.tsx` 등), 고른 줄은 `aria-current` 로 표시한다.
 *
 * ⚠ **자재 LOT 을 번호로 그린다.** 계약이 식별자(정수)만 주고 LOT 번호 문자열을 주지 않는다.
 * 이름을 채우는 참조 조회를 얹지 않는 이유는 `queries.ts` 머리에 적었다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.pqcInspection.queue;

export interface QueueTableProps {
  rows: InspectionQueueRow[];
  /** 고른 의뢰. 없으면 `null` — 아무 줄도 현재가 아니다 */
  selectedId: number | null;
  onSelect: (inspectionRequestId: number) => void;
  /** 결과가 없을 때 표 자리에 그릴 것. 조회 실패와 빈 결과는 부르는 쪽이 가른다 */
  empty: ReactNode;
}

const columnsOf = (
  selectedId: number | null,
  onSelect: (inspectionRequestId: number) => void,
): Column<InspectionQueueRow>[] => [
  {
    key: 'inspectionRequestNo',
    header: t.columns.inspectionRequestNo,
    /* 코드 칸이 곧 「이 줄을 연다」다 — 저장소의 목록 창들과 같은 관용구. */
    render: (row) => (
      <button
        type="button"
        className="link-cell"
        aria-current={row.inspectionRequestId === selectedId ? 'true' : undefined}
        aria-label={t.openRow(row.inspectionRequestNo)}
        onClick={() => onSelect(row.inspectionRequestId)}
      >
        {row.inspectionRequestNo}
      </button>
    ),
  },
  {
    key: 'workOrderId',
    header: t.columns.workOrderId,
    width: '88px',
    /* 없는 것이 정상이다(작업지시 대상 검사 등). 빈 칸으로 두면 못 불러온 것과 구분되지 않는다. */
    render: (row) => (row.workOrderId === null ? t.emptyValue : String(row.workOrderId)),
  },
  {
    key: 'statusCode',
    header: t.columns.statusCode,
    width: '72px',
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
    header: t.columns.requestedAt,
    width: '124px',
    sortable: true,
    /* 정렬은 원문(RFC3339)으로 한다 — 표기용 문자열로 정렬하면 형식이 아닌 값이 섞일 때 어긋난다. */
    sortAccessor: (row) => row.requestedAt,
    render: (row) => formatDateTime(row.requestedAt),
  },
];

export const QueueTable = ({ rows, selectedId, onSelect, empty }: QueueTableProps) => (
  <Table
    caption={t.caption}
    density="compact"
    columns={columnsOf(selectedId, onSelect)}
    rows={rows}
    getRowId={(row) => String(row.inspectionRequestId)}
    empty={empty}
  />
);
