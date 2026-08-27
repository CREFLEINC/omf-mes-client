import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { pickRange } from '../../test/date-picker';
import { HistoryTab, type HistoryTabProps } from './history-tab';
import type { DispositionLookup } from './lookups';
import type { DecisionRow } from './types';

const t = messages.dispositionDecision;
/** ⚠ 지어낸 자리표시다 — 처분 유형의 실제 값 목록은 아직 확정되지 않았다. */
const CODE = 'CODE-A';

const uoms = (): DispositionLookup => ({
  entries: [{ value: '7001', label: 'EA', isActive: true }],
  truncated: false,
  isError: false,
  isLoading: false,
});

const rows: DecisionRow[] = [
  {
    dispositionDecisionId: 3001,
    dispositionTypeCode: CODE,
    decisionQtyText: '200',
    uomId: 7001,
    reason: '표면만 손상돼 재작업으로 회복된다',
    decidedAtText: '2026-08-12 14:20',
    decidedBy: 4001,
  },
];

const baseProps = (): HistoryTabProps => ({
  applied: { from: '2026-07-14', to: '2026-08-12', dispositionTypeCode: '' },
  dispositionOptions: [],
  rows,
  uoms: uoms(),
  page: {
    page: 1,
    canPrev: false,
    canNext: false,
    isBeyondLast: false,
    rangeLabel: t.page.range(1, 1, 1),
  },
  isLoading: false,
  error: null,
  onApply: vi.fn(),
  onChangePage: vi.fn(),
  onRetry: vi.fn(),
});

const renderTab = (overrides: Partial<HistoryTabProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  return { ...render(<HistoryTab {...props} />), props, user: userEvent.setup() };
};

describe('HistoryTab', () => {
  it('판정 내역을 단위 이름과 함께 보인다', () => {
    renderTab();

    expect(screen.getByText('표면만 손상돼 재작업으로 회복된다')).toBeInTheDocument();
    expect(screen.getByText('EA')).toBeInTheDocument();
  });

  it('기간이 필수라는 사실을 붙인다(L-3)', () => {
    renderTab();

    expect(screen.getByText(t.values.periodRequired)).toBeInTheDocument();
  });

  it('처분 유형 값 목록이 없으면 감추지 않고 사유를 붙인다(G-2)', () => {
    renderTab();

    const select = screen.getByLabelText(t.fields.dispositionTypeCode);
    expect(select).toHaveTextContent(t.codePlaceholder);
    expect(select).toHaveAccessibleDescription(t.codePending);
  });

  it('기간을 바꿔 조회하면 그 값을 알린다', async () => {
    const { props, user } = renderTab();

    await pickRange(
      user,
      screen.getByLabelText(t.fields.decidedPeriod),
      '2026-08-01',
      '2026-08-05',
    );
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(props.onApply).toHaveBeenCalledWith({
      from: '2026-08-01',
      to: '2026-08-05',
      dispositionTypeCode: '',
    });
  });

  it('적용된 조건이 바뀌면 편집 중 값을 그것으로 맞춘다', () => {
    const props = baseProps();
    const { rerender } = render(<HistoryTab {...props} />);

    rerender(
      <HistoryTab
        {...props}
        applied={{ ...props.applied, dispositionTypeCode: CODE }}
        dispositionOptions={[{ value: CODE, label: CODE }]}
      />,
    );

    expect(screen.getByLabelText(t.fields.dispositionTypeCode)).toHaveTextContent(CODE);
  });

  it('결과가 없으면 기간을 넓히라고 안내한다', () => {
    renderTab({ rows: [] });

    expect(screen.getByText(t.empty.historyTitle)).toBeInTheDocument();
  });

  it('불러오는 중에는 상태를 알린다', () => {
    renderTab({ isLoading: true });

    expect(screen.getByRole('status', { name: t.historyLoading })).toBeInTheDocument();
  });

  it('권한이 없으면 다시 시도를 내지 않는다 — 눌러도 풀리지 않는다', () => {
    renderTab({ error: new ApiRequestError({ kind: 'http', status: 403 }) });

    expect(screen.getByText(messages.httpError.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).toBeNull();
  });

  it('조회 실패는 다시 시도를 낸다', async () => {
    const { props, user } = renderTab({
      error: new ApiRequestError({ kind: 'http', status: 500 }),
    });

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(props.onRetry).toHaveBeenCalledOnce();
  });
});
