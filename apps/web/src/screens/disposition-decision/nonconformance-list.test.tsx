import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
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
    openedAt: '2026-08-12T09:00:00+07:00',
    openedAtText: '2026-08-12',
    affectedQtyText: '320',
    uomId: 10,
    dispositionProgressCode: 'PARTIAL',
  },
  {
    nonconformanceId: 42,
    nonconformanceNo: 'NC-TEST-0042',
    itemId: 9999,
    severityCode: 'CODE-B',
    statusCode: 'CODE-C',
    openedAt: '2026-08-11T09:00:00+07:00',
    openedAtText: '2026-08-11',
    affectedQtyText: t.values.unknownQty,
    uomId: 10,
    dispositionProgressCode: 'NOT_STARTED',
  },
];

const codes = (pairs: [string, string][]): DispositionLookup => ({
  entries: pairs.map(([value, label]) => ({ value, label, isActive: true })),
  truncated: false,
  isError: false,
  isLoading: false,
});

const baseProps = (): NonconformanceListProps => ({
  rows,
  items: items(),
  uoms: codes([['10', 'EA']]),
  severity: codes([['CODE-B', '합성 심각도 B']]),
  status: codes([['CODE-C', '합성 상태 C']]),
  isLoading: false,
  error: null,
  meta: { page: 1, size: 20, total: rows.length },
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
  onChangeSize: vi.fn(),
});

const renderList = (overrides: Partial<NonconformanceListProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  return { ...render(<NonconformanceList {...props} />), props, user: userEvent.setup() };
};

describe('NonconformanceList', () => {
  it('⭐ 「처리 상태」 칸은 상태를 보이고, 일부 판정만 서버가 낸 진행을 덧붙인다(#275 판정 현황 열 합침)', () => {
    renderList();

    expect(screen.getByRole('columnheader', { name: t.fields.statusCode })).toBeInTheDocument();
    expect(
      screen.getByText(
        t.values.statusWithProgress('합성 상태 C', t.values.dispositionProgress.PARTIAL),
      ),
    ).toBeInTheDocument();
    /* 미판정은 상태(판정 대기)와 같은 말이라 덧붙이지 않는다. */
    expect(screen.getByText('합성 상태 C')).toBeInTheDocument();
    expect(screen.queryByText(t.values.dispositionProgress.NOT_STARTED)).toBeNull();
  });

  /*
   * ⭐ 「원천으로 거를 수 없다」 안내가 «사라졌음»을 못박는다(#648). 축이 되살아났으므로
   * 그 문장은 이제 거짓이고, 표 머리에 남아 있으면 화면이 있는 기능을 없다고 말한다.
   */
  it('⭐ 원천을 못 거른다는 안내를 표 머리에 두지 않는다', () => {
    renderList();

    expect(screen.queryByText(/원천으로 거르는/)).toBeNull();
  });

  it('품목은 이름만 보인다 — 코드는 상세에서(omf-all-around#286)', () => {
    renderList();

    expect(screen.getByText('합성 품목')).toBeInTheDocument();
    expect(screen.queryByText('SYNTH-ITEM-1 · 합성 품목')).toBeNull();
  });

  it('수량에 단위를 붙인다(omf-all-around#286)', () => {
    renderList();

    expect(screen.getByText('320 EA')).toBeInTheDocument();
  });

  it('이름을 못 찾은 품목은 「알 수 없음」으로 둔다 — 코드만 남기지 않는다', () => {
    renderList();

    expect(screen.getByText(messages.common.reference.unknown)).toBeInTheDocument();
  });

  it('대상 LOT이 실려 오지 않은 행의 수량 칸을 비운다', () => {
    renderList();

    expect(screen.getByText(t.values.unknownQty)).toBeInTheDocument();
  });

  it('접수일시 머리를 누르면 오름 · 내림차순으로 정렬한다(#352)', async () => {
    const { user } = renderList();
    const header = () => screen.getByRole('columnheader', { name: new RegExp(t.fields.openedAt) });
    const order = () => screen.getAllByText(/^NC-TEST-004\d$/).map((node) => node.textContent);

    await user.click(within(header()).getByRole('button'));
    const first = header().getAttribute('aria-sort');
    expect(order()).toEqual(
      first === 'ascending' ? ['NC-TEST-0042', 'NC-TEST-0041'] : ['NC-TEST-0041', 'NC-TEST-0042'],
    );

    await user.click(within(header()).getByRole('button'));
    expect(header().getAttribute('aria-sort')).not.toBe(first);
    expect(order()).toEqual(
      first === 'ascending' ? ['NC-TEST-0041', 'NC-TEST-0042'] : ['NC-TEST-0042', 'NC-TEST-0041'],
    );
  });

  it('행을 고르면 식별자로 알린다', async () => {
    const { props, user } = renderList();

    await user.click(screen.getByText('NC-TEST-0041'));

    expect(props.onSelect).toHaveBeenCalledWith(41);
  });

  it('고른 행을 표시한다', () => {
    renderList({ selectedId: 42 });

    expect(screen.getByText('NC-TEST-0042')).toHaveAttribute('data-selected', 'true');
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

  it('심각도·상태 열은 공통코드 이름으로 보인다(G-32)', () => {
    renderList();

    expect(screen.getAllByText('합성 심각도 B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('합성 상태 C').length).toBeGreaterThan(0);
    expect(screen.queryByText('CODE-B')).toBeNull();
  });

  it('이름이 없는 코드는 코드를 그대로 보인다 — 뜻을 지어내지 않는다(G-9)', () => {
    renderList({ severity: codes([]), status: codes([]) });

    expect(screen.getAllByText('CODE-B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CODE-C').length).toBeGreaterThan(0);
  });
});
