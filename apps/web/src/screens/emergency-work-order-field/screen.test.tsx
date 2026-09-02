import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EMERGENCY_WORK_ORDER, renderScreen } from './screen-harness';

const t = messages.emergencyWorkOrderField;

/** 줄 전체가 누를 자리라, 카드의 이름으로 고른다. */
const selectName = (workOrderNo: string): string => `${t.list.select} ${workOrderNo}`;

describe('긴급 W/O 현장 화면', () => {
  it('빈 목록을 오류가 아니라 정상 상태로 그리고 어디서 발행되는지 알린다', async () => {
    renderScreen({ workOrders: [] });

    expect(await screen.findByText(t.list.empty)).toBeInTheDocument();
    expect(screen.queryByText(t.list.loadError)).not.toBeInTheDocument();
  });

  it('고르기 전에는 이동 버튼이 잠기고 푸는 방법을 말한다', async () => {
    renderScreen();

    await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) });

    expect(screen.getByText(t.handoff.locked)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.handoff.materialInput })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.handoff.productionResult })).toBeDisabled();
  });

  it('고르면 두 정상 화면으로 가는 주소에 W/O 를 싣는다', async () => {
    const { user } = renderScreen();

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) }),
    );

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

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) }),
    );

    expect(
      screen.getByText(`${t.detail.noAssignment} ${t.detail.controlBypass}`),
    ).toBeInTheDocument();
  });

  it('배정이 하나라도 있으면 「배정 없음」을 세우지 않는다', async () => {
    const { user } = renderScreen({
      workOrders: [{ ...EMERGENCY_WORK_ORDER, plannedEquipmentId: 6001 }],
    });

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) }),
    );

    expect(screen.getByText(t.detail.shortageGuide)).toBeInTheDocument();
    expect(
      screen.queryByText(`${t.detail.noAssignment} ${t.detail.controlBypass}`),
    ).not.toBeInTheDocument();
  });

  it('단위 이름을 못 받으면 숫자 식별자를 보이지 않는다', async () => {
    renderScreen({ uoms: [] });

    expect(await screen.findByText(new RegExp(`50 ${t.detail.unknown}`))).toBeInTheDocument();
    expect(screen.queryByText(/\b11\b/)).not.toBeInTheDocument();
  });
});

describe('「없다」와 「모른다」를 가른다', () => {
  it('아직 받는 중이면 「없습니다」를 세우지 않는다', async () => {
    renderScreen({ holdList: true });

    /* 단위 이름표는 먼저 도착한다 — 그 시점에도 목록은 아직 답이 없다. */
    await screen.findByRole('heading', { name: t.list.title });

    expect(screen.queryByText(t.list.empty)).not.toBeInTheDocument();
    expect(screen.queryByText(t.list.loadError)).not.toBeInTheDocument();
  });

  it('유형 값을 몰라 묻지 못했으면 「없습니다」를 세우지 않는다', async () => {
    renderScreen({ typeCode: '  ' });

    await screen.findByRole('heading', { name: t.list.title });

    expect(screen.queryByText(t.list.empty)).not.toBeInTheDocument();
  });
});

describe('목록이 잘렸는지', () => {
  it('전체 건수가 보이는 수와 같으면 잘림을 알리지 않는다', async () => {
    renderScreen({ total: 1 });

    await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) });

    expect(screen.queryByText(t.list.truncated(1, 1))).not.toBeInTheDocument();
  });
});

describe('POP 상단 띠', () => {
  it('단말을 모르면 빈칸이 아니라 모른다고 적는다', async () => {
    renderScreen();

    expect(await screen.findByText(t.header.terminalUnknown)).toBeInTheDocument();
  });
});

describe('통제 우회 표시', () => {
  it('배정이 있어도 통제 우회 사실은 알린다', async () => {
    const { user } = renderScreen({
      workOrders: [{ ...EMERGENCY_WORK_ORDER, plannedEquipmentId: 6001 }],
    });

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) }),
    );

    expect(screen.getByText(t.detail.controlBypass)).toBeInTheDocument();
  });
});

describe('POP 상단 띠', () => {
  /*
   * ⛔ 설계가 제품명을 그린 자리는 진입 화면(P-CO-01·M-CO-01)뿐이고 POP·모바일의 업무
   *    화면은 모두 화면 이름으로 시작한다. 되풀이하면 64픽셀 띠에서 화면 이름이 밀린다.
   */
  it('업무 화면이라 제품명을 되풀이하지 않는다', async () => {
    renderScreen();

    await screen.findByRole('heading', { name: t.title });

    expect(screen.queryByText(/OMF-MES|오마이팩토리/)).not.toBeInTheDocument();
  });
});

describe('상세 구획의 제목', () => {
  it('고르면 W/O 번호 자체가 제목이 된다', async () => {
    const { user } = renderScreen();

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) }),
    );

    expect(
      screen.getByRole('heading', { name: new RegExp(EMERGENCY_WORK_ORDER.workOrderNo) }),
    ).toBeInTheDocument();
  });
});

describe('연결 표시', () => {
  it('서버에 닿으면 연결됨을 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(t.header.connected)).toBeInTheDocument();
  });

  it('조회가 실패하면 연결 끊김을 보인다', async () => {
    renderScreen({ listStatus: 500 });

    expect(await screen.findByText(t.header.disconnected)).toBeInTheDocument();
  });

  it('답을 받기 전에는 연결 여부를 말하지 않는다', async () => {
    renderScreen({ holdList: true });

    await screen.findByRole('heading', { name: t.list.title });

    expect(screen.queryByText(t.header.connected)).not.toBeInTheDocument();
    expect(screen.queryByText(t.header.disconnected)).not.toBeInTheDocument();
  });
});
