import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import type { Worker } from './queries';
import { ErpEmployeeScreen } from './screen';

const ROUTE = '/system/erp-data/employees';
const LIST_PATH = '/mdm/workers';

/** 지어낸 합성값만 쓴다 — 실제 사번·이름처럼 보이는 값을 넣지 않는다(공개 저장소 경계). */
const worker = (overrides: Partial<Worker> = {}): Worker => ({
  workerId: 9001,
  workerNo: 'SAMPLE-001',
  workerName: '예시 사원 A',
  nameKo: null,
  nameVi: 'Nhan vien A',
  businessUnitId: 11,
  plantId: 21,
  departmentId: null,
  appUserId: null,
  statusCode: 'ACTIVE',
  isActive: true,
  ...overrides,
});

const ROWS = [
  worker(),
  worker({ workerId: 9002, workerNo: 'SAMPLE-002', workerName: '예시 사원 B', isActive: false }),
];

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const renderScreen = (routes: StubRoute[], search = '') => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  renderWithProviders(<ErpEmployeeScreen />, {
    fetch: (request) => {
      urls.push(new URL(request.url));
      return stub(request);
    },
    route: `${ROUTE}${search}`,
  });

  return { urls, user: userEvent.setup() };
};

const listRoute = (items: Worker[] = ROWS, total = items.length): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total } }),
});

describe('ErpEmployeeScreen', () => {
  it('목록을 그리고 비어 있는 값은 표시 기호로 낸다', async () => {
    renderScreen([listRoute()]);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('SAMPLE-001')).toBeInTheDocument();
    expect(within(table).getByText('예시 사원 B')).toBeInTheDocument();
    expect(within(table).getByText('퇴사')).toBeInTheDocument();
    // 두 행 모두 부서가 비어 있다.
    expect(within(table).getAllByText('—')).toHaveLength(2);
    // 한국어·베트남어 명칭 열은 두지 않는다.
    expect(within(table).queryByText('한국어 명칭')).not.toBeInTheDocument();
    expect(within(table).queryByText('베트남어 명칭')).not.toBeInTheDocument();
    expect(within(table).queryByText('Nhan vien A')).not.toBeInTheDocument();
    expect(screen.getByText('1–2 / 전체 2건')).toBeInTheDocument();
    // 쓰기 조작이 없다.
    expect(screen.queryByRole('button', { name: /저장|등록|삭제/ })).not.toBeInTheDocument();
  });

  it('검색어와 퇴사자 포함을 조회 조건으로 싣는다', async () => {
    const { urls, user } = renderScreen([listRoute()]);
    await screen.findByText('예시 사원 B');

    await user.type(screen.getByLabelText('사번·성명'), 'SAMPLE');
    await user.click(screen.getByRole('checkbox', { name: '퇴사자 포함' }));
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => {
      const last = urls.filter((url) => url.pathname === LIST_PATH).at(-1);
      expect(last?.searchParams.get('q')).toBe('SAMPLE');
      expect(last?.searchParams.get('includeInactive')).toBe('true');
    });
  });

  it('상세 구획 없이 목록 한 구획만 서고, 줄을 눌러도 상세를 부르지 않는다', async () => {
    const { urls, user } = renderScreen([listRoute()]);

    await user.click(await screen.findByText('SAMPLE-001'));

    expect(screen.getByRole('region', { name: '사원 목록' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '사원 상세' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /상세 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(urls.some((url) => url.pathname.startsWith(`${LIST_PATH}/`))).toBe(false);
  });

  it('결과가 없으면 빈 상태를 낸다', async () => {
    renderScreen([listRoute([])]);

    expect(await screen.findByText('조건에 맞는 사원이 없습니다')).toBeInTheDocument();
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
