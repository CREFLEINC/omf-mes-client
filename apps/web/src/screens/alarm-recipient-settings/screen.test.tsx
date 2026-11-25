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
import { AlarmRecipientSettingsScreen } from './screen';
import type { Setting, SettingRecipient, SettingSummary } from './types';

const t = messages.alarmRecipientSettings;

/** 001 이벤트 카탈로그 6종(contracts/notification-api.md §1). */
const EVENTS = [
  { eventCode: 'WORK_SESSION_STARTED', eventName: '생산 실행', recipientMode: 'CONFIGURED' },
  { eventCode: 'WORK_SESSION_STOPPED', eventName: '생산 중단', recipientMode: 'CONFIGURED' },
  { eventCode: 'WORK_SESSION_ENDED', eventName: '작업 종료', recipientMode: 'CONFIGURED' },
  { eventCode: 'WORK_ORDER_CLOSED', eventName: '생산 마감', recipientMode: 'CONFIGURED' },
  {
    eventCode: 'EQUIPMENT_BREAKDOWN_OCCURRED',
    eventName: '설비 고장 발생',
    recipientMode: 'CONFIGURED',
  },
  {
    eventCode: 'APPROVAL_ACTION_REQUIRED',
    eventName: '승인 요청·결재 도착',
    recipientMode: 'APPROVER',
  },
] as const;

const DEPT = 7;

const person = (
  appUserId: number,
  overrides: Partial<SettingRecipient> = {},
): SettingRecipient => ({
  appUserId,
  loginId: `syn.user.${String(appUserId)}`,
  userName: `합성 사용자 ${String(appUserId)}`,
  departmentName: '합성 부서',
  active: true,
  hasPhone: true,
  ...overrides,
});

interface SetupOptions {
  route?: string;
  zaloStatus?: SettingSummary['zaloStatus'];
  /** 세션의 기능 권한 — W-CO-12 링크 여부를 가른다 */
  permissions?: string[];
  /** 이동한 주소를 읽어야 할 때 — 데이터 라우터로 렌더한다 */
  dataRouter?: boolean;
  /** 이벤트별 상세. 없으면 미설정 기본값(끔·끔·0) */
  settings?: Record<string, Partial<Setting>>;
  respondPut?: (request: Request) => Response;
  /** 부서 목록의 서버 전체 건수 — 받은 건수보다 크면 잘린 것이다 */
  departmentTotal?: number;
  /** 로그인 계정의 부서 — 처음 값(계정 부서)으로 미리 골라 두는지 본다 */
  sessionDepartmentId?: number;
  /** 부서 목록에 더 둘 부서 */
  extraDepartments?: Array<{
    departmentId: number;
    departmentCode: string;
    departmentName: string;
  }>;
  candidates?: Array<{
    appUserId: number;
    loginId: string;
    userName: string;
    departmentName: string | null;
    hasPhone: boolean;
  }>;
}

const setup = (options: SetupOptions = {}) => {
  const writes: Request[] = [];
  const candidateQueries: URL[] = [];
  const settings: Record<string, Setting> = {};
  for (const event of EVENTS) {
    settings[event.eventCode] = {
      departmentId: DEPT,
      eventCode: event.eventCode,
      enabled: false,
      zaloEnabled: false,
      recipients: [],
      ...options.settings?.[event.eventCode],
    };
  }

  const pathOf = (request: Request) => new URL(request.url).pathname;
  const routes: StubRoute[] = [
    {
      match: (request) => pathOf(request) === '/mdm/departments',
      respond: () =>
        jsonResponse({
          items: [
            {
              departmentId: DEPT,
              departmentCode: 'D-PRD1',
              departmentName: '생산1팀',
              parentDepartmentId: null,
              businessUnitId: null,
              isActive: true,
            },
            ...(options.extraDepartments ?? []).map((item) => ({
              ...item,
              parentDepartmentId: null,
              businessUnitId: null,
              isActive: true,
            })),
          ],
          page: {
            page: 1,
            size: 100,
            total: options.departmentTotal ?? 1 + (options.extraDepartments?.length ?? 0),
          },
        }),
    },
    {
      match: (request) => pathOf(request) === '/app/notification-events',
      respond: () => jsonResponse({ items: EVENTS }),
    },
    {
      match: (request) => pathOf(request) === '/app/notification-settings',
      respond: () =>
        jsonResponse({
          departmentId: DEPT,
          departmentName: '생산1팀',
          zaloStatus: options.zaloStatus ?? 'ACTIVE',
          items: Object.values(settings).map((setting) => ({
            eventCode: setting.eventCode,
            enabled: setting.enabled,
            zaloEnabled: setting.zaloEnabled,
            recipientCount: setting.recipients.length,
            noPhoneCount: setting.recipients.filter((item) => !item.hasPhone).length,
          })),
        }),
    },
    {
      match: (request) => pathOf(request) === '/app/notification-settings/recipient-candidates',
      respond: (request) => {
        candidateQueries.push(new URL(request.url));
        const items = options.candidates ?? [
          {
            appUserId: 51,
            loginId: 'syn.a',
            userName: '후보 가',
            departmentName: '합성 부서',
            hasPhone: true,
          },
          {
            appUserId: 52,
            loginId: 'syn.b',
            userName: '후보 나',
            departmentName: null,
            hasPhone: false,
          },
        ];
        return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
      },
    },
    {
      match: (request) =>
        request.method === 'GET' &&
        pathOf(request).startsWith(`/app/notification-settings/${String(DEPT)}/`),
      respond: (request) => {
        const code = decodeURIComponent(pathOf(request).split('/').at(-1) ?? '');
        return jsonResponse(settings[code], { headers: { ETag: '"3"' } });
      },
    },
    {
      match: (request) =>
        request.method === 'PUT' && pathOf(request).startsWith('/app/notification-settings/'),
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
      <AlarmRecipientSettingsScreen />
    </SessionProvider>,
    {
      fetch: createStubFetch(routes),
      route: options.route ?? `/notification/recipient-settings?department=${String(DEPT)}`,
      dataRouter: options.dataRouter,
      session: {
        ...SYNTHETIC_SESSION,
        permissions: options.permissions ?? ['W-CO-11'],
        ...(options.sessionDepartmentId === undefined
          ? {}
          : { departmentId: options.sessionDepartmentId }),
      },
    },
  );
  return { ...view, writes, candidateQueries };
};

/* 조회 조건 · 목록 · 상세 통일 배치(#358) — 목록 상자 이름은 「이벤트 목록」. */
const eventsPane = () => within(screen.getByRole('region', { name: t.workspace.list }));
const settingPane = (eventName: string) =>
  within(screen.getByRole('region', { name: t.panes.setting(eventName) }));

const openEvent = async (user: ReturnType<typeof userEvent.setup>, eventName: string) => {
  await user.click(await screen.findByRole('button', { name: eventName }));
  return settingPane(eventName);
};

describe('AlarmRecipientSettingsScreen — 부서 × 이벤트', () => {
  it('부서를 고르기 전에는 안내만 보인다', async () => {
    setup({ route: '/notification/recipient-settings' });

    expect(await screen.findByText(t.state.selectDepartment)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: t.panes.events })).toBeNull();
    /* 상세 상자는 기준 화면과 같은 빈 상태(#358). */
    expect(screen.getByText(t.workspace.selectEventTitle)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    /* 초기화는 부서가 골라져 있을 때만 보인다(#358). */
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
  });

  it('계정 부서가 없으면 처음 값은 「고르지 않음」 — 부서를 고르면 초기화가 보이고, 누르면 고르기 전으로 돌아가 다시 숨는다(#358)', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByRole('button', { name: t.workspace.clear }));

    expect(await screen.findByText(t.state.selectDepartment)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
  });

  it('처음에는 계정 부서가 골라져 있고 초기화는 숨는다 — 다른 부서를 고르면 보이고, 누르면 계정 부서로 돌아가 다시 조회한다', async () => {
    const user = userEvent.setup();
    const { router } = setup({
      route: '/notification/recipient-settings',
      sessionDepartmentId: DEPT,
      extraDepartments: [{ departmentId: 9, departmentCode: 'D-PRD2', departmentName: '생산2팀' }],
      dataRouter: true,
    });

    const department = await screen.findByRole('combobox', { name: t.fields.department });
    await waitFor(() => expect(department).toHaveTextContent('D-PRD1 · 생산1팀'));
    await waitFor(() => expect(eventsPane().getAllByRole('row')).toHaveLength(7));
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();

    await user.click(department);
    await user.click(await screen.findByRole('option', { name: 'D-PRD2 · 생산2팀' }));
    await waitFor(() => expect(router?.state.location.search).toContain('department=9'));
    await user.click(await screen.findByRole('button', { name: t.workspace.clear }));

    await waitFor(() =>
      expect(router?.state.location.search).toContain(`department=${String(DEPT)}`),
    );
    expect(screen.getByRole('combobox', { name: t.fields.department })).toHaveTextContent(
      'D-PRD1 · 생산1팀',
    );
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
  });

  it('저장하지 않은 변경이 있으면 초기화도 버릴지 먼저 묻는다', async () => {
    const user = userEvent.setup();
    /* 계정 부서(처음 값)는 생산2팀, 지금 보는 부서는 생산1팀. */
    setup({
      sessionDepartmentId: 9,
      extraDepartments: [{ departmentId: 9, departmentCode: 'D-PRD2', departmentName: '생산2팀' }],
    });

    const pane = await openEvent(user, '생산 마감');
    await user.click(await pane.findByRole('switch', { name: t.fields.enabled }));
    await user.click(screen.getByRole('button', { name: t.workspace.clear }));

    const dialog = within(await screen.findByRole('dialog', { name: t.state.unsavedTitle }));
    await user.click(dialog.getByRole('button', { name: t.actions.cancel }));
    expect(screen.getByRole('combobox', { name: t.fields.department })).toHaveTextContent(
      'D-PRD1 · 생산1팀',
    );

    await user.click(screen.getByRole('button', { name: t.workspace.clear }));
    await user.click(
      within(await screen.findByRole('dialog', { name: t.state.unsavedTitle })).getByRole(
        'button',
        { name: t.actions.discard },
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: t.fields.department })).toHaveTextContent(
        'D-PRD2 · 생산2팀',
      ),
    );
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
  });

  it('US4-1 부서를 고르면 그 부서의 6개 이벤트 요약이 보이고 URL 에 남는다', async () => {
    const user = userEvent.setup();
    setup({
      route: '/notification/recipient-settings',
      settings: {
        WORK_SESSION_STOPPED: {
          enabled: true,
          zaloEnabled: true,
          recipients: [person(41), person(42, { hasPhone: false })],
        },
      },
    });

    await user.click(await screen.findByRole('combobox', { name: t.fields.department }));
    await user.click(await screen.findByRole('option', { name: 'D-PRD1 · 생산1팀' }));

    const rows = await waitFor(() => {
      const found = eventsPane().getAllByRole('row').slice(1);
      expect(found).toHaveLength(6);
      return found;
    });
    expect(
      within(rows[0] as HTMLElement).getByRole('button', { name: '생산 실행' }),
    ).toHaveAttribute('aria-current', 'true');
    const stopped = rows[1] as HTMLElement;
    expect(within(stopped).getAllByText(t.values.on)).toHaveLength(2);
    expect(within(stopped).getByText(t.values.recipientCount(2))).toBeInTheDocument();
    expect(within(stopped).getByText('⚠1')).toBeInTheDocument();
    expect(within(rows[5] as HTMLElement).getByText(t.values.approver)).toBeInTheDocument();
  });

  it('결재 이벤트를 고르면 수신자 영역 대신 결재자 안내가 보인다', async () => {
    const user = userEvent.setup();
    setup();

    const pane = await openEvent(user, '승인 요청·결재 도착');

    expect(await pane.findByText(t.state.approverNotice)).toBeInTheDocument();
    expect(pane.queryByRole('button', { name: `+ ${t.actions.add}` })).toBeNull();
  });

  it('알림이 꺼져 있으면 Zalo Switch 가 잠기고 사유를 잇는다', async () => {
    const user = userEvent.setup();
    setup();

    const pane = await openEvent(user, '생산 마감');
    const zalo = await pane.findByRole('switch', { name: t.fields.zalo });
    expect(zalo).toBeDisabled();
    expect(pane.getByText(t.state.zaloNeedsEnabled)).toBeInTheDocument();

    await user.click(pane.getByRole('switch', { name: t.fields.enabled }));
    expect(pane.getByRole('switch', { name: t.fields.zalo })).toBeEnabled();
    /* 요금 · 일일 한도는 스위치 아래 문장이 아니라 Zalo 발송 옆 ⓘ 에 든다. */
    expect(pane.getByRole('button', { name: t.state.zaloQuota })).toBeInTheDocument();
    expect(pane.queryByText(t.state.zaloQuota)).toBeNull();
    expect(pane.queryByText(t.state.zaloNeedsEnabled)).toBeNull();
  });

  it('US4-4 켬 + 수신자 0명이면 경고가 보인다', async () => {
    const user = userEvent.setup();
    setup({ settings: { WORK_ORDER_CLOSED: { enabled: true, recipients: [] } } });

    const pane = await openEvent(user, '생산 마감');

    expect(await pane.findByText(t.state.noRecipientsWarning)).toBeInTheDocument();
  });

  it('US4-5 전화번호 없는 수신자가 있으면 표식과 안내가 보인다', async () => {
    const user = userEvent.setup();
    setup({
      settings: {
        WORK_ORDER_CLOSED: {
          enabled: true,
          recipients: [person(41), person(42, { userName: '번호없는 사람', hasPhone: false })],
        },
      },
    });

    const pane = await openEvent(user, '생산 마감');

    expect(await pane.findByText(t.state.noPhoneNotice(1))).toBeInTheDocument();
    const list = pane.getByRole('list', { name: t.columns.recipients });
    expect(within(list).getAllByText(`📵 ${t.values.noPhone}`)).toHaveLength(1);
  });

  it('US4-3 후보 창은 활성 사용자를 번호 여부와 함께 보이고, 고른 사람을 더한다', async () => {
    const user = userEvent.setup();
    const { candidateQueries } = setup({
      settings: { WORK_ORDER_CLOSED: { enabled: true, recipients: [person(41)] } },
    });

    const pane = await openEvent(user, '생산 마감');
    await user.click(await pane.findByRole('button', { name: `+ ${t.actions.add}` }));

    const dialog = within(await screen.findByRole('dialog', { name: t.picker.title }));
    const noPhoneRow = (await dialog.findByText('후보 나')).closest('tr') as HTMLElement;
    expect(within(noPhoneRow).getByText(t.values.phoneMissing)).toBeInTheDocument();
    expect(dialog.getByRole('columnheader', { name: t.columns.phone })).toBeInTheDocument();
    expect(candidateQueries.at(-1)?.searchParams.get('page')).toBe('1');
    /* 표 위 「수신자 후보」 제목 글은 걷었다 — 표 이름으로만 남는다. */
    expect(dialog.getByRole('table', { name: t.picker.caption })).toBeInTheDocument();
    expect(dialog.queryByText(t.picker.caption)).toBeNull();
    expect(dialog.getByRole('button', { name: t.actions.addPick })).toBeDisabled();

    await user.click(within(noPhoneRow).getByRole('checkbox'));
    await user.click(dialog.getByRole('button', { name: t.actions.addSelected(1) }));

    const list = pane.getByRole('list', { name: t.columns.recipients });
    expect(within(list).getByText('후보 나 (—)')).toBeInTheDocument();
    expect(pane.getByText(t.fields.recipients(2))).toBeInTheDocument();
  });

  it('이미 수신자인 후보는 체크 칸 없이 「추가됨」 표식만 있어 다시 고를 수 없다', async () => {
    const user = userEvent.setup();
    setup({
      settings: {
        WORK_ORDER_CLOSED: { enabled: true, recipients: [person(51, { userName: '후보 가' })] },
      },
    });

    const pane = await openEvent(user, '생산 마감');
    await user.click(await pane.findByRole('button', { name: `+ ${t.actions.add}` }));
    const dialog = within(await screen.findByRole('dialog', { name: t.picker.title }));

    expect(
      await dialog.findByRole('checkbox', { name: t.values.selectRow('후보 나') }),
    ).toBeEnabled();
    expect(dialog.queryByRole('checkbox', { name: t.values.selectRow('후보 가') })).toBeNull();
    const existingRow = dialog.getByText('후보 가').closest('tr') as HTMLElement;
    expect(within(existingRow).getByText(t.values.alreadyAdded)).toBeInTheDocument();
    /* 체크 칸 자리는 비워 둬 열이 어긋나지 않는다. */
    expect(within(existingRow).getAllByRole('cell')).toHaveLength(5);
  });

  it('부서 목록이 잘리면 잘림 안내를 보인다', async () => {
    setup({ departmentTotal: 150 });

    expect(await screen.findByText(t.state.departmentsTruncated)).toBeInTheDocument();
  });

  it('후보 검색은 입력한 말을 keyword 로 실어 첫 쪽부터 다시 부른다', async () => {
    const user = userEvent.setup();
    const { candidateQueries } = setup();

    const pane = await openEvent(user, '생산 마감');
    await user.click(await pane.findByRole('button', { name: `+ ${t.actions.add}` }));
    const dialog = within(await screen.findByRole('dialog', { name: t.picker.title }));
    await user.type(dialog.getByRole('searchbox', { name: t.picker.searchLabel }), '후보{Enter}');

    await waitFor(() => expect(candidateQueries.at(-1)?.searchParams.get('keyword')).toBe('후보'));
    expect(candidateQueries.at(-1)?.searchParams.get('page')).toBe('1');
  });

  it('저장은 경로형 PUT + If-Match + 본문 {enabled, zaloEnabled, recipientUserIds} 다', async () => {
    const user = userEvent.setup();
    const { writes } = setup({
      settings: { WORK_ORDER_CLOSED: { enabled: true, recipients: [person(41), person(42)] } },
    });

    const pane = await openEvent(user, '생산 마감');
    await user.click(await pane.findByRole('switch', { name: t.fields.zalo }));
    await user.click(pane.getByRole('button', { name: `합성 사용자 41 ${t.actions.remove}` }));
    await user.click(pane.getByRole('button', { name: t.actions.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const request = writes[0] as Request;
    expect(new URL(request.url).pathname).toBe(
      `/app/notification-settings/${String(DEPT)}/WORK_ORDER_CLOSED`,
    );
    expect(request.headers.get('If-Match')).toBe('"3"');
    expect(request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await request.json()).toEqual({
      enabled: true,
      zaloEnabled: true,
      recipientUserIds: [42],
    });
    /* 저장 완료는 토스트다(설계 W-CO-11) — 패널 밖에 선다. */
    expect(await screen.findByText(t.state.saved)).toBeInTheDocument();
  });

  it('결재 이벤트 저장은 수신자를 싣지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = setup();

    const pane = await openEvent(user, '승인 요청·결재 도착');
    await user.click(await pane.findByRole('switch', { name: t.fields.enabled }));
    await user.click(pane.getByRole('button', { name: t.actions.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await (writes[0] as Request).json()).toEqual({
      enabled: true,
      zaloEnabled: false,
      recipientUserIds: [],
    });
  });

  it('비활성 수신자가 있으면 보내지 않고 해제하라고 알린다', async () => {
    const user = userEvent.setup();
    const { writes } = setup({
      settings: {
        WORK_ORDER_CLOSED: { enabled: true, recipients: [person(41, { active: false })] },
      },
    });

    const pane = await openEvent(user, '생산 마감');
    await user.click(await pane.findByRole('switch', { name: t.fields.zalo }));
    await user.click(pane.getByRole('button', { name: t.actions.save }));

    expect(await pane.findByText(t.errors.inactiveRecipient)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('US4-6 동시 저장 409 면 안내와 다시 불러오기를 보인다', async () => {
    const user = userEvent.setup();
    setup({
      settings: { WORK_ORDER_CLOSED: { enabled: true, recipients: [person(41)] } },
      respondPut: () =>
        jsonResponse(
          { conflictCause: 'user', code: 'VERSION_CONFLICT', message: '버전이 맞지 않습니다' },
          { status: 409 },
        ),
    });

    const pane = await openEvent(user, '생산 마감');
    await user.click(await pane.findByRole('switch', { name: t.fields.zalo }));
    await user.click(pane.getByRole('button', { name: t.actions.save }));

    expect(await pane.findByText(t.state.conflict)).toBeInTheDocument();
    await user.click(pane.getByRole('button', { name: t.actions.reload }));
    await waitFor(() => expect(pane.queryByText(t.state.conflict)).toBeNull());
    expect(pane.getByRole('switch', { name: t.fields.zalo })).not.toBeChecked();
  });

  it('Zalo 연결이 ACTIVE 가 아니면 Zalo 발송 옆 노란 「미연결」 칩과 아래 한 줄 안내를 보인다', async () => {
    setup({ zaloStatus: 'NOT_CONFIGURED' });

    const pane = within(await screen.findByRole('region', { name: t.panes.setting('생산 실행') }));
    expect(await pane.findByText(t.state.zaloNotActive)).toBeInTheDocument();
    expect(pane.getByText(t.values.notConnected)).toBeInTheDocument();
    /* 종전 긴 노란 줄은 걷었다. */
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('W-CO-12 권한이 있으면 안내 줄 오른쪽 [Zalo 연결 설정] 단추로 알림 연결 설정에 간다', async () => {
    const user = userEvent.setup();
    const { router } = setup({
      zaloStatus: 'REAUTH_REQUIRED',
      permissions: ['W-CO-11', 'W-CO-12'],
      dataRouter: true,
    });

    const button = await screen.findByRole('button', { name: t.actions.openConnection });
    expect(button.closest('.notify-zalo-connect')).toHaveTextContent(t.state.zaloNotActive);
    expect(screen.queryByRole('link', { name: t.actions.openConnection })).toBeNull();
    await user.click(button);
    await waitFor(() =>
      expect(router?.state.location.pathname).toBe('/notification/zalo-connection'),
    );
  });

  it('W-CO-12 권한이 없으면 이동 단추 없이 안내만 보인다', async () => {
    setup({ zaloStatus: 'NOT_CONFIGURED' });

    expect(await screen.findByText(t.state.zaloNotActive)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.openConnection })).toBeNull();
  });

  it('Zalo 연결이 ACTIVE 면 배너가 없다', async () => {
    setup();

    await screen.findByRole('region', { name: t.workspace.list });
    await waitFor(() => expect(eventsPane().getAllByRole('row')).toHaveLength(7));
    expect(screen.queryByText(t.state.zaloNotActive)).toBeNull();
    expect(screen.queryByText(t.values.notConnected)).toBeNull();
  });

  it('저장하지 않은 변경이 있을 때 다른 이벤트를 고르면 확인하고, 버리면 이동한다', async () => {
    const user = userEvent.setup();
    setup();

    const pane = await openEvent(user, '생산 마감');
    await user.click(await pane.findByRole('switch', { name: t.fields.enabled }));
    await user.click(screen.getByRole('button', { name: '생산 실행' }));

    const dialog = within(await screen.findByRole('dialog', { name: t.state.unsavedTitle }));
    await user.click(dialog.getByRole('button', { name: t.actions.cancel }));
    expect(screen.getByRole('region', { name: t.panes.setting('생산 마감') })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '생산 실행' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: t.state.unsavedTitle })).getByRole(
        'button',
        { name: t.actions.discard },
      ),
    );
    expect(
      await screen.findByRole('region', { name: t.panes.setting('생산 실행') }),
    ).toBeInTheDocument();
  });

  it('고른 이벤트를 다시 누르면 선택이 풀리고 상세는 안내로 돌아간다(사용자 지시 2026-11-24)', async () => {
    const user = userEvent.setup();
    setup();

    await openEvent(user, '생산 마감');
    await user.click(screen.getByRole('button', { name: '생산 마감' }));

    expect(await screen.findByText(t.workspace.selectEventTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '생산 마감' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: '생산 실행' })).not.toHaveAttribute('aria-current');
  });

  it('[취소]는 마지막으로 읽은 값으로 돌리고 「저장되지 않은 변경 사항」도 걷는다', async () => {
    const user = userEvent.setup();
    setup();

    const pane = await openEvent(user, '생산 마감');
    const enabled = await pane.findByRole('switch', { name: t.fields.enabled });
    expect(pane.queryByText(t.state.unsaved)).toBeNull();
    await user.click(enabled);
    expect(enabled).toBeChecked();
    expect(pane.getByText(t.state.unsaved)).toBeInTheDocument();

    await user.click(pane.getByRole('button', { name: t.actions.revert }));
    expect(pane.getByRole('switch', { name: t.fields.enabled })).not.toBeChecked();
    expect(pane.getByRole('button', { name: t.actions.save })).toBeDisabled();
    expect(pane.queryByText(t.state.unsaved)).toBeNull();
  });
});
