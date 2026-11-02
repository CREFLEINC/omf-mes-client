import { AlertBanner, Button, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import type { FilterOption } from './lot-filter-bar';
import { LotTimelineTable } from './lot-timeline-table';
import { useLotActorOptions, useLotTimeline } from './queries';

const t = messages.lotStatusHistory;

interface LotTimelineProps {
  lotId: number;
  statusOptions: readonly FilterOption[];
  /** LOT 상세 탭 안 — 제목·접기는 탭이 대신한다(사용자 2026-10-30). */
  embedded?: boolean;
}

/** LOT 상세의 이력 — 그 LOT 의 보류 등록·해제와 상태 변경을 시간순으로(omf-all-around#24). */
export const LotTimeline = ({ lotId, statusOptions, embedded = false }: LotTimelineProps) => {
  const timeline = useLotTimeline(lotId);
  const [open, setOpen] = useState(true);
  const actors = useLotActorOptions(true);
  const appUserName = (appUserId: number): string | null => {
    const actor = actors.data?.items.find((item) => item.appUserId === appUserId);
    if (actor === undefined) return null;
    return actor.userName === '' ? actor.loginId : actor.userName;
  };

  return (
    <section
      {...(embedded
        ? { 'aria-label': t.timeline.pane }
        : { 'aria-labelledby': 'lot-timeline-title' })}
    >
      {!embedded && (
        <div className="lot-status-pane-head">
          <h3 id="lot-timeline-title">
            {/* 이력이 길 수 있어 접었다 펼 수 있게 한다(사용자 2026-10-30). 처음에는 펼쳐 둔다. */}
            <button
              type="button"
              className="lot-section-toggle"
              aria-expanded={open}
              aria-controls="lot-timeline-body"
              onClick={() => setOpen((value) => !value)}
            >
              {t.timeline.pane}
            </button>
          </h3>
          {timeline.data !== undefined && (
            <span className="field-note">
              {t.current.list.total(String(timeline.data.entries.length))}
            </span>
          )}
        </div>
      )}
      <div id="lot-timeline-body" hidden={!embedded && !open}>
        {timeline.isPending && (
          <div role="status" aria-label={t.timeline.loading}>
            <SkeletonText lines={3} />
          </div>
        )}
        {timeline.isError && (
          <AlertBanner
            className="lot-detail-failure-banner"
            variant="error"
            title={t.timeline.failed}
            action={
              <Button
                variant="outlined"
                size="sm"
                aria-label={t.detail.retryLabel(t.timeline.pane)}
                onClick={() => void timeline.refetch()}
              >
                {t.detail.retry}
              </Button>
            }
          />
        )}
        {timeline.data?.isTruncated === true && (
          <AlertBanner variant="warning">{t.timeline.truncated}</AlertBanner>
        )}
        {timeline.data !== undefined && (
          <LotTimelineTable
            caption={t.timeline.pane}
            entries={timeline.data.entries}
            statusOptions={statusOptions}
            appUserName={appUserName}
            variant="detail"
            empty={<EmptyState size="sm" title={t.timeline.empty} />}
          />
        )}
      </div>
    </section>
  );
};
