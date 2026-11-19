import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EMERGENCY_WORK_ORDER, renderScreen } from './screen-harness';

const t = messages.emergencyWorkOrderField;

/** 줄 전체가 누를 자리라, 카드의 이름으로 고른다. */
const selectName = (workOrderNo: string): string => `${t.list.select} ${workOrderNo}`;

describe('긴급 W/O 현장 화면', () => {
  it('빈 목록을 오류가 아니라 정상 상태로 그리고 어디서 발행되는지 알린다', async () => {
    renderScreen({ workOrders: [] });

    expect(await screen.findByText(t.list.empty)).toBeInTheDocument();
    expect(screen.getByText(t.list.emptyHint)).toBeInTheDocument();
    expect(screen.queryByText(t.list.loadError)).not.toBeInTheDocument();
  });

  /* ⛔ 푸는 방법은 구획이 «한 번만» 말한다 — 버튼 옆에 되풀이하지 않는다(스펙 §3 도면). */
  it('고르기 전에는 이동 버튼이 잠기고 푸는 방법을 한 번만 말한다', async () => {
    renderScreen();

    await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) });

    expect(screen.getAllByText(t.detail.notSelected)).toHaveLength(1);
    expect(screen.getByRole('button', { name: t.handoff.materialInput })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.handoff.productionResult })).toBeDisabled();
  });

  /* 목록은 고르기 목록이다(POP 통일 시안) — 항목 아무 데나 누르면 고르고, 다시 누르면 푼다. */
  it('항목을 눌러 고르며 다시 누르면 해제한다', async () => {
    const { user } = renderScreen();

    const selectKey = () =>
      screen.getByRole('button', { name: new RegExp(EMERGENCY_WORK_ORDER.workOrderNo, 'u') });

    await user.click(await screen.findByText(/EA$/u));

    await waitFor(() => {
      expect(selectKey()).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByRole('button', { name: t.handoff.materialInput })).toBeEnabled();

    await user.click(selectKey());

    await waitFor(() => {
      expect(selectKey()).toHaveAttribute('aria-pressed', 'false');
    });
    expect(screen.getByRole('button', { name: t.handoff.materialInput })).toBeDisabled();
  });

  it('고르면 두 정상 화면으로 가는 주소에 W/O 를 싣는다', async () => {
    const { user, router } = renderScreen();

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) }),
    );
    await user.click(screen.getByRole('button', { name: t.handoff.materialInput }));

    await waitFor(() => {
      expect(`${router?.state.location.pathname ?? ''}${router?.state.location.search ?? ''}`).toBe(
        `/pop/material-input?workOrderId=${String(EMERGENCY_WORK_ORDER.workOrderId)}`,
      );
    });
  });

  it('[실적 입력]은 실적 화면으로 W/O 를 싣고 간다', async () => {
    const { user, router } = renderScreen();

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) }),
    );
    await user.click(screen.getByRole('button', { name: t.handoff.productionResult }));

    await waitFor(() => {
      expect(`${router?.state.location.pathname ?? ''}${router?.state.location.search ?? ''}`).toBe(
        `/pop/production-result?workOrderId=${String(EMERGENCY_WORK_ORDER.workOrderId)}`,
      );
    });
  });

  it('배정이 없으면 그 사실을 경고로 보인다', async () => {
    const { user } = renderScreen();

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) }),
    );

    expect(screen.getByText(t.detail.bypassTitle)).toBeInTheDocument();
  });

  it('배정이 하나라도 있으면 「배정 없음」을 세우지 않는다', async () => {
    const { user } = renderScreen({
      workOrders: [{ ...EMERGENCY_WORK_ORDER, plannedEquipmentId: 6001 }],
    });

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) }),
    );

    expect(screen.getByText(t.detail.bypassTitleAssigned)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.bypassTitle)).not.toBeInTheDocument();
    /* ⛔ 자재 부족 안내는 상주하지 않는다 — 이 화면은 부족을 감지하지 못한다(§5-4). */
    expect(screen.queryByText(/자재가 부족/u)).not.toBeInTheDocument();
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
  it('전체 건수는 목록 아래 쪽 넘김 줄이 말한다', async () => {
    renderScreen({ total: 1 });

    await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) });

    expect(screen.getByText(messages.popUniform.pager.total(1))).toBeInTheDocument();
  });
});

describe('POP 상단 띠', () => {
  /* #291 — 단말은 공통 이동 메뉴 맨 위 줄이 보인다. 화면 본문에 다시 세우지 않는다. */
  it('단말은 본문에 두지 않는다(공통 메뉴 맨 위 줄이 보인다)', async () => {
    renderScreen({ terminalId: 1001 });

    expect(await screen.findByRole('heading', { name: t.title })).toBeInTheDocument();
    expect(screen.queryByText(/단말#/u)).not.toBeInTheDocument();
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

    expect(screen.getByText(t.detail.bypassBody)).toBeInTheDocument();
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

describe('상세 구획의 첫 줄', () => {
  /* 고른 작업지시 번호는 상세 첫 줄 「작업지시」로 선다(POP 통일 시안) — 구획 제목은 「작업지시 상세」 그대로. */
  it('고르면 상세 첫 줄에 작업지시 번호가 선다', async () => {
    const { user } = renderScreen();

    await user.click(
      await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) }),
    );

    expect(screen.getByRole('heading', { name: t.detail.title })).toBeInTheDocument();
    expect(screen.getByText(t.detail.workOrder).nextElementSibling).toHaveTextContent(
      EMERGENCY_WORK_ORDER.workOrderNo,
    );
  });
});

describe('연결 표시', () => {
  /* 연결 표시는 공통 메뉴 맨 위 줄이 모든 화면에 같게 보인다(#291) — 이 화면은 그리지 않는다. */
  it.each([
    ['정상', {}],
    ['401', { listStatus: 401 }],
    ['닿지 못함', { listUnreachable: true }],
  ] as const)('%s 이어도 화면에는 연결 표시를 두지 않는다', async (_label, options) => {
    renderScreen(options);

    await screen.findByRole('heading', { name: t.list.title });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(messages.common.connection.online)).not.toBeInTheDocument();
    expect(screen.queryByText(messages.common.connection.offline)).not.toBeInTheDocument();
  });

  it('답을 받기 전에는 연결 여부를 말하지 않는다', async () => {
    renderScreen({ holdList: true });

    await screen.findByRole('heading', { name: t.list.title });

    expect(screen.queryByText(messages.common.connection.online)).not.toBeInTheDocument();
    expect(screen.queryByText(messages.common.connection.offline)).not.toBeInTheDocument();
  });
});

describe('발행 자리 안내', () => {
  /* 「관리웹에서 발행합니다」 상시 안내는 없앴다(POP 통일 시안) — 목록이 비었을 때 빈 모양만 말한다. */
  it('목록이 있으면 발행 자리 안내를 상시 세우지 않는다', async () => {
    renderScreen();

    await screen.findByRole('button', { name: selectName(EMERGENCY_WORK_ORDER.workOrderNo) });

    expect(screen.queryByText(t.list.emptyHint)).not.toBeInTheDocument();
  });
});
