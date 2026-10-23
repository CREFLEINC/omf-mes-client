import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
import { popGateDeniedText, popGateUnidentifiedText } from '../../patterns/pop-process-gate';

const DENIED_TEXT = popGateDeniedText({ processName: null }, 'canInputMaterial');

const t = messages.materialInputScan;
const UNIDENTIFIED_TEXT = popGateUnidentifiedText(t.confirm.reasons.unidentified, null);

/**
 * 담은 자재 목록. 화면에 목록이 여럿이라 이름으로 집는다.
 *
 * ⚠ **LOT 번호로 찾을 때는 이 범위 안에서 찾는다.** 같은 화면의 수령 표도 이제 같은 LOT 번호를
 *   내므로(D9), 화면 전체에서 찾으면 두 자리가 함께 걸린다.
 */
const scannedList = (): HTMLElement => screen.getByRole('list', { name: t.scanned.materialsLabel });

/**
 * 그 LOT이 스캔으로 담겨 있는가. 자재 목록에는 수령한 LOT도 「스캔 전」으로 서 있으므로, 줄이
 * 있는지가 아니라 그 줄이 「스캔 전」이 아닌지를 본다.
 */
const scannedHas = (lotNo: string): boolean => {
  const list = screen.queryByRole('list', { name: t.scanned.materialsLabel });
  if (list === null) return false;

  const row = within(list)
    .queryAllByRole('listitem')
    .find((item) => within(item).queryByText(lotNo) !== null);

  return row !== undefined && within(row).queryByText(t.scanned.notScannedMark) === null;
};

/** 투입 수량 편집 영역(고른 LOT의 상세). */
const editor = (): HTMLElement => screen.getByRole('region', { name: t.panes.qty });

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
  processes: [{ processId: PROCESS_ID }],
  equipment: null,
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

    expect(await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'))).toBeTruthy();

    const lotRequest = requests.find((request) => request.url.pathname === LOTS_PATH);
    expect(lotRequest?.url.searchParams.get('lotNo')).toBe('SAMPLE-LOT-0001');
  });

  /*
   * ⭐ **Enter 를 붙이지 않는 스캐너도 한 번에 담긴다**(omf-all-around#35). 스캐너 속도로 들어온
   *    글자가 멈추면 보낸다 — 실기에서 LOT 을 읽고 Enter 를 한 번 더 쳐야 담겼다.
   */
  it('Enter 없이 스캐너 속도로 들어온 코드도 멈추면 담는다', async () => {
    renderScreen([lotsRoute([lot()])]);
    const field = screen.getByLabelText(t.scan.label);
    const code = 'SAMPLE-LOT-0001';

    for (let length = 1; length <= code.length; length += 1) {
      fireEvent.change(field, { target: { value: code.slice(0, length) } });
    }

    expect(await screen.findByText(t.scan.outcomes.material(code))).toBeTruthy();
  });

  /*
   * ⛔ **정확 일치로 집었으면 부분 검색을 하지 않는다.** 이어서 물으면 같은 스캔 하나가 축을
   * 둘 타고, 뒤 축이 다른 LOT을 물어 오면 무엇이 정본인지 정할 근거가 없어진다.
   */
  it('정확 일치로 집으면 부분 검색을 잇지 않는다', async () => {
    const user = userEvent.setup();
    const { requests } = renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

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

    expect(await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'))).toBeTruthy();

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
   * **읽은 것과 찾은 것은 다를 수 있다.** 계약의 검색은 LOT 번호의 일부와 외부 식별자에도
   * 걸리므로, 짧은 코드를 읽어도 전혀 다른 번호가 돌아올 수 있다. 화면은 **찾은 쪽**을 말한다 —
   * 담기는 것이 그것이기 때문이다.
   *
   * ⚠ **읽은 코드는 더 이상 함께 보이지 않는다**(사용자 지시 · 설계에 그 지시가 없다). 그래서
   * 짧은 코드가 엉뚱한 LOT 에 걸린 경우 작업자는 «자기가 읽지 않은 번호»를 보게 되고, 왜 그런지
   * 화면만으로는 알 수 없다. 되돌리려면 `scan-field.tsx` 의 결과 줄에 한 조각을 더하면 된다.
   */
  it('읽은 코드와 찾은 LOT이 달라도 찾은 LOT을 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    await scanCode(user, '123');

    expect(await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'))).toBeTruthy();
    /* 읽은 코드는 결과 줄에 남지 않는다. */
    expect(screen.queryByText(/123/)).toBeNull();
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
    expect(within(scannedList()).getAllByText('SAMPLE-LOT-0001')).toHaveLength(1);
  });

  /* 현재 LOT은 하나다(PG-25). 담긴 LOT을 다시 읽으면 편집 영역이 그 LOT으로 옮긴다. */
  it('이미 담긴 LOT을 다시 읽으면 그 LOT을 편집 영역에 연다', async () => {
    const user = userEvent.setup();
    const lots = [lot(), lot({ lotId: 7302, lotNo: 'SAMPLE-LOT-0002' })];
    renderScreen([
      {
        match: (request) => isGet(request, LOTS_PATH),
        respond: (request) => {
          const lotNo = new URL(request.url).searchParams.get('lotNo');

          return jsonResponse(listBody(lots.filter((one) => one.lotNo === lotNo)));
        },
      },
    ]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));
    await scanCode(user, 'SAMPLE-LOT-0002');
    await within(editor()).findByText('SAMPLE-LOT-0002');

    await scanCode(user, 'SAMPLE-LOT-0001');

    expect(await within(editor()).findByText('SAMPLE-LOT-0001')).toBeTruthy();
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
    expect(scannedHas('SAMPLE-LOT-0001')).toBe(false);
    expect(scannedHas('SAMPLE-LOT-0002')).toBe(false);
  });

  it('어디에서도 못 찾으면 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([]), moldsRoute([])]);

    await scanCode(user, 'SAMPLE-X');

    expect(await screen.findByText(t.scan.outcomes.notFound('SAMPLE-X'))).toBeTruthy();
    expect(screen.queryByText(t.scanned.pendingMark)).toBeNull();
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

    /*
     * ⚠ **Enter 로 보낸다** — 화면에 [읽기] 단추가 없어졌다(설계 §3 도면). 그래서 포커스가
     *   칸에 남은 채로 보내지고, 「되돌린다」는 장치를 떼어내도 이 줄만으로는 걸리지 않는다.
     *   포커스를 «옮겨 오는» 것은 아래 「직접 입력」 감지기가 따로 잰다.
     */
    await user.type(field, 'SAMPLE-LOT-0001{Enter}');

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

    /* 조회가 «떠난» 것을 여기서 잰다 — 진행 중을 말해 주던 [읽기] 단추가 없다. */
    let lotsReached = false;
    const stub = createStubFetch([...receiptRoutes(), lotsRoute([lot()])]);
    const fetch: StubFetch = async (request) => {
      if (isGet(request, LOTS_PATH)) {
        lotsReached = true;
        await lotsHeld;
      }

      return stub(request);
    };

    renderWithProviders(<MaterialInputScanScreen />, { fetch, route: ROUTE });

    await user.type(screen.getByLabelText(t.scan.label), 'SAMPLE-LOT-0001{Enter}');

    await waitFor(() => {
      expect(lotsReached).toBe(true);
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
    /* 첫 조회가 떠난 것을 확인하고서야 둘째를 보낸다 — 진행 중을 말해 주던 단추가 없다. */
    await waitFor(() => {
      expect(requests.filter((request) => request.url.pathname === LOTS_PATH)).toHaveLength(1);
    });

    await user.type(field, 'SAMPLE-LOT-0002{Enter}');

    expect(requests.filter((request) => request.url.pathname === LOTS_PATH)).toHaveLength(1);

    releaseLots();
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));
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
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    // 둘째 조회를 붙잡아 둔 채로 첫 자재를 뺀다.
    await user.type(field, 'SAMPLE-LOT-0002{Enter}');
    /* 둘째 조회가 떠난 것을 호출 수로 잰다 — 진행 중을 말해 주던 단추가 없다. */
    await waitFor(() => {
      expect(lotCalls).toBe(2);
    });

    await user.click(
      screen.getByRole('button', { name: t.scanned.removeMaterial('SAMPLE-LOT-0001') }),
    );
    expect(scannedHas('SAMPLE-LOT-0001')).toBe(false);

    releaseSecond();
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0002'));

    expect(scannedHas('SAMPLE-LOT-0001')).toBe(false);
    expect(scannedHas('SAMPLE-LOT-0002')).toBe(true);
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

    expect(scannedHas('SAMPLE-LOT-0001')).toBe(true);

    await user.click(
      screen.getByRole('button', { name: t.scanned.removeMaterial('SAMPLE-LOT-0001') }),
    );

    await waitFor(() => {
      expect(scannedHas('SAMPLE-LOT-0001')).toBe(false);
    });
  });
});

describe('MaterialInputScanScreen — 터치 타겟', () => {
  /*
   * 주 동작 [투입 확정]은 하단 동작 바에 선다(C-3). 크기는 작업 시작 하단 바와 같은 POP 터치
   * 규격이고 `pop.css` 바닥 띠 규칙이 맡는다 — jsdom은 스타일시트를 적용하지 않아 높이는 잴 수
   * 없다(측정 불가 경로). 여기서는 자리만 잰다.
   */
  it('투입 확정은 하단 동작 바에 선다', () => {
    renderScreen([lotsRoute([lot()])]);

    const bar = screen.getByRole('region', { name: messages.screenPatterns.actionBar.region });
    expect(within(bar).getByRole('button', { name: t.confirm.action })).toBeTruthy();
  });

  /*
   * ⛔ 되돌릴 수 있는 조작까지 키우지 않는다 — 화면이 버튼으로 덮이면 정작 큰 것이 눈에
   * 띄지 않아 크기가 뜻을 잃는다.
   */
  it('되돌릴 수 있는 조작에는 걸지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

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
    /*
     * 경고는 떴는데 「투입 확정」이 그 때문에 잠기지는 않는다 — 잠긴 사유 문구가 하나도
     * 뜨지 않은 채, 아직 기록된 것이 없어서 잠겨 있어야 한다.
     */
    expect(screen.queryByText(DENIED_TEXT)).toBeNull();
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
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
    expect(screen.getByText(UNIDENTIFIED_TEXT)).toBeTruthy();
  });

  /* 사번이 없는 사유는 하단 바 「남은 일」 한 곳에서 말한다(C-4). 맨 위 띠를 겹쳐 세우지 않는다. */
  it('사번이 없으면 막고 「남은 일」로만 말한다', async () => {
    renderScreen([lotsRoute([lot()]), gateRoute(true)], { ...GATED, workerNo: null });

    expect(await screen.findByText(t.confirm.reasons.workerMissing)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
    expect(screen.queryByText(messages.popChrome.workerMissing)).toBeNull();
  });

  it('권한이 닫혀 있으면 막고 관리자를 가리킨다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()]), gateRoute(false)], GATED);

    expect(await screen.findByText(DENIED_TEXT)).toBeTruthy();

    /* 담아도 사유가 바뀌지 않는다 — 담는 것으로 풀리는 문제가 아니다. */
    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
    expect(screen.getByText(DENIED_TEXT)).toBeTruthy();
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
    expect(screen.queryByText(DENIED_TEXT)).toBeNull();
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
          respond: () =>
            jsonResponse({ items: [{ processes: [{ processId: 7999 }], canInputMaterial: true }] }),
        },
      ],
      GATED,
    );

    expect(await screen.findByText(DENIED_TEXT)).toBeTruthy();
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

    expect(await screen.findByText(DENIED_TEXT)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
  });

  /* 권한이 없을 때 「다시 시도」를 두면 작업자가 풀 수 없는 것을 되풀이한다. */
  it('권한이 닫힌 것에는 다시 시도를 붙이지 않는다', async () => {
    renderScreen([lotsRoute([lot()]), gateRoute(false)], GATED);

    await screen.findByText(DENIED_TEXT);
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
    /* 확인이 끝나면 「확인 중」은 사라진다 — 그 뒤로는 담긴 것이 없어 말없이 잠겨 있다. */
    await waitFor(() => {
      expect(screen.queryByText(t.confirm.reasons.checking)).toBeNull();
    });
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
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

    expect(await screen.findByRole('button', { name: t.confirm.action })).toHaveProperty(
      'disabled',
      true,
    );

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    /* 담기만 해서는 열리지 않는다 — 아직 기록되지 않았다(맨 위 띠는 세우지 않는다 · 2026-09-19). */
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
    expect(screen.queryByText(t.confirm.reasons.qtyMissing)).toBeNull();

    /* 수량을 쳐도 아직이다 — 「기록」을 눌러야 원장에 남는다. */
    await user.type(screen.getByLabelText(t.scanned.qtyLabel('SAMPLE-LOT-0001')), '12');
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
  });

  /* 단말을 모르면 조회를 보내지 않는다 — 서버가 거절할 요청을 화면이 한 번 더 만들지 않는다. */
  it('단말을 모르면 게이팅을 조회하지 않는다', async () => {
    const { requests } = renderScreen([lotsRoute([lot()])]);

    await screen.findByText(UNIDENTIFIED_TEXT);
    expect(requests.some((request) => request.url.pathname.includes('/processes'))).toBe(false);
  });
});

describe('MaterialInputScanScreen — 자재 상태 표시', () => {
  /*
   * 스펙 §5-2 는 「정상만 투입 가능」이고 §6 예외표가 「Hold 자재 스캔 ⛔ 차단 — R37」이다.
   * 담아 두면 수량까지 넣은 뒤 확정에서 서버에 거부당한다 — 그 헛수고를 스캔 자리에서 끊는다
   * (omf-all-around#48). 최종 판정은 여전히 서버다.
   */
  it('⛔ 정상이 아닌 LOT 은 담지 않고 그 자리에서 사유를 말한다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot({ statusCode: 'INSPECTION_PENDING', held: true })])]);

    await scanCode(user, 'SAMPLE-LOT-0001');

    /* 상태 «이름»은 코드값 조회로 받은 것을 쓴다 — 화면이 그 말을 지어내지 않는다. */
    await screen.findByText(t.scan.outcomes.blockedStatus('SAMPLE-LOT-0001', '검사 대기'));
    expect(screen.queryByText(t.scan.outcomes.material('SAMPLE-LOT-0001'))).toBeNull();
    /* 담기지 않았으므로 목록은 빈 안내로 남는다. */
    expect(scannedHas('SAMPLE-LOT-0001')).toBe(false);
  });

  it('정상 LOT 은 담고 상태와 보류 표식을 그대로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot({ statusCode: 'NORMAL', held: true })])]);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    const item = within(scannedList()).getByText('SAMPLE-LOT-0001').closest('li');
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).getByText(t.scanned.heldMark)).toBeTruthy();
    /* 상태 이름은 고른 LOT의 편집 영역이 보인다. 담으면 그 LOT이 골라진다. */
    expect(within(editor()).getByText(/정상/)).toBeTruthy();
  });
});

describe('MaterialInputScanScreen — 스캔 실패의 대체 경로', () => {
  /*
   * 스캐너가 죽으면 같은 칸에 코드를 바로 친다(공유계약 D-3). 칸에 칠 수 있으므로 [직접 입력]
   * 버튼을 두지 않고(C-19 「값을 넣는 칸을 버튼으로 대신하지 않는다」), 받는 대상은 안내 문구에
   * 적는다(C-13).
   */
  it('칸에 바로 친 코드를 Enter로 담고, 받는 대상을 안내 문구로 알린다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()])]);

    const field = screen.getByLabelText(t.scan.label);
    expect(field.getAttribute('placeholder')).toBe(t.scan.placeholder);
    expect(screen.queryByRole('button', { name: '직접 입력' })).toBeNull();

    await user.type(field, 'SAMPLE-LOT-0001{Enter}');

    expect(await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'))).toBeTruthy();
  });
});

describe('MaterialInputScanScreen — 머리줄', () => {
  const workOrderRoute = (): StubRoute => ({
    match: (request) => isGet(request, `/production/work-orders/${String(WORK_ORDER_ID)}`),
    respond: () =>
      jsonResponse({
        workOrderId: WORK_ORDER_ID,
        workOrderNo: 'SAMPLE-WO-0001',
        workOrderTypeCode: 'NORMAL',
        processId: PROCESS_ID,
        processName: '합성 공정',
      }),
  });

  const header = (): HTMLElement => screen.getAllByRole('banner')[0] as HTMLElement;

  /* C-11 — 현재 W/O와 공정. 작업지시 번호는 사용자가 보는 번호다. */
  it('현재 W/O 번호와 공정을 보인다', async () => {
    renderScreen([lotsRoute([lot()]), gateRoute(true), workOrderRoute()], GATED);

    expect(
      await within(header()).findByText(messages.popChrome.header.workOrderLabel('SAMPLE-WO-0001')),
    ).toBeTruthy();
    expect(within(header()).getByText('합성 공정')).toBeTruthy();
  });

  /* C-13 — 내부 번호(세션 번호, 단말 번호, 작업지시 내부 번호)를 보이지 않는다. */
  it('내부 번호를 보이지 않는다', async () => {
    renderScreen([lotsRoute([lot()]), gateRoute(true), workOrderRoute()], GATED);

    await within(header()).findByText('합성 공정');
    expect(within(header()).queryByText(/#/)).toBeNull();
    expect(within(header()).queryByText(new RegExp(String(TERMINAL_ID)))).toBeNull();
    expect(within(header()).queryByText(new RegExp(String(WORK_ORDER_ID)))).toBeNull();
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

/**
 * ⭐ **판정은 단말이 아니라 「단말 × 공정」에 붙는다.**
 *
 * 이 조회가 내는 것은 구성 전체가 아니라 「이 공정에서 투입할 수 있는가」라는 불리언 하나다 —
 * 단말만 캐시 키로 잡으면 같은 단말에서 공정이 바뀌었을 때 **앞 공정의 판정이 그대로 돌아오고,
 * 닫힌 공정이 열려 보인다.**
 */
describe('MaterialInputScanScreen — 게이팅 캐시', () => {
  const OTHER_PROCESS = 7903;

  /** 트리 «안에서» 공정을 바꾼다 — 캐시를 공유해야 「앞 판정이 돌아오는지」를 잴 수 있다. */
  const SwitchableProcess = () => {
    const [processId, setProcessId] = useState(PROCESS_ID);

    return (
      <PopIdentityProvider value={{ ...GATED, processes: [{ processId }] }}>
        <button
          type="button"
          onClick={() => {
            setProcessId(OTHER_PROCESS);
          }}
        >
          공정 바꾸기
        </button>
        <MaterialInputScanScreen />
      </PopIdentityProvider>
    );
  };

  it('같은 단말이라도 공정이 다르면 판정을 다시 받는다', async () => {
    const user = userEvent.setup();

    /* 이 단말은 7902 에서는 열려 있고 7903 에서는 닫혀 있다. */
    const twoProcesses: StubRoute = {
      match: (request) => isGet(request, TERMINAL_PROCESSES_PATH),
      respond: () =>
        jsonResponse({
          items: [
            { processId: PROCESS_ID, canInputMaterial: true },
            { processId: OTHER_PROCESS, canInputMaterial: false },
          ],
        }),
    };

    const stub = createStubFetch([...receiptRoutes(), lotsRoute([lot()]), twoProcesses]);
    renderWithProviders(<SwitchableProcess />, { fetch: stub, route: ROUTE });

    await screen.findByRole('button', { name: t.confirm.action });
    await user.click(screen.getByRole('button', { name: '공정 바꾸기' }));

    expect(await screen.findByText(DENIED_TEXT)).toBeTruthy();
  });
});

describe('MaterialInputScanScreen — 공정이 여럿인 단말', () => {
  const OTHER_PROCESS_ID = 7903;
  const MULTI: PopIdentity = {
    ...GATED,
    processes: [{ processId: OTHER_PROCESS_ID }, { processId: PROCESS_ID }],
  };
  const workOrderRoute: StubRoute = {
    match: (request) => isGet(request, `/production/work-orders/${String(WORK_ORDER_ID)}`),
    respond: () =>
      jsonResponse({
        workOrderId: WORK_ORDER_ID,
        workOrderNo: 'SAMPLE-WO',
        processId: PROCESS_ID,
        processName: '합성 사출',
      }),
  };
  const mappingRoute = (canInputMaterial: boolean): StubRoute => ({
    match: (request) => isGet(request, TERMINAL_PROCESSES_PATH),
    respond: () =>
      jsonResponse({
        items: [
          {
            processId: OTHER_PROCESS_ID,
            processName: '합성 조립',
            canInputMaterial: !canInputMaterial,
          },
          { processId: PROCESS_ID, processName: '합성 사출', canInputMaterial },
        ],
      }),
  });

  it('W/O 의 공정으로 판정해 「단말 미확인」 없이 연다', async () => {
    const user = userEvent.setup();
    renderScreen([lotsRoute([lot()]), workOrderRoute, mappingRoute(true)], MULTI);

    await scanCode(user, 'SAMPLE-LOT-0001');
    await screen.findByText(t.scan.outcomes.material('SAMPLE-LOT-0001'));

    /* 판정의 네 갈래 문구가 하나도 서지 않으면 열린 것이다. */
    await waitFor(() => expect(screen.queryByText(t.confirm.reasons.checking)).toBeNull());
    for (const blocked of [
      UNIDENTIFIED_TEXT,
      t.confirm.reasons.unavailable,
      DENIED_TEXT,
      popGateDeniedText({ processName: '합성 사출' }, 'canInputMaterial'),
    ]) {
      expect(screen.queryByText(blocked)).toBeNull();
    }
  });

  it('작업지시를 일시적으로 읽지 못하면(500) 「확인할 수 없다」와 다시 시도를 주고, 다시 읽으면 풀린다', async () => {
    const user = userEvent.setup();
    let reads = 0;
    renderScreen(
      [
        lotsRoute([lot()]),
        {
          match: (request) => isGet(request, `/production/work-orders/${String(WORK_ORDER_ID)}`),
          respond: () => {
            reads += 1;
            return reads === 1
              ? jsonResponse({ message: 'Internal server error' }, { status: 500 })
              : jsonResponse({
                  workOrderId: WORK_ORDER_ID,
                  workOrderNo: 'SAMPLE-WO',
                  processId: PROCESS_ID,
                  processName: '합성 사출',
                });
          },
        },
        mappingRoute(false),
      ],
      MULTI,
    );

    expect(await screen.findByText(t.confirm.reasons.unavailable)).toBeTruthy();
    expect(screen.queryByText(/Internal server error/)).toBeNull();
    await user.click(screen.getByRole('button', { name: t.confirm.retry }));

    expect(
      await screen.findByText(popGateDeniedText({ processName: '합성 사출' }, 'canInputMaterial')),
    ).toBeTruthy();
    expect(reads).toBe(2);
  });

  it('작업지시를 읽지 못하면(401) 원인·조치와 매핑 확인 곳 아래에 서버 이유를 덧붙인다', async () => {
    const reason = '단말 인증 범위 밖입니다.';
    renderScreen(
      [
        lotsRoute([lot()]),
        {
          match: (request) => isGet(request, `/production/work-orders/${String(WORK_ORDER_ID)}`),
          respond: () =>
            jsonResponse(
              { errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: reason }] },
              { status: 401 },
            ),
        },
        mappingRoute(true),
      ],
      MULTI,
    );

    expect(
      await screen.findByText(popGateUnidentifiedText(t.confirm.reasons.unidentified, reason)),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
  });

  it('W/O 공정의 자재 투입이 꺼져 있으면 공정 이름과 켜는 곳을 말하며 막는다', async () => {
    renderScreen([lotsRoute([lot()]), workOrderRoute, mappingRoute(false)], MULTI);

    expect(
      await screen.findByText(popGateDeniedText({ processName: '합성 사출' }, 'canInputMaterial')),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: t.confirm.action })).toHaveProperty('disabled', true);
  });
});
