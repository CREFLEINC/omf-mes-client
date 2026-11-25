import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { ZaloConnectionScreen } from './screen';
import type { Connection as ZaloConnection } from './types';

const t = messages.zaloConnection;
const leave = messages.common.unsavedLeave;

const CODES = [
  'WORK_SESSION_STARTED',
  'WORK_SESSION_STOPPED',
  'WORK_SESSION_ENDED',
  'WORK_ORDER_CLOSED',
  'EQUIPMENT_BREAKDOWN_OCCURRED',
  'APPROVAL_ACTION_REQUIRED',
];
const NAMES = [
  '생산 실행',
  '생산 중단',
  '작업 종료',
  '생산 마감',
  '설비 고장 발생',
  '승인 요청·결재 도착',
];

const connection = (overrides: Partial<ZaloConnection> = {}): ZaloConnection => ({
  appId: '1234567890',
  secretKeySet: true,
  refreshTokenSet: true,
  status: 'ACTIVE',
  accessTokenExpiresAt: '2026-10-22T08:10:00Z',
  lastRefreshedAt: '2026-10-21T07:10:00Z',
  lastErrorCode: null,
  lastErrorMessage: null,
  paramMaxLength: 100,
  templates: CODES.map((eventCode) => ({ eventCode, templateId: null })),
  deliveryEnabled: true,
  handoverTemplates: [],
  ...overrides,
});

const setup = (
  options: {
    data?: ZaloConnection;
    /** 저장 뒤 서버가 돌려주는 값(PUT 응답이자 그 뒤의 GET) */
    saved?: ZaloConnection;
    respondPut?: (request: Request) => Response | Promise<Response>;
  } = {},
) => {
  const writes: Request[] = [];
  let data = options.data ?? connection();
  const view = renderWithProviders(<ZaloConnectionScreen />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/app/notification-events',
        respond: () =>
          jsonResponse({
            items: CODES.map((eventCode, index) => ({ eventCode, eventName: NAMES[index] })),
          }),
      },
      {
        match: (request) =>
          request.method === 'GET' && new URL(request.url).pathname === '/app/zalo-connection',
        respond: () => jsonResponse(data, { headers: { ETag: '"5"' } }),
      },
      {
        match: (request) =>
          request.method === 'PUT' && new URL(request.url).pathname === '/app/zalo-connection',
        respond: (request) => {
          writes.push(request.clone());
          if (options.respondPut !== undefined) return options.respondPut(request);
          data = options.saved ?? data;
          return jsonResponse(data, { headers: { ETag: '"6"' } });
        },
      },
    ]),
    route: '/notification/zalo-connection',
    dataRouter: true,
  });
  return { writes, router: view.router };
};

/* 조회 조건 · 목록 · 상세 통일 배치(#358) — 템플릿은 목록에서 골라 상세에서 고친다. 이름 검색으로 찾아 고른다. */
const openTemplate = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const search = await screen.findByRole('searchbox', { name: t.workspace.search });
  await user.clear(search);
  await user.type(search, name);
  await user.click(screen.getByRole('button', { name: t.workspace.apply }));
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('textbox', { name: t.fields.templateId });
};

/** 상자마다 아래 오른쪽 [변경 취소][저장](#358) — 상자 이름으로 그 상자 안 단추를 찾는다. */
const box = (name: string) => within(screen.getByRole('region', { name }));
const saveIn = (name: string) => box(name).getByRole('button', { name: t.actions.save });

/** 받은 본문을 그대로 저장한 것처럼 돌려준다 — ETag 는 "6", "7" … 로 오른다. */
const echoPut = (initial: ZaloConnection) => {
  let current = initial;
  let version = 5;
  return async (request: Request): Promise<Response> => {
    const body = (await request.json()) as Record<string, unknown>;
    current = {
      ...current,
      appId: body.appId as string | null,
      paramMaxLength: body.paramMaxLength as number,
      templates: body.templates as ZaloConnection['templates'],
      handoverTemplates: body.handoverTemplates as ZaloConnection['handoverTemplates'],
      secretKeySet: current.secretKeySet || 'secretKey' in body,
      refreshTokenSet: current.refreshTokenSet || 'refreshToken' in body,
    };
    version += 1;
    return jsonResponse(current, { headers: { ETag: `"${String(version)}"` } });
  };
};

describe('ZaloConnectionScreen', () => {
  it('머리글 없이 상태 Chip 과 템플릿 목록을 보이고, 고른 템플릿의 ID 칸 · 파라미터 · 복사가 상세에 선다', async () => {
    const user = userEvent.setup();
    setup();

    expect(await screen.findByText(t.status.ACTIVE)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    /* 이벤트 6종 + 인계 작업 템플릿이 한 목록에 선다. */
    const list = within(await screen.findByRole('region', { name: t.workspace.list }));
    expect(await list.findAllByText(t.workspace.kinds.event)).toHaveLength(6);
    expect(screen.getByText(t.workspace.selectTitle)).toBeInTheDocument();

    expect(await openTemplate(user, '생산 중단')).toBeInTheDocument();
    expect(screen.getByText('line, work_order, event_time, reason')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.actions.copyFor('생산 중단') }),
    ).toBeInTheDocument();
  });

  it('고른 템플릿을 한 번 더 누르면 선택이 풀린다', async () => {
    const user = userEvent.setup();
    setup();

    await openTemplate(user, '생산 중단');
    const row = screen.getByRole('button', { name: '생산 중단' });
    expect(row).toHaveAttribute('aria-current', 'true');

    await user.click(row);
    expect(row).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('textbox', { name: t.fields.templateId })).toBeNull();
    expect(screen.getByText(t.workspace.selectTitle)).toBeInTheDocument();
  });

  it('초기화는 검색어가 처음 값(빈칸)과 다를 때만 보이고, 누르면 다시 숨는다(#358)', async () => {
    const user = userEvent.setup();
    setup();

    const search = await screen.findByRole('searchbox', { name: t.workspace.search });
    /* 검색은 목록 | 상세 위 조회 조건 상자에 선다(알림 수신자 · 인계작업 알림과 같다). */
    const filter = box(messages.common.paneList.filter);
    expect(filter.getByRole('searchbox', { name: t.workspace.search })).toBe(search);
    expect(filter.getByRole('button', { name: t.workspace.apply })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
    await user.type(search, '생산 중단');
    await user.click(screen.getByRole('button', { name: t.workspace.clear }));

    expect(search).toHaveValue('');
    expect(screen.queryByRole('button', { name: t.workspace.clear })).toBeNull();
  });

  it('[변경 취소][저장]은 상자마다 아래에 서고, 템플릿 ID 를 고치면 상세의 저장만 열린다(#358)', async () => {
    const user = userEvent.setup();
    setup();

    await screen.findByText(t.status.ACTIVE);
    /* 화면 위 오른쪽의 한꺼번 저장은 없다 — 연결 정보 · 템플릿 설정 · 템플릿 상세 상자마다 하나씩. */
    expect(saveIn(t.panes.connection)).toBeDisabled();
    expect(saveIn(t.panes.templates)).toBeDisabled();

    await user.type(await openTemplate(user, '생산 실행'), 'TPL01');
    const save = saveIn('생산 실행');
    expect(save).toBeEnabled();
    expect(saveIn(t.panes.connection)).toBeDisabled();
    expect(saveIn(t.panes.templates)).toBeDisabled();
    expect(screen.getAllByRole('button', { name: t.actions.save })).toHaveLength(3);

    await user.click(box('생산 실행').getByRole('button', { name: t.actions.revert }));
    expect(screen.getByRole('textbox', { name: t.fields.templateId })).toHaveValue('');
    expect(save).toBeDisabled();
  });

  it('앱 ID 를 고쳤다가 [변경 취소]하면 연결 정보만 되돌리고, 고치던 최대 길이는 남는다', async () => {
    const user = userEvent.setup();
    setup();

    const appId = await screen.findByRole('textbox', { name: t.fields.appId });
    await user.clear(appId);
    await user.type(appId, '77');
    const length = screen.getByRole('textbox', { name: new RegExp(t.fields.paramMaxLength) });
    await user.clear(length);
    await user.type(length, '150');

    await user.click(box(t.panes.connection).getByRole('button', { name: t.actions.revert }));
    expect(appId).toHaveValue('1234567890');
    expect(saveIn(t.panes.connection)).toBeDisabled();
    expect(length).toHaveValue('150');
    expect(saveIn(t.panes.templates)).toBeEnabled();
  });

  it('연결 정보를 저장해도 고치던 템플릿 ID 는 싣지 않고, 고친 채 남았다가 새 ETag 로 따로 저장된다', async () => {
    const user = userEvent.setup();
    const { writes } = setup({ respondPut: echoPut(connection()) });

    await user.type(await openTemplate(user, '생산 실행'), 'TPL01');
    const appId = screen.getByRole('textbox', { name: t.fields.appId });
    await user.clear(appId);
    await user.type(appId, '999');
    await user.click(saveIn(t.panes.connection));

    await waitFor(() => expect(writes).toHaveLength(1));
    const first = writes[0] as Request;
    expect(first.headers.get('If-Match')).toBe('"5"');
    const firstBody = (await first.json()) as Record<string, unknown>;
    expect(firstBody.appId).toBe('999');
    expect(firstBody.templates).toContainEqual({
      eventCode: 'WORK_SESSION_STARTED',
      templateId: null,
    });

    expect(await box(t.panes.connection).findByText(t.state.saved)).toBeInTheDocument();
    expect(saveIn(t.panes.connection)).toBeDisabled();
    /* 템플릿 ID 는 고친 채 남고 그 저장은 그대로 열려 있다. */
    expect(screen.getByRole('textbox', { name: t.fields.templateId })).toHaveValue('TPL01');
    expect(saveIn('생산 실행')).toBeEnabled();

    await user.click(saveIn('생산 실행'));
    await waitFor(() => expect(writes).toHaveLength(2));
    const second = writes[1] as Request;
    expect(second.headers.get('If-Match')).toBe('"6"');
    const secondBody = (await second.json()) as Record<string, unknown>;
    expect(secondBody.appId).toBe('999');
    expect(secondBody.templates).toContainEqual({
      eventCode: 'WORK_SESSION_STARTED',
      templateId: 'TPL01',
    });
    await waitFor(() => expect(saveIn('생산 실행')).toBeDisabled());
  });

  it('템플릿 ID 를 저장해도 고치던 연결 정보 · 최대 길이 · 갱신 토큰은 싣지 않고 고친 채 남는다', async () => {
    const user = userEvent.setup();
    const { writes } = setup({ respondPut: echoPut(connection()) });

    const appId = await screen.findByRole('textbox', { name: t.fields.appId });
    await user.clear(appId);
    await user.type(appId, '777');
    const length = screen.getByRole('textbox', { name: new RegExp(t.fields.paramMaxLength) });
    await user.clear(length);
    await user.type(length, '150');
    await user.click(
      screen.getByRole('button', { name: `${t.fields.refreshToken} ${t.actions.change}` }),
    );
    await user.type(screen.getByLabelText(t.fields.refreshToken), 'rt');

    await user.type(await openTemplate(user, '생산 중단'), 'TPL02');
    await user.click(saveIn('생산 중단'));

    await waitFor(() => expect(writes).toHaveLength(1));
    const body = (await (writes[0] as Request).json()) as Record<string, unknown>;
    expect(body.appId).toBe('1234567890');
    expect(body.paramMaxLength).toBe(100);
    expect('refreshToken' in body).toBe(false);
    expect(body.templates).toContainEqual({
      eventCode: 'WORK_SESSION_STOPPED',
      templateId: 'TPL02',
    });

    expect(await box('생산 중단').findByText(t.state.saved)).toBeInTheDocument();
    expect(saveIn('생산 중단')).toBeDisabled();
    expect(appId).toHaveValue('777');
    expect(length).toHaveValue('150');
    expect(screen.getByLabelText(t.fields.refreshToken)).toHaveValue('rt');
    expect(saveIn(t.panes.connection)).toBeEnabled();
    expect(saveIn(t.panes.templates)).toBeEnabled();
  });

  it('US7-1 비밀값은 다시 보이지 않고 「등록됨」으로만 보인다', async () => {
    setup();

    expect(await screen.findAllByText(t.values.registered)).toHaveLength(2);
    expect(screen.queryByLabelText(t.fields.secretKey)).toBeNull();
  });

  it('US7-1 비밀값을 바꾸지 않고 저장하면 본문에서 생략하고 If-Match 를 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = setup();

    const template = await openTemplate(user, '생산 마감');
    await user.type(template, 'TPL04');
    await user.click(saveIn('생산 마감'));

    await waitFor(() => expect(writes).toHaveLength(1));
    const request = writes[0] as Request;
    expect(request.headers.get('If-Match')).toBe('"5"');
    const body = (await request.json()) as Record<string, unknown>;
    expect('secretKey' in body).toBe(false);
    expect('refreshToken' in body).toBe(false);
    expect(body.templates).toContainEqual({ eventCode: 'WORK_ORDER_CLOSED', templateId: 'TPL04' });
    expect(await screen.findByText(t.state.saved)).toBeInTheDocument();
  });

  it('US7-1 갱신 토큰을 바꾸기로 열어 넣으면 그 값만 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = setup();

    await user.click(
      await screen.findByRole('button', { name: `${t.fields.refreshToken} ${t.actions.change}` }),
    );
    await user.type(screen.getByLabelText(t.fields.refreshToken), 'new-refresh');
    await user.click(saveIn(t.panes.connection));

    await waitFor(() => expect(writes).toHaveLength(1));
    const body = (await (writes[0] as Request).json()) as Record<string, unknown>;
    expect(body.refreshToken).toBe('new-refresh');
    expect('secretKey' in body).toBe(false);
  });

  it('바꾸기를 열고 비워 두면 보내지 않고 그 칸에 오류를 보인다', async () => {
    const user = userEvent.setup();
    const { writes } = setup();

    await user.click(
      await screen.findByRole('button', { name: `${t.fields.secretKey} ${t.actions.change}` }),
    );
    await user.click(saveIn(t.panes.connection));

    expect(await screen.findByText(t.errors.secretRequired)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('409 면 안내와 다시 불러오기를 보인다', async () => {
    const user = userEvent.setup();
    setup({
      respondPut: () =>
        jsonResponse({ conflictCause: 'user', message: '버전 불일치' }, { status: 409 }),
    });

    await user.clear(
      await screen.findByRole('textbox', { name: new RegExp(t.fields.paramMaxLength) }),
    );
    await user.type(
      screen.getByRole('textbox', { name: new RegExp(t.fields.paramMaxLength) }),
      '120',
    );
    await user.click(saveIn(t.panes.templates));

    expect(await box(t.panes.templates).findByText(t.state.conflict)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.reload })).toBeInTheDocument();
  });

  /* 연결 오류는 안내 줄 하나에 한글 요약 + 재등록 안내, 코드 · 원문은 「오류 상세」 안(사용자 지시 2026-11-24). */
  it('재등록 필요면 「연결 오류」 배지와 오류 안내 한 줄, 오류 상세, 「Zalo 발송 OFF」를 보인다', async () => {
    setup({
      data: connection({
        status: 'REAUTH_REQUIRED',
        lastErrorCode: '-14014',
        lastErrorMessage: '갱신 토큰이 무효입니다',
        deliveryEnabled: false,
      }),
    });

    expect(await screen.findByText(t.status.REAUTH_REQUIRED)).toBeInTheDocument();
    expect(
      screen.getAllByText(t.state.lastError('-14014'), { exact: false }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(t.state.reauth, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText(t.actions.errorDetail)).toBeInTheDocument();
    expect(screen.getByText('-14014')).toBeInTheDocument();
    expect(screen.getByText('갱신 토큰이 무효입니다')).toBeInTheDocument();
    expect(screen.getByText(t.state.deliveryDisabled)).toBeInTheDocument();
  });

  it('미설정이면 「미설정」 Chip 이고 비밀값은 「등록 안 됨」이다', async () => {
    setup({
      data: connection({
        status: 'NOT_CONFIGURED',
        appId: null,
        secretKeySet: false,
        refreshTokenSet: false,
        accessTokenExpiresAt: null,
        lastRefreshedAt: null,
      }),
    });

    expect(await screen.findByText(t.status.NOT_CONFIGURED)).toBeInTheDocument();
    expect(screen.getAllByText(t.values.notRegistered)).toHaveLength(2);
    expect(screen.queryByText(t.state.reauth)).toBeNull();
  });

  it('US7-1 저장하면 응답 값으로 상태·칸을 다시 그린다 — 첫 조회(미설정)가 남지 않는다', async () => {
    const user = userEvent.setup();
    const empty = connection({
      status: 'NOT_CONFIGURED',
      appId: null,
      secretKeySet: false,
      refreshTokenSet: false,
      accessTokenExpiresAt: null,
      lastRefreshedAt: null,
    });
    setup({
      data: empty,
      saved: connection({
        appId: '123',
        accessTokenExpiresAt: null,
        lastRefreshedAt: null,
        templates: CODES.map((eventCode, index) => ({
          eventCode,
          templateId: `${String(index + 1)}00`,
        })),
      }),
    });

    await user.type(await screen.findByRole('textbox', { name: t.fields.appId }), '123');
    await user.click(
      screen.getByRole('button', { name: `${t.fields.secretKey} ${t.actions.change}` }),
    );
    await user.type(screen.getByLabelText(t.fields.secretKey), 'sk');
    await user.click(
      screen.getByRole('button', { name: `${t.fields.refreshToken} ${t.actions.change}` }),
    );
    await user.type(screen.getByLabelText(t.fields.refreshToken), 'rt');
    await user.click(saveIn(t.panes.connection));

    expect(await screen.findByText(t.state.saved)).toBeInTheDocument();
    expect(await screen.findByText(t.status.ACTIVE)).toBeInTheDocument();
    expect(screen.queryByText(t.status.NOT_CONFIGURED)).toBeNull();
    expect(screen.getAllByText(t.values.registered)).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: t.fields.appId })).toHaveValue('123');
    expect(await openTemplate(user, '생산 실행')).toHaveValue('100');
  });

  it('어느 상자든 저장하지 않은 값을 두고 다른 화면으로 가면 묻고, 계속 편집은 남고 나가기는 옮긴다(#358)', async () => {
    const user = userEvent.setup();
    const { router, writes } = setup();

    const appId = await screen.findByRole('textbox', { name: t.fields.appId });
    await user.clear(appId);
    await user.type(appId, '77');

    await act(async () => {
      await router?.navigate('/system/users-roles');
    });
    const dialog = within(await screen.findByRole('dialog', { name: leave.title }));
    expect(dialog.getByText(leave.body)).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: leave.keep }));
    expect(router?.state.location.pathname).toBe('/notification/zalo-connection');
    expect(screen.getByRole('textbox', { name: t.fields.appId })).toHaveValue('77');

    await act(async () => {
      await router?.navigate('/system/users-roles');
    });
    await user.click(
      within(await screen.findByRole('dialog', { name: leave.title })).getByRole('button', {
        name: leave.confirm,
      }),
    );
    await waitFor(() => expect(router?.state.location.pathname).toBe('/system/users-roles'));
    expect(writes).toHaveLength(0);
  });

  it('고친 값이 없으면 묻지 않고 옮긴다(#358)', async () => {
    const { router } = setup();
    await screen.findByRole('textbox', { name: t.fields.appId });

    await act(async () => {
      await router?.navigate('/system/users-roles');
    });
    expect(router?.state.location.pathname).toBe('/system/users-roles');
    expect(screen.queryByRole('dialog', { name: leave.title })).toBeNull();
  });
});
