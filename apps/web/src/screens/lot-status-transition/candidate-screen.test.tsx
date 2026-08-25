import type { components } from '@omf-mes/api-client';
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
  EMPTY_LOT_STATUS_CANDIDATE_FILTERS,
  LotStatusTransitionCandidateScreen,
  toLotStatusCandidateQuery,
} from './candidate-screen';

const LOT_PATH = '/quality/lot-statuses';
const lot: components['schemas']['LotQualityStatus'] = {
  lotId: 701,
  lotNo: 'SYN-LOT-ALPHA',
  itemId: 801,
  lotTypeCode: 'MATERIAL',
  lotStatusCode: 'NORMAL',
  versionNo: 987654,
  onHandQty: 25,
  heldQty: 5,
  fullyHeld: false,
};
const page = (items: components['schemas']['LotQualityStatus'][] = [lot], current = 1) => ({
  items,
  page: { page: current, size: 1, total: 2 },
});
const listRoute = (body: unknown = page(), status = 200): StubRoute => ({
  match: (request) => new URL(request.url).pathname === LOT_PATH,
  respond: () => jsonResponse(body, { status }),
});
const lookupRoutes: StubRoute[] = [
  {
    match: (request) => new URL(request.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: [
          {
            itemId: 801,
            itemCode: 'SYN-ITEM-A',
            itemName: '합성 자재',
            itemTypeCode: 'MATERIAL',
            baseUomId: 1,
            lotControlTypeCode: 'LOT',
            serialControlTypeCode: 'NONE',
            inspectionRequired: false,
            fifoPolicyCode: 'FIFO',
            negativeStockAllowed: false,
            isActive: true,
          },
        ],
        page: { page: 1, size: 50, total: 1 },
      }),
  },
  {
    match: (request) => new URL(request.url).pathname === '/mdm/code-values',
    respond: () =>
      jsonResponse({
        items: [
          {
            codeValueId: 901,
            codeGroupId: 902,
            code: 'NORMAL',
            codeName: '정상',
            displayOrder: 1,
            isActive: true,
          },
        ],
        page: { page: 1, size: 50, total: 1 },
      }),
  },
];

const renderScreen = (routes: StubRoute[]) => {
  const urls: URL[] = [];
  const stub = createStubFetch([...lookupRoutes, ...routes]);
  renderWithProviders(<LotStatusTransitionCandidateScreen />, {
    fetch: async (request) => {
      urls.push(new URL(request.url));
      return stub(request);
    },
  });
  return { urls, user: userEvent.setup() };
};
const lotRequests = (urls: URL[]): URL[] => urls.filter((url) => url.pathname === LOT_PATH);
const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('Lot Status 전이 후보', () => {
  it('heldOnly 없이 LOT 번호·품목·품질 상태와 page만 직렬화한다', () => {
    expect(
      toLotStatusCandidateQuery({ q: 'SYN-LOT', itemId: '801', lotStatusCode: 'NORMAL' }, 3),
    ).toEqual({ q: 'SYN-LOT', itemId: 801, lotStatusCode: 'NORMAL', page: 3 });
    expect(toLotStatusCandidateQuery(EMPTY_LOT_STATUS_CANDIDATE_FILTERS, 1)).toEqual({});
  });

  it('필터 초안을 조회·초기화하고 요청에 heldOnly를 보내지 않는다', async () => {
    const { urls, user } = renderScreen([listRoute()]);
    await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    await user.type(screen.getByLabelText('LOT 번호'), 'SYN-LOT');
    await choose(user, '자재', 'SYN-ITEM-A · 합성 자재');
    await choose(user, '품질 상태', '정상');
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => expect(lotRequests(urls)).toHaveLength(2));
    expect(Object.fromEntries(lotRequests(urls)[1]!.searchParams)).toEqual({
      lotStatusCode: 'NORMAL',
      itemId: '801',
      q: 'SYN-LOT',
    });
    expect(lotRequests(urls)[1]!.searchParams.has('heldOnly')).toBe(false);
    await user.click(screen.getByRole('button', { name: '초기화' }));
    await waitFor(() => expect(lotRequests(urls)).toHaveLength(3));
    expect([...lotRequests(urls)[2]!.searchParams]).toEqual([]);
  });

  it('한 행만 선택해 업무 식별·현재 상태 카드를 보이고 versionNo는 숨긴다', async () => {
    const { user } = renderScreen([listRoute()]);
    const select = await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    await user.click(select);

    const card = screen.getByRole('region', { name: '선택한 LOT' });
    expect(within(card).getByText('SYN-LOT-ALPHA')).toBeVisible();
    expect(within(card).getByText('SYN-ITEM-A · 합성 자재')).toBeVisible();
    expect(within(card).getByText('정상')).toBeVisible();
    expect(select).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByText('987654')).toBeNull();
  });

  it('다음 쪽으로 이동하면 page를 보내고 앞 선택을 지운다', async () => {
    const { urls, user } = renderScreen([
      {
        match: (request) => new URL(request.url).pathname === LOT_PATH,
        respond: (request) => {
          const requestedPage = Number(new URL(request.url).searchParams.get('page') ?? 1);
          return jsonResponse(
            page([{ ...lot, lotNo: `SYN-LOT-P${requestedPage}` }], requestedPage),
          );
        },
      },
    ]);
    await user.click(await screen.findByRole('button', { name: 'SYN-LOT-P1 선택' }));
    await user.click(screen.getByRole('button', { name: '다음 쪽' }));

    await screen.findByRole('button', { name: 'SYN-LOT-P2 선택' });
    expect(lotRequests(urls).at(-1)?.searchParams.get('page')).toBe('2');
    expect(screen.queryByRole('region', { name: '선택한 LOT' })).toBeNull();
  });

  it.each([
    ['error', listRoute({ message: 'synthetic' }, 500), 'LOT 후보를 불러오지 못했습니다.'],
    ['empty', listRoute(page([])), '조건에 맞는 LOT이 없습니다.'],
  ])('%s 상태를 정상 목록과 구분한다', async (_mode, route, message) => {
    renderScreen([route]);
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.queryByRole('button', { name: /선택$/ })).toBeNull();
  });

  it('첫 응답 전에는 로딩 상태를 표시한다', () => {
    renderScreen([
      {
        match: (request) => new URL(request.url).pathname === LOT_PATH,
        respond: () => new Response(),
      },
    ]);
    expect(screen.getByRole('status', { name: 'LOT 후보를 불러오는 중' })).toBeVisible();
  });
});
