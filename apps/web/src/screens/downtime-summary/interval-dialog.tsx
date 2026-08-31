import { Button, Dialog, EmptyState, Skeleton, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { LoadErrorBanner } from './load-error-banner';
import type { IntervalKind } from './queries';
import { formatCount, formatMoment, type DowntimeIntervalView } from './types';

const t = messages.downtimeSummary;

const columns: Column<DowntimeIntervalView>[] = [
  {
    key: 'equipmentCode',
    header: t.intervals.equipment,
    render: (row) => row.equipmentCode ?? t.table.notAvailable,
  },
  {
    key: 'reason',
    header: t.intervals.reason,
    /* 이름이 없으면 코드를 그대로 보인다 — 「이름 없음」으로 바꾸면 전할 단서가 사라진다. */
    render: (row) =>
      row.reasonName === null || row.reasonName === '' ? row.reasonCode : row.reasonName,
  },
  {
    key: 'startedAt',
    header: t.intervals.startedAt,
    render: (row) => formatMoment(row.startedAt),
  },
  {
    key: 'endedAt',
    header: t.intervals.endedAt,
    /* ⭐ 비어 있음이 곧 「진행 중」이다 — 빈 칸으로 두면 자료가 빠진 것으로 읽힌다. */
    render: (row) => (row.endedAt === null ? t.intervals.ongoing : formatMoment(row.endedAt)),
  },
  {
    key: 'durationMinutes',
    header: t.intervals.duration,
    align: 'end',
    render: (row) =>
      row.durationMinutes === null ? t.table.notAvailable : formatCount(row.durationMinutes),
  },
];

export interface IntervalDialogProps {
  kind: IntervalKind | null;
  rows: DowntimeIntervalView[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * 요약이 **건수로만** 알려 준 구간을 목록으로 편다.
 *
 * ⭐ **창을 열기 전에는 부르지 않는다.** 계약이 목록을 요약에 담지 않은 이유가 그것이다 —
 * 집계를 볼 때마다 목록까지 실어 나르면 대부분 쓰이지 않는 자료를 매번 받는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const IntervalDialog = ({
  kind,
  rows,
  isLoading,
  isError,
  error,
  onRetry,
  onClose,
}: IntervalDialogProps) => (
  <Dialog
    open={kind !== null}
    onClose={onClose}
    title={kind === 'overlapping' ? t.intervals.overlappingTitle : t.intervals.openTitle}
    size="lg"
    footer={
      <Button variant="outlined" onClick={onClose}>
        {t.intervals.close}
      </Button>
    }
  >
    <div className="dialog-scroll">
      <p className="dialog-lead">
        {kind === 'overlapping' ? t.summary.overlappingIntervalsNote : t.summary.openIntervalsNote}
      </p>
      {isError && <LoadErrorBanner error={error} onRetry={onRetry} />}
      {isLoading ? (
        <Skeleton variant="rect" height="10rem" />
      ) : (
        /*
         * ⛔ `.wide-table`로 감싸지 않는다. 그 클래스는 표에 최소 폭 58rem을 주는데 창은 그보다
         * 좁아 **가로 스크롤이 생기고 마지막 열이 잘린다** — 브라우저 확인에서 「길이(분)」이
         * 화면 밖으로 나갔다. 열이 다섯뿐이라 창 폭에 그대로 들어간다.
         */
        !isError && (
          <div>
            <Table
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.downtimeId)}
              density="compact"
              empty={
                <EmptyState
                  size="sm"
                  live
                  title={t.intervals.emptyTitle}
                  description={t.intervals.empty}
                />
              }
            />
          </div>
        )
      )}
    </div>
  </Dialog>
);
