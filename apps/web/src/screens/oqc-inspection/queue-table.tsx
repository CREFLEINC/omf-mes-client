import { Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toStatusBadge } from './status-badge';
import type { InspectionQueueRow } from './types';

/**
 * 좌측 검사 대상 목록의 표 — **네 칸이고, 첫 칸이 두 행이다.**
 *
 * 이 창이 화면의 약 1/3 폭이라(스펙 §3) 열을 늘리는 대신 **한 줄을 두 행으로 쓴다** — §3 이
 * 그린 모양이 그렇다. 첫 행이 의뢰번호이고 둘째 행이 대상번호다. 대상 LOT·기준 버전 같은
 * 나머지는 고른 뒤 우측 창이 보인다.
 *
 * ⛔ **회차·검사일 칸을 지어내지 않는다** — 계약이 이 축에 주지 않는 값이다(`types.ts` 머리 참조).
 * 빈 칸으로 세워 두면 「아직 없음」과 「못 불러옴」이 화면에서 같아 보인다.
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
    /*
     * ⛔ **두 행을 인라인으로 붙이지 않는다.** 붙으면 「IR-OQC-0001대상 6101」로 읽힌다 —
     * 번호 칸이라 이어진 글자가 한 값처럼 보인다. `.stacked-cell` 이 그 갈라짐을 만든다.
     */
    render: (row) => (
      <span className="stacked-cell">
        <button
          type="button"
          className="link-cell"
          aria-current={row.inspectionRequestId === selectedId ? 'true' : undefined}
          aria-label={t.openRow(row.inspectionRequestNo)}
          onClick={() => onSelect(row.inspectionRequestId)}
        >
          {row.inspectionRequestNo}
        </button>
        <span className="field-note">{t.targetId(row.targetId)}</span>
      </span>
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
