/**
 * ② 목록 구획의 «상태 네 갈래» 감지기.
 *
 * ⛔ **화면 전체가 아니라 이 구획만 세워 잰다.** 「받는 중」은 조회가 답하기 전 한 순간이라
 * 서버 스텁 위에서는 재현이 들쭉날쭉하다 — 상태를 직접 넣어야 네 갈래가 다 잡힌다.
 */
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkOrderList } from './work-order-list';

const t = messages.workStart.list;

const base = {
  workOrders: undefined,
  isAsked: true,
  isLoading: false,
  isError: false,
  total: undefined,
  isShowingAll: false,
  isEquipmentUnknown: false,
  canSelect: true,
  selectedId: null,
  onSelect: () => undefined,
  onToggleScope: () => undefined,
  onRetry: () => undefined,
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
