import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { lot, receipt, receiptLineFixtures, WORK_ORDER_ID } from './fixtures';
import { MaterialInputScanScreen } from './screen';

/*
 * 005 US1-6 — POP 투입(P-02-03)에서 대기 · 폐기 자재 관리 LOT 을 스캔하면 담지 않고 그 사실을 말한다.
 * 보존 시험 파일(`scan-screen.test.tsx` 등)은 손대지 않고 이 파일에 새로 둔다(T132).
 */

const t = messages.materialInputScan;

const ROUTE = `/pop/material-input?workOrderId=${String(WORK_ORDER_ID)}`;
const WORKER_NO = 'SAMPLE-W-0005';
const LOT_NO = 'SAMPLE-LOT-0001';
const INPUT_PATH = '/production/material-consumptions';

beforeEach(() => {
  globalThis.localStorage.clear();
});

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 50, total: items.length },
});

/** 수령 대조 · 상태 표시명은 이 시험의 관심사가 아니다 — 늘 같은 답을 주고 비켜 둔다. */
const baseRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, '/mdm/code-values'),
    respond: () =>
      jsonResponse(
        listBody([
          {
            codeValueId: 7511,
            codeGroupId: 7510,
            code: 'NORMAL',
            codeName: '정상',
            displayOrder: 1,
            isActive: true,
          },
          {
            codeValueId: 7512,
            codeGroupId: 7510,
            code: 'INSPECTION_PENDING',
            codeName: '검사 대기',
            displayOrder: 2,
            isActive: true,
          },
        ]),
      ),
  },
  {
    match: (request) => isGet(request, '/logistics/shopfloor-receipts'),
    respond: () => jsonResponse(listBody([receipt()])),
  },
  {
    match: (request) => isGet(request, '/logistics/shopfloor-receipts/7001'),
    respond: () => jsonResponse({ shopfloorReceipt: receipt(), lines: receiptLineFixtures }),
  },
];

/** 스캔한 LOT — 정확 일치 축에 이 한 건을 낸다. */
const lotsRoute = (item: unknown): StubRoute => ({
  match: (request) => isGet(request, '/trace/lots'),
  respond: () => jsonResponse(listBody([item])),
});

const renderScreen = (scanned: unknown) => {
  const requests: Request[] = [];
  const stub = createStubFetch([...baseRoutes(), lotsRoute(scanned)]);
  const fetch: StubFetch = async (request) => {
    requests.push(request.clone());

    return stub(request);
  };

  renderWithProviders(
    createElement(PopIdentityProvider, {
      value: { ...UNKNOWN_POP_IDENTITY, workerNo: WORKER_NO },
      children: createElement(MaterialInputScanScreen),
    }),
    { fetch, route: ROUTE },
  );

  return { requests };
};

const scanCode = async (user: ReturnType<typeof userEvent.setup>, code: string): Promise<void> => {
  await user.type(screen.getByLabelText(t.scan.label), `${code}{Enter}`);
};

/** 그 LOT 이 스캔으로 담겼는가(「투입 중」 칩). */
const scannedHas = (lotNo: string): boolean => {
  const list = screen.queryByRole('list', { name: t.scanned.materialsLabel });
  if (list === null) return false;

  const row = within(list)
    .queryAllByRole('listitem')
    .find((item) => within(item).queryByText(lotNo) !== null);

  return row !== undefined && within(row).queryByText(t.scanned.pendingMark) !== null;
};

const inputRequests = (requests: Request[]): Request[] =>
  requests.filter(
    (request) => request.method === 'POST' && new URL(request.url).pathname === INPUT_PATH,
  );

describe('P-02-03 대기 · 폐기 자재 관리 LOT 스캔(005)', () => {
  it('US1-6 생애 WAITING 이면 「아직 입하되지 않은 LOT」 오류 · 담지 않음 · 투입 요청 없음', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen(
      lot({ statusCode: 'INSPECTION_PENDING', lifecycleStatusCode: 'WAITING' }),
    );

    await scanCode(user, LOT_NO);

    expect(await screen.findByText('아직 입하되지 않은 LOT')).toBeTruthy();
    expect(
      screen.queryByText(t.scan.outcomes.blockedStatus('예시 자재 A는', '검사 대기')),
    ).toBeNull();
    expect(scannedHas(LOT_NO)).toBe(false);
    expect(inputRequests(requests)).toHaveLength(0);
  });

  it('US1-6 생애 VOIDED 면 「폐기된 LOT」 오류 · 담지 않음 · 투입 요청 없음', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen(lot({ lifecycleStatusCode: 'VOIDED' }));

    await scanCode(user, LOT_NO);

    expect(await screen.findByText('폐기된 LOT')).toBeTruthy();
    expect(screen.queryByText(t.scan.outcomes.material('예시 자재 A를'))).toBeNull();
    expect(scannedHas(LOT_NO)).toBe(false);
    expect(inputRequests(requests)).toHaveLength(0);
  });

  it('US1-6 생애 ACTIVE 는 지금 그대로 담는다', async () => {
    const user = userEvent.setup();
    renderScreen(lot({ lifecycleStatusCode: 'ACTIVE' }));

    await scanCode(user, LOT_NO);

    expect(await screen.findByText(t.scan.outcomes.material('예시 자재 A를'))).toBeTruthy();
    expect(scannedHas(LOT_NO)).toBe(true);
  });

  it('US1-6 생애가 없는(이전 LOT) LOT 은 지금 그대로 담는다', async () => {
    const user = userEvent.setup();
    renderScreen(lot({ lifecycleStatusCode: null }));

    await scanCode(user, LOT_NO);

    expect(await screen.findByText(t.scan.outcomes.material('예시 자재 A를'))).toBeTruthy();
    expect(scannedHas(LOT_NO)).toBe(true);
  });
});
