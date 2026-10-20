import { ToastProvider } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WorkOrderAssignmentEditor,
  WorkOrderAssignmentEditorSession,
} from './work-order-assignment-editor';
import type { WorkOrderFact } from './queries';

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  validation: vi.fn(),
  recommendations: vi.fn(),
  update: vi.fn(),
  lines: vi.fn(),
  equipments: vi.fn(),
  equipment: vi.fn(),
  workers: vi.fn(),
  worker: vi.fn(),
  molds: vi.fn(),
  mold: vi.fn(),
  shifts: vi.fn(),
  locations: vi.fn(),
  write: vi.fn(),
  resourceSearch: vi.fn(),
}));
vi.mock('./queries', () => ({
  useWorkOrderDetail: mocks.detail,
  useWorkOrderValidation: mocks.validation,
  useWorkOrderResourceRecommendations: mocks.recommendations,
}));
vi.mock('./mutations', () => ({ useUpdateWorkOrder: mocks.update }));
vi.mock('./resource-queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./resource-queries')>()),
  useWorkOrderProductionLines: mocks.lines,
  useWorkOrderEquipments: mocks.equipments,
  useWorkOrderEquipment: mocks.equipment,
  useWorkOrderShifts: mocks.shifts,
  useWorkOrderLocations: mocks.locations,
}));
vi.mock('./people-tool-queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./people-tool-queries')>()),
  useWorkOrderWorkers: mocks.workers,
  useWorkOrderWorker: mocks.worker,
  useWorkOrderMolds: mocks.molds,
  useWorkOrderMold: mocks.mold,
}));

vi.mock('../../patterns/resource-picker/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../patterns/resource-picker/queries')>()),
  useResourceSearch: mocks.resourceSearch,
}));

const t = messages.workOrder;
const workOrder = {
  workOrderId: 701,
  workOrderNo: 'SYN-WO-701',
  priorityNo: 2,
  productionLineId: 101,
  responsibleWorkerId: 201,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: 301,
  plannedMoldId: 401,
  plannedShiftId: 501,
  defaultWipLocationId: 601,
  defaultFgLocationId: 602,
  defaultScrapLocationId: 603,
} as WorkOrderFact;
const query = (data: unknown, overrides: Record<string, unknown> = {}) => ({
  data,
  dataUpdatedAt: 1,
  isPending: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  ...overrides,
});
const resources = (items: unknown[], truncated = false) =>
  query({
    items: items.map((item) => ({ plantId: 501, ...(item as object) })),
    /* 「담당 작업자 선택」 창이 쪽 정보를 읽는다 — 실제 응답과 같은 모양으로 둔다. */
    page: { page: 1, size: 200, total: items.length },
    truncated,
  });
const updateState = (overrides: Record<string, unknown> = {}) => ({
  write: mocks.write,
  reset: vi.fn(),
  isSaving: false,
  error: null,
  fieldErrors: { plannedStartAt: 'SYN-SERVER-START' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.detail.mockReturnValue(query(workOrder));
  mocks.validation.mockReturnValue(query({ passed: true, findings: [] }));
  mocks.recommendations.mockReturnValue(query(undefined));
  mocks.lines.mockReturnValue(
    resources([
      { productionLineId: 101, lineCode: 'L-1', lineName: '1호선', isActive: true },
      {
        productionLineId: 102,
        lineCode: 'L-2',
        lineName: '2호선',
        isActive: true,
        defaultWipLocationId: 601,
        defaultFgLocationId: 602,
        defaultScrapLocationId: 603,
      },
    ]),
  );
  mocks.equipments.mockReturnValue(resources([]));
  mocks.workers.mockReturnValue(
    resources([{ workerId: 201, workerNo: 'W-1', workerName: '홍길동', isActive: true }]),
  );
  mocks.worker.mockReturnValue(query(undefined));
  mocks.equipment.mockReturnValue(query(undefined));
  mocks.mold.mockReturnValue(query(undefined));
  mocks.molds.mockReturnValue(
    resources([{ moldId: 401, moldCode: 'M-1', moldName: 'A금형', isActive: true }]),
  );
  mocks.shifts.mockReturnValue(
    resources([
      {
        shiftId: 501,
        shiftCode: 'D',
        shiftName: '주간',
        startTime: '08:00:00',
        endTime: '20:00:00',
        isActive: true,
      },
    ]),
  );
  mocks.locations.mockReturnValue({
    items: [
      {
        locationId: 601,
        warehouseId: 34,
        warehouseCode: 'S210',
        warehouseName: '제품창고',
        warehouseTypeCode: 'GENERAL',
        locationCode: 'WIP',
        locationName: 'WIP 위치',
        isActive: true,
      },
      {
        locationId: 602,
        warehouseId: 34,
        warehouseCode: 'S210',
        warehouseName: '제품창고',
        warehouseTypeCode: 'PRODUCT',
        locationCode: 'FG',
        locationName: '완제품 위치',
        isActive: true,
      },
      {
        locationId: 603,
        warehouseId: 34,
        warehouseCode: 'S210',
        warehouseName: '제품창고',
        warehouseTypeCode: 'GENERAL',
        locationCode: 'SCRAP',
        locationName: '스크랩 위치',
        isActive: true,
      },
    ],
    truncated: false,
    isPending: false,
    isError: false,
  });
  mocks.update.mockReturnValue(updateState());
  mocks.resourceSearch.mockReturnValue(query({ items: [], total: 0 }));
});

const Harness = ({ blockedReason = null }: { blockedReason?: string | null }) => {
  const [priority, setPriority] = useState('2');
  return (
    <ToastProvider>
      <WorkOrderAssignmentEditorSession
        workOrder={workOrder}
        plantId={501}
        planDate="2026-10-20"
        priorityText={priority}
        blockedReason={blockedReason}
        onPriorityChange={setPriority}
        onReload={vi.fn()}
      />
    </ToastProvider>
  );
};

const OuterHarness = () => {
  const [priority, setPriority] = useState('2');
  return (
    <ToastProvider>
      <WorkOrderAssignmentEditor
        workOrderId={701}
        plantId={501}
        planDate="2026-10-20"
        priorityText={priority}
        onPriorityChange={setPriority}
      />
    </ToastProvider>
  );
};

it('joins resource lookups, clears line-bound equipment, and saves exact owned fields', async () => {
  const user = userEvent.setup();
  const { container } = render(<Harness />);
  expect(container.querySelector('.work-order-assignment-edit-grid')).not.toBeNull();
  expect(
    screen.getByLabelText(t.planFieldsPane.fields.plannedStartAtLocal),
  ).toHaveAccessibleDescription('SYN-SERVER-START');
  const equipment = () => screen.getByLabelText(t.resourcePane.fields.equipment);
  expect(equipment()).toHaveValue(messages.common.reference.unknown);
  await user.click(screen.getByRole('combobox', { name: t.resourcePane.fields.productionLine }));
  await user.click(screen.getByRole('option', { name: 'L-1 · 1호선' }));
  expect(equipment()).toHaveValue(messages.common.reference.unknown);
  await user.click(screen.getByRole('combobox', { name: t.resourcePane.fields.productionLine }));
  await user.click(screen.getByRole('option', { name: 'L-2 · 2호선' }));
  expect(equipment()).toHaveValue('');
  await user.click(screen.getByRole('button', { name: t.assignmentActions.actions.save }));
  expect(mocks.write).toHaveBeenCalledWith(
    expect.objectContaining({
      productionLineId: 102,
      plannedEquipmentId: null,
      responsibleWorkerId: 201,
      plannedMoldId: 401,
      plannedShiftId: 501,
      priorityNo: 2,
    }),
  );
});

it('교대를 바꾸면 계획일과 교대 시각으로 계획 시작·종료를 다시 채우고, 비우면 근무일 하루로 돌린다', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const start = () => screen.getByLabelText(t.planFieldsPane.fields.plannedStartAtLocal);
  const end = () => screen.getByLabelText(t.planFieldsPane.fields.plannedEndAtLocal);

  await user.click(screen.getByRole('combobox', { name: t.resourcePane.fields.shift }));
  await user.click(screen.getByRole('option', { name: t.resourcePane.clearOption }));
  expect(start()).toHaveValue('2026-10-20T08:00');
  expect(end()).toHaveValue('2026-10-21T08:00');

  await user.click(screen.getByRole('combobox', { name: t.resourcePane.fields.shift }));
  await user.click(screen.getByRole('option', { name: /주간/ }));
  expect(start()).toHaveValue('2026-10-20T08:00');
  expect(end()).toHaveValue('2026-10-20T20:00');
});

it('교대 추천 칩을 누르면 선택칸에서 고른 것과 같이 계획 시작·종료를 다시 채운다', async () => {
  const user = userEvent.setup();
  mocks.shifts.mockReturnValue(
    resources([
      {
        shiftId: 501,
        shiftCode: 'D',
        shiftName: '주간',
        startTime: '08:00:00',
        endTime: '20:00:00',
        isActive: true,
      },
      {
        shiftId: 502,
        shiftCode: 'N',
        shiftName: '야간',
        startTime: '20:00:00',
        endTime: '08:00:00',
        crossesMidnight: true,
        isActive: true,
      },
    ]),
  );
  mocks.recommendations.mockReturnValue(
    query({
      equipments: [],
      molds: [],
      shifts: [
        {
          shiftId: 502,
          shiftCode: 'N',
          shiftName: '야간',
          startTime: '20:00:00',
          endTime: '08:00:00',
          busy: false,
        },
      ],
    }),
  );
  render(<Harness />);

  await user.click(screen.getByRole('button', { name: /^N · 야간/ }));

  expect(screen.getByRole('combobox', { name: t.resourcePane.fields.shift })).toHaveTextContent(
    'N · 야간',
  );
  expect(screen.getByLabelText(t.planFieldsPane.fields.plannedStartAtLocal)).toHaveValue(
    '2026-10-20T20:00',
  );
  expect(screen.getByLabelText(t.planFieldsPane.fields.plannedEndAtLocal)).toHaveValue(
    '2026-10-21T08:00',
  );
});

it('작업자 추천 칩을 누르면 받아 둔 목록에 없는 작업자도 칸에 이름이 바로 선다', async () => {
  const user = userEvent.setup();
  mocks.recommendations.mockReturnValue(
    query({
      equipments: [],
      molds: [],
      workers: [
        { workerId: 299, workerNo: 'W-99', workerName: '김자격', source: 'QUALIFIED', busy: false },
      ],
    }),
  );
  render(<Harness />);

  await user.click(
    screen.getByRole('button', {
      name: `${t.resourcePane.recommendation.sources.QUALIFIED}, W-99 · 김자격`,
    }),
  );

  expect(screen.getByLabelText(t.resourcePane.fields.worker)).toHaveValue('W-99 · 김자격');
});

describe('교대·작업자 추천의 사용 중 표식', () => {
  const busyRecommendations = () =>
    query({
      equipments: [],
      molds: [],
      shifts: [
        {
          shiftId: 501,
          shiftCode: 'D',
          shiftName: '주간',
          startTime: '08:00:00',
          endTime: '20:00:00',
          busy: true,
        },
      ],
      workers: [
        { workerId: 299, workerNo: 'W-99', workerName: '김자격', source: 'LINE', busy: true },
      ],
    });
  const marks = () =>
    [
      screen.getByRole('button', { name: /^D · 주간/ }),
      screen.getByRole('button', { name: /W-99 · 김자격/ }),
    ].map((chip) => chip.textContent);
  const short = t.resourcePane.recommendation.short;

  it('저장값 그대로면 보이고, 계획 시작을 고치면 떼되 칩은 누를 수 있다', async () => {
    const user = userEvent.setup();
    mocks.recommendations.mockReturnValue(busyRecommendations());
    render(<Harness />);

    expect(marks()).toEqual([
      `✓ 주간 · ${short.busy}`,
      `${t.resourcePane.recommendation.sources.RECENT}김자격 · ${short.workerBusy}`,
    ]);

    const start = screen.getByLabelText(t.planFieldsPane.fields.plannedStartAtLocal);
    await user.clear(start);
    await user.type(start, '2026-10-21T08:00');

    expect(marks()).toEqual(['✓ 주간', `${t.resourcePane.recommendation.sources.RECENT}김자격`]);
    await user.click(screen.getByRole('button', { name: /W-99 · 김자격/ }));
    expect(screen.getByLabelText(t.resourcePane.fields.worker)).toHaveValue('W-99 · 김자격');
  });

  it('교대를 바꿔도 뗀다', async () => {
    const user = userEvent.setup();
    mocks.recommendations.mockReturnValue(busyRecommendations());
    render(<Harness />);

    await user.click(screen.getByRole('combobox', { name: t.resourcePane.fields.shift }));
    await user.click(screen.getByRole('option', { name: t.resourcePane.clearOption }));

    expect(marks()).toEqual(['주간', `${t.resourcePane.recommendation.sources.RECENT}김자격`]);
  });
});

it('라인을 바꾸면 기본 위치 셋을 그 라인 기본값으로 덮어쓰고, 칸마다 맞는 창고 유형만 고르게 한다', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const field = (name: string) => screen.getByRole('combobox', { name });

  await user.click(field(t.resourcePane.fields.productionLine));
  await user.click(screen.getByRole('option', { name: 'L-2 · 2호선' }));
  expect(field(t.resourcePane.fields.defaultWipLocation)).toHaveTextContent('WIP · WIP 위치');
  expect(field(t.resourcePane.fields.defaultFgLocation)).toHaveTextContent('FG · 완제품 위치');
  expect(field(t.resourcePane.fields.defaultScrapLocation)).toHaveTextContent(
    'SCRAP · 스크랩 위치',
  );

  // 기본 위치가 없는 라인으로 바꾸면 앞 라인의 위치를 남기지 않고 비운다.
  await user.click(field(t.resourcePane.fields.productionLine));
  await user.click(screen.getByRole('option', { name: 'L-1 · 1호선' }));
  expect(field(t.resourcePane.fields.defaultWipLocation)).not.toHaveTextContent('WIP · WIP 위치');

  await user.click(field(t.resourcePane.fields.productionLine));
  await user.click(screen.getByRole('option', { name: 'L-2 · 2호선' }));

  await user.click(field(t.resourcePane.fields.defaultFgLocation));
  expect(screen.queryByRole('option', { name: /WIP 위치/ })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: /완제품 위치/ })).toBeInTheDocument();
});

it('추천 설비를 누르면 그 설비의 라인과 라인 기본 위치까지 함께 맞춘다', async () => {
  const user = userEvent.setup();
  mocks.equipments.mockReturnValue(
    resources([
      { equipmentId: 302, equipmentCode: 'EQ-2', equipmentName: '2호기', isActive: true },
    ]),
  );
  mocks.recommendations.mockReturnValue(
    query({
      equipments: [
        {
          equipmentId: 302,
          equipmentCode: 'EQ-2',
          equipmentName: '2호기',
          productionLineId: 102,
          source: 'DEFAULT',
          inService: true,
          busy: false,
        },
      ],
      molds: [],
    }),
  );
  render(<Harness />);
  const field = (name: string) => screen.getByRole('combobox', { name });

  await user.click(
    screen.getByRole('button', {
      name: new RegExp(`^${t.resourcePane.recommendation.sources.DEFAULT}, EQ-2 · 2호기`),
    }),
  );

  expect(field(t.resourcePane.fields.productionLine)).toHaveTextContent('L-2 · 2호선');
  expect(screen.getByLabelText(t.resourcePane.fields.equipment)).toHaveValue('EQ-2 · 2호기');
  expect(field(t.resourcePane.fields.defaultWipLocation)).toHaveTextContent('WIP · WIP 위치');
});

const equipmentRecommendation = (productionLineId: number | null) =>
  query({
    equipments: [
      {
        equipmentId: 302,
        equipmentCode: 'EQ-2',
        equipmentName: '2호기',
        productionLineId,
        source: 'MAPPED',
        inService: true,
        busy: false,
      },
    ],
    molds: [],
  });

/* 라인이 그대로면 라인 기본 위치로 덮지 않는다 — 사용자가 손으로 고친 위치가 사라진다. */
it('추천 설비의 라인이 지금 라인과 같으면 기본 위치를 덮어쓰지 않는다', async () => {
  const user = userEvent.setup();
  mocks.recommendations.mockReturnValue(equipmentRecommendation(101));
  render(<Harness />);
  const field = (name: string) => screen.getByRole('combobox', { name });

  await user.click(
    screen.getByRole('button', {
      name: new RegExp(`^${t.resourcePane.recommendation.sources.MAPPED}, EQ-2 · 2호기`),
    }),
  );

  expect(field(t.resourcePane.fields.productionLine)).toHaveTextContent('L-1 · 1호선');
  expect(screen.getByLabelText(t.resourcePane.fields.equipment)).toHaveValue('EQ-2 · 2호기');
  /* L-1 에는 기본 위치가 없다 — 덮어썼다면 비었을 것이다. */
  expect(field(t.resourcePane.fields.defaultWipLocation)).toHaveTextContent('WIP · WIP 위치');
  expect(field(t.resourcePane.fields.defaultFgLocation)).toHaveTextContent('FG · 완제품 위치');
});

it('라인이 없는 추천 설비는 라인과 기본 위치를 건드리지 않는다', async () => {
  const user = userEvent.setup();
  mocks.recommendations.mockReturnValue(equipmentRecommendation(null));
  render(<Harness />);
  const field = (name: string) => screen.getByRole('combobox', { name });

  await user.click(
    screen.getByRole('button', {
      name: new RegExp(`^${t.resourcePane.recommendation.sources.MAPPED}, EQ-2 · 2호기`),
    }),
  );

  expect(field(t.resourcePane.fields.productionLine)).toHaveTextContent('L-1 · 1호선');
  expect(screen.getByLabelText(t.resourcePane.fields.equipment)).toHaveValue('EQ-2 · 2호기');
  expect(field(t.resourcePane.fields.defaultWipLocation)).toHaveTextContent('WIP · WIP 위치');
  expect(field(t.resourcePane.fields.defaultScrapLocation)).toHaveTextContent(
    'SCRAP · 스크랩 위치',
  );
});

it('추천 응답을 기다리는 동안은 받은 쪽 밖의 배정 금형을 따로 묻지 않는다', () => {
  mocks.molds.mockReturnValue(
    resources([{ moldId: 499, moldCode: 'M-9', moldName: '다른 금형', isActive: true }]),
  );
  mocks.recommendations.mockReturnValue(query(undefined, { isPending: true }));
  render(<Harness />);

  expect(mocks.mold).not.toHaveBeenCalledWith(401);
});

/* 금형 목록은 첫 쪽만 받는다 — 자동 배정된 금형이 그 밖이면 한 벌만 따로 물어 이름을 푼다. */
it('배정된 금형이 받은 쪽에 없으면 그 금형만 따로 물어 이름을 낸다', () => {
  mocks.molds.mockReturnValue(
    resources([{ moldId: 499, moldCode: 'M-9', moldName: '다른 금형', isActive: true }]),
  );
  mocks.mold.mockImplementation((moldId: number | null) =>
    query(
      moldId === 401
        ? {
            moldId: 401,
            plantId: 501,
            moldCode: 'OA-SYN-401',
            moldName: '배정 금형',
            isActive: true,
          }
        : undefined,
    ),
  );
  render(<Harness />);

  expect(mocks.mold).toHaveBeenLastCalledWith(401);
  expect(screen.getByLabelText(t.resourcePane.fields.mold)).toHaveValue('OA-SYN-401 · 배정 금형');
});

it('다른 공장의 금형은 이름으로 덧붙이지 않는다', () => {
  mocks.molds.mockReturnValue(resources([]));
  mocks.mold.mockReturnValue(
    query({
      moldId: 401,
      plantId: 999,
      moldCode: 'OA-SYN-401',
      moldName: '남의 금형',
      isActive: true,
    }),
  );
  render(<Harness />);

  expect(
    (screen.getByLabelText(t.resourcePane.fields.mold) as HTMLInputElement).value,
  ).not.toContain('남의 금형');
});

it('배정된 설비가 받은 목록에 없으면 그 설비만 따로 물어 이름을 낸다', () => {
  mocks.equipment.mockImplementation((equipmentId: number | null) =>
    query(
      equipmentId === 301
        ? {
            equipmentId: 301,
            plantId: 501,
            equipmentCode: 'EQ-SYN-301',
            equipmentName: '배정 설비',
            productionLineId: 101,
            isActive: true,
          }
        : undefined,
    ),
  );
  render(<Harness />);

  expect(screen.getByLabelText(t.resourcePane.fields.equipment)).toHaveValue(
    'EQ-SYN-301 · 배정 설비',
  );
});

/* 추천이 이미 이름을 안다 — 목록에 없는 금형을 눌러도 「알 수 없음」이 되지 않고, 따로 묻지도 않는다. */
it('목록에 없는 추천 금형을 누르면 그 이름이 칸에 보인다', async () => {
  const user = userEvent.setup();
  mocks.recommendations.mockReturnValue(
    query({
      equipments: [],
      molds: [
        {
          moldId: 455,
          moldCode: 'OA-SYN-455',
          moldName: '추천 금형',
          source: 'RECENT',
          inService: true,
        },
      ],
    }),
  );
  render(<Harness />);

  await user.click(
    screen.getByRole('button', {
      name: new RegExp(`^${t.resourcePane.recommendation.sources.RECENT}, OA-SYN-455 · 추천 금형`),
    }),
  );

  expect(screen.getByLabelText(t.resourcePane.fields.mold)).toHaveValue('OA-SYN-455 · 추천 금형');
  expect(mocks.mold).not.toHaveBeenCalledWith(455);
});

/* 찾기 창은 받아 둔 쪽 밖의 설비도 낸다 — 그 설비의 라인으로 함께 옮기고, 이름은 한 건만 물어 푼다. */
it('찾기 창에서 받은 쪽 밖의 설비를 고르면 라인·라인 기본 위치까지 맞추고 그 이름을 낸다', async () => {
  const user = userEvent.setup();
  mocks.resourceSearch.mockReturnValue(
    query({
      items: [
        {
          id: 388,
          plantId: 501,
          code: 'EQ-SYN-388',
          name: '찾은 설비',
          productionLineId: 102,
          isActive: true,
        },
      ],
      total: 1,
    }),
  );
  mocks.equipment.mockImplementation((equipmentId: number | null) =>
    query(
      equipmentId === 388
        ? {
            equipmentId: 388,
            plantId: 501,
            equipmentCode: 'EQ-SYN-388',
            equipmentName: '찾은 설비',
            productionLineId: 102,
            isActive: true,
          }
        : undefined,
    ),
  );
  render(<Harness />);
  const field = (name: string) => screen.getByRole('combobox', { name });

  await user.click(screen.getByLabelText(t.resourcePane.fields.equipment));
  /* 설비 찾기는 지금 라인으로 좁힌다. */
  expect(mocks.resourceSearch).toHaveBeenLastCalledWith('equipment', 501, 101, '', 1);

  const dialog = screen.getByRole('dialog', { name: messages.resourcePicker.title.equipment });
  await user.click(within(dialog).getByRole('checkbox', { name: 'EQ-SYN-388' }));
  await user.click(within(dialog).getByRole('button', { name: messages.resourcePicker.pick }));

  expect(screen.getByLabelText(t.resourcePane.fields.equipment)).toHaveValue(
    'EQ-SYN-388 · 찾은 설비',
  );
  expect(field(t.resourcePane.fields.productionLine)).toHaveTextContent('L-2 · 2호선');
  expect(field(t.resourcePane.fields.defaultWipLocation)).toHaveTextContent('WIP · WIP 위치');
});

/* 설비·금형은 찾기 창이 서버에서 찾는다 — 받아 둔 목록이 잘렸다는 안내는 그 두 칸에 맞지 않는다. */
it('설비·금형 목록이 잘려도 두 칸에는 잘림 안내를 내지 않는다', () => {
  mocks.equipments.mockReturnValue(resources([], true));
  mocks.molds.mockReturnValue(
    resources([{ moldId: 401, moldCode: 'M-1', moldName: 'A금형', isActive: true }], true),
  );
  render(<Harness />);

  expect(screen.queryByText(t.editor.lookup.truncated)).not.toBeInTheDocument();
});

it('rejects a successful write response owned by another work order', () => {
  render(<Harness />);

  act(() => {
    mocks.update.mock.calls.at(-1)![0].onSuccess({ ...workOrder, workOrderId: 999, priorityNo: 9 });
  });

  expect(screen.getByText(t.editor.writeOwnerMismatch)).toBeVisible();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('2');
  act(() => mocks.update.mock.calls.at(-1)![0].onSuccess(workOrder));
  expect(screen.queryByText(t.editor.writeOwnerMismatch)).toBeNull();
});

it.each([
  [true, null],
  [false, 'SYN-STALE'],
] as const)('locks every control for saving=%s or caller block', (isSaving, blockedReason) => {
  mocks.update.mockReturnValue(updateState({ isSaving }));
  render(<Harness blockedReason={blockedReason} />);
  expect(document.querySelectorAll('button:not(:disabled), input:not(:disabled)')).toHaveLength(0);
});

it('locks edits on validation failure while keeping its retry available', async () => {
  const user = userEvent.setup();
  const refetch = vi.fn();
  mocks.validation.mockReturnValue(query(undefined, { isError: true, refetch }));
  render(<Harness />);

  expect(screen.getByText(t.editor.validationFailed)).toBeVisible();
  expect(screen.getAllByText(t.editor.validationBlocked).length).toBeGreaterThan(0);
  expect(document.querySelectorAll('button:not(:disabled), input:not(:disabled)')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: messages.common.retry }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('forwards a screen-level stale lock into an exact loaded editor', () => {
  render(
    <ToastProvider>
      <WorkOrderAssignmentEditor
        workOrderId={701}
        plantId={501}
        planDate="2026-10-20"
        priorityText="2"
        blockedReason="SYN-SCREEN-STALE"
        onPriorityChange={vi.fn()}
      />
    </ToastProvider>,
  );

  expect(screen.getAllByText('SYN-SCREEN-STALE').length).toBeGreaterThan(0);
  expect(document.querySelectorAll('button:not(:disabled), input:not(:disabled)')).toHaveLength(0);
});

it('blocks an initial detail owned by another work order', () => {
  mocks.detail.mockReturnValue(query({ ...workOrder, workOrderId: 999 }));
  render(<OuterHarness />);
  expect(screen.getByText(t.editor.ownerMismatch)).toBeVisible();
  expect(screen.queryByRole('region', { name: t.resourcePane.pane })).toBeNull();
});

it('keeps a dirty session mounted and locked when a background detail refresh fails', async () => {
  const user = userEvent.setup();
  const view = render(<OuterHarness />);
  const priority = screen.getByLabelText(t.planFieldsPane.fields.priorityNo);
  await user.clear(priority);
  await user.type(priority, '9');

  mocks.detail.mockReturnValue(query(workOrder, { isError: true }));
  view.rerender(<OuterHarness />);

  expect(screen.getByText(t.editor.staleDescription)).toBeVisible();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
  expect(document.querySelectorAll('button:not(:disabled), input:not(:disabled)')).toHaveLength(1);
  expect(screen.getByRole('button', { name: messages.common.retry })).toBeEnabled();
});

it('keeps a dirty session locked until a newer exact detail is explicitly applied', async () => {
  const user = userEvent.setup();
  const view = render(<OuterHarness />);
  const priority = screen.getByLabelText(t.planFieldsPane.fields.priorityNo);
  await user.clear(priority);
  await user.type(priority, '9');

  mocks.detail.mockReturnValue(query({ ...workOrder, priorityNo: 4 }));
  view.rerender(<OuterHarness />);

  expect(screen.getByText(t.editor.changedDescription)).toBeVisible();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
  await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('4');
});

it('accepts an invalidation result that matches the local exact save', async () => {
  const user = userEvent.setup();
  const view = render(<OuterHarness />);
  const priority = screen.getByLabelText(t.planFieldsPane.fields.priorityNo);
  await user.clear(priority);
  await user.type(priority, '9');
  const saved = { ...workOrder, priorityNo: 9 };

  act(() => mocks.update.mock.calls.at(-1)![0].onSuccess(saved));
  view.rerender(<OuterHarness />);

  expect(screen.queryByText(t.editor.changedDescription)).toBeNull();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
  expect(screen.queryByRole('button', { name: messages.conflict.reloadAction })).toBeNull();

  mocks.detail.mockReturnValue(query({ ...saved }));
  view.rerender(<OuterHarness />);

  expect(screen.queryByText(t.editor.changedDescription)).toBeNull();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
});

it('locks when a completed refetch revision reuses the superseded value', async () => {
  const user = userEvent.setup();
  const view = render(<OuterHarness />);
  const priority = screen.getByLabelText(t.planFieldsPane.fields.priorityNo);
  await user.clear(priority);
  await user.type(priority, '9');

  act(() => mocks.update.mock.calls.at(-1)![0].onSuccess({ ...workOrder, priorityNo: 9 }));
  view.rerender(<OuterHarness />);
  expect(screen.queryByText(t.editor.changedDescription)).toBeNull();

  mocks.detail.mockReturnValue(query(workOrder, { isError: true }));
  view.rerender(<OuterHarness />);
  expect(screen.getByText(t.editor.staleDescription)).toBeVisible();

  mocks.detail.mockReturnValue(query(workOrder, { dataUpdatedAt: 2 }));
  view.rerender(<OuterHarness />);
  expect(screen.getByText(t.editor.changedDescription)).toBeVisible();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
});

it('discards a dirty session only after a successful exact conflict reload', async () => {
  const user = userEvent.setup();
  const refetch = vi
    .fn()
    .mockResolvedValueOnce({ isSuccess: false, data: workOrder })
    .mockResolvedValueOnce({ isSuccess: true, data: workOrder });
  mocks.detail.mockReturnValue(query(workOrder, { refetch }));
  mocks.update.mockReturnValue(
    updateState({ error: { kind: 'conflict', cause: 'user', message: 'SYN-CONFLICT' } }),
  );
  render(<OuterHarness />);
  const priority = screen.getByLabelText(t.planFieldsPane.fields.priorityNo);
  await user.clear(priority);
  await user.type(priority, '9');

  await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
  await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

  await waitFor(() =>
    expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('2'),
  );
  expect(refetch).toHaveBeenCalledTimes(2);
});

it('ignores a conflict reload that completes after its owner was replaced', async () => {
  const user = userEvent.setup();
  let finishReload!: (value: { isSuccess: boolean; data: WorkOrderFact }) => void;
  const refetch = vi.fn(
    () =>
      new Promise<{ isSuccess: boolean; data: WorkOrderFact }>(
        (resolve) => (finishReload = resolve),
      ),
  );
  const onPriorityChange = vi.fn();
  mocks.detail.mockReturnValue(query(workOrder, { refetch }));
  mocks.update.mockReturnValue(
    updateState({ error: { kind: 'conflict', cause: 'user', message: 'SYN-CONFLICT' } }),
  );
  const view = render(
    <ToastProvider>
      <WorkOrderAssignmentEditor
        workOrderId={701}
        plantId={501}
        planDate="2026-10-20"
        priorityText="2"
        onPriorityChange={onPriorityChange}
      />
    </ToastProvider>,
  );
  const finishSave = mocks.update.mock.calls.at(-1)![0].onSuccess;
  await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

  mocks.detail.mockReturnValue(query({ ...workOrder, workOrderId: 702 }));
  view.rerender(
    <ToastProvider>
      <WorkOrderAssignmentEditor
        workOrderId={702}
        plantId={501}
        planDate="2026-10-20"
        priorityText="2"
        onPriorityChange={onPriorityChange}
      />
    </ToastProvider>,
  );
  await act(async () => {
    finishReload({ isSuccess: true, data: { ...workOrder, priorityNo: 9 } });
    await Promise.resolve();
  });
  act(() => finishSave({ ...workOrder, priorityNo: 8 }));

  expect(refetch).toHaveBeenCalledTimes(1);
  expect(onPriorityChange).not.toHaveBeenCalled();
});

it('shows the warehouse on every default location option', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(
    screen.getByRole('combobox', { name: t.resourcePane.fields.defaultWipLocation }),
  ).toHaveTextContent('[S210 제품창고] WIP · WIP 위치');
  await user.click(screen.getByRole('combobox', { name: t.resourcePane.fields.defaultFgLocation }));
  expect(
    screen.getByRole('option', { name: '[S210 제품창고] FG · 완제품 위치' }),
  ).toBeInTheDocument();
});

it('keeps a saved worker that is off the first page and opens the picker to change it', async () => {
  const user = userEvent.setup();
  mocks.workers.mockReturnValue(
    resources([{ workerId: 202, workerNo: 'W-2', workerName: '김철수', isActive: true }], true),
  );
  mocks.worker.mockImplementation((workerId: number | null) =>
    query(
      workerId === 201
        ? { workerId: 201, plantId: 501, workerNo: 'W-1', workerName: '홍길동', isActive: true }
        : undefined,
    ),
  );
  render(<Harness />);
  expect(mocks.worker).toHaveBeenLastCalledWith(201);
  /* 저장된 작업자는 첫 쪽에 없어도 칸에 이름으로 선다. */
  expect(screen.getByLabelText(t.resourcePane.fields.worker)).toHaveValue('W-1 · 홍길동');
  /* 「일부만 보인다」는 안내는 두지 않는다 — 창이 서버에서 찾는다. */
  expect(screen.queryByText(t.editor.lookup.workerTruncated)).toBeNull();

  await user.click(screen.getByLabelText(t.resourcePane.fields.worker));
  expect(
    screen.getByRole('dialog', { name: t.resourcePane.workerPicker.title }),
  ).toBeInTheDocument();
});
