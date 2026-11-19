import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';

import { PuIcon, PuPager, useClientPage, useFitCount } from '../../patterns/pop-uniform';
import { ListOrderFoot, byTime, type ListOrder } from '../../patterns/pop-list-order';
import { localDateTimeText } from './formatting';
import type { DocumentIssue } from './types';

const t = messages.repackLabelIssue.history;

export interface HistoryPaneProps {
  issues: readonly DocumentIssue[];
  isFailed: boolean;
}

/**
 * 《발행 이력》 — **회차로 쌓인다**(K-1). 최근 회차가 위, 구획 높이만큼 보이고 넘치면 쪽 넘김.
 *
 * ⛔ **이전 회차를 지우거나 덮지 않는다.** 재발행은 새 행이고, 앞 회차는 그대로 남는다.
 */
export const HistoryPane = ({ issues, isFailed }: HistoryPaneProps) => {
  const fitRef = useRef<HTMLDivElement>(null);
  const size = useFitCount(fitRef, { fallback: 3 });
  /* 발행 일시로 [최신순 | 오래된순](사용자 지시 2026-11-19) — 처음은 지금처럼 최신(최근 회차가 위). */
  const [order, setOrder] = useState<ListOrder>('newest');
  const sorted = [...issues].sort(
    (left, right) =>
      byTime<DocumentIssue>(order, (issue) => issue.issuedAt)(left, right) ||
      (order === 'newest' ? right.issueSeq - left.issueSeq : left.issueSeq - right.issueSeq),
  );
  const page = useClientPage(sorted, size);

  return (
    <div className="rpk-hist">
      <span className="rpk-sec">{t.sectionLabel}</span>
      {isFailed ? (
        <p className="rpk-err">{t.failed}</p>
      ) : (
        <>
          <div ref={fitRef} className="rpk-hist-list pu-fit" role="list">
            {page.items.map((issue) => {
              const failed = issue.printOutcome === 'FAILED';

              return (
                <div
                  key={issue.documentIssueLogId}
                  role="listitem"
                  className={failed ? 'rpk-step bad' : 'rpk-step'}
                >
                  <i>
                    <PuIcon name={failed ? 'x' : 'check'} />
                  </i>
                  <div>
                    <b>
                      <span>{t.seq(issue.issueSeq)}</span> · {t.outcome[issue.printOutcome]}
                    </b>
                    {/* ⛔ 서버 원문 시각을 그대로 찍지 않는다(#1043) — 현지 시각으로. */}
                    <small>
                      {issue.issuedByName} · {localDateTimeText(issue.issuedAt, t.unknownAt)}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
          <ListOrderFoot
            order={order}
            onOrder={(next) => {
              setOrder(next);
              page.setPage(1);
            }}
            showOrder={issues.length > 0}
          >
            <PuPager
              total={page.total}
              page={page.page}
              pages={page.pages}
              onPage={page.setPage}
              label={t.sectionLabel}
            />
          </ListOrderFoot>
        </>
      )}
    </div>
  );
};
