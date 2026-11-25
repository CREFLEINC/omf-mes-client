import type { components } from '@omf-mes/api-client';
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
import { SessionProvider } from '../../patterns/session';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { HandoverAlertSettingsScreen } from './screen';

type HandoverAlertRecipient = components['schemas']['HandoverAlertSetting']['recipients'][number];
type HandoverAlertSetting = components['schemas']['HandoverAlertSetting'];

const t = messages.handoverAlertSettings;

/**
 * 인계 종류 10종 — 서버가 주는 차례를 일부러 흔든다. 화면은 업무 흐름 순서로 세워야 한다
 * (확정 2026-10-28, 시안 Main).
 */
const TYPES = [
  ['SHIPMENT_PACKING_REQUESTED', '출하 포장', 'SHIPMENT'],
  ['PUTAWAY_REQUESTED', '적치', 'GOODS_RECEIPT'],
  ['MATERIAL_PICKING_REQUESTED', '자재 출고 피킹', 'PICKING_ORDER'],
  ['STOCK_TRANSFER_ARRIVAL_PENDING', '창고 이동 도착', 'STOCK_TRANSFER'],
  ['SHIPMENT_PICKING_REQUESTED', '제품 출하 피킹', 'SHIPMENT_REQUEST'],
  ['WORK_ORDER_RELEASED', '작업 시작', 'WORK_ORDER'],
  ['EMERGENCY_WORK_ORDER_RELEASED', '긴급 W/O', 'WORK_ORDER'],
  ['OQC_INSPECTION_REQUESTED', 'OQC 출하검사', 'SHIPMENT_REQUEST'],
  ['REWORK_WORK_ORDER_CREATED', '재작업 실적', 'WORK_ORDER'],
  ['IQC_INSPECTION_REQUESTED', 'IQC 수입검사', 'INBOUND_RECEIPT'],
].map(([alertTypeCode, name, targetTypeCode]) => ({
  alertTypeCode: alertTypeCode as string,
  name: name as string,
  nameVi: `${name as string} (vi)`,
  targetTypeCode: targetTypeCode as string,
}));

const FLOW_ORDER = [
  'IQC 수입검사',
  '적치',
  '자재 출고 피킹',
  '창고 이동 도착',
  '작업 시작',
  '긴급 W/O',
  '재작업 실적',
  'OQC 출하검사',
  '제품 출하 피킹',
  '출하 포장',
];

const PLANT_A = { plantId: 8401, businessUnitId: 8301, plantCode: 'G1', plantName: '합성 1공장' };
const PLANT_B = { plantId: 8402, businessUnitId: 8301, plantCode: 'G2', plantName: '합성 2공장' };

const person = (
  userId: number,
  overrides: Partial<HandoverAlertRecipient> = {},
): HandoverAlertRecipient => ({
  userId,
  name: `합성 담당 ${String(userId)}`,
  loginId: `syn.user.${String(userId)}`,
  hasPhone: true,
  active: true,
  departmentName: '합성 창고팀',
  ...overrides,
});

interface SetupOptions {
  route?: string;
  plants?: (typeof PLANT_A)[];
  /** 데이터 범위. 주지 않으면 사업부 전체(두 공장 모두 범위 안) */
  scopes?: { businessUnitId: number; plantId?: number }[];
  settings?: Record<string, Partial<HandoverAlertSetting>>;
  /** 상세 응답의 ETag. `null` 이면 행이 없어 ETag 를 주지 않는다 */
  etag?: string | null;
  respondPut?: (request: Request) => Response;
  candidates?: number[];
  /** 서버가 더한 종류(피처 009 의 적치 대기 등) — 10종 뒤에 붙는다 */
  extraTypes?: typeof TYPES;
  /** 요약 응답의 Zalo 연결 상태. 주지 않으면 싣지 않는다 */
  zaloStatus?: string;
  permissions?: string[];
  /** 이동한 주소를 읽어야 할 때 — 데이터 라우터로 렌더한다 */
  dataRouter?: boolean;
}

const setup = (options: SetupOptions = {}) => {
  const writes: Request[] = [];
  const summaryQueries: URL[] = [];
  const settings: Record<string, HandoverAlertSetting> = {};
  const types = [...TYPES, ...(options.extraTypes ?? [])];
  for (const type of types) {
    settings[type.alertTypeCode] = {
      plantId: PLANT_A.plantId,
      alertTypeCode: type.alertTypeCode,
      enabled: false,
      zaloEnabled: false,
      recipients: [],
      ...options.settings?.[type.alertTypeCode],
    };
  }

  const pathOf = (request: Request) => new URL(request.url).pathname;
  const plants = (options.plants ?? [PLANT_A]).map((plant) => ({
    ...plant,
    legalEntityId: 8201,
    timezoneCode: 'Asia/Ho_Chi_Minh',
    isActive: true,
  }));
  const routes: StubRoute[] = [
    {
      match: (request) => pathOf(request) === '/mdm/plants',
      respond: () =>
        jsonResponse({ items: plants, page: { page: 1, size: 100, total: plants.length } }),
    },
    {
      match: (request) => pathOf(request) === '/app/handover-alert-types',
      respond: () => jsonResponse({ items: types }),
    },
    {
      match: (request) => pathOf(request) === '/app/handover-alert-settings',
      respond: (request) => {
        summaryQueries.push(new URL(request.url));
        return jsonResponse({
          ...(options.zaloStatus === undefined ? {} : { zaloStatus: options.zaloStatus }),
          items: Object.entries(settings).map(([alertTypeCode, setting]) => ({
            alertTypeCode,
            enabled: setting.enabled,
            zaloEnabled: setting.zaloEnabled,
            recipientCount: setting.recipients.length,
            noPhoneCount: setting.recipients.filter((item) => !item.hasPhone).length,
            inactiveCount: setting.recipients.filter((item) => !item.active).length,
          })),
        });
      },
    },
    {
      match: (request) => pathOf(request) === '/app/notification-settings/recipient-candidates',
      respond: () => {
        const items = (options.candidates ?? [61, 62, 63]).map((id) => ({
          appUserId: id,
          loginId: `syn.c${String(id)}`,
          userName: `후보 ${String(id)}`,
          departmentName: '합성 부서',
          hasPhone: true,
        }));
        return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
      },
    },
    {
      match: (request) =>
        request.method === 'GET' && pathOf(request).startsWith('/app/handover-alert-settings/'),
      respond: (request) => {
        const code = decodeURIComponent(pathOf(request).split('/').at(-1) ?? '');
        const etag = options.etag === undefined ? '"3"' : options.etag;
        return jsonResponse(settings[code], etag === null ? {} : { headers: { ETag: etag } });
      },
    },
    {
      match: (request) =>
        request.method === 'PUT' && pathOf(request).startsWith('/app/handover-alert-settings/'),
      respond: (request) => {
        writes.push(request.clone());
        if (options.respondPut !== undefined) return options.respondPut(request);
        const code = decodeURIComponent(pathOf(request).split('/').at(-1) ?? '');
        return jsonResponse(settings[code], { headers: { ETag: '"4"' } });
      },
    },
  ];

  const view = renderWithProviders(
    <SessionProvider>
      <HandoverAlertSettingsScreen />
    </SessionProvider>,
    {
      fetch: createStubFetch(routes),
      route: options.route ?? '/notification/handover-settings',
      dataRouter: options.dataRouter,
      session: {
        ...SYNTHETIC_SESSION,
        scopes: options.scopes ?? [{ businessUnitId: 8301 }],
        permissions: options.permissions ?? ['W-CO-14'],
      },
    },
  );
  return { ...view, writes, summaryQueries };
};

/* 조회 조건 · 목록 · 상세 통일 배치(#358) — 목록 상자 이름은 「인계 작업 목록」. */
const typesPane = () => within(screen.getByRole('region', { name: t.workspace.list }));
const settingPane = (name: string) =>
  within(screen.getByRole('region', { name: t.panes.setting(name) }));

const typeRows = async () =>
  waitFor(() => {
    const found = typesPane().getAllByRole('row').slice(1);
    expect(found).toHaveLength(10);
    return found;
  });

const openType = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('button', { name }));
  const pane = settingPane(name);
  await pane.findByRole('switch', { name: t.fields.enabled });
  return pane;
};

describe('HandoverAlertSettingsScreen — 공장 × 인계 작업', () => {
  it('US2-1 처음에는 10종 모두 알림·Zalo 꺼짐, 수신자 0 이고 업무 흐름 순서로 선다', async () => {
    setup();

    const rows = await typeRows();
    expect(rows.map((row) => within(row).getByRole('button').textContent)).toEqual(FLOW_ORDER);
    for (const row of rows) {
      expect(within(row).getAllByText(t.values.off)).toHaveLength(2);
      expect(within(row).getByText(t.values.recipientCount(0))).toBeInTheDocument();
    }
    /* 첫 행이 열리고 URL 이 그 자리를 든다. */
    expect(within(rows[0] as HTMLElement).getByRole('button')).toHaveAttribute(
      'aria-current',
      'true',
    );
    const pane = settingPane('IQC 수입검사');
    expect(await pane.findByRole('switch', { name: t.fields.enabled })).not.toBeChecked();
    expect(pane.getByText(t.fields.recipients(0))).toBeInTheDocument();
    expect(pane.getByText(t.fields.recipientMax(5))).toBeInTheDocument();
  });

  it('요금 · 일일 한도 안내는 Zalo 발송 옆 ⓘ 에, 「언제」·「처리」 안내는 제목 아래에 보인다', async () => {
    const user = userEvent.setup();
    setup();

    const pane = await openType(user, '자재 출고 피킹');
    expect(
      pane.getByRole('button', { name: `${t.state.zaloQuota} ${t.state.zaloHelp}` }),
    ).toBeInTheDocument();
    /* 스위치 아래 문장은 걷었다. */
    expect(pane.queryByText(t.state.zaloQuota)).toBeNull();
    expect(pane.getByText(t.types.MATERIAL_PICKING_REQUESTED.when)).toBeInTheDocument();
    expect(pane.getByText(t.types.MATERIAL_PICKING_REQUESTED.where)).toBeInTheDocument();
  });

  it('Zalo 미연결이면 Zalo 발송 옆 「미연결」 칩과 한 줄 안내 + 「Zalo 연결 설정」 글 링크를 두고, 누르면 알림 연결 설정에 간다', async () => {
    const user = userEvent.setup();
    const { router } = setup({
      zaloStatus: 'NOT_CONFIGURED',
      permissions: ['W-CO-14', 'W-CO-12'],
      dataRouter: true,
    });

    const pane = within(
      await screen.findByRole('region', { name: t.panes.setting('IQC 수입검사') }),
    );
    expect(await pane.findByText(t.state.zaloNotActive)).toBeInTheDocument();
    expect(pane.getByText(t.values.notConnected)).toBeInTheDocument();
    /* 종전 긴 노란 줄 · 테두리 단추는 걷었다. 스위치는 미연결이어도 켤 수 있다(서버가 막지 않는다). */
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByRole('button', { name: t.actions.openConnection })).toBeNull();
    const link = pane.getByRole('link', { name: t.actions.openConnection });
    expect(link.closest('p')).toHaveTextContent(t.state.zaloNotActive);
    await user.click(link);
    await waitFor(() =>
      expect(router?.state.location.pathname).toBe('/notification/zalo-connection'),
    );
  });

  it('Zalo 가 연결돼 있으면 미연결 안내와 이동 단추가 없다', async () => {
    setup({ zaloStatus: 'ACTIVE', permissions: ['W-CO-14', 'W-CO-12'] });

    const pane = within(
      await screen.findByRole('region', { name: t.panes.setting('IQC 수입검사') }),
    );
    expect(await pane.findByRole('switch', { name: t.fields.zalo })).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText(t.state.zaloNotActive, { exact: false })).toBeNull();
    expect(screen.queryByText(t.values.notConnected)).toBeNull();
    expect(screen.queryByRole('link', { name: t.actions.openConnection })).toBeNull();
  });

  /* 피처 009(omf-all-around#294) — 「적치 대기」 새 유형과 바뀐 「검사 불합격」 처리 안내. */
  it('FR-034 「적치 대기」(PUTAWAY_PENDING)도 「언제」·「처리」 안내가 선다', async () => {
    const user = userEvent.setup();
    setup({
      extraTypes: [
        {
          alertTypeCode: 'PUTAWAY_PENDING',
          name: '적치 대기',
          nameVi: 'Chờ xếp kho',
          targetTypeCode: 'INBOUND_LOT',
        },
      ],
    });

    /* 11종이면 둘째 쪽으로 넘어간다 — 작업 이름 검색으로 거른다(화면 안 거르기 · #358). */
    const search = await screen.findByRole('searchbox', { name: t.workspace.search });
    /* 초기화는 검색어가 처음 값(빈칸)과 다를 때만 보인다. */
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
    await user.type(search, '적치 대기');
    expect(screen.getByRole('button', { name: t.workspace.clear })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.workspace.apply }));
    await waitFor(() => expect(typesPane().getAllByRole('row')).toHaveLength(2));
    const pane = await openType(user, '적치 대기');
    expect(pane.getByText(t.types.PUTAWAY_PENDING.when)).toBeInTheDocument();
    expect(pane.getByText(t.types.PUTAWAY_PENDING.where)).toBeInTheDocument();
  });

  it('FR-003 「검사 불합격」 처리 안내는 관리웹 입고 처리가 아니라 PDA 적치다', async () => {
    const user = userEvent.setup();
    setup({
      extraTypes: [
        {
          alertTypeCode: 'IQC_INSPECTION_REJECTED',
          name: '검사 불합격',
          nameVi: 'IQC NG',
          targetTypeCode: 'LOT',
        },
      ],
    });

    const pane = await openType(user, '검사 불합격');
    expect(pane.getByText(t.types.IQC_INSPECTION_REJECTED.where)).toBeInTheDocument();
    expect(t.types.IQC_INSPECTION_REJECTED.where).not.toContain('입고 처리');
    expect(t.types.IQC_INSPECTION_REJECTED.where).toContain('PDA');
  });

  it('US2-6 고를 공장이 하나면 공장 칸이 없고 그 공장 설정을 연다', async () => {
    const { summaryQueries } = setup({
      plants: [PLANT_A, PLANT_B],
      scopes: [{ businessUnitId: 8301, plantId: PLANT_B.plantId }],
    });

    await typeRows();
    expect(screen.queryByRole('combobox', { name: t.fields.plant })).toBeNull();
    expect(summaryQueries.at(-1)?.searchParams.get('plantId')).toBe(String(PLANT_B.plantId));
  });

  it('공장이 여럿이면 공장 칸을 보이고 바꾸면 그 공장 요약을 부른다', async () => {
    const user = userEvent.setup();
    const { summaryQueries } = setup({ plants: [PLANT_A, PLANT_B] });

    await typeRows();
    await user.click(screen.getByRole('combobox', { name: t.fields.plant }));
    await user.click(await screen.findByRole('option', { name: 'G2 합성 2공장' }));

    await waitFor(() => {
      expect(summaryQueries.at(-1)?.searchParams.get('plantId')).toBe(String(PLANT_B.plantId));
    });
  });

  it('초기화는 공장이 처음 값(첫 공장)과 다를 때 보이고, 누르면 첫 공장 · 빈 검색어로 돌아가 다시 조회한다', async () => {
    const user = userEvent.setup();
    const { summaryQueries } = setup({ plants: [PLANT_A, PLANT_B] });

    await typeRows();
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
    await user.click(screen.getByRole('combobox', { name: t.fields.plant }));
    await user.click(await screen.findByRole('option', { name: 'G2 합성 2공장' }));
    await user.type(screen.getByRole('searchbox', { name: t.workspace.search }), '자재 출고');
    await user.click(screen.getByRole('button', { name: t.workspace.apply }));
    await waitFor(() => expect(typesPane().getAllByRole('row')).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: t.workspace.clear }));

    await waitFor(() => {
      expect(summaryQueries.at(-1)?.searchParams.get('plantId')).toBe(String(PLANT_A.plantId));
    });
    expect(screen.getByRole('combobox', { name: t.fields.plant })).toHaveTextContent('G1');
    expect(screen.getByRole('searchbox', { name: t.workspace.search })).toHaveValue('');
    await typeRows();
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
  });

  it('US2-3 SC-004 5명이 차면 추가가 잠기고 「최대 5명」 안내가 보인다', async () => {
    const user = userEvent.setup();
    setup({
      settings: {
        PUTAWAY_REQUESTED: {
          enabled: true,
          recipients: [person(41), person(42), person(43), person(44), person(45)],
        },
      },
    });

    const pane = await openType(user, '적치');
    expect(pane.getByText(t.fields.recipients(5))).toBeInTheDocument();
    expect(pane.getByRole('button', { name: `+ ${t.actions.add}` })).toBeDisabled();
    expect(pane.getByText(t.state.limitReached(5))).toBeInTheDocument();
  });

  it('US2-3 SC-004 4명일 때 고르기 창에서 1명만 더 고를 수 있다', async () => {
    const user = userEvent.setup();
    const { writes } = setup({
      settings: {
        PUTAWAY_REQUESTED: {
          enabled: true,
          recipients: [person(41), person(42), person(43), person(44)],
        },
      },
    });

    const pane = await openType(user, '적치');
    await user.click(pane.getByRole('button', { name: `+ ${t.actions.add}` }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText(t.picker.slotsLeft(1, 5))).toBeInTheDocument();

    await user.click(dialog.getByRole('checkbox', { name: '후보 61 선택' }));
    expect(dialog.getByText(t.picker.full(5))).toBeInTheDocument();
    expect(dialog.getByRole('checkbox', { name: '후보 62 선택' })).toBeDisabled();
    expect(dialog.getByRole('checkbox', { name: '후보 63 선택' })).toBeDisabled();

    await user.click(dialog.getByRole('button', { name: '1명 추가' }));
    expect(pane.getByText(t.fields.recipients(5))).toBeInTheDocument();
    await user.click(pane.getByRole('button', { name: t.actions.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const body = (await (writes[0] as Request).json()) as { recipientUserIds: number[] };
    expect(body.recipientUserIds).toEqual([41, 42, 43, 44, 61]);
  });

  it('US2-4 전화번호 없는 담당자는 「알림센터로만 받음」 칩과 목록 ⚠ 수가 보인다', async () => {
    const user = userEvent.setup();
    setup({
      settings: {
        MATERIAL_PICKING_REQUESTED: {
          enabled: true,
          zaloEnabled: true,
          recipients: [person(41), person(42, { hasPhone: false })],
        },
      },
    });

    const rows = await typeRows();
    expect(within(rows[2] as HTMLElement).getByText('⚠1')).toBeInTheDocument();
    const pane = await openType(user, '자재 출고 피킹');
    expect(pane.getByText('📵 전화번호 없음')).toBeInTheDocument();
    expect(pane.getByText(t.state.noPhoneNotice(1))).toBeInTheDocument();
  });

  it('US2-5 알림을 켜고 담당자가 0명이면 안내가 보이고 저장은 된다', async () => {
    const user = userEvent.setup();
    const { writes } = setup();

    const pane = await openType(user, '적치');
    await user.click(pane.getByRole('switch', { name: t.fields.enabled }));

    expect(pane.getByText(t.state.noRecipientsWarning)).toBeInTheDocument();
    await user.click(pane.getByRole('button', { name: t.actions.save }));
    await waitFor(() => expect(writes).toHaveLength(1));
  });

  it('알림을 끄면 Zalo 도 꺼져서 저장된다 — 서버가 「Zalo 만 켬」을 막는다', async () => {
    const user = userEvent.setup();
    const { writes } = setup({
      settings: {
        PUTAWAY_REQUESTED: { enabled: true, zaloEnabled: true, recipients: [person(41)] },
      },
    });

    const pane = await openType(user, '적치');
    await user.click(pane.getByRole('switch', { name: t.fields.enabled }));
    expect(pane.getByRole('switch', { name: t.fields.zalo })).toBeDisabled();
    expect(pane.getByRole('switch', { name: t.fields.zalo })).not.toBeChecked();
    await user.click(pane.getByRole('button', { name: t.actions.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const request = writes[0] as Request;
    expect(request.headers.get('If-Match')).toBe('"3"');
    expect(await request.json()).toEqual({
      enabled: false,
      zaloEnabled: false,
      recipientUserIds: [41],
    });
  });

  it('행이 아직 없어 ETag 가 없으면 If-Match 없이 저장한다', async () => {
    const user = userEvent.setup();
    const { writes } = setup({ etag: null });

    const pane = await openType(user, '적치');
    await user.click(pane.getByRole('switch', { name: t.fields.enabled }));
    await user.click(pane.getByRole('button', { name: t.actions.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((writes[0] as Request).headers.has('If-Match')).toBe(false);
  });

  it('비활성 담당자가 있으면 저장 전에 막고 해제하라고 알린다', async () => {
    const user = userEvent.setup();
    const { writes } = setup({
      settings: {
        PUTAWAY_REQUESTED: {
          enabled: true,
          recipients: [person(41, { active: false }), person(42)],
        },
      },
    });

    const pane = await openType(user, '적치');
    await user.click(pane.getByRole('switch', { name: t.fields.zalo }));
    await user.click(pane.getByRole('button', { name: t.actions.save }));

    expect(await pane.findByText(t.errors.inactiveRecipients(1))).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('동시 저장 409 면 안내와 다시 불러오기를 보인다', async () => {
    const user = userEvent.setup();
    setup({
      settings: { PUTAWAY_REQUESTED: { enabled: true, recipients: [person(41)] } },
      respondPut: () =>
        jsonResponse(
          { conflictCause: 'user', code: 'VERSION_CONFLICT', message: '버전이 맞지 않습니다' },
          { status: 409 },
        ),
    });

    const pane = await openType(user, '적치');
    await user.click(pane.getByRole('switch', { name: t.fields.zalo }));
    await user.click(pane.getByRole('button', { name: t.actions.save }));

    expect(await pane.findByText(t.state.conflict)).toBeInTheDocument();
    await user.click(pane.getByRole('button', { name: t.actions.reload }));
    await waitFor(() => expect(pane.queryByText(t.state.conflict)).toBeNull());
    expect(pane.getByRole('switch', { name: t.fields.zalo })).not.toBeChecked();
  });

  it('고치면 「저장되지 않은 변경 사항」이 보이고, [변경 취소]는 마지막 저장값으로 되돌린다', async () => {
    const user = userEvent.setup();
    setup({
      settings: {
        PUTAWAY_REQUESTED: { enabled: true, zaloEnabled: false, recipients: [person(41)] },
      },
    });

    const pane = await openType(user, '적치');
    expect(pane.queryByText(t.state.unsaved)).toBeNull();
    await user.click(pane.getByRole('switch', { name: t.fields.zalo }));
    expect(pane.getByText(t.state.unsaved)).toBeInTheDocument();

    await user.click(pane.getByRole('button', { name: t.actions.revert }));
    expect(pane.getByRole('switch', { name: t.fields.zalo })).not.toBeChecked();
    expect(pane.getByRole('switch', { name: t.fields.enabled })).toBeChecked();
    expect(pane.getByText(t.fields.recipients(1))).toBeInTheDocument();
    expect(pane.queryByText(t.state.unsaved)).toBeNull();
  });

  it('저장하지 않은 변경이 있으면 다른 작업으로 갈 때 확인한다', async () => {
    const user = userEvent.setup();
    setup();

    const pane = await openType(user, '적치');
    await user.click(pane.getByRole('switch', { name: t.fields.enabled }));
    await user.click(screen.getByRole('button', { name: '긴급 W/O' }));

    expect(await screen.findByText(t.state.unsavedBody)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.actions.discard }));
    expect(
      await screen.findByRole('region', { name: t.panes.setting('긴급 W/O') }),
    ).toBeInTheDocument();
  });

  it('고른 작업을 다시 누르면 고르기를 푼다 — 저장하지 않은 변경이 있으면 먼저 확인한다', async () => {
    const user = userEvent.setup();
    setup();

    const pane = await openType(user, '적치');
    await user.click(pane.getByRole('switch', { name: t.fields.enabled }));
    await user.click(screen.getByRole('button', { name: '적치' }));

    expect(await screen.findByText(t.state.unsavedBody)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.actions.discard }));
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: t.panes.setting('적치') }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: '적치' })).not.toHaveAttribute('aria-current');
  });
});
