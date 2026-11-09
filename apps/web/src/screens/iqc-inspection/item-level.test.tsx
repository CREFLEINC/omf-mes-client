import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';

/* 검사 수준 관리 권한(W-03-12)이 있는 계정 — 권한이 없어서 [지정]이 안 서는 것과 가르기 위해서다. */
vi.mock('../../patterns/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../patterns/session')>()),
  useSession: () => ({ session: { permissions: ['W-03-12'] } }),
}));

const { ItemLevel, ItemLevelStep } = await import('./item-level');

const t = messages.iqcInspection.detail.level;
const ITEM = { itemCode: 'SYN-ITEM-01', itemName: '합성 품목' };
const LEVEL = {
  itemInspectionLevelId: 7001,
  itemId: 501,
  ...ITEM,
  inspectionLevelCode: 'NORMAL',
  autoSwitchEnabled: false,
  consecutiveAcceptCount: 0,
  updatedAt: '2026-11-01T00:00:00Z',
  versionNo: 1,
};

const render = (node: React.ReactNode, levels: object[]) =>
  renderWithProviders(node, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/quality/item-inspection-levels',
        respond: () =>
          jsonResponse({ items: levels, page: { page: 1, size: 1, total: levels.length } }),
      },
      {
        match: (request) =>
          new URL(request.url).pathname === '/quality/item-inspection-level-histories',
        respond: () => jsonResponse({ items: [], page: { page: 1, size: 10, total: 0 } }),
      },
    ]),
  });

/** 검사 수준은 상세 머리에서 보기만 하고, 지정은 검사 중 4M 단계에서 수준이 없을 때만 한다(#247). */
describe('ItemLevel', () => {
  it('상세 머리 — 수준이 없으면 [지정] 없이 [수준 조회]만 둔다', async () => {
    render(<ItemLevel itemId={501} item={ITEM} />, []);

    expect(await screen.findByText(t.unset)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.set })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.view })).toBeInTheDocument();
  });

  it('상세 머리 — 수준이 있으면 [수준 조회]로 그 품목의 이력 창을 연다', async () => {
    render(<ItemLevel itemId={501} item={ITEM} />, [LEVEL]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: t.view }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(ITEM.itemName)).toBeInTheDocument();
  });

  it('4M 단계 — 수준이 없으면 [지정]을 둔다', async () => {
    render(<ItemLevelStep itemId={501} item={ITEM} />, []);

    expect(await screen.findByRole('button', { name: t.set })).toBeInTheDocument();
  });

  it('4M 단계 — 수준이 있으면 줄을 두지 않는다', async () => {
    /* 머리 칸과 같은 조회를 나눠 쓴다 — 머리에 수준 이름이 서면 조회가 끝난 것이다. */
    const { container } = render(
      <>
        <ItemLevel itemId={501} item={ITEM} />
        <ItemLevelStep itemId={501} item={ITEM} />
      </>,
      [LEVEL],
    );

    expect(
      await screen.findByText(messages.inspectionLevel.levels.NORMAL ?? 'NORMAL'),
    ).toBeInTheDocument();
    expect(container.querySelector('.iqc-inspection-level-step')).toBeNull();
    expect(screen.queryByRole('button', { name: t.set })).not.toBeInTheDocument();
  });
});
