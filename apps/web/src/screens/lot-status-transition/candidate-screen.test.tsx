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
  defaultLotStatusCandidateFilters,
  EMPTY_LOT_STATUS_CANDIDATE_FILTERS,
  lotStatusTransitionKeys,
  LotStatusTransitionCandidateScreen,
  toLotStatusCandidateQuery,
} from './candidate-screen';
import { defaultTransitionPeriod, toTransitionPeriodBounds } from './period';

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
  page: { page: current, size: 10, total: 20 },
});
const listRoute = (body: unknown = page(), status = 200): StubRoute => ({
  match: (request) => new URL(request.url).pathname === LOT_PATH,
  respond: () => jsonResponse(body, { status }),
});
const SUMMARY_PATH = '/quality/lot-status-summary';
const lookupRoutes: StubRoute[] = [
  /* 상태 칩 건수 — 정상 3 · 불량 2(전체 5). */
  {
    match: (request) => new URL(request.url).pathname === SUMMARY_PATH,
    respond: () =>
      jsonResponse({
        counts: [
          { statusCode: 'NORMAL', lotTypeCode: 'MATERIAL', lotCount: 2 },
          { statusCode: 'NORMAL', lotTypeCode: 'PRODUCT', lotCount: 1 },
          { statusCode: 'DEFECTIVE', lotTypeCode: 'MATERIAL', lotCount: 2 },
          { statusCode: 'INSPECTION_PENDING', lotCount: 0 },
          { statusCode: 'SCRAPPED', lotCount: 0 },
        ],
        asOf: '2026-08-21T12:34:00+09:00',
      }),
  },
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
            lotControlled: true,
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
  /* 품목 이름은 보이는 행의 품목 상세로 푼다(#1336) — 목록 첫 쪽에 없는 품목(802)도 상세는 답한다. */
  {
    match: (request) => /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
    respond: (request) => {
      const itemId = Number(new URL(request.url).pathname.split('/').at(-1));
      const names: Record<number, [string, string]> = {
        801: ['SYN-ITEM-A', '합성 자재'],
        802: ['SYN-ITEM-51', '합성 51번째 자재'],
      };
      const name = names[itemId];
      return name === undefined
        ? jsonResponse({ message: '합성 없음' }, { status: 404 })
        : jsonResponse({
            item: { itemId, itemCode: name[0], itemName: name[1], isActive: true },
          });
    },
  },
  /* 보류 사유는 공통코드 `LOT_HOLD_REASON` 선택지 — 그룹으로 나눠 답한다(앞선 라우트가 이긴다). */
  {
    match: (request) => {
      const url = new URL(request.url);
      return (
        url.pathname === '/mdm/code-values' &&
        url.searchParams.get('codeGroupCode') === 'LOT_HOLD_REASON'
      );
    },
    respond: () =>
      jsonResponse({
        items: [
          {
            codeValueId: 903,
            codeGroupId: 904,
            code: 'SYN_REASON',
            codeName: 'Synthetic hold reason',
            displayOrder: 1,
            isActive: true,
          },
        ],
        page: { page: 1, size: 100, total: 1 },
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

/** 사유 Select — 선택지가 서기(질의 완료) 전엔 잠겨 있어 열리기를 기다린 뒤 고른다. */
const chooseHoldReason = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const field = screen.getByLabelText('보류 사유');
  await waitFor(() => expect(field).toBeEnabled());
  await user.click(field);
  await user.click(await screen.findByRole('option', { name: 'Synthetic hold reason' }));
};

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
const summaryRequests = (urls: URL[]): URL[] => urls.filter((url) => url.pathname === SUMMARY_PATH);
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
  it('heldOnly 없이 LOT 번호·품목·품질 상태·전이 기간과 page만 직렬화한다', () => {
    expect(
      toLotStatusCandidateQuery(
        {
          q: 'SYN-LOT',
          itemId: '801',
          lotStatusCode: 'NORMAL',
          from: '2026-08-01',
          to: '2026-08-25',
        },
        3,
        540,
      ),
    ).toEqual({
      q: 'SYN-LOT',
      itemId: 801,
      lotStatusCode: 'NORMAL',
      transitionFrom: '2026-08-01T00:00:00+09:00',
      transitionTo: '2026-08-26T00:00:00+09:00',
      page: 3,
    });
    expect(toLotStatusCandidateQuery(EMPTY_LOT_STATUS_CANDIDATE_FILTERS, 1, 540)).toEqual({});
  });

  it('첫 조회는 오늘 포함 최근 30일을 사용한다', async () => {
    const { urls } = renderScreen([listRoute()]);
    await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    const expected = toTransitionPeriodBounds(
      defaultTransitionPeriod(new Date()),
      -new Date().getTimezoneOffset(),
    );

    /* 한 쪽 크기는 LOT 현황과 같은 기본 20건을 보낸다. */
    expect(Object.fromEntries(lotRequests(urls)[0]!.searchParams)).toEqual({
      ...expected,
      size: '20',
    });
    expect(screen.getByRole('region', { name: '전이 대상 LOT' })).toBeVisible();
    /* 목록 카드 제목은 두지 않는다(사용자 2026-11-02) — 구역 이름으로만 남는다. */
    expect(screen.queryByRole('heading', { level: 2, name: '전이 대상 LOT' })).toBeNull();
    expect(screen.getByRole('table', { name: '전이 대상 LOT' })).toBeVisible();
    /* 총 건수는 표 아래 쪽 이동 줄에만 선다 — 제목 옆 건수 · 「조회 결과」 머리는 없다(LOT 현황과 같다). */
    expect(screen.queryByRole('heading', { level: 3, name: '조회 결과' })).toBeNull();
    const nav = screen.getByRole('navigation', { name: '쪽 이동' });
    expect(within(nav).getByText('총 20건')).toBeVisible();
    expect(within(nav).getByText('1 / 2')).toBeVisible();
    expect(screen.getAllByText('총 20건')).toHaveLength(1);
  });

  it('같은 필터라도 지역 시간대 오프셋이 다르면 후보 캐시 키를 분리한다', () => {
    const filters = defaultLotStatusCandidateFilters(new Date(2026, 7, 25));

    expect(lotStatusTransitionKeys.candidates(filters, 1, 540)).not.toEqual(
      lotStatusTransitionKeys.candidates(filters, 1, -300),
    );
    expect(lotStatusTransitionKeys.candidates(filters, 1, 540).at(-1)).toBe(540);
  });

  it('기간은 「기간」 아래 시작일 · 종료일 두 칸이고, 자재는 상세 검색에 접혀 있다', async () => {
    const { user } = renderScreen([listRoute()]);
    await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    const period = screen.getByRole('group', { name: '기간' });
    const today = defaultTransitionPeriod(new Date());
    expect(within(period).getByLabelText('시작일')).toHaveTextContent(today.from);
    expect(within(period).getByLabelText('종료일')).toHaveTextContent(today.to);
    expect(screen.queryByText('최근 전이일을 기준으로 LOT을 조회합니다.')).toBeNull();
    expect(screen.queryByText('최근 전이 기간')).toBeNull();
    /* 상태는 조건 줄이 아니라 위쪽 칩으로 고른다. */
    expect(screen.queryByLabelText('상태')).toBeNull();
    expect(screen.getByLabelText('자재')).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: '상세 검색 펼치기' }));
    expect(screen.getByLabelText('자재')).toBeVisible();
    expect(screen.getByRole('button', { name: '상세 검색 접기' })).toBeVisible();
  });

  it('상태 칩은 상태를 뺀 같은 조건의 요약 한 번으로 건수를 보이고, 누르면 그 상태로 서버에서 거른다', async () => {
    const { urls, user } = renderScreen([listRoute()]);
    await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    const chips = screen.getByRole('group', { name: '현재 상태' });
    expect(await within(chips).findByRole('button', { name: /^전체\s*5$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(chips).getByRole('button', { name: /^정상\s*3$/ })).toBeVisible();
    const defaultBounds = toTransitionPeriodBounds(
      defaultTransitionPeriod(new Date()),
      -new Date().getTimezoneOffset(),
    );
    expect(summaryRequests(urls)).toHaveLength(1);
    expect(Object.fromEntries(summaryRequests(urls)[0]!.searchParams)).toEqual(defaultBounds);

    await user.click(within(chips).getByRole('button', { name: /^정상\s*3$/ }));
    await waitFor(() => expect(lotRequests(urls)).toHaveLength(2));
    expect(Object.fromEntries(lotRequests(urls)[1]!.searchParams)).toEqual({
      ...defaultBounds,
      lotStatusCode: 'NORMAL',
      size: '20',
    });
    expect(within(chips).getByRole('button', { name: /^정상\s*3$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    /* 칩만 바꾸면 건수 요약은 다시 부르지 않는다. */
    expect(summaryRequests(urls)).toHaveLength(1);
  });

  it('필터 초안을 조회·초기화하고 요청에 heldOnly를 보내지 않는다', async () => {
    const { urls, user } = renderScreen([listRoute()]);
    await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    await user.type(screen.getByLabelText('LOT 스캔'), 'SYN-LOT');
    await user.click(screen.getByRole('button', { name: '상세 검색 펼치기' }));
    await choose(user, '자재', 'SYN-ITEM-A · 합성 자재');
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => expect(lotRequests(urls)).toHaveLength(2));
    const defaultBounds = toTransitionPeriodBounds(
      defaultTransitionPeriod(new Date()),
      -new Date().getTimezoneOffset(),
    );
    /* 건수 요약도 같은 조건(상태 · 쪽 크기 없이)으로 다시 부른다. */
    await waitFor(() => expect(summaryRequests(urls)).toHaveLength(2));
    expect(Object.fromEntries(summaryRequests(urls)[1]!.searchParams)).toEqual({
      ...defaultBounds,
      itemId: '801',
      q: 'SYN-LOT',
    });
    await user.click(
      within(screen.getByRole('group', { name: '현재 상태' })).getByRole('button', {
        name: /^정상/,
      }),
    );
    await waitFor(() => expect(lotRequests(urls)).toHaveLength(3));
    expect(Object.fromEntries(lotRequests(urls)[2]!.searchParams)).toEqual({
      ...defaultBounds,
      lotStatusCode: 'NORMAL',
      itemId: '801',
      q: 'SYN-LOT',
      size: '20',
    });
    expect(lotRequests(urls)[2]!.searchParams.has('heldOnly')).toBe(false);
    await user.click(screen.getByRole('button', { name: '초기화' }));
    await waitFor(() => expect(lotRequests(urls)).toHaveLength(4));
    expect(Object.fromEntries(lotRequests(urls)[3]!.searchParams)).toEqual({
      ...toTransitionPeriodBounds(
        defaultLotStatusCandidateFilters(new Date()),
        -new Date().getTimezoneOffset(),
      ),
      size: '20',
    });
  });

  it('한 행만 선택해 업무 식별·현재 상태를 보이고 LOT 변경 시 전이 준비를 지운다', async () => {
    const beta = { ...lot, lotId: 702, lotNo: 'SYN-LOT-BETA' };
    const { user } = renderScreen([listRoute(page([lot, beta]))]);
    const select = await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    expect(screen.queryByText('선택한 LOT은 전이할 수 없습니다.')).toBeNull();
    /* 고르기 전에는 옆 칸이 안내만 보인다. */
    expect(screen.getByText('목록에서 LOT을 선택해 주세요.')).toBeVisible();
    await user.click(select);
    expect(screen.queryByText('목록에서 LOT을 선택해 주세요.')).toBeNull();

    const card = screen.getByRole('region', { name: 'LOT 상태 변경' });
    /*
     * 시안 카드(사용자 2026-11-02) — 제목 · LOT 유형, LOT 상자(번호 · 상태 칩 / 품목 · 최근 변경 · 변경 사유),
     * 아래 「현재 상태」 줄과 변경할 상태.
     */
    expect(within(card).getByRole('heading', { level: 2, name: 'LOT 상태 변경' })).toBeVisible();
    const box = within(card).getByRole('group', { name: '선택 LOT 식별' });
    expect(within(box).getByText('SYN-LOT-ALPHA')).toBeVisible();
    expect(within(box).getByText('정상')).toBeVisible();
    expect(
      within(box)
        .getAllByRole('term')
        .map((node) => node.textContent),
    ).toEqual(['품목', '최근 변경', '변경 사유']);
    /* 품목은 코드 아래 이름 두 줄 · 최근 전이는 공장 시각(UTC+7) — omf-all-around#20 */
    expect([valueOf(box, '품목'), valueOf(box, '최근 변경'), valueOf(box, '변경 사유')]).toEqual([
      'SYN-ITEM-A합성 자재',
      '2026-08-21 10:34',
      'SYN-REASON-A',
    ]);
    const preparation = await within(card).findByRole('group', { name: '상태 전이 준비' });
    /* 현재 상태는 LOT 상자 칩으로만 — 아래에 따로 두지 않는다(사용자 2026-11-02). */
    expect(within(preparation).queryByText('현재 상태')).toBeNull();
    expect(within(preparation).getByText('변경할 상태')).toBeVisible();
    expect(select).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByText('987654')).toBeNull();
    await user.click(await screen.findByRole('radio', { name: 'DEFECTIVE' }));
    await screen.findByText('보류 등록 준비가 완료되었습니다.');
    await user.click(screen.getByRole('button', { name: 'SYN-LOT-BETA 선택' }));
    expect(await screen.findByText('선택한 LOT은 전이할 수 없습니다.')).toBeVisible();
    await user.click(select);
    expect(await screen.findByRole('radio', { name: 'DEFECTIVE' })).not.toBeChecked();
    /* 고른 줄을 다시 누르면 선택을 풀고 안내로 돌아간다. */
    await user.click(select);
    expect(select).not.toHaveAttribute('aria-current');
    expect(screen.queryByLabelText('선택 LOT 식별')).toBeNull();
    expect(screen.getByText('목록에서 LOT을 선택해 주세요.')).toBeVisible();
  });

  it('LOT 번호 밖 칸을 눌러도 그 줄을 고른다', async () => {
    const { user } = renderScreen([listRoute()]);
    const select = await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    const row = select.closest('tr');
    if (row === null) throw new Error('후보 행이 없습니다.');
    await user.click(within(row).getByText('정상'));
    expect(select).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('region', { name: 'LOT 상태 변경' })).toBeVisible();
  });

  it('품목 목록 첫 쪽에 없는 품목도 이름을 보인다 (#1336)', async () => {
    renderScreen([listRoute(page([{ ...lot, itemId: 802 }]))]);

    const row = (await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' })).closest('tr');
    if (row === null) throw new Error('후보 행이 없습니다.');

    expect(await within(row).findByText('SYN-ITEM-51 · 합성 51번째 자재')).toBeVisible();
    expect(within(row).queryByText('알 수 없음')).not.toBeInTheDocument();
  });

  it('후보가 품목 이름보다 먼저 오면 내부 id 대신 로딩 상태를 보인다', async () => {
    renderScreen([listRoute()], (request) =>
      /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname)
        ? new Promise<Response>(() => undefined)
        : undefined,
    );

    const row = (await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' })).closest('tr');
    if (row === null) throw new Error('후보 행이 없습니다.');

    expect(within(row).getByText('이름 불러오는 중')).toBeVisible();
    expect(within(row).queryByText('801')).not.toBeInTheDocument();
    expect(within(row).queryByText('품목 이름 미확인')).not.toBeInTheDocument();
  });

  it('최근 전이·사유가 없는 선택 LOT은 이름 있는 빈값으로 표시한다', async () => {
    const { user } = renderScreen([
      listRoute(page([{ ...lot, latestTransitionAt: undefined, latestReasonCode: undefined }])),
    ]);
    await user.click(await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' }));
    const current = screen.getByLabelText('선택 LOT 식별');

    expect(valueOf(current, '최근 변경')).toBe('—');
    expect(valueOf(current, '변경 사유')).toBe('—');
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
    await view.user.click(screen.getByRole('button', { name: '상태 변경 검토' }));
    await chooseHoldReason(view.user);

    void view.queryClient.invalidateQueries({ queryKey: ['lot-status-transition', 'candidates'] });
    await waitFor(() => expect(listCalls).toBe(2));
    expect(screen.queryByRole('region', { name: '보류 등록 입력' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.requests.filter((request) => request.method === 'POST')).toHaveLength(0);

    releaseRefetch(jsonResponse(page([updated])));
    const current = await screen.findByLabelText('선택 LOT 식별');
    await waitFor(() => expect(within(current).getByText('DEFECTIVE (이름 미확인)')).toBeVisible());
    await view.user.click(await screen.findByRole('radio', { name: 'DEFECTIVE' }));
    await view.user.click(screen.getByRole('button', { name: '상태 변경 검토' }));
    await chooseHoldReason(view.user);
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

  it('확인 pin 동안 조회와 owner를 보존하고 취소·성공 뒤 refetch한다', async () => {
    const beta = { ...lot, lotId: 702, lotNo: 'SYN-LOT-BETA' };
    let finishCreate!: (response: Response) => void;
    const pendingCreate = new Promise<Response>((resolve) => {
      finishCreate = resolve;
    });
    const view = renderScreen([], (request) => {
      const path = new URL(request.url).pathname;
      if (path === LOT_PATH) return jsonResponse(page([lot, beta]));
      if (request.method === 'POST' && path === '/quality/lot-holds') return pendingCreate;
      return undefined;
    });
    const historyKey = ['lot-status-history', 'synthetic'] as const;
    view.queryClient.setQueryData(historyKey, {});
    const counts = (): number[] => [
      lotRequests(view.urls).length,
      view.urls.filter((url) => url.pathname === '/quality/lot-status-transitions').length,
    ];
    const openConfirmation = async (): Promise<HTMLElement> => {
      await view.user.click(await screen.findByRole('radio', { name: 'DEFECTIVE' }));
      await view.user.click(screen.getByRole('button', { name: '상태 변경 검토' }));
      await chooseHoldReason(view.user);
      await view.user.click(screen.getByRole('button', { name: '등록 확인' }));
      return screen.findByRole('dialog');
    };
    const alpha = await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    await view.user.click(alpha);
    let dialog = await openConfirmation();
    const beforeCancel = counts();

    await view.queryClient.invalidateQueries({ queryKey: ['lot-status-transition'] });
    expect(counts()).toEqual(beforeCancel);
    expect(screen.getByRole('button', { name: 'SYN-LOT-BETA 선택' })).toBeDisabled();
    await view.user.click(within(dialog).getByRole('button', { name: '취소' }));
    await waitFor(() =>
      expect(counts().every((value, index) => value > beforeCancel[index]!)).toBe(true),
    );

    dialog = await openConfirmation();
    const beforeSuccess = counts();
    await view.user.click(within(dialog).getByRole('button', { name: '보류 등록' }));
    await waitFor(() =>
      expect(view.requests.filter((request) => request.method === 'POST')).toHaveLength(1),
    );
    await view.queryClient.invalidateQueries({ queryKey: ['lot-status-transition'] });
    expect(counts()).toEqual(beforeSuccess);
    expect(dialog).toBeInTheDocument();
    expect(alpha).toHaveAttribute('aria-current', 'true');
    finishCreate(jsonResponse([], { status: 201 }));

    expect(await screen.findByText('LOT 보류를 등록했습니다.')).toBeVisible();
    await waitFor(() =>
      expect(counts().every((value, index) => value > beforeSuccess[index]!)).toBe(true),
    );
    expect(view.queryClient.getQueryState(historyKey)?.isInvalidated).toBe(true);
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
    await screen.findByRole('group', { name: '상태 전이 준비' });

    await view.queryClient.invalidateQueries({ queryKey: ['lot-status-transition', 'candidates'] });
    expect(await screen.findByText('LOT 후보를 불러오지 못했습니다.')).toBeVisible();
    expect(screen.queryByLabelText('선택 LOT 식별')).toBeNull();
    expect(screen.queryByRole('group', { name: '상태 전이 준비' })).toBeNull();
  });

  it('재조회에서 사라진 선택 row는 나중 응답에 재등장해도 자동 부활하지 않는다', async () => {
    let listCalls = 0;
    const view = renderScreen([], (request) => {
      if (new URL(request.url).pathname !== LOT_PATH) return undefined;
      listCalls += 1;
      return jsonResponse(listCalls === 2 ? page([]) : page());
    });
    await view.user.click(await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' }));
    await screen.findByRole('region', { name: 'LOT 상태 변경' });

    await view.queryClient.invalidateQueries({ queryKey: ['lot-status-transition', 'candidates'] });
    await waitFor(() => expect(screen.queryByLabelText('선택 LOT 식별')).toBeNull());
    expect(screen.queryByRole('group', { name: '상태 전이 준비' })).toBeNull();

    await view.queryClient.invalidateQueries({ queryKey: ['lot-status-transition', 'candidates'] });
    const reappeared = await screen.findByRole('button', { name: 'SYN-LOT-ALPHA 선택' });
    expect(reappeared).not.toHaveAttribute('aria-current');
    expect(screen.queryByLabelText('선택 LOT 식별')).toBeNull();
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
    await user.click(screen.getByRole('button', { name: '다음' }));

    await screen.findByRole('button', { name: 'SYN-LOT-P2 선택' });
    expect(lotRequests(urls).at(-1)?.searchParams.get('page')).toBe('2');
    expect(screen.queryByLabelText('선택 LOT 식별')).toBeNull();
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
