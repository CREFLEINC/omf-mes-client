import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import type { Partner, PartnerRole } from './queries';
import { ErpPartnerScreen } from './screen';

const ROUTE = '/system/erp-data/partners';
const LIST_PATH = '/mdm/partners';

/** 지어낸 합성값만 쓴다 — 실제 거래처처럼 보이는 값을 넣지 않는다(공개 저장소 경계). */
const partner = (overrides: Partial<Partner> = {}): Partner => ({
  partnerId: 7001,
  partnerCode: 'SAMPLE-P1',
  partnerName: '예시 거래처 A',
  countryCode: null,
  erpPartnerCode: 'SAMPLE-P1',
  isActive: true,
  ...overrides,
});

const ROWS = [
  partner(),
  partner({
    partnerId: 7002,
    partnerCode: 'SAMPLE-P2',
    partnerName: '예시 거래처 B',
    erpPartnerCode: null,
    isActive: false,
  }),
  partner({ partnerId: 7003, partnerCode: 'SAMPLE-P3', partnerName: '예시 거래처 C' }),
];

const ROLES: Record<number, PartnerRole[]> = {
  // 응답 순서와 상관없이 고객사가 먼저 선다.
  7001: [{ roleTypeCode: 'SUPPLIER' }, { roleTypeCode: 'CUSTOMER' }],
  7002: [],
};

/** 행 단위로 칸을 읽는다 — 같은 문구가 다른 행에도 있어 화면 전체로 찾으면 어느 행인지 모른다. */
const rowOf = (cell: HTMLElement): HTMLElement => {
  const row = cell.closest('tr');
  if (row === null) throw new Error('행 밖의 칸입니다.');
  return row;
};

/** 화면 한 벌(조회 상자 + 목록 상자). */
const workspace = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.list-detail-workspace');
  if (el === null) throw new Error('화면이 그려지지 않았습니다.');
  return el;
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const renderScreen = (routes: StubRoute[], search = '') => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  renderWithProviders(<ErpPartnerScreen />, {
    fetch: (request) => {
      urls.push(new URL(request.url));
      return stub(request);
    },
    route: `${ROUTE}${search}`,
  });

  return { urls, user: userEvent.setup() };
};

const listRoute = (items: Partner[] = ROWS, total = items.length): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total } }),
});

/** 7003 의 역할 조회는 실패한다 — 실패가 「역할 없음」으로 보이지 않는지 본다. */
const rolesRoute: StubRoute = {
  match: (request) =>
    request.method === 'GET' && /^\/mdm\/partners\/\d+\/roles$/.test(new URL(request.url).pathname),
  respond: (request) => {
    const id = Number(new URL(request.url).pathname.split('/')[3]);
    const roles = ROLES[id];
    return roles === undefined
      ? jsonResponse({ message: '' }, { status: 500 })
      : jsonResponse(roles);
  },
};

describe('ErpPartnerScreen', () => {
  it('목록과 행마다 역할을 그린다', async () => {
    renderScreen([listRoute(), rolesRoute]);

    const rowA = rowOf(await screen.findByText('예시 거래처 A'));
    expect(await within(rowA).findByText('고객사, 공급사')).toBeInTheDocument();

    // ERP 거래처 코드 · 국가 열이 목록에 있다(사용자 지시 2026-11-24).
    const table = screen.getByRole('table');
    expect(
      within(table).getByRole('columnheader', { name: 'ERP 거래처 코드' }),
    ).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: '국가' })).toBeInTheDocument();
    expect(within(rowA).getAllByText('SAMPLE-P1')).toHaveLength(2);

    const rowB = rowOf(screen.getByText('예시 거래처 B'));
    // ERP 거래처 코드 · 국가 · 역할이 비어 있다.
    expect(await within(rowB).findAllByText('—')).toHaveLength(3);
    // 사용 여부는 상태 라벨로 낸다(사용자 지시 2026-11-24).
    expect(within(rowB).getByText('미사용').parentElement?.className).toMatch(/status-idle/);

    const rowC = rowOf(screen.getByText('예시 거래처 C'));
    expect(await within(rowC).findByText('불러오지 못함')).toBeInTheDocument();

    expect(screen.getByText('총 3건')).toBeInTheDocument();
    // 쓰기 조작이 없다.
    expect(screen.queryByRole('button', { name: /저장|등록|삭제/ })).not.toBeInTheDocument();
  });

  it('목록 아래 쪽 넘김 줄을 두고, 다음 쪽은 page 를 서버에 싣는다', async () => {
    const { urls, user } = renderScreen([listRoute(ROWS, 120), rolesRoute]);
    await screen.findByText('예시 거래처 A');

    /* 쪽 넘김 줄 — 왼쪽 「총 N건」 + 쪽 크기, 오른쪽 [처음] [이전] n / N [다음] [마지막](ERP 수신 묶음 공통 · 사용자 지시 2026-11-24). */
    const nav = within(screen.getByRole('navigation', { name: '쪽 이동' }));
    expect(nav.getByText('총 120건')).toBeInTheDocument();
    expect(nav.getByRole('combobox', { name: '페이지 크기' })).toHaveTextContent('50건');
    expect(nav.getByText('1 / 3')).toBeInTheDocument();
    for (const name of ['처음', '이전', '다음', '마지막']) {
      expect(nav.getByRole('button', { name })).toBeInTheDocument();
    }

    await user.click(nav.getByRole('button', { name: '다음' }));
    await waitFor(() => {
      const last = urls.filter((url) => url.pathname === LIST_PATH).at(-1);
      expect(last?.searchParams.get('page')).toBe('2');
    });
  });

  it('검색어·역할·미사용 포함을 조회 조건으로 싣는다', async () => {
    const { urls, user } = renderScreen([listRoute(), rolesRoute]);
    await screen.findByText('예시 거래처 B');
    // 초기화는 바뀐 것이 있을 때만 보인다.
    expect(screen.queryByRole('button', { name: '초기화' })).toBeNull();

    await user.type(screen.getByLabelText('거래처 검색'), 'SAMPLE');
    expect(screen.getByRole('button', { name: '초기화' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: '역할 선택' }));
    await user.click(screen.getByRole('option', { name: '공급사' }));
    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => {
      const last = urls.filter((url) => url.pathname === LIST_PATH).at(-1);
      expect(last?.searchParams.get('q')).toBe('SAMPLE');
      expect(last?.searchParams.get('roleTypeCode')).toBe('SUPPLIER');
      expect(last?.searchParams.get('includeInactive')).toBe('true');
    });
  });

  it('주소의 모르는 역할은 조건에 싣지 않는다', async () => {
    const { urls } = renderScreen([listRoute(), rolesRoute], '?role=UNKNOWN');
    await screen.findByText('예시 거래처 A');

    const first = urls.find((url) => url.pathname === LIST_PATH);
    expect(first?.searchParams.has('roleTypeCode')).toBe(false);
  });

  it('상세 칸이 없다 — 줄을 눌러도 상세가 생기지 않고, 배치 · 목록 접기 조작도 없다(사용자 지시 2026-11-24)', async () => {
    const { urls, user } = renderScreen([listRoute(), rolesRoute]);

    const table = await screen.findByRole('table');
    const rowA = rowOf(await within(table).findByText('예시 거래처 A'));
    expect(await within(rowA).findByText('고객사, 공급사')).toBeInTheDocument();
    /* 화면 몫의 구획만 센다(알림 구획은 앱 몫이다). */
    const regionNames = () =>
      within(workspace())
        .queryAllByRole('region')
        .map((el) => el.getAttribute('aria-label'));
    expect(regionNames()).toEqual(['조회 조건', '거래처 목록']);
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '목록 접기' })).not.toBeInTheDocument();
    // 줄 고르기 단추가 없다.
    expect(table.querySelector('.users-roles-row-pick')).toBeNull();
    const before = urls.length;

    await user.click(within(table).getByText('예시 거래처 B'));
    await user.click(within(table).getByText('예시 거래처 A'));

    expect(regionNames()).toEqual(['조회 조건', '거래처 목록']);
    expect(screen.queryByText('거래처 상세')).not.toBeInTheDocument();
    expect(table.querySelector('[aria-current]')).toBeNull();
    // 역할은 목록 칸 한 곳에만 있다 — 다른 곳에 값이 다시 그려지지 않고, 요청도 더 나가지 않는다.
    expect(screen.getAllByText('고객사, 공급사')).toHaveLength(1);
    expect(urls.length).toBe(before);
  });

  it('주소에 옛 선택 값이 남아 와도 화면이 깨지지 않고 조회 인자에 싣지 않는다', async () => {
    const { urls } = renderScreen([listRoute(), rolesRoute], '?partner=7001&selected=7001');

    expect(await screen.findByText('예시 거래처 B')).toBeInTheDocument();
    const first = urls.find((url) => url.pathname === LIST_PATH);
    expect(first?.searchParams.has('partner')).toBe(false);
    expect(first?.searchParams.has('selected')).toBe(false);
    expect(within(workspace()).getAllByRole('region')).toHaveLength(2);
  });

  it('결과가 없으면 빈 상태를 낸다', async () => {
    renderScreen([listRoute([])]);

    expect(await screen.findByText('조건에 맞는 거래처가 없습니다')).toBeInTheDocument();
  });

  it('조회에 실패하면 오류 배너를 내고 표를 감춘다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, LIST_PATH),
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);

    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
