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

    const rowB = rowOf(screen.getByText('예시 거래처 B'));
    // ERP 코드·국가·역할이 모두 비어 있다.
    expect(await within(rowB).findAllByText('—')).toHaveLength(3);
    expect(within(rowB).getByText('미사용')).toBeInTheDocument();

    const rowC = rowOf(screen.getByText('예시 거래처 C'));
    expect(await within(rowC).findByText('불러오지 못함')).toBeInTheDocument();

    expect(screen.getByText('1–3 / 전체 3건')).toBeInTheDocument();
    // 쓰기 조작이 없다.
    expect(screen.queryByRole('button', { name: /저장|등록|삭제/ })).not.toBeInTheDocument();
  });

  it('검색어·역할·미사용 포함을 조회 조건으로 싣는다', async () => {
    const { urls, user } = renderScreen([listRoute(), rolesRoute]);
    await screen.findByText('예시 거래처 B');

    await user.type(screen.getByLabelText('거래처 코드·명'), 'SAMPLE');
    await user.click(screen.getByRole('combobox', { name: '역할' }));
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

  it('상세 구획 없이 목록 한 구획만 서고, 줄을 눌러도 상세를 부르지 않는다', async () => {
    const { urls, user } = renderScreen([listRoute(), rolesRoute]);

    await user.click(await screen.findByText('예시 거래처 A'));

    expect(screen.getByRole('region', { name: '거래처 목록' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '거래처 상세' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /상세 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    // 행마다 역할만 부르고, 거래처 한 건 조회는 나가지 않는다.
    expect(urls.some((url) => url.pathname === `${LIST_PATH}/7001`)).toBe(false);
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
