import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setWorkerSession } from '../../patterns/worker-session';
import {
  EQUIPMENT_ID,
  IDENTITY,
  PQC_REQUEST,
  PROCESS_ID,
  TERMINAL,
  WORKER,
  WORK_ORDER,
  listUrls,
  renderScreen,
} from './screen-harness';

const t = messages.workStart;

/** 줄 전체가 누를 자리라, 카드의 이름으로 고른다. */
const selectName = (workOrderNo: string): string => t.list.select(workOrderNo);

/**
 * 사번 입력 창을 열어 키패드로 넣고 확인까지 누른다 — 이 화면의 모든 쓰기가 이 앞에 선다.
 * 창이 이미 열려 있으면(앞 시도 실패) 그 창에 다시 넣는다.
 */
const enterWorkerNo = async (user: ReturnType<typeof renderScreen>['user'], workerNo: string) => {
  if (screen.queryByRole('dialog', { name: t.worker.dialogTitle }) === null) {
    await user.click(screen.getByRole('button', { name: t.worker.open }));
  }
  const dialog = await screen.findByRole('dialog', { name: t.worker.dialogTitle });

  for (const digit of workerNo) {
    await user.click(within(dialog).getByRole('button', { name: digit }));
  }

  await user.click(within(dialog).getByRole('button', { name: t.worker.confirm }));
};

const startButton = () => screen.getByRole('button', { name: t.actions.start });

/** 목록 제목 줄의 설비 칸(PopSelect). 닫힌 칸의 글자가 지금 설비다. */
const equipmentSelect = () => screen.getByRole('combobox', { name: t.list.equipmentLabel });

/** 설비 팝업을 열어 한 줄을 고른다. */
const chooseEquipment = async (user: ReturnType<typeof renderScreen>['user'], label: string) => {
  await user.click(equipmentSelect());
  const dialog = await screen.findByRole('dialog');
  await user.click(await within(dialog).findByRole('option', { name: label }));
};

/**
 * 세션을 여는 쓰기만 골라 낸다.
 *
 * ⚠ **시작을 누르면 쓰기가 둘 나간다** — 점검 통제 판정(`P-02-02`)이 먼저 기록되고 그 뒤에
 * 세션이 열린다. 이 화면의 감지기가 재는 것은 뒤엣것이다.
 */
const sessionBodies = (
  bodies: ReturnType<typeof renderScreen>['recorded']['bodies'],
): ReturnType<typeof renderScreen>['recorded']['bodies'] =>
  bodies.filter((sent) => sent.url === '/production/work-sessions');

const decisionBodies = (
  bodies: ReturnType<typeof renderScreen>['recorded']['bodies'],
): ReturnType<typeof renderScreen>['recorded']['bodies'] =>
  bodies.filter((sent) => sent.url === '/production/precheck-decisions');

/* 단말이 들고 있는 사번은 화면 밖 «단일 자리»다 — 감지기가 서로의 상태 위에서 서지 않게 한다. */
beforeEach(() => {
  setWorkerSession(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  /* 단말이 들고 있는 사번은 화면 밖 «단일 자리»다 — 감지기 사이에 새면 다음 것이 이미 선 채로 시작한다. */
  setWorkerSession(null);
});

describe('P-02-01 작업 시작 — 단말 게이팅', () => {
  it('이 공정의 행이 없으면 닫고 푸는 곳을 말한다', async () => {
    renderScreen({ processes: [{ processId: PROCESS_ID + 1, canStartWork: true }] });

    expect(await screen.findByText(t.blocked.denied)).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  /**
   * ⛔ **`flag !== false` 로 쓰면 통과하는 자리다.** 여덟 플래그는 `required` 가 아니라 값이
   * 없을 수 있고, 계약이 「기본은 닫힘」이라 적었다.
   */
  it('행은 있는데 canStartWork 가 응답에 없으면 닫는다', async () => {
    renderScreen({ processes: [{ processId: PROCESS_ID, processName: '합성 사출' }] });

    expect(await screen.findByText(t.blocked.denied)).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  it('canStartWork 가 거짓이면 닫는다', async () => {
    renderScreen({ processes: [{ processId: PROCESS_ID, canStartWork: false }] });

    expect(await screen.findByText(t.blocked.denied)).toBeInTheDocument();
  });

  /** ⛔ 조회 실패를 통과로 처리하지 않는다(F-6). 「없습니다」와 다른 문장이다. */
  it('조회가 실패하면 「확인할 수 없다」로 닫고 다시 시도 경로를 준다', async () => {
    renderScreen({ processesStatus: 500 });

    expect(await screen.findByText(t.blocked.unavailable)).toBeInTheDocument();
    expect(screen.queryByText(t.blocked.denied)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.blocked.retry })).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  it('설비가 매핑되지 않은 단말도 설비 축 없이 목록을 받고 시작할 수 있다', async () => {
    const rendered = renderScreen({
      terminal: { ...TERMINAL, equipmentId: null, equipmentCode: null, equipmentName: null },
    });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    const [first] = listUrls(rendered.recorded.urls);
    expect(first).toContain('open=true');
    expect(first).not.toContain('plannedEquipmentId');
    expect(first).not.toContain('includeUnplannedEquipment');
    /* 좁힐 설비가 없으니 [전체 설비 보기]와 설비 안내가 없다. */
    expect(screen.queryByRole('combobox', { name: t.list.equipmentLabel })).not.toBeInTheDocument();
    expect(screen.queryByText(t.list.equipmentUnknown)).not.toBeInTheDocument();

    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await waitFor(() => expect(startButton()).toBeEnabled());
    await rendered.user.click(startButton());

    await waitFor(() => expect(sessionBodies(rendered.recorded.bodies)).toHaveLength(1));
    /* 점검한 설비와 실적이 남는 설비가 같다 — 둘 다 W/O 의 계획 설비다. */
    expect(sessionBodies(rendered.recorded.bodies)[0]?.body).toEqual(
      expect.objectContaining({ equipmentId: EQUIPMENT_ID }),
    );
    expect(decisionBodies(rendered.recorded.bodies).map((sent) => sent.body)).toEqual([
      expect.objectContaining({ equipmentId: EQUIPMENT_ID }),
    ]);
  });

  it('단말에 설비가 없으면 점검 창의 머리글도 W/O 의 계획 설비로 보인다', async () => {
    const rendered = renderScreen({
      terminal: { ...TERMINAL, equipmentId: null, equipmentCode: null, equipmentName: null },
      workOrders: [
        {
          ...WORK_ORDER,
          plannedEquipmentCode: 'SYN-PRS-09',
          plannedEquipmentName: '합성 프레스 9호기',
        },
      ],
      /* 합격 이력이 없어 차단 — 점검 창이 선다. */
      inspections: [],
    });

    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await waitFor(() => expect(startButton()).toBeEnabled());
    await rendered.user.click(startButton());

    expect(
      await screen.findByText(
        messages.workPrecheckGate.header.equipmentLabel('SYN-PRS-09', '합성 프레스 9호기'),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(messages.workPrecheckGate.header.equipmentUnknown)).toBeNull();
  });

  it('단말에도 W/O 에도 설비가 없으면 점검 없이 바로 시작한다', async () => {
    const { plannedEquipmentId: _ignored, ...withoutEquipment } = WORK_ORDER;
    const rendered = renderScreen({
      terminal: { ...TERMINAL, equipmentId: null, equipmentCode: null, equipmentName: null },
      workOrders: [withoutEquipment],
    });

    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await waitFor(() => expect(startButton()).toBeEnabled());

    /* 선택 묶음의 설비는 비워 두지 않고 미지정이라고 말한다. 목록 카드처럼 제목 줄 칩이다(C-21). */
    const selection = screen.getByRole('group', { name: t.selection.title });
    const head = selection.querySelector('.pop-row-head') as HTMLElement;
    expect(within(head).getByText(t.list.unassignedEquipmentBadge)).toBeInTheDocument();
    expect(within(selection).queryByText(t.selection.equipment)).toBeNull();
    await rendered.user.click(startButton());

    await waitFor(() => expect(sessionBodies(rendered.recorded.bodies)).toHaveLength(1));
    expect(decisionBodies(rendered.recorded.bodies)).toHaveLength(0);
    expect(sessionBodies(rendered.recorded.bodies)[0]?.body).not.toHaveProperty('equipmentId');
  });

  it('단말에 설비가 있으면 W/O 계획 설비가 달라도 단말 설비로 점검하고 시작한다', async () => {
    const rendered = renderScreen({
      workOrders: [{ ...WORK_ORDER, plannedEquipmentId: EQUIPMENT_ID + 7 }],
    });

    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await waitFor(() => expect(startButton()).toBeEnabled());
    await rendered.user.click(startButton());

    await waitFor(() => expect(sessionBodies(rendered.recorded.bodies)).toHaveLength(1));
    expect(decisionBodies(rendered.recorded.bodies).map((sent) => sent.body)).toEqual([
      expect.objectContaining({ equipmentId: EQUIPMENT_ID }),
    ]);
    expect(sessionBodies(rendered.recorded.bodies)[0]?.body).toEqual(
      expect.objectContaining({ equipmentId: EQUIPMENT_ID }),
    );
  });

  it('공정이 없거나 여럿이면 등록 실패가 아니라 공정 매핑을 사유로 말한다', async () => {
    renderScreen({ identity: { ...IDENTITY, processes: [] } });
    expect(await screen.findByText(t.blocked.processNone)).toBeInTheDocument();
  });

  describe('고른 W/O 의 공정으로 판정한다', () => {
    const MULTI = {
      ...IDENTITY,
      processes: [{ processId: PROCESS_ID }, { processId: PROCESS_ID + 1 }],
    };
    const pick = async (rendered: ReturnType<typeof renderScreen>) => {
      await enterWorkerNo(rendered.user, WORKER.workerNo);
      await rendered.user.click(
        await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
      );
    };

    it('공정이 여럿인 단말도 W/O 공정의 시작이 열려 있으면 시작이 열린다', async () => {
      const rendered = renderScreen({
        identity: MULTI,
        workOrders: [{ ...WORK_ORDER, processId: PROCESS_ID, processName: '합성 사출' }],
      });
      /* 고르기 전에는 판정할 공정이 없을 뿐이다 — 막지 않는다. */
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
      expect(screen.queryByText(t.blocked.processMultiple)).not.toBeInTheDocument();

      await pick(rendered);

      await waitFor(() => expect(startButton()).toBeEnabled());
      expect(screen.queryByText(t.blocked.processMultiple)).not.toBeInTheDocument();
    });

    it('W/O 공정의 시작이 매핑되지 않았으면 그 공정 이름으로 막는다', async () => {
      const rendered = renderScreen({
        identity: MULTI,
        workOrders: [{ ...WORK_ORDER, processId: PROCESS_ID + 1, processName: '합성 조립' }],
      });

      await pick(rendered);

      expect(await screen.findByText(t.blocked.deniedProcess('합성 조립'))).toBeInTheDocument();
      expect(startButton()).toBeDisabled();
    });

    it('W/O 가 공정을 싣지 않는 서버면 단말 공정이 여럿일 때 판정할 수 없다고 말한다', async () => {
      const rendered = renderScreen({ identity: MULTI });

      await pick(rendered);

      expect(await screen.findByText(t.blocked.processMultiple)).toBeInTheDocument();
      expect(screen.queryByText(t.blocked.unidentified)).not.toBeInTheDocument();
      expect(startButton()).toBeDisabled();
    });
  });

  /** ⭐ 사용자 지시 2026-09-14 — 설비는 타이틀 옆, 단말은 오른쪽. */
  it('머리줄은 타이틀 옆에 설비, 오른쪽에 단말 코드를 보인다', async () => {
    renderScreen();
    const equipment = await screen.findByText(
      messages.popChrome.header.equipmentLabel(TERMINAL.equipmentCode, TERMINAL.equipmentName),
    );
    const terminalLabel = screen.getByText(
      messages.popChrome.header.terminalLabel(TERMINAL.terminalCode),
    );

    expect(equipment.closest('.pop-context-right')).toBeNull();
    expect(terminalLabel.closest('.pop-context-right')).not.toBeNull();
  });

  it('설비가 매핑되지 않으면 타이틀 옆 설비 자리를 비운다', async () => {
    renderScreen({
      terminal: { ...TERMINAL, equipmentId: null, equipmentCode: null, equipmentName: null },
    });
    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });

    expect(document.querySelector('.pop-header .pop-context:not(.pop-context-right)')).toBeNull();
  });

  it('단말·공정을 모르면 조회하지 않고 사유를 말한다', async () => {
    const { recorded } = renderScreen({
      identity: { terminalId: null, processes: null, equipment: null, workerNo: null },
    });

    expect(await screen.findByText(t.blocked.unidentified)).toBeInTheDocument();
    expect(recorded.urls.some((url) => url.includes('/processes'))).toBe(false);
  });
});

describe('P-02-01 작업 시작 — 목록 조회 축', () => {
  it('기본 목록은 이 설비와 open 축으로 선다', async () => {
    const { recorded } = renderScreen();

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });

    const [first] = listUrls(recorded.urls);
    expect(first).toContain('open=true');
    expect(first).toContain(`plannedEquipmentId=${String(EQUIPMENT_ID)}`);
    /* 설비를 아직 정하지 않은 지시도 이 설비 목록에 함께 온다. */
    expect(first).toContain('includeUnplannedEquipment=true');
    /* ⛔ 확정된 적 없는 상태 문자열을 조회 조건으로 싣지 않는다. */
    expect(first).not.toContain('statusCode=');
  });

  /**
   * ⭐ **누적 양품은 서버가 낸다**(omf-all-around#45). 이 축이 빠지면 「지시 수량을 채웠다」를
   *    화면이 알 길이 없어 마감 안내가 조용히 사라진다.
   */
  it('목록에 누적 양품 축을 함께 싣는다', async () => {
    const { recorded } = renderScreen();

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });

    expect(listUrls(recorded.urls)[0]).toContain('withProgress=true');
  });

  /**
   * 설비 칸(PopSelect 팝업, C-12). 기본은 단말 설비이고, 「전체 설비」나 다른 설비를 고르면 목록 조회가
   * 바뀐다. 기본이 아니면 [기본 설비로]가 제목과 설비 칸 사이에 선다(사용자 결정 2026-10-26, PG-37).
   */
  describe('설비 칸', () => {
    const OTHER_EQUIPMENT = {
      equipmentId: EQUIPMENT_ID + 1,
      equipmentCode: 'SYN-PRS-02',
      equipmentName: '합성 프레스 2호기',
    };
    const EQUIPMENTS = [
      {
        equipmentId: EQUIPMENT_ID,
        equipmentCode: 'SYN-PRS-01',
        equipmentName: '합성 프레스 1호기',
      },
      OTHER_EQUIPMENT,
    ];
    const OTHER_WO = {
      ...WORK_ORDER,
      workOrderId: 8201,
      workOrderNo: 'SYN-WO-0201',
      plannedEquipmentId: OTHER_EQUIPMENT.equipmentId,
    };
    const resetButton = () => screen.queryByRole('button', { name: t.list.resetToDefault });

    it('처음에는 단말 설비이고 [기본 설비로]가 없다', async () => {
      const { recorded } = renderScreen();

      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
      expect(screen.getByRole('heading', { level: 2, name: t.list.title })).toBeInTheDocument();
      expect(equipmentSelect()).toHaveTextContent(TERMINAL.equipmentName);
      expect(resetButton()).toBeNull();
      expect(screen.queryByRole('radio')).toBeNull();
      const [first] = listUrls(recorded.urls);
      expect(first).toContain(`plannedEquipmentId=${String(EQUIPMENT_ID)}`);
      expect(first).toContain('includeUnplannedEquipment=true');
      /* 다른 설비 목록은 팝업을 열 때 처음 묻는다. */
      expect(recorded.urls.some((url) => url.startsWith('/mdm/equipments'))).toBe(false);
    });

    it('팝업은 기본 설비, 전체 설비, 다른 설비 순서이고 줄은 「이름 (코드)」다', async () => {
      const { user, recorded } = renderScreen({ equipments: EQUIPMENTS });

      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
      await user.click(equipmentSelect());
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByRole('option', { name: '합성 프레스 2호기 (SYN-PRS-02)' });

      expect(
        within(dialog)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual([
        t.list.defaultOption('합성 프레스 1호기 (SYN-PRS-01)'),
        t.list.allOption,
        '합성 프레스 2호기 (SYN-PRS-02)',
      ]);
      expect(within(dialog).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
      const equipmentUrl = recorded.urls.find((url) => url.startsWith('/mdm/equipments')) ?? '';
      expect(equipmentUrl).toContain(`plantId=${String(TERMINAL.plantId)}`);
      expect(equipmentUrl).toContain('statusCode=IN_SERVICE');
    });

    it('다른 설비를 고르면 그 설비로만 묻고, [기본 설비로]가 서고 누르면 돌아온다', async () => {
      const { user, recorded } = renderScreen({
        equipments: EQUIPMENTS,
        workOrdersByEquipment: { [OTHER_EQUIPMENT.equipmentId]: [OTHER_WO] },
      });

      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
      await chooseEquipment(user, '합성 프레스 2호기 (SYN-PRS-02)');

      await screen.findByRole('button', { name: selectName(OTHER_WO.workOrderNo) });
      expect(screen.queryByRole('button', { name: selectName(WORK_ORDER.workOrderNo) })).toBeNull();
      const last = listUrls(recorded.urls).at(-1) ?? '';
      expect(last).toContain(`plannedEquipmentId=${String(OTHER_EQUIPMENT.equipmentId)}`);
      /* 설비를 정하지 않은 지시는 단말 설비 목록에만 함께 온다(PG-38). */
      expect(last).not.toContain('includeUnplannedEquipment');
      expect(equipmentSelect()).toHaveTextContent('합성 프레스 2호기');
      expect(screen.getByRole('heading', { level: 2, name: t.list.title })).toBeInTheDocument();

      const reset = resetButton();
      expect(reset).not.toBeNull();
      await user.click(reset as HTMLElement);

      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
      expect(resetButton()).toBeNull();
      expect(equipmentSelect()).toHaveTextContent(TERMINAL.equipmentName);
      expect(listUrls(recorded.urls).at(-1)).toContain('includeUnplannedEquipment=true');
    });

    it('「전체 설비」는 설비 축 없이 묻고 [기본 설비로]가 선다', async () => {
      const { user, recorded } = renderScreen();

      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
      await chooseEquipment(user, t.list.allOption);

      await waitFor(() => {
        expect(listUrls(recorded.urls).at(-1)).not.toContain('plannedEquipmentId');
      });
      expect(equipmentSelect()).toHaveTextContent(t.list.allOption);
      expect(resetButton()).not.toBeNull();
    });

    /** 제목은 왼쪽, 설비 칸은 오른쪽 끝, [기본 설비로]는 그 사이에만 선다(C-19). */
    it('[기본 설비로]는 제목과 설비 칸 사이에 끼고 두 자리는 바뀌지 않는다', async () => {
      const { user } = renderScreen();

      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
      const head = screen.getByRole('heading', { level: 2, name: t.list.title })
        .parentElement as HTMLElement;
      const field = equipmentSelect().closest('.work-start-equipment-field') as HTMLElement;
      const order = () => [...head.querySelectorAll('h2, button, .work-start-equipment-field')];

      expect(head.firstElementChild).toHaveTextContent(t.list.title);
      expect(field.parentElement?.lastElementChild).toBe(field);

      await chooseEquipment(user, t.list.allOption);
      const reset = await screen.findByRole('button', { name: t.list.resetToDefault });

      expect(head.firstElementChild).toHaveTextContent(t.list.title);
      expect(field.parentElement?.lastElementChild).toBe(field);
      const items = order();
      expect(items.indexOf(reset)).toBeGreaterThan(0);
      expect(items.indexOf(reset)).toBeLessThan(items.indexOf(field));
    });

    it('공장 설비를 받지 못하면 팝업은 기본 설비와 전체 설비만 보인다', async () => {
      const { user } = renderScreen({ equipmentsStatus: 401 });

      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
      await user.click(equipmentSelect());
      const dialog = await screen.findByRole('dialog');

      await waitFor(() => {
        expect(within(dialog).getAllByRole('option')).toHaveLength(2);
      });
    });
  });

  it('머리줄 화면 이름은 「작업 지시 목록」이고 주 동작은 [작업 시작] 그대로다', async () => {
    renderScreen();

    expect(
      await screen.findByRole('heading', { level: 1, name: '작업 지시 목록' }),
    ).toBeInTheDocument();
    expect(startButton()).toBeInTheDocument();
  });

  it('「선택한 작업지시」도 제목 줄(W/O 번호, 상태 칩)과 정보 영역(「라벨 값」 쌍)으로 나눈다', async () => {
    const { user } = renderScreen({ workOrders: [{ ...WORK_ORDER, statusCode: 'RELEASED' }] });

    await enterWorkerNo(user, WORKER.workerNo);
    await user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    const selection = screen.getByRole('group', { name: t.selection.title });
    const head = selection.querySelector('.pop-row-head') as HTMLElement;
    const info = selection.querySelector('.pop-row-info') as HTMLElement;
    expect(within(head).getByText(WORK_ORDER.workOrderNo)).toBeInTheDocument();
    expect(within(head).getByText(t.list.status.released)).toBeInTheDocument();
    expect(within(info).getByText(t.selection.item)).toBeInTheDocument();
    expect(within(info).queryByText(WORK_ORDER.workOrderNo)).toBeNull();
    expect(info).toHaveTextContent(
      `${t.selection.equipment} ${TERMINAL.equipmentName} (SYN-PRS-01)`,
    );
  });

  /**
   * 목록을 바꾸면 고른 W/O 는 새 목록에 있을 때만 남는다. 없으면 놓고 하단 바가 다시 고르라고
   * 말한다(사용자 결정 2026-10-26, PG-30).
   */
  describe('목록을 바꿀 때 고른 것', () => {
    const OTHER = {
      ...WORK_ORDER,
      workOrderId: 8199,
      workOrderNo: 'SYN-WO-0199',
      plannedEquipmentId: EQUIPMENT_ID + 1,
      plannedEquipmentCode: 'SYN-PRS-02',
    };
    const selectionNo = () =>
      within(screen.getByRole('group', { name: t.selection.title })).getByText(
        WORK_ORDER.workOrderNo,
      );

    it('두 목록에 다 있는 W/O 는 오가도 고른 채로 남는다', async () => {
      const { user } = renderScreen({ allWorkOrders: [WORK_ORDER, OTHER] });

      await enterWorkerNo(user, WORKER.workerNo);
      await user.click(
        await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
      );
      expect(selectionNo()).toBeInTheDocument();

      await chooseEquipment(user, t.list.allOption);
      await screen.findByRole('button', { name: selectName(OTHER.workOrderNo) });
      expect(
        screen.getByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(selectionNo()).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: t.list.resetToDefault }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: selectName(OTHER.workOrderNo) })).toBeNull();
      });
      expect(selectionNo()).toBeInTheDocument();
      expect(screen.queryByText(t.remaining.select)).toBeNull();
    });

    it('돌아온 목록에 없는 W/O 는 놓고 하단 바가 「작업지시를 고르세요」로 돌아간다', async () => {
      const { user } = renderScreen({ allWorkOrders: [WORK_ORDER, OTHER] });

      await enterWorkerNo(user, WORKER.workerNo);
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
      await chooseEquipment(user, t.list.allOption);
      await user.click(await screen.findByRole('button', { name: selectName(OTHER.workOrderNo) }));
      expect(screen.getByRole('group', { name: t.selection.title })).toHaveTextContent(
        OTHER.workOrderNo,
      );

      await user.click(screen.getByRole('button', { name: t.list.resetToDefault }));

      expect(await screen.findByText(t.remaining.select)).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: t.selection.title })).toBeNull();
      /* 다시 전체 설비 목록에 들어가도 저절로 다시 고르지 않는다. */
      await chooseEquipment(user, t.list.allOption);
      expect(
        await screen.findByRole('button', { name: selectName(OTHER.workOrderNo) }),
      ).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('「전체 보기」는 설비 축만 뺀다', async () => {
    const { user, recorded } = renderScreen();

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await chooseEquipment(user, t.list.allOption);

    await waitFor(() => {
      expect(listUrls(recorded.urls).length).toBeGreaterThan(1);
    });

    const last = listUrls(recorded.urls).at(-1) ?? '';
    expect(last).toContain('open=true');
    expect(last).not.toContain('plannedEquipmentId');
    expect(last).not.toContain('includeUnplannedEquipment');
  });

  /** 카드의 계획 설비는 코드만 든 칩이 아니라 「설비 이름 (코드)」 라벨 값 쌍이다(C-10). */
  it('두 목록 모두 계획 설비를 「설비 이름 (코드)」로 달고, 설비가 없으면 설비 미지정 칩을 단다', async () => {
    const { plannedEquipmentId: _ignored, ...withoutEquipment } = WORK_ORDER;
    const { user } = renderScreen({
      workOrders: [
        { ...withoutEquipment, workOrderId: 8102, workOrderNo: 'SYN-WO-0102' },
        {
          ...WORK_ORDER,
          plannedEquipmentCode: 'SYN-PRS-01',
          plannedEquipmentName: '합성 프레스 1호기',
        },
      ],
    });
    const equipmentPair = `${t.list.equipment} 합성 프레스 1호기 (SYN-PRS-01)`;
    const card = (workOrderNo: string) =>
      screen.getByRole('button', { name: selectName(workOrderNo) });

    await screen.findByRole('button', { name: selectName('SYN-WO-0102') });
    expect(
      within(card('SYN-WO-0102')).getByText(t.list.unassignedEquipmentBadge),
    ).toBeInTheDocument();
    expect(card(WORK_ORDER.workOrderNo)).toHaveTextContent(equipmentPair);
    expect(
      within(card(WORK_ORDER.workOrderNo)).queryByText(t.list.unassignedEquipmentBadge),
    ).toBeNull();

    await chooseEquipment(user, t.list.allOption);

    await waitFor(() => {
      expect(card(WORK_ORDER.workOrderNo)).toHaveTextContent(equipmentPair);
    });
    /* 코드만 든 칩을 따로 세우지 않는다. */
    expect(within(card(WORK_ORDER.workOrderNo)).queryByText('SYN-PRS-01')).toBeNull();
  });

  it('설비 없는 단말의 목록에는 계획 설비를 단다', async () => {
    renderScreen({
      terminal: { ...TERMINAL, equipmentId: null, equipmentCode: null, equipmentName: null },
      workOrders: [{ ...WORK_ORDER, plannedEquipmentCode: 'SYN-PRS-01' }],
    });

    const card = await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    /* 이름을 못 받았으면 코드만 보인다(`named`). */
    expect(card).toHaveTextContent(`${t.list.equipment} SYN-PRS-01`);
  });

  /** ⚠ 설비를 모르는 것은 「지시가 없다」와 다른 사실이다. */
  it('설비를 못 받으면 기본 목록을 묻지 않고 사유를 보인다', async () => {
    const { recorded } = renderScreen({ terminalStatus: 500 });

    expect(await screen.findByText(t.list.equipmentUnknown)).toBeInTheDocument();
    expect(screen.queryByText(t.list.empty(TERMINAL.equipmentName))).not.toBeInTheDocument();
    expect(listUrls(recorded.urls)).toHaveLength(0);
  });

  it('빈 목록은 오류가 아니라 다음 행동과 함께 보인다', async () => {
    renderScreen({ workOrders: [] });

    expect(await screen.findByText(t.list.empty(TERMINAL.equipmentName))).toBeInTheDocument();
    expect(screen.queryByText(t.list.loadError)).not.toBeInTheDocument();
  });
});

describe('P-02-01 작업 시작 — 사번', () => {
  /*
   * 사번 없이 카드를 누르면 고르고, 사번 입력 창을 바로 연다(사용자 결정 2026-10-23, PG-27).
   * 누른 것을 무시하면 고장 난 것처럼 보인다.
   */
  it('사번 없이 카드를 누르면 고르고 사번 입력 창을 연다', async () => {
    const { user } = renderScreen();

    const card = await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    expect(card).not.toHaveAttribute('aria-disabled', 'true');
    expect(await screen.findByText(t.remaining.worker)).toBeInTheDocument();

    await user.click(card);

    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: t.selection.title })).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: t.worker.dialogTitle })).toBeInTheDocument();
  });

  it('창에서 사번을 확인하면 창이 닫히고 고른 W/O 그대로 시작이 열린다', async () => {
    const { user } = renderScreen();

    await user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await enterWorkerNo(user, WORKER.workerNo);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: t.worker.dialogTitle })).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    ).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
  });

  it('창을 취소하면 고른 것은 남고 사번을 입력하라고 말하며 시작은 잠긴다', async () => {
    const { user } = renderScreen();

    await user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    const dialog = await screen.findByRole('dialog', { name: t.worker.dialogTitle });
    await user.click(within(dialog).getByRole('button', { name: t.worker.cancel }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: t.worker.dialogTitle })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('group', { name: t.selection.title })).toBeInTheDocument();
    expect(await screen.findByText(t.remaining.worker)).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  it('미등록과 퇴사를 다른 문구로 가른다', async () => {
    const { user } = renderScreen({ workers: [] });

    await enterWorkerNo(user, WORKER.workerNo);

    expect(await screen.findByText(t.worker.unknown)).toBeInTheDocument();
  });

  it('퇴사한 사번은 「재직 중이 아니다」로 말한다', async () => {
    const { user } = renderScreen({ workers: [{ ...WORKER, isActive: false }] });

    await enterWorkerNo(user, WORKER.workerNo);

    expect(await screen.findByText(t.worker.inactive)).toBeInTheDocument();
  });
});

describe('P-02-01 작업 시작 — 사번 조회가 실패했을 때', () => {
  /**
   * ⛔ **「다시 시도해 주세요」라고 적었으면 수단이 있어야 한다.** 이 저장소는 자동 재조회를
   * 꺼 두었고, 같은 사번을 다시 제출해도 값이 같아 조회가 다시 일어나지 않는다 — 버튼이
   * 없으면 사번을 못 넣고, 사번이 없으면 이 화면의 모든 것이 막혀 단말을 새로 켜야 한다.
   */
  it('실패 문구와 함께 다시 시도할 경로를 준다', async () => {
    const { user } = renderScreen({ workersStatus: 500 });

    await enterWorkerNo(user, WORKER.workerNo);

    expect(await screen.findByText(t.worker.lookupFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.worker.retry })).toBeInTheDocument();
  });

  it('「다시 시도」가 실제로 다시 묻고, 이번에 성공하면 그 사번으로 선다', async () => {
    const { user } = renderScreen({ workersFailFirst: true });

    await enterWorkerNo(user, WORKER.workerNo);
    await user.click(await screen.findByRole('button', { name: t.worker.retry }));

    expect(
      await screen.findAllByText(
        messages.popChrome.header.workerLabel(WORKER.workerNo, WORKER.workerName),
      ),
    ).not.toHaveLength(0);
  });

  /** ⛔ 미등록·퇴사는 다시 물어도 답이 같다 — 없는 사람을 계속 찾게 하지 않는다. */
  it('미등록 사번에는 「다시 시도」를 주지 않는다', async () => {
    const { user } = renderScreen({ workers: [] });

    await enterWorkerNo(user, WORKER.workerNo);

    expect(await screen.findByText(t.worker.unknown)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.worker.retry })).not.toBeInTheDocument();
  });
});

describe('P-02-01 작업 시작 — 사번을 바꿀 수 있는 자리인가', () => {
  /**
   * ⛔ **눌러도 아무 일이 없는 버튼을 세우지 않는다.** 단말 토큰이 정한 사번(`pop-identity`)은
   * 이 화면이 비워도 그대로 돌아온다 — 「다시 입력」이 영구 무동작이 된다.
   */
  it('단말 토큰이 사번을 들고 있으면 「다시 입력」을 주지 않는다', async () => {
    renderScreen({ identity: { ...IDENTITY, workerNo: WORKER.workerNo } });

    expect(
      await screen.findAllByText(messages.popChrome.header.workerLabel(WORKER.workerNo)),
    ).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: '다시 입력' })).not.toBeInTheDocument();
  });

  /*
   * ⛔ **사번을 알고 나면 구획을 통째로 걷는다**(사용자 지시 2026-09-08). 진입 화면
   *    (`P-CO-01`)이 사번을 정해 오므로 여기서 다시 묻는 것은 같은 것을 두 번 묻는 것이다.
   *    작업자를 바꾸는 길은 머리줄의 **로그아웃**이다.
   */
  it('사번이 확인되면 사번 구획을 세우지 않는다', async () => {
    const { user } = renderScreen();

    await enterWorkerNo(user, WORKER.workerNo);
    await screen.findAllByText(
      messages.popChrome.header.workerLabel(WORKER.workerNo, WORKER.workerName),
    );

    expect(screen.queryByRole('button', { name: '다시 입력' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.worker.confirm })).not.toBeInTheDocument();
  });
});

describe('P-02-01 작업 시작 — 사번은 단말이 들고 있는 자리를 쓴다', () => {
  /**
   * ⭐ **두 벌을 만들지 않는다.** 사번 경량 인증(`P-CO-01`)이 정한 값이 `worker-session` 에
   * 있고, 이 화면은 그 자리를 읽는다 — 지나온 작업자에게 같은 것을 두 번 묻지 않는다.
   */
  it('이미 지정된 사번이 있으면 키패드를 보이지 않고 그 사번으로 선다', async () => {
    setWorkerSession({
      worker: WORKER,
      assignedAt: '2026-09-02 09:00',
      isOtherPlant: false,
    } as never);

    renderScreen();

    /* 머리띠와 ① 구획 둘 다 사번을 말한다 — 「하나만 있어야 한다」가 아니라 「선다」를 잰다. */
    expect(
      await screen.findAllByText(
        messages.popChrome.header.workerLabel(WORKER.workerNo, WORKER.workerName),
      ),
    ).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: t.worker.confirm })).not.toBeInTheDocument();
  });

  /**
   * 이 화면에서 확인한 사번도 같은 자리에 넣는다 — 다음 화면이 이어받는다.
   *
   * ⭐ **화면을 지웠다 다시 세워 확인한다.** 값이 화면 «안»에 있으면 지우는 순간 사라진다 —
   * 다시 세운 화면이 그 사번으로 서면 그 자리는 화면 밖이라는 뜻이다.
   */
  it('여기서 확인한 사번을 단말이 들고 간다', async () => {
    const first = renderScreen();

    await enterWorkerNo(first.user, WORKER.workerNo);
    await screen.findAllByText(
      messages.popChrome.header.workerLabel(WORKER.workerNo, WORKER.workerName),
    );

    first.unmount();
    renderScreen();

    expect(
      await screen.findAllByText(
        messages.popChrome.header.workerLabel(WORKER.workerNo, WORKER.workerName),
      ),
    ).not.toHaveLength(0);
  });

  /*
   * ⚠ **사번을 못 받았을 때만 키패드가 선다.** 자리까지 없애면 되돌아갈 길이 없다 —
   *   그 예외를 여기서 지킨다.
   */
  it('사번이 없으면 키패드를 펼치지 않고 사번 입력 창을 여는 버튼을 세운다', async () => {
    const { user } = renderScreen();

    /* 구획 안에는 빈 상태와 [사번 입력]만 있다(사용자 결정 2026-10-23). */
    expect(screen.getByText(t.worker.empty)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument();
    expect(await screen.findByText(t.remaining.worker)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.worker.open }));
    const dialog = await screen.findByRole('dialog', { name: t.worker.dialogTitle });
    expect(within(dialog).getByRole('button', { name: t.worker.confirm })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '1' })).toBeInTheDocument();
    /* 키 높이는 P-CO-01 사번 키패드와 같은 규칙(`.worker-no-keypad`)을 쓴다(사용자 결정 2026-10-23). */
    expect(within(dialog).getByRole('button', { name: '1' }).parentElement).toHaveClass(
      'worker-no-keypad',
    );
    await user.click(within(dialog).getByRole('button', { name: t.worker.cancel }));
    /* 묶음 제목은 「작업자」이고 칸 라벨 「사번」을 되풀이하지 않는다(사용자 결정 2026-10-23). */
    const group = screen.getByRole('group', { name: t.coWorkers.title });
    expect(within(group).getByRole('heading', { name: t.coWorkers.title })).toBeInTheDocument();
    expect(within(group).getAllByText(t.worker.fieldLabel)).toHaveLength(1);
  });
});

describe('P-02-01 작업 시작 — 세션 열기', () => {
  const openStart = async () => {
    const rendered = renderScreen();

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    return rendered;
  };

  it('사번·지시·게이팅이 모두 서면 시작이 열린다', async () => {
    await openStart();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
  });

  /**
   * ⛔ 통지 #563 · omf-mes#271 — 단말·작업자·교대는 본문이 아니라 서버가 푼다. 선택으로도
   * 남기지 않는다.
   */
  it('본문에 단말·작업자·교대를 싣지 않고 사번은 헤더로 보낸다', async () => {
    const { user, recorded } = await openStart();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await user.click(startButton());

    await waitFor(() => {
      expect(sessionBodies(recorded.bodies)).toHaveLength(1);
    });

    const sent = sessionBodies(recorded.bodies)[0];
    if (sent === undefined) throw new Error('요청이 기록되지 않았습니다.');

    expect(sent.url).toBe('/production/work-sessions');

    const body = sent.body as Record<string, unknown>;
    expect(body.workOrderId).toBe(WORK_ORDER.workOrderId);
    expect(body.equipmentId).toBe(EQUIPMENT_ID);
    expect(body).not.toHaveProperty('terminalId');
    expect(body).not.toHaveProperty('workerId');
    expect(body).not.toHaveProperty('workerIds');
    expect(body).not.toHaveProperty('shiftId');

    expect(sent.headers['x-worker-no']).toBe(WORKER.workerNo);
    expect(sent.headers['idempotency-key']).toBeTruthy();
  });

  /**
   * ⛔ **되돌릴 수 없는 쓰기라 재시도가 같은 키로 나가야 한다.** 멱등 키는 본문의 지문에
   * 매이는데, 시각을 누를 때마다 새로 만들면 **지문이 달라져 새 키가 발급된다** — 통신이
   * 끊긴 뒤 다시 누르면 서버가 다른 쓰기로 보고 세션을 두 번 연다.
   */
  it('실패한 뒤 다시 눌러도 같은 멱등 키로 나간다', async () => {
    /*
     * ⚠ **시계를 움직여야 재진다.** 단말 시각은 초 단위라, 두 번의 누름이 같은 초 안에 들면
     *    결함이 있어도 값이 우연히 같아진다 — 감지기가 조용히 통과한다(실측). 실제 재시도는
     *    사람이 오류를 읽고 누르는 것이라 초를 넘긴다.
     */
    let seconds = 1;
    vi.spyOn(Date.prototype, 'getSeconds').mockImplementation(() => seconds);

    const rendered = renderScreen({ startStatus: 500 });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });

    await rendered.user.click(startButton());
    await screen.findByText(t.result.startFailed);

    seconds = 9;
    await rendered.user.click(startButton());

    await waitFor(() => {
      expect(sessionBodies(rendered.recorded.bodies)).toHaveLength(2);
    });

    const [first, second] = sessionBodies(rendered.recorded.bodies);
    if (first === undefined || second === undefined) throw new Error('두 번 나가지 않았습니다.');

    expect(second.headers['idempotency-key']).toBe(first.headers['idempotency-key']);
    /* 시각도 함께 얼어 있어야 한다 — 이것이 달라지면 지문이 달라진다. */
    expect((second.body as Record<string, unknown>).startedAt).toBe(
      (first.body as Record<string, unknown>).startedAt,
    );
  });

  /**
   * 다른 지시를 고르면 다른 쓰기다 — 붙들고 있던 시각과 키를 버린다.
   *
   * ⚠ **시계를 얼려 놓고 잰다.** 본문에는 `workOrderId` 도 실려 지시만 바꿔도 지문이 달라진다 —
   *    시각을 움직이게 두면 「시각을 버렸는가」를 재지 못하고 감지기가 조용히 통과한다(실측).
   */
  it('다른 작업지시를 고르면 새 멱등 키로 나가고 시각도 새로 잡는다', async () => {
    let seconds = 1;
    vi.spyOn(Date.prototype, 'getSeconds').mockImplementation(() => seconds);

    const other = {
      ...WORK_ORDER,
      workOrderId: WORK_ORDER.workOrderId + 1,
      workOrderNo: 'SYN-WO-0102',
    };
    const rendered = renderScreen({ startStatus: 500, workOrders: [WORK_ORDER, other] });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await rendered.user.click(startButton());
    await screen.findByText(t.result.startFailed);

    seconds = 9;
    await rendered.user.click(screen.getByRole('button', { name: selectName(other.workOrderNo) }));
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await rendered.user.click(startButton());

    await waitFor(() => {
      expect(sessionBodies(rendered.recorded.bodies)).toHaveLength(2);
    });

    const [first, second] = sessionBodies(rendered.recorded.bodies);
    if (first === undefined || second === undefined) throw new Error('두 번 나가지 않았습니다.');

    expect(second.headers['idempotency-key']).not.toBe(first.headers['idempotency-key']);
    /* ⭐ 이 줄이 「시각을 버렸는가」를 잰다 — 위 키 비교만으로는 지시 번호 때문에 늘 통과한다. */
    expect((second.body as Record<string, unknown>).startedAt).not.toBe(
      (first.body as Record<string, unknown>).startedAt,
    );
  });

  /** 시작이 실패하면 그 사실을 말한다 — 조용히 아무 일도 없던 것처럼 두지 않는다. */
  it('시작이 실패하면 사유를 보인다', async () => {
    const rendered = renderScreen({ startStatus: 500 });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await rendered.user.click(startButton());

    expect(await screen.findByText(t.result.startFailed)).toBeInTheDocument();
  });

  /** ⛔ 409 를 「진행 중」으로 읽지 않는다 — 계약이 그 응답을 「충돌」로만 적었다. */
  it('충돌(409)은 상태가 바뀌었다고만 말한다', async () => {
    const rendered = renderScreen({ startStatus: 409 });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await rendered.user.click(startButton());

    expect(await screen.findByText(t.result.conflict)).toBeInTheDocument();
    expect(screen.queryByText(t.result.startFailed)).not.toBeInTheDocument();
  });

  it('시작하면 그 사실을 작업지시 번호와 함께 알린다', async () => {
    const { user } = await openStart();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await user.click(startButton());

    expect(await screen.findByText(t.result.started(WORK_ORDER.workOrderNo))).toBeInTheDocument();
  });

  /** ⛔ §6 — 이미 진행 중인 세션이 있으면 새로 열지 않는다. 서버의 거절을 기다리지 않는다. */
  it('열린 세션이 이미 있으면 새로 시작하지 않는다', async () => {
    const rendered = renderScreen({
      openSessions: [
        {
          workSessionId: 9801,
          workOrderId: WORK_ORDER.workOrderId,
          sessionNo: 1,
          terminalId: 9101,
          startedAt: '2026-09-02T08:10:00+09:00',
          statusCode: 'SYN_RUNNING',
        },
      ],
    });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    expect(await screen.findByText(t.remaining.continue)).toBeInTheDocument();
    /* 주 동작이 [작업 이어하기]로 선다. 새 세션을 여는 [작업 시작]은 없다. */
    expect(screen.queryByRole('button', { name: t.actions.start })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.continueToSession })).toBeEnabled();
  });
});

describe('P-02-01 작업 시작 — 오프라인', () => {
  /**
   * ⛔ 이 화면은 오프라인에서 **거부한다**(§6-1 · 통지 #556) — 큐에 담지 않는다. 회색 버튼만
   * 두지 않고 사유와 다음 행동을 함께 보인다(G-3).
   */
  it('연결이 끊기면 거부하고 사유·다음 행동을 함께 보인다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const rendered = renderScreen();

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);

    expect(await screen.findByText(t.blocked.offline)).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });
});

describe('P-02-01 작업 시작 — 계획 밖 설비', () => {
  /** ⚠ §8 미결 5 — 경고만 하고 막지 않는다. 실제 설비는 세션에 남아 사후 추적된다. */
  it('계획 설비가 다르면 경고하되 시작을 막지 않는다', async () => {
    const rendered = renderScreen({
      workOrders: [
        {
          ...WORK_ORDER,
          plannedEquipmentId: EQUIPMENT_ID + 7,
          plannedEquipmentCode: 'SYN-PRS-08',
          plannedEquipmentName: '합성 프레스 8호기',
        },
      ],
    });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    /* 계획 설비는 내부 번호가 아니라 「이름 (코드)」로 말한다(C-10, C-13). */
    expect(
      await screen.findByText(t.selection.otherEquipment('합성 프레스 8호기 (SYN-PRS-08)')),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
  });

  /** ⛔ 계획 설비가 비어 있으면(긴급 W/O) 채울 값이 없으므로 경고하지 않는다. */
  it('계획 설비가 비어 있으면 경고하지 않는다', async () => {
    const { plannedEquipmentId: _ignored, ...withoutEquipment } = WORK_ORDER;
    const rendered = renderScreen({ workOrders: [withoutEquipment] });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    expect(screen.queryByText(/계획 설비는/)).not.toBeInTheDocument();
  });
});

/* 목록에서 본 긴급 표식이 «선택 확인»에서도 남는다(스펙 §5-3 · #1147). */
describe('P-02-01 작업 시작 — 선택 확인의 긴급 표식', () => {
  const selectionPane = (): HTMLElement => screen.getByRole('group', { name: t.selection.title });

  it('긴급 지시를 고르면 선택 확인에도 긴급을 세운다', async () => {
    const rendered = renderScreen({
      workOrders: [{ ...WORK_ORDER, workOrderTypeCode: 'EMERGENCY' }],
    });

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    expect(await within(selectionPane()).findByText(t.list.emergencyBadge)).toBeInTheDocument();
  });

  it('긴급이 아닌 지시를 고르면 세우지 않는다', async () => {
    const rendered = renderScreen();

    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );

    await within(selectionPane()).findByText(new RegExp(WORK_ORDER.workOrderNo));
    expect(within(selectionPane()).queryByText(t.list.emergencyBadge)).not.toBeInTheDocument();
  });
});

/**
 * #1148 — **누른 뒤에 아무 일도 없는 자리를 없앤다.**
 *
 * 작업 시작은 쓰기 둘이 사슬로 묶여 있다(판정 기록 → 세션 생성). 실측에서 앞엣것만 나가고
 * 화면이 아무 말도 하지 않는 회차가 나왔다. 여기 감지기는 그 사슬이 **끊길 수 있는 자리**와
 * **끊겼을 때 말하는지**를 잰다.
 */
describe('P-02-01 작업 시작 — 누르면 반드시 무언가 말한다(#1148)', () => {
  const OPEN_SESSION = {
    workSessionId: 9801,
    workOrderId: WORK_ORDER.workOrderId,
    sessionNo: 1,
    terminalId: 9101,
    startedAt: '2026-09-02T08:10:00+09:00',
    statusCode: 'SYN_RUNNING',
  };

  /** 고른 뒤 시작을 누를 수 있는 상태까지 간다. */
  const selectWorkOrder = async (rendered: ReturnType<typeof renderScreen>) => {
    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
  };

  /**
   * ⭐ **§6 — 「진행 중인 작업이 있습니다」 + 그 세션으로 이동.** 잠긴 버튼만 두면 안내가
   *    시키는 동작을 화면이 주지 않는다(실측 2026-09-12 · 88단계 확정 결함 13).
   */
  it('진행 중인 세션이 있으면 그 작업으로 이어갈 길을 준다', async () => {
    const rendered = renderScreen({ openSessions: [OPEN_SESSION] });

    await selectWorkOrder(rendered);

    expect(await screen.findByText(t.remaining.continue)).toBeInTheDocument();

    await rendered.user.click(screen.getByRole('button', { name: t.actions.continueToSession }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/pop/material-input?workOrderId=${String(WORK_ORDER.workOrderId)}`,
    );
  });

  /** ⛔ 중단 중인 지시는 [재개] 로 간다 — 이어가기를 세우지 않는다(§5-4). */
  it('중단 중인 지시에는 이어가기를 세우지 않는다', async () => {
    const rendered = renderScreen({
      workOrders: [{ ...WORK_ORDER, statusCode: 'SUSPENDED' }],
      openSessions: [OPEN_SESSION],
    });

    await selectWorkOrder(rendered);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.resume })).toBeEnabled();
    });
    /* 막힘 없음 문장이 주 동작이 가는 곳을 상태대로 말한다(C-5). */
    expect(screen.getByText(t.remaining.resume)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.actions.continueToSession }),
    ).not.toBeInTheDocument();
  });

  /**
   * ⛔ **판정 기록이 오가는 동안 화면이 비어 있지 않다.** 통과 판정이면 게이트가 아무것도
   *    그리지 않으므로, 이 사이에 표시가 없으면 작업자는 버튼이 안 먹었다고 본다.
   */
  it('판정을 기록하는 동안 시작 버튼이 진행 중으로 잠긴다', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const rendered = renderScreen({ decisionGate: gate });

    await selectWorkOrder(rendered);
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await rendered.user.click(startButton());

    const starting = await screen.findByRole('button', { name: t.actions.starting });
    expect(starting).toBeDisabled();

    release();
    await waitFor(() => {
      expect(sessionBodies(rendered.recorded.bodies)).toHaveLength(1);
    });
  });

  /**
   * ⭐ **이 회차가 이슈의 재현이다.** 판정이 오가는 사이 목록이 다시 와서 고른 줄이 사라져도
   *    세션 쓰기는 나가야 한다 — 「①은 나갔고 ②는 안 나갔다」가 여기서 생긴다.
   */
  it('판정 중에 목록에서 그 줄이 사라져도 세션을 연다', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const rendered = renderScreen({ decisionGate: gate, workOrdersAfter: [] });

    await selectWorkOrder(rendered);
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await rendered.user.click(startButton());

    /* 판정이 오가는 사이 서버의 목록이 달라진다 — 다른 단말이 먼저 가져간 상황이다. */
    await rendered.queryClient.invalidateQueries({ queryKey: ['work-start', 'work-orders'] });
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
      ).not.toBeInTheDocument();
    });

    release();

    await waitFor(() => {
      expect(sessionBodies(rendered.recorded.bodies)).toHaveLength(1);
    });

    /*
     * ⭐ **세션만 열고 서는 것도 「조용히 멈춤」이다.** 성공 처리기가 사라진 줄을 다시 찾으면
     *    작업지시 번호가 빈 문구가 서고 자재 투입으로 넘어가지도 못한다.
     */
    expect(await screen.findByText(t.result.started(WORK_ORDER.workOrderNo))).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        `/pop/material-input?workOrderId=${String(WORK_ORDER.workOrderId)}`,
      );
    });
  });

  /**
   * ⭐ **서버와 어긋났으면 무슨 일이 있었고 다음에 무엇이 일어나는지 말한다**(이슈 기대 동작).
   */
  it('409 면 상태가 바뀌었다고 말하고 목록을 다시 불러온다', async () => {
    const rendered = renderScreen({ startStatus: 409 });

    await selectWorkOrder(rendered);
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });

    const before = listUrls(rendered.recorded.urls).length;

    await rendered.user.click(startButton());

    expect(await screen.findByText(t.result.conflict)).toBeInTheDocument();
    await waitFor(() => {
      expect(listUrls(rendered.recorded.urls).length).toBeGreaterThan(before);
    });
  });
});

/**
 * omf-all-around#45 — **다 만든 작업지시에 다음 걸음을 말한다.**
 *
 * 실적 등록은 W/O 를 끝내지 않는다. 지시 수량을 채워도 남는 일이 «마감»인데, 화면이 그 말을
 * 하지 않으면 작업자는 [이어서 하기] 만 보고 다 끝난 작업을 다시 연다.
 *
 * ⛔ **막는 감지기가 아니다** — 초과 생산·재작업으로 더 돌릴 수 있고, 버튼은 그대로 선다.
 */
describe('P-02-01 작업 시작 — 지시 수량을 채운 작업지시(#45)', () => {
  /** 지시 수량(500)을 채운 줄 — 누적 양품은 «서버가» 낸 값이다(`withProgress=true`). */
  const FULFILLED = { ...WORK_ORDER, progress: { goodQty: 500, achievementRate: 1 } };

  const OPEN_SESSION = {
    workSessionId: 9801,
    workOrderId: WORK_ORDER.workOrderId,
    sessionNo: 1,
    terminalId: 9101,
    startedAt: '2026-09-02T08:10:00+09:00',
    statusCode: 'SYN_RUNNING',
  };

  const selectWorkOrder = async (rendered: ReturnType<typeof renderScreen>) => {
    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
  };

  it('지시 수량을 채운 지시를 고르면 마감이 남았다고 알린다', async () => {
    const rendered = renderScreen({ workOrders: [FULFILLED] });

    await selectWorkOrder(rendered);

    expect(await screen.findByText(t.closing.fulfilled)).toBeInTheDocument();
  });

  /** ⛔ 안내는 막는 말이 아니다 — 더 돌릴 수 있어야 한다. */
  it('안내를 내면서도 시작을 막지 않는다', async () => {
    const rendered = renderScreen({ workOrders: [FULFILLED] });

    await selectWorkOrder(rendered);

    await screen.findByText(t.closing.fulfilled);
    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
  });

  /**
   * ⭐ **진행 중이면 그 사실까지 한 문장이 말한다**(사용자 확정 2026-09-21). ⛔ 같은 사실을
   *    적은 기존 안내를 겹쳐 세우지 않는다 — 띠만 길어지고 읽히지 않는다.
   *    다만 **[이어서 하기] 는 반드시 남는다**.
   */
  it('열린 세션까지 있으면 그 사실까지 한 문장으로 말하고 이어갈 길을 남긴다', async () => {
    const rendered = renderScreen({ workOrders: [FULFILLED], openSessions: [OPEN_SESSION] });

    await selectWorkOrder(rendered);

    expect(await screen.findByText(t.closing.fulfilledWithOpenSession)).toBeInTheDocument();
    expect(screen.queryByText(t.remaining.continue)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.continueToSession })).toBeInTheDocument();
  });

  /** ⛔ 아직 못 채운 지시에는 마감을 말하지 않는다 — 안 끝난 작업을 끝난 것으로 보이게 한다. */
  it('지시 수량을 못 채웠으면 마감을 말하지 않는다', async () => {
    const rendered = renderScreen({
      workOrders: [{ ...WORK_ORDER, progress: { goodQty: 499, achievementRate: 0.998 } }],
    });

    await selectWorkOrder(rendered);

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    expect(screen.queryByText(t.closing.fulfilled)).not.toBeInTheDocument();
  });

  /**
   * ⛔ **막힘 사유는 마감 안내에 밀리지 않는다**(리뷰 지적 2026-09-21). 못 하는 이유를 덮으면
   *    작업자는 풀어야 할 것을 못 본 채 잠긴 버튼만 본다. 마감 안내가 자리를 가져가는 것은
   *    「이미 진행 중」 하나뿐이고, 그것은 **같은 사실을 두 번 적지 않기** 위해서다.
   */
  it('막힘 사유가 있으면 마감 안내가 그 사유를 덮지 않는다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const rendered = renderScreen({ workOrders: [FULFILLED] });

    await selectWorkOrder(rendered);

    expect(await screen.findByText(t.blocked.offline)).toBeInTheDocument();
    expect(screen.queryByText(t.closing.fulfilled)).not.toBeInTheDocument();
  });
});

/**
 * omf-all-around#42 — **다음 작업 화면으로 가는 길.**
 *
 * 작업 중단(`P-02-10`)·부품 교체(`P-02-11`)·PQC 검사(`P-02-13`)·포장 작업(`P-02-08`)은 모두
 * 작업지시(또는 그 지시의 검사 의뢰)를 주소로만 받고, 못 받으면 「작업 시작 화면에서 고른 뒤
 * 들어오세요」로 막힌다. 그런데 그 「고른 뒤 들어오는」 길이 이 화면에 없어 설치본(주소창
 * 없음)에서는 넷 다 열 수 없었다. 여기 감지기는 그 길이 **열린 세션에서만** 서는지를 잰다.
 */
describe('P-02-01 작업 시작 — 다음 작업 화면으로 가는 길(omf-all-around#42)', () => {
  const OPEN_SESSION = {
    workSessionId: 9801,
    workOrderId: WORK_ORDER.workOrderId,
    sessionNo: 1,
    terminalId: 9101,
    startedAt: '2026-09-02T08:10:00+09:00',
    statusCode: 'SYN_RUNNING',
  };

  const selectWorkOrder = async (rendered: ReturnType<typeof renderScreen>) => {
    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });
    await enterWorkerNo(rendered.user, WORKER.workerNo);
    await rendered.user.click(
      await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
    );
  };

  /** ⭐ 고른 작업지시를 주소로 실어 보낸다 — 중단 화면이 그것으로만 열린다. */
  it('진행 중인 세션이 있으면 작업 중단으로 갈 길을 준다', async () => {
    const rendered = renderScreen({ openSessions: [OPEN_SESSION] });

    await selectWorkOrder(rendered);

    await rendered.user.click(await screen.findByRole('button', { name: t.blocked.holdWork }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/pop/work-hold?workOrderId=${String(WORK_ORDER.workOrderId)}`,
    );
  });

  /**
   * ⭐ **진행 중은 «상태»다**(사용자 지시 2026-09-21). 띠 전체를 경고 상자로 세우면 작업자가
   *    풀어야 할 진짜 막힘과 구분되지 않는다. 디자인 시스템이 경고를 `alert`, 안내를
   *    `status` 로 내므로 그 역할로 잰다 — 색 이름은 화면 밖에서 볼 수 없다.
   */
  it('진행 중 안내는 경고 띠가 아니라 하단 바 「남은 일」로 선다', async () => {
    const rendered = renderScreen({ openSessions: [OPEN_SESSION] });

    await selectWorkOrder(rendered);

    /* 진행 중 안내는 경고 띠가 아니라 하단 바 「남은 일」 한 줄이다(C-5). */
    const line = await screen.findByText(t.remaining.continue);

    expect(line.closest('[role="alert"]')).toBeNull();
    expect(line.closest('[role="region"]')).toHaveAccessibleName(
      messages.screenPatterns.actionBar.region,
    );
  });

  /**
   * ⭐ **주 단추와 보조 작업은 다른 상자에 선다**(사용자 지시 2026-09-21 · 2차). 넷이 한 줄에
   *    흩어지면 무엇이 지금 할 일인지 화면에 없다 — 구분은 색이 아니라 «자리»가 진다.
   *    ⚠ 서식은 감지기에 보이지 않으므로 상자 구조로 잰다.
   */
  it('보조 작업 셋은 주 단추와 다른 상자에 모인다', async () => {
    const rendered = renderScreen({ openSessions: [OPEN_SESSION] });

    await selectWorkOrder(rendered);

    const primary = await screen.findByRole('button', { name: t.actions.continueToSession });
    const others = screen.getByRole('button', { name: t.blocked.holdWork }).closest('div');

    expect(others).toHaveClass('work-start-other-work');
    expect(primary.closest('.work-start-other-work')).toBeNull();
    /* 주 동작은 하단 바에, 보조 작업은 오른쪽 구획의 「다른 작업」 묶음에 선다. */
    expect(primary.closest('[role="region"]')).toHaveAccessibleName(
      messages.screenPatterns.actionBar.region,
    );
    expect(others?.closest('[role="group"]')).toHaveAccessibleName(t.selection.otherWork);
    for (const label of [t.blocked.runningChange, t.blocked.packingWork]) {
      expect(screen.getByRole('button', { name: label }).closest('div')).toBe(others);
    }
  });

  /** ⛔ 풀어야 하는 막힘까지 낮추지 않는다 — 눈에 걸리지 않으면 작업자가 지나친다. */
  it('작업자가 풀어야 할 막힘은 하단 바 「남은 일」이 말하고 주 동작에 이어진다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const rendered = renderScreen({ openSessions: [OPEN_SESSION] });

    await selectWorkOrder(rendered);

    /* 막힘 사유는 하단 바 「남은 일」이 말하고 잠긴 주 동작에 이어진다(C-4). */
    const line = await screen.findByText(t.blocked.offline);

    expect(startButton()).toBeDisabled();
    expect(startButton()).toHaveAttribute('aria-describedby', line.id);
  });

  /** ⭐ 러닝체인지도 같은 자리에서 작업지시를 싣는다(체크리스트 43). */
  it('진행 중인 세션이 있으면 부품 교체로 갈 길을 준다', async () => {
    const rendered = renderScreen({ openSessions: [OPEN_SESSION] });

    await selectWorkOrder(rendered);

    await rendered.user.click(await screen.findByRole('button', { name: t.blocked.runningChange }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/pop/running-change?workOrderId=${String(WORK_ORDER.workOrderId)}`,
    );
  });

  /** ⭐ 포장 작업도 같은 조건·같은 자리다. */
  it('진행 중인 세션이 있으면 포장 작업으로 갈 길을 준다', async () => {
    const rendered = renderScreen({ openSessions: [OPEN_SESSION] });

    await selectWorkOrder(rendered);

    await rendered.user.click(await screen.findByRole('button', { name: t.blocked.packingWork }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/pop/packing-work?workOrderId=${String(WORK_ORDER.workOrderId)}`,
    );
  });

  /**
   * ⭐ **PQC 는 «검사 의뢰»를 싣는다** — 그 화면의 진입 인자가 의뢰 하나다(스펙 §5-10).
   */
  it('끝나지 않은 PQC 의뢰가 하나면 그 의뢰로 검사 화면을 연다', async () => {
    const rendered = renderScreen({ openSessions: [OPEN_SESSION], pendingPqc: [PQC_REQUEST] });

    await selectWorkOrder(rendered);

    await rendered.user.click(await screen.findByRole('button', { name: t.blocked.pqcInspection }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/pop/pqc-inspection?ir=${String(PQC_REQUEST.inspectionRequestId)}`,
    );
  });

  /** ⛔ **화면이 대신 고르지 않는다** — 의뢰가 여럿이면 번호를 적은 단추를 모두 세운다. */
  it('PQC 의뢰가 여럿이면 의뢰마다 번호를 적어 고르게 한다', async () => {
    const second = {
      ...PQC_REQUEST,
      inspectionRequestId: 7302,
      inspectionRequestNo: 'SYN-IR-0002',
    };
    const rendered = renderScreen({
      openSessions: [OPEN_SESSION],
      pendingPqc: [PQC_REQUEST, second],
    });

    await selectWorkOrder(rendered);

    expect(
      await screen.findByRole('button', {
        name: t.blocked.pqcInspectionOf(PQC_REQUEST.inspectionRequestNo),
      }),
    ).toBeInTheDocument();

    await rendered.user.click(
      screen.getByRole('button', { name: t.blocked.pqcInspectionOf(second.inspectionRequestNo) }),
    );

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/pop/pqc-inspection?ir=${String(second.inspectionRequestId)}`,
    );
  });

  /** ⛔ 끝나지 않은 의뢰가 없으면 내지 않는다 — PQC 대상이 아닌 작업지시다. */
  it('끝나지 않은 PQC 의뢰가 없으면 검사 단추를 세우지 않는다', async () => {
    const rendered = renderScreen({ openSessions: [OPEN_SESSION] });

    await selectWorkOrder(rendered);

    await screen.findByRole('button', { name: t.blocked.holdWork });
    expect(screen.queryByRole('button', { name: t.blocked.pqcInspection })).not.toBeInTheDocument();
  });

  /**
   * ⛔ **의뢰 조회가 실패해도 나머지 길은 막지 않는다.** 검사 의뢰를 못 물어본 것과 「PQC 대상이
   *    아니다」는 다른 일이지만, 어느 쪽이든 «있다고 지어낼» 수는 없다 — 그래서 PQC 단추만
   *    서지 않고 중단·교체·포장은 그대로 선다.
   */
  it('PQC 의뢰 조회가 실패해도 나머지 진입은 그대로 선다', async () => {
    const rendered = renderScreen({ openSessions: [OPEN_SESSION], pqcStatus: 500 });

    await selectWorkOrder(rendered);

    for (const label of [t.blocked.holdWork, t.blocked.runningChange, t.blocked.packingWork]) {
      expect(await screen.findByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: t.blocked.pqcInspection })).not.toBeInTheDocument();
  });

  /** ⛔ 세션이 없으면 넷 다 내지 않는다 — 중단·교체·검사·포장은 «세션» 위의 일이다. */
  it('열린 세션이 없으면 네 단추를 모두 세우지 않는다', async () => {
    const rendered = renderScreen({ pendingPqc: [PQC_REQUEST] });

    await selectWorkOrder(rendered);

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    for (const label of [
      t.blocked.holdWork,
      t.blocked.runningChange,
      t.blocked.pqcInspection,
      t.blocked.packingWork,
    ]) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
  });
});

describe('P-02-01 작업 시작 — 사번 입력 창의 키보드와 스캐너 입력', () => {
  it('칸에 치고 Enter 를 누르면 확인하고, 창이 닫히며 작업자가 선다', async () => {
    const { user } = renderScreen();

    await user.click(screen.getByRole('button', { name: t.worker.open }));
    const dialog = await screen.findByRole('dialog', { name: t.worker.dialogTitle });
    const field = within(dialog).getByLabelText(t.worker.fieldLabel);
    await waitFor(() => {
      expect(field).toHaveFocus();
    });

    await user.type(field, `${WORKER.workerNo}{Enter}`);

    expect(
      await screen.findAllByText(
        messages.popChrome.header.workerLabel(WORKER.workerNo, WORKER.workerName),
      ),
    ).not.toHaveLength(0);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: t.worker.dialogTitle })).not.toBeInTheDocument();
    });
  });

  it('숫자가 아닌 글자는 받지 않는다', async () => {
    const { user } = renderScreen();

    await user.click(screen.getByRole('button', { name: t.worker.open }));
    const dialog = await screen.findByRole('dialog', { name: t.worker.dialogTitle });
    const field = within(dialog).getByLabelText(t.worker.fieldLabel);

    await user.type(field, '33a9-1');

    expect(field).toHaveValue('3391');
  });
});
