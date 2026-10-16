import type { DashboardEquipmentItem } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
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
  it('가동 호기는 금일 생산 · NG · 불량률 · 표준 C/T, 멈춘 호기는 상태 · 사유 · 경과를 보인다', () => {
    render(<EquipmentBoard view={view} isLoading={false} isFailed={false} />);

    const running = within(tileOf('EQ-01'));
    expect(running.getByText('100T')).toBeInTheDocument();
    expect(running.getByText('1,200')).toBeInTheDocument();
    expect(running.getByText(t.ngLine('6', '0.7%'))).toBeInTheDocument();
    expect(running.getByText(t.cycleLine('32초'))).toBeInTheDocument();

    const stopped = within(tileOf('EQ-02'));
    expect(stopped.getByText(t.status.STOPPED)).toBeInTheDocument();
    expect(stopped.getByText('유압 이상')).toBeInTheDocument();
    expect(stopped.getByText(formatElapsed(85))).toBeInTheDocument();
    expect(tileOf('EQ-02')).toHaveClass('dash-eq-stopped');

    /* 톤수가 없으면 0이 아니라 「—」, 멈췄는데 사유가 없으면 「미등록」. */
    expect(within(tileOf('EQ-03')).getByText(t.none)).toBeInTheDocument();
    expect(within(tileOf('EQ-03')).getByText(t.reasonUnknown)).toBeInTheDocument();
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

  it('상세는 설비 기본 · 가동 · 생산 실적 · 현재 작업 묶음이고, 하단 「닫기」가 없으며 X 로 닫힌다', async () => {
    const user = userEvent.setup();
    render(<EquipmentBoard view={view} isLoading={false} isFailed={false} />);

    await user.click(tileOf('EQ-02'));
    const dialog = screen.getByRole('dialog');
    for (const group of [t.groupBasic, t.groupRun, t.groupOutput, t.groupWork]) {
      expect(within(dialog).getByRole('heading', { name: group })).toBeInTheDocument();
    }
    /* 값이 없는 작업지시 · 품목은 「—」. 항목은 하나도 빠지지 않는다. */
    for (const label of [
      t.statusColumn,
      t.line,
      t.tonnage,
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

  it('호기를 고르면 현재 작업지시 · 품목까지 상세가 열린다', async () => {
    const user = userEvent.setup();
    render(<EquipmentBoard view={view} isLoading={false} isFailed={false} />);

    await user.click(tileOf('EQ-01'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('WO-1')).toBeInTheDocument();
    expect(within(dialog).getByText('ITEM-1 시험 품목')).toBeInTheDocument();
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
    const row = within(stoppedGroup).getByRole('row', { name: /EQ-02 \(100T\)/ });
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
