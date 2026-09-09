import { Card, EmptyState, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toClockLabel } from './formatting';
import { eventTypeName } from './hold-reasons';
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
 * ⭐ **다른 POP 화면과 같은 상자로 선다** — `Card bordered` + `pop-section`, 표제는 카드의
 * «직계 자식»이다. 맨 `Card` 에 `<section>` 을 덧대면 테두리가 없고 표제 여백이 어긋난다.
 */
export const EventHistoryPanel = ({ events, isPending }: EventHistoryPanelProps) => (
  <Card bordered className="pop-section pop-hold-history-card" aria-label={t.history.sectionLabel}>
    <h2 className="pane-title">{t.history.sectionLabel}</h2>

    {isPending ? (
      <Skeleton height="96px" aria-label={t.history.sectionLabel} />
    ) : events.length === 0 ? (
      /*
       * ⚠ **빈 안내는 남은 자리의 «한가운데» 선다**(사용자 지시 2026-09-07). 그냥 흘려 두면
       * 제목 바로 아래에 붙어, 카드가 세로로 길어질수록 위쪽에 매달린 것처럼 보인다.
       * 가로 가운데는 부품이 이미 하고, 세로는 이 자리가 남은 높이를 채워야 생긴다.
       */
      <div className="pop-hold-empty">
        <EmptyState size="sm" title={t.history.empty} />
      </div>
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
                  (event.reasonCode ?? '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
    {/*
     * ⛔ **「이벤트는 정정할 수 없습니다」를 늘 세우지 않는다.** 스펙 §4-A 는 그것을
     * «데이터 규칙»으로 적었지 화면 문구로 정하지 않았고, 정정하려는 사람에게만 필요한
     * 말이 목록 아래에 상주하고 있었다.
     */}
  </Card>
);
