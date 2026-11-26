import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { departmentFixtures } from './fixtures';
import { CommonCodeScreen } from './screen';

type DepartmentProductionWarehouse = components['schemas']['DepartmentProductionWarehouse'];
const t = messages.commonCode.department.productionWarehouses;

/**
 * W-06-06 부서 폼 「생산 창고」 구획(003 계획 기반 출고 요청 · US8, tasks T012).
 * 공장·창고·요청 수는 모두 합성 값이다.
 */

const PLANTS = [
  { plantId: 8401, businessUnitId: 4001, plantCode: 'G1', plantName: '합성 1공장' },
  { plantId: 8402, businessUnitId: 4001, plantCode: 'G2', plantName: '합성 2공장' },
].map((plant) => ({ ...plant, legalEntityId: 5001, timezoneCode: 'UTC', isActive: true }));

const warehouse = (
  warehouseId: number,
  code: string,
  name: string,
  plantId = 8401,
  overrides: { isExternal?: boolean; isDefect?: boolean; isActive?: boolean } = {},
) => ({
  warehouseId,
  plantId,
  businessUnitId: 4001,
  warehouseCode: code,
  warehouseName: name,
  warehouseTypeCode: 'MATERIAL',
  isExternal: false,
  isDefect: false,
  isActive: true,
  ...overrides,
});

const WAREHOUSES = [
  warehouse(7001, 'SYN-PW-A', '합성 생산창고 A'),
  warehouse(7002, 'SYN-PW-B', '합성 생산창고 B'),
  warehouse(7003, 'SYN-PW-C', '합성 생산창고 C'),
  warehouse(7004, 'SYN-PW-G', '합성 생산창고 G', 8402),
  /* 유형으로 거르지 않는다(검토 9) — 불량 · 외부 창고도 후보다. 쓰지 않는 창고만 빠진다. */
  warehouse(7005, 'SYN-DF', '합성 불량창고', 8401, { isDefect: true }),
  warehouse(7006, 'SYN-EX', '합성 외주 보관창고', 8401, { isExternal: true }),
  warehouse(7007, 'SYN-OLD', '합성 구 자재창고', 8401, { isActive: false }),
];

const linkedOf = (ids: number[]): DepartmentProductionWarehouse[] =>
  WAREHOUSES.filter((item) => ids.includes(item.warehouseId)).map(
    ({ warehouseId, warehouseCode, warehouseName, plantId }) => ({
      warehouseId,
      warehouseCode,
      warehouseName,
      plantId,
    }),
  );

interface Recorded {
  method: string;
  url: URL;
  body: string;
}

interface SetupOptions {
  linked?: number[];
  /** dryRun 응답의 창고별 대기·배포 요청 수. 없으면 0장 */
  activeRequests?: Record<number, number>;
  departments?: unknown[];
}

const DEPARTMENTS = '/mdm/departments';
const LINKS = '/mdm/departments/3001/production-warehouses';

const setup = (options: SetupOptions = {}) => {
  const requests: Recorded[] = [];
  let linked = options.linked ?? [7001, 7002];
  const pathOf = (request: Request) => new URL(request.url).pathname;
  const isGet = (request: Request, path: string) =>
    request.method === 'GET' && pathOf(request) === path;

  const routes: StubRoute[] = [
    {
      match: (request) => isGet(request, DEPARTMENTS),
      respond: () =>
        jsonResponse({
          items: options.departments ?? departmentFixtures,
          page: { page: 1, size: 50, total: departmentFixtures.length },
        }),
    },
    {
      match: (request) => isGet(request, '/mdm/business-units'),
      respond: () => jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } }),
    },
    {
      match: (request) => isGet(request, `${DEPARTMENTS}/3001`),
      respond: () =>
        jsonResponse(
          {
            department: departmentFixtures[0],
            editability: { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 },
          },
          { headers: { ETag: 'W/"5"' } },
        ),
    },
    {
      match: (request) => request.method === 'PUT' && pathOf(request) === `${DEPARTMENTS}/3001`,
      respond: async (request) =>
        jsonResponse(
          { ...departmentFixtures[0], ...(JSON.parse(await request.clone().text()) as object) },
          { headers: { ETag: 'W/"6"' } },
        ),
    },
    {
      match: (request) => isGet(request, LINKS),
      respond: () => jsonResponse({ items: linkedOf(linked) }),
    },
    {
      match: (request) => request.method === 'PUT' && pathOf(request) === LINKS,
      respond: async (request) => {
        const body = JSON.parse(await request.clone().text()) as { warehouseIds: number[] };
        const removed = linked
          .filter((id) => !body.warehouseIds.includes(id))
          .map((id) => ({
            warehouseId: id,
            activeRequestCount: options.activeRequests?.[id] ?? 0,
          }));
        const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true';
        if (!dryRun) linked = body.warehouseIds;
        return jsonResponse({
          items: linkedOf(dryRun ? body.warehouseIds : linked),
          removed,
        });
      },
    },
    {
      match: (request) => isGet(request, '/mdm/warehouses'),
      respond: () =>
        jsonResponse({ items: WAREHOUSES, page: { page: 1, size: 200, total: WAREHOUSES.length } }),
    },
    {
      match: (request) => isGet(request, '/mdm/plants'),
      respond: () => jsonResponse({ items: PLANTS, page: { page: 1, size: 100, total: 2 } }),
    },
  ];
  const stub = createStubFetch(routes);

  renderWithProviders(<CommonCodeScreen />, {
    fetch: async (request) => {
      requests.push({
        method: request.method,
        url: new URL(request.url),
        body: request.method === 'GET' ? '' : await request.clone().text(),
      });
      return stub(request);
    },
    route: '/master-data/common-code?tab=org&dep=3001',
    dataRouter: true,
  });

  const writes = () => requests.filter((request) => request.method === 'PUT');
  return { user: userEvent.setup(), requests, writes };
};

const section = () => within(screen.getByRole('region', { name: t.title }));
const linkedTable = async () => within(await screen.findByRole('table', { name: t.tableLabel }));

/** 「+ 창고 추가」로 표 아래 추가 줄을 펼친다(종전 추가 창 대신 · 사용자 지시 2026-11-25). */
const openAddRow = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(section().getByRole('button', { name: `+ ${t.add}` }));
  return section().getByRole('combobox', { name: t.addRow.label });
};

/** 추가 줄에서 창고 하나를 골라 [추가] — 종전 창에서 그 창고를 체크한 것과 같다. */
const addWarehouse = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(await openAddRow(user));
  await user.click(screen.getByRole('option', { name: label }));
  await user.click(section().getByRole('button', { name: t.addRow.confirm }));
};

const saveButton = () =>
  within(screen.getByRole('region', { name: '부서 상세 정보' })).getByRole('button', {
    name: '저장',
  });

describe('W-06-06 생산 창고 구획', () => {
  it('US8-1 연결한 생산 창고를 공장과 창고로 보이고 「재고 보기」가 W-01-07 을 그 창고 조건으로 연다', async () => {
    const { user } = setup();
    /* 「재고 보기」는 링크 글자 대신 단추 모양이다(사용자 지시 2026-11-25) — 여는 주소 · 새 탭은 종전과 같다. */
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    const table = await linkedTable();
    expect(table.getAllByRole('row')).toHaveLength(3);
    expect(table.getAllByText('합성 1공장')).toHaveLength(2);
    expect(table.getByText('SYN-PW-A 합성 생산창고 A')).toBeInTheDocument();
    await user.click(
      table.getByRole('button', { name: t.viewStockLabel('SYN-PW-A 합성 생산창고 A') }),
    );
    expect(open).toHaveBeenCalledWith('/logistics/stock-status?wh=7001', '_blank', 'noreferrer');
    open.mockRestore();
    /* 출고 창고를 고르는 규칙은 제목 옆 ⓘ 의 설명으로 읽힌다(관리웹 정리 시안 A). */
    expect(screen.getByRole('button', { name: t.help })).toBeInTheDocument();
  });

  it('US8-1 창고 추가로 여럿을 고르고 저장하면 전체 교체가 고른 창고를 모두 싣는다(뺀 것이 없으면 확인 없이)', async () => {
    const { user, writes } = setup({ linked: [7001] });
    await linkedTable();
    expect(saveButton()).toBeDisabled();

    await addWarehouse(user, '합성 1공장 SYN-PW-B 합성 생산창고 B');
    /* [추가] 뒤에는 줄이 접힌다 — 다시 펼쳐 하나 더 넣는다. 창(dialog)은 뜨지 않는다. */
    expect(section().queryByRole('combobox', { name: t.addRow.label })).not.toBeInTheDocument();
    await addWarehouse(user, '합성 2공장 SYN-PW-G 합성 생산창고 G');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const table = await linkedTable();
    expect(table.getAllByText(t.newlyLinked)).toHaveLength(2);

    await user.click(saveButton());

    await waitFor(() => expect(writes()).toHaveLength(1));
    const [put] = writes();
    expect(put?.url.pathname).toBe(LINKS);
    expect(put?.url.searchParams.has('dryRun')).toBe(false);
    expect(JSON.parse(put?.body ?? '{}')).toEqual({ warehouseIds: [7001, 7002, 7004] });
    expect(await screen.findByText(messages.common.saved)).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('US8-2 요청이 남은 창고를 빼면 dryRun 으로 물어 요청 수를 보이고, 「연결 빼기」를 눌러야 저장한다', async () => {
    const { user, writes } = setup({ linked: [7001, 7002], activeRequests: { 7001: 4 } });
    const table = await linkedTable();

    await user.click(
      table.getByRole('button', { name: t.removeLabel('SYN-PW-A 합성 생산창고 A') }),
    );
    await user.click(saveButton());

    const dialog = within(await screen.findByRole('dialog', { name: t.confirm.title }));
    expect(dialog.getByText(t.confirm.body('SYN-PW-A 합성 생산창고 A', 4))).toBeInTheDocument();
    expect(writes()).toHaveLength(1);
    expect(writes()[0]?.url.searchParams.get('dryRun')).toBe('true');
    expect(JSON.parse(writes()[0]?.body ?? '{}')).toEqual({ warehouseIds: [7002] });

    await user.click(dialog.getByRole('button', { name: t.confirm.submit }));

    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes()[1]?.url.searchParams.has('dryRun')).toBe(false);
    expect(JSON.parse(writes()[1]?.body ?? '{}')).toEqual({ warehouseIds: [7002] });
  });

  it('US8-2 확인 창에서 취소하면 저장하지 않고 편집을 그대로 둔다', async () => {
    const { user, writes } = setup({ linked: [7001, 7002], activeRequests: { 7002: 2 } });
    const table = await linkedTable();

    await user.click(
      table.getByRole('button', { name: t.removeLabel('SYN-PW-B 합성 생산창고 B') }),
    );
    await user.click(saveButton());
    const dialog = within(await screen.findByRole('dialog', { name: t.confirm.title }));
    await user.click(dialog.getByRole('button', { name: t.confirm.cancel }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: t.confirm.title })).not.toBeInTheDocument(),
    );
    expect(writes().filter((put) => !put.url.searchParams.has('dryRun'))).toHaveLength(0);
    expect(saveButton()).toBeEnabled();
  });

  it('US8-2 뺀 창고의 요청이 0장이면 확인 창 없이 저장한다', async () => {
    const { user, writes } = setup({ linked: [7001, 7003] });
    const table = await linkedTable();

    await user.click(
      table.getByRole('button', { name: t.removeLabel('SYN-PW-C 합성 생산창고 C') }),
    );
    await user.click(saveButton());

    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes()[0]?.url.searchParams.get('dryRun')).toBe('true');
    expect(writes()[1]?.url.searchParams.has('dryRun')).toBe(false);
    expect(screen.queryByRole('dialog', { name: t.confirm.title })).not.toBeInTheDocument();
  });

  it('US8-1 부서 정보와 생산 창고를 함께 바꾸면 부서를 먼저 저장하고 그 뒤 연결을 저장한다', async () => {
    const { user, writes } = setup({ linked: [7001] });
    await linkedTable();

    const name = within(screen.getByRole('region', { name: '부서 상세 정보' })).getByRole(
      'textbox',
      {
        name: /부서명/,
      },
    );
    await user.clear(name);
    await user.type(name, '합성 부서 가');
    await addWarehouse(user, '합성 1공장 SYN-PW-C 합성 생산창고 C');
    await user.click(saveButton());

    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes().map((put) => put.url.pathname)).toEqual([`${DEPARTMENTS}/3001`, LINKS]);
    expect(JSON.parse(writes()[1]?.body ?? '{}')).toEqual({ warehouseIds: [7001, 7003] });
  });

  /* 사용자 지시 2026-11-26 — 배포 때 막힌다는 문구를 걷고, 표 머리줄은 그대로 두고 표 안에 빈 안내를 둔다. */
  it('연결한 생산 창고가 없어도 표 머리줄을 그리고 표 안에 빈 안내를 낸다', async () => {
    setup({ linked: [] });

    expect(await screen.findByText('연결한 생산 창고가 없습니다')).toBeInTheDocument();
    const table = section().getByRole('table');
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThan(0);
    expect(within(table).getByText('연결한 생산 창고가 없습니다')).toBeInTheDocument();
    expect(section().queryByText(/배포 때 막힙니다/)).toBeNull();
  });

  it('US8-1 부서 목록 「생산 창고」 열에 연결 수(0 포함)를 보이고, 칸이 없을 때만 「—」', async () => {
    setup({
      departments: departmentFixtures.map((department, index) =>
        index === 0
          ? { ...department, productionWarehouseCount: 2 }
          : index === 1
            ? { ...department, productionWarehouseCount: 0 }
            : department,
      ),
    });

    const list = within(screen.getByRole('region', { name: '부서' }));
    const cellOf = async (code: string) =>
      within((await list.findByRole('button', { name: code })).closest('tr') as HTMLElement);
    expect((await cellOf('SYN-DEPT-01')).getByText('2')).toBeInTheDocument();
    expect((await cellOf('SYN-DEPT-02')).getByText('0')).toBeInTheDocument();
    expect((await cellOf('SYN-DEPT-03')).getByText('—')).toBeInTheDocument();
  });

  it('US8-1 후보 창고는 유형으로 거르지 않아 불량 · 외부 창고가 남고, 쓰지 않는 창고 · 이미 연결한 창고만 빠진다', async () => {
    const { user } = setup({ linked: [7001] });
    await linkedTable();

    await user.click(await openAddRow(user));
    expect(screen.getByRole('option', { name: '합성 1공장 SYN-DF 합성 불량창고' })).toBeEnabled();
    expect(
      screen.getByRole('option', { name: '합성 1공장 SYN-EX 합성 외주 보관창고' }),
    ).toBeEnabled();
    expect(screen.queryByRole('option', { name: /SYN-OLD/ })).not.toBeInTheDocument();
    /* 이미 연결한 A 는 고를 것이 아니다 — 종전 창의 후보 6개 중 남은 5개. */
    expect(screen.queryByRole('option', { name: /SYN-PW-A/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });

  it('추가 줄은 창고를 고르기 전엔 [추가]가 꺼져 있고, [취소]하면 아무것도 넣지 않고 접힌다', async () => {
    const { user } = setup({ linked: [7001] });
    await linkedTable();

    await openAddRow(user);
    expect(section().getByRole('button', { name: t.addRow.confirm })).toBeDisabled();
    await user.click(section().getByRole('button', { name: messages.common.cancel }));

    expect(section().queryByRole('combobox', { name: t.addRow.label })).not.toBeInTheDocument();
    expect((await linkedTable()).queryByText(t.newlyLinked)).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });
});
