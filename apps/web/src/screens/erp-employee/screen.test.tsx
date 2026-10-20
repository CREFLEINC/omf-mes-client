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

const detailRoute: StubRoute = {
  match: (request) => isGet(request, `${LIST_PATH}/9001`),
  respond: () =>
    jsonResponse({ worker: ROWS[0], editability: { editable: false, lockedFields: [] } }),
};

describe('ErpEmployeeScreen', () => {
  it('목록을 그리고 비어 있는 값은 표시 기호로 낸다', async () => {
    renderScreen([listRoute()]);

    expect(await screen.findByRole('button', { name: 'SAMPLE-001 상세 보기' })).toBeInTheDocument();
    expect(screen.getByText('예시 사원 B')).toBeInTheDocument();
    expect(screen.getByText('퇴사')).toBeInTheDocument();
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

  it('사번을 누르면 상세를 조회해 보인다', async () => {
    const { user } = renderScreen([listRoute(), detailRoute]);

    await user.click(await screen.findByRole('button', { name: 'SAMPLE-001 상세 보기' }));

    const group = await screen.findByRole('group', { name: '사원 상세' });
    expect(within(group).getByText('사업장')).toBeInTheDocument();
    expect(within(group).getByText('11')).toBeInTheDocument();
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
