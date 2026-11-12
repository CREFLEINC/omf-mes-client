import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { BulkCreateDialog } from './bulk-create-dialog';
import { LocationPane } from './location-pane';
import type { Location } from './types';

const b = messages.warehouseLocation.bulkCreate;
const WAREHOUSE_ID = 7;
const TITLE = b.title('PTW-E · 시험 창고');

const loc = (
  locationId: number,
  locationCode: string,
  parentLocationId: number | null,
  extra: Partial<Location> = {},
): Location => ({
  locationId,
  warehouseId: WAREHOUSE_ID,
  parentLocationId,
  locationCode,
  locationName: locationCode,
  isActive: true,
  aliasName: null,
  locationLevelCode: null,
  isLeaf: false,
  systemRoleCode: null,
  hasItemRestriction: false,
  ...extra,
});

const STAGING = loc(1, 'SYS-STAGING', null, { systemRoleCode: 'PUTAWAY_STAGING' });
/** Z01(랙 3, A동) · Z02(구역 자체에 재고) */
const ZONED: Location[] = [
  STAGING,
  loc(10, 'Z01', null, { aliasName: 'A동 자재 구역' }),
  loc(11, 'Z01-R001', 10),
  loc(12, 'Z01-R002', 10),
  loc(13, 'Z01-R003', 10),
  loc(20, 'Z02', null),
];

interface Options {
  items?: Location[];
  /** 재고 조회 응답 — 위치 id 목록이면 그 위치에 재고, 숫자면 그 상태로 실패 */
  stock?: number[] | number;
  /** 랙 호출 응답 — 순번별(없으면 성공). 'hang' 이면 응답하지 않는다. */
  rack?: (call: number) => Response | 'hang' | undefined;
  /** 구역 POST 응답 코드를 바꾼다(동시 생성 흉내) */
  renameTo?: Record<string, string>;
  /** 이름 고치기 PUT 이 실패한다 */
  failPut?: boolean;
}

const setup = (options: Options = {}) => {
  const posts: { path: string; body: Record<string, unknown> }[] = [];
  let nextId = 500;
  let rackCalls = 0;
  const fetch = async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path === '/inventory/balances') {
      const stock = options.stock ?? [];
      if (typeof stock === 'number') return jsonResponse({ message: '' }, { status: stock });
      return jsonResponse({
        items: stock.map((locationId) => ({ groupBy: 'LOCATION', locationId, itemId: 1 })),
        page: { page: 1, size: 200, total: stock.length },
      });
    }
    if (request.method === 'POST') {
      const body = await request.clone().json();
      posts.push({ path, body });
      if (path === '/mdm/locations:rack') {
        const answer = options.rack?.(rackCalls++);
        if (answer === 'hang') return new Promise<Response>(() => undefined);
        if (answer !== undefined) return answer;
      }
      const name = String(body.locationName ?? 'R');
      const code = options.renameTo?.[name] ?? name;
      return jsonResponse(loc(nextId++, code, null, { locationName: name }), { status: 201 });
    }
    if (request.method === 'GET' && /^\/mdm\/locations\/\d+$/.test(path)) {
      return jsonResponse(
        { location: loc(1, 'X', null), editability: { codeEditable: false, reason: 'EDITABLE' } },
        { headers: { ETag: '"1"' } },
      );
    }
    if (request.method === 'PUT') {
      return options.failPut === true
        ? jsonResponse({ message: '' }, { status: 503 })
        : jsonResponse({ location: loc(1, 'X', null) });
    }
    throw new Error(`스텁에 없는 요청: ${request.method} ${path}`);
  };
  const onClose = vi.fn();
  renderWithProviders(
    <BulkCreateDialog
      open
      warehouseId={WAREHOUSE_ID}
      warehouseLabel="PTW-E · 시험 창고"
      items={options.items ?? [STAGING]}
      onClose={onClose}
    />,
    { fetch },
  );
  return { posts, onClose, user: userEvent.setup() };
};

const dialog = () => screen.getByRole('dialog', { name: TITLE });

const fill = async (user: ReturnType<typeof userEvent.setup>, label: string, value: string) => {
  const field = within(dialog()).getByLabelText(label);
  await user.clear(field);
  await user.type(field, value);
};

const fillAll = async (
  user: ReturnType<typeof userEvent.setup>,
  values: { zones?: string; racks: string; levels: string; cells?: string },
) => {
  if (values.zones !== undefined) await fill(user, b.zoneCount, values.zones);
  await fill(user, b.racksPerZone, values.racks);
  await fill(user, b.levelsPerRack, values.levels);
  if (values.cells !== undefined) await fill(user, b.cellsPerLevel, values.cells);
};

const summary = () => within(dialog()).getByRole('region', { name: b.total });

describe('BulkCreateDialog', () => {
  it('US1-1 ⭐ 2×5×4×10 을 넣으면 합계 452 와 첫 · 마지막 코드가 바로 보인다', async () => {
    const { user } = setup();

    await fillAll(user, { zones: '2', racks: '5', levels: '4', cells: '10' });

    expect(within(summary()).getByText(b.count(452))).toBeInTheDocument();
    expect(within(summary()).getByText(b.parts(2, 10, 40, 400))).toBeInTheDocument();
    expect(within(summary()).getByText('Z01')).toBeInTheDocument();
    expect(within(summary()).getByText('Z02-R005-L04-C10')).toBeInTheDocument();
  });

  it('US1-2 ⭐ [만들기] → 만드는 중 n/m → 끝남, 다 만들면 [닫기]', async () => {
    const { posts, user } = setup();

    await fillAll(user, { zones: '2', racks: '5', levels: '4', cells: '10' });
    await user.click(within(dialog()).getByRole('button', { name: b.make }));

    expect(await within(dialog()).findByText(b.done(452))).toBeInTheDocument();
    expect(posts).toHaveLength(12);
    /* 머리의 × 와 발의 [닫기] 둘 다 다시 선다. */
    for (const button of within(dialog()).getAllByRole('button', { name: messages.common.close })) {
      expect(button).toBeEnabled();
    }
    expect(within(dialog()).queryByRole('button', { name: b.make })).toBeNull();
  });

  it('US1-4 층 0 이면 셀 칸이 막히고 랙까지만 센다', async () => {
    const { user } = setup();

    await fillAll(user, { zones: '1', racks: '3', levels: '0' });

    expect(within(dialog()).getByLabelText(b.cellsPerLevel)).toBeDisabled();
    expect(within(summary()).getByText(b.count(4))).toBeInTheDocument();
    expect(within(summary()).getByText('Z01-R003')).toBeInTheDocument();
  });

  it('US1-5 기존 구역 Z01(랙 3)을 골라 랙 2×4×10 — Z01-R004 부터, 구역 수 칸이 없다', async () => {
    const { posts, user } = setup({ items: ZONED });

    await user.click(within(dialog()).getByRole('radio', { name: b.modeExisting }));
    expect(within(dialog()).queryByLabelText(b.zoneCount)).toBeNull();
    expect(within(dialog()).getByText(b.zoneInfo(3, 0))).toBeInTheDocument();
    await user.click(
      within(dialog()).getByRole('checkbox', { name: b.zoneName('Z01', 'A동 자재 구역') }),
    );
    await fillAll(user, { racks: '2', levels: '4', cells: '10' });

    expect(within(summary()).getByText(b.count(90))).toBeInTheDocument();
    expect(within(summary()).getByText(b.parts(null, 2, 8, 80))).toBeInTheDocument();
    expect(within(summary()).getByText('Z01-R004')).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: b.make }));
    await within(dialog()).findByText(b.done(90));
    expect(posts.map((post) => [post.path, post.body.parentLocationId])).toEqual([
      ['/mdm/locations:rack', 10],
      ['/mdm/locations:rack', 10],
    ]);
  });

  it('US1-5 고른 구역이 없으면 [만들기]가 막히고 이유가 이어진다', async () => {
    const { user } = setup({ items: ZONED });

    await user.click(within(dialog()).getByRole('radio', { name: b.modeExisting }));

    const make = within(dialog()).getByRole('button', { name: b.make });
    expect(make).toBeDisabled();
    expect(make).toHaveAccessibleDescription(b.pickRequired);
  });

  it('US1-6 ⭐ 구역 자체에 재고가 있으면 고를 수 없고 이유가 보인다', async () => {
    const { user } = setup({ items: ZONED, stock: [20, 11] });

    await user.click(within(dialog()).getByRole('radio', { name: b.modeExisting }));

    const z02 = within(dialog()).getByRole('checkbox', { name: 'Z02' });
    await waitFor(() => expect(z02).toBeDisabled());
    expect(within(dialog()).getByText(b.stockBlocked)).toBeInTheDocument();
    /* 랙에만 재고가 있는 Z01 은 고를 수 있다. */
    expect(
      within(dialog()).getByRole('checkbox', { name: b.zoneName('Z01', 'A동 자재 구역') }),
    ).toBeEnabled();
  });

  it('US1-6 재고 조회가 403 이면 「모름」 — 막지 않고, 서버 거부를 그 구역의 실패로 보인다', async () => {
    const reason = '재고가 있는 위치 밑에는 위치를 둘 수 없습니다 — 재고를 먼저 옮깁니다.';
    const { posts, user } = setup({
      items: ZONED,
      stock: 403,
      rack: (call) =>
        call === 0
          ? jsonResponse(
              {
                errors: [
                  {
                    scope: 'field',
                    field: 'parentLocationId',
                    code: 'STATE_LOCKED',
                    message: reason,
                  },
                ],
              },
              { status: 400 },
            )
          : undefined,
    });

    await user.click(within(dialog()).getByRole('radio', { name: b.modeExisting }));
    const z02 = within(dialog()).getByRole('checkbox', { name: 'Z02' });
    expect(z02).toBeEnabled();
    await user.click(z02);
    await user.click(
      within(dialog()).getByRole('checkbox', { name: b.zoneName('Z01', 'A동 자재 구역') }),
    );
    await fillAll(user, { racks: '1', levels: '1', cells: '1' });
    await user.click(within(dialog()).getByRole('button', { name: b.make }));

    expect(await within(dialog()).findByText(b.failure('Z02-R001', reason))).toBeInTheDocument();
    expect(posts).toHaveLength(2);
  });

  it('US1-7 ⭐ 일부 실패 → 실패 목록과 [남은 것 다시 만들기], 누르면 남은 것만', async () => {
    let failing = true;
    const { posts, user } = setup({
      rack: (call) =>
        failing && call === 1 ? jsonResponse({ message: '' }, { status: 503 }) : undefined,
    });

    await fillAll(user, { zones: '1', racks: '3', levels: '1', cells: '1' });
    await user.click(within(dialog()).getByRole('button', { name: b.make }));

    expect(await within(dialog()).findByText(b.partial(7, 1))).toBeInTheDocument();
    expect(within(dialog()).getByText(/Z01-R002/)).toBeInTheDocument();
    /* 굳힌 계획 — 입력칸은 잠긴다. */
    expect(within(dialog()).getByLabelText(b.racksPerZone)).toBeDisabled();

    failing = false;
    posts.length = 0;
    await user.click(within(dialog()).getByRole('button', { name: b.retryRest }));

    expect(await within(dialog()).findByText(b.done(10))).toBeInTheDocument();
    expect(posts.map((post) => [post.path, post.body.parentLocationId])).toEqual([
      ['/mdm/locations:rack', 500],
    ]);
  });

  it('US1-7 만들기는 됐고 이름 맞추기만 실패하면 그 안내와 [남은 것 다시 만들기]', async () => {
    const { user } = setup({ renameTo: { Z01: 'Z02' }, failPut: true });

    await fillAll(user, { zones: '1', racks: '1', levels: '1', cells: '1' });
    await user.click(within(dialog()).getByRole('button', { name: b.make }));

    expect(await within(dialog()).findByText(b.partialNames(4))).toBeInTheDocument();
    expect(within(dialog()).getByText(/Z02/)).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: b.retryRest })).toBeEnabled();
  });

  it('EC-limit 셀 1,001 이면 [만들기]가 막히고 상한 안내가 이어진다', async () => {
    const { user } = setup();

    await fillAll(user, { zones: '1', racks: '11', levels: '7', cells: '13' });

    const make = within(dialog()).getByRole('button', { name: b.make });
    expect(make).toBeDisabled();
    expect(make).toHaveAccessibleDescription(b.overCells(1001));
  });

  it('EC-close ⭐ 만드는 중에는 Esc · × · 취소로 닫히지 않는다', async () => {
    const { onClose, user } = setup({ rack: () => 'hang' });

    await fillAll(user, { zones: '1', racks: '1', levels: '1', cells: '1' });
    await user.click(within(dialog()).getByRole('button', { name: b.make }));

    expect(await within(dialog()).findByRole('button', { name: b.making(1, 2) })).toBeDisabled();
    expect(within(dialog()).getByRole('button', { name: messages.common.cancel })).toBeDisabled();
    expect(within(dialog()).queryByRole('button', { name: messages.common.close })).toBeNull();
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    fireEvent(dialog(), new Event('cancel', { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Location 탭 [일괄 생성] 단추', () => {
  const renderPane = (props: { canBulkCreate: boolean; canAddRoot?: boolean }) => {
    const onBulkCreate = vi.fn();
    render(
      <LocationPane
        rows={[]}
        isLoading={false}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        onCollapseAll={vi.fn()}
        onExpandAll={vi.fn()}
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        filterText=""
        onFilterTextChange={vi.fn()}
        canAddRoot={props.canAddRoot ?? true}
        addRootDisabledReason="계층을 불러온 뒤"
        onAddRoot={vi.fn()}
        canAddChild={false}
        onAddChild={vi.fn()}
        canPrintLabels={false}
        isPrintingLabels={false}
        onPrintLabels={vi.fn()}
        onEdit={vi.fn()}
        actionBanner={null}
        loadError={null}
        canBulkCreate={props.canBulkCreate}
        onBulkCreate={onBulkCreate}
      />,
    );
    return { onBulkCreate };
  };

  it('US1-1 [구역 추가]와 [랙 추가] 사이에 서고, 누르면 창을 연다', async () => {
    const { onBulkCreate } = renderPane({ canBulkCreate: true });

    const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    const zone = names.findIndex((name) =>
      name.includes(messages.warehouseLocation.actions.addZone),
    );
    const bulk = names.findIndex((name) => name.includes(b.open));
    const rack = names.findIndex((name) =>
      name.includes(messages.warehouseLocation.actions.addRack),
    );
    expect(zone).toBeLessThan(bulk);
    expect(bulk).toBeLessThan(rack);

    await userEvent.setup().click(screen.getByRole('button', { name: new RegExp(b.open) }));
    expect(onBulkCreate).toHaveBeenCalledOnce();
  });

  it('US1-1 위치 쓰기 권한이 없으면 단추가 없다', () => {
    renderPane({ canBulkCreate: false });

    expect(screen.queryByRole('button', { name: new RegExp(b.open) })).toBeNull();
  });

  it('US1-1 계층을 못 불렀으면 막히고 구역 추가와 같은 이유가 이어진다', () => {
    renderPane({ canBulkCreate: true, canAddRoot: false });

    const button = screen.getByRole('button', { name: new RegExp(b.open) });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('계층을 불러온 뒤');
  });
});
