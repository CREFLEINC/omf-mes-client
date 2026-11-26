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
  worker({
    workerId: 9002,
    workerNo: 'SAMPLE-002',
    workerName: '예시 사원 B',
    businessUnitId: 12,
    statusCode: 'RETIRED',
    isActive: false,
  }),
];

/** 화면 한 벌(조회 상자 + 목록 상자). */
const workspace = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.list-detail-workspace');
  if (el === null) throw new Error('화면이 그려지지 않았습니다.');
  return el;
};

/** 열 이름으로 그 열의 칸 글자를 위에서부터 모은다. */
const columnTexts = (table: HTMLElement, header: string): string[] => {
  const headers = within(table).getAllByRole('columnheader');
  const index = headers.findIndex((el) => el.textContent?.includes(header) === true);
  if (index < 0) throw new Error(`열 「${header}」이 없습니다.`);
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[index]?.textContent ?? '');
};

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
  it('목록에 사업장 · ERP 상태까지 열로 내고, 비어 있는 값은 표시 기호로 낸다', async () => {
    const { urls } = renderScreen([listRoute()]);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('SAMPLE-001')).toBeInTheDocument();
    expect(within(table).getByText('예시 사원 B')).toBeInTheDocument();
    expect(within(table).getByText('퇴사')).toBeInTheDocument();
    // 상세에만 있던 사업장 · ERP 상태가 목록 열에 받은 값 그대로 있다.
    expect(columnTexts(table, '사업장')).toEqual(['11', '12']);
    expect(columnTexts(table, 'ERP 상태')).toEqual(['ACTIVE', 'RETIRED']);
    expect(columnTexts(table, '공장')).toEqual(['21', '21']);
    // 두 행 모두 부서가 비어 있다.
    expect(columnTexts(table, '부서')).toEqual(['—', '—']);
    // 한국어·베트남어 명칭은 두지 않는다.
    expect(screen.queryByText('Nhan vien A')).not.toBeInTheDocument();
    // 목록 제목 줄 — 이름 · 건수.
    expect(screen.getByRole('heading', { name: '사원 목록' })).toBeInTheDocument();
    expect(within(workspace()).getAllByText('총 2건').length).toBeGreaterThan(0);
    // 목록 응답만 쓴다 — 한 건 요청을 보내지 않는다.
    expect(urls.some((url) => url.pathname.startsWith(`${LIST_PATH}/`))).toBe(false);
    // 쓰기 조작이 없다.
    expect(screen.queryByRole('button', { name: /저장|등록|삭제/ })).not.toBeInTheDocument();
  });

  it('상세 칸이 없다 — 줄을 눌러도 상세가 생기지 않고, 배치 · 목록 접기 조작도 없다(사용자 지시 2026-11-24)', async () => {
    const { urls, user } = renderScreen([listRoute()]);

    const table = await screen.findByRole('table');
    /* 화면 몫의 구획만 센다(알림 구획은 앱 몫이다). */
    const regionNames = () =>
      within(workspace())
        .queryAllByRole('region')
        .map((el) => el.getAttribute('aria-label'));
    expect(regionNames()).toEqual(['조회 조건', '사원 목록']);
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '목록 접기' })).not.toBeInTheDocument();
    expect(screen.queryByText('사원을 선택하세요.')).not.toBeInTheDocument();
    // 줄 고르기 단추가 없다.
    expect(table.querySelector('.users-roles-row-pick')).toBeNull();
    const before = urls.length;

    await user.click(within(table).getByText('예시 사원 B'));
    await user.click(within(table).getByText('SAMPLE-001'));

    expect(regionNames()).toEqual(['조회 조건', '사원 목록']);
    expect(table.querySelector('[aria-current]')).toBeNull();
    // 「RETIRED」는 목록 칸 한 곳에만 있다 — 다른 곳에 값이 다시 그려지지 않는다.
    expect(screen.getAllByText('RETIRED')).toHaveLength(1);
    expect(urls.length).toBe(before);
  });

  it('주소에 옛 선택 값이 남아 와도 화면이 깨지지 않고 조회 인자에 싣지 않는다', async () => {
    const { urls } = renderScreen([listRoute()], '?worker=9002&selected=9002');

    expect(await screen.findByText('예시 사원 B')).toBeInTheDocument();
    const first = urls.find((url) => url.pathname === LIST_PATH);
    expect(first?.searchParams.has('worker')).toBe(false);
    expect(first?.searchParams.has('selected')).toBe(false);
    expect(within(workspace()).getAllByRole('region')).toHaveLength(2);
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
    // 배너는 목록 상자 안 표 자리에 선다(ERP 수신 탭과 같은 자리) — 조회 상자에는 없다.
    expect(
      within(screen.getByRole('region', { name: '사원 목록' })).getByRole('button', {
        name: '다시 시도',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: '조회 조건' })).queryByRole('button', {
        name: '다시 시도',
      }),
    ).not.toBeInTheDocument();
  });
});
