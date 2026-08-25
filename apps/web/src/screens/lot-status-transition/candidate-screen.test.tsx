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
  availableQty: 20,
  fullyHeld: false,
  latestTransitionAt: '2026-08-21T12:34:00+09:00',
  latestReasonCode: 'SYN-REASON-A',
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
    match: (request) => new URL(request.url).pathname === '/quality/lot-status-transitions',
    respond: (request) => {
      const lotId = Number(new URL(request.url).searchParams.get('lotId'));
      return jsonResponse({
        lotId,
        currentLotStatusCode: 'NORMAL',
        transitions:
          lotId === 701
            ? [{ actionCode: 'CREATE_HOLD', targetLotStatusCode: 'DEFECTIVE', allowed: true }]
            : [],
        note: lotId === 701 ? undefined : '선택한 LOT은 전이할 수 없습니다.',
      });
    },
  },
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

type FetchInterceptor = (request: Request) => Response | Promise<Response> | undefined;
const renderScreen = (routes: StubRoute[], intercept?: FetchInterceptor) => {
  const urls: URL[] = [];
  const requests: Request[] = [];
  const stub = createStubFetch([...lookupRoutes, ...routes]);
  const view = renderWithProviders(<LotStatusTransitionCandidateScreen />, {
    fetch: async (request) => {
      urls.push(new URL(request.url));
      requests.push(request.clone());
      return intercept?.(request) ?? stub(request);
    },
  });
  return { ...view, requests, urls, user: userEvent.setup() };
};
const lotRequests = (urls: URL[]): URL[] => urls.filter((url) => url.pathname === LOT_PATH);
const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
};
const valueOf = (container: HTMLElement, label: string): string => {
  const term = within(container)
    .getAllByRole('term')
    .find((node) => node.textContent === label);
  const cell = term?.closest('div');
  if (cell === undefined || cell === null) throw new Error(`「${label}」의 값 칸이 없습니다.`);
  return within(cell).getByRole('definition').textContent ?? '';
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

  it('한 행만 선택해 업무 식별·현재 상태를 보이고 LOT 변경 시 전이 준비를 지운다', async () => {
    const beta = { ...lot, lotId: 702, lotNo: 'SYN-LOT-BETA' };
    const { user } = renderScreen([listRoute(page([lot, beta]))]);
    const select = await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    expect(screen.queryByText('선택한 LOT은 전이할 수 없습니다.')).toBeNull();
    await user.click(select);

    const card = screen.getByRole('region', { name: '선택한 LOT' });
    const identity = within(card).getByLabelText('선택 LOT 식별');
    const current = within(card).getByLabelText('선택 LOT 현재 상태');
    expect(valueOf(identity, 'LOT 번호')).toBe('SYN-LOT-ALPHA');
    expect(valueOf(identity, '품목')).toBe('SYN-ITEM-A · 합성 자재');
    expect(within(card).getByRole('heading', { level: 3, name: '현재 상태' })).toBeVisible();
    expect(
      within(current)
        .getAllByRole('term')
        .map((node) => node.textContent),
    ).toEqual(['Lot Status', '보유 수량', '보류 수량', '가용 수량', '최근 전이', '최근 사유']);
    expect([
      valueOf(current, 'Lot Status'),
      valueOf(current, '보유 수량'),
      valueOf(current, '보류 수량'),
      valueOf(current, '가용 수량'),
      valueOf(current, '최근 전이'),
      valueOf(current, '최근 사유'),
    ]).toEqual(['정상', '25', '5', '20', '2026-08-21 12:34', 'SYN-REASON-A']);
    expect(select).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByText('987654')).toBeNull();
    await user.click(await screen.findByRole('radio', { name: 'DEFECTIVE' }));
    await screen.findByText('보류 등록 준비가 완료되었습니다.');
    await user.click(screen.getByRole('button', { name: 'SYN-LOT-BETA 선택' }));
    expect(await screen.findByText('선택한 LOT은 전이할 수 없습니다.')).toBeVisible();
    await user.click(select);
    expect(await screen.findByRole('radio', { name: 'DEFECTIVE' })).not.toBeChecked();
  });

  it('최근 전이·사유가 없는 선택 LOT은 이름 있는 빈값으로 표시한다', async () => {
    const { user } = renderScreen([
      listRoute(page([{ ...lot, latestTransitionAt: undefined, latestReasonCode: undefined }])),
    ]);
    await user.click(await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' }));
    const current = screen.getByLabelText('선택 LOT 현재 상태');

    expect(valueOf(current, '최근 전이')).toBe('—');
    expect(valueOf(current, '최근 사유')).toBe('—');
    expect(screen.queryByText('987654')).toBeNull();
  });

  it('재조회 중 write 준비를 격리하고 새 후보의 version·상태·수량으로만 재확정한다', async () => {
    let listCalls = 0;
    let releaseRefetch!: (response: Response) => void;
    const pendingRefetch = new Promise<Response>((resolve) => {
      releaseRefetch = resolve;
    });
    const updated = {
      ...lot,
      versionNo: 987655,
      lotStatusCode: 'DEFECTIVE',
      onHandQty: 30,
      heldQty: 4,
      availableQty: 26,
    };
    const create: StubRoute = {
      match: (request) =>
        request.method === 'POST' && new URL(request.url).pathname === '/quality/lot-holds',
      respond: () => jsonResponse([], { status: 201 }),
    };
    const view = renderScreen([create], (request) => {
      if (new URL(request.url).pathname !== LOT_PATH) return undefined;
      listCalls += 1;
      return listCalls === 1 ? jsonResponse(page()) : pendingRefetch;
    });
    await view.user.click(await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' }));
    await view.user.click(await screen.findByRole('radio', { name: 'DEFECTIVE' }));
    await view.user.type(screen.getByLabelText('보류 사유'), 'SYN_REASON');
    await view.user.click(screen.getByRole('button', { name: '등록 확인' }));
    await screen.findByRole('dialog');

    void view.queryClient.invalidateQueries({ queryKey: ['lot-status-transition', 'candidates'] });
    await waitFor(() => expect(listCalls).toBe(2));
    expect(screen.queryByRole('region', { name: '보류 등록 입력' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.requests.filter((request) => request.method === 'POST')).toHaveLength(0);

    releaseRefetch(jsonResponse(page([updated])));
    const current = await screen.findByLabelText('선택 LOT 현재 상태');
    await waitFor(() => expect(valueOf(current, '보유 수량')).toBe('30'));
    expect(valueOf(current, 'Lot Status')).toBe('DEFECTIVE (이름 미확인)');
    expect(valueOf(current, '보류 수량')).toBe('4');
    expect(valueOf(current, '가용 수량')).toBe('26');
    await view.user.click(await screen.findByRole('radio', { name: 'DEFECTIVE' }));
    await view.user.type(screen.getByLabelText('보류 사유'), 'SYN_REASON');
    await view.user.click(screen.getByRole('button', { name: '등록 확인' }));
    await view.user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '보류 등록' }),
    );
    await waitFor(() =>
      expect(view.requests.filter((request) => request.method === 'POST')).toHaveLength(1),
    );
    expect(await view.requests.find((request) => request.method === 'POST')!.json()).toMatchObject({
      lots: [{ lotId: 701, versionNo: 987655 }],
    });
  });

  it('background 재조회 오류의 cached 후보로 card와 write 준비를 복구하지 않는다', async () => {
    let listCalls = 0;
    const view = renderScreen([], (request) => {
      if (new URL(request.url).pathname !== LOT_PATH) return undefined;
      listCalls += 1;
      return listCalls === 1
        ? jsonResponse(page())
        : jsonResponse({ message: 'synthetic failure' }, { status: 500 });
    });
    await view.user.click(await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' }));
    await screen.findByRole('region', { name: '상태 전이 준비' });

    await view.queryClient.invalidateQueries({ queryKey: ['lot-status-transition', 'candidates'] });
    expect(await screen.findByText('LOT 후보를 불러오지 못했습니다.')).toBeVisible();
    expect(screen.queryByRole('region', { name: '선택한 LOT' })).toBeNull();
    expect(screen.queryByRole('region', { name: '상태 전이 준비' })).toBeNull();
  });

  it('재조회에서 사라진 선택 row는 나중 응답에 재등장해도 자동 부활하지 않는다', async () => {
    let listCalls = 0;
    const view = renderScreen([], (request) => {
      if (new URL(request.url).pathname !== LOT_PATH) return undefined;
      listCalls += 1;
      return jsonResponse(listCalls === 2 ? page([]) : page());
    });
    await view.user.click(await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' }));
    await screen.findByRole('region', { name: '선택한 LOT' });

    await view.queryClient.invalidateQueries({ queryKey: ['lot-status-transition', 'candidates'] });
    await waitFor(() => expect(screen.queryByRole('region', { name: '선택한 LOT' })).toBeNull());
    expect(screen.queryByRole('region', { name: '상태 전이 준비' })).toBeNull();

    await view.queryClient.invalidateQueries({ queryKey: ['lot-status-transition', 'candidates'] });
    const reappeared = await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    expect(reappeared).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('region', { name: '선택한 LOT' })).toBeNull();
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
