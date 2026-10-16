import type { DashboardEquipmentItem } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { toEquipmentView } from './equipment';
import { EquipmentBoard, StoppedPanel, formatElapsed } from './equipment-panel';

const t = messages.dashboard.equipment;

const item = (overrides: Partial<DashboardEquipmentItem>): DashboardEquipmentItem => ({
  equipmentId: 1,
  equipmentCode: 'EQ-01',
  equipmentName: '시험 설비 1',
  equipmentTypeCode: 'TYPE-A',
  equipmentTypeName: '100T',
  productionLineId: 10,
  productionLineName: '1라인',
  statusCode: 'RUNNING',
  statusSince: '2026-10-16T01:00:00Z',
  statusReasonCode: null,
  statusReasonName: null,
  todayTotalQty: 1200,
  todayNgQty: 6,
  defectRate: 0.7,
  standardCycleTimeSec: 32,
  currentWorkOrderNo: 'WO-1',
  currentItemCode: 'ITEM-1',
  currentItemName: '시험 품목',
  ...overrides,
});

const view = toEquipmentView({
  asOf: '2026-10-16T03:00:00Z',
  statusCounts: { RUNNING: 1, STOPPED: 1, WAITING: 1, CHANGEOVER: 0, IDLE: 0 },
  items: [
    item({}),
    item({
      equipmentId: 2,
      equipmentCode: 'EQ-02',
      productionLineId: 20,
      productionLineName: '2라인',
      statusCode: 'STOPPED',
      statusSince: '2026-10-16T01:35:00Z',
      statusReasonName: '유압 이상',
    }),
    item({
      equipmentId: 3,
      equipmentCode: 'EQ-03',
      equipmentTypeName: null,
      statusCode: 'WAITING',
      statusSince: '2026-10-16T02:50:00Z',
    }),
  ],
});

const tileOf = (code: string): HTMLElement =>
  screen.getByRole('button', { name: t.openDetail(code) });

describe('EquipmentBoard', () => {
  it('타일 — 호기 · 톤수 / 상태(가동도) / 금일 생산 / 가동이면 NG · 불량률 · C/T, 아니면 사유 · 경과', () => {
    render(<EquipmentBoard view={view} isLoading={false} isFailed={false} />);

    const running = within(tileOf('EQ-01'));
    expect(running.getByText('100T')).toBeInTheDocument();
    expect(running.getByText(t.status.RUNNING)).toBeInTheDocument();
    expect(running.getByText('1,200')).toBeInTheDocument();
    expect(
      running.getByText(`${t.ngLine('6', '0.7%')} · ${t.cycleLine('32초')}`),
    ).toBeInTheDocument();

    const stopped = within(tileOf('EQ-02'));
    expect(stopped.getByText(t.status.STOPPED)).toBeInTheDocument();
    expect(stopped.getByText('유압 이상')).toBeInTheDocument();
    expect(stopped.getByText(formatElapsed(85))).toBeInTheDocument();
    expect(tileOf('EQ-02')).toHaveClass('dash-eq-stopped');

    /* 톤수가 없으면 0이 아니라 「—」, 멈췄는데 사유가 없으면 「미등록」. */
    expect(within(tileOf('EQ-03')).getByText(t.none)).toBeInTheDocument();
    expect(within(tileOf('EQ-03')).getByText(t.reasonUnknown)).toBeInTheDocument();
  });

  it('정렬 — 정지 → 대기 → 교체 → 비가동 → 가동, 같은 상태는 코드 자연 정렬', () => {
    render(<EquipmentBoard view={view} isLoading={false} isFailed={false} />);

    const codes = screen
      .getAllByRole('button', { name: /상세 보기/ })
      .map((button) => button.querySelector('.dash-eq-code')?.textContent);
    expect(codes).toEqual(['EQ-02', 'EQ-03', 'EQ-01']);
  });

  it('라인 구분을 누르면 그 라인 타일만 남고 범례 대수도 그 범위로 바뀐다', async () => {
    const user = userEvent.setup();
    render(<EquipmentBoard view={view} isLoading={false} isFailed={false} />);

    expect(screen.getByRole('button', { name: `${t.allLines} 3` })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '2라인 1' }));

    expect(screen.queryByRole('button', { name: t.openDetail('EQ-01') })).not.toBeInTheDocument();
    expect(tileOf('EQ-02')).toBeInTheDocument();
    const legend = screen.getByRole('list', { name: t.legend });
    expect(within(legend).getByText(t.status.STOPPED).closest('li')).toHaveTextContent('1');
    expect(within(legend).getByText(t.status.RUNNING).closest('li')).toHaveTextContent('0');
  });

  it('상세 — 머리는 코드 + 상태 배지 · 라인 · 설비 종류, 본문은 상태 시간 · 생산 실적 · 현재 작업이고 X 로 닫힌다', async () => {
    const user = userEvent.setup();
    render(<EquipmentBoard view={view} isLoading={false} isFailed={false} />);

    await user.click(tileOf('EQ-02'));
    const dialog = screen.getByRole('dialog');
    /* 머리 — 설비 이름(시험 설비 1)은 코드 · 라인과 달라 보조 줄 앞에 붙는다. 상태는 배지 하나. */
    const heading = within(dialog).getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('EQ-02');
    expect(heading).toHaveTextContent(t.status.STOPPED);
    expect(heading).toHaveTextContent('시험 설비 1 · 2라인 · 100T');
    for (const group of [t.groupRun, t.groupOutput, t.groupWork]) {
      expect(within(dialog).getByRole('heading', { name: group })).toBeInTheDocument();
    }
    /* 사용자 지정 용어. 라인 · 설비 종류 · 상태는 머리로 올려 본문에 되풀이하지 않는다. */
    expect(t.ngQty).toBe('불량 수량');
    expect(within(dialog).queryByText(t.line)).not.toBeInTheDocument();
    for (const label of [
      t.reason,
      t.since,
      t.elapsed,
      t.todayQty,
      t.ngQty,
      t.defectRate,
      t.standardCycleTime,
      t.workOrder,
      t.item,
    ]) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    /* 닫기 단추는 오른쪽 위 X 하나뿐 — 하단 「닫기」 · 빈 바닥줄은 없다. */
    expect(within(dialog).getAllByRole('button', { name: messages.common.close })).toHaveLength(1);

    /* ESC 는 브라우저의 <dialog> cancel 로 오는데 jsdom 에는 없다 — 같은 길(onClose)로 가는 X 로 잰다. ESC 는 브라우저에서 확인. */
    await user.click(within(dialog).getByRole('button', { name: messages.common.close }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('마우스로 연 상세를 닫아 포커스가 타일로 돌아오면 링을 숨기고, 키보드로 연 경우엔 보인다', async () => {
    const user = userEvent.setup();
    render(<EquipmentBoard view={view} isLoading={false} isFailed={false} />);

    await user.click(tileOf('EQ-02'));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: messages.common.close }),
    );
    /* 닫힌 창이 포커스를 돌려주는 길 — jsdom 에는 그 동작이 없어 같은 포커스를 직접 준다. */
    act(() => {
      tileOf('EQ-02').focus();
    });
    expect(tileOf('EQ-02')).toHaveAttribute('data-pointer-focus');

    act(() => {
      tileOf('EQ-02').blur();
    });
    expect(tileOf('EQ-02')).not.toHaveAttribute('data-pointer-focus');

    /* Esc 는 입력 방식을 바꾸지 않는다(창 닫기 키) — 다른 키를 누르면 키보드 입력으로 본다. */
    await user.keyboard('{Escape}');
    act(() => {
      tileOf('EQ-02').focus();
    });
    expect(tileOf('EQ-02')).toHaveAttribute('data-pointer-focus');
    act(() => {
      tileOf('EQ-02').blur();
    });
    await user.keyboard('{Enter}');
    act(() => {
      tileOf('EQ-02').focus();
    });
    expect(tileOf('EQ-02')).not.toHaveAttribute('data-pointer-focus');
  });

  it('호기를 고르면 현재 작업지시 · 품목까지 상세가 열린다', async () => {
    const user = userEvent.setup();
    render(<EquipmentBoard view={view} isLoading={false} isFailed={false} />);

    await user.click(tileOf('EQ-01'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('WO-1')).toBeInTheDocument();
    expect(within(dialog).getByText('ITEM-1 시험 품목')).toBeInTheDocument();
    /* 가동 중이면 상태 사유 자리를 두지 않는다. */
    expect(within(dialog).queryByText(t.reason)).not.toBeInTheDocument();
  });

  it('작업지시가 없으면 「진행 중인 작업이 없습니다.」 한 줄', async () => {
    const user = userEvent.setup();
    render(
      <EquipmentBoard
        view={toEquipmentView({
          asOf: '2026-10-16T03:00:00Z',
          statusCounts: { RUNNING: 0, STOPPED: 0, WAITING: 0, CHANGEOVER: 0, IDLE: 1 },
          items: [
            item({
              statusCode: 'IDLE',
              currentWorkOrderNo: null,
              currentItemCode: null,
              currentItemName: null,
            }),
          ],
        })}
        isLoading={false}
        isFailed={false}
      />,
    );

    await user.click(tileOf('EQ-01'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(t.noWork)).toBeInTheDocument();
    expect(within(dialog).queryByText(t.workOrder)).not.toBeInTheDocument();
  });

  it('섹션이 오지 않음 · 설비 없음 · 첫 조회 실패를 서로 다른 말로 보인다', () => {
    const { rerender } = render(<EquipmentBoard view={null} isLoading={false} isFailed={false} />);
    expect(screen.getByText(t.absent)).toBeInTheDocument();

    rerender(<EquipmentBoard view={null} isLoading={false} isFailed />);
    expect(screen.getByText(t.failed)).toBeInTheDocument();

    rerender(
      <EquipmentBoard
        view={toEquipmentView({
          asOf: '2026-10-16T03:00:00Z',
          statusCounts: { RUNNING: 0, STOPPED: 0, WAITING: 0, CHANGEOVER: 0, IDLE: 0 },
          items: [],
        })}
        isLoading={false}
        isFailed={false}
      />,
    );
    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});

describe('StoppedPanel', () => {
  it('정지 · 대기 · 교체 · 비가동 그룹별 대수, 줄은 호기(톤수) · 사유 · 경과 — 빈 그룹은 두지 않는다', () => {
    render(<StoppedPanel view={view} isLoading={false} isFailed={false} />);

    const stoppedGroup = screen.getByRole('region', { name: t.status.STOPPED });
    expect(within(stoppedGroup).getByText(`1 ${t.countUnit}`)).toBeInTheDocument();
    const row = within(stoppedGroup).getByRole('listitem');
    expect(row).toHaveTextContent('EQ-02 (100T)');
    expect(within(row).getByText('유압 이상')).toBeInTheDocument();
    expect(within(row).getByText(formatElapsed(85))).toBeInTheDocument();

    expect(screen.getByRole('region', { name: t.status.WAITING })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.status.CHANGEOVER })).not.toBeInTheDocument();
  });

  it('모두 가동이면 「멈춘 설비 없음」', () => {
    render(
      <StoppedPanel
        view={toEquipmentView({
          asOf: '2026-10-16T03:00:00Z',
          statusCounts: { RUNNING: 1, STOPPED: 0, WAITING: 0, CHANGEOVER: 0, IDLE: 0 },
          items: [item({})],
        })}
        isLoading={false}
        isFailed={false}
      />,
    );

    expect(screen.getByText(t.stoppedEmpty)).toBeInTheDocument();
  });

  it('경과 시간은 시 · 분으로 적는다', () => {
    expect(formatElapsed(85)).toBe('1시간 25분');
    expect(formatElapsed(7)).toBe('7분');
    expect(formatElapsed(null)).toBe(t.none);
  });
});

describe('EquipmentBoard — 12대 표시 · 전체 보기', () => {
  const many = toEquipmentView({
    asOf: '2026-10-16T03:00:00Z',
    statusCounts: { RUNNING: 19, STOPPED: 1, WAITING: 0, CHANGEOVER: 0, IDLE: 0 },
    items: Array.from({ length: 20 }, (_, index) =>
      item({
        equipmentId: index + 1,
        equipmentCode: `E-1-${String(index + 1)}`,
        statusCode: index === 14 ? 'STOPPED' : 'RUNNING',
      }),
    ),
  });

  it('기본 12대 — 멈춘 호기가 맨 앞, 코드는 자연 정렬(E-1-2 < E-1-10), 「전체 20대 중 12대 표시」', () => {
    render(<EquipmentBoard view={many} isLoading={false} isFailed={false} />);

    const codes = screen
      .getAllByRole('button', { name: /상세 보기/ })
      .map((button) => button.querySelector('.dash-eq-code')?.textContent);
    expect(codes).toHaveLength(12);
    expect(codes.slice(0, 4)).toEqual(['E-1-15', 'E-1-1', 'E-1-2', 'E-1-3']);
    expect(screen.getByText(t.shownOf('20', '12'))).toBeInTheDocument();
  });

  it('「전체 설비 보기」 — 창에 20대 전부, 타일을 누르면 상세가 그 위에 열린다', async () => {
    const user = userEvent.setup();
    render(<EquipmentBoard view={many} isLoading={false} isFailed={false} />);

    await user.click(screen.getByRole('button', { name: t.showAll }));
    const dialog = screen.getByRole('dialog', { name: t.allTitle('20') });
    const tiles = within(dialog).getAllByRole('button', { name: /상세 보기/ });
    expect(tiles).toHaveLength(20);

    await user.click(within(dialog).getByRole('button', { name: t.openDetail('E-1-20') }));
    expect(
      screen.getByRole('heading', { level: 2, name: new RegExp('^E-1-20') }),
    ).toBeInTheDocument();
  });

  it('같은 이름의 라인이 여럿이면 라인 번호로 가른다', () => {
    const twin = toEquipmentView({
      asOf: '2026-10-16T03:00:00Z',
      statusCounts: { RUNNING: 2, STOPPED: 0, WAITING: 0, CHANGEOVER: 0, IDLE: 0 },
      items: [
        item({ equipmentId: 1, productionLineId: 3, productionLineName: 'PERF' }),
        item({ equipmentId: 2, productionLineId: 7, productionLineName: 'PERF' }),
      ],
    });
    render(<EquipmentBoard view={twin} isLoading={false} isFailed={false} />);

    expect(screen.getByRole('button', { name: 'PERF · 3 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PERF · 7 1' })).toBeInTheDocument();
  });
});
