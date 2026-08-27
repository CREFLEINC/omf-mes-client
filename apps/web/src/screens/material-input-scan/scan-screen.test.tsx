import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { lot, mold, receipt, receiptLineFixtures, WORK_ORDER_ID } from './fixtures';
import { MaterialInputScanScreen } from './screen';

const t = messages.materialInputScan;

const ROUTE = `/pop/material-input?workOrderId=${String(WORK_ORDER_ID)}`;
const RECEIPTS_PATH = '/logistics/shopfloor-receipts';
const LOTS_PATH = '/trace/lots';
const MOLDS_PATH = '/mdm/molds';

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

/** 수령 대조 구획은 이 감지기의 관심사가 아니다 — 늘 같은 답을 주고 비켜 둔다. */
const receiptRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, RECEIPTS_PATH),
    respond: () => jsonResponse({ items: [receipt()], page: { page: 1, size: 50, total: 1 } }),
  },
  {
    match: (request) => isGet(request, `${RECEIPTS_PATH}/7001`),
    respond: () => jsonResponse({ shopfloorReceipt: receipt(), lines: receiptLineFixtures }),
  },
];

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 50, total: items.length },
});

const lotsRoute = (items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, LOTS_PATH),
  respond: () => jsonResponse(listBody(items)),
});

const moldsRoute = (items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, MOLDS_PATH),
  respond: () => jsonResponse(listBody(items)),
});

interface RecordedRequest {
  method: string;
  url: URL;
}

const renderScreen = (routes: StubRoute[]) => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch([...receiptRoutes(), ...routes]);
  const fetch: StubFetch = async (request) => {
    requests.push({ method: request.method, url: new URL(request.url) });

    return stub(request);
  };

  return { ...renderWithProviders(<MaterialInputScanScreen />, { fetch, route: ROUTE }), requests };
};

/** 스캔 칸에 코드를 넣고 Enter로 확정한다 — 스캐너가 하는 것과 같은 순서다. */
const scanCode = async (user: ReturnType<typeof userEvent.setup>, code: string): Promise<void> => {
  const field = screen.getByLabelText(t.scan.label);

  await user.type(field, `${code}{Enter}`);
};

describe('MaterialInputScanScreen — 스캔', () => {
  it('읽은 코드로 자재LOT을 찾아 담는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');

    expect(await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'))).toBeTruthy();

    const lotRequest = requests.find((request) => request.url.pathname === LOTS_PATH);
    expect(lotRequest?.url.searchParams.get('q')).toBe('SAMPLE-LOT-0001');
  });

  /*
   * 칸이 하나라(스펙 §3) 무엇을 읽었는지 화면이 미리 모른다. 자재에서 못 찾으면 금형을 본다.
   */
  it('자재에서 못 찾으면 금형을 찾는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([]), moldsRoute([mold()])]);

    await scanCode(user, 'SAMPLE-MLD-01');

    expect(await screen.findByText(t.scan.outcomes.mold('SAMPLE-MLD-01'))).toBeTruthy();
    expect(requests.some((request) => request.url.pathname === MOLDS_PATH)).toBe(true);
  });

  /* 자재에서 찾았으면 금형까지 물을 이유가 없다 — 현장 단말에서 요청 하나가 곧 대기 시간이다. */
  it('자재에서 찾았으면 금형은 묻지 않는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([lot()]), moldsRoute([mold()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    expect(requests.some((request) => request.url.pathname === MOLDS_PATH)).toBe(false);
  });

  /*
   * ⭐ 같은 LOT을 두 번 읽는 것은 현장에서 흔하다. 줄을 늘리면 **같은 자재가 두 번 투입된
   * 것처럼 보이고**, 그 오해가 계보로 넘어간다.
   */
  it('같은 LOT을 두 번 읽어도 줄이 늘지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    await scanCode(user, 'SAMPLE-LOT-0001');

    expect(await screen.findByText(t.scan.outcomes.duplicate('SAMPLE-LOT-0001'))).toBeTruthy();
    expect(screen.getAllByText('SAMPLE-LOT-0001')).toHaveLength(1);
  });

  /*
   * ⭐ 여러 건이 걸리면 **화면이 고르지 않는다.** 고를 근거가 없고, 틀리면 다른 자재가
   * 계보에 들어간다 — 되돌릴 수 없는 기록이다.
   */
  it('여러 건이 걸리면 담지 않고 다시 읽으라고 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot(), lot({ lotId: 7302, lotNo: 'SAMPLE-LOT-0002' })])]);

    await scanCode(user, 'SAMPLE-LOT');

    expect(await screen.findByText(t.scan.outcomes.ambiguous(2))).toBeTruthy();
    expect(screen.getByText(t.scanned.empty)).toBeTruthy();
  });

  it('어디에서도 못 찾으면 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([]), moldsRoute([])]);

    await scanCode(user, 'SAMPLE-X');

    expect(await screen.findByText(t.scan.outcomes.notFound('SAMPLE-X'))).toBeTruthy();
    expect(screen.getByText(t.scanned.empty)).toBeTruthy();
  });

  it('조회가 실패하면 실패로 말한다 — 「못 찾았다」로 뭉뚱그리지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([
      {
        match: (request) => isGet(request, LOTS_PATH),
        respond: () =>
          jsonResponse(
            { errors: [{ scope: 'screen', code: 'X', message: '합성 실패' }] },
            { status: 500 },
          ),
      },
    ]);

    await scanCode(user, 'SAMPLE-LOT-0001');

    expect(await screen.findByText(t.scan.outcomes.failed)).toBeTruthy();
    expect(screen.queryByText(t.scan.outcomes.notFound('SAMPLE-LOT-0001'))).toBeNull();
  });

  /*
   * ⭐ 작업자는 화면을 보지 않고 연달아 읽는다. 조회 뒤 포커스가 돌아오지 않으면 다음 스캔이
   * **아무 데도 들어가지 않고 사라진다** — 읽었다고 믿고 넘어간다.
   */
  it('읽고 나면 칸이 비워지고 포커스가 돌아온다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    const field = screen.getByLabelText(t.scan.label);
    await user.type(field, 'SAMPLE-LOT-0001');

    /*
     * **버튼으로 보낸다.** Enter로 보내면 포커스가 칸에 남아 있어, 되돌리는 장치를 떼어내도
     * 이 감지기가 통과한다 — 실제로 뮤테이션이 살아남는 것을 확인하고 고친 자리다.
     * 손가락으로 버튼을 누르는 것은 터치 단말의 정상 사용법이기도 하다.
     */
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    await waitFor(() => {
      expect(document.activeElement).toBe(field);
    });
    expect((field as HTMLInputElement).value).toBe('');
  });

  /* 화면에 들어오자마자 읽을 수 있어야 한다 — 작업자가 칸을 눌러 줄 손이 비어 있지 않다. */
  it('들어오면 스캔 칸에 포커스가 있다', () => {
    renderScreen([lotsRoute([lot()])]);

    expect(document.activeElement).toBe(screen.getByLabelText(t.scan.label));
  });

  /*
   * ⭐ **느린 조회 경로다.** 조회가 도는 동안에도 칸은 살아 있어야 한다 — 잠그면 그 순간
   * 포커스가 떠나고, 되돌려 놓기 전에 읽힌 코드가 사라진다. 보내는 것만 잠근다.
   */
  it('조회가 도는 동안에도 칸을 잠그지 않는다', async () => {
    const user = userEvent.setup();

    let releaseLots = (): void => undefined;
    const lotsHeld = new Promise<void>((resolve) => {
      releaseLots = resolve;
    });

    const stub = createStubFetch([...receiptRoutes(), lotsRoute([lot()])]);
    const fetch: StubFetch = async (request) => {
      if (isGet(request, LOTS_PATH)) await lotsHeld;

      return stub(request);
    };

    renderWithProviders(<MaterialInputScanScreen />, { fetch, route: ROUTE });

    await user.type(screen.getByLabelText(t.scan.label), 'SAMPLE-LOT-0001{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.scan.scanning })).toHaveProperty(
        'disabled',
        true,
      );
    });
    expect(screen.getByLabelText(t.scan.label)).toHaveProperty('disabled', false);
    expect(document.activeElement).toBe(screen.getByLabelText(t.scan.label));

    releaseLots();
    expect(await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'))).toBeTruthy();
  });

  /*
   * 조회가 도는 동안 같은 칸에서 한 번 더 보내도 요청이 겹쳐 나가지 않는다.
   *
   * 막는 것은 **제출 버튼의 잠금**이다 — Enter의 암묵 제출은 기본 제출 버튼이 잠겨 있으면
   * 일어나지 않는다. 핸들러 안의 진행 중 검사는 버튼을 지나지 않는 제출을 막는 둘째 겹이라
   * 이 경로에서는 떼어내도 결과가 같다(등가).
   *
   * ⚠ **그 스캔은 버려진다.** 이 회차가 택한 한계이며, 겹쳐 보낸 뒤 중복 판정이 앞 조회의
   * 후보 목록을 보고 이뤄지는 것보다는 낫다고 보았다 — 그쪽은 같은 자재를 두 줄로 담는다.
   */
  it('조회가 도는 동안 겹쳐 보내지 않는다', async () => {
    const user = userEvent.setup();

    let releaseLots = (): void => undefined;
    const lotsHeld = new Promise<void>((resolve) => {
      releaseLots = resolve;
    });

    const requests: RecordedRequest[] = [];
    const stub = createStubFetch([...receiptRoutes(), lotsRoute([lot()])]);
    const fetch: StubFetch = async (request) => {
      requests.push({ method: request.method, url: new URL(request.url) });
      if (isGet(request, LOTS_PATH)) await lotsHeld;

      return stub(request);
    };

    renderWithProviders(<MaterialInputScanScreen />, { fetch, route: ROUTE });

    const field = screen.getByLabelText(t.scan.label);
    await user.type(field, 'SAMPLE-LOT-0001{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.scan.scanning })).toBeTruthy();
    });

    await user.type(field, 'SAMPLE-LOT-0002{Enter}');

    expect(requests.filter((request) => request.url.pathname === LOTS_PATH)).toHaveLength(1);

    releaseLots();
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));
  });

  it('빈 값으로는 조회하지 않는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([lot()])]);

    await user.type(screen.getByLabelText(t.scan.label), '   {Enter}');

    expect(requests.some((request) => request.url.pathname === LOTS_PATH)).toBe(false);
  });

  it('담은 자재를 다시 뺄 수 있다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    await user.click(
      screen.getByRole('button', { name: t.scanned.removeMaterial('SAMPLE-LOT-0001') }),
    );

    expect(await screen.findByText(t.scanned.empty)).toBeTruthy();
  });
});

describe('MaterialInputScanScreen — 금형 타발수', () => {
  it('타발수를 보이고 넘었으면 경고한다 — 다만 막지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([
      lotsRoute([]),
      moldsRoute([mold({ currentShotCount: 50000, availableShotCount: 0 })]),
    ]);

    await scanCode(user, 'SAMPLE-MLD-01');

    expect(await screen.findByText(t.scanned.shotCountExceeded)).toBeTruthy();
    /* 경고는 떴는데 「투입 확정」이 그 때문에 잠기지는 않는다 — 잠긴 사유가 다른 것이어야 한다. */
    expect(screen.getByText(t.confirm.reasons.nothingScanned)).toBeTruthy();
  });

  /* 적정 타수가 없으면 남은 타수를 낼 수 없다. 0으로 채우면 한도를 넘은 금형으로 보인다. */
  it('적정 타수가 없으면 산출 불가로 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([
      lotsRoute([]),
      moldsRoute([mold({ guaranteedShotCount: null, availableShotCount: null })]),
    ]);

    await scanCode(user, 'SAMPLE-MLD-01');

    expect(await screen.findByText(t.scanned.shotCountUnknown(12450))).toBeTruthy();
    expect(screen.queryByText(t.scanned.shotCountExceeded)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('MaterialInputScanScreen — 투입 확정', () => {
  /*
   * ⭐ **누를 수 없는 것이 이번 회차의 의도다.** 계약 필수 본문 셋을 채울 근거가 없어
   * 쓰기를 만들지 않았다. 이 감지기가 무너지면 값을 지어낸 쓰기가 조용히 들어온 것이다.
   */
  it('언제나 잠겨 있고 그 사유를 밝힌다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    const button = screen.getByRole('button', { name: t.confirm.action });
    expect(button).toHaveProperty('disabled', true);
    expect(screen.getByText(t.confirm.reasons.nothingScanned)).toBeTruthy();

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
    /* 담은 뒤에는 사유가 바뀐다 — 「담으면 열린다」고 읽히면 작업자가 계속 담는다. */
    expect(screen.getByText(t.confirm.reasons.notReady)).toBeTruthy();
  });

  /* 쓰기를 만들지 않았다는 것은 **요청이 한 건도 나가지 않는다**는 뜻이다. */
  it('쓰기 요청이 한 건도 나가지 않는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    expect(requests.every((request) => request.method === 'GET')).toBe(true);
  });
});

describe('MaterialInputScanScreen — 자재 상태 표시', () => {
  /*
   * 스펙 §5-2 — 투입 가부는 **서버가 정한다.** 화면이 상태 코드로 갈래를 만들면 화면이
   * 판정한 것처럼 읽히고, 서버가 허용하는 자재를 작업자가 스스로 버린다.
   */
  it('상태 코드를 그대로 보이고 그것으로 막지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot({ statusCode: 'INSPECTION_PENDING', held: true })])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    const item = screen.getByText('SAMPLE-LOT-0001').closest('li');
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).getByText('INSPECTION_PENDING')).toBeTruthy();
    expect(within(item as HTMLElement).getByText(t.scanned.heldMark)).toBeTruthy();
  });
});
