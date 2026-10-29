import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { messageRow } from '../integration-sync/fixtures';
import type { Session } from '../../patterns/session';
import { ErpOutboundScreen } from './screen';

const ROUTE = '/master-data/erp-outbound';
const SETTINGS_PATH = '/integration/outbound-item-settings';
const MESSAGES_PATH = '/integration/messages';

/** 서버 응답 그대로(서버 #849) — 차례 · 이름 · 짝 · 대기 · 실패 건수는 서버가 정한다. 송신 켜짐은 시험마다 붙인다. */
const SETTINGS = {
  items: [
    {
      outboundItemCode: 'PRODUCTION_RESULT',
      outboundItemName: '생산 실적',
      enabled: true,
      locked: true,
      lockReason: '필수',
      interfaceCode: 'IF-WO-CLOSE-SEND',
      pendingMessageCount: 0,
      failedMessageCount: 0,
    },
    {
      outboundItemCode: 'GOODS_RECEIPT',
      outboundItemName: '입고 (G/R)',
      enabled: true,
      locked: false,
      interfaceCode: 'IF-GR-SEND',
      pendingMessageCount: 2,
      failedMessageCount: 1,
    },
    {
      outboundItemCode: 'SHIPMENT_PGI',
      outboundItemName: '출하 (PGI)',
      enabled: false,
      locked: false,
      interfaceCode: 'IF-SHIPMENT-PGI-SEND',
      pendingMessageCount: 0,
      failedMessageCount: 0,
    },
    {
      outboundItemCode: 'RETURN',
      outboundItemName: '반품',
      enabled: true,
      locked: false,
      interfaceCode: null,
      pendingMessageCount: 0,
      failedMessageCount: 0,
    },
  ],
};

const GR_PENDING = [
  messageRow({
    integrationMessageId: 9101,
    messageKey: 'IF-GR-SEND:SAMPLE-GR-0001',
    interfaceCode: 'IF-GR-SEND',
    directionCode: 'OUTBOUND',
    statusCode: 'PENDING',
    targetTypeCode: 'GOODS_RECEIPT',
    targetId: 7701,
    retryCount: 0,
    lastErrorMessage: null,
  }),
  messageRow({
    integrationMessageId: 9102,
    messageKey: 'IF-GR-SEND:SAMPLE-GR-0002',
    interfaceCode: 'IF-GR-SEND',
    directionCode: 'OUTBOUND',
    statusCode: 'PENDING',
    targetTypeCode: 'GOODS_RECEIPT',
    targetId: 7702,
    retryCount: 0,
    lastErrorMessage: null,
  }),
];

const settingsRoute: StubRoute = {
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === SETTINGS_PATH,
  respond: () => jsonResponse(SETTINGS),
};

/** 건수(한 줄만 받는 조회)와 송신 예정 목록을 한 경로에서 가른다. */
const messagesRoute = (status = 200): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === MESSAGES_PATH,
  respond: (request) => {
    if (status !== 200) return jsonResponse({ message: '' }, { status });
    const query = new URL(request.url).searchParams;
    const isGrPending =
      query.get('interfaceCode') === 'IF-GR-SEND' && query.get('statusCode') === 'PENDING';
    const items = isGrPending ? GR_PENDING : [];

    return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
  },
});

const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderScreen = (routes: StubRoute[], search = '', session?: Session | null) => {
  const requests: URL[] = [];
  const stub = createStubFetch(routes);
  const fetch: StubFetch = async (request) => {
    requests.push(new URL(request.url));

    return stub(request);
  };

  renderWithProviders(
    <>
      {/* 탭 막대 오른쪽 칩 자리(app/hub-tabs.tsx) — 화면이 그리기 전에 서 있어야 칩이 꽂힌다. */}
      <div id="hub-actions" data-testid="hub-actions" />
      <ErpOutboundScreen />
      <LocationProbe />
    </>,
    { fetch, route: `${ROUTE}${search}`, ...(session === undefined ? {} : { session }) },
  );

  return { requests, user: userEvent.setup() };
};

const itemsPane = () => within(screen.getByRole('region', { name: '송신 항목' }));
const pendingPane = () => within(screen.getByRole('region', { name: '송신 예정' }));
const itemRow = (name: string): HTMLElement => {
  const row = itemsPane()
    .getByRole('button', { name: `${name} 선택` })
    .closest('tr');
  if (row === null) throw new Error(`${name} 줄이 없습니다`);

  return row;
};
const pendingListRequests = (requests: URL[]) =>
  requests.filter((url) => url.pathname === MESSAGES_PATH && url.searchParams.get('size') !== '1');

describe('ErpOutboundScreen — 송신 항목', () => {
  it('송신 항목마다 송신 여부와 대기 · 실패 건수를 낸다 — 송신이 없는 항목은 「—」다', async () => {
    renderScreen([settingsRoute, messagesRoute()]);

    await itemsPane().findByRole('button', { name: '입고 (G/R) 선택' });
    await waitFor(() => {
      expect(
        within(itemRow('입고 (G/R)'))
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ).toEqual(['입고 (G/R)', '켜짐', '2', '1']);
    });
    expect(within(itemRow('생산 실적')).getByText('필수')).toBeInTheDocument();
    expect(within(itemRow('출하 (PGI)')).getByText('꺼짐')).toBeInTheDocument();
    expect(
      within(itemRow('반품'))
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['반품', '켜짐', '—', '—']);
  });

  it('건수는 송신 항목 설정에 실려 오는 서버 값이다 — 메시지 목록을 따로 세지 않는다', async () => {
    const { requests } = renderScreen([settingsRoute, messagesRoute()]);

    await waitFor(() => {
      expect(within(itemRow('입고 (G/R)')).getByText('2')).toBeInTheDocument();
    });
    expect(requests.filter((url) => url.searchParams.get('size') === '1')).toHaveLength(0);
  });
});

describe('ErpOutboundScreen — 탭 막대 칩', () => {
  it('송신이 꺼진 서버면 「송신 꺼짐」 칩을 맨 앞에 세운다', async () => {
    renderScreen([
      {
        match: (request) =>
          request.method === 'GET' && new URL(request.url).pathname === SETTINGS_PATH,
        respond: () => jsonResponse({ ...SETTINGS, sendEnabled: false }),
      },
      messagesRoute(),
    ]);

    const hub = within(screen.getByTestId('hub-actions'));
    expect(await hub.findByText('송신 꺼짐')).toBeInTheDocument();
    expect(await hub.findByText(/^송신 대기 /)).toBeInTheDocument();
  });

  it('켜짐을 모르는 서버(응답에 없음)면 켜짐 칩을 세우지 않는다', async () => {
    renderScreen([settingsRoute, messagesRoute()]);

    const hub = within(screen.getByTestId('hub-actions'));
    expect(await hub.findByText(/^송신 대기 /)).toBeInTheDocument();
    expect(hub.queryByText(/^송신 (켜짐|꺼짐)$/)).toBeNull();
  });
});

describe('ErpOutboundScreen — 끝 쪽 넘김', () => {
  it('송신 예정이 끝 쪽을 넘었으면 「첫 쪽으로」로 빠져나간다', async () => {
    /* 3쪽을 보던 사이 송신기가 대기를 비웠다 — 전체는 2건인데 3쪽을 부른다. */
    const beyondRoute: StubRoute = {
      match: (request) => {
        const url = new URL(request.url);
        return url.pathname === MESSAGES_PATH && url.searchParams.get('page') === '3';
      },
      respond: () => jsonResponse({ items: [], page: { page: 3, size: 20, total: 2 } }),
    };
    const { user } = renderScreen(
      [beyondRoute, settingsRoute, messagesRoute()],
      '?item=GOODS_RECEIPT&page=3',
    );

    expect(await pendingPane().findByText('이 쪽에는 보낼 건이 없습니다')).toBeInTheDocument();
    await user.click(pendingPane().getByRole('button', { name: '첫 쪽으로' }));

    expect(await pendingPane().findByText('SAMPLE-GR-0001')).toBeInTheDocument();
    expect(screen.getByTestId('location')).not.toHaveTextContent('page=');
  });
});

describe('ErpOutboundScreen — 송신 예정 목록', () => {
  it('고르지 않았으면 첫 항목을 연다', async () => {
    renderScreen([settingsRoute, messagesRoute()]);

    expect(await pendingPane().findByText('보낼 건이 없습니다')).toBeInTheDocument();
    expect(
      pendingPane().getByRole('heading', { name: '생산 실적 · 송신 예정 0건' }),
    ).toBeInTheDocument();
    expect(itemsPane().getByRole('button', { name: '생산 실적 선택' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('항목 줄을 누르면 그 항목의 송신 예정을 주소에 남기고 목록으로 낸다', async () => {
    const { requests, user } = renderScreen([settingsRoute, messagesRoute()]);

    await user.click(await itemsPane().findByText('입고 (G/R)'));

    expect(
      await pendingPane().findByRole('heading', { name: '입고 (G/R) · 송신 예정 2건' }),
    ).toBeInTheDocument();
    // 메시지 키 대신 업무 번호만 — 연계 코드 · 대상 코드는 보이지 않는다(사용자 지시 2026-10-27).
    expect(pendingPane().getByText('SAMPLE-GR-0001')).toBeInTheDocument();
    expect(pendingPane().queryByText('IF-GR-SEND:SAMPLE-GR-0001')).toBeNull();
    expect(pendingPane().queryByText('GOODS_RECEIPT · 7702')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent(`${ROUTE}?item=GOODS_RECEIPT`);

    const list = pendingListRequests(requests).at(-1);
    expect(list?.searchParams.get('interfaceCode')).toBe('IF-GR-SEND');
    expect(list?.searchParams.get('statusCode')).toBe('PENDING');
    expect(list?.searchParams.get('directionCode')).toBe('OUTBOUND');
  });

  it('생성일 — 처음은 전체, 최근 1주일 단추는 오늘 포함 7일로, 날짜 두 칸은 「조회」로 건다', async () => {
    const { requests, user } = renderScreen(
      [settingsRoute, messagesRoute()],
      '?item=GOODS_RECEIPT',
    );

    await pendingPane().findByText('SAMPLE-GR-0001');
    expect(pendingPane().getByRole('button', { name: '전체' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // 처음은 기간 없이 부른다(대기는 기간 없이 부를 수 있다 — 서버 #849).
    expect(pendingListRequests(requests).at(-1)?.searchParams.has('createdFrom')).toBe(false);

    await user.click(pendingPane().getByRole('button', { name: '최근 1주일' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(/from=\d{4}-\d{2}-\d{2}&to=/);
    });
    expect(pendingPane().getByRole('button', { name: '최근 1주일' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => {
      expect(pendingListRequests(requests).at(-1)?.searchParams.get('createdFrom')).toMatch(
        /T00:00:00[+-]\d{2}:\d{2}$/,
      );
    });

    const from = pendingPane().getByLabelText('시작일');
    const to = pendingPane().getByLabelText('종료일');
    await user.clear(from);
    await user.type(from, '2026-10-01');
    await user.clear(to);
    await user.type(to, '2026-10-20');
    await user.click(pendingPane().getByRole('button', { name: '조회' }));

    await waitFor(() => {
      const last = pendingListRequests(requests).at(-1);
      expect(last?.searchParams.get('createdFrom')).toMatch(/^2026-10-01T00:00:00/);
      expect(last?.searchParams.get('createdTo')).toMatch(/^2026-10-20T23:59:59/);
    });
    // 바로 고르는 범위와 다르면 어느 단추도 눌려 있지 않다.
    expect(pendingPane().getByRole('button', { name: '최근 1주일' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('생성일 칸이 거꾸로면 조회를 잠그고 사유를 낸다', async () => {
    const { user } = renderScreen([settingsRoute, messagesRoute()], '?item=GOODS_RECEIPT');
    await pendingPane().findByText('SAMPLE-GR-0001');

    await user.type(pendingPane().getByLabelText('시작일'), '2026-10-20');
    await user.type(pendingPane().getByLabelText('종료일'), '2026-10-01');

    expect(pendingPane().getByRole('button', { name: '조회' })).toBeDisabled();
    expect(
      pendingPane().getByText('기간 종료는 기간 시작보다 앞설 수 없습니다.'),
    ).toBeInTheDocument();
  });

  it('메시지 키는 연동 현황 · 이력에서 그 건의 상세를 연다', async () => {
    renderScreen([settingsRoute, messagesRoute()], '?item=GOODS_RECEIPT');

    expect(
      await pendingPane().findByRole('link', { name: '입고 (G/R) SAMPLE-GR-0001 상세 열기' }),
    ).toHaveAttribute('href', '/master-data/integration-sync?sel=9101');
  });

  it('송신이 없는 항목(반품)은 목록을 부르지 않고 그 사실만 말한다', async () => {
    const { requests } = renderScreen([settingsRoute, messagesRoute()], '?item=RETURN');

    expect(await pendingPane().findByText('아직 ERP로 보내지 않는 항목입니다')).toBeInTheDocument();
    expect(pendingListRequests(requests)).toHaveLength(0);
  });

  it('송신 항목 설정을 읽을 권한이 없으면(403) 목록 대신 권한 안내를 낸다', async () => {
    renderScreen(
      [
        {
          match: (request) =>
            request.method === 'GET' && new URL(request.url).pathname === SETTINGS_PATH,
          respond: () => jsonResponse({ message: '' }, { status: 403 }),
        },
        messagesRoute(),
      ],
      '?item=GOODS_RECEIPT',
    );

    expect(
      await itemsPane().findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('메시지를 읽을 권한이 없으면(403) 송신 예정 자리에 권한 안내를 낸다', async () => {
    renderScreen([settingsRoute, messagesRoute(403)], '?item=GOODS_RECEIPT');

    expect(
      await pendingPane().findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });
});
