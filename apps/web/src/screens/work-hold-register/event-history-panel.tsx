import { Card, EmptyState, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toClockLabel } from './formatting';
import { eventTypeName, holdReasonName } from './hold-reasons';
import type { WorkSessionEventView } from './types';

const t = messages.workHoldRegister;

export interface EventHistoryPanelProps {
  events: readonly WorkSessionEventView[];
  isPending: boolean;
}

/**
 * 《이벤트 이력》 구획(스펙 §3).
 *
 * ⭐ **사유 표시명은 서버가 준 것을 먼저 쓴다.** 행마다 사건 유형이 달라 사유의 코드 그룹도
 * 달라지므로(공유계약 `A-25`), 화면의 임시 목록으로 풀면 남의 유형이 쓰는 사유를 못 푼다.
 * 서버가 안 줬을 때만 이 화면의 목록으로 풀고, 그것도 없으면 코드를 그대로 보인다.
 *
 * ⚠ **기록 전용이라는 사실을 목록 옆에 세운다**(스펙 §6) — 잘못 등록했을 때 무엇을 해야
 * 하는지가 여기 없으면 작업자가 지울 곳을 찾는다.
 */
export const EventHistoryPanel = ({ events, isPending }: EventHistoryPanelProps) => (
  <Card>
    <section aria-label={t.history.sectionLabel}>
      <h2 className="pane-title">{t.history.sectionLabel}</h2>

      {isPending ? (
        <Skeleton height="96px" aria-label={t.history.sectionLabel} />
      ) : events.length === 0 ? (
        <EmptyState size="sm" title={t.history.empty} />
      ) : (
        <table className="pop-hold-history">
          <thead>
            <tr>
              <th scope="col">{t.history.timeColumn}</th>
              <th scope="col">{t.history.typeColumn}</th>
              <th scope="col">{t.history.reasonColumn}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.workSessionEventId}>
                <td>{toClockLabel(event.occurredAt) ?? event.occurredAt}</td>
                <td>{eventTypeName(event.eventTypeCode)}</td>
                {/* 사유가 없는 사건(재개·종료)은 빈 칸이다 — 「없음」이라 적지 않는다. */}
                <td>
                  {event.reasonName ??
                    (event.reasonCode === null ? '' : holdReasonName(event.reasonCode))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="pop-hold-note">{t.history.recordOnlyNotice}</p>
    </section>
  </Card>
);
