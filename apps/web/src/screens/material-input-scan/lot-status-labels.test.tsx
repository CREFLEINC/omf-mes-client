import { messages } from '@omf-mes/i18n';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { lot, receipt, receiptLineFixtures, WORK_ORDER_ID } from './fixtures';
import { MaterialInputScanScreen } from './screen';

const t = messages.materialInputScan;

const ROUTE = `/pop/material-input?workOrderId=${String(WORK_ORDER_ID)}`;
const RECEIPTS_PATH = '/logistics/shopfloor-receipts';
const LOTS_PATH = '/trace/lots';
const CODE_VALUES_PATH = '/mdm/code-values';

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const baseRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, RECEIPTS_PATH),
    respond: () => jsonResponse({ items: [receipt()], page: { page: 1, size: 50, total: 1 } }),
  },
  {
    match: (request) => isGet(request, `${RECEIPTS_PATH}/7001`),
    respond: () => jsonResponse({ shopfloorReceipt: receipt(), lines: receiptLineFixtures }),
  },
  {
    match: (request) => isGet(request, LOTS_PATH),
    respond: () => jsonResponse({ items: [lot()], page: { page: 1, size: 50, total: 1 } }),
  },
];

const codeValue = (code: string, codeName: string, displayOrder: number) => ({
  codeValueId: 7500 + displayOrder,
  codeGroupId: 7500,
  code,
  codeName,
  displayOrder,
  isActive: true,
});

const renderScreen = (codeValuesRoute: StubRoute) => {
  const requests: URL[] = [];
  const stub = createStubFetch([...baseRoutes(), codeValuesRoute]);
  const fetch: StubFetch = async (request) => {
    requests.push(new URL(request.url));

    return stub(request);
  };

  renderWithProviders(<MaterialInputScanScreen />, { fetch, route: ROUTE });

  return requests;
};

/** 대기 중인 되먹임을 화면에 앉힌다 — 「없다」는 도착한 뒤에 재야 뜻이 선다. */
const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const scanOnce = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.type(screen.getByLabelText(t.scan.label), 'SAMPLE-LOT-0001{Enter}');
  await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));
};

describe('자재 상태 표시명', () => {
  /*
   * 계약이 `Lot.statusCode` 설명에 조회 경로를 못박아 두었다 — 원문 코드를 그대로 낼 이유가
   * 없다. 현장에서 읽는 화면에 `NORMAL` 은 읽히지 않는 글자다.
   */
  it('계약이 정한 코드 그룹으로 표시명을 받아 그린다', async () => {
    const user = userEvent.setup();
    const requests = renderScreen({
      match: (request) => isGet(request, CODE_VALUES_PATH),
      respond: () =>
        jsonResponse({
          items: [codeValue('NORMAL', '정상', 1)],
          page: { page: 1, size: 50, total: 1 },
        }),
    });

    await scanOnce(user);

    expect(screen.getByText(`${t.scanned.statusLabel} · 정상`)).toBeTruthy();
    expect(screen.queryByText(/NORMAL/)).toBeNull();

    const lookup = requests.find((url) => url.pathname === CODE_VALUES_PATH);
    expect(lookup?.searchParams.get('codeGroupCode')).toBe('LOT_STATUS');
    /* 이름 풀이는 선택지 조회가 아니다 — 좁히면 옛 값이 「알 수 없음」으로 보인다. */
    expect(lookup?.searchParams.get('includeInactive')).toBe('true');
  });

  /*
   * ⭐ **모르는 코드는 원문 그대로 낸다.** 「알 수 없음」으로 덮으면 담당자에게 전할 단서가
   * 사라진다 — 옮기지 못한 것과 값이 없는 것은 다르다.
   */
  it('목록에 없는 코드는 원문을 그대로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({
      match: (request) => isGet(request, CODE_VALUES_PATH),
      respond: () =>
        jsonResponse({
          items: [codeValue('SCRAPPED', '폐기', 1)],
          page: { page: 1, size: 50, total: 1 },
        }),
    });

    await scanOnce(user);

    expect(screen.getByText(`${t.scanned.statusLabel} · NORMAL`)).toBeTruthy();
  });

  /* 표시명을 못 받아도 스캔은 계속돼야 한다 — 이름은 읽기 편하자고 붙인 것이지 자격이 아니다. */
  it('표시명 조회가 실패해도 담기고, 코드로 표시한다는 사실을 밝힌다', async () => {
    const user = userEvent.setup();
    renderScreen({
      match: (request) => isGet(request, CODE_VALUES_PATH),
      respond: () => new Response(null, { status: 500 }),
    });

    await scanOnce(user);

    expect(screen.getByText(`${t.scanned.statusLabel} · NORMAL`)).toBeTruthy();
    expect(screen.getByText(t.scanned.statusLabelUnavailable)).toBeTruthy();
  });

  /* 담은 것이 없으면 밝힐 이유가 없다 — 조치가 필요 없는 안내는 읽히지 않게 만든다. */
  it('담은 자재가 없으면 조회 실패를 알리지 않는다', async () => {
    renderScreen({
      match: (request) => isGet(request, CODE_VALUES_PATH),
      respond: () => new Response(null, { status: 500 }),
    });

    expect(await screen.findByText(t.scanned.empty)).toBeTruthy();
    /* 실패가 도착한 뒤에 재야 한다 — 렌더 직후에 재면 아직 오지 않은 실패를 통과시킨다. */
    await flush();
    expect(screen.queryByText(t.scanned.statusLabelUnavailable)).toBeNull();
  });

  /*
   * 이름 풀이가 **판정에 쓰이지 않는다**(스펙 §5-2). 표시명을 못 받아도 확정 잠금 사유는
   * 그대로여야 한다 — 이름이 자격을 가르기 시작하면 화면이 판정하는 것이 된다.
   */
  it('표시명 유무가 투입 확정 잠금에 영향을 주지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      match: (request) => isGet(request, CODE_VALUES_PATH),
      respond: () => new Response(null, { status: 500 }),
    });

    await scanOnce(user);

    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
    expect(screen.getByText(t.confirm.reasons.notReady)).toBeTruthy();
  });
});
