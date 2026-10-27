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
import { ErpOutboundScreen } from './screen';

const ROUTE = '/master-data/erp-outbound';
const SETTINGS_PATH = '/integration/outbound-item-settings';
const MESSAGES_PATH = '/integration/messages';

/** 서버 응답 그대로 — 차례 · 이름은 서버가 정한다. 짝(interfaceCode)은 아직 싣지 않는다(앞선 서버). */
const SETTINGS = {
  items: [
    {
      outboundItemCode: 'PRODUCTION_RESULT',
      outboundItemName: '생산 실적',
      enabled: true,
      locked: true,
      lockReason: '필수',
      pendingMessageCount: 0,
    },
    {
      outboundItemCode: 'GOODS_RECEIPT',
      outboundItemName: '입고 (G/R)',
      enabled: true,
      locked: false,
      pendingMessageCount: 0,
    },
    {
      outboundItemCode: 'SHIPMENT_PGI',
      outboundItemName: '출하 (PGI)',
      enabled: false,
      locked: false,
      pendingMessageCount: 0,
    },
    {
      outboundItemCode: 'RETURN',
      outboundItemName: '반품',
      enabled: true,
      locked: false,
      pendingMessageCount: 0,
    },
  ],
};

/** 인터페이스 · 상태별 건수(목록의 page.total). */
const COUNTS: Record<string, number> = {
  'IF-WO-CLOSE-SEND:PENDING': 0,
  'IF-WO-CLOSE-SEND:FAILED': 0,
  'IF-GR-SEND:PENDING': 2,
  'IF-GR-SEND:FAILED': 1,
  'IF-SHIPMENT-PGI-SEND:PENDING': 0,
  'IF-SHIPMENT-PGI-SEND:FAILED': 0,
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
    const key = `${query.get('interfaceCode') ?? ''}:${query.get('statusCode') ?? ''}`;
    const total = COUNTS[key] ?? 0;
    const items = query.get('size') === '1' ? [] : key === 'IF-GR-SEND:PENDING' ? GR_PENDING : [];

    return jsonResponse({ items, page: { page: 1, size: 20, total } });
  },
});

const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderScreen = (routes: StubRoute[], search = '') => {
  const requests: URL[] = [];
  const stub = createStubFetch(routes);
  const fetch: StubFetch = async (request) => {
    requests.push(new URL(request.url));

    return stub(request);
  };

  renderWithProviders(
    <>
      <ErpOutboundScreen />
      <LocationProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
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

  it('건수는 송신 · 상태 · 인터페이스로 좁혀 넓은 기간으로 센다', async () => {
    const { requests } = renderScreen([settingsRoute, messagesRoute()]);

    await waitFor(() => {
      expect(requests.filter((url) => url.searchParams.get('size') === '1')).toHaveLength(6);
    });
    const gr = requests.find(
      (url) =>
        url.searchParams.get('size') === '1' &&
        url.searchParams.get('interfaceCode') === 'IF-GR-SEND' &&
        url.searchParams.get('statusCode') === 'PENDING',
    );
    expect(gr?.searchParams.get('directionCode')).toBe('OUTBOUND');
    expect(gr?.searchParams.get('createdFrom')).toBe('2000-01-01T00:00:00.000Z');
    expect(gr?.searchParams.get('createdTo')).toBe('2100-01-01T00:00:00.000Z');
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
    expect(pendingPane().getByText('IF-GR-SEND:SAMPLE-GR-0001')).toBeInTheDocument();
    expect(pendingPane().getByText('GOODS_RECEIPT · 7702')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(`${ROUTE}?item=GOODS_RECEIPT`);

    const list = pendingListRequests(requests).at(-1);
    expect(list?.searchParams.get('interfaceCode')).toBe('IF-GR-SEND');
    expect(list?.searchParams.get('statusCode')).toBe('PENDING');
    expect(list?.searchParams.get('directionCode')).toBe('OUTBOUND');
  });

  it('메시지 키는 연동 현황 · 이력에서 그 건의 상세를 연다', async () => {
    renderScreen([settingsRoute, messagesRoute()], '?item=GOODS_RECEIPT');

    expect(
      await pendingPane().findByRole('link', { name: 'IF-GR-SEND:SAMPLE-GR-0001 상세 열기' }),
    ).toHaveAttribute('href', '/master-data/integration-sync?sel=9101');
  });

  it('송신이 없는 항목(반품)은 목록을 부르지 않고 그 사실만 말한다', async () => {
    const { requests } = renderScreen([settingsRoute, messagesRoute()], '?item=RETURN');

    expect(await pendingPane().findByText('아직 ERP로 보내지 않는 항목입니다')).toBeInTheDocument();
    expect(pendingListRequests(requests)).toHaveLength(0);
  });

  it('메시지를 읽을 권한이 없으면(403) 권한 안내를 내고 건수는 「—」다', async () => {
    renderScreen([settingsRoute, messagesRoute(403)], '?item=GOODS_RECEIPT');

    expect(
      await pendingPane().findByText(
        '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
    expect(
      within(itemRow('입고 (G/R)'))
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['입고 (G/R)', '켜짐', '—', '—']);
  });
});
