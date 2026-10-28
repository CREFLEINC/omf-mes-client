/**
 * ② 목록 구획의 «상태 네 갈래» 감지기.
 *
 * ⛔ **화면 전체가 아니라 이 구획만 세워 잰다.** 「받는 중」은 조회가 답하기 전 한 순간이라
 * 서버 스텁 위에서는 재현이 들쭉날쭉하다 — 상태를 직접 넣어야 네 갈래가 다 잡힌다.
 */
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
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
  scope: 'default' as const,
  equipmentName: '합성 프레스 1호기',
  isEquipmentUnknown: false,
  selectedId: null,
  onSelect: () => undefined,
  onScopeChange: () => undefined,
  onRetry: () => undefined,
  /* 단위는 이 시험의 관심이 아니다 — 못 받은 상태로 두면 수량만 선다. */
  uomCodeOf: () => null,
};

describe('P-02-01 작업지시 목록 — 「없다」와 「모른다」를 가른다', () => {
  /** ⛔ 받는 중을 무표시로 두면 그 몇 초 사이에 작업자가 「지시가 없다」로 읽고 자리를 뜬다. */
  it('받는 중에는 받는 중이라고 말한다', () => {
    render(<WorkOrderList {...base} isLoading />);

    expect(screen.getByText(t.loading)).toBeInTheDocument();
    expect(screen.queryByText(t.empty('합성 프레스 1호기'))).not.toBeInTheDocument();
  });

  it('다 받고 나서 비어 있을 때만 「없습니다」로 말한다', () => {
    render(<WorkOrderList {...base} workOrders={[]} />);

    expect(screen.getByText(t.empty('합성 프레스 1호기'))).toBeInTheDocument();
    expect(screen.queryByText(t.loading)).not.toBeInTheDocument();
  });

  /** 아직 묻지도 않은 상태는 셋 다 아니다 — 아무 말도 하지 않는다. */
  it('묻지 않았으면 없다고도 받는 중이라고도 하지 않는다', () => {
    render(<WorkOrderList {...base} isAsked={false} />);

    expect(screen.queryByText(t.loading)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty('합성 프레스 1호기'))).not.toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: nav.next })).toBeEnabled();
  });

  it('첫 쪽에서는 위로 갈 수 없다', () => {
    render(<WorkOrderList {...base} pageMeta={paged} total={45} />);

    expect(screen.getByRole('button', { name: nav.prev })).toBeDisabled();
  });

  it('마지막 쪽에서는 아래로 갈 수 없다', () => {
    render(<WorkOrderList {...base} pageMeta={{ page: 3, size: 20, total: 45 }} total={45} />);

    expect(screen.getByRole('button', { name: nav.next })).toBeDisabled();
    expect(screen.getByRole('button', { name: nav.prev })).toBeEnabled();
  });

  it('누르면 다음 쪽을 청한다', async () => {
    const onPageChange = vi.fn();

    render(<WorkOrderList {...base} pageMeta={paged} total={45} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: nav.next }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  /* ⛔ 누를 수 없는 단추 둘이 늘 서 있으면 좁은 화면만 잡아먹는다. */
  it('쪽이 하나뿐이면 세우지 않는다', () => {
    render(<WorkOrderList {...base} pageMeta={{ page: 1, size: 20, total: 7 }} total={7} />);

    expect(screen.queryByRole('button', { name: nav.next })).not.toBeInTheDocument();
  });
});

describe('P-02-01 작업지시 카드 — T-P-W 카드 정보', () => {
  const row = (workOrderId: number, statusCode: string) => ({
    workOrderId,
    workOrderNo: `SYN-WO-${String(workOrderId)}`,
    productionPlanId: 1,
    routingOperationId: 1,
    itemId: 1,
    itemCode: 'SYN-ITEM-01',
    processName: '합성 사출',
    orderQty: 500,
    uomId: 1,
    workOrderTypeCode: 'NORMAL',
    statusCode,
    priorityNo: 100,
    plannedEquipmentId: 1,
    progress: { goodQty: 120, achievementRate: 0.24, completionJudgmentCode: 'UNDER' as const },
  });

  it('상태 이름, 품목, 공정, 실적과 지시를 보이고 코드값은 보이지 않는다', () => {
    render(<WorkOrderList {...base} workOrders={[row(1, 'IN_PROGRESS')]} />);

    expect(screen.getByText(t.status.inProgress)).toBeInTheDocument();
    expect(screen.queryByText('IN_PROGRESS')).not.toBeInTheDocument();
    expect(screen.getByText('SYN-ITEM-01')).toBeInTheDocument();
    expect(screen.getByText('합성 사출')).toBeInTheDocument();
    expect(screen.getByText(t.progress('120', '500', null))).toBeInTheDocument();
  });

  /** 제목 줄과 정보 영역을 나눈다(C-21, 사용자 결정 2026-10-26). */
  it('제목 줄은 W/O 번호와 오른쪽 끝 상태 칩, 정보 영역은 「라벨 값」 쌍이다', () => {
    render(
      <WorkOrderList
        {...base}
        uomCodeOf={() => 'EA'}
        workOrders={[
          {
            ...row(1, 'IN_PROGRESS'),
            plannedEquipmentCode: 'SYN-PRS-01',
            plannedEquipmentName: '합성 프레스 1호기',
            plannedStartAt: '2026-09-02T08:00:00+09:00',
          },
        ]}
      />,
    );

    const card = screen.getByRole('button', { name: t.select('SYN-WO-1') });
    const head = card.querySelector('.pop-row-head') as HTMLElement;
    const info = card.querySelector('.pop-row-info') as HTMLElement;

    expect(within(head).getByText('SYN-WO-1')).toHaveClass('work-start-wo-no');
    /* 상태 칩은 제목 줄 오른쪽 끝 칩 자리의 마지막이다. */
    const chips = head.querySelector('.pop-row-chips') as HTMLElement;
    expect(chips.lastElementChild).toHaveTextContent(t.status.inProgress);
    expect(within(head).queryByText('SYN-ITEM-01')).toBeNull();

    const labels = [...info.querySelectorAll('.pop-row-info-label')].map((el) => el.textContent);
    expect(labels).toEqual([
      messages.workStart.selection.item,
      messages.workStart.selection.process,
      t.equipment,
      messages.workStart.selection.plannedStart,
      t.goodLabel,
    ]);
    /* 두 열: 품목과 공정은 한 줄, 설비, 계획 시작, 실적은 한 줄을 다 쓴다(PG-31). */
    expect(info).toHaveClass('pop-row-info-two');
    const wide = [...info.querySelectorAll('.pop-row-info-label.pop-row-info-wide')].map(
      (el) => el.textContent,
    );
    expect(wide).toEqual([t.equipment, messages.workStart.selection.plannedStart, t.goodLabel]);
    expect(info).toHaveTextContent(`${t.equipment} 합성 프레스 1호기 (SYN-PRS-01)`);
    /* 수량은 「실적 / 지시」 한 쌍과 막대다. 가운뎃점이나 「지시」 글자를 잇지 않는다. */
    expect(within(info).getByText(t.progress('120', '500', 'EA'))).toBeInTheDocument();
    expect(within(info).getByRole('progressbar')).toBeInTheDocument();
  });

  it('실적을 못 받으면 지시 수량만 보이고 막대를 두지 않는다', () => {
    const { progress: _ignored, ...withoutProgress } = row(1, 'RELEASED');

    render(<WorkOrderList {...base} uomCodeOf={() => 'EA'} workOrders={[withoutProgress]} />);

    const card = screen.getByRole('button', { name: t.select('SYN-WO-1') });
    expect(card).toHaveTextContent(`${t.orderLabel} 500 EA`);
    expect(within(card).queryByRole('progressbar')).toBeNull();
  });

  it('진행 중인 W/O 를 위에 둔다', () => {
    render(<WorkOrderList {...base} workOrders={[row(1, 'RELEASED'), row(2, 'IN_PROGRESS')]} />);

    const cards = screen.getAllByRole('button', { name: /^SYN-WO-/ });
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      t.select('SYN-WO-2'),
      t.select('SYN-WO-1'),
    ]);
  });
});

describe('P-02-01 작업지시 목록 — 건수 줄', () => {
  it('건수는 쪽 수와 관계없이 관리웹과 같은 「총 N건」이다', () => {
    const { rerender } = render(
      <WorkOrderList
        {...base}
        workOrders={[]}
        total={13}
        pageMeta={{ page: 1, size: 20, total: 13 }}
      />,
    );
    expect(screen.getByText(t.total(13))).toBeInTheDocument();

    rerender(
      <WorkOrderList
        {...base}
        workOrders={[]}
        total={29}
        pageMeta={{ page: 2, size: 20, total: 29 }}
      />,
    );
    expect(screen.getByText(t.total(29))).toBeInTheDocument();
  });
});
