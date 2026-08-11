import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickRange } from '../../test/date-picker';
import { EventFilterBar, type EventFilterBarProps } from './event-filter-bar';
import { EMPTY_FILTERS } from './filters';

const baseProps = (): EventFilterBarProps => ({
  appliedPeriod: { from: '2026-08-01', to: '2026-08-07' },
  appliedFilters: EMPTY_FILTERS,
  targetTypeOptions: ['SAMPLE_TARGET_A', 'SAMPLE_TARGET_B'],
  eventTypeOptions: ['SAMPLE_EVENT_A'],
  onSearch: vi.fn(),
  onRemoveFilter: vi.fn(),
  onReset: vi.fn(),
});

const renderBar = (overrides: Partial<EventFilterBarProps> = {}) => {
  const props = { ...baseProps(), ...overrides };

  render(<EventFilterBar {...props} />);

  return { ...props, user: userEvent.setup() };
};

describe('EventFilterBar — 조회 기간', () => {
  it('주소에 반영된 기간이 컨트롤에 들어 있다', () => {
    renderBar();

    expect(screen.getByLabelText('조회 기간')).toHaveTextContent('2026-08-01 ~ 2026-08-07');
  });

  /* 트리거 모델은 「모아서 적용」이다 — 고치는 동안 조회가 나가면 반쯤 지운 기간으로 요청이 나간다. */
  it('고친 기간은 조회를 눌러야 올라간다', async () => {
    const { onSearch, user } = renderBar();

    await pickRange(user, screen.getByLabelText('조회 기간'), '2026-07-20', '2026-08-07');

    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith({ from: '2026-07-20', to: '2026-08-07' }, EMPTY_FILTERS);
  });

  /*
   * **빈 기간은 주소에서 온다.** 기간 컨트롤에는 고른 날짜를 다시 비우는 수단이 없어
   * 「비운다」는 조작이 없어졌지만, 주소는 사용자가 직접 고칠 수 있고 조회 조건의 정본은 주소다.
   * 막아야 할 상태는 그대로 있으므로 그 상태에서 잣대를 댄다.
   */
  it('기간이 비어 있으면 조회가 잠기고 사유가 보이며 조회가 올라가지 않는다', () => {
    const { onSearch } = renderBar({ appliedPeriod: { from: '', to: '' } });

    const searchButton = screen.getByRole('button', { name: '조회' });
    expect(searchButton).toBeDisabled();

    // 비활성 컨트롤은 포커스를 받지 못한다 — 사유는 감추지 않고 항상 보이는 DOM 텍스트여야 한다.
    const reasonId = searchButton.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(reasonId)).toHaveTextContent(
      '조회는 기간을 모두 채운 뒤에 쓸 수 있습니다.',
    );
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('기간이 역전되면 잠기고 다른 사유가 보인다', () => {
    renderBar({ appliedPeriod: { from: '2026-08-07', to: '2026-07-01' } });

    const searchButton = screen.getByRole('button', { name: '조회' });
    expect(searchButton).toBeDisabled();

    const reasonId = searchButton.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(reasonId)).toHaveTextContent(
      '기간 종료는 기간 시작보다 앞설 수 없습니다.',
    );
  });

  /*
   * 두 칸일 때는 종료를 시작보다 앞에 **넣을 수 있었고** 화면이 그것을 막았다.
   * 한 컨트롤이 된 뒤에는 역순으로 눌러도 뒤집힌 쌍이 만들어지지 않는다 —
   * 컴포넌트가 시작을 다시 잡고 **아직 완결되지 않은 기간은 값이 되지 않는다.**
   * 반쯤 고른 기간이 조회로 새어 나가지 않는지가 이 화면의 「모아서 적용」이 지키려는 것이다.
   */
  it('역순으로 누른 반쪽 기간은 조회로 새어 나가지 않는다', async () => {
    const { onSearch, user } = renderBar();

    // 늦은 날을 먼저, 이른 날을 나중에 누른다.
    await pickRange(user, screen.getByLabelText('조회 기간'), '2026-08-20', '2026-08-05');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith({ from: '2026-08-01', to: '2026-08-07' }, EMPTY_FILTERS);
  });

  it('기간이 갖춰지면 사유가 사라지고 잠금도 풀린다', () => {
    renderBar();

    const searchButton = screen.getByRole('button', { name: '조회' });

    expect(searchButton).toBeEnabled();
    expect(searchButton).not.toHaveAttribute('aria-describedby');
  });

  it('바깥에서 기간이 바뀌면 컨트롤이 따라간다 — 뒤로가기가 값을 되돌린다', () => {
    const props = baseProps();
    const { rerender } = render(<EventFilterBar {...props} />);

    expect(screen.getByLabelText('조회 기간')).toHaveTextContent('2026-08-01 ~ 2026-08-07');

    rerender(<EventFilterBar {...props} appliedPeriod={{ from: '2026-07-01', to: '2026-07-31' }} />);

    expect(screen.getByLabelText('조회 기간')).toHaveTextContent('2026-07-01 ~ 2026-07-31');
  });

  /*
   * 위 테스트의 짝이다. 부모는 렌더할 때마다 주소에서 값을 새로 읽어 **내용은 같은데 참조만
   * 새로운** 객체를 내려보낼 수 있다(조회 응답이 도착해 다시 그려질 때가 그렇다).
   * 되돌림을 참조로 판정하면 그때마다 사용자가 입력하던 값이 사라진다.
   */
  it('같은 내용의 새 참조가 와도 편집 중인 값을 건드리지 않는다', async () => {
    const props = baseProps();
    const { rerender } = render(<EventFilterBar {...props} />);
    const user = userEvent.setup();

    await pickRange(user, screen.getByLabelText('조회 기간'), '2026-07-20', '2026-08-07');
    await user.type(screen.getByLabelText('대상'), '9101');

    // 값은 같고 참조만 새로운 객체를 내려보낸다.
    rerender(
      <EventFilterBar
        {...props}
        appliedPeriod={{ from: '2026-08-01', to: '2026-08-07' }}
        appliedFilters={{ ...EMPTY_FILTERS }}
      />,
    );

    expect(screen.getByLabelText('조회 기간')).toHaveTextContent('2026-07-20 ~ 2026-08-07');
    expect(screen.getByLabelText('대상')).toHaveValue(9101);
  });

  it('초기화는 화면이 처리하도록 그대로 올린다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('EventFilterBar — 조건 5종', () => {
  it('다섯 조건 칸이 모두 이름을 갖는다', () => {
    renderBar();

    expect(screen.getByLabelText('대상 종류')).toBeInTheDocument();
    expect(screen.getByLabelText('사건 종류')).toBeInTheDocument();
    expect(screen.getByLabelText('대상')).toBeInTheDocument();
    expect(screen.getByLabelText('수행자')).toBeInTheDocument();
    expect(screen.getByLabelText('상관 식별자')).toBeInTheDocument();
  });

  it('고른 조건이 조회에 함께 올라간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText('대상'), '9101');
    await user.type(screen.getByLabelText('상관 식별자'), 'SAMPLE-CORR-0001');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith(
      { from: '2026-08-01', to: '2026-08-07' },
      { ...EMPTY_FILTERS, targetId: '9101', correlationId: 'SAMPLE-CORR-0001' },
    );
  });

  it('선택지에 조회 결과에서 만든 값이 들어 있다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByLabelText('대상 종류'));

    expect(screen.getByRole('option', { name: 'SAMPLE_TARGET_B' })).toBeInTheDocument();
  });

  /* 두지 않으면 한 번 고른 뒤에 조건을 해제할 방법이 선택칸 안에 없어진다. */
  it('선택칸에 「전체」가 있다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByLabelText('사건 종류'));

    expect(screen.getByRole('option', { name: '전체' })).toBeInTheDocument();
  });

  it('선택지 안내에 「임시 목록」이 들어 있다', () => {
    renderBar();

    expect(screen.getByText(/임시 목록/)).toBeInTheDocument();
  });

  it('선택지 안내가 기간의 한계도 밝힌다', () => {
    renderBar();

    expect(screen.getByText(/이 기간에 없는 값은 목록에 없습니다/)).toBeInTheDocument();
  });
});

describe('EventFilterBar — 조건 칩', () => {
  it('적용된 조건마다 칩이 하나씩 나온다', () => {
    renderBar({
      appliedFilters: { ...EMPTY_FILTERS, targetType: 'SAMPLE_TARGET_A', performedBy: '9201' },
    });

    expect(screen.getByText('대상 종류: SAMPLE_TARGET_A')).toBeInTheDocument();
    expect(screen.getByText('수행자: 9201')).toBeInTheDocument();
  });

  it('×를 누르면 그 조건만 풀린다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: { ...EMPTY_FILTERS, targetType: 'SAMPLE_TARGET_A', performedBy: '9201' },
    });

    await user.click(screen.getByRole('button', { name: '수행자 조건 제거' }));

    expect(onRemoveFilter).toHaveBeenCalledWith('performedBy');
  });

  it('걸린 조건이 없으면 칩 줄도 없다', () => {
    renderBar();

    expect(screen.queryByText(/조건 제거$/)).not.toBeInTheDocument();
  });
});
