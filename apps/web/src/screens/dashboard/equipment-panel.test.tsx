import type { DashboardEquipmentItem } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { toEquipmentView } from './equipment';
import { EquipmentPanel, formatElapsed } from './equipment-panel';

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
  defectRate: 0.5,
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
      currentWorkOrderNo: null,
      currentItemCode: null,
      currentItemName: null,
      defectRate: null,
      standardCycleTimeSec: null,
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

describe('EquipmentPanel', () => {
  it('호기마다 상태 · 톤수 · 금일 생산 · NG · 불량률 · 표준 C/T 를 보이고, 없는 값은 0이 아니라 「—」', () => {
    render(<EquipmentPanel view={view} isLoading={false} isFailed={false} />);

    const running = within(tileOf('EQ-01'));
    expect(running.getByText(t.status.RUNNING)).toBeInTheDocument();
    expect(running.getByText('100T')).toBeInTheDocument();
    expect(running.getByText('1,200')).toBeInTheDocument();
    expect(running.getByText('0.5%')).toBeInTheDocument();
    expect(running.getByText('32초')).toBeInTheDocument();
    /* 가동 중인 설비에는 사유 · 경과 칸이 없다. */
    expect(running.queryByText(t.reason)).not.toBeInTheDocument();

    const stopped = within(tileOf('EQ-02'));
    expect(stopped.getByText('유압 이상')).toBeInTheDocument();
    expect(stopped.getByText(formatElapsed(85))).toBeInTheDocument();
    expect(stopped.getAllByText(t.none)).toHaveLength(2);

    /* 멈췄는데 사유가 없으면 「미등록」이다. */
    expect(within(tileOf('EQ-03')).getByText(t.reasonUnknown)).toBeInTheDocument();
  });

  it('경과 시간은 시 · 분으로 적는다', () => {
    expect(formatElapsed(85)).toBe('1시간 25분');
    expect(formatElapsed(7)).toBe('7분');
    expect(formatElapsed(null)).toBe(t.none);
  });

  it('멈춘 설비 목록은 가동이 아닌 설비만, 오래 멈춘 것부터 사유 · 경과와 함께 보인다', () => {
    render(<EquipmentPanel view={view} isLoading={false} isFailed={false} />);

    const table = screen.getByRole('table', { name: t.stoppedTitle });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'EQ-02',
      'EQ-03',
    ]);
    expect(within(rows[0]!).getByText(formatElapsed(85))).toBeInTheDocument();
  });

  it('라인을 고르면 타일과 멈춘 설비가 그 라인으로 좁혀진다 — 상태 집계 줄은 그대로', async () => {
    const user = userEvent.setup();
    render(<EquipmentPanel view={view} isLoading={false} isFailed={false} />);

    await user.click(screen.getByLabelText(t.line));
    await user.click(screen.getByRole('option', { name: '2라인' }));

    expect(screen.queryByRole('button', { name: t.openDetail('EQ-01') })).not.toBeInTheDocument();
    expect(tileOf('EQ-02')).toBeInTheDocument();
    expect(screen.getByText(t.shownCount(1))).toBeInTheDocument();
    expect(screen.getByText(t.runningOfTotal)).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('호기를 고르면 현재 작업지시 · 품목까지 상세가 열린다', async () => {
    const user = userEvent.setup();
    render(<EquipmentPanel view={view} isLoading={false} isFailed={false} />);

    await user.click(tileOf('EQ-01'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('WO-1')).toBeInTheDocument();
    expect(within(dialog).getByText('ITEM-1 시험 품목')).toBeInTheDocument();
    expect(within(dialog).getByText('1라인')).toBeInTheDocument();
  });

  it('섹션이 오지 않음 · 설비 없음 · 첫 조회 실패를 서로 다른 말로 보인다', () => {
    const { rerender } = render(<EquipmentPanel view={null} isLoading={false} isFailed={false} />);
    expect(screen.getByText(t.absent)).toBeInTheDocument();

    rerender(<EquipmentPanel view={null} isLoading={false} isFailed />);
    expect(screen.getByText(t.failed)).toBeInTheDocument();

    rerender(
      <EquipmentPanel
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
