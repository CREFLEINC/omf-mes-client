import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickDateRange } from '../../test/date-picker';
import { toCodeOptions } from './code-options';
import { EMPTY_FILTERS } from './filters';
import { RequestFilterBar, type RequestFilterBarProps } from './request-filter-bar';

const t = messages.approvalInbox;

const baseProps = (): RequestFilterBarProps => ({
  appliedFilters: EMPTY_FILTERS,
  approvalTypeOptions: [],
  onSearch: vi.fn(),
  onReset: vi.fn(),
});

const renderBar = (overrides: Partial<RequestFilterBarProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  const result = render(<RequestFilterBar {...props} />);

  return { ...result, ...props, user: userEvent.setup() };
};

describe('RequestFilterBar — 자리표시 선택칸', () => {
  it('값 목록이 비면 왜 비었는지 밝힌다', () => {
    renderBar();

    expect(screen.getAllByText(messages.pendingCode.note).length).toBe(1);
    expect(screen.getAllByText(messages.pendingCode.placeholder).length).toBe(1);
  });

  it('값 목록이 비어도 조회는 열려 있고, 초기화는 바뀐 것이 생기면 나타난다', async () => {
    const { user } = renderBar();

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();

    await user.type(screen.getByLabelText(t.fields.q), 'S');

    expect(screen.getByRole('button', { name: messages.common.reset })).toBeEnabled();
  });

  /* #361 — 상태는 화면 맨 위 라벨이 맡는다. 조회 상자에는 상태 칸도 「조건 더보기」도 없다. */
  it('상태 칸과 「조건 더보기」를 두지 않는다', () => {
    renderBar();

    expect(screen.queryByLabelText(t.fields.status)).toBeNull();
    expect(screen.queryByRole('button', { name: messages.common.filterMore.open })).toBeNull();
  });

  it('값이 오면 선택칸이 살아난다 — 자리표시가 죽은 가지가 아니다', () => {
    renderBar({ approvalTypeOptions: toCodeOptions(['GOODS_ISSUE_DISPOSAL']) });

    /* 안내는 채워진 칸에서 사라진다. */
    expect(screen.queryByText(messages.pendingCode.note)).toBeNull();
    /* 「전체」가 붙는다 — 한 번 고른 뒤 해제할 방법이 칸 안에 생긴다. */
    expect(screen.getByLabelText(t.fields.approvalTypeFilter)).toHaveTextContent(t.filters.all);
  });

  it('값이 오면 그 값을 고를 수 있다', async () => {
    const { onSearch, user } = renderBar({
      approvalTypeOptions: toCodeOptions(['GOODS_ISSUE_DISPOSAL', 'INVENTORY_ADJUSTMENT']),
    });

    await user.click(screen.getByLabelText(t.fields.approvalTypeFilter));
    await user.click(screen.getByRole('option', { name: 'INVENTORY_ADJUSTMENT' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      approvalTypeCode: 'INVENTORY_ADJUSTMENT',
    });
  });
});

describe('RequestFilterBar — 모아서 적용', () => {
  it('요청번호를 치고 조회를 누르면 그 값이 올라간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH-REQ-001');
    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...EMPTY_FILTERS, q: 'SYNTH-REQ-001' });
  });

  it('고친 기간은 조회를 눌러야 올라간다', async () => {
    const { onSearch, user } = renderBar();

    await pickDateRange(
      user,
      screen.getByLabelText(t.fields.periodFrom),
      screen.getByLabelText(t.fields.periodTo),
      '2026-07-20',
      '2026-07-25',
    );
    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      from: '2026-07-20',
      to: '2026-07-25',
    });
  });

  it('엔터로도 조회된다 — 검색칸에서 엔터가 아무 일도 하지 않으면 멈춘 것으로 읽힌다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH{Enter}');

    expect(onSearch).toHaveBeenCalledWith({ ...EMPTY_FILTERS, q: 'SYNTH' });
  });
});

describe('RequestFilterBar — 주소가 정본이다', () => {
  it('바깥에서 조건이 바뀌면 컨트롤이 따라간다 — 뒤로가기가 값을 되돌린다', () => {
    const props = baseProps();
    const { rerender } = render(<RequestFilterBar {...props} />);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('');

    rerender(
      <RequestFilterBar {...props} appliedFilters={{ ...EMPTY_FILTERS, q: 'SYNTH-REQ-002' }} />,
    );

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SYNTH-REQ-002');
  });

  it('내용이 같은 새 객체가 와도 치던 값을 덮지 않는다', async () => {
    const props = baseProps();
    const { rerender } = render(<RequestFilterBar {...props} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH');

    /* 부모가 다시 그려지는 것은 조회 응답이 도착할 때마다 실제로 일어난다(#43). */
    rerender(<RequestFilterBar {...props} appliedFilters={{ ...EMPTY_FILTERS }} />);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SYNTH');
  });

  it('초기화는 자기 편집 상태도 함께 비운다', async () => {
    const { onReset, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(t.fields.q)).toHaveValue('');
  });
});

describe('RequestFilterBar — 상태는 라벨 몫', () => {
  it('[초기화]는 상태를 풀지 않는다 — 상태는 맨 위 라벨이 맡는다(#361)', async () => {
    const { onReset, user } = renderBar({
      appliedFilters: { ...EMPTY_FILTERS, statusCode: 'APPROVED' },
    });

    /* 상태만 걸려 있으면 바뀐 조건이 아니다. */
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();

    await user.type(screen.getByLabelText(t.fields.q), 'S');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
