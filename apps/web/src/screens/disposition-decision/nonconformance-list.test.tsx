import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DispositionLookup } from './lookups';
import { NonconformanceList, type NonconformanceListProps } from './nonconformance-list';
import type { NonconformanceRow } from './types';

const t = messages.dispositionDecision;

const items = (): DispositionLookup => ({
  entries: [{ value: '5001', label: 'SYNTH-ITEM-1 · 합성 품목', isActive: true }],
  truncated: false,
  isError: false,
  isLoading: false,
});

const rows: NonconformanceRow[] = [
  {
    nonconformanceId: 41,
    nonconformanceNo: 'NC-TEST-0041',
    itemId: 5001,
    severityCode: 'CODE-B',
    statusCode: 'CODE-C',
    openedAtText: '2026-08-12',
    affectedQtyText: '320',
    dispositionProgressCode: 'PARTIAL',
  },
  {
    nonconformanceId: 42,
    nonconformanceNo: 'NC-TEST-0042',
    itemId: 9999,
    severityCode: 'CODE-B',
    statusCode: 'CODE-C',
    openedAtText: '2026-08-11',
    affectedQtyText: t.values.unknownQty,
    dispositionProgressCode: 'NOT_STARTED',
  },
];

const baseProps = (): NonconformanceListProps => ({
  rows,
  items: items(),
  isLoading: false,
  error: null,
  page: {
    page: 1,
    canPrev: false,
    canNext: true,
    isBeyondLast: false,
    rangeLabel: t.page.range(1, 2, 5),
  },
  selectedId: null,
  onSelect: vi.fn(),
  onChangePage: vi.fn(),
});

const renderList = (overrides: Partial<NonconformanceListProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  return { ...render(<NonconformanceList {...props} />), props, user: userEvent.setup() };
};

describe('NonconformanceList', () => {
  it('⭐ 「판정 진행」 열에 서버가 낸 값을 우리말로 보인다', () => {
    renderList();

    expect(
      screen.getByRole('columnheader', { name: t.fields.dispositionProgressCode }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.dispositionDecision.values.dispositionProgress.PARTIAL),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.dispositionDecision.values.dispositionProgress.NOT_STARTED),
    ).toBeInTheDocument();
  });

  /*
   * ⭐ 「원천으로 거를 수 없다」 안내가 «사라졌음»을 못박는다(#648). 축이 되살아났으므로
   * 그 문장은 이제 거짓이고, 표 머리에 남아 있으면 화면이 있는 기능을 없다고 말한다.
   */
  it('⭐ 원천을 못 거른다는 안내를 표 머리에 두지 않는다', () => {
    renderList();

    expect(screen.queryByText(/원천으로 거르는/)).toBeNull();
  });

  it('품목을 이름으로 보인다', () => {
    renderList();

    expect(screen.getByText('SYNTH-ITEM-1 · 합성 품목')).toBeInTheDocument();
  });

  it('이름을 못 찾은 품목은 「알 수 없음」으로 둔다 — 코드만 남기지 않는다', () => {
    renderList();

    expect(screen.getByText(messages.common.reference.unknown)).toBeInTheDocument();
  });

  it('대상 LOT이 실려 오지 않은 행의 수량 칸을 비운다', () => {
    renderList();

    expect(screen.getByText(t.values.unknownQty)).toBeInTheDocument();
  });

  it('행을 고르면 식별자로 알린다', async () => {
    const { props, user } = renderList();

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('NC-TEST-0041') }));

    expect(props.onSelect).toHaveBeenCalledWith(41);
  });

  it('고른 행을 표시한다', () => {
    renderList({ selectedId: 42 });

    expect(
      screen.getByRole('button', { name: t.actions.selectRow('NC-TEST-0042') }),
    ).toHaveAttribute('aria-current', 'true');
  });

  it('결과가 없으면 조건을 좁히라고 안내한다', () => {
    renderList({ rows: [] });

    expect(screen.getByText(t.empty.title)).toBeInTheDocument();
  });

  it('마지막 쪽을 넘어서면 첫 쪽으로 돌아갈 길을 준다', async () => {
    const { props, user } = renderList({
      rows: [],
      page: { ...baseProps().page, isBeyondLast: true },
    });

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(props.onChangePage).toHaveBeenCalledWith(1);
  });

  it('불러오는 중에는 상태를 알린다', () => {
    renderList({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading })).toBeInTheDocument();
  });

  it('오류가 오면 목록 대신 그것을 보인다', () => {
    renderList({ error: <p>합성 오류</p> });

    expect(screen.getByText('합성 오류')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
