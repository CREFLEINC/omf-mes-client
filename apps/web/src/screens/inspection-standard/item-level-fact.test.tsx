import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
} from '../../test/api-harness';

/* 계정 권한 — 시험마다 바꾼다. 검사 수준 지정 · 변경은 W-03-12 권한이 있어야 한다. */
let permissions: string[] = ['W-03-12'];
vi.mock('../../patterns/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../patterns/session')>()),
  useSession: () => ({ session: { permissions } }),
}));

const { ItemLevelFact } = await import('./item-level-fact');

const t = messages.inspectionStandard.itemLevel;
const td = messages.inspectionLevel.dialog;

const LEVELS = '/quality/item-inspection-levels';
const HISTORIES = '/quality/item-inspection-level-histories';
const ITEM = { itemId: 3076, itemCode: 'PPAD003200', itemName: 'PAPER PAD EJECT' };
const LEVEL = {
  itemInspectionLevelId: 5,
  ...ITEM,
  inspectionLevelCode: 'NORMAL',
  autoSwitchEnabled: false,
  consecutiveAcceptCount: 0,
  updatedAt: '2026-10-21T00:00:00Z',
  versionNo: 3,
};
const HISTORY = {
  itemInspectionLevelHistoryId: 1,
  ...ITEM,
  fromLevelCode: null,
  toLevelCode: 'NORMAL',
  changeTypeCode: 'MANUAL',
  consecutiveAcceptCount: null,
  inspectionRequestId: null,
  inspectionRequestNo: null,
  reason: 'OA 품목 지정',
  changedAt: '2026-10-21T01:00:00Z',
  changedByName: '검사원',
};

const page = (items: unknown[]) => ({ items, page: { page: 1, size: 50, total: items.length } });

interface Recorded {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

const setup = (levels: object[]) => {
  const requests: Recorded[] = [];
  const stub = createStubFetch([
    {
      match: (r) => r.method === 'GET' && new URL(r.url).pathname.endsWith(LEVELS),
      respond: () => jsonResponse(page(levels)),
    },
    {
      match: (r) => r.method === 'GET' && new URL(r.url).pathname.endsWith(HISTORIES),
      respond: () => jsonResponse(page([HISTORY])),
    },
    { match: (r) => r.method === 'PUT', respond: () => jsonResponse({ ...LEVEL, versionNo: 4 }) },
    {
      match: (r) => r.method === 'POST',
      respond: () => jsonResponse({ ...LEVEL, versionNo: 1 }, { status: 201 }),
    },
  ]);
  const fetch: StubFetch = async (request) => {
    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });
    return stub(request);
  };
  const user = userEvent.setup();
  renderWithProviders(
    <dl>
      <ItemLevelFact item={ITEM} />
    </dl>,
    { fetch },
  );
  return { user, requests };
};

/** IQC 기준 상세의 「검사 수준」 칸 — 검사 수준 설정 화면을 합쳤다(omf-all-around#357). */
describe('ItemLevelFact', () => {
  it('품목의 현재 수준을 보이고 「변경」 · 「이력」을 둔다', async () => {
    permissions = ['W-03-12'];
    setup([LEVEL]);

    expect(await screen.findByText('보통')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.change })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.history })).toBeInTheDocument();
  });

  it('수준이 없으면 「미지정」과 「지정」 — 이력 단추는 없다, 지정은 품목을 고르지 않고 사유 없이 보낸다', async () => {
    permissions = ['W-03-12'];
    const { user, requests } = setup([]);

    expect(await screen.findByText(t.unset)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.history })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.set }));
    expect(screen.queryByRole('button', { name: td.pickItem })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(requests.some((r) => r.method === 'POST')).toBe(true));
    expect(JSON.parse(requests.find((r) => r.method === 'POST')?.body ?? '{}')).toEqual({
      itemId: 3076,
      inspectionLevelCode: 'NORMAL',
    });
  });

  it('변경은 사유를 실어 받은 판으로 잠가 보낸다', async () => {
    permissions = ['W-03-12'];
    const { user, requests } = setup([LEVEL]);
    await user.click(await screen.findByRole('button', { name: t.change }));

    await user.click(within(screen.getByRole('dialog')).getByRole('combobox', { name: td.level }));
    await user.click(screen.getByRole('option', { name: '엄격' }));
    await user.type(screen.getByLabelText(td.reason), '고객 클레임');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(requests.some((r) => r.method === 'PUT')).toBe(true));
    const put = requests.find((r) => r.method === 'PUT');
    expect(put?.url.pathname).toMatch(/\/quality\/item-inspection-levels\/5$/);
    expect(put?.headers.get('If-Match')).toBe('3');
    expect(JSON.parse(put?.body ?? '{}')).toEqual({
      inspectionLevelCode: 'TIGHTENED',
      reason: '고객 클레임',
    });
  });

  it('같은 수준이면 보내지 않는다', async () => {
    permissions = ['W-03-12'];
    const { user, requests } = setup([LEVEL]);
    await user.click(await screen.findByRole('button', { name: t.change }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText(td.sameLevel)).toBeInTheDocument();
    expect(requests.some((r) => r.method === 'PUT')).toBe(false);
  });

  it('「이력」은 그 품목의 이력만 창으로 조회한다', async () => {
    permissions = ['W-03-12'];
    const { user, requests } = setup([LEVEL]);
    await user.click(await screen.findByRole('button', { name: t.history }));

    await waitFor(() =>
      expect(
        requests.some(
          (r) => r.url.pathname.endsWith(HISTORIES) && r.url.searchParams.get('itemId') === '3076',
        ),
      ).toBe(true),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('PPAD003200');
    expect(await within(dialog).findByText('OA 품목 지정')).toBeInTheDocument();
  });

  it('검사 수준 권한이 없으면 보기와 이력만 — 변경 단추는 없다', async () => {
    permissions = [];
    setup([LEVEL]);

    expect(await screen.findByText('보통')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.change })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.history })).toBeInTheDocument();
  });
});
