import { Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toStatusBadge } from './status-badge';
import type { InspectionQueueRow } from './types';

/**
 * 좌측 검사 대상 목록의 표 — **네 칸뿐이다.**
 *
 * 이 창이 화면의 약 1/3 폭이라(스펙 §3) 고르는 데 필요한 것만 싣는다. 스펙 §3 좌단이 품목과
 * 검사수량을 그리고 있어 그 둘을 넣고, 대상 LOT·기준 버전 같은 나머지는 고른 뒤 우측 창이 보인다.
 *
 * **의뢰번호 칸이 곧 「이 줄을 연다」다.** 저장소의 목록 창들이 쓰는 관용구와 같은 형태이며,
 * 고른 줄은 `aria-current` 로 표시한다.
 *
 * ⚠ **품목을 번호로 그린다.** 계약이 식별자(정수)만 주고 품목 코드 문자열을 주지 않는다.
 * 이름을 채우는 참조 조회를 얹지 않는 이유는 `types.ts` 머리에 적었다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.oqcInspection.queue;

const columnsOf = (
  selectedId: number | null,
  onSelect: (inspectionRequestId: number) => void,
): Column<InspectionQueueRow>[] => [
  {
    key: 'inspectionRequestNo',
    header: t.columns.inspectionRequestNo,
    /* 번호 칸이 곧 「이 줄을 연다」다 — 저장소의 목록 창들과 같은 관용구. */
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
    key: 'itemId',
    header: t.columns.itemId,
    width: '72px',
    render: (row) => String(row.itemId),
  },
  {
    key: 'targetQty',
    header: t.columns.targetQty,
    width: '80px',
    render: (row) => String(row.targetQty),
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
];

export interface QueueTableProps {
  rows: InspectionQueueRow[];
  /** 고른 의뢰. 없으면 `null` — 아무 줄도 현재가 아니다 */
  selectedId: number | null;
  onSelect: (inspectionRequestId: number) => void;
  /** 결과가 없을 때 표 자리에 그릴 것. 조회 실패와 빈 결과는 부르는 쪽이 가른다 */
  empty: ReactNode;
}

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
