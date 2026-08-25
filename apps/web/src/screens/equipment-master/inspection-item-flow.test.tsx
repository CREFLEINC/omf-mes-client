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
  codeValuesResponse,
  cycleCodeValues,
  groupsResponse,
  inspectionItems,
  inspectionItemsResponse,
  inspectionTypeCodeValues,
  judgmentMethodCodeValues,
  makeInspectionItem,
  plantsResponse,
  processesResponse,
  statusCodeValues,
  uomsResponse,
} from './fixtures';
import { EquipmentMasterScreen } from './screen';
import type { EquipmentInspectionItem } from './types';

const t = messages.equipmentMaster;
const ti = t.inspectionItem;

const isPath = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

const codeValuesFor = (codeGroupCode: string | null) => {
  if (codeGroupCode === 'CYCLE_TYPE') return cycleCodeValues;
  if (codeGroupCode === 'EQUIPMENT_INSPECTION_TYPE') return inspectionTypeCodeValues;
  if (codeGroupCode === 'EQUIPMENT_INSPECTION_JUDGMENT_METHOD') return judgmentMethodCodeValues;

  return statusCodeValues;
};

const DETAIL_PATH = '/mdm/equipment-inspection-items/4001';

interface Options {
  items?: EquipmentInspectionItem[];
  writes?: Request[];
  sent?: URL[];
  /** 상세 응답의 코드 편집 가부 */
  codeEditable?: boolean;
  assignmentCount?: number;
  listFail?: boolean;
}

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => request.method === 'GET' && isPath(request, DETAIL_PATH),
    respond: () =>
      jsonResponse(
        {
          equipmentInspectionItem: inspectionItems[0],
          editability: {
            codeEditable: options.codeEditable ?? true,
            reason: options.codeEditable === false ? 'REFERENCED' : 'EDITABLE',
            referenceCount: options.assignmentCount ?? 0,
          },
          assignmentCount: options.assignmentCount ?? 0,
        },
        { headers: { ETag: 'W/"41"' } },
      ),
  },
  {
    match: (request) => request.method === 'PUT' && isPath(request, DETAIL_PATH),
    respond: (request) => {
      options.writes?.push(request.clone());
      return jsonResponse(inspectionItems[0]);
    },
  },
  {
    match: (request) =>
      request.method === 'POST' && isPath(request, '/mdm/equipment-inspection-items'),
    respond: (request) => {
      options.writes?.push(request.clone());
      return jsonResponse(inspectionItems[0], { status: 201 });
    },
  },
  {
    match: (request) =>
      request.method === 'GET' && isPath(request, '/mdm/equipment-inspection-items'),
    respond: (request) => {
      options.sent?.push(new URL(request.url));

      return options.listFail === true
        ? jsonResponse({ errors: [] }, { status: 500 })
        : jsonResponse(inspectionItemsResponse(options.items ?? inspectionItems));
    },
  },
  {
    match: (request) => isPath(request, '/mdm/equipment-groups'),
    respond: () => jsonResponse(groupsResponse()),
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
    match: (request) => isPath(request, '/mdm/uoms'),
    respond: () => jsonResponse(uomsResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/code-values'),
    respond: (request) =>
      jsonResponse(
        codeValuesResponse(codeValuesFor(new URL(request.url).searchParams.get('codeGroupCode'))),
      ),
  },
];

const renderAt = (options: Options = {}, route = '/?view=inspection-items') =>
  renderWithProviders(<EquipmentMasterScreen />, {
    route,
    fetch: createStubFetch(routes(options)),
  });

const pane = async (): Promise<HTMLElement> => screen.findByRole('region', { name: ti.paneTitle });
const dialog = (): HTMLElement => screen.getByRole('dialog');

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.clone().json()) as Record<string, unknown>;

const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
  option: string | RegExp,
): Promise<void> => {
  await user.click(within(dialog()).getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('W-05-12 점검 항목 마스터 — 목록', () => {
  it('화면 수준 탭으로 갈린다', async () => {
    renderAt();

    expect(await screen.findByRole('tab', { name: ti.tabLabel })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: t.views.assets })).toBeInTheDocument();
  });

  /** ⛔ 머리의 동작은 보고 있는 뷰의 것이다 — 누르면 뷰가 바뀌어 사용자가 길을 잃는다. */
  it('점검 항목 뷰에서는 「그룹 추가」가 서지 않는다', async () => {
    renderAt();

    await pane();

    expect(screen.queryByRole('button', { name: t.actions.addGroup })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: ti.addAction })).toBeInTheDocument();
  });

  it('마스터 목록이 선다', async () => {
    renderAt();

    expect(await within(await pane()).findByText('벨트 장력')).toBeInTheDocument();
  });

  /** ⛔ 이름을 모르는 코드는 지어내지 않고 그대로 쓴다(G-9). */
  it('점검 유형 이름을 모르면 코드를 그대로 쓴다', async () => {
    renderAt({
      items: [makeInspectionItem(4009, 'INS-09', '미지 유형', { inspectionTypeCode: 'WEEKLY' })],
    });

    expect(await within(await pane()).findByText('WEEKLY')).toBeInTheDocument();
  });

  /**
   * ⭐ **부여 창이 쓰는 목록과 다르다** — 그쪽은 「고를 것」이라 살아 있는 것만 받지만
   * 여기는 마스터라 **끈 것도 보여야 한다**. 다시 켜는 길이 여기뿐이다(B-4).
   */
  it('미사용 포함을 켜면 조건이 나간다', async () => {
    const user = userEvent.setup();
    const sent: URL[] = [];

    renderAt({ sent });
    await within(await pane()).findByText('벨트 장력');
    await user.click(
      within(await pane()).getByRole('checkbox', { name: messages.common.includeInactive }),
    );

    await waitFor(() => {
      expect(sent.some((url) => url.searchParams.get('includeInactive') === 'true')).toBe(true);
    });
  });

  it('조회에 실패하면 배너를 내고 빈 상태를 내지 않는다', async () => {
    renderAt({ listFail: true });

    expect(
      await within(await pane()).findByRole('button', { name: messages.common.retry }),
    ).toBeInTheDocument();
    expect(within(await pane()).queryByText(ti.emptyTitle)).not.toBeInTheDocument();
  });

  /** ⛔ 보이지 않는 목록을 미리 부르지 않는다 — 자산 뷰에서는 이 조회가 없다. */
  it('자산 뷰에서는 마스터를 조회하지 않는다', async () => {
    const sent: URL[] = [];

    renderAt({ sent }, '/');

    await screen.findByRole('tab', { name: ti.tabLabel });
    expect(sent).toHaveLength(0);
  });
});

describe('W-05-12 점검 항목 마스터 — 만든다', () => {
  const openCreate = async (
    user: ReturnType<typeof userEvent.setup>,
    options: Options = {},
  ): Promise<void> => {
    renderAt(options);
    await within(await pane()).findByText('벨트 장력');
    await user.click(within(await pane()).getByRole('button', { name: ti.addAction }));
  };

  it('등록 창이 열린다', async () => {
    const user = userEvent.setup();

    await openCreate(user);

    expect(within(dialog()).getByText(ti.createTitle)).toBeInTheDocument();
  });

  /**
   * ⛔ **짝 제약을 창이 건다**(계약 · 설계 회신 `omf-mes#186`) — 걸지 않으면 등록이
   * **반드시 실패하는 경로**가 된다.
   */
  it('측정값 판정이면 단위·상하한을 함께 묻는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    await openCreate(user, { writes });

    await user.type(within(dialog()).getByRole('textbox', { name: /항목코드/ }), 'INS-09');
    await user.type(within(dialog()).getByRole('textbox', { name: /항목명/ }), '체결 토크');
    await user.type(within(dialog()).getByRole('textbox', { name: /표시 순서/ }), '3');
    await pick(user, /공장/, /제1공장/);
    await pick(user, /점검 유형/, '일상');
    await pick(user, /판정 방식/, '측정값');
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    expect(await within(dialog()).findAllByText(ti.validation.required)).toHaveLength(3);
    expect(writes).toHaveLength(0);
  });

  /** ⭐ 감추지 않고 잠근다(G-2) — 감추면 판정 방식을 바꿀 때 칸이 튀어나와 창이 흔들린다. */
  it('육안 판정이면 측정 세 칸이 잠긴다', async () => {
    const user = userEvent.setup();

    await openCreate(user);
    await pick(user, /판정 방식/, '육안');

    expect(within(dialog()).getByRole('textbox', { name: /측정 하한/ })).toBeDisabled();
    expect(within(dialog()).getByRole('textbox', { name: /측정 상한/ })).toBeDisabled();
    expect(within(dialog()).getByRole('combobox', { name: /측정 단위/ })).toBeDisabled();
  });

  it('다 채우면 등록이 나간다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    await openCreate(user, { writes });

    await user.type(within(dialog()).getByRole('textbox', { name: /항목코드/ }), 'INS-09');
    await user.type(within(dialog()).getByRole('textbox', { name: /항목명/ }), '체결 토크');
    await user.type(within(dialog()).getByRole('textbox', { name: /표시 순서/ }), '3');
    await pick(user, /공장/, /제1공장/);
    await pick(user, /점검 유형/, '일상');
    await pick(user, /판정 방식/, '육안');
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(writes[0] as Request);

    expect(body).toMatchObject({
      itemCode: 'INS-09',
      itemName: '체결 토크',
      judgmentMethodCode: 'VISUAL',
      sequenceNo: 3,
      /* 육안이면 측정 세 칸을 비워 보낸다. */
      uomId: null,
      lowerLimit: null,
      upperLimit: null,
    });
  });

  /** ⛔ 등록에는 낙관적 잠금이 없다 — 계약이 If-Match 를 요구하지 않는다. */
  it('등록에는 잠금 토큰을 싣지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    await openCreate(user, { writes });

    await user.type(within(dialog()).getByRole('textbox', { name: /항목코드/ }), 'INS-09');
    await user.type(within(dialog()).getByRole('textbox', { name: /항목명/ }), '체결 토크');
    await user.type(within(dialog()).getByRole('textbox', { name: /표시 순서/ }), '3');
    await pick(user, /공장/, /제1공장/);
    await pick(user, /점검 유형/, '일상');
    await pick(user, /판정 방식/, '육안');
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((writes[0] as Request).headers.get('If-Match')).toBeNull();
  });
});

describe('W-05-12 점검 항목 마스터 — 고친다', () => {
  const openEdit = async (
    user: ReturnType<typeof userEvent.setup>,
    options: Options = {},
  ): Promise<void> => {
    renderAt(options);
    await user.click(
      await within(await pane()).findByRole('button', {
        name: ti.openLabel('INS-01', '벨트 장력'),
      }),
    );
  };

  it('수정 창이 지금 값으로 열린다', async () => {
    const user = userEvent.setup();

    await openEdit(user);

    expect(within(dialog()).getByRole('textbox', { name: /항목명/ })).toHaveValue('벨트 장력');
  });

  /** ⭐ 수정 가부를 화면이 세지 않는다 — 상세 응답이 가부와 사유를 함께 준다(B-4). */
  it('코드가 잠겨 있으면 그 사유를 보인다', async () => {
    const user = userEvent.setup();

    await openEdit(user, { codeEditable: false, assignmentCount: 3 });

    await waitFor(() => {
      expect(within(dialog()).getByRole('textbox', { name: /항목코드/ })).toBeDisabled();
    });
  });

  /** ⭐ 무엇에 걸려 있는지 말한다 — 코드를 못 고치는 사유와 같은 사실의 다른 면이다. */
  it('부여된 곳의 수를 말한다', async () => {
    const user = userEvent.setup();

    await openEdit(user, { assignmentCount: 3 });

    expect(await within(dialog()).findByText(ti.assignmentCount(3))).toBeInTheDocument();
  });

  it('아직 부여되지 않았으면 그렇게 말한다', async () => {
    const user = userEvent.setup();

    await openEdit(user, { assignmentCount: 0 });

    expect(await within(dialog()).findByText(ti.assignmentCount(0))).toBeInTheDocument();
  });

  /**
   * ⛔ **걸려 있는 단위가 목록에 없어도 칸이 비어 보이면 안 된다.** 사용 중지된 단위나 잘린
   * 목록이면 실제로 그렇게 되고, 사용자는 **지워진 줄 알고 다시 고른다** — 원래 값이 조용히
   * 바뀐다(형제 화면이 브라우저 확인에서 겪은 자리다).
   */
  it('걸려 있는 단위가 목록에 없어도 칸이 비지 않는다', async () => {
    const user = userEvent.setup();

    renderAt({
      items: [
        makeInspectionItem(4001, 'INS-01', '벨트 장력', {
          judgmentMethodCode: 'MEASUREMENT',
          /* 목록(3·4)에 없는 단위 — 사용 중지됐거나 목록이 잘린 사태다. */
          uomId: 99,
          lowerLimit: 1,
          upperLimit: 2,
        }),
      ],
    });
    await user.click(
      await within(await pane()).findByRole('button', {
        name: ti.openLabel('INS-01', '벨트 장력'),
      }),
    );

    expect(within(dialog()).getByRole('combobox', { name: /측정 단위/ })).toHaveTextContent('99');
  });

  /** ⛔ 공장은 옮길 수 없다 — 계약의 수정 본문이 받지 않는다. */
  it('수정에서는 공장을 잠근다', async () => {
    const user = userEvent.setup();

    await openEdit(user);

    expect(within(dialog()).getByRole('combobox', { name: /공장/ })).toBeDisabled();
  });

  it('상세의 잠금 토큰을 싣는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    await openEdit(user, { writes });

    await waitFor(() => {
      expect(within(dialog()).getByRole('button', { name: messages.common.save })).toBeEnabled();
    });
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((writes[0] as Request).headers.get('If-Match')).toBe('W/"41"');
  });

  /** ⛔ 물리 삭제가 없다(B-4) — 사용 여부로 끈다. */
  it('사용을 끄면 그 값이 실려 나간다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    await openEdit(user, { writes });

    await waitFor(() => {
      expect(within(dialog()).getByRole('button', { name: messages.common.save })).toBeEnabled();
    });
    await user.click(within(dialog()).getByRole('switch', { name: /사용/ }));
    await user.click(within(dialog()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((await bodyOf(writes[0] as Request)).isActive).toBe(false);
  });
});
