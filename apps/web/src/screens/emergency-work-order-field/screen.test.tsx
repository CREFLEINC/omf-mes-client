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

  /*
   * ⭐ **POP 목록 정본** — 표 · 선택 칸 없음 · 줄 전체가 누르는 자리 · 다시 누르면 해제
   *    (스펙 §7 `Table` · 정본 통일 `913a82c`). 카드 목록으로 되돌아가면 이 감지기가 잡는다.
   */
  it('목록이 표이고 줄 아무 데나 눌러 고르며 다시 누르면 해제한다', async () => {
    const { user } = renderScreen();

    const row = await screen.findByRole('row', {
      name: new RegExp(EMERGENCY_WORK_ORDER.workOrderNo, 'u'),
    });
    const selectKey = () =>
      screen.getByRole('button', { name: new RegExp(EMERGENCY_WORK_ORDER.workOrderNo, 'u') });

    /* 선택 칸을 따로 두지 않는다 — 조작은 첫 칸의 버튼 하나뿐이다. */
    expect(within(row).getAllByRole('button')).toHaveLength(1);

    /* 번호가 아닌 칸(수량)을 눌러도 그 줄이 골라진다. */
    await user.click(within(row).getByText(/EA$/u));

    await waitFor(() => {
      expect(selectKey()).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByRole('link', { name: t.handoff.materialInput })).toBeInTheDocument();

    await user.click(selectKey());

    await waitFor(() => {
      expect(selectKey()).toHaveAttribute('aria-pressed', 'false');
    });
    expect(screen.getByRole('button', { name: t.handoff.materialInput })).toBeDisabled();
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

  /*
   * ⛔ **실패했다는 사실만으로 「오프라인」이라 말하지 않는다**(#883). 상태 코드가 있다는 것은
   *    서버가 «답했다»는 뜻이다 — 그것을 연결 끊김으로 부르면 권한·서버 오류를 만난 작업자가
   *    네트워크를 확인하러 간다. 실서버에서 401 로 실제로 그렇게 떴다.
   */
  it.each([401, 500])('서버가 %d 로 답하면 연결됨을 유지한다', async (status) => {
    renderScreen({ listStatus: status });

    expect(await screen.findByText(t.header.connected)).toBeInTheDocument();
    expect(screen.queryByText(t.header.disconnected)).not.toBeInTheDocument();
  });

  it('서버에 닿지 못하면 연결 끊김을 보인다', async () => {
    renderScreen({ listUnreachable: true });

    expect(await screen.findByText(t.header.disconnected)).toBeInTheDocument();
  });

  it('답을 받기 전에는 연결 여부를 말하지 않는다', async () => {
    renderScreen({ holdList: true });

    await screen.findByRole('heading', { name: t.list.title });

    expect(screen.queryByText(t.header.connected)).not.toBeInTheDocument();
    expect(screen.queryByText(t.header.disconnected)).not.toBeInTheDocument();
  });
});

describe('발행 자리 안내', () => {
  /*
   * ⛔ **목록이 있을 때도 선다.** 빈 목록 문구 안에 같은 말이 들어 있어 그쪽만 재면, 목록이
   *    찬 화면에서 안내가 통째로 사라져도 아무 감지기가 울지 않는다.
   */
  it('목록이 있어도 어디서 발행하는지 목록 아래에 알린다', async () => {
    renderScreen();

    const list = await screen.findByLabelText(t.list.caption);
    const guide = screen.getByText(t.list.issuedElsewhere);

    expect(guide).toBeInTheDocument();
    /* DOM 순서로 「목록 아래」를 잰다 — 위로 올라가면 목록을 훑기 전에 읽게 된다. */
    expect(list.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
