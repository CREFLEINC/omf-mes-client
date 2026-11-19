import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import { PuCount, PuEmpty, PuPager, useClientPage, useFitCount } from '../../patterns/pop-uniform';
import { ListOrderFoot, sortByTime, type ListOrder } from '../../patterns/pop-list-order';
import { toClockLabel } from './formatting';
import { eventTypeName } from './hold-reasons';
import type { HoldReason } from './reason-options';
import type { WorkSessionEventView } from './types';

const t = messages.workHoldRegister;

export interface EventHistoryPanelProps {
  events: readonly WorkSessionEventView[];
  /** 지금 받아 온 사유 목록 — 서버가 이름을 빼고 보낼 때 이것으로 푼다. */
  reasons: readonly HoldReason[];
  isPending: boolean;
}

/**
 * 「현재 세션」 구획 안의 《이벤트 이력》 줄(스펙 §3 · POP 통일 시안 #295).
 *
 * ⭐ **사유 표시명은 서버가 준 것을 먼저 쓴다.** 행마다 사건 유형이 달라 사유의 코드 그룹도
 * 달라지므로(공유계약 `A-25`), 화면의 임시 목록으로 풀면 남의 유형이 쓰는 사유를 못 푼다.
 * 서버가 안 줬을 때만 이 화면의 목록으로 풀고, 그것도 없으면 코드를 그대로 보인다.
 *
 * ⭐ 구획 높이에 들어가는 만큼 보이고 나머지는 아래 쪽 넘김(‹ ›)으로 — 구획 안 스크롤 없음.
 *    처음과 새 이벤트가 붙은 뒤에는 가장 최근 쪽을 보인다.
 */
export const EventHistoryPanel = ({ events, reasons, isPending }: EventHistoryPanelProps) => {
  const listRef = useRef<HTMLOListElement>(null);
  const per = useFitCount(listRef, { fallback: 4 });
  /* 발생 시각으로 [최신순 | 오래된순](사용자 지시 2026-11-19) — 처음은 지금처럼 오래된순(위가 먼저 일어난 것). */
  const [order, setOrder] = useState<ListOrder>('oldest');
  const sorted = sortByTime(events, order, (event) => event.occurredAt);
  const page = useClientPage(sorted, per);
  const { showIndex } = page;

  /* 처음과 새 이벤트가 붙은 뒤, 정렬을 바꾼 뒤에는 가장 최근 줄이 든 쪽을 보인다. */
  useEffect(() => {
    showIndex(order === 'oldest' ? Math.max(0, events.length - 1) : 0);
  }, [events.length, order, showIndex]);

  /**
   * 사유 한 칸을 사람 말로. ⛔ 코드를 그대로 내밀지 않는다 — 그래도 못 풀면 코드를 보인다
   * (임의로 「기타」로 접으면 이력에서 그 사건이 다른 것으로 읽힌다).
   */
  const reasonLabel = (event: WorkSessionEventView): string => {
    if (event.reasonName !== null) return event.reasonName;
    if (event.reasonCode === null) return '';

    return reasons.find((reason) => reason.code === event.reasonCode)?.name ?? event.reasonCode;
  };

  return (
    <div className="wh-history" role="group" aria-label={t.history.sectionLabel}>
      <h3 className="wh-sub">
        {t.history.sectionLabel}
        {!isPending && <PuCount>{events.length}</PuCount>}
      </h3>

      {isPending ? (
        <p className="pu-help">{t.session.loading}</p>
      ) : events.length === 0 ? (
        <PuEmpty icon="clock" title={t.history.empty} />
      ) : (
        <ol ref={listRef} className="wh-evs pu-fit">
          {page.items.map((event) => (
            <li key={event.workSessionEventId}>
              <span className="pu-mono">{toClockLabel(event.occurredAt) ?? event.occurredAt}</span>
              <b>{eventTypeName(event.eventTypeCode)}</b>
              {/* 사유가 없는 사건(재개·종료)은 빈 칸이다 — 「없음」이라 적지 않는다. */}
              <span className="r">{reasonLabel(event)}</span>
            </li>
          ))}
        </ol>
      )}

      <ListOrderFoot order={order} onOrder={setOrder} showOrder={!isPending && events.length > 0}>
        <PuPager
          label={t.history.sectionLabel}
          total={isPending ? 0 : events.length}
          page={page.page}
          pages={page.pages}
          onPage={page.setPage}
        />
      </ListOrderFoot>
    </div>
  );
};
