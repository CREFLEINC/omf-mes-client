import { Checkbox, Chip, EmptyState, Skeleton, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { LoadErrorBanner } from './load-error-banner';
import { formatMoment, type AckListResult, type AckState, type AckView } from './types';

const t = messages.notice;

const STATE_LABEL: Record<AckState, string> = {
  done: t.ack.done,
  opened: t.ack.opened,
  pending: t.ack.pending,
};

const STATE_TONE: Record<AckState, 'success' | 'warning' | 'idle'> = {
  done: 'success',
  opened: 'warning',
  pending: 'idle',
};

export interface AckPanelProps {
  /** 확인을 요구한 공지인가. 아니면 목록 자체를 열지 않는다. */
  required: boolean;
  pendingOnly: boolean;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: AckListResult | undefined;
  /** ⚠ 분모를 셀 수 없는 범위가 있다. */
  hasDenominator: boolean;
  onPendingOnlyChange: (value: boolean) => void;
  onRetry: () => void;
}

/**
 * 확인 현황.
 *
 * ⭐ **확인을 요구하지 않은 공지에는 이 목록이 뜻이 없다** — 빈 목록을 그리면 「아무도 확인하지
 * 않았다」로 읽힌다. 그럴 때는 목록 대신 그 사실을 적는다.
 *
 * ⭐ **세 갈래를 같은 모양으로 그리지 않는다** — 확인 · 열람(미확인) · 미확인. 「닫기」로 남은
 * 행에도 시각이 찍히므로 시각 유무만으로는 가를 수 없고, 독촉할 대상이 갈린다.
 */
export const AckPanel = ({
  required,
  pendingOnly,
  isPending,
  isError,
  error,
  data,
  hasDenominator,
  onPendingOnlyChange,
  onRetry,
}: AckPanelProps) => {
  if (!required) {
    return <p className="pane-lead">{t.ack.notRequired}</p>;
  }

  const columns: Column<AckView>[] = [
    { key: 'who', header: t.ack.who, render: (row) => row.who },
    {
      key: 'state',
      header: t.ack.state,
      render: (row) => (
        <Chip size="sm" status={STATE_TONE[row.state]}>
          {STATE_LABEL[row.state]}
        </Chip>
      ),
    },
    {
      key: 'at',
      header: t.ack.at,
      render: (row) => (row.at === null ? t.ack.notAvailable : formatMoment(row.at)),
    },
  ];

  return (
    <>
      {/* ⚠ 분모를 셀 수 없으면 그 사실을 목록 위에 적는다 — 0으로 채우지 않는다. */}
      {!hasDenominator && <p className="pane-lead">{t.ack.noDenominator}</p>}
      <p className="pane-lead">{t.ack.workerNote}</p>

      <div className="filter-bar">
        <div className="field-cell field-cell-unlabeled check-group">
          <Checkbox
            checked={pendingOnly}
            onChange={(event) => {
              onPendingOnlyChange(event.target.checked);
            }}
          >
            {t.ack.pendingOnly}
          </Checkbox>
        </div>
      </div>

      {isError ? (
        <LoadErrorBanner error={error} onRetry={onRetry} />
      ) : isPending ? (
        <Skeleton variant="rect" height="8rem" />
      ) : (
        <div className="wide-table">
          <Table
            columns={columns}
            rows={data?.items ?? []}
            getRowId={(row) => `${row.who}-${row.state}`}
            density="compact"
            empty={<EmptyState size="sm" live title={t.ack.emptyTitle} description={t.ack.empty} />}
          />
        </div>
      )}
    </>
  );
};
