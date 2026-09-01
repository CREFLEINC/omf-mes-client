import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EMERGENCY_WORK_ORDER, renderScreen } from './screen-harness';

const t = messages.emergencyWorkOrderField;

describe('긴급 W/O 현장 화면', () => {
  it('빈 목록을 오류가 아니라 정상 상태로 그리고 어디서 발행되는지 알린다', async () => {
    renderScreen({ workOrders: [] });

    expect(await screen.findByText(t.list.empty)).toBeInTheDocument();
    expect(screen.queryByText(t.list.loadError)).not.toBeInTheDocument();
  });

  it('고르기 전에는 이동 버튼이 잠기고 푸는 방법을 말한다', async () => {
    renderScreen();

    await screen.findByText(EMERGENCY_WORK_ORDER.workOrderNo);

    expect(screen.getByText(t.handoff.locked)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.handoff.materialInput })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.handoff.productionResult })).toBeDisabled();
  });

  it('고르면 두 정상 화면으로 가는 주소에 W/O 를 싣는다', async () => {
    const { user } = renderScreen();

    await user.click(await screen.findByRole('button', { name: t.list.select }));

    expect(screen.getByRole('link', { name: t.handoff.materialInput })).toHaveAttribute(
      'href',
      `/pop/material-input?workOrderId=${String(EMERGENCY_WORK_ORDER.workOrderId)}`,
    );
    expect(screen.getByRole('link', { name: t.handoff.productionResult })).toHaveAttribute(
      'href',
      `/pop/production-result?workOrderId=${String(EMERGENCY_WORK_ORDER.workOrderId)}`,
    );
  });

  it('배정이 없으면 그 사실을 경고로 보인다', async () => {
    const { user } = renderScreen();

    await user.click(await screen.findByRole('button', { name: t.list.select }));

    expect(screen.getByText(t.detail.noAssignment)).toBeInTheDocument();
  });

  it('배정이 하나라도 있으면 「배정 없음」을 세우지 않는다', async () => {
    const { user } = renderScreen({
      workOrders: [{ ...EMERGENCY_WORK_ORDER, plannedEquipmentId: 6001 }],
    });

    await user.click(await screen.findByRole('button', { name: t.list.select }));

    expect(screen.getByText(t.detail.shortageGuide)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.noAssignment)).not.toBeInTheDocument();
  });

  it('단위 이름을 못 받으면 숫자 식별자를 보이지 않는다', async () => {
    renderScreen({ uoms: [] });

    expect(await screen.findByText(`50 ${t.detail.unknown}`)).toBeInTheDocument();
    expect(screen.queryByText(/\b11\b/)).not.toBeInTheDocument();
  });
});
