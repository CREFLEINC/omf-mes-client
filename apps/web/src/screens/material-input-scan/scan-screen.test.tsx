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
import {
  PopIdentityProvider,
  UNKNOWN_POP_IDENTITY,
  type PopIdentity,
} from '../../patterns/pop-identity';
import { lot, mold, receipt, receiptLineFixtures, WORK_ORDER_ID } from './fixtures';
import { MaterialInputScanScreen } from './screen';

const t = messages.materialInputScan;

const ROUTE = `/pop/material-input?workOrderId=${String(WORK_ORDER_ID)}`;
const RECEIPTS_PATH = '/logistics/shopfloor-receipts';
const LOTS_PATH = '/trace/lots';
const MOLDS_PATH = '/mdm/molds';
const CODE_VALUES_PATH = '/mdm/code-values';
const TERMINAL_ID = 7901;
const PROCESS_ID = 7902;
const TERMINAL_PROCESSES_PATH = `/mdm/terminals/${String(TERMINAL_ID)}/processes`;

const WORKER_NO = 'SAMPLE-W-0001';

/** 셸이 단말·공정·사번을 채워 준 상태 — 게이팅이 판정할 수 있고 귀속도 갖춰졌다. */
const GATED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
  workerNo: WORKER_NO,
};

/** 이 단말·공정에서 자재 투입이 열려 있는가. */
const gateRoute = (canInputMaterial: boolean): StubRoute => ({
  match: (request) => isGet(request, TERMINAL_PROCESSES_PATH),
  respond: () => jsonResponse({ items: [{ processId: PROCESS_ID, canInputMaterial }] }),
});

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

/** 상태 표시명 — 계약이 정한 코드 그룹으로 온다. 갈래를 재는 테스트가 아니면 늘 같은 답을 준다. */
const codeValuesRoute = (): StubRoute => ({
  match: (request) => isGet(request, CODE_VALUES_PATH),
  respond: () =>
    jsonResponse({
      items: [
        {
          codeValueId: 7501,
          codeGroupId: 7500,
          code: 'NORMAL',
          codeName: '정상',
          displayOrder: 1,
          isActive: true,
        },
        {
          codeValueId: 7502,
          codeGroupId: 7500,
          code: 'INSPECTION_PENDING',
          codeName: '검사 대기',
          displayOrder: 2,
          isActive: true,
        },
      ],
      page: { page: 1, size: 50, total: 2 },
    }),
});

/** 수령 대조 구획은 이 감지기의 관심사가 아니다 — 늘 같은 답을 주고 비켜 둔다. */
const receiptRoutes = (): StubRoute[] => [
  codeValuesRoute(),
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

/** 이 요청이 정확 일치(`lotNo`) 축인가. 아니면 부분 검색(`q`) 축이다. */
const isExactLotQuery = (request: Request): boolean =>
  new URL(request.url).searchParams.has('lotNo');

/**
 * 자재LOT 조회 두 축을 한 라우트로 세운다.
 *
 * 정확 일치 축은 **계약이 0·1건을 보장**하므로 첫 건만 낸다 — 스텁이 그 약속을 어기면
 * 감지기가 있을 수 없는 상태를 재게 된다.
 */
const lotsRoute = (items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, LOTS_PATH),
  respond: (request) =>
    jsonResponse(listBody(isExactLotQuery(request) ? items.slice(0, 1) : items)),
});

/**
 * 정확 일치는 비었고 부분 검색에만 결과가 있는 상태 — **외부 식별자 스캔**이다.
 *
 * 여러 건이 걸릴 수 있는 축은 여기뿐이라(omf-mes#254 회신 ①), 모호함을 재는 감지기는
 * 이 라우트를 쓴다.
 */
const partialOnlyLotsRoute = (items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, LOTS_PATH),
  respond: (request) => jsonResponse(listBody(isExactLotQuery(request) ? [] : items)),
});

const moldsRoute = (items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, MOLDS_PATH),
  respond: () => jsonResponse(listBody(items)),
});

interface RecordedRequest {
  method: string;
  url: URL;
}

const renderScreen = (routes: StubRoute[], identity = UNKNOWN_POP_IDENTITY) => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch([...receiptRoutes(), ...routes]);
  const fetch: StubFetch = async (request) => {
    requests.push({ method: request.method, url: new URL(request.url) });

    return stub(request);
  };

  const view = renderWithProviders(
    <PopIdentityProvider value={identity}>
      <MaterialInputScanScreen />
    </PopIdentityProvider>,
    { fetch, route: ROUTE },
  );

  return { ...view, requests };
};

/** 스캔 칸에 코드를 넣고 Enter로 확정한다 — 스캐너가 하는 것과 같은 순서다. */
const scanCode = async (user: ReturnType<typeof userEvent.setup>, code: string): Promise<void> => {
  const field = screen.getByLabelText(t.scan.label);

  await user.type(field, `${code}{Enter}`);
};

describe('MaterialInputScanScreen — 스캔', () => {
  /*
   * ⭐ **정확 일치를 먼저 묻는다**(omf-mes#254 회신 ①). 부분 검색만으로 집으면 여러 건 중
   * 하나를 화면이 임의로 고르게 되고, 다른 범위의 LOT을 잘못 가리켜도 오류가 나지 않는다.
   */
  it('읽은 코드로 자재LOT을 찾아 담는다 — 정확 일치를 먼저 묻는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');

    expect(
      await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001')),
    ).toBeTruthy();

    const lotRequest = requests.find((request) => request.url.pathname === LOTS_PATH);
    expect(lotRequest?.url.searchParams.get('lotNo')).toBe('SAMPLE-LOT-0001');
  });

  /*
   * ⛔ **정확 일치로 집었으면 부분 검색을 하지 않는다.** 이어서 물으면 같은 스캔 하나가 축을
   * 둘 타고, 뒤 축이 다른 LOT을 물어 오면 무엇이 정본인지 정할 근거가 없어진다.
   */
  it('정확 일치로 집으면 부분 검색을 잇지 않는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

    const lotRequests = requests.filter((request) => request.url.pathname === LOTS_PATH);
    expect(lotRequests).toHaveLength(1);
    expect(lotRequests[0]?.url.searchParams.has('q')).toBe(false);
  });

  /*
   * 정확 일치가 비면 외부 식별자를 훑는다 — 그 축을 지우면 **자재LOT 번호가 아닌 코드가
   * 붙은 자재는 통째로 스캔되지 않는다.**
   */
  it('정확 일치가 비면 부분 검색으로 외부 식별자를 훑는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([partialOnlyLotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-EXT-0001');

    expect(
      await screen.findByText(t.scan.outcomes.material('SAMPLE-EXT-0001', 'SAMPLE-LOT-0001')),
    ).toBeTruthy();

    const lotRequests = requests.filter((request) => request.url.pathname === LOTS_PATH);
    expect(lotRequests.map((request) => request.url.searchParams.has('lotNo'))).toEqual([
      true,
      false,
    ]);
  });

  /*
   * ⛔ **스캔값을 건드리지 않는다.** 대소문자 규칙이 계약에 아직 없다(#254 물음 ② — 미결).
   * 화면이 올리거나 내리면 화면이 서버 규칙을 정한 것이 되고, 서버가 반대로 정하면 조용히
   * 어긋난다.
   */
  it('읽은 값의 대소문자를 바꾸지 않는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([]), moldsRoute([])]);

    await scanCode(user, 'sample-Lot-0001');
    await screen.findByText(t.scan.outcomes.notFound('sample-Lot-0001'));

    const lotRequest = requests.find((request) => request.url.pathname === LOTS_PATH);
    expect(lotRequest?.url.searchParams.get('lotNo')).toBe('sample-Lot-0001');
  });

  /*
   * 칸이 하나라(스펙 §3) 무엇을 읽었는지 화면이 미리 모른다. 자재에서 못 찾으면 금형을 본다.
   */
  it('자재에서 못 찾으면 금형을 찾는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([]), moldsRoute([mold()])]);

    await scanCode(user, 'SAMPLE-MLD-01');

    expect(
      await screen.findByText(t.scan.outcomes.mold('SAMPLE-MLD-01', 'SAMPLE-MLD-01')),
    ).toBeTruthy();
    expect(requests.some((request) => request.url.pathname === MOLDS_PATH)).toBe(true);
  });

  /* 자재에서 찾았으면 금형까지 물을 이유가 없다 — 현장 단말에서 요청 하나가 곧 대기 시간이다. */
  it('자재에서 찾았으면 금형은 묻지 않는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([lot()]), moldsRoute([mold()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

    expect(requests.some((request) => request.url.pathname === MOLDS_PATH)).toBe(false);
  });

  /*
   * ⭐ **읽은 것과 찾은 것이 다를 수 있다.** 계약의 검색은 LOT 번호의 일부와 외부 식별자에도
   * 걸리므로, 짧은 코드를 읽어도 전혀 다른 번호가 돌아올 수 있다. 찾은 쪽만 말하면 작업자는
   * **자기가 읽지 않은 번호**를 보고도 왜 그런지 알 수 없고, 잘못 걸린 것인지 판단하지 못한다.
   */
  it('읽은 코드와 찾은 LOT이 다르면 둘을 함께 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    await scanCode(user, '123');

    expect(
      await screen.findByText(t.scan.outcomes.material('123', 'SAMPLE-LOT-0001')),
    ).toBeTruthy();
    expect(screen.getByText(/123 →/)).toBeTruthy();
  });

  /* 읽은 것과 찾은 것이 같으면 되풀이하지 않는다 — 같은 번호를 두 번 적으면 읽히지 않는다. */
  it('읽은 코드와 찾은 LOT이 같으면 한 번만 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');

    expect(await screen.findByText('SAMPLE-LOT-0001 담았습니다.')).toBeTruthy();
    expect(screen.queryByText(/→/)).toBeNull();
  });

  /*
   * ⭐ 같은 LOT을 두 번 읽는 것은 현장에서 흔하다. 줄을 늘리면 **같은 자재가 두 번 투입된
   * 것처럼 보이고**, 그 오해가 계보로 넘어간다.
   */
  it('같은 LOT을 두 번 읽어도 줄이 늘지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

    await scanCode(user, 'SAMPLE-LOT-0001');

    expect(
      await screen.findByText(t.scan.outcomes.duplicate('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001')),
    ).toBeTruthy();
    expect(screen.getAllByText('SAMPLE-LOT-0001')).toHaveLength(1);
  });

  /*
   * ⭐ 여러 건이 걸리면 **화면이 고르지 않는다.** 고를 근거가 없고, 틀리면 다른 자재가
   * 계보에 들어간다 — 되돌릴 수 없는 기록이다.
   */
  it('여러 건이 걸리면 담지 않고 다시 읽으라고 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([partialOnlyLotsRoute([lot(), lot({ lotId: 7302, lotNo: 'SAMPLE-LOT-0002' })])]);

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

    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

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
    expect(
      await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001')),
    ).toBeTruthy();
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
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));
  });

  /*
   * ⭐ **조회가 도는 동안에도 「빼기」는 잠기지 않는다** — 그래서 이 순서가 실제로 일어난다.
   *
   * 담을 때 그 순간의 후보 목록을 통째로 덮어쓰면, 조회 사이에 뺀 자재가 **응답이 도착하는
   * 순간 되살아난다.** 작업자는 분명히 뺐는데 목록에 남고, 그대로 확정하면 빼려던 자재가
   * 계보에 들어간다 — 되돌릴 수 없는 기록이다.
   */
  it('조회 중에 뺀 자재는 응답이 와도 되살아나지 않는다', async () => {
    const user = userEvent.setup();

    let releaseSecond = (): void => undefined;
    const secondHeld = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    let lotCalls = 0;
    const stub = createStubFetch([...receiptRoutes(), lotsRoute([lot()])]);
    const fetch: StubFetch = async (request) => {
      if (isGet(request, LOTS_PATH)) {
        lotCalls += 1;
        if (lotCalls === 1) {
          return jsonResponse({ items: [lot()], page: { page: 1, size: 50, total: 1 } });
        }

        await secondHeld;

        return jsonResponse({
          items: [lot({ lotId: 7302, lotNo: 'SAMPLE-LOT-0002' })],
          page: { page: 1, size: 50, total: 1 },
        });
      }

      return stub(request);
    };

    renderWithProviders(<MaterialInputScanScreen />, { fetch, route: ROUTE });

    const field = screen.getByLabelText(t.scan.label);
    await user.type(field, 'SAMPLE-LOT-0001{Enter}');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

    // 둘째 조회를 붙잡아 둔 채로 첫 자재를 뺀다.
    await user.type(field, 'SAMPLE-LOT-0002{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.scan.scanning })).toBeTruthy();
    });

    await user.click(
      screen.getByRole('button', { name: t.scanned.removeMaterial('SAMPLE-LOT-0001') }),
    );
    expect(screen.queryByText('SAMPLE-LOT-0001')).toBeNull();

    releaseSecond();
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0002', 'SAMPLE-LOT-0002'));

    expect(screen.queryByText('SAMPLE-LOT-0001')).toBeNull();
    expect(screen.getByText('SAMPLE-LOT-0002')).toBeTruthy();
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
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

    await user.click(
      screen.getByRole('button', { name: t.scanned.removeMaterial('SAMPLE-LOT-0001') }),
    );

    expect(await screen.findByText(t.scanned.empty)).toBeTruthy();
  });
});

describe('MaterialInputScanScreen — 터치 타겟', () => {
  /*
   * ⭐ 착수 이슈 6번이 정한 처리다 — 「위험 등급 버튼은 72px가 필요한데 DS의 `xl`은 60px다.
   * 12px 부족분은 제품이 임시로 채운다」.
   *
   * 장갑 낀 손으로 누르는 것 둘에만 건다. 크기는 `app.css`가 갖고 있고 여기서는 **그 규칙에
   * 걸리는 표시가 붙어 있는지**를 잰다 — jsdom은 스타일시트를 적용하지 않아 실제 높이를 잴 수
   * 없다(측정 불가 경로).
   */
  it('스캔 보내기와 투입 확정에 현장 단말 치수를 건다', () => {
    renderScreen([lotsRoute([lot()])]);

    expect(screen.getByRole('button', { name: t.scan.submit }).className).toContain(
      'pop-touch-target',
    );
    expect(screen.getByRole('button', { name: t.confirm.action }).className).toContain(
      'pop-touch-target',
    );
  });

  /*
   * ⛔ 되돌릴 수 있는 조작까지 키우지 않는다 — 화면이 버튼으로 덮이면 정작 큰 것이 눈에
   * 띄지 않아 크기가 뜻을 잃는다.
   */
  it('되돌릴 수 있는 조작에는 걸지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

    expect(
      screen.getByRole('button', { name: t.scanned.removeMaterial('SAMPLE-LOT-0001') }).className,
    ).not.toContain('pop-touch-target');
  });
});

describe('MaterialInputScanScreen — 금형 타발수', () => {
  it('타발수를 보이고 넘었으면 경고한다 — 다만 막지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen(
      [
        lotsRoute([]),
        moldsRoute([mold({ currentShotCount: 50000, availableShotCount: 0 })]),
        gateRoute(true),
      ],
      GATED,
    );

    await scanCode(user, 'SAMPLE-MLD-01');

    expect(await screen.findByText(t.scanned.shotCountExceeded)).toBeTruthy();
    /* 경고는 떴는데 「투입 확정」이 그 때문에 잠기지는 않는다 — 잠긴 사유가 다른 것이어야 한다. */
    expect(await screen.findByText(t.confirm.reasons.nothingScanned)).toBeTruthy();
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

describe('MaterialInputScanScreen — 단말 게이팅', () => {
  /*
   * ⛔ **「판정할 수 없음」을 「통과」로 처리하지 않는다**(공유계약 F-6). 아래 넷은 작업자가
   * 할 일이 다르므로 문장이 갈려야 한다 — 합치면 열린 단말에서 관리자를 찾아가고, 막힌
   * 단말에서 되읽기를 반복한다.
   */
  it('단말을 모르면 막고 그 사실을 말한다', async () => {
    renderScreen([lotsRoute([lot()])]);

    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
    expect(screen.getByText(t.confirm.reasons.unidentified)).toBeTruthy();
  });

  it('권한이 닫혀 있으면 막고 관리자를 가리킨다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()]), gateRoute(false)], GATED);

    expect(await screen.findByText(t.confirm.reasons.denied)).toBeTruthy();

    /* 담아도 사유가 바뀌지 않는다 — 담는 것으로 풀리는 문제가 아니다. */
    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
    expect(screen.getByText(t.confirm.reasons.denied)).toBeTruthy();
  });

  /*
   * ⭐ 조회가 실패한 것과 권한이 없는 것은 **다른 사실**이다. 앞은 작업자가 다시 시도해 스스로
   * 풀 수 있고 뒤는 그럴 수 없다 — 그래서 이 갈래에만 다시 시도할 경로를 준다(G-3).
   */
  it('권한을 확인하지 못하면 「확인할 수 없다」고 말하고 다시 시도할 길을 준다', async () => {
    renderScreen(
      [
        lotsRoute([lot()]),
        {
          match: (request) => isGet(request, TERMINAL_PROCESSES_PATH),
          respond: () => new Response(null, { status: 500 }),
        },
      ],
      GATED,
    );

    expect(await screen.findByText(t.confirm.reasons.unavailable)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.confirm.retry })).toBeTruthy();
    expect(screen.queryByText(t.confirm.reasons.denied)).toBeNull();
  });

  /*
   * ⭐ **구성되지 않은 공정은 열려 있지 않다.** 계약이 「기본은 닫힘」이라 적었다 — 이 단말의
   * 구성에 그 공정 행이 아예 없으면 「없으니 통과」가 아니라 「닫혀 있다」로 읽어야 한다.
   * 반대로 두면 **설정되지 않은 단말이 전부 열린 단말이 된다.**
   */
  it('이 공정의 구성이 아예 없으면 닫힌 것으로 읽는다', async () => {
    renderScreen(
      [
        lotsRoute([lot()]),
        {
          match: (request) => isGet(request, TERMINAL_PROCESSES_PATH),
          /* 다른 공정만 구성돼 있다 — 우리가 묻는 공정의 행은 없다. */
          respond: () => jsonResponse({ items: [{ processId: 7999, canInputMaterial: true }] }),
        },
      ],
      GATED,
    );

    expect(await screen.findByText(t.confirm.reasons.denied)).toBeTruthy();
  });

  /*
   * ⭐ **플래그가 응답에 없으면 닫힌 것이다**(2026-08-31 설계 통지). 계약이 8플래그를
   * `required` 로 두지 않았고 전부 「기본은 닫힘」이다 — `flag !== false` 로 읽으면 값이 없을 때
   * 통과하고, **버튼이 항상 열린 채로 굳는다.** 화면은 정상으로 보이므로 눈으로는 드러나지
   * 않는다.
   */
  it('행은 있는데 플래그가 없으면 닫힌 것으로 읽는다', async () => {
    renderScreen(
      [
        lotsRoute([lot()]),
        {
          match: (request) => isGet(request, TERMINAL_PROCESSES_PATH),
          /* 이 공정의 행은 있는데 자재 투입 플래그만 빠져 있다. */
          respond: () => jsonResponse({ items: [{ processId: PROCESS_ID }] }),
        },
      ],
      GATED,
    );

    expect(await screen.findByText(t.confirm.reasons.denied)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
  });

  /* 권한이 없을 때 「다시 시도」를 두면 작업자가 풀 수 없는 것을 되풀이한다. */
  it('권한이 닫힌 것에는 다시 시도를 붙이지 않는다', async () => {
    renderScreen([lotsRoute([lot()]), gateRoute(false)], GATED);

    await screen.findByText(t.confirm.reasons.denied);
    expect(screen.queryByRole('button', { name: t.confirm.retry })).toBeNull();
  });

  /*
   * ⭐ **조회가 도는 동안에도 막는다.** 여는 쪽으로 두면 답이 오기 전 찰나에 눌린 확정이
   * 게이팅을 지나친다 — 스캔을 마친 작업자는 그 버튼을 바로 누른다.
   */
  it('확인이 끝나기 전에는 열지 않는다', async () => {
    let releaseGate = (): void => undefined;
    const gateHeld = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    const stub = createStubFetch([...receiptRoutes(), lotsRoute([lot()]), gateRoute(true)]);
    const fetch: StubFetch = async (request) => {
      if (isGet(request, TERMINAL_PROCESSES_PATH)) await gateHeld;

      return stub(request);
    };

    renderWithProviders(
      <PopIdentityProvider value={GATED}>
        <MaterialInputScanScreen />
      </PopIdentityProvider>,
      { fetch, route: ROUTE },
    );

    await waitFor(() => {
      expect(screen.getByText(t.confirm.reasons.checking)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);

    releaseGate();
    expect(await screen.findByText(t.confirm.reasons.nothingScanned)).toBeTruthy();
  });

  /*
   * 열려 있고 · 담았고 · 수량까지 있어야 비로소 눌린다 — 이 화면이 실제로 투입할 수 있는
   * 유일한 상태다. **수량이 빠진 채로 열리면** 갖춰지지 않은 값이 되돌릴 수 없는 기록에 실린다.
   */
  /*
   * ⭐ 「투입 확정」은 **목록을 닫는 동작**이라(§5-8) 기록된 것이 있어야 열린다. 담기만 하거나
   * 수량만 친 상태로 닫으면 그 줄은 아무 데도 남지 않고 사라진다 — 기록은 「기록」이 한다.
   */
  it('기록된 것이 있어야 확정이 열린다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()]), gateRoute(true)], GATED);

    expect(await screen.findByText(t.confirm.reasons.nothingScanned)).toBeTruthy();

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

    /* 담기만 해서는 열리지 않는다 — 아직 기록되지 않았다. */
    expect(await screen.findByText(t.confirm.reasons.qtyMissing)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);

    /* 수량을 쳐도 아직이다 — 「기록」을 눌러야 원장에 남는다. */
    await user.type(screen.getByLabelText(t.scanned.qtyLabel('SAMPLE-LOT-0001')), '12');
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
  });

  /* 단말을 모르면 조회를 보내지 않는다 — 서버가 거절할 요청을 화면이 한 번 더 만들지 않는다. */
  it('단말을 모르면 게이팅을 조회하지 않는다', async () => {
    const { requests } = renderScreen([lotsRoute([lot()])]);

    await screen.findByText(t.confirm.reasons.unidentified);
    expect(requests.some((request) => request.url.pathname.includes('/processes'))).toBe(false);
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
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001', 'SAMPLE-LOT-0001'));

    const item = screen.getByText('SAMPLE-LOT-0001').closest('li');
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).getByText(/검사 대기/)).toBeTruthy();
    expect(within(item as HTMLElement).getByText(t.scanned.heldMark)).toBeTruthy();
  });
});

describe('MaterialInputScanScreen — 스캔 실패의 대체 경로', () => {
  /*
   * ⭐ 공유계약 D-3 — 스캐너가 죽었을 때 **무엇을 눌러야 하는지가 보여야** 한다. 안내 문구만
   * 두면 장갑을 낀 채 화면을 훑는 작업자에게는 없는 것과 같다.
   */
  it('「직접 입력」이 스캔 칸으로 포커스를 옮긴다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    /* 다른 곳으로 포커스를 옮겨 둔다 — 옮겨 오는 것을 재려면 출발점이 달라야 한다. */
    const away = screen.getByRole('button', { name: t.scan.submit });
    away.focus();
    expect(document.activeElement).toBe(away);

    await user.click(screen.getByRole('button', { name: t.scan.manualEntry }));

    expect(document.activeElement).toBe(screen.getByLabelText(t.scan.label));
  });

  /* 대체 경로는 **되돌릴 수 있는 조작**이 아니라 현장에서 급히 누르는 것이다 — 크기를 건다. */
  it('대체 경로에도 현장 단말 치수를 건다', () => {
    renderScreen([lotsRoute([lot()])]);

    expect(screen.getByRole('button', { name: t.scan.manualEntry }).className).toContain(
      'pop-touch-target',
    );
  });
});

describe('MaterialInputScanScreen — 헤더 맥락', () => {
  /*
   * 스펙 §3 — 지금 **어느 구간에서 어느 단말로** 찍고 있는가. 단말 여러 대가 같은 화면을
   * 띄우므로, 무엇으로 찍었는지가 보이지 않으면 기록을 보고도 그 자리를 되짚을 수 없다.
   */
  it('세션과 단말이 없으면 없다고 말한다', async () => {
    renderScreen([lotsRoute([lot()])]);

    expect(await screen.findByText(t.header.sessionNone)).toBeTruthy();
    expect(screen.getByText(t.header.terminalUnknown)).toBeTruthy();
  });

  /* 단말을 아는 상태에서는 번호가 선다 — 게이팅이 왜 열렸는지의 근거이기도 하다. */
  it('단말을 알면 그 번호를 보인다', async () => {
    renderScreen([lotsRoute([lot()]), gateRoute(true)], GATED);

    expect(await screen.findByText(t.header.terminal(TERMINAL_ID))).toBeTruthy();
  });
});

describe('MaterialInputScanScreen — 끊겼을 때의 스캔', () => {
  /*
   * ⭐ **끊긴 것과 조회가 실패한 것은 작업자가 할 일이 다르다**(공유계약 G-3). 앞은 기다려야
   * 풀리고 뒤는 다시 읽으면 풀린다 — 합치면 끊긴 단말에서 되읽기를 반복한다.
   *
   * ⛔ **오프라인 조회를 대신 만들지 않는다.** 스캔은 LOT 상태를 함께 받는데 그것은 차단
   * 판정에 쓰이는 값이고, C-6 이 그 캐시를 금지한다 — 지난 상태를 보이면 보류된 자재가
   * 정상으로 읽힌다. 이 화면 §6 이 네트워크 두절에 요구한 것은 **쓰기 큐잉**이다.
   */
  it('끊긴 상태에서는 「다시 읽어라」고 하지 않는다', async () => {
    const user = userEvent.setup();

    const stub = createStubFetch([...receiptRoutes(), lotsRoute([lot()])]);
    const fetch: StubFetch = async (request) => {
      if (isGet(request, LOTS_PATH)) throw new TypeError('Failed to fetch');

      return stub(request);
    };

    renderWithProviders(
      <PopIdentityProvider value={GATED}>
        <MaterialInputScanScreen />
      </PopIdentityProvider>,
      { fetch, route: ROUTE },
    );

    /* 브라우저가 끊김을 알린 상태로 둔다 — 그때만 문구가 갈린다. */
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });
    globalThis.dispatchEvent(new Event('offline'));

    await scanCode(user, 'SAMPLE-LOT-0001');

    expect(await screen.findByText(t.scan.outcomes.offline)).toBeTruthy();
    expect(screen.queryByText(t.scan.outcomes.failed)).toBeNull();

    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
  });
});
