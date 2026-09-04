import { Stepper, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { DocumentIssue } from './types';

const t = messages.repackLabelIssue.history;

export interface HistoryPaneProps {
  issues: readonly DocumentIssue[];
  isFailed: boolean;
}

/**
 * 《발행 이력》 — **회차로 쌓인다**(K-1 · 스펙 §5-6 「발행 이력 보기」).
 *
 * ⛔ **이전 회차를 지우거나 덮지 않는다.** 재발행은 새 행이고, 앞 회차는 그대로 남는 것이
 * 이 기록의 뜻이다 — 마지막 것만 보이면 「몇 번 다시 뽑았는가」가 사라진다.
 */
const stepOf = (issue: DocumentIssue): StepperItem => ({
  label: t.seq(issue.issueSeq),
  /*
   * 인쇄 결과가 곧 단계 상태다. 실패는 «반려»로 세운다 — 지나간 단계가 아니라 **되짚어야 할
   * 자리**라서, 회색 완료 표시로 두면 눈에 걸리지 않는다.
   */
  status: issue.printOutcome === 'FAILED' ? 'rejected' : 'complete',
  description: `${issue.issuedByName} · ${issue.issuedAt} · ${t.outcome[issue.printOutcome]}`,
});

export const HistoryPane = ({ issues, isFailed }: HistoryPaneProps) => {
  if (isFailed) return <p className="pop-empty-note">{t.failed}</p>;
  if (issues.length === 0) return <p className="pop-empty-note">{t.empty}</p>;

  return <Stepper steps={issues.map(stepOf)} orientation="vertical" size="sm" />;
};
