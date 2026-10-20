import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { WorkOrderResourcePane } from './work-order-resource-pane';
import type { WorkOrderAssignmentDraft } from './assignment-model';

const t = messages.workOrder.resourcePane;
const picker = messages.resourcePicker;
const draft = (overrides: Partial<WorkOrderAssignmentDraft> = {}): WorkOrderAssignmentDraft => ({
  productionLineId: '101',
  responsibleWorkerId: '201',
  plannedEquipmentId: '301',
  plannedMoldId: '401',
  plannedShiftId: '',
  defaultWipLocationId: '601',
  defaultFgLocationId: '602',
  defaultScrapLocationId: '603',
  plannedStartAtLocal: '',
  plannedEndAtLocal: '',
  priorityNo: '1',
  ...overrides,
});
const options = [
  { value: '101', label: '  SYN-Z-LINE-CURRENT  ' },
  { value: '102', label: ' SYN-A-LINE-NEXT ' },
  { value: '', label: 'SYN-BLANK-OPTION' },
];
const renderPane = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderResourcePane>> = {},
) => {
  const onChange = vi.fn();
  const result = render(
    <WorkOrderResourcePane
      selectedWorkOrderNo="SYN-WO-ALPHA"
      draft={draft()}
      productionLineOptions={options}
      plannedEquipmentOptions={[
        { value: '301', label: 'SYN-EQUIPMENT-CURRENT' },
        { value: '302', label: 'SYN-EQUIPMENT-NEXT' },
      ]}
      responsibleWorkerOptions={[
        { value: '201', label: 'SYN-WORKER-CURRENT' },
        { value: '202', label: 'SYN-WORKER-NEXT' },
      ]}
      plannedMoldOptions={[
        { value: '401', label: 'SYN-MOLD-CURRENT' },
        { value: '402', label: 'SYN-MOLD-NEXT' },
      ]}
      plannedShiftOptions={[
        { value: '501', label: 'SYN-SHIFT-CURRENT' },
        { value: '502', label: 'SYN-SHIFT-NEXT' },
      ]}
      defaultWipLocationOptions={[{ value: '601', label: 'SYN-WIP' }]}
      defaultFgLocationOptions={[{ value: '602', label: 'SYN-FG' }]}
      defaultScrapLocationOptions={[{ value: '603', label: 'SYN-SCRAP' }]}
      fieldErrors={{}}
      fieldNotes={{}}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { ...result, onChange, user: userEvent.setup() };
};

describe('WorkOrderResourcePane', () => {
  it('추천 후보를 칸 아래에 늘어놓고, 누르면 설비는 그 라인과 함께 배정한다', async () => {
    const { onChange, user } = renderPane({
      recommendations: {
        plannedEquipmentId: [
          {
            value: '302',
            code: 'SYN-EQ-REC',
            label: 'SYN-EQ-REC · 추천 설비',
            source: 'DEFAULT',
            productionLineId: '102',
            warning: 'busy',
          },
        ],
        plannedMoldId: [
          {
            value: '401',
            code: 'SYN-MOLD-REC',
            label: 'SYN-MOLD-REC · 추천 금형',
            source: 'MAPPED',
            productionLineId: null,
            warning: null,
          },
        ],
        plannedShiftId: [],
        responsibleWorkerId: [],
      },
    });

    const equipment = screen.getByRole('button', {
      name: `${t.recommendation.sources.DEFAULT}, SYN-EQ-REC · 추천 설비, ${t.recommendation.busy}`,
    });
    expect(equipment).not.toHaveAttribute('aria-pressed');
    /* 칩에는 코드와 짧은 상태만 보인다 — 긴 이름은 툴팁으로 둔다. */
    expect(equipment).toHaveTextContent(`★ SYN-EQ-REC · ${t.recommendation.short.busy}`);
    expect(equipment).toHaveAttribute('title', 'SYN-EQ-REC · 추천 설비');
    await user.click(equipment);
    expect(onChange).toHaveBeenLastCalledWith({
      productionLineId: '102',
      plannedEquipmentId: '302',
    });

    /* 지금 칸의 값과 같은 후보는 켜고 끄는 단추가 아니라 「배정됨」으로 읽힌다. */
    const mold = screen.getByRole('button', {
      name: `${t.recommendation.sources.MAPPED}, SYN-MOLD-REC · 추천 금형, ${t.recommendation.assigned}`,
    });
    expect(mold).not.toHaveAttribute('aria-pressed');
    expect(mold).toHaveClass('is-assigned');
    expect(mold).toHaveTextContent('✓ SYN-MOLD-REC');
    await user.click(mold);
    expect(onChange).toHaveBeenLastCalledWith({ plannedMoldId: '401' });
  });

  it('교대·작업자 후보는 이름만 칩에 두고, 근거·사용 중은 짧게, 누르면 그 칸에 배정한다', async () => {
    const { onChange, user } = renderPane({
      draft: { ...draft(), plannedShiftId: '502', responsibleWorkerId: '' },
      recommendations: {
        plannedEquipmentId: [],
        plannedMoldId: [],
        plannedShiftId: [
          {
            value: '501',
            code: '주간',
            label: 'D · 주간 (08:00 ~ 20:00)',
            source: null,
            productionLineId: null,
            warning: null,
          },
          {
            value: '502',
            code: '야간',
            label: 'N · 야간 (20:00 ~ 08:00)',
            source: null,
            productionLineId: null,
            warning: 'busy',
          },
        ],
        responsibleWorkerId: [
          {
            value: '211',
            code: '김자격',
            label: 'W-11 · 김자격',
            source: 'QUALIFIED',
            productionLineId: null,
            warning: null,
          },
          {
            value: '212',
            code: '이최근',
            label: 'W-12 · 이최근',
            source: 'RECENT',
            productionLineId: null,
            warning: 'workerBusy',
          },
        ],
      },
    });

    const shifts = screen.getByRole('group', {
      name: `${t.fields.shift} ${t.recommendation.label}`,
    });
    expect(
      within(shifts)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['주간', `✓ 야간 · ${t.recommendation.short.busy}`]);
    expect(
      within(shifts).getByRole('button', {
        name: `N · 야간 (20:00 ~ 08:00), ${t.recommendation.busy}, ${t.recommendation.assigned}`,
      }),
    ).toHaveAttribute('title', 'N · 야간 (20:00 ~ 08:00)');
    await user.click(within(shifts).getByRole('button', { name: /^D · 주간/ }));
    expect(onChange).toHaveBeenLastCalledWith({ plannedShiftId: '501' });

    const workers = screen.getByRole('group', {
      name: `${t.fields.worker} ${t.recommendation.label}`,
    });
    expect(
      within(workers)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual([
      `${t.recommendation.sources.QUALIFIED}김자격`,
      `${t.recommendation.sources.RECENT}이최근 · ${t.recommendation.short.workerBusy}`,
    ]);
    const recent = within(workers).getByRole('button', {
      name: `${t.recommendation.sources.RECENT}, W-12 · 이최근, ${t.recommendation.busy}`,
    });
    expect(recent).toHaveAttribute('title', 'W-12 · 이최근');
    await user.click(recent);
    expect(onChange).toHaveBeenLastCalledWith({ responsibleWorkerId: '212' });
  });

  it('교대·작업자 후보가 없으면 묶음을 그리지 않는다', () => {
    renderPane({
      recommendations: {
        plannedEquipmentId: [],
        plannedMoldId: [],
        plannedShiftId: [],
        responsibleWorkerId: [],
      },
    });

    expect(screen.queryByRole('group', { name: new RegExp(t.recommendation.label) })).toBeNull();
  });

  it('isolates no-selection state from stale assignment data', () => {
    renderPane({ selectedWorkOrderNo: null, fieldErrors: { productionLineId: 'SYN-ERROR' } });
    expect(screen.getByText(t.empty.notSelectedTitle)).toBeInTheDocument();
    expect(screen.queryByText('SYN-ERROR')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText(t.warning)).toBeNull();
  });

  it('renders four cards in order with eight labelled controls and material guidance', () => {
    renderPane();
    const pane = screen.getByRole('region', { name: t.pane });
    expect(pane).toHaveClass('work-order-resource-pane');
    expect(pane.querySelector('.work-order-resource-grid')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: t.heading })).toBeInTheDocument();
    const cards = screen.getAllByRole('heading', { level: 3 });
    expect(cards.map((card) => card.textContent)).toEqual([
      t.cards.machine,
      t.cards.man,
      t.cards.tool,
      t.cards.material,
    ]);
    expect(
      cards.every((card) => card.closest('[class*="_card_"]')?.className.includes('_bordered_')),
    ).toBe(true);
    expect(screen.getByRole('combobox', { name: t.fields.productionLine })).toBeInTheDocument();
    /* 담당 작업자·설비·금형은 창에서 고른다 — 선택칸이 아니라 읽기 전용 검색칸이다. */
    for (const field of [t.fields.equipment, t.fields.worker, t.fields.mold]) {
      expect(screen.getByLabelText(field)).toHaveAttribute('readonly');
    }
    expect(screen.getByRole('combobox', { name: t.fields.shift })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.defaultWipLocation })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.defaultFgLocation })).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: t.fields.defaultScrapLocation }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.materialInfo)).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(5);
  });

  it('preserves caller option order and text, owns one clear option, and emits exact patches', async () => {
    const { onChange, user } = renderPane();
    const line = screen.getByRole('combobox', { name: t.fields.productionLine });
    expect(line).toHaveTextContent('SYN-Z-LINE-CURRENT');
    expect(screen.queryByText('101')).toBeNull();
    expect(screen.queryByText('SYN-BLANK-OPTION')).toBeNull();
    await user.click(line);
    expect(screen.queryByRole('option', { name: 'SYN-BLANK-OPTION' })).toBeNull();
    expect(
      screen
        .getAllByRole('option')
        .map((option) => option.querySelector('[class*="_optionLabel_"]')?.textContent),
    ).toEqual([t.clearOption, '  SYN-Z-LINE-CURRENT  ', ' SYN-A-LINE-NEXT ']);
    await user.click(screen.getByRole('option', { name: 'SYN-A-LINE-NEXT' }));
    await user.click(screen.getByRole('combobox', { name: t.fields.shift }));
    await user.click(screen.getByRole('option', { name: 'SYN-SHIFT-NEXT' }));
    await user.click(screen.getByRole('combobox', { name: t.fields.productionLine }));
    await user.click(screen.getByRole('option', { name: t.clearOption }));
    expect(onChange.mock.calls).toEqual([
      [{ productionLineId: '102' }],
      [{ plannedShiftId: '502' }],
      [{ productionLineId: '' }],
    ]);
  });

  it('uses caller error before note and links each visible description', () => {
    renderPane({
      fieldErrors: { productionLineId: 'SYN-ERROR' },
      fieldNotes: { productionLineId: 'SYN-NOTE', plannedMoldId: 'SYN-MOLD-NOTE' },
    });
    const line = screen.getByRole('combobox', { name: t.fields.productionLine });
    const mold = screen.getByLabelText(t.fields.mold);
    expect(screen.getByText('SYN-ERROR')).toBeVisible();
    expect(screen.queryByText('SYN-NOTE')).toBeNull();
    expect(line).toBeInvalid();
    expect(line).toHaveAccessibleDescription('SYN-ERROR');
    expect(screen.getByText('SYN-MOLD-NOTE')).toBeVisible();
    expect(mold).toHaveAccessibleDescription('SYN-MOLD-NOTE');
  });

  it('shows the single-assignment warning and renders an empty draft as the explicit clear value', () => {
    renderPane();
    expect(screen.getByText(t.warning)).toBeVisible();
    expect(screen.getByRole('combobox', { name: t.fields.shift })).toHaveTextContent(t.clearOption);
  });

  it('locks every resource control with the caller reason', () => {
    renderPane({ disabled: true, disabledReason: 'SYN-SAVE-LOCK' });

    for (const control of [
      ...screen.getAllByRole('combobox'),
      screen.getByLabelText(t.fields.equipment),
      screen.getByLabelText(t.fields.mold),
    ]) {
      expect(control).toBeDisabled();
      expect(control).toHaveAccessibleDescription('SYN-SAVE-LOCK');
    }
    /* 작업자 칸은 선택칸이 아니라 검색칸이다 — 잠기면 창이 열리지 않는다. */
    expect(screen.getByLabelText(t.fields.worker)).toBeDisabled();
    expect(screen.getAllByText('SYN-SAVE-LOCK')).toHaveLength(7);
  });

  it('설비·금형 칸은 받은 선택지에서 배정된 것의 이름을 보인다', () => {
    renderPane();

    expect(screen.getByLabelText(t.fields.equipment)).toHaveValue('SYN-EQUIPMENT-CURRENT');
    expect(screen.getByLabelText(t.fields.mold)).toHaveValue('SYN-MOLD-CURRENT');
  });

  it('지우기 단추는 그 칸만 비운다', async () => {
    const { onChange, user } = renderPane({ plantId: 9001 });

    await user.click(screen.getByRole('button', { name: picker.clear.equipment }));
    await user.click(screen.getByRole('button', { name: picker.clear.mold }));

    expect(onChange.mock.calls).toEqual([[{ plannedEquipmentId: '' }], [{ plannedMoldId: '' }]]);
  });
});

describe('WorkOrderResourcePane — 설비·금형 찾기 창', () => {
  const searches: URL[] = [];

  const renderWithPicker = () => {
    searches.length = 0;
    const onChange = vi.fn();
    const respond = (request: Request) => {
      const url = new URL(request.url);
      searches.push(url);
      const items =
        url.pathname === '/mdm/equipments'
          ? [
              {
                equipmentId: 303,
                plantId: 9001,
                equipmentCode: 'SYN-EQ-LINED',
                equipmentName: '라인 설비',
                productionLineId: 102,
                isActive: true,
              },
              {
                equipmentId: 304,
                plantId: 9001,
                equipmentCode: 'SYN-EQ-FREE',
                equipmentName: '라인 없는 설비',
                productionLineId: null,
                isActive: true,
              },
            ]
          : [
              {
                moldId: 403,
                plantId: 9001,
                moldCode: 'SYN-MOLD-FAR',
                moldName: '받지 않은 금형',
                isActive: true,
              },
            ];
      return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
    };

    renderWithProviders(
      <WorkOrderResourcePane
        selectedWorkOrderNo="SYN-WO-ALPHA"
        draft={draft()}
        plantId={9001}
        productionLineOptions={options}
        plannedEquipmentOptions={[{ value: '301', label: 'SYN-EQUIPMENT-CURRENT' }]}
        responsibleWorkerOptions={[{ value: '201', label: 'SYN-WORKER-CURRENT' }]}
        plannedMoldOptions={[{ value: '401', label: 'SYN-MOLD-CURRENT' }]}
        plannedShiftOptions={[]}
        defaultWipLocationOptions={[]}
        defaultFgLocationOptions={[]}
        defaultScrapLocationOptions={[]}
        fieldErrors={{}}
        fieldNotes={{}}
        onChange={onChange}
      />,
      {
        fetch: createStubFetch([
          {
            match: (request) =>
              ['/mdm/equipments', '/mdm/molds'].includes(new URL(request.url).pathname),
            respond,
          },
        ]),
        route: '/',
      },
    );

    return { onChange, user: userEvent.setup() };
  };

  const pick = async (
    user: ReturnType<typeof userEvent.setup>,
    field: string,
    title: string,
    code: string,
  ): Promise<void> => {
    await user.click(screen.getByLabelText(field));
    const dialog = within(screen.getByRole('dialog', { name: title }));
    await user.click(await dialog.findByRole('checkbox', { name: code }));
    await user.click(dialog.getByRole('button', { name: picker.pick }));
  };

  /* 설비 목록은 라인으로 걸러 왔다 — 고른 설비의 라인이 칸의 라인과 어긋나지 않게 함께 바꾼다. */
  it('라인이 있는 설비를 고르면 그 라인과 함께 배정하고, 지금 라인으로 좁혀 찾는다', async () => {
    const { onChange, user } = renderWithPicker();

    await pick(user, t.fields.equipment, picker.title.equipment, 'SYN-EQ-LINED');

    expect(searches[0]?.pathname).toBe('/mdm/equipments');
    expect(searches[0]?.searchParams.get('productionLineId')).toBe('101');
    expect(onChange).toHaveBeenLastCalledWith({
      productionLineId: '102',
      plannedEquipmentId: '303',
    });
  });

  /* 받아 둔 목록 밖 값은 부모가 이름을 풀기 전까지 「알 수 없음」 자리표시로 채워 넘긴다. */
  it('목록 밖 금형을 고르면 자리표시보다 방금 고른 이름을 바로 보인다', async () => {
    const Harness = () => {
      const [current, setCurrent] = useState(draft());
      return (
        <WorkOrderResourcePane
          selectedWorkOrderNo="SYN-WO-ALPHA"
          draft={current}
          plantId={9001}
          productionLineOptions={options}
          plannedEquipmentOptions={[]}
          responsibleWorkerOptions={[]}
          plannedMoldOptions={[
            { value: '401', label: 'SYN-MOLD-CURRENT' },
            ...(current.plannedMoldId === '403' ? [{ value: '403', label: 'SYN-UNKNOWN' }] : []),
          ]}
          plannedShiftOptions={[]}
          defaultWipLocationOptions={[]}
          defaultFgLocationOptions={[]}
          defaultScrapLocationOptions={[]}
          fieldErrors={{}}
          fieldNotes={{}}
          onChange={(patch) => setCurrent((prev) => ({ ...prev, ...patch }))}
        />
      );
    };
    renderWithProviders(<Harness />, {
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === '/mdm/molds',
          respond: () =>
            jsonResponse({
              items: [
                {
                  moldId: 403,
                  plantId: 9001,
                  moldCode: 'SYN-MOLD-FAR',
                  moldName: '받지 않은 금형',
                  isActive: true,
                },
              ],
              page: { page: 1, size: 20, total: 1 },
            }),
        },
      ]),
      route: '/',
    });
    const user = userEvent.setup();

    await pick(user, t.fields.mold, picker.title.mold, 'SYN-MOLD-FAR');

    expect(screen.getByLabelText(t.fields.mold)).toHaveValue('SYN-MOLD-FAR · 받지 않은 금형');
  });

  it('라인이 없는 설비는 설비만 바꾼다', async () => {
    const { onChange, user } = renderWithPicker();

    await pick(user, t.fields.equipment, picker.title.equipment, 'SYN-EQ-FREE');

    expect(onChange).toHaveBeenLastCalledWith({ plannedEquipmentId: '304' });
  });

  it('금형을 고르면 금형만 바꾸고, 라인으로 좁히지 않는다', async () => {
    const { onChange, user } = renderWithPicker();

    await pick(user, t.fields.mold, picker.title.mold, 'SYN-MOLD-FAR');

    expect(searches[0]?.pathname).toBe('/mdm/molds');
    expect(searches[0]?.searchParams.has('productionLineId')).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith({ plannedMoldId: '403' });
  });
});
