import { AlertBanner, Button, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { FilterOption } from './lot-filter-bar';
import { LotTimelineTable } from './lot-timeline-table';
import { useLotActorOptions, useLotTimeline } from './queries';

const t = messages.lotStatusHistory;

interface LotTimelineProps {
  lotId: number;
  statusOptions: readonly FilterOption[];
}

/** LOT 상세의 이력 — 그 LOT 의 보류 등록·해제와 상태 변경을 시간순으로(omf-all-around#24). */
export const LotTimeline = ({ lotId, statusOptions }: LotTimelineProps) => {
  const timeline = useLotTimeline(lotId);
  const actors = useLotActorOptions(true);
  const appUserName = (appUserId: number): string | null => {
    const actor = actors.data?.items.find((item) => item.appUserId === appUserId);
    if (actor === undefined) return null;
    return actor.userName === '' ? actor.loginId : actor.userName;
  };

  return (
    <section aria-labelledby="lot-timeline-title">
      <h3 id="lot-timeline-title">{t.timeline.pane}</h3>
      {timeline.isPending && (
        <div role="status" aria-label={t.timeline.loading}>
          <SkeletonText lines={3} />
        </div>
      )}
      {timeline.isError && (
        <AlertBanner
          variant="error"
          title={t.timeline.failed}
          action={
            <Button
              variant="outlined"
              size="sm"
              aria-label={t.actions.retryLabel(t.timeline.pane)}
              onClick={() => void timeline.refetch()}
            >
              {t.actions.retry}
            </Button>
          }
        />
      )}
      {timeline.data?.isTruncated === true && (
        <AlertBanner variant="warning">{t.timeline.truncated}</AlertBanner>
      )}
      {timeline.data !== undefined && (
        <div className="wide-table">
          <LotTimelineTable
            caption={t.timeline.pane}
            entries={timeline.data.entries}
            statusOptions={statusOptions}
            appUserName={appUserName}
            variant="detail"
            empty={<EmptyState size="sm" title={t.timeline.empty} />}
          />
        </div>
      )}
    </section>
  );
};
