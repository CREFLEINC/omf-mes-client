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
}

const renderBar = ({
  period = APPLIED,
  filters = EMPTY_FILTERS,
  statusOptions = [],
}: BarOptions = {}) => {
  const onSearch = vi.fn();
  const onRemoveFilter = vi.fn();
  const onReset = vi.fn();

  const element = (nextPeriod: PeriodInput) => (
    <MessageFilterBar
      appliedPeriod={nextPeriod}
      appliedFilters={filters}
      statusOptions={statusOptions}
      interfaceOptions={[]}
      directionOptions={[]}
      targetTypeOptions={[]}
      onSearch={onSearch}
      onRemoveFilter={onRemoveFilter}
      onReset={onReset}
    />
  );

  const view = render(element(period));

  return {
    onSearch,
    onRemoveFilter,
    onReset,
    user: userEvent.setup(),
    rerenderWithPeriod: (next: PeriodInput) => {
      view.rerender(element(next));
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

describe('MessageFilterBar — 조건 5종', () => {
  it('선택칸마다 눈에 보이는 라벨이 붙는다', () => {
    renderBar();

    for (const label of ['상태', '연계 종류', '방향', '대상 유형', '시도 횟수 하한']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('선택지 아래에 어디서 만든 목록인지 안내가 붙는다', () => {
    renderBar();

    expect(
      screen.getByText(
        '선택지는 조회한 기간의 기록에서 만듭니다. 한 번도 실행되지 않았거나 이 기간에 없는 값은 목록에 없습니다.',
      ),
    ).toBeInTheDocument();
  });

  it('시도 하한을 고쳐 조회하면 그 값이 함께 넘어간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText('시도 횟수 하한'), '3');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith(APPLIED, { ...EMPTY_FILTERS, retryMin: '3' });
  });

  it('걸린 조건마다 칩이 나오고 ×를 누르면 그 조건만 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({
      filters: { ...EMPTY_FILTERS, status: 'FAILED', retryMin: '2' },
    });

    expect(screen.getByText('상태: FAILED')).toBeInTheDocument();
    expect(screen.getByText('시도 횟수 하한: 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '상태 조건 제거' }));

    expect(onRemoveFilter).toHaveBeenCalledWith('status');
  });

  it('조건이 없으면 칩을 만들지 않는다', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: '상태 조건 제거' })).not.toBeInTheDocument();
  });
});
