import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  assignmentsResponse,
  codeValuesResponse,
  cycleCodeValues,
  groupById,
  groupDetail,
  groupsResponse,
  inspectionItems,
  inspectionItemsResponse,
  inspectionTypeCodeValues,
  makeAssignment,
  plantsResponse,
  processesResponse,
  statusCodeValues,
  equipmentsResponse,
} from './fixtures';
import { EquipmentMasterScreen } from './screen';
import type { InspectionItemAssignment } from './types';

const t = messages.equipmentMaster;
const ti = t.inspection;

const isPath = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

const idOf = (request: Request): number => Number(new URL(request.url).pathname.split('/').at(-1));

/** 세 그룹이 한 경로를 쓴다 — 요청한 그룹에 맞는 코드값을 준다. */
const codeValuesFor = (codeGroupCode: string | null) => {
  if (codeGroupCode === 'CYCLE_TYPE') return cycleCodeValues;

  return codeGroupCode === 'EQUIPMENT_INSPECTION_TYPE'
    ? inspectionTypeCodeValues
    : statusCodeValues;
};

const GROUP_INSPECTION_PATH = '/mdm/equipment-groups/101/inspection-items';

interface Options {
  assignments?: InspectionItemAssignment[];
  writes?: Request[];
  /** 부여 조회를 실패시킨다 */
  assignmentsFail?: boolean;
  /** 마스터 목록 조회를 실패시킨다 */
  masterFail?: boolean;
  /** 저장 응답 상태. 200 이 아니면 본문을 오류로 낸다 */
  writeStatus?: number;
  writeBody?: unknown;
}

const routes = (options: Options): StubRoute[] => [
  /*
   * ⚠ **부여가 그룹 상세보다 앞선다.** 그룹 경로 아래 있어, 접두사만 보는 스텁이 먼저 서면
   * 부여 조회가 그룹 상세 모양을 받아 감지기가 헛통과한다.
   */
  {
    match: (request) => request.method === 'GET' && isPath(request, GROUP_INSPECTION_PATH),
    respond: () =>
      options.assignmentsFail === true
        ? jsonResponse({ errors: [] }, { status: 500 })
        : jsonResponse(assignmentsResponse(options.assignments ?? []), {
            headers: { ETag: 'W/"31"' },
          }),
  },
  {
    match: (request) => request.method === 'PUT' && isPath(request, GROUP_INSPECTION_PATH),
    respond: (request) => {
      options.writes?.push(request.clone());

      return options.writeStatus === undefined
        ? jsonResponse(assignmentsResponse(options.assignments ?? []))
        : jsonResponse(options.writeBody ?? { errors: [] }, { status: options.writeStatus });
    },
  },
  {
    match: (request) => isPath(request, '/mdm/equipment-inspection-items'),
    respond: () =>
      options.masterFail === true
        ? jsonResponse({ errors: [] }, { status: 500 })
        : jsonResponse(inspectionItemsResponse()),
  },
  {
    match: (request) => request.method === 'GET' && isPath(request, '/mdm/equipment-groups'),
    respond: () => jsonResponse(groupsResponse()),
  },
  {
    match: (request) =>
      request.method === 'GET' &&
      new URL(request.url).pathname.startsWith('/mdm/equipment-groups/'),
    respond: (request) => {
      const found = groupById(idOf(request));

      return found === undefined
        ? jsonResponse({ message: '없는 그룹' }, { status: 404 })
        : jsonResponse(groupDetail(found), { headers: { ETag: '7' } });
    },
  },
  {
    match: (request) => isPath(request, '/mdm/equipments'),
    respond: () => jsonResponse(equipmentsResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/plants'),
    respond: () => jsonResponse(plantsResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/processes'),
    respond: () => jsonResponse(processesResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/code-values'),
    respond: (request) =>
      jsonResponse(
        codeValuesResponse(codeValuesFor(new URL(request.url).searchParams.get('codeGroupCode'))),
      ),
  },
];

const renderAt = (options: Options = {}) =>
  renderWithProviders(<EquipmentMasterScreen />, {
    route: '/?grp=101&tab=inspection',
    fetch: createStubFetch(routes(options)),
  });

const pane = async (): Promise<HTMLElement> => screen.findByRole('region', { name: ti.paneTitle });
const dialog = (): HTMLElement => screen.getByRole('dialog');

const openDialog = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const editButton = await within(await pane()).findByRole('button', { name: ti.editAction });

  await waitFor(() => expect(editButton).toBeEnabled());
  await user.click(editButton);
};

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.clone().json()) as Record<string, unknown>;

describe('W-05-12 점검 항목 — 부여를 보인다', () => {
  it('탭으로 들어가면 부여된 항목이 선다', async () => {
    renderAt({ assignments: [makeAssignment(inspectionItems[0] as never)] });

    expect(await within(await pane()).findByText('벨트 장력')).toBeInTheDocument();
  });

  /** ⭐ 마스터가 아니라 «부여»를 보인다 — 주기가 그 증거다(공유계약 B-6). */
  it('주기를 사람이 읽는 말로 적는다', async () => {
    renderAt({
      assignments: [
        makeAssignment(inspectionItems[0] as never, { cycleTypeCode: 'DAY', cycleInterval: 3 }),
      ],
    });

    expect(await within(await pane()).findByText(ti.cycleText(3, '일'))).toBeInTheDocument();
  });

  /** ⛔ 이름을 모르는 코드는 지어내지 않고 그대로 쓴다(G-9) — 시드가 아직 없을 수 있다. */
  it('주기 단위 이름을 모르면 코드를 그대로 쓴다', async () => {
    renderAt({
      assignments: [
        makeAssignment(inspectionItems[0] as never, { cycleTypeCode: 'DECADE', cycleInterval: 1 }),
      ],
    });

    expect(await within(await pane()).findByText(ti.cycleText(1, 'DECADE'))).toBeInTheDocument();
  });

  it('부여가 없으면 빈 상태를 말한다', async () => {
    renderAt({ assignments: [] });

    expect(await within(await pane()).findByText(ti.emptyTitle)).toBeInTheDocument();
  });

  /** ⛔ 조회하지 못한 채로 고치면 «보이지 않는 줄»을 지우게 된다 — 묶음 통째 교체라서다. */
  it('부여를 받지 못하면 고칠 자리를 잠근다', async () => {
    renderAt({ assignmentsFail: true });

    const editButton = await within(await pane()).findByRole('button', { name: ti.editAction });

    await waitFor(() => {
      expect(editButton).toBeDisabled();
    });
  });
});

describe('W-05-12 점검 항목 — 부여를 고친다', () => {
  it('창은 지금 부여된 전부를 담아 연다', async () => {
    const user = userEvent.setup();

    renderAt({
      assignments: [
        makeAssignment(inspectionItems[0] as never),
        makeAssignment(inspectionItems[1] as never),
      ],
    });
    await openDialog(user);

    expect(within(dialog()).getByText(/벨트 장력/)).toBeInTheDocument();
    expect(within(dialog()).getByText(/오일 레벨/)).toBeInTheDocument();
  });

  /** ⛔ 묶음 통째 교체라는 사실을 감추지 않는다 — 지운 줄이 지워진다는 뜻이다. */
  it('창이 묶음 통째 교체임을 말한다', async () => {
    const user = userEvent.setup();

    renderAt({ assignments: [makeAssignment(inspectionItems[0] as never)] });
    await openDialog(user);

    expect(within(dialog()).getByText(ti.dialogLead)).toBeInTheDocument();
  });

  it('고치지 않고 저장하면 지금 부여가 그대로 나간다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderAt({ assignments: [makeAssignment(inspectionItems[0] as never)], writes });
    await openDialog(user);
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(writes[0] as Request);

    expect(body.items).toEqual([
      {
        equipmentInspectionItemId: 4001,
        cycleTypeCode: 'DAY',
        cycleInterval: 3,
        cycleBaseDate: null,
        isActive: true,
      },
    ]);
  });

  /** ⭐ 부여의 잠금 토큰은 «부여» 경로의 것이다 — 그룹 상세의 토큰이 아니다. */
  it('부여 경로의 잠금 토큰을 싣는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderAt({ assignments: [makeAssignment(inspectionItems[0] as never)], writes });
    await openDialog(user);
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((writes[0] as Request).headers.get('If-Match')).toBe('W/"31"');
  });

  it('부여를 해제하면 그 줄이 빠진 채 나간다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderAt({
      assignments: [
        makeAssignment(inspectionItems[0] as never),
        makeAssignment(inspectionItems[1] as never),
      ],
      writes,
    });
    await openDialog(user);
    await user.click(within(dialog()).getByRole('button', { name: ti.removeLabel('벨트 장력') }));
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = (await bodyOf(writes[0] as Request)).items as {
      equipmentInspectionItemId: number;
    }[];

    expect(body.map((item) => item.equipmentInspectionItemId)).toEqual([4002]);
  });

  /** ⛔ 이미 부여한 항목을 다시 고를 수 없다 — 뒤엣것이 앞엣것의 주기를 덮는다. */
  it('이미 부여한 항목은 고를 목록에 없다', async () => {
    const user = userEvent.setup();

    renderAt({ assignments: [makeAssignment(inspectionItems[0] as never)] });
    await openDialog(user);
    await user.click(within(dialog()).getByRole('combobox', { name: ti.addLabel }));

    expect(screen.queryByRole('option', { name: /INS-01/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /INS-02/ })).toBeInTheDocument();
  });

  /** ⛔ 새 줄의 주기를 지어내지 않는다 — 정하지 않은 주기가 정한 것처럼 저장된다. */
  it('새로 더한 줄은 주기가 비어 있어 저장을 막는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderAt({ assignments: [], writes });
    await openDialog(user);
    await user.click(within(dialog()).getByRole('combobox', { name: ti.addLabel }));
    await user.click(await screen.findByRole('option', { name: /INS-01/ }));
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    /* 주기 단위·간격 둘 다 비어 있어 두 칸이 함께 운다 — 그것이 이 줄의 상태다. */
    expect(await within(dialog()).findAllByText(ti.validation.required)).toHaveLength(2);
    expect(writes).toHaveLength(0);
  });

  it('주기를 채우면 새 줄이 나간다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderAt({ assignments: [], writes });
    await openDialog(user);
    await user.click(within(dialog()).getByRole('combobox', { name: ti.addLabel }));
    await user.click(await screen.findByRole('option', { name: /INS-01/ }));

    await user.click(within(dialog()).getByRole('combobox', { name: /주기 단위/ }));
    await user.click(await screen.findByRole('option', { name: '주' }));
    await user.type(within(dialog()).getByRole('textbox', { name: /주기 간격/ }), '2');
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(writes[0] as Request);

    expect(body.items).toEqual([
      {
        equipmentInspectionItemId: 4001,
        cycleTypeCode: 'WEEK',
        cycleInterval: 2,
        cycleBaseDate: null,
        isActive: true,
      },
    ]);
  });

  /**
   * ⭐ **고를 것이 없는 것과 못 받은 것은 다르다**(G-9). 셋을 같은 문구로 덮으면 사용자는
   * 무엇을 해야 할지 알 수 없다.
   */
  it('마스터를 받지 못하면 그 사실을 말한다', async () => {
    const user = userEvent.setup();

    renderAt({ assignments: [], masterFail: true });
    await openDialog(user);

    expect(await within(dialog()).findByText(ti.masterLoadFailed)).toBeInTheDocument();
  });

  it('모두 부여했으면 그 사실을 말한다', async () => {
    const user = userEvent.setup();

    renderAt({
      assignments: inspectionItems.map((item) => makeAssignment(item)),
    });
    await openDialog(user);

    expect(await within(dialog()).findByText(ti.allAssigned)).toBeInTheDocument();
  });

  /** ⭐ 「다시 시도」라 말하면 누를 자리가 있어야 한다(G-23). */
  it('저장이 충돌하면 다시 불러올 자리를 준다', async () => {
    const user = userEvent.setup();

    renderAt({
      assignments: [makeAssignment(inspectionItems[0] as never)],
      writes: [],
      writeStatus: 409,
      writeBody: { conflictCause: 'user', message: '다른 사용자가 먼저 고쳤습니다.' },
    });
    await openDialog(user);
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    expect(
      await within(dialog()).findByRole('button', { name: messages.conflict.reloadAction }),
    ).toBeInTheDocument();
  });
});
