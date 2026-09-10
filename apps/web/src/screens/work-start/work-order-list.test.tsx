/**
 * ② 목록 구획의 «상태 네 갈래» 감지기.
 *
 * ⛔ **화면 전체가 아니라 이 구획만 세워 잰다.** 「받는 중」은 조회가 답하기 전 한 순간이라
 * 서버 스텁 위에서는 재현이 들쭉날쭉하다 — 상태를 직접 넣어야 네 갈래가 다 잡힌다.
 */
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkOrderList } from './work-order-list';

const nav = messages.popPageNav;

const t = messages.workStart.list;

const base = {
  workOrders: undefined,
  isAsked: true,
  isLoading: false,
  isError: false,
  total: undefined,
  pageMeta: undefined,
  onPageChange: () => undefined,
  isShowingAll: false,
  isEquipmentUnknown: false,
  canSelect: true,
  selectedId: null,
  onSelect: () => undefined,
  onToggleScope: () => undefined,
  onRetry: () => undefined,
  /* 단위는 이 시험의 관심이 아니다 — 못 받은 상태로 두면 수량만 선다. */
  uomCodeOf: () => null,
};

describe('P-02-01 작업지시 목록 — 「없다」와 「모른다」를 가른다', () => {
  /** ⛔ 받는 중을 무표시로 두면 그 몇 초 사이에 작업자가 「지시가 없다」로 읽고 자리를 뜬다. */
  it('받는 중에는 받는 중이라고 말한다', () => {
    render(<WorkOrderList {...base} isLoading />);

    expect(screen.getByText(t.loading)).toBeInTheDocument();
    expect(screen.queryByText(t.empty)).not.toBeInTheDocument();
  });

  it('다 받고 나서 비어 있을 때만 「없습니다」로 말한다', () => {
    render(<WorkOrderList {...base} workOrders={[]} />);

    expect(screen.getByText(t.empty)).toBeInTheDocument();
    expect(screen.queryByText(t.loading)).not.toBeInTheDocument();
  });

  /** 아직 묻지도 않은 상태는 셋 다 아니다 — 아무 말도 하지 않는다. */
  it('묻지 않았으면 없다고도 받는 중이라고도 하지 않는다', () => {
    render(<WorkOrderList {...base} isAsked={false} />);

    expect(screen.queryByText(t.loading)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty)).not.toBeInTheDocument();
  });

  it('실패는 사유와 다시 시도할 경로를 함께 준다', () => {
    render(<WorkOrderList {...base} isError />);

    expect(screen.getByText(t.loadError)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.retry })).toBeInTheDocument();
  });
});

/**
 * 쪽 넘김 — **잘렸다고 말하기만 하던 자리**(#1005 · G-34).
 *
 * ⛔ 전에는 「N건 중 20건을 보이고 있습니다」로 끝나 **21번째 지시를 고를 방법이 없었다.**
 *    키오스크에는 주소창도 뒤로가기도 없어 화면이 주지 않으면 길이 아예 없다.
 */
describe('P-02-01 작업지시 목록 쪽 넘김 (#1005)', () => {
  const paged = { page: 1, size: 20, total: 45 };

  it('쪽이 여럿이면 넘길 단추를 세운다', () => {
    render(<WorkOrderList {...base} pageMeta={paged} total={45} />);

    expect(screen.getByRole('button', { name: nav.pageDown })).toBeEnabled();
  });

  it('첫 쪽에서는 위로 갈 수 없다', () => {
    render(<WorkOrderList {...base} pageMeta={paged} total={45} />);

    expect(screen.getByRole('button', { name: nav.pageUp })).toBeDisabled();
  });

  it('마지막 쪽에서는 아래로 갈 수 없다', () => {
    render(<WorkOrderList {...base} pageMeta={{ page: 3, size: 20, total: 45 }} total={45} />);

    expect(screen.getByRole('button', { name: nav.pageDown })).toBeDisabled();
    expect(screen.getByRole('button', { name: nav.pageUp })).toBeEnabled();
  });

  it('누르면 다음 쪽을 청한다', async () => {
    const onPageChange = vi.fn();

    render(<WorkOrderList {...base} pageMeta={paged} total={45} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: nav.pageDown }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  /* ⛔ 누를 수 없는 단추 둘이 늘 서 있으면 좁은 화면만 잡아먹는다. */
  it('쪽이 하나뿐이면 세우지 않는다', () => {
    render(<WorkOrderList {...base} pageMeta={{ page: 1, size: 20, total: 7 }} total={7} />);

    expect(screen.queryByRole('button', { name: nav.pageDown })).not.toBeInTheDocument();
  });
});
