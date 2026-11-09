import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';

/* 검사 수준 관리 권한(W-03-12)이 있는 계정 — 권한이 없어서 [지정]이 안 서는 것과 가르기 위해서다. */
vi.mock('../../patterns/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../patterns/session')>()),
  useSession: () => ({ session: { permissions: ['W-03-12'] } }),
}));

/* [수정]이 옮겨 가는 주소를 받아 둔다 — 화면 이동 자체는 leave-guard 가 맡는다. */
const navigated: string[] = [];
vi.mock('../../patterns/leave-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../patterns/leave-guard')>()),
  useLeaveFor: () => (href: string) => {
    navigated.push(href);
  },
}));

const { ItemLevel, ItemLevelStep, levelScreenHref } = await import('./item-level');

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
  it('상세 머리 — 수준이 없으면 [지정] 없이 [수준 조회]만 두고, 창은 「미지정」을 보인다', async () => {
    render(<ItemLevel itemId={501} item={ITEM} />, []);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: t.view }));
    expect(screen.queryByRole('button', { name: t.set })).not.toBeInTheDocument();

    const dialog = within(await screen.findByRole('dialog', { name: t.viewTitle }));
    expect(dialog.getByText(t.unset)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: t.edit })).toBeInTheDocument();
  });

  it('상세 머리 — [수준 조회] 창은 현재 수준을 보이고 [수정]은 검사 수준 관리를 그 품목으로 연다', async () => {
    render(<ItemLevel itemId={501} item={ITEM} />, [LEVEL]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: t.view }));
    const dialog = within(await screen.findByRole('dialog', { name: t.viewTitle }));
    expect(
      dialog.getByText(messages.inspectionLevel.levels.NORMAL ?? 'NORMAL'),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: t.edit }));
    expect(navigated).toEqual([levelScreenHref(501, ITEM)]);
    expect(navigated[0]).toContain('/quality/inspection-levels?item=501');
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
