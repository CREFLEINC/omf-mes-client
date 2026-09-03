import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DecisionHistory, type DecisionHistoryProps } from './decision-history';
import type { DispositionLookup } from './lookups';
import type { RemainingQty } from './remaining-qty';
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

const remaining = (value: number | undefined): RemainingQty => ({
  value,
  text: value === undefined ? t.values.unknownQty : String(value),
  isSettled: value !== undefined && value <= 0,
});

const baseProps = (): DecisionHistoryProps => ({
  rows,
  remaining: remaining(120),
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

  it('⭐ 남은 수량이 참고값임을 값 옆에 상시 적는다', () => {
    renderHistory();

    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText(t.remaining.note)).toBeInTheDocument();
  });

  it('남은 수량이 없으면 판정이 끝났음을 알린다 — 참고값 안내를 대신한다', () => {
    renderHistory({ remaining: remaining(0) });

    expect(screen.getByText(t.remaining.settled)).toBeInTheDocument();
    expect(screen.queryByText(t.remaining.note)).toBeNull();
  });

  it('남은 수량을 낼 수 없으면 그 사실을 말한다 — 0으로 보이지 않는다', () => {
    renderHistory({ remaining: remaining(undefined) });

    expect(screen.getByText(t.remaining.unknown)).toBeInTheDocument();
    expect(screen.getByText(t.values.unknownQty)).toBeInTheDocument();
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
