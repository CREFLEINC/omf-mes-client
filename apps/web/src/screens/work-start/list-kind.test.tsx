import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WORK_ORDER, emergencyListUrls, listUrls, renderScreen } from './screen-harness';

const t = messages.workStart;
const selectName = (workOrderNo: string): string => t.list.select(workOrderNo);

/** 긴급 W/O — 배정 없이 발행된 지시(옛 「긴급 작업지시」 화면이 보이던 것). */
const EMERGENCY = {
  ...WORK_ORDER,
  workOrderId: 8301,
  workOrderNo: 'SYN-WO-E001',
  workOrderTypeCode: 'EMERGENCY',
  plannedEquipmentId: undefined,
  plannedMoldId: undefined,
  releasedAt: '2026-09-02T09:30:00+09:00',
};

const REWORK = {
  ...WORK_ORDER,
  workOrderId: 8401,
  workOrderNo: 'SYN-WO-R001',
  workOrderTypeCode: 'REWORK',
};

const viewTabs = () => screen.getByRole('tablist', { name: t.list.kindLabel });
const rowNames = () =>
  within(screen.getByRole('list', { name: t.list.caption }))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));

/*
 * 옛 「긴급 작업지시」(P-02-12)를 작업지시 목록의 「긴급」 보기로 합쳤다(#295).
 */
describe('P-02-01 작업지시 목록 — 전체 / 긴급 보기(#295)', () => {
  it('[전체 | 긴급 N] 탭이 서고, 긴급 수는 옛 화면과 같은 조건(유형 + open, 설비 축 없음)의 합계다', async () => {
    const { recorded } = renderScreen({ emergencyWorkOrders: [EMERGENCY] });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    const emergencyTab = within(viewTabs()).getByRole('tab', { name: /긴급/u });
    await waitFor(() => expect(emergencyTab).toHaveTextContent('1'));
    expect(within(viewTabs()).getByRole('tab', { name: t.list.kindAll })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const [emergencyUrl = ''] = emergencyListUrls(recorded.urls);
    expect(emergencyUrl).toContain('workOrderTypeCode=EMERGENCY');
    expect(emergencyUrl).toContain('open=true');
    expect(emergencyUrl).not.toContain('plannedEquipmentId');
  });

  it('전체 작업지시는 서버에 긴급을 빼고 묻는다 — 화면은 따로 거르지 않고 받은 순서 그대로다(omf-all-around#330)', async () => {
    /* 이 조건을 모르는 옛 서버가 긴급을 실어 보내도 맨 위로 올리지 않고 받은 순서 그대로 둔다. */
    const { recorded } = renderScreen({ workOrders: [WORK_ORDER, EMERGENCY] });

    await screen.findByRole('button', { name: selectName(EMERGENCY.workOrderNo) });
    expect(rowNames()).toEqual([
      selectName(WORK_ORDER.workOrderNo),
      selectName(EMERGENCY.workOrderNo),
    ]);
    const [allUrl = ''] = listUrls(recorded.urls);
    expect(allUrl).toContain('excludeWorkOrderTypeCode=EMERGENCY');
  });

  it('긴급을 누르면 긴급만 보이고 주소에 ?type=emergency 가 실린다 — 설비 칸 대신 안내 한 줄', async () => {
    const { user } = renderScreen({ emergencyWorkOrders: [EMERGENCY] });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await user.click(within(viewTabs()).getByRole('tab', { name: /긴급/u }));

    await screen.findByRole('button', { name: selectName(EMERGENCY.workOrderNo) });
    expect(screen.queryByRole('button', { name: selectName(WORK_ORDER.workOrderNo) })).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent('/pop/work-start?type=emergency');
    expect(screen.getByText(t.list.emergencyScope)).toBeInTheDocument();

    await user.click(within(viewTabs()).getByRole('tab', { name: t.list.kindAll }));
    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/pop\/work-start$/u);
  });

  it('?type=emergency 로 열면 긴급 보기로 선다(옛 주소가 이리로 온다) — 없으면 옛 화면 빈 문구', async () => {
    const { recorded } = renderScreen({ route: '/pop/work-start?type=emergency' });

    expect(await screen.findByText(t.list.emergencyEmpty)).toBeInTheDocument();
    expect(screen.getByText(t.list.emergencyEmptyHint)).toBeInTheDocument();
    expect(within(viewTabs()).getByRole('tab', { name: /긴급/u })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    /* 긴급 보기 동안 「전체」 목록은 묻지 않는다. */
    expect(listUrls(recorded.urls)).toHaveLength(0);
  });

  it('긴급을 고르면 발행 시각 · 점검 통제 우회 안내 · [자재 투입]·[실적 입력]이 선다', async () => {
    const { user } = renderScreen({
      route: '/pop/work-start?type=emergency',
      emergencyWorkOrders: [EMERGENCY],
    });

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY.workOrderNo) }),
    );
    const group = screen.getByRole('group', { name: t.selection.title });
    expect(within(group).getByText(t.selection.releasedAt)).toBeInTheDocument();
    expect(within(group).getByText(t.selection.bypassTitle)).toBeInTheDocument();
    expect(within(group).getByText(t.selection.bypassBody)).toBeInTheDocument();
    /* 사번 입력 창이 함께 열린다 — 닫고 버튼을 본다. */
    const dialog = screen.queryByRole('dialog', { name: t.worker.dialogTitle });
    if (dialog !== null)
      await user.click(within(dialog).getByRole('button', { name: t.worker.cancel }));

    await user.click(screen.getByRole('button', { name: t.actions.productionResult }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      `/pop/production-result?workOrderId=${String(EMERGENCY.workOrderId)}`,
    );
  });

  it('긴급 [자재 투입]은 그 W/O 를 실어 자재 투입으로 간다', async () => {
    const { user } = renderScreen({
      route: '/pop/work-start?type=emergency',
      emergencyWorkOrders: [EMERGENCY],
    });

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY.workOrderNo) }),
    );
    const dialog = screen.queryByRole('dialog', { name: t.worker.dialogTitle });
    if (dialog !== null)
      await user.click(within(dialog).getByRole('button', { name: t.worker.cancel }));
    await user.click(screen.getByRole('button', { name: t.actions.materialInput }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      `/pop/material-input?workOrderId=${String(EMERGENCY.workOrderId)}`,
    );
  });

  it('긴급이 아닌 지시에는 [자재 투입]·[실적 입력]·우회 안내가 없다', async () => {
    const { user } = renderScreen();

    await user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    expect(screen.queryByRole('button', { name: t.actions.materialInput })).toBeNull();
    expect(screen.queryByRole('button', { name: t.actions.productionResult })).toBeNull();
    expect(screen.queryByText(t.selection.bypassBody)).toBeNull();
  });
});

describe('P-02-01 작업지시 목록 — 재작업 W/O(#295)', () => {
  it('「재작업」 칩이 서고, 고르면 [재작업 실적 등록]이 그 W/O 를 실어 간다 — [자재 투입]·[실적 입력]은 없다', async () => {
    const { user } = renderScreen({ workOrders: [REWORK] });

    const card = await screen.findByRole('button', { name: selectName(REWORK.workOrderNo) });
    expect(within(card).getByText(t.list.reworkBadge)).toBeInTheDocument();
    await user.click(card);
    const dialog = screen.queryByRole('dialog', { name: t.worker.dialogTitle });
    if (dialog !== null)
      await user.click(within(dialog).getByRole('button', { name: t.worker.cancel }));

    expect(screen.queryByRole('button', { name: t.actions.materialInput })).toBeNull();
    expect(screen.queryByRole('button', { name: t.actions.productionResult })).toBeNull();
    await user.click(screen.getByRole('button', { name: t.actions.reworkResult }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      `/pop/rework-results?workOrderId=${String(REWORK.workOrderId)}`,
    );
  });
});
