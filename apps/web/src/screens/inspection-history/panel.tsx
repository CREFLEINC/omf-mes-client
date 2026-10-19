import type { InspectionHistory, InspectionHistoryEvent } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

const t = messages.inspectionHistory;

/** 검사 이력 조회 열쇠 — 회차를 저장한 화면이 이 뿌리로 다시 부를 수 있게 내보낸다. */
export const inspectionHistoryKeys = {
  all: ['inspection-history'] as const,
  one: (inspectionRequestId: number) => ['inspection-history', inspectionRequestId] as const,
};

const formatAt = (iso: string): string => {
  const at = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

/** 한 줄의 설명 — 무엇이 일어났는지는 제목이, 무엇이 바뀌었는지는 이 줄이 말한다. */
const detailOf = (event: InspectionHistoryEvent): string[] => {
  const parts: string[] = [];
  if (event.inspectionRound !== undefined) parts.push(t.round(event.inspectionRound));
  if (event.overallJudgmentCode !== undefined) parts.push(t.judgment(event.overallJudgmentCode));
  if (event.eventTypeCode !== 'LOT_STATUS_CHANGED' && event.acceptedQty !== undefined) {
    parts.push(t.quantities(event.acceptedQty, event.rejectedQty ?? 0, event.heldQty ?? 0));
  }
  if (event.eventTypeCode === 'LOT_STATUS_CHANGED' && event.newStatusCode !== undefined) {
    parts.push(
      t.lotStatus(event.lotNo ?? '', event.previousStatusCode ?? t.empty, event.newStatusCode),
    );
  }
  if (event.actorName !== undefined) parts.push(t.by(event.actorName));
  return parts;
};

export interface InspectionHistoryPanelProps {
  inspectionRequestId: number;
  /**
   * 회차가 바뀐 표식(저장·확정·재검사) — 바뀌면 이력을 새로 부른다. 회차 «개수»만 보면 확정이나 같은 회차의
   * 재저장이 이력에 뜨지 않는다.
   */
  revision?: string;
}

/**
 * 검사 대상 이력(omf-all-around#61 · 서버 선행 P-55) — IQC(W-01-01)·PQC(W-03-11)·OQC(W-04-03) 상세가 함께 쓴다.
 *
 * ⭐ 앞 단계가 넘긴 문서(입하·작업지시·출하 지시 번호)와, 전달 → 회차 저장·확정 → LOT 상태 변경을 시간순으로 보인다.
 * ⛔ 읽기 전용이다. 같은 LOT 의 다른 일(보류·처분)은 LOT 현황 화면의 몫이라 담지 않는다.
 */
export const InspectionHistoryPanel = ({
  inspectionRequestId,
  revision = '',
}: InspectionHistoryPanelProps) => {
  const { client } = useApiClient();
  const history = useQuery({
    queryKey: [...inspectionHistoryKeys.one(inspectionRequestId), revision],
    queryFn: (): Promise<InspectionHistory> =>
      runRequest(() =>
        client.GET('/quality/inspection-requests/{inspectionRequestId}/history', {
          params: { path: { inspectionRequestId } },
        }),
      ),
  });

  return (
    <section aria-label={t.heading} className="inspection-history">
      <h3>{t.heading}</h3>
      {history.isError ? (
        <p className="field-note">{t.loadFailed}</p>
      ) : history.data === undefined ? (
        <p className="field-note">{t.loading}</p>
      ) : (
        <>
          <dl className="filter-bar">
            <div className="field-cell">
              <dt className="field-label">{t.source}</dt>
              <dd>{history.data.source.documentNo ?? t.empty}</dd>
            </div>
            <div className="field-cell">
              <dt className="field-label">{t.sourceLot}</dt>
              <dd>{history.data.source.lotNo ?? t.empty}</dd>
            </div>
          </dl>
          <ol className="inspection-history-events">
            {history.data.events.map((event, index) => (
              <li key={`${event.eventTypeCode}-${event.occurredAt}-${String(index)}`}>
                <span className="field-label">
                  {formatAt(event.occurredAt)} · {t.events[event.eventTypeCode]}
                </span>
                {detailOf(event).length > 0 && (
                  <span className="field-note"> {detailOf(event).join(' · ')}</span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
};
