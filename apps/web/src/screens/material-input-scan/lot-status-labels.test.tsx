import { messages } from '@omf-mes/i18n';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setWorkerSession } from '../../patterns/worker-session';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { lot, receipt, receiptLineFixtures, WORK_ORDER_ID } from './fixtures';
import { MaterialInputScanScreen } from './screen';
import { popGateUnidentifiedText } from '../../patterns/pop-process-gate';

const t = messages.materialInputScan;
const UNIDENTIFIED_TEXT = popGateUnidentifiedText(t.confirm.reasons.unidentified, null);

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

/** 투입 수량 편집 영역. 담으면 그 LOT이 골라져 상태 이름이 여기 선다. */
const editor = (): HTMLElement => screen.getByRole('region', { name: t.panes.noSelection });

const scanOnce = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.type(screen.getByLabelText(t.scan.label), 'SAMPLE-LOT-0001{Enter}');
  await screen.findByText(t.scan.outcomes.material('예시 자재 A를'));
};

/* 사번이 없으면 화면이 투입을 받지 않는다(PI-17). 이 감지기들은 단말이 사번을 들고 있는 상태에서 잰다. */
beforeEach(() => {
  setWorkerSession({
    worker: {
      workerId: 7001,
      workerNo: 'SAMPLE-W-0001',
      workerName: '합성 작업자',
      businessUnitId: 1,
      plantId: 1,
      statusCode: 'SAMPLE_ACTIVE',
      isActive: true,
    },
    assignedAt: '2026-10-23 09:00',
    isOtherPlant: false,
  });
});

afterEach(() => {
  setWorkerSession(null);
});

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

    /* 정상 상태는 화면에 두지 않는다(C-21). 코드도 드러나지 않는다. */
    expect(within(editor()).queryByText('정상')).toBeNull();
    expect(screen.queryByText(/NORMAL/)).toBeNull();

    const lookup = requests.find((url) => url.pathname === CODE_VALUES_PATH);
    expect(lookup?.searchParams.get('codeGroupCode')).toBe('LOT_STATUS');
    /* 이름 풀이는 선택지 조회가 아니다 — 좁히면 옛 값이 「알 수 없음」으로 보인다. */
    expect(lookup?.searchParams.get('includeInactive')).toBe('true');
  });

  /* 표시명을 못 받아도 스캔은 계속된다. 정상 상태라 이름도 코드도 보일 일이 없다. */
  it('표시명 조회가 실패해도 담고, 정상 상태 코드를 드러내지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      match: (request) => isGet(request, CODE_VALUES_PATH),
      respond: () => new Response(null, { status: 500 }),
    });

    await scanOnce(user);
    await flush();

    expect(screen.queryByText(/NORMAL/)).toBeNull();
  });

  /*
   * 이름 풀이가 **판정에 쓰이지 않는다**(스펙 §5-2). 표시명을 못 받아도 확정 잠금 사유는
   * 그대로여야 한다 — 이름이 자격을 가르기 시작하면 화면이 판정하는 것이 된다.
   */
  it('표시명 유무가 다음 작업 잠금에 영향을 주지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      match: (request) => isGet(request, CODE_VALUES_PATH),
      respond: () => new Response(null, { status: 500 }),
    });

    await scanOnce(user);

    expect(screen.getByRole('button', { name: t.confirm.goToProductionResult })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByText(UNIDENTIFIED_TEXT)).toBeTruthy();
  });
});
