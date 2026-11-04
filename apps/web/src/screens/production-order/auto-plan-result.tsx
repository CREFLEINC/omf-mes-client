import { Button, Chip, type ChipStatus } from '@crefle/web-ui';
import { Link } from 'react-router';
import type { BulkOutcome } from '../../patterns/bulk-result';
import { processPath } from './worklist-filters';
import { messages } from '@omf-mes/i18n';

const labels = {
  CONFIRMED: '계획 확정',
  DRAFT: '미확정 계획',
  NOT_PLANNED: '자동 전개 미처리',
  FAILED: '실행 실패',
} as const;
export type AutoPlanResultCode = keyof typeof labels;
export type AutoPlanResultFilter = AutoPlanResultCode | null;
export const autoPlanResultCode = (outcome: BulkOutcome): AutoPlanResultCode => {
  if (outcome.status === 'failed') return 'FAILED';
  if (
    outcome.resultCode === 'CONFIRMED' ||
    outcome.resultCode === 'DRAFT' ||
    outcome.resultCode === 'NOT_PLANNED'
  )
    return outcome.resultCode;
  if (outcome.status === 'processed') return 'CONFIRMED';
  return outcome.reason === messages.erpWorkOrderFlow.bulk.outcomeReasons.draft
    ? 'DRAFT'
    : 'NOT_PLANNED';
};
const tones: Record<AutoPlanResultCode, ChipStatus> = {
  CONFIRMED: 'success',
  DRAFT: 'warning',
  NOT_PLANNED: 'warning',
  FAILED: 'error',
};
export const AutoPlanResult = ({
  outcomes,
  filter,
  onFilterChange,
  onClose,
  standalone = false,
}: {
  outcomes: BulkOutcome[];
  filter: AutoPlanResultFilter;
  onFilterChange: (value: AutoPlanResultFilter) => void;
  onClose: () => void;
  standalone?: boolean;
}) => {
  const codes = Object.keys(labels) as AutoPlanResultCode[];
  const shown = outcomes.filter((item) => filter === null || autoPlanResultCode(item) === filter);
  return (
    <section className="pane erp-wo-auto-result" aria-label="생산계획 자동 전개 결과">
      <div className="section-heading-row">
        <h2 className="section-title">
          {standalone ? 'ERP W/O별 실행 결과' : '생산계획 자동 전개 결과'}
        </h2>
        <Button size="sm" variant="outlined" onClick={onClose}>
          {standalone ? '작업계획 목록으로' : '전체 ERP W/O 조회'}
        </Button>
      </div>
      <div
        className="erp-wo-auto-result-filters"
        role="group"
        aria-label="생산계획 자동 전개 결과 필터"
      >
        <Button
          size="sm"
          variant="outlined"
          aria-pressed={filter === null}
          onClick={() => onFilterChange(null)}
        >
          실행 대상 전체 {outcomes.length}건
        </Button>
        {codes.map((code) => (
          <Button
            key={code}
            size="sm"
            variant="outlined"
            aria-pressed={filter === code}
            onClick={() => onFilterChange(filter === code ? null : code)}
          >
            {labels[code]} {outcomes.filter((item) => autoPlanResultCode(item) === code).length}건
          </Button>
        ))}
      </div>
      {shown.length > 0 && (
        <div className="erp-wo-auto-result-table">
          <table>
            <caption>ERP W/O별 실행 결과</caption>
            <thead>
              <tr>
                <th>ERP W/O</th>
                <th>실행 결과</th>
                <th>확인할 내용</th>
                <th>계획 확인</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const code = autoPlanResultCode(item);
                return (
                  <tr key={item.id}>
                    <td>{item.label}</td>
                    <td>
                      <Chip size="sm" variant="status" status={tones[code]}>
                        {labels[code]}
                      </Chip>
                    </td>
                    <td>
                      {item.reason ??
                        (code === 'CONFIRMED' ? '4M 배정 상태 확인' : '생산계획 확인')}
                    </td>
                    <td>
                      <Link
                        to={item.fixHref ?? processPath(item.label)}
                        aria-label={`${item.label} 계획 확인`}
                      >
                        {code === 'CONFIRMED' ? '계획 확인' : '보완하기'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
