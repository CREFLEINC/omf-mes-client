import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickRange } from '../../test/date-picker';
import { FilterBar, type FilterBarProps } from './filter-bar';
import type { PendingFilters } from './filters';
import type { DispositionLookup } from './lookups';

const t = messages.dispositionDecision;

const applied: PendingFilters = {
  from: '2026-07-14',
  to: '2026-08-12',
  itemId: '',
  severityCode: '',
  statusCode: '',
  sourceCode: '',
};

const items = (): DispositionLookup => ({
  entries: [{ value: '5001', label: 'SYNTH-ITEM-1 · 합성 품목', isActive: true }],
  truncated: false,
  isError: false,
  isLoading: false,
});

const emptyLookup = (): DispositionLookup => ({
  entries: [],
  truncated: false,
  isError: false,
  isLoading: false,
});
const codes = (pairs: [string, string][]): DispositionLookup => ({
  ...emptyLookup(),
  entries: pairs.map(([value, label]) => ({ value, label, isActive: true })),
});

const baseProps = (): FilterBarProps => ({
  applied,
  severity: emptyLookup(),
  status: emptyLookup(),
  items: items(),
  onApply: vi.fn(),
  onReset: vi.fn(),
});

const renderBar = (overrides: Partial<FilterBarProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  return { ...render(<FilterBar {...props} />), props, user: userEvent.setup() };
};

describe('FilterBar', () => {
  it('기간이 필수라는 사실을 칸에 상시 붙인다(L-3)', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.period)).toHaveAccessibleDescription(
      t.values.periodRequired,
    );
  });

  it('값 목록이 없는 코드 칸은 감추지 않고 사유를 붙인다(G-2)', () => {
    renderBar();

    const severity = screen.getByLabelText(t.fields.severityCode);
    expect(severity).toHaveTextContent(t.codePlaceholder);
    expect(severity).toHaveAccessibleDescription(t.codeLock.empty);
  });

  it('기간과 품목을 함께 적용한다', async () => {
    const { props, user } = renderBar();

    await pickRange(user, screen.getByLabelText(t.fields.period), '2026-08-01', '2026-08-05');
    await user.click(screen.getByLabelText(t.fields.item));
    await user.click(screen.getByRole('option', { name: 'SYNTH-ITEM-1 · 합성 품목' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(props.onApply).toHaveBeenCalledWith({
      from: '2026-08-01',
      to: '2026-08-05',
      itemId: '5001',
      severityCode: '',
      statusCode: '',
      sourceCode: '',
    });
  });

  it('초기화를 알린다', async () => {
    const { props, user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(props.onReset).toHaveBeenCalledOnce();
  });

  it('적용된 조건이 바뀌면 편집 중 값을 그것으로 맞춘다', () => {
    const props = baseProps();
    const { rerender } = render(<FilterBar {...props} />);

    rerender(<FilterBar {...props} applied={{ ...applied, itemId: '5001' }} />);

    expect(screen.getByLabelText(t.fields.item)).toHaveTextContent('SYNTH-ITEM-1 · 합성 품목');
  });

  /*
   * ⭐ 여기 있던 「원천 칸을 두지 않는다」 단언을 뒤집었다 — 서버가 값을 내리지 않던 것이
   * 아니라 축이 되살아났다(#648). 되살린 쪽을 «고르고 적용되는 데»까지 물어야 칸만 세워 두고
   * 조건이 안 실리는 상태를 잡는다 — 렌더 여부만 보면 그 결함을 통과시킨다.
   */
  it('⭐ 원천으로 거른다 — 고른 값이 적용 조건에 실린다', async () => {
    const { props, user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.sourceCode));
    await user.click(screen.getByRole('option', { name: t.values.sourceCode.RETURN }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(props.onApply).toHaveBeenCalledWith(expect.objectContaining({ sourceCode: 'RETURN' }));
  });

  it('원천 칸에 두 갈래뿐이라는 사실을 상시 붙인다 — 값 목록이 비어서가 아니다', () => {
    renderBar();

    const source = screen.getByLabelText(t.fields.sourceCode);

    expect(source).toHaveAccessibleDescription(t.sourceNote);
    /* 선택지가 채워져 있으므로 G-2의 「준비 중」 자리는 비어 있어야 한다. */
    expect(source).not.toHaveTextContent(t.codePlaceholder);
  });

  it('⛔ 원천에 계약이 열거하지 않은 선택지를 짓지 않는다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.sourceCode));

    /* 개수까지 본다 — 이름만 확인하면 지어낸 값이 하나 더 끼어도 통과한다. */
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: t.all })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: t.values.sourceCode.PRODUCT })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: t.values.sourceCode.RETURN })).toBeInTheDocument();
  });

  it.each([
    ['조회 중', { isLoading: true }, t.codeLock.loading],
    ['실패', { isError: true }, t.codeLock.failed],
  ])('심각도 기준값이 %s이면 칸을 잠그고 그 사유를 밝힌다(G-2)', (_state, overrides, message) => {
    renderBar({ severity: { ...emptyLookup(), ...overrides } });

    const severity = screen.getByLabelText(t.fields.severityCode);
    expect(severity).toHaveTextContent(t.codePlaceholder);
    expect(severity).toHaveAccessibleDescription(message);
  });

  it('기준값이 오면 이름으로 고르고 코드를 적용값에 싣는다', async () => {
    const { props, user } = renderBar({ severity: codes([['CODE-B', '합성 심각도 B']]) });

    await user.click(screen.getByLabelText(t.fields.severityCode));
    await user.click(screen.getByRole('option', { name: '합성 심각도 B' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(props.onApply).toHaveBeenCalledWith(expect.objectContaining({ severityCode: 'CODE-B' }));
  });

  it('잘려 온 기준값은 고를 수 있되 안내를 단다', () => {
    renderBar({ status: { ...codes([['CODE-C', '합성 상태 C']]), truncated: true } });

    expect(screen.getByLabelText(t.fields.statusCode)).toHaveAccessibleDescription(t.codeTruncated);
  });
});
