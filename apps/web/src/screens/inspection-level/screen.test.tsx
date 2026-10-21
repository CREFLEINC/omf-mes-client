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
  it('품목별 현재 수준·자동 전환·연속 합격을 보이고, 이력의 사유를 구분해 보인다', async () => {
    setup();

    const row = await within(levelTable()).findByRole('row', { name: /PPAD003200/ });
    expect(row).toHaveTextContent('보통');
    expect(row).toHaveTextContent('사용');
    expect(row).toHaveTextContent('7 LOT');

    await within(historyTable()).findByText('15 LOT 연속 합격');
    expect(within(historyTable()).getByText('불합격 — 의뢰 IR-10')).toBeInTheDocument();
    expect(within(historyTable()).getByText('OA 품목 지정')).toBeInTheDocument();
    expect(within(historyTable()).getByText('보통 (최초 지정)')).toBeInTheDocument();
    expect(within(historyTable()).getByText('수월 → 엄격')).toBeInTheDocument();
  });

  it('수준 변경은 사유가 없으면 보내지 않고, 사유를 넣으면 줄의 판으로 잠가 보낸다', async () => {
    const { user, requests } = setup();
    await user.click(
      await screen.findByRole('button', { name: t.actions.changeLevelRow('PPAD003200') }),
    );

    await user.click(
      within(screen.getByRole('dialog')).getByRole('combobox', { name: t.dialog.level }),
    );
    await user.click(screen.getByRole('option', { name: '엄격' }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));
    expect(await screen.findByText(t.dialog.reasonRequired)).toBeInTheDocument();
    expect(requests.some((r) => r.method === 'PUT')).toBe(false);

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

  it('자동 끄기는 자동 전환 사용만 바꿔 보낸다', async () => {
    const { user, requests } = setup();
    await user.click(
      await screen.findByRole('button', { name: t.actions.turnAutoRow('PPAD003200', false) }),
    );

    await waitFor(() => expect(requests.some((r) => r.method === 'PUT')).toBe(true));
    expect(JSON.parse(requests.find((r) => r.method === 'PUT')?.body ?? '{}')).toEqual({
      autoSwitchEnabled: false,
    });
  });

  it('줄의 「이력」을 누르면 그 품목의 이력만 조회한다', async () => {
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
    expect(screen.getByText(t.history.filteredBy('PPAD003200'))).toBeInTheDocument();
  });
});
