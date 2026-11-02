import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DecisionHistory, type DecisionHistoryProps } from './decision-history';
import type { DispositionLookup } from './lookups';
import type { DecisionRow } from './types';

const t = messages.dispositionDecision;

const uoms = (): DispositionLookup => ({
  entries: [{ value: '7001', label: 'EA', isActive: true }],
  truncated: false,
  isError: false,
  isLoading: false,
});

const rows: DecisionRow[] = [
  {
    dispositionDecisionId: 3001,
    dispositionTypeCode: 'REWORK',
    decisionQtyText: '200',
    uomId: 7001,
    reason: '표면만 손상돼 재작업으로 회복된다',
    decidedAtText: '2026-08-12 14:20',
    decidedBy: 4001,
  },
];

const baseProps = (): DecisionHistoryProps => ({
  rows,
  uoms: uoms(),
  isLoading: false,
  isError: false,
});

const renderHistory = (overrides: Partial<DecisionHistoryProps> = {}) =>
  render(<DecisionHistory {...baseProps()} {...overrides} />);

describe('DecisionHistory', () => {
  it('판정 이력을 보인다', () => {
    renderHistory();

    expect(screen.getByText('표면만 손상돼 재작업으로 회복된다')).toBeInTheDocument();
    expect(screen.getByText('EA')).toBeInTheDocument();
  });

  it('아직 판정이 없으면 빈 상태를 보인다', () => {
    renderHistory({ rows: [] });

    expect(screen.getByText(t.decisions.empty)).toBeInTheDocument();
  });

  it('불러오는 중에는 상태를 알린다', () => {
    renderHistory({ isLoading: true });

    expect(screen.getByRole('status', { name: t.decisions.loading })).toBeInTheDocument();
  });

  it('이력 조회가 실패하면 표 대신 그 사실을 보인다', () => {
    renderHistory({ isError: true });

    expect(screen.getByText(t.decisions.unavailable)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
