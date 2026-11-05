import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SETTINGS, setupScreen } from './test-fixtures';

const t = messages.productionWarehouseReplenishment;

const views = () => within(screen.getByRole('group', { name: t.views.label }));

describe('W-02-12 생산 창고 보충 — 화면 틀', () => {
  it('US1-8 생산 창고가 없는 공장은 모든 보기 대신 안내를 보이고 요청을 받지 않는다', async () => {
    setupScreen({ settings: { ...SETTINGS, warehouses: [] } });

    expect(await screen.findByText(t.noProductionWarehouse.title)).toBeInTheDocument();
    expect(screen.getByText(t.noProductionWarehouse.description)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.request.submit })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.noProductionWarehouse.action }),
    ).toBeInTheDocument();
  });

  it('보기 토글은 주소(?view=)를 바꾸고, 보기 이름 옆에 활성 요청 수와 기준 아래 품목 수를 보인다', async () => {
    const { user } = setupScreen();

    /* 기본 보기는 요청. */
    expect(await screen.findByRole('table', { name: t.request.title })).toBeInTheDocument();
    expect(
      await views().findByRole('button', { name: t.views.progressCount(3) }),
    ).toBeInTheDocument();
    expect(views().getByRole('button', { name: t.views.itemsBelow(1) })).toBeInTheDocument();

    await user.click(views().getByRole('button', { name: t.views.progressCount(3) }));
    expect(await screen.findByRole('table', { name: t.progress.listLabel })).toBeInTheDocument();
    expect(views().getByRole('button', { name: t.views.progressCount(3) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(views().getByRole('button', { name: t.views.itemsBelow(1) }));
    expect(await screen.findByRole('table', { name: t.items.listLabel })).toBeInTheDocument();
  });

  it('주소로 연 보기와 고른 요청을 그대로 보인다(?view=progress&id=)', async () => {
    setupScreen({ route: '/production/warehouse-replenishment?view=progress&id=2' });

    expect(await screen.findByRole('table', { name: t.progress.listLabel })).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: /SYN-MIR-02/ })).toBeInTheDocument();
  });
});
