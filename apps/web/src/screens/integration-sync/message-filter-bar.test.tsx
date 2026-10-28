import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_FILTERS, type MessageFilters } from './filters';
import { MessageFilterBar } from './message-filter-bar';
import type { PeriodInput } from './period';

const APPLIED: PeriodInput = { from: '2026-08-01', to: '2026-08-06' };

interface BarOptions {
  period?: PeriodInput;
  filters?: MessageFilters;
  statusOptions?: string[];
  interfaceOptions?: string[];
  directionOptions?: string[];
}

interface FilterChangeCase {
  key: keyof MessageFilters;
  label: string;
  value: string;
  /** 선택칸에 보이는 이름 — 코드 대신 업무 이름(모르는 코드는 코드 그대로). */
  shown: string;
}

const FILTER_CHANGE_CASES: FilterChangeCase[] = [
  { key: 'status', label: '상태', value: 'FAILED', shown: '실패' },
  { key: 'iface', label: '항목', value: 'IF-GR-SEND', shown: '입고 (G/R)' },
  { key: 'direction', label: '구분', value: 'OUTBOUND', shown: '송신' },
  { key: 'retryMin', label: '재시도 횟수(이상)', value: '5', shown: '5' },
];

const renderBar = ({
  period = APPLIED,
  filters = EMPTY_FILTERS,
  statusOptions = [],
  interfaceOptions = [],
  directionOptions = [],
}: BarOptions = {}) => {
  const onSearch = vi.fn();
  const onRemoveFilter = vi.fn();
  const onReset = vi.fn();

  const element = (nextPeriod: PeriodInput, nextFilters: MessageFilters) => (
    <MessageFilterBar
      appliedPeriod={nextPeriod}
      appliedFilters={nextFilters}
      statusOptions={statusOptions}
      interfaceOptions={interfaceOptions}
      directionOptions={directionOptions}
      onSearch={onSearch}
      onRemoveFilter={onRemoveFilter}
      onReset={onReset}
    />
  );

  const view = render(element(period, filters));

  return {
    onSearch,
    onRemoveFilter,
    onReset,
    user: userEvent.setup(),
    rerenderWithPeriod: (next: PeriodInput) => {
      view.rerender(element(next, filters));
    },
    rerenderWithApplied: (nextPeriod: PeriodInput, nextFilters: MessageFilters) => {
      view.rerender(element(nextPeriod, nextFilters));
    },
  };
};

describe('MessageFilterBar — 기간', () => {
  it('적용된 기간이 입력칸에 채워진다', () => {
    renderBar();

    expect(screen.getByLabelText('기간 시작')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('기간 종료')).toHaveValue('2026-08-06');
  });

  it('바깥에서 기간이 바뀌면 입력칸이 따라간다 — 초기화·뒤로가기가 화면에 반영돼야 한다', () => {
    const { rerenderWithPeriod } = renderBar();

    rerenderWithPeriod({ from: '2026-07-01', to: '2026-07-31' });

    expect(screen.getByLabelText('기간 시작')).toHaveValue('2026-07-01');
  });

  it('같은 기간·조건 값의 새 객체가 와도 편집 중인 값을 보존한다', async () => {
    const { rerenderWithApplied, user } = renderBar();

    await user.clear(screen.getByLabelText('기간 종료'));
    await user.type(screen.getByLabelText('기간 종료'), '2026-08-10');
    await user.type(screen.getByLabelText('재시도 횟수(이상)'), '3');

    rerenderWithApplied({ ...APPLIED }, { ...EMPTY_FILTERS });

    expect(screen.getByLabelText('기간 종료')).toHaveValue('2026-08-10');
    expect(screen.getByLabelText('재시도 횟수(이상)')).toHaveValue(3);
  });

  it.each([
    {
      field: 'from',
      next: { from: '2026-07-01', to: APPLIED.to },
      label: '기간 시작',
      expected: '2026-07-01',
    },
    {
      field: 'to',
      next: { from: APPLIED.from, to: '2026-07-31' },
      label: '기간 종료',
      expected: '2026-07-31',
    },
  ] satisfies { field: keyof PeriodInput; next: PeriodInput; label: string; expected: string }[])(
    '적용된 기간의 $field 값만 바뀌어도 편집 상태를 그 값으로 돌린다',
    ({ next, label, expected }) => {
      const { rerenderWithApplied } = renderBar();

      rerenderWithApplied(next, { ...EMPTY_FILTERS });

      expect(screen.getByLabelText(label)).toHaveValue(expected);
    },
  );

  it('고치는 동안에는 조회가 나가지 않고 조회를 누를 때 고친 값이 넘어간다', async () => {
    const { onSearch, user } = renderBar();

    await user.clear(screen.getByLabelText('기간 종료'));
    await user.type(screen.getByLabelText('기간 종료'), '2026-08-10');
    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith({ from: '2026-08-01', to: '2026-08-10' }, EMPTY_FILTERS);
  });

  it('기간이 갖춰지지 않으면 조회를 잠그고 사유를 이어 준다', async () => {
    const { onSearch, user } = renderBar();

    await user.clear(screen.getByLabelText('기간 시작'));

    const button = screen.getByRole('button', { name: '조회' });
    expect(button).toBeDisabled();
    expect(button.getAttribute('aria-describedby')).not.toBeNull();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('초기화는 기간이 잠긴 상태에서도 쓸 수 있다 — 되돌릴 수단까지 막으면 갇힌다', async () => {
    const { onReset, user } = renderBar({ period: { from: '', to: '' } });

    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('MessageFilterBar — 조건 4종', () => {
  it('선택칸마다 눈에 보이는 라벨이 붙는다', () => {
    renderBar();

    for (const label of ['구분', '항목', '상태', '재시도 횟수(이상)']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    // 대상 유형 칸은 두지 않는다 — 값이 시스템 코드라 읽을 수 없고 항목과 짝이다.
    expect(screen.queryByLabelText('대상 유형')).toBeNull();
  });

  it('선택지 출처를 설명하는 안내문은 두지 않는다(사용자 지시 2026-10-27)', () => {
    renderBar();

    expect(screen.queryByText(/선택지는 조회한 기간의 기록에서 만듭니다/)).toBeNull();
  });

  it.each(FILTER_CHANGE_CASES)(
    '적용된 $key 값만 바뀌어도 편집 상태를 그 값으로 돌린다',
    ({ key, label, value, shown }) => {
      const { rerenderWithApplied } = renderBar({
        statusOptions: ['FAILED'],
        interfaceOptions: ['IF-GR-SEND'],
        directionOptions: ['OUTBOUND'],
      });

      rerenderWithApplied({ ...APPLIED }, { ...EMPTY_FILTERS, [key]: value });

      const field = screen.getByLabelText(label);
      if (key === 'retryMin') {
        expect(field).toHaveValue(Number(value));
        return;
      }
      expect(field).toHaveTextContent(shown);
    },
  );

  it('시도 하한을 고쳐 조회하면 그 값이 함께 넘어간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText('재시도 횟수(이상)'), '3');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith(APPLIED, { ...EMPTY_FILTERS, retryMin: '3' });
  });

  it('걸린 조건마다 칩이 나오고 ×를 누르면 그 조건만 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({
      filters: { ...EMPTY_FILTERS, status: 'FAILED', retryMin: '2' },
    });

    expect(screen.getByText('상태: 실패')).toBeInTheDocument();
    expect(screen.getByText('재시도 2회 이상')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '상태 조건 제거' }));

    expect(onRemoveFilter).toHaveBeenCalledWith('status');
  });

  it('조건이 없으면 칩을 만들지 않는다', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: '상태 조건 제거' })).not.toBeInTheDocument();
  });
});
