import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toValueKeys } from './diff-entries';
import { formatDateTime } from './event-format';
import type { AuditEventView } from './types';

const t = messages.masterChange;

export interface EventTableProps {
  rows: AuditEventView[];
  isLoading: boolean;
  /** 기간이 갖춰져 실제로 조회한 상태인가. 빈 상태의 문구가 갈린다. */
  hasPeriod: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  onFirstPage: () => void;
  onOpenDiff: (id: number) => void;
}

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 변경 이력 목록 표.
 *
 * 계약의 `AuditEvent`에는 필드가 열 개 있으나 **자료 열은 여섯이다**(+ 변경 내용 열).
 * 전부 열로 만들면 표가 짓눌려 셀이 낱말 단위로 쪼개진다 —
 * 앞 화면에서 「표를 읽을 수 없다」로 보고된 결함이다. 나머지는 변경 내용 창에서 본다.
 *
 * **정렬 열을 두지 않는다.** 계약의 조회 쿼리에 정렬 파라미터가 **없어** 클라이언트 정렬은
 * 지금 쪽 안에서만 정렬되고, 사용자에게는 「정렬했는데 순서가 이상하다」로 나타난다.
 *
 * **선택 열도 두지 않는다.** 이 화면에는 일괄로 할 쓰기가 하나도 없어 눌러도 아무 일이 없다.
 */
export const EventTable = ({
  rows,
  isLoading,
  hasPeriod,
  isBeyondLast,
  onFirstPage,
  onOpenDiff,
}: EventTableProps) => {
  /*
   * 열 폭의 도출 표는 docs/layout-conventions.md에 있다.
   * 지정 폭 합이 `.wide-table`의 최소 폭 `58rem`(928px) 안에 들어가야 표가 짓눌리지 않는다.
   */
  const columns: Column<AuditEventView>[] = [
    {
      key: 'occurredAt',
      header: t.table.occurredAt,
      width: '148px',
      render: (row) => orEmptyMark(formatDateTime(row.occurredAt)),
    },
    { key: 'targetTypeCode', header: t.table.targetType, width: '132px' },
    {
      key: 'targetId',
      header: t.table.targetId,
      align: 'end',
      width: '112px',
      /*
       * 번호를 그대로 낸다. 계약이 이 값을 FK로 두지 않았고 유형→표의 지도도 없어
       * 화면이 표시명을 만들 수 없다 — 지어내지 않는다.
       */
      render: (row) => String(row.targetId),
    },
    { key: 'eventTypeCode', header: t.table.eventType, width: '132px' },
    {
      key: 'performedBy',
      header: t.table.performedBy,
      align: 'end',
      width: '96px',
      // 계약이 「FK 없음 · 이름 표시는 애플리케이션 조인」이라 적었으나 그 조인을 줄 경로가 없다.
      render: (row) => orEmptyMark(row.performedBy === null ? null : String(row.performedBy)),
    },
    /*
     * 폭을 지정하지 않는 유일한 열이다 — 남는 폭을 이 열이 가져간다.
     * 지정 폭의 합 **708px**(148+132+112+132+96+88)에 이 열의 예산 180px을 더하면 888px이라
     * `.wide-table`의 최소 폭 928px 안에 들어간다. 도출 표는 docs/layout-conventions.md에 있다.
     */
    {
      key: 'changedKeys',
      header: t.table.changedKeys,
      /*
       * **받은 키 이름을 그대로** 이어 낸다. 이름을 우리말로 바꾸거나 뜻을 붙이지 않는다 —
       * 계약이 키 구조를 정하지 않아 화면이 뜻을 지어내게 된다.
       * 순서는 변경 내용 창과 같다(`toValueKeys`가 두 자리의 유일한 순서 규칙이다).
       */
      render: (row) => {
        const keys = toValueKeys(row.beforeValue, row.afterValue);

        return orEmptyMark(keys.length === 0 ? null : keys.join(', '));
      },
    },
    {
      key: 'diff',
      header: t.table.diff,
      width: '88px',
      render: (row) => (
        // 접근 이름에 발생 시각을 넣는다 — 「보기」가 행마다 되풀이되면 어느 건인지 알 수 없다.
        <Button
          variant="outlined"
          size="sm"
          aria-label={t.actions.viewDiffRow(
            formatDateTime(row.occurredAt) ?? String(row.auditEventId),
          )}
          onClick={() => {
            onOpenDiff(row.auditEventId);
          }}
        >
          {t.actions.viewDiff}
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.events}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  /** 조회 전 → 범위 밖 쪽 → 결과 없음 순서로 하나만 낸다. 셋은 사용자가 할 조치가 서로 다르다. */
  const emptySlot = (): ReactNode => {
    if (!hasPeriod) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noPeriodTitle}
          description={t.empty.noPeriodDescription}
        />
      );
    }

    if (isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={onFirstPage}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        title={t.empty.noResultTitle}
        description={t.empty.noResultDescription}
      />
    );
  };

  /*
   * `.wide-table`이 표에 최소 폭을 준다 — 폭이 모자라면 짓누르는 대신 가로로 넘긴다.
   * 스크롤 상자는 디자인 시스템 `Table`이 이미 갖고 있어 우리가 만들지 않는다.
   */
  return (
    <div className="wide-table">
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        /*
         * 선택 열을 쓰지 않아도 지정한다 — 미지정이면 인덱스가 React key가 되어
         * 쪽이 바뀔 때 앞 쪽의 행이 남아 보일 수 있다.
         */
        getRowId={(row) => String(row.auditEventId)}
        empty={emptySlot()}
      />
    </div>
  );
};
