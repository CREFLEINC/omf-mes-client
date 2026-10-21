import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { ZaloConnectionScreen } from './screen';
import type { Connection as ZaloConnection } from './types';

const t = messages.zaloConnection;

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
  ...overrides,
});

const setup = (
  options: {
    data?: ZaloConnection;
    /** 저장 뒤 서버가 돌려주는 값(PUT 응답이자 그 뒤의 GET) */
    saved?: ZaloConnection;
    respondPut?: (request: Request) => Response;
  } = {},
) => {
  const writes: Request[] = [];
  let data = options.data ?? connection();
  renderWithProviders(<ZaloConnectionScreen />, {
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
  });
  return { writes };
};

describe('ZaloConnectionScreen', () => {
  it('제목 아래 부제와 상태 Chip, 이벤트 6행의 고정 파라미터를 보인다', async () => {
    setup();

    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(screen.getByText(t.subtitle)).toBeInTheDocument();
    expect(await screen.findByText(t.status.ACTIVE)).toBeInTheDocument();
    expect(
      await screen.findByRole('textbox', { name: t.fields.templateId('생산 중단') }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${t.fields.params}: wo_no, item, process, line, reason, event_time, actor`),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /파라미터 복사$/ })).toHaveLength(6);
  });

  it('US7-1 비밀값은 다시 보이지 않고 「등록됨」으로만 보인다', async () => {
    setup();

    expect(await screen.findAllByText(t.values.registered)).toHaveLength(2);
    expect(screen.queryByLabelText(t.fields.secretKey)).toBeNull();
  });

  it('US7-1 비밀값을 바꾸지 않고 저장하면 본문에서 생략하고 If-Match 를 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = setup();

    const template = await screen.findByRole('textbox', { name: t.fields.templateId('생산 마감') });
    await user.type(template, 'TPL04');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

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
    await user.click(screen.getByRole('button', { name: t.actions.save }));

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
    await user.click(screen.getByRole('button', { name: t.actions.save }));

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
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.state.conflict)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.reload })).toBeInTheDocument();
  });

  it('재등록 필요면 error Chip 과 안내, 마지막 오류, 서버 발송 꺼짐 배너를 보인다', async () => {
    setup({
      data: connection({
        status: 'REAUTH_REQUIRED',
        lastErrorCode: '-14014',
        lastErrorMessage: '갱신 토큰이 무효입니다',
        deliveryEnabled: false,
      }),
    });

    expect(await screen.findByText(t.status.REAUTH_REQUIRED)).toBeInTheDocument();
    expect(screen.getByText(t.state.reauth)).toBeInTheDocument();
    expect(screen.getByText('-14014 갱신 토큰이 무효입니다')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.state.saved)).toBeInTheDocument();
    expect(await screen.findByText(t.status.ACTIVE)).toBeInTheDocument();
    expect(screen.queryByText(t.status.NOT_CONFIGURED)).toBeNull();
    expect(screen.getAllByText(t.values.registered)).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: t.fields.appId })).toHaveValue('123');
    expect(screen.getByRole('textbox', { name: t.fields.templateId('생산 실행') })).toHaveValue(
      '100',
    );
  });
});
