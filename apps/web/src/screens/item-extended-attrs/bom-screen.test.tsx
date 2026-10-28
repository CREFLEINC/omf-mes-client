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
import { ItemBomScreen } from './bom-screen';
import {
  bomComponentFixtures,
  bomFixtures,
  itemFixtures,
  processFixtures,
  routingFixtures,
  routingOperationFixtures,
  uomFixtures,
} from './fixtures';

/**
 * BOM 탭(`bom-screen.tsx`) — 「ERP 연동 현황·이력 > BOM」 짜임(사용자 지시 2026-10-28). 지어낸 합성값만 쓴다.
 *
 * 모품목 1001 의 BOM 은 둘(2001 · 2002, 기본은 2002). 2001 의 구성품은 1002 · 9001(품목 없음) · 1003 이고, 그 품목들은
 * 하위 BOM 이 없다 — 하이라키가 한 단계로 선다.
 */

const ROUTE = '/master-data/item-boms';
const ITEMS_PATH = '/mdm/items';
const BOMS_PATH = '/planning/boms';
const COMPONENT_PATH = /^\/planning\/boms\/(\d+)\/components\/(\d+)$/;
const COMPONENTS_PATH = /^\/planning\/boms\/(\d+)\/components$/;

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const pathOf = (request: Request): string => new URL(request.url).pathname;

const routes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, ITEMS_PATH),
    respond: () =>
      jsonResponse({
        items: itemFixtures,
        page: { page: 1, size: 50, total: itemFixtures.length },
      }),
  },
  {
    match: (request) => request.method === 'GET' && /^\/mdm\/items\/\d+$/.test(pathOf(request)),
    respond: (request) => {
      const itemId = Number(pathOf(request).split('/').pop());
      const item = itemFixtures.find((row) => row.itemId === itemId);
      return item === undefined
        ? jsonResponse({ message: '없는 품목입니다' }, { status: 404 })
        : jsonResponse({ item, editability: { codeEditable: false, reason: 'EDITABLE' } });
    },
  },
  {
    match: (request) => isGet(request, BOMS_PATH),
    respond: (request) => {
      const parentItemId = Number(new URL(request.url).searchParams.get('parentItemId'));
      return jsonResponse({
        items: bomFixtures.filter((row) => row.parentItemId === parentItemId),
      });
    },
  },
  {
    match: (request) => request.method === 'GET' && COMPONENTS_PATH.test(pathOf(request)),
    respond: (request) => {
      const bomId = Number(COMPONENTS_PATH.exec(pathOf(request))?.[1]);
      return jsonResponse({ items: bomComponentFixtures.filter((row) => row.bomId === bomId) });
    },
  },
  {
    match: (request) => request.method === 'GET' && COMPONENT_PATH.test(pathOf(request)),
    respond: (request) => {
      const bomComponentId = Number(COMPONENT_PATH.exec(pathOf(request))?.[2]);
      return jsonResponse(
        {
          bomComponent: bomComponentFixtures.find((row) => row.bomComponentId === bomComponentId),
          editability: { codeEditable: false, reason: 'RECEIVED_FROM_ERP', referenceCount: 0 },
        },
        { headers: { ETag: 'W/"3"' } },
      );
    },
  },
  {
    match: (request) => request.method === 'PUT' && COMPONENT_PATH.test(pathOf(request)),
    respond: (request) => {
      const bomComponentId = Number(COMPONENT_PATH.exec(pathOf(request))?.[2]);
      return jsonResponse(
        bomComponentFixtures.find((row) => row.bomComponentId === bomComponentId),
        { headers: { ETag: 'W/"4"' } },
      );
    },
  },
  {
    match: (request) => request.method === 'POST' && pathOf(request).endsWith(':set-default'),
    respond: () => jsonResponse({ ...bomFixtures[0], isDefault: true }),
  },
  {
    match: (request) => isGet(request, '/mdm/uoms'),
    respond: () =>
      jsonResponse({ items: uomFixtures, page: { page: 1, size: 50, total: uomFixtures.length } }),
  },
  {
    match: (request) => isGet(request, '/planning/routings'),
    respond: () => jsonResponse({ items: routingFixtures }),
  },
  {
    match: (request) =>
      request.method === 'GET' && /^\/planning\/routings\/\d+\/operations$/.test(pathOf(request)),
    respond: (request) =>
      jsonResponse({
        items: routingOperationFixtures[Number(pathOf(request).split('/')[3])] ?? [],
      }),
  },
  {
    match: (request) => isGet(request, '/mdm/processes'),
    respond: () =>
      jsonResponse({
        items: processFixtures,
        page: { page: 1, size: 50, total: processFixtures.length },
      }),
  },
  {
    match: (request) => isGet(request, '/mdm/code-values'),
    respond: (request) => {
      const group = new URL(request.url).searchParams.get('codeGroupCode');
      const items =
        group === 'ITEM_TYPE'
          ? [{ code: 'FINISHED', codeName: '제품' }]
          : group === 'MASTER_VERSION_STATUS'
            ? [{ code: 'SYN-BOM-STATUS-A', codeName: '합성 상태 A' }]
            : [];
      return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
    },
  },
];

let probeSearch = '';

const RouterProbe = () => {
  probeSearch = useLocation().search;
  return null;
};

const renderScreen = (search = '') => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes());
  const fetch: StubFetch = async (request) => {
    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });
    return stub(request);
  };

  probeSearch = '';
  renderWithProviders(
    <>
      <ItemBomScreen />
      <RouterProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
};

describe('ItemBomScreen — 모품목 목록', () => {
  it('처음은 제품 · BOM 있는 품목만으로 부르고, 고르기 전에는 BOM 을 부르지 않는다', async () => {
    const { requests } = renderScreen();

    expect(await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' })).toBeInTheDocument();

    const list = requests.find((request) => request.url.pathname === ITEMS_PATH)!;
    expect(list.url.searchParams.get('itemTypeCode')).toBe('FINISHED');
    expect(list.url.searchParams.get('hasBom')).toBe('true');
    expect(list.url.searchParams.get('includeInactive')).toBe('true');
    expect(requests.some((request) => request.url.pathname === BOMS_PATH)).toBe(false);
    expect(screen.getByText('모품목을 고르세요')).toBeInTheDocument();
  });

  it('BOM 있는 품목만을 끄면 그 조건을 싣지 않는다', async () => {
    const { requests, user } = renderScreen();

    await user.click(await screen.findByRole('checkbox', { name: 'BOM 있는 품목만' }));

    await waitFor(() => {
      expect(probeSearch).toBe('?bom=all');
    });
    const last = requests.filter((request) => request.url.pathname === ITEMS_PATH).at(-1)!;
    expect(last.url.searchParams.has('hasBom')).toBe(false);
  });

  it('줄을 고르면 주소에 남고 기본 BOM 을 연다', async () => {
    const { user } = renderScreen();

    await user.click(await screen.findByRole('button', { name: 'SYN-ITEM-01 선택' }));

    expect(probeSearch).toBe('?item=1001');
    /* 기본 BOM 은 2002 — 사실 칸에 그 코드가 선다. */
    expect(await screen.findByText('SYN-BOM-02')).toBeInTheDocument();
  });
});

describe('ItemBomScreen — 하이라키', () => {
  it('모품목 아래로 구성품을 들여 쓰고 원본 열과 확장 열을 낸다', async () => {
    renderScreen('?item=1001&rev=2001');

    const table = await screen.findByRole('table', { name: '구성품' });

    await waitFor(() => {
      expect(within(table).getByText('SYN-ITEM-02')).toBeInTheDocument();
    });
    /* 손실률은 「BOM 조회 (ERP)」와 같이 퍼센트로. */
    expect(within(table).getByText('5%')).toBeInTheDocument();
    /* 확장 표시는 켜진 것만 칩으로. */
    expect(within(table).getAllByText('LOT 추적').length).toBeGreaterThan(0);
    /* 뿌리 줄에는 편집 단추가 없고, 구성품 줄마다 하나씩이다. */
    expect(within(table).getAllByRole('button', { name: /확장 열 수정$/ })).toHaveLength(3);
  });

  it('BOM 이 여럿이면 고르는 칸을 두고, 기본이 아닌 BOM 에 기본 지정을 둔다', async () => {
    renderScreen('?item=1001&rev=2001');

    expect(await screen.findByRole('combobox', { name: 'BOM' })).toHaveTextContent(
      'SYN-BOM-01 · Rev 1',
    );
    expect(screen.getByRole('button', { name: '기본으로 지정' })).toBeInTheDocument();
  });

  it('기본 BOM 을 보고 있으면 기본 지정 단추가 없다', async () => {
    renderScreen('?item=1001');

    await screen.findByRole('combobox', { name: 'BOM' });
    expect(screen.queryByRole('button', { name: '기본으로 지정' })).not.toBeInTheDocument();
  });
});

describe('ItemBomScreen — 쓰기', () => {
  it('기본 지정은 확인 창의 확인으로 한 번만 나간다', async () => {
    const { requests, user } = renderScreen('?item=1001&rev=2001');

    await user.click(await screen.findByRole('button', { name: '기본으로 지정' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '기본으로 지정' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    });
    expect(requests.find((request) => request.method === 'POST')!.url.pathname).toBe(
      '/planning/boms/2001:set-default',
    );
  });

  it('구성품 확장 열은 행 상세의 토큰으로 저장하고 확장 열만 싣는다', async () => {
    const { requests, user } = renderScreen('?item=1001&rev=2001');

    await screen.findByRole('table', { name: '구성품' });
    await user.click(
      await screen.findByRole('button', { name: '1. SYN-ITEM-02 · 합성 품목 B 확장 열 수정' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('switch', { name: 'LOT 추적 강제' }));
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    });
    const put = requests.find((request) => request.method === 'PUT')!;
    expect(put.url.pathname).toBe('/planning/boms/2001/components/7001');
    expect(put.headers.get('If-Match')).toBe('W/"3"');
    expect(Object.keys(JSON.parse(put.body) as object).sort()).toEqual([
      'actualUseProcessId',
      'backflushAllowed',
      'lotTraceRequired',
      'routingOperationId',
    ]);
  });
});

/* 사실 칸 — 품목 칸과 그 BOM 칸이 한 줄이다. */
describe('ItemBomScreen — 모품목 상세', () => {
  it('고른 BOM 의 코드 · Rev · 상태 이름을 낸다', async () => {
    renderScreen('?item=1001&rev=2001');

    const facts = await screen.findByLabelText('모품목 상세');
    await waitFor(() => {
      expect(within(facts).getByText('합성 상태 A')).toBeInTheDocument();
    });
    expect(within(facts).getByText('SYN-BOM-01')).toBeInTheDocument();
    expect(within(facts).getByText('SYN-ITEM-01')).toBeInTheDocument();
  });
});
