import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse } from '../../test/api-harness';
import { setupScreen, writesTo } from './test-fixtures';

const t = messages.productionWarehouseReplenishment;
const ti = t.items;
const td = t.itemDialog;
const tt = t.runTime;

const ITEMS = '/production/warehouse-replenishment?view=items';

const listTable = async () => within(await screen.findByRole('table', { name: ti.listLabel }));
const rowOf = async (code: string) => {
  const found = (await listTable()).getByRole('button', { name: new RegExp(code) }).closest('tr');
  if (found === null) throw new Error(`${code} 줄이 없다`);
  return within(found);
};
const itemQueries = (gets: readonly URL[]) =>
  gets.filter(
    (url) =>
      url.pathname === '/logistics/replenishment-items' &&
      url.searchParams.get('size') !== '1' &&
      !url.searchParams.has('productionWarehouseId'),
  );

describe('W-02-12 생산 창고 보충 — 관리 품목 보기', () => {
  it('US4-1 관리 품목마다 보충 시점 · 유지량 · 출고 자재 창고와 계산 값(가용 · 예정 · 쓸 수 있는 양 · 보충 중), 「기준 아래」 칩을 보인다', async () => {
    setupScreen({ route: ITEMS });

    const label = await rowOf('SYN-IT-2');
    const cells = label.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells).toEqual([
      '합성 생산창고 A',
      'SYN-IT-2 합성 라벨지',
      '400',
      '1,000',
      'EA',
      '합성 자재창고 2',
      '160',
      '40',
      '120',
      '100',
      `${ti.below}${t.status.IN_PROGRESS}`,
    ]);
    expect((await rowOf('SYN-IT-1')).getByText(ti.above)).toBeInTheDocument();
  });

  it('US4-7 품목 · 출고 자재 창고 · 「보충 시점 아래만」 조건이 계약 조건으로 나간다', async () => {
    const { user, gets } = setupScreen({ route: ITEMS });
    await listTable();
    const filters = within(screen.getByRole('region', { name: ti.filters.label }));

    await user.click(filters.getByRole('combobox', { name: ti.filters.source }));
    await user.click(await screen.findByRole('option', { name: '합성 자재창고 2' }));
    await user.click(filters.getByRole('combobox', { name: ti.filters.item }));
    await user.click(await screen.findByRole('option', { name: 'SYN-IT-2 · 합성 라벨지' }));
    await user.click(filters.getByRole('button', { name: t.common.search }));
    await waitFor(() => {
      const last = itemQueries(gets).at(-1);
      expect(last?.searchParams.get('sourceWarehouseId')).toBe('7102');
      expect(last?.searchParams.get('itemId')).toBe('602');
    });

    await user.click(filters.getByRole('checkbox', { name: ti.filters.belowOnly }));
    await waitFor(() =>
      expect(itemQueries(gets).at(-1)?.searchParams.get('belowPointOnly')).toBe('true'),
    );
  });

  it('US4-2 보충 시점이 유지량 이상이면 오류를 보이고 저장을 잠근다', async () => {
    const { user, writes } = setupScreen({ route: ITEMS });

    await user.click((await listTable()).getByRole('button', { name: /SYN-IT-1/ }));
    const dialog = within(await screen.findByRole('dialog', { name: td.editTitle }));
    const point = dialog.getByLabelText(td.point);
    await user.clear(point);
    await user.type(point, '200');

    expect(dialog.getAllByText(t.errors.range).length).toBeGreaterThan(0);
    const save = dialog.getByRole('button', { name: td.save });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(t.errors.range);

    await user.clear(point);
    await user.type(point, '60');
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(writesTo(writes, 'PUT', '/replenishment-items/1')).toHaveLength(1));
    expect(writesTo(writes, 'PUT', '/replenishment-items/1')[0]?.body).toEqual({
      reorderPointQty: 60,
      targetQty: 200,
      sourceWarehouseId: 7101,
      versionNo: 3,
    });
  });

  it('US4-1 추가 창은 생산 창고 · 품목(자재 유형만) · 보충 시점 · 유지량 · 출고 자재 창고를 보내고, 중복 409 는 안내한다', async () => {
    const { user, writes, gets } = setupScreen({
      route: ITEMS,
      respondWrite: (method, path) =>
        method === 'POST' && path === '/logistics/replenishment-items'
          ? jsonResponse(
              { conflictCause: 'user', code: 'DUPLICATE', message: 'duplicate' },
              { status: 409 },
            )
          : undefined,
    });

    await user.click(await screen.findByRole('button', { name: ti.add }));
    const dialog = within(await screen.findByRole('dialog', { name: td.addTitle }));
    await user.click(dialog.getByRole('combobox', { name: td.item }));
    await user.click(await screen.findByRole('option', { name: 'SYN-IT-3 · 합성 테이프' }));
    await user.type(dialog.getByLabelText(td.point), '30');
    await user.type(dialog.getByLabelText(td.target), '100');
    await user.click(dialog.getByRole('combobox', { name: td.source }));
    await user.click(await screen.findByRole('option', { name: '합성 자재창고 2' }));
    await user.click(dialog.getByRole('button', { name: td.save }));

    await waitFor(() => expect(writesTo(writes, 'POST', '/replenishment-items')).toHaveLength(1));
    expect(writesTo(writes, 'POST', '/replenishment-items')[0]?.body).toEqual({
      productionWarehouseId: 7001,
      itemId: 603,
      reorderPointQty: 30,
      targetQty: 100,
      sourceWarehouseId: 7102,
    });
    expect(await dialog.findByText(t.errors.duplicateItem)).toBeInTheDocument();
    /* 품목 고르기는 자재 유형만 묻는다(plan 확인할 것 3). */
    const itemSearch = gets.filter((url) => url.pathname === '/mdm/items').at(-1);
    expect(itemSearch?.searchParams.getAll('itemTypeCode').join(',')).toContain('RAW_MATERIAL');
  });

  it('US4-5 진행 중 요청이 있는 품목을 지우면 확인 창이 「그대로 진행됩니다」를 알리고, 지운 뒤 진행 중 요청 수를 보인다', async () => {
    const { user, writes } = setupScreen({
      route: ITEMS,
      respondWrite: (method) =>
        method === 'DELETE' ? jsonResponse({ inProgressRequestCount: 2 }) : undefined,
    });

    await user.click((await listTable()).getByRole('button', { name: /SYN-IT-2/ }));
    await user.click(
      within(await screen.findByRole('dialog', { name: td.editTitle })).getByRole('button', {
        name: td.delete,
      }),
    );
    const confirm = within(await screen.findByRole('dialog', { name: td.deleteTitle }));
    expect(confirm.getByText(td.deleteBody('SYN-IT-2 합성 라벨지', true))).toBeInTheDocument();
    await user.click(confirm.getByRole('button', { name: td.deleteConfirm }));

    await waitFor(() => expect(writesTo(writes, 'DELETE', '/replenishment-items/2')).toHaveLength(1));
    expect(await screen.findByText(t.toast.itemDeletedInProgress(2))).toBeInTheDocument();
  });
});

describe('W-02-12 생산 창고 보충 — 자동 보충 시각', () => {
  it('창고별 「공장 기본」/시각을 보이고, 바꾸면 「오늘 이미 실행했으면 내일부터」 안내 뒤 바뀐 것만 저장한다', async () => {
    const { user, writes } = setupScreen({ route: ITEMS });
    const panel = within(await screen.findByRole('region', { name: tt.title }));

    expect(panel.getByRole('combobox', { name: tt.plantDefault })).toHaveTextContent('01:00');
    expect(
      panel.getByRole('combobox', { name: tt.warehouseLabel('합성 생산창고 A') }),
    ).toHaveTextContent('07:00');
    expect(
      panel.getByRole('combobox', { name: tt.warehouseLabel('합성 생산창고 B') }),
    ).toHaveTextContent(tt.plantDefaultValue('01:00'));
    expect(panel.getByRole('button', { name: tt.save })).toBeDisabled();

    /* 창고 A 를 공장 기본으로, 공장 기본을 02:30 으로. */
    await user.click(panel.getByRole('combobox', { name: tt.warehouseLabel('합성 생산창고 A') }));
    await user.click(await screen.findByRole('option', { name: tt.plantDefaultValue('01:00') }));
    await user.click(panel.getByRole('combobox', { name: tt.plantDefault }));
    await user.click(await screen.findByRole('option', { name: '02:30' }));
    expect(panel.getByText(tt.changedNote)).toBeInTheDocument();

    await user.click(panel.getByRole('button', { name: tt.save }));
    await waitFor(() =>
      expect(writesTo(writes, 'PUT', '/replenishment-settings/warehouses/7001')).toHaveLength(1),
    );
    expect(writesTo(writes, 'PUT', '/replenishment-settings/warehouses/7001')[0]?.body).toEqual({
      runTime: null,
      versionNo: 2,
    });
    expect(writesTo(writes, 'POST', '/app/operation-policies')[0]?.body).toMatchObject({
      policyCode: 'REPLENISHMENT_RUN_TIME',
      plantId: 8401,
      valueText: '02:30',
    });
    /* 창고 B 는 바꾸지 않았다. */
    expect(writesTo(writes, 'PUT', '/replenishment-settings/warehouses/7002')).toHaveLength(0);
  });
});
