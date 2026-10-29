import type { ItemInspectionLevel, ItemInspectionLevelHistory } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
} from '../../test/api-harness';
import { InspectionLevelScreen } from './screen';

const t = messages.inspectionLevel;

const LEVELS = '/quality/item-inspection-levels';
const HISTORIES = '/quality/item-inspection-level-histories';

const level: ItemInspectionLevel = {
  itemInspectionLevelId: 5,
  itemId: 3076,
  itemCode: 'PPAD003200',
  itemName: 'PAPER PAD EJECT',
  inspectionLevelCode: 'NORMAL',
  autoSwitchEnabled: true,
  consecutiveAcceptCount: 7,
  updatedAt: '2026-10-21T00:00:00Z',
  versionNo: 3,
};

const history = (overrides: Partial<ItemInspectionLevelHistory>): ItemInspectionLevelHistory => ({
  itemInspectionLevelHistoryId: 1,
  itemId: 3076,
  itemCode: 'PPAD003200',
  itemName: 'PAPER PAD EJECT',
  fromLevelCode: 'NORMAL',
  toLevelCode: 'REDUCED',
  changeTypeCode: 'AUTO',
  consecutiveAcceptCount: 15,
  inspectionRequestId: 9,
  inspectionRequestNo: 'IR-9',
  reason: null,
  changedAt: '2026-10-21T01:00:00Z',
  changedByName: '검사원',
  ...overrides,
});

const HISTORY_ROWS = [
  history({}),
  history({
    itemInspectionLevelHistoryId: 2,
    fromLevelCode: 'REDUCED',
    toLevelCode: 'TIGHTENED',
    consecutiveAcceptCount: null,
    inspectionRequestNo: 'IR-10',
  }),
  history({
    itemInspectionLevelHistoryId: 3,
    fromLevelCode: null,
    toLevelCode: 'NORMAL',
    changeTypeCode: 'MANUAL',
    consecutiveAcceptCount: null,
    inspectionRequestNo: null,
    reason: 'OA 품목 지정',
  }),
  history({
    itemInspectionLevelHistoryId: 4,
    itemCode: 'OA-002',
    fromLevelCode: null,
    toLevelCode: 'TIGHTENED',
    changeTypeCode: 'MANUAL',
    consecutiveAcceptCount: null,
    inspectionRequestNo: null,
    reason: null,
  }),
];

const page = (items: unknown[]) => ({ items, page: { page: 1, size: 50, total: items.length } });

interface Recorded {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

const setup = () => {
  const requests: Recorded[] = [];
  const stub = createStubFetch([
    {
      match: (r) => r.method === 'GET' && new URL(r.url).pathname.endsWith(LEVELS),
      respond: () => jsonResponse(page([level])),
    },
    {
      match: (r) => r.method === 'GET' && new URL(r.url).pathname.endsWith(HISTORIES),
      respond: () => jsonResponse(page(HISTORY_ROWS)),
    },
    { match: (r) => r.method === 'PUT', respond: () => jsonResponse({ ...level, versionNo: 4 }) },
    {
      match: (r) => r.method === 'POST' && new URL(r.url).pathname.endsWith(LEVELS),
      respond: () =>
        jsonResponse({ ...level, itemInspectionLevelId: 6, versionNo: 1 }, { status: 201 }),
    },
    {
      match: (r) => new URL(r.url).pathname.endsWith('/mdm/code-values'),
      respond: () => jsonResponse(page([])),
    },
    {
      match: (r) => new URL(r.url).pathname.endsWith('/mdm/items'),
      respond: () =>
        jsonResponse(
          page([
            {
              itemId: 4001,
              itemCode: 'OA-002',
              itemName: 'OA 부품',
              itemTypeCode: 'RAW_MATERIAL',
              baseUomId: 1,
              isActive: true,
            },
          ]),
        ),
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
  renderWithProviders(<InspectionLevelScreen />, { fetch, session: null });
  return { user, requests };
};

const levelTable = () => screen.getByRole('table', { name: t.list.caption });
const historyTable = () => screen.getByRole('table', { name: t.history.caption });

describe('검사 수준 관리', () => {
  it('품목별 현재 수준을 보이고 자동 전환 칸은 없다, 이력의 사유를 구분해 보인다(#133)', async () => {
    setup();

    const row = await within(levelTable()).findByRole('row', { name: /PPAD003200/ });
    expect(row).toHaveTextContent('보통');
    expect(row).not.toHaveTextContent('7 LOT');
    expect(screen.queryByRole('columnheader', { name: '자동 전환' })).not.toBeInTheDocument();

    await within(historyTable()).findByText('15 LOT 연속 합격');
    expect(within(historyTable()).getByText('불합격 — 의뢰 IR-10')).toBeInTheDocument();
    expect(within(historyTable()).getByText('OA 품목 지정')).toBeInTheDocument();
    expect(within(historyTable()).getByText('보통 (최초 지정)')).toBeInTheDocument();
    expect(within(historyTable()).getByText('수월 → 엄격')).toBeInTheDocument();
    const blank = within(historyTable()).getByRole('row', { name: /OA-002/ });
    expect(blank).toHaveTextContent('—');
  });

  it('품목 추가는 사유 없이도 지정한다 — 사유 칸을 싣지 않는다', async () => {
    const { user, requests } = setup();
    await user.click(await screen.findByRole('button', { name: t.list.add }));
    expect(screen.getByLabelText(t.dialog.reason)).not.toHaveAttribute('aria-required', 'true');

    await user.click(screen.getByRole('button', { name: t.dialog.pickItem }));
    const picker = within(screen.getAllByRole('dialog').at(-1)!);
    await user.type(picker.getByLabelText(messages.itemPicker.keywordLabel), 'OA');
    await user.click(picker.getByRole('button', { name: messages.itemPicker.search }));
    await user.click(await picker.findByRole('checkbox', { name: 'OA-002' }));
    await user.click(picker.getByRole('button', { name: t.dialog.pickConfirm }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(requests.some((r) => r.method === 'POST')).toBe(true));
    expect(JSON.parse(requests.find((r) => r.method === 'POST')?.body ?? '{}')).toEqual({
      itemId: 4001,
      inspectionLevelCode: 'NORMAL',
    });
    expect(screen.queryByRole('checkbox', { name: '자동 전환 사용' })).not.toBeInTheDocument();
  });

  it('수준 변경은 사유 없이도 보내고(#133), 사유를 넣으면 실어 줄의 판으로 잠가 보낸다', async () => {
    const { user, requests } = setup();
    await user.click(
      await screen.findByRole('button', { name: t.actions.changeLevelRow('PPAD003200') }),
    );

    await user.click(
      within(screen.getByRole('dialog')).getByRole('combobox', { name: t.dialog.level }),
    );
    await user.click(screen.getByRole('option', { name: '엄격' }));
    expect(screen.getByLabelText(t.dialog.reason)).not.toHaveAttribute('aria-required', 'true');
    await user.type(screen.getByLabelText(t.dialog.reason), '고객 클레임');
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

  it('사유를 비우고 수준을 바꾸면 사유 없이 보낸다(#133)', async () => {
    const { user, requests } = setup();
    await user.click(
      await screen.findByRole('button', { name: t.actions.changeLevelRow('PPAD003200') }),
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('combobox', { name: t.dialog.level }),
    );
    await user.click(screen.getByRole('option', { name: '엄격' }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(requests.some((r) => r.method === 'PUT')).toBe(true));
    expect(JSON.parse(requests.find((r) => r.method === 'PUT')?.body ?? '{}')).toEqual({
      inspectionLevelCode: 'TIGHTENED',
    });
  });

  it('같은 수준을 고르면 막는다 — 전환이 아니다', async () => {
    const { user, requests } = setup();
    await user.click(
      await screen.findByRole('button', { name: t.actions.changeLevelRow('PPAD003200') }),
    );
    await user.type(screen.getByLabelText(t.dialog.reason), '사유');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText(t.dialog.sameLevel)).toBeInTheDocument();
    expect(requests.some((r) => r.method === 'PUT')).toBe(false);
  });

  it('줄의 「이력」을 누르면 그 품목의 이력만 창으로 조회한다', async () => {
    const { user, requests } = setup();
    await user.click(
      await screen.findByRole('button', { name: t.actions.showHistoryRow('PPAD003200') }),
    );

    await waitFor(() =>
      expect(
        requests.some(
          (r) => r.url.pathname.endsWith(HISTORIES) && r.url.searchParams.get('itemId') === '3076',
        ),
      ).toBe(true),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('PPAD003200');
  });
});
