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
import { AlarmRecipientSettingsScreen } from './screen';

const t = messages.alarmRecipientSettings;
const EVENT_CODE = 'SYN-EVENT-A';
const DETAIL_ETAG = '"subscription-7"';

interface SetupOptions {
  previewUsers?: Array<{
    userId: number;
    userName: string;
    departmentName?: string;
    isActive: boolean;
  }>;
}

const setup = (options: SetupOptions = {}) => {
  const requests: Request[] = [];
  let recipients = [{ recipientTypeCode: 'ROLE' as const, businessUnitId: 21, roleId: 31 }];

  const list = (items: unknown[]) => ({ items, page: { page: 1, size: 100, total: items.length } });
  const routes: StubRoute[] = [
    {
      match: (request) => new URL(request.url).pathname === '/app/notification-events',
      respond: () =>
        jsonResponse({ items: [{ eventCode: EVENT_CODE, eventName: '합성 알림 가' }] }),
    },
    {
      match: (request) => {
        const url = new URL(request.url);
        return (
          request.method === 'GET' &&
          url.pathname === '/app/notification-subscriptions' &&
          !url.searchParams.has('eventCode')
        );
      },
      respond: () => jsonResponse({ items: [{ eventCode: EVENT_CODE, recipients }] }),
    },
    {
      match: (request) =>
        request.method === 'GET' &&
        new URL(request.url).pathname === '/app/notification-subscriptions' &&
        new URL(request.url).searchParams.get('eventCode') === EVENT_CODE,
      respond: () =>
        jsonResponse(
          { items: [{ eventCode: EVENT_CODE, recipients }] },
          { headers: { ETag: DETAIL_ETAG } },
        ),
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/business-units',
      respond: () =>
        jsonResponse(
          list([
            {
              businessUnitId: 21,
              businessUnitCode: 'BU-A',
              businessUnitName: '합성 사업부',
              legalEntityId: 1,
              isActive: true,
            },
          ]),
        ),
    },
    {
      match: (request) => new URL(request.url).pathname === '/app/roles',
      respond: () =>
        jsonResponse(
          list([
            {
              roleId: 31,
              roleCode: 'ROLE-A',
              roleName: '합성 역할',
              description: null,
              isActive: true,
            },
          ]),
        ),
    },
    {
      match: (request) => new URL(request.url).pathname === '/app/users',
      respond: () =>
        jsonResponse(
          list([
            {
              appUserId: 41,
              loginId: 'sample.user',
              userName: '합성 사용자',
              statusCode: 'EMPLOYED',
              isActive: true,
            },
          ]),
        ),
    },
    {
      match: (request) =>
        request.method === 'POST' &&
        new URL(request.url).pathname === '/app/notification-subscriptions/recipients:preview',
      respond: (request) => {
        requests.push(request.clone());
        const users = options.previewUsers ?? [
          { userId: 41, userName: '합성 사용자', departmentName: '합성 부서', isActive: false },
        ];
        return jsonResponse({
          resolvedAt: '2026-09-07T14:30:00+09:00',
          totalCount: users.length,
          users,
        });
      },
    },
    {
      match: (request) =>
        request.method === 'PUT' &&
        new URL(request.url).pathname === '/app/notification-subscriptions',
      respond: (request) => {
        requests.push(request.clone());
        recipients = [];
        return jsonResponse({ eventCode: EVENT_CODE, recipients, zaloEnabled: false });
      },
    },
  ];

  renderWithProviders(<AlarmRecipientSettingsScreen />, {
    fetch: createStubFetch(routes),
    route: '/notification/recipient-settings',
  });
  return { requests };
};

describe('AlarmRecipientSettingsScreen', () => {
  it('계약 이벤트와 설정 수를 읽기 전용 목록으로 표시한다', async () => {
    setup();

    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '합성 알림 가' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(
      await within(screen.getByRole('region', { name: t.panes.events })).findByText('1'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /알림 유형 추가/ })).not.toBeInTheDocument();
  });

  it('Zalo는 사유와 함께 비활성으로 둔다', async () => {
    setup();

    const checkbox = await screen.findByRole('checkbox', { name: t.fields.zalo });
    expect(checkbox).toBeDisabled();
    expect(screen.getByText(t.state.zaloDisabled)).toBeInTheDocument();
  });

  it('미리보기는 멱등 키와 현재 전체 규칙을 보내고 비활성 사용자를 표시한다', async () => {
    const { requests } = setup();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: t.actions.preview }));
    expect(await screen.findByText(/중복을 제외한 1명/)).toBeInTheDocument();
    expect(screen.getByText('비활성')).toBeInTheDocument();

    await waitFor(() => expect(requests).toHaveLength(1));
    const request = requests[0];
    expect(request?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(request?.headers.get('If-Match')).toBeNull();
    expect(await request?.json()).toEqual({
      recipients: [{ recipientTypeCode: 'ROLE', businessUnitId: 21, roleId: 31 }],
      zaloEnabled: false,
    });
  });

  it('수신자를 모두 빼도 경고 후 저장하며 상세 ETag를 If-Match로 보낸다', async () => {
    const { requests } = setup();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: t.actions.remove }));
    expect(screen.getByText(t.state.noRecipientsWarning)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.actions.save }));
    expect(await screen.findByText(t.state.saved)).toBeInTheDocument();

    await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
    const request = requests.find((candidate) => candidate.method === 'PUT');
    expect(request?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(request?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(new URL(request?.url ?? 'http://invalid').searchParams.get('eventCode')).toBe(
      EVENT_CODE,
    );
    expect(await request?.json()).toEqual({ recipients: [], zaloEnabled: false });
  });
});
