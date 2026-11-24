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
const PLANT_PATH = '/mdm/plants';
const DEPARTMENT_PATH = '/mdm/departments';

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
  const stub = createStubFetch([...routes, ...lookupRoutes]);

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

/** 공장 둘 · 부서 여섯 — 부서는 5개를 넘어 펼친 목록에 검색창이 선다. */
const PLANTS = [
  { plantId: 21, plantCode: 'PLT-A', plantName: '합성 공장 A', isActive: true },
  { plantId: 22, plantCode: 'PLT-B', plantName: '합성 공장 B', isActive: true },
];
const DEPARTMENTS = [
  [31, 'DEP-A', '합성 부서 A'],
  [32, 'DEP-B', '합성 부서 B'],
  [33, 'DEP-C', '합성 부서 C'],
  [34, 'DEP-D', '합성 부서 D'],
  [35, 'DEP-E', '합성 부서 E'],
  [36, 'DEP-QC', '합성 품질 부서'],
].map(([departmentId, departmentCode, departmentName]) => ({
  departmentId,
  departmentCode,
  departmentName,
  isActive: true,
}));

const lookupRoutes: StubRoute[] = [
  {
    match: (request) => isGet(request, PLANT_PATH),
    respond: () =>
      jsonResponse({ items: PLANTS, page: { page: 1, size: 200, total: PLANTS.length } }),
  },
  {
    match: (request) => isGet(request, DEPARTMENT_PATH),
    respond: () =>
      jsonResponse({
        items: DEPARTMENTS,
        page: { page: 1, size: 200, total: DEPARTMENTS.length },
      }),
  },
];

describe('ErpEmployeeScreen', () => {
  it('목록을 그리고, 고른 사원의 모든 칸을 상세에 내며 비어 있는 값은 표시 기호로 낸다', async () => {
    const { urls, user } = renderScreen([listRoute()]);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('SAMPLE-001')).toBeInTheDocument();
    expect(within(table).getByText('예시 사원 B')).toBeInTheDocument();
    expect(within(table).getByText('퇴사')).toBeInTheDocument();
    // 두 행 모두 부서가 비어 있다.
    expect(within(table).getAllByText('—')).toHaveLength(2);
    // 한국어·베트남어 명칭은 두지 않는다.
    expect(screen.queryByText('Nhan vien A')).not.toBeInTheDocument();
    expect(screen.getByText('총 2건')).toBeInTheDocument();

    const detail = screen.getByRole('region', { name: '사원 상세' });
    expect(within(detail).getByText('사원을 선택하세요.')).toBeInTheDocument();

    await user.click(within(table).getByText('SAMPLE-001'));
    expect(within(detail).getByText('ACTIVE')).toBeInTheDocument();
    expect(within(detail).getByText('11')).toBeInTheDocument();
    expect(within(detail).getByText('21')).toBeInTheDocument();
    expect(within(detail).getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('Nhan vien A')).not.toBeInTheDocument();
    // 상세는 목록 응답만 쓴다 — 상세 요청을 보내지 않는다.
    expect(urls.some((url) => url.pathname.startsWith(`${LIST_PATH}/`))).toBe(false);
    // 쓰기 조작이 없다.
    expect(screen.queryByRole('button', { name: /저장|등록|삭제/ })).not.toBeInTheDocument();
  });

  it('고른 사원을 다시 누르면 선택이 풀린다(사용자 지시 2026-11-24)', async () => {
    const { user } = renderScreen([listRoute()]);

    const table = await screen.findByRole('table');
    const detail = screen.getByRole('region', { name: '사원 상세' });
    await user.click(within(table).getByText('SAMPLE-001'));
    expect(within(detail).getByText('ACTIVE')).toBeInTheDocument();
    await user.click(within(table).getByText('SAMPLE-001'));

    expect(within(detail).getByText('사원을 선택하세요.')).toBeInTheDocument();
  });

  it('검색어와 「퇴사자 포함」을 조회 조건으로 싣고, 위 줄 재직 상태 라벨은 두지 않는다', async () => {
    const { urls, user } = renderScreen([listRoute()]);
    await screen.findByText('예시 사원 B');
    expect(screen.queryByRole('group', { name: '재직 상태' })).toBeNull();
    // 초기화는 바뀐 것이 있을 때만 보인다.
    expect(screen.queryByRole('button', { name: '초기화' })).toBeNull();

    await user.type(screen.getByLabelText('사원 검색'), 'SAMPLE');
    expect(screen.getByRole('button', { name: '초기화' })).toBeInTheDocument();
    const inactive = screen.getByRole('checkbox', { name: '퇴사자 포함' });
    expect(inactive).not.toBeChecked();
    await user.click(inactive);
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => {
      const last = urls.filter((url) => url.pathname === LIST_PATH).at(-1);
      expect(last?.searchParams.get('q')).toBe('SAMPLE');
      expect(last?.searchParams.get('includeInactive')).toBe('true');
      expect(last?.searchParams.has('size')).toBe(false);
    });
  });

  it('공장 · 부서를 「코드 · 이름」 선택지로 고르면 서버 조회 조건 plantId · departmentId 로 싣는다', async () => {
    const { urls, user } = renderScreen([listRoute()]);
    await screen.findByText('예시 사원 B');
    const first = urls.find((url) => url.pathname === LIST_PATH);
    expect(first?.searchParams.has('plantId')).toBe(false);
    expect(first?.searchParams.has('departmentId')).toBe(false);

    const plant = screen.getByRole('combobox', { name: '공장 선택' });
    expect(plant).toHaveTextContent('전체 공장');
    await user.click(plant);
    await user.click(await screen.findByRole('option', { name: 'PLT-B · 합성 공장 B' }));

    const department = screen.getByRole('combobox', { name: '부서 선택' });
    expect(department).toHaveTextContent('전체 부서');
    await user.click(department);
    // 선택지가 5개를 넘으면 검색창으로 좁힌다.
    await user.type(await screen.findByRole('searchbox', { name: '검색' }), 'QC');
    expect(screen.queryByRole('option', { name: 'DEP-A · 합성 부서 A' })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'DEP-QC · 합성 품질 부서' }));

    expect(screen.getByRole('button', { name: '초기화' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => {
      const last = urls.filter((url) => url.pathname === LIST_PATH).at(-1);
      expect(last?.searchParams.get('plantId')).toBe('22');
      expect(last?.searchParams.get('departmentId')).toBe('36');
    });

    await user.click(screen.getByRole('button', { name: '초기화' }));
    await waitFor(() => {
      const last = urls.filter((url) => url.pathname === LIST_PATH).at(-1);
      expect(last?.searchParams.has('plantId')).toBe(false);
      expect(last?.searchParams.has('departmentId')).toBe(false);
    });
    expect(screen.getByRole('combobox', { name: '부서 선택' })).toHaveTextContent('전체 부서');
  });

  it('다음 쪽은 page 를 서버에 싣는다', async () => {
    const { urls, user } = renderScreen([listRoute(ROWS, 120)]);
    await screen.findByText('예시 사원 B');

    await user.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => {
      const last = urls.filter((url) => url.pathname === LIST_PATH).at(-1);
      expect(last?.searchParams.get('page')).toBe('2');
    });
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
