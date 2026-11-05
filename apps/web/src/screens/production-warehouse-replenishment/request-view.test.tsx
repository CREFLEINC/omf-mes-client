import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse } from '../../test/api-harness';
import { request, setupScreen, writesTo } from './test-fixtures';

const t = messages.productionWarehouseReplenishment;
const tr = t.request;

type User = ReturnType<typeof setupScreen>['user'];

const table = async () => within(await screen.findByRole('table', { name: tr.title }));
const rowOf = async (index: number) => {
  const rows = (await table()).getAllByRole('row').slice(1);
  const row = rows[index];
  if (row === undefined) throw new Error(`${String(index + 1)}번 줄이 없다`);
  return within(row);
};

const pickItem = async (user: User, row: number, label: string) => {
  await user.click(await screen.findByRole('combobox', { name: tr.itemLabel(row) }));
  await user.click(await screen.findByRole('option', { name: label }));
};

const pickSource = async (user: User, row: number, label: string) => {
  await user.click(screen.getByRole('combobox', { name: tr.sourceLabel(row) }));
  await user.click(await screen.findByRole('option', { name: label }));
};

describe('W-02-12 생산 창고 보충 — 요청 보기', () => {
  it('US1-2 관리 품목을 고르면 출고 자재 창고가 관리 품목 값으로 채워지고 보충 시점·유지량 작은 글을 보인다', async () => {
    const { user } = setupScreen();

    await pickItem(user, 1, 'SYN-IT-1 · 합성 동선');

    const row = await rowOf(0);
    expect(await row.findByText(tr.managedNote('50', '200'))).toBeInTheDocument();
    expect(row.getByRole('combobox', { name: tr.sourceLabel(1) })).toHaveTextContent(
      '합성 자재창고 1',
    );
    /* 기본값을 바꿀 수 있다 — 후보에 생산 창고 자신 · 불량창고는 없다(FR-002). */
    await user.click(row.getByRole('combobox', { name: tr.sourceLabel(1) }));
    expect(await screen.findByRole('option', { name: '합성 자재창고 2' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '합성 생산창고 A' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '합성 불량창고' })).not.toBeInTheDocument();
  });

  it('US1-3 관리 품목이 아니면 출고 자재 창고가 비어 있고, 고르기 전에는 보낼 수 없다', async () => {
    const { user } = setupScreen();

    await pickItem(user, 1, 'SYN-IT-3 · 합성 테이프');
    const row = await rowOf(0);
    expect(await row.findByText(tr.notManaged)).toBeInTheDocument();
    await user.type(row.getByRole('textbox', { name: tr.qtyLabel(1) }), '10');

    expect(row.getByText(tr.sourceRequired)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: tr.submit })).toBeDisabled();

    await pickSource(user, 1, '합성 자재창고 1');
    expect(row.queryByText(tr.sourceRequired)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: tr.submit })).toBeEnabled();
  });

  it('「생산 창고 쓸 수 있는 양」·「자재 창고 남은 수량」은 출고 예정 조회 값이다(관리 품목 아닌 품목도)', async () => {
    const { user, gets } = setupScreen();

    await pickItem(user, 1, 'SYN-IT-3 · 합성 테이프');
    await pickSource(user, 1, '합성 자재창고 1');
    const row = await rowOf(0);
    /* 생산창고 A 의 테이프: 가용 10 − 예정 0. 자재창고 1 에는 테이프 행이 없어 모른다(—). */
    expect(row.getAllByRole('cell')[4]).toHaveTextContent('10');
    expect(row.getAllByRole('cell')[5]).toHaveTextContent(t.common.none);
    expect(
      gets.some((url) => url.pathname === '/logistics/material-issue-requests/planned-stock'),
    ).toBe(true);
  });

  it('US1-6 요청 수량이 자재 창고 남은 수량을 넘으면 줄 아래 노랑 안내 「남은 N 까지만, 나머지 M 부족」', async () => {
    const { user } = setupScreen();

    await pickItem(user, 1, 'SYN-IT-1 · 합성 동선');
    const row = await rowOf(0);
    await user.type(row.getByRole('textbox', { name: tr.qtyLabel(1) }), '300');

    expect(row.getByText(tr.capped('260', '40'))).toHaveClass('is-warning');
    /* 막지 않는다 — 서버가 상한까지만 만들고 나머지를 부족으로 둔다. */
    expect(screen.getByRole('button', { name: tr.submit })).toBeEnabled();
  });

  it('US1-7 자재 창고 남은 수량이 0 이면 빨강 안내 「이 줄은 요청되지 않습니다」', async () => {
    const { user } = setupScreen();

    await pickItem(user, 1, 'SYN-IT-3 · 합성 테이프');
    await pickSource(user, 1, '합성 자재창고 2');
    const row = await rowOf(0);
    await user.type(row.getByRole('textbox', { name: tr.qtyLabel(1) }), '20');

    expect(row.getByText(tr.noFree)).toHaveClass('is-error');
  });

  it('「관리 품목 중 기준 아래 불러오기」는 기준 아래 품목을 「유지량 − 쓸 수 있는 양」으로 채운다', async () => {
    const { user } = setupScreen();

    await (await table()).findAllByRole('row');
    await user.click(await screen.findByRole('button', { name: tr.loadBelow }));

    /* 라벨지: 유지량 1,000 − 쓸 수 있는 양 120 = 880, 출고 자재 창고 = 관리 품목 값(자재창고 2). */
    const row = await rowOf(0);
    expect(await row.findByRole('textbox', { name: tr.qtyLabel(1) })).toHaveValue('880');
    expect(row.getByRole('combobox', { name: tr.sourceLabel(1) })).toHaveTextContent(
      '합성 자재창고 2',
    );
    /* 기준 이상인 동선은 불러오지 않는다. */
    expect((await table()).getAllByRole('row')).toHaveLength(2);
  });

  it('US1-6 · US1-7 [요청 보내기] 결과 창은 창고별 장 수 · 부족 · 건너뛴 줄을 보이고 [진행에서 보기]로 넘어간다', async () => {
    const { user, writes } = setupScreen({
      respondWrite: (method, path) =>
        method === 'POST' && path === '/logistics/replenishment-requests'
          ? jsonResponse(
              {
                requests: [
                  request(21, { lineCount: 1, shortageQtyTotal: 40 }),
                  request(22, {
                    sourceWarehouseId: 7102,
                    sourceWarehouseName: '합성 자재창고 2',
                    lineCount: 1,
                  }),
                ],
                skippedLines: [
                  { itemId: 603, sourceWarehouseId: 7102, requestedQty: 20, freeQty: 0 },
                ],
              },
              { status: 201 },
            )
          : undefined,
    });

    await pickItem(user, 1, 'SYN-IT-1 · 합성 동선');
    await user.type((await rowOf(0)).getByRole('textbox', { name: tr.qtyLabel(1) }), '300');
    await user.click(screen.getByRole('button', { name: tr.addLine }));
    await pickItem(user, 2, 'SYN-IT-3 · 합성 테이프');
    await pickSource(user, 2, '합성 자재창고 2');
    await user.type((await rowOf(1)).getByRole('textbox', { name: tr.qtyLabel(2) }), '20');
    await user.click(screen.getByRole('button', { name: tr.submit }));

    const result = within(await screen.findByRole('dialog', { name: tr.result.title }));
    expect(result.getByText(tr.result.created(2))).toBeInTheDocument();
    expect(result.getByText(tr.result.request('합성 자재창고 1', 'SYN-MIR-21', 1))).toBeInTheDocument();
    expect(result.getByText(tr.result.request('합성 자재창고 2', 'SYN-MIR-22', 1))).toBeInTheDocument();
    expect(result.getByText(tr.result.shortage('SYN-MIR-21', '40'))).toBeInTheDocument();
    expect(result.getByText(tr.result.skipped('SYN-IT-3 합성 테이프', '20'))).toBeInTheDocument();

    const [post] = writesTo(writes, 'POST', '/logistics/replenishment-requests');
    expect(post?.body).toMatchObject({
      productionWarehouseId: 7001,
      lines: [
        { itemId: 601, requestedQty: 300, sourceWarehouseId: 7101 },
        { itemId: 603, requestedQty: 20, sourceWarehouseId: 7102 },
      ],
    });

    await user.click(result.getByRole('button', { name: tr.result.toProgress }));
    expect(await screen.findByRole('table', { name: t.progress.listLabel })).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: /SYN-MIR-21/ })).toBeInTheDocument();
  });

  it('US1-7 모든 줄의 남은 수량이 0 이라 409 PLANNED_STOCK_CONFLICT 면 「요청하지 못했습니다」 안내', async () => {
    const { user } = setupScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              { scope: 'screen', code: 'PLANNED_STOCK_CONFLICT', message: 'conflict' },
            ],
            plannedStockConflicts: [],
          },
          { status: 409 },
        ),
    });

    await pickItem(user, 1, 'SYN-IT-1 · 합성 동선');
    await user.type((await rowOf(0)).getByRole('textbox', { name: tr.qtyLabel(1) }), '10');
    await user.click(screen.getByRole('button', { name: tr.submit }));

    await waitFor(() => expect(screen.getByText(tr.conflict)).toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: tr.result.title })).not.toBeInTheDocument();
  });
});
