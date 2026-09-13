import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import {
  MOLD_ID,
  NEW_LOT_NO,
  OLD_CONSUMPTION_ID,
  OLD_LOT_NO,
  PROCESS_ID,
  TERMINAL_ID,
  WORKER_NO,
  WORK_ORDER_ID,
  WORK_SESSION_ID,
  makeConsumption,
  makeLot,
  makeMold,
} from './fixtures';
import { RunningChangeScreen } from './screen';

const t = messages.runningChange;

const ENTRY_ROUTE = `/pop/running-change?workOrderId=${String(WORK_ORDER_ID)}`;

/** 단말·공정·사번을 아는 상태. 셸이 채우는 값이라 시험에서는 직접 넣는다. */
const IDENTIFIED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processes: [{ processId: PROCESS_ID }],
  equipment: null,

  workerNo: WORKER_NO,
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

/** 보류 칩이 코드가 아니라 이 이름으로 서야 한다(#1045). */
const LOT_STATUS_VALUE = {
  codeValueId: 2,
  code: 'INSPECTION_PENDING',
  codeName: '검사 대기',
  isActive: true,
};

interface Options {
  canInputMaterial?: boolean;
  /** 게이팅 조회가 실패한다 */
  gateFails?: boolean;
  /** 이 공정의 기능 구성 행이 아예 없다 */
  noProcessRow?: boolean;
  /** 현재 투입 조회가 실패한다 */
  inputsFail?: boolean;
  /** 현재 투입 목록. **교체 대상의 모집단이다** — 기본은 한 줄 */
  inputs?: ReturnType<typeof makeConsumption>[];
  /** 열린 세션이 없다 */
  noSession?: boolean;
  /** 고객이 교체 사유를 아직 채우지 않았다 — 0건이 정상이다(스펙 §6) */
  noChangeReasons?: boolean;
  /** 부분 검색으로만 걸린다 — 읽은 코드와 찾은 LOT 번호가 달라진다 */
  partialOnly?: boolean;
  /** 품질 상태 표시명을 받지 못한다 */
  noLotStatuses?: boolean;
  /** 스캔한 LOT 이 보류 중이다 — 그때만 상태 칩이 선다 */
  heldPart?: boolean;
  /** 그 상태 코드가 미사용으로 바뀌었다 — 옛 LOT 에 붙어 있을 수 있다 */
  inactiveLotStatus?: boolean;
  /** 교체 등록 요청을 담아 둔다 */
  writes?: Request[];
  /** 교체 등록 응답 상태. 기본 201 */
  writeStatus?: number;
  /** 교체 등록이 **통신 실패**한다. 거부와 달리 큐에 남는다 */
  writeFails?: boolean;
}

/** 스캔으로 걸리는 LOT. 보류 중이면 품질 상태 칩이 선다. */
const scannedLot = (options: Options) =>
  options.heldPart === true
    ? makeLot({ held: true, statusCode: LOT_STATUS_VALUE.code })
    : makeLot();

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => pathOf(request).startsWith('/mdm/terminals/'),
    respond: () => {
      if (options.gateFails === true)
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      if (options.noProcessRow === true) return jsonResponse({ items: [] });

      return jsonResponse({
        items: [{ processId: PROCESS_ID, canInputMaterial: options.canInputMaterial ?? true }],
      });
    },
  },
  {
    match: (request) =>
      request.method === 'GET' && pathOf(request) === '/production/material-consumptions',
    respond: () => {
      if (options.inputsFail === true)
        return jsonResponse({ message: '조회 실패' }, { status: 500 });

      const items = options.inputs ?? [makeConsumption()];

      return jsonResponse({ items, page: { page: 1, size: 200, total: items.length } });
    },
  },
  {
    match: (request) =>
      request.method === 'POST' && pathOf(request) === '/production/material-consumptions',
    respond: (request) => {
      options.writes?.push(request.clone());

      /* 통신이 끊긴 것은 서버가 거부한 것과 다르다 — 큐에 남아 다시 나간다. */
      if (options.writeFails === true) throw new TypeError('연결 끊김');

      const status = options.writeStatus ?? 201;

      return status >= 400
        ? jsonResponse({ code: 'INVALID_STATE', message: '받지 않았습니다' }, { status })
        : jsonResponse(makeConsumption({ materialConsumptionId: 55002 }), { status });
    },
  },
  {
    match: (request) => pathOf(request) === '/production/work-sessions',
    respond: () =>
      jsonResponse({
        items:
          options.noSession === true
            ? []
            : [
                {
                  workSessionId: WORK_SESSION_ID,
                  workOrderId: WORK_ORDER_ID,
                  sessionNo: 2,
                  terminalId: TERMINAL_ID,
                  moldId: MOLD_ID,
                  startedAt: '2026-09-02T08:00:00+09:00',
                  statusCode: 'SAMPLE',
                },
              ],
        page: { page: 1, size: 20, total: 1 },
      }),
  },
  {
    match: (request) => pathOf(request).startsWith('/mdm/molds/'),
    respond: () =>
      jsonResponse({ mold: makeMold(), editability: { editable: true }, labelIssueCount: 0 }),
  },
  {
    match: (request) => pathOf(request) === '/trace/lots',
    respond: (request) => {
      const query = new URL(request.url).searchParams;
      /* 1단계 — LOT 번호 정확 일치. 다른 값이면 걸리지 않는다. */
      if (query.get('lotNo') === NEW_LOT_NO) {
        return jsonResponse({
          items: [scannedLot(options)],
          page: { page: 1, size: 20, total: 1 },
        });
      }

      /* 2단계 — 외부 식별자·번호 일부로 걸린다. 읽은 코드와 찾은 번호가 다르다. */
      if (options.partialOnly === true && query.get('q') !== null) {
        return jsonResponse({
          items: [scannedLot(options)],
          page: { page: 1, size: 20, total: 1 },
        });
      }

      return jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
    },
  },
  {
    match: (request) => pathOf(request).startsWith('/trace/lots/'),
    respond: (request) => {
      const lotId = Number(pathOf(request).split('/').at(-1));

      return jsonResponse({
        lot: makeLot({ lotId, lotNo: lotId === makeLot().lotId ? NEW_LOT_NO : OLD_LOT_NO }),
        externalIdentifiers: [],
        holds: [],
      });
    },
  },
  {
    match: (request) => pathOf(request).startsWith('/mdm/items/'),
    respond: (request) =>
      jsonResponse({
        item: { itemId: Number(pathOf(request).split('/').at(-1)), itemCode: 'ITEM-SAMPLE' },
        editability: { editable: true },
      }),
  },
  {
    /* 교체 사유 값 목록 — 고객이 마스터에서 채운다(스펙 §4-A). 기본 목에서는 한 건 온다. */
    match: (request) => pathOf(request) === '/mdm/code-values',
    respond: (request) => {
      /* 품질 상태는 교체 사유와 다른 그룹이다 — 한 갈래로 묶으면 사유 목록에 상태가 섞인다. */
      const query = new URL(request.url).searchParams;

      if (query.get('codeGroupCode') === 'LOT_STATUS') {
        /*
         * ⭐ **서버처럼 군다** — 계약의 기본은 「사용 중인 것만」이고 미사용 값은 화면이
         *    `includeInactive` 를 켜야 온다(공유계약 G-8). 목이 늘 다 내려 주면 화면이 그것을
         *    안 켜도 시험이 통과해, 폐기된 상태가 붙은 옛 LOT 이 깨지는 것을 못 잡는다.
         */
        const all =
          options.noLotStatuses === true
            ? []
            : [
                {
                  ...LOT_STATUS_VALUE,
                  isActive: options.inactiveLotStatus !== true,
                },
              ];
        const items =
          query.get('includeInactive') === 'true' ? all : all.filter((value) => value.isActive);

        return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
      }

      return jsonResponse({
        items: options.noChangeReasons
          ? []
          : [{ codeValueId: 1, code: 'DEFECT', codeName: '부품 불량' }],
        page: { page: 1, size: 100, total: options.noChangeReasons ? 0 : 1 },
      });
    },
  },
  {
    match: (request) => pathOf(request) === '/mdm/uoms',
    respond: () =>
      jsonResponse({
        items: [{ uomId: 11, uomCode: 'EA' }],
        page: { page: 1, size: 200, total: 1 },
      }),
  },
];

const renderScreen = (options: Options = {}, identity: PopIdentity = IDENTIFIED) =>
  renderWithProviders(
    <PopIdentityProvider value={identity}>
      <RunningChangeScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes(options)), route: ENTRY_ROUTE },
  );

const submitButton = (): HTMLElement => screen.getByRole('button', { name: t.replace.submit });

/** 스캔 → 대상 선택 → 수량까지 밟는다. 등록은 부르는 쪽이 누른다. */
const fillReplacement = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  /* 스캐너는 코드 끝에 Enter 를 붙여 보낸다 — 화면에 [읽기] 단추가 없으므로 그 길이 전부다. */
  await user.type(screen.getByLabelText(t.scan.label), `${NEW_LOT_NO}{Enter}`);
  await screen.findByText(t.scan.outcomes.part(NEW_LOT_NO));

  await user.click(screen.getByLabelText(t.replace.targetLabel));
  await user.click(await screen.findByRole('option', { name: /ITEM-SAMPLE/ }));

  /*
   * 수량은 **키패드로** 넣는다(공유계약 D-4) — 칸을 누르면 창이 뜨고, 거기서 눌러 [ 확인 ]으로
   * 넘긴다. 단말에는 자판이 없어 이것이 현장에서 실제로 가능한 유일한 경로다.
   */
  await user.click(screen.getByRole('textbox', { name: t.replace.qtyLabel }));

  const pad = await screen.findByRole('dialog');

  for (const digit of ['1', '2', '0']) {
    await user.click(within(pad).getByRole('button', { name: digit }));
  }

  await user.click(within(pad).getByRole('button', { name: t.pad.confirm }));
};

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe('러닝체인지 화면 — 읽기', () => {
  it('현재 투입과 지금 물린 금형을 세운다', async () => {
    renderScreen();

    expect(await screen.findByText('ITEM-SAMPLE')).toBeInTheDocument();
    expect(await screen.findByText(OLD_LOT_NO)).toBeInTheDocument();
    expect(await screen.findByText(/MD-SAMPLE-11/)).toBeInTheDocument();
  });

  /* ⛔ 실패를 「투입이 없다」로 접으면 작업자가 교체할 것이 없다고 읽고 떠난다. */
  it('현재 투입 조회 실패를 빈 상태가 아니라 오류로 낸다', async () => {
    renderScreen({ inputsFail: true });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(t.current.empty)).not.toBeInTheDocument();
  });

  it('작업지시가 없으면 사유를 말하고 조회하지 않는다', async () => {
    renderWithProviders(
      <PopIdentityProvider value={IDENTIFIED}>
        <RunningChangeScreen />
      </PopIdentityProvider>,
      { fetch: createStubFetch(routes({})), route: '/pop/running-change' },
    );

    expect(await screen.findByText(t.header.workOrderMissing)).toBeInTheDocument();
    expect(screen.getByText(t.current.noWorkOrder)).toBeInTheDocument();
  });

  /* 세션은 「어느 구간에 매다는가」이지 「열 수 있는가」가 아니다(§6). */
  it('세션이 없어도 화면은 서고 그 사실을 말한다', async () => {
    renderScreen({ noSession: true });

    expect(await screen.findByText(t.header.sessionNone)).toBeInTheDocument();
    expect(screen.getByText(t.current.moldNoSession)).toBeInTheDocument();
  });

  /*
   * ⭐ 값은 고객이 마스터에서 채우고 받는 곳은 있다(스펙 §4-A · §8 미결 1) — 칸을 잠가 두지
   *    않는다. 비어서 올 때만 잠그고 «왜» 비었는지 말한다(§6 · G-2).
   */
  it('교체 사유를 받아 오면 고를 수 있다', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText(t.replace.reasonLabel)).toBeEnabled();
    });
    expect(screen.queryByText(t.replace.reasonEmpty)).not.toBeInTheDocument();
  });

  it('고객이 아직 채우지 않았으면 잠그고 그 사실을 말한다', async () => {
    renderScreen({ noChangeReasons: true });

    expect(await screen.findByText(t.replace.reasonEmpty)).toBeInTheDocument();
    expect(screen.getByLabelText(t.replace.reasonLabel)).toBeDisabled();
  });
});

/*
 * 공유계약 D-4 — POP 숫자 입력은 화면 내장 키패드다. 단말에는 자판이 없어, 칸만 두면 수량을
 * 넣을 방법이 없다.
 */
describe('러닝체인지 화면 — 수량 키패드', () => {
  it('수량 칸을 누르면 키패드가 뜨고, 취소하면 닫힌 채로 있다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('textbox', { name: t.replace.qtyLabel }));

    const pad = await screen.findByRole('dialog');
    await user.click(within(pad).getByRole('button', { name: t.pad.cancel }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { hidden: true })).not.toBeVisible();
    });

    /*
     * ⛔ **포커스가 창을 열지 않는다.** 창이 닫히면 포커스가 수량 칸으로 돌아오는데, 그
     *    포커스를 열림 신호로 삼았더니 [ 취소 ]·[ 확인 ]이 창을 다시 띄워 **닫을 수 없는
     *    창**이 됐다(사용자 지적 2026-09-07). 여기서 그 신호를 그대로 재현한다.
     */
    fireEvent.focus(screen.getByRole('textbox', { name: t.replace.qtyLabel }));

    expect(screen.getByRole('dialog', { hidden: true })).not.toBeVisible();
  });

  it('키패드로 넣은 값이 수량 칸에 들어간다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('textbox', { name: t.replace.qtyLabel }));

    const pad = await screen.findByRole('dialog');
    await user.click(within(pad).getByRole('button', { name: '7' }));
    await user.click(within(pad).getByRole('button', { name: t.pad.confirm }));

    expect(screen.getByRole('textbox', { name: t.replace.qtyLabel })).toHaveValue('7');
  });
});

describe('러닝체인지 화면 — 단말 게이팅', () => {
  it('플래그가 열려 있으면 등록이 열린다', async () => {
    const user = userEvent.setup();
    renderScreen();
    await fillReplacement(user);

    await waitFor(() => {
      expect(submitButton()).toBeEnabled();
    });
  });

  it('플래그가 닫혀 있으면 막고 「권한이 없다」고 말한다', async () => {
    renderScreen({ canInputMaterial: false });

    expect(await screen.findByText(t.disabled.denied)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  /* ⛔ 「판정할 수 없음」을 「통과」로 처리하지 않는다(F-6). */
  it('이 공정의 구성 행이 아예 없으면 닫힌 것과 같이 다룬다', async () => {
    renderScreen({ noProcessRow: true });

    expect(await screen.findByText(t.disabled.denied)).toBeInTheDocument();
  });

  /* 「확인할 수 없다」와 「권한이 없다」는 작업자가 할 일이 다르다(G-3). */
  it('게이팅 조회가 실패하면 다른 문장과 다시 시도 경로를 준다', async () => {
    renderScreen({ gateFails: true });

    expect(await screen.findByText(t.disabled.unavailable)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.retry })).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('단말을 모르면 사유를 말하고 막는다', async () => {
    renderScreen({}, { terminalId: null, processes: null, equipment: null, workerNo: WORKER_NO });

    expect(await screen.findByText(t.disabled.unidentified)).toBeInTheDocument();
    expect(screen.getByText(t.header.terminalUnknown)).toBeInTheDocument();
  });

  it('사번을 모르면 사유를 말하고 막는다', async () => {
    renderScreen(
      {},
      {
        terminalId: TERMINAL_ID,
        processes: [{ processId: PROCESS_ID }],
        equipment: null,
        workerNo: null,
      },
    );

    expect(await screen.findByText(t.disabled.workerMissing)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });
});

describe('러닝체인지 화면 — 교체 대상 모집단', () => {
  /*
   * C-3 — 고를 수 있는 것은 **《현재 투입》에 선 줄뿐**이다. 모집단이 다른 데서 오면 이
   * 작업지시에 없는 투입을 교체 대상으로 지목하게 되고, 교체는 지우지 않고 잇는 것이라
   * 그 잘못이 그대로 계보에 남는다(§5-2).
   */
  it('고를 수 있는 것은 현재 투입에 선 줄뿐이다', async () => {
    const user = userEvent.setup();
    renderScreen({
      inputs: [
        makeConsumption(),
        makeConsumption({ materialConsumptionId: 55009, lotId: makeLot().lotId }),
      ],
    });

    await screen.findByText(OLD_LOT_NO);
    await user.click(screen.getByLabelText(t.replace.targetLabel));

    const names = (await screen.findAllByRole('option')).map((option) => option.textContent ?? '');
    expect(names).toHaveLength(2);
    /* 줄마다 그 줄의 LOT 이 선다 — 목록이 다른 데서 오면 이 짝이 어긋난다. */
    expect(names[0]).toContain(OLD_LOT_NO);
    expect(names[1]).toContain(NEW_LOT_NO);
  });

  /* #1045 — 현장은 `INSPECTION_PENDING` 이 무엇인지도, 무엇을 하면 풀리는지도 모른다. */
  it('보류 칩을 공통코드 표시명으로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({ heldPart: true });

    await screen.findByText(OLD_LOT_NO);
    await user.type(screen.getByLabelText(t.scan.label), `${NEW_LOT_NO}{Enter}`);

    expect(await screen.findByText(LOT_STATUS_VALUE.codeName)).toBeInTheDocument();
    expect(screen.queryByText(LOT_STATUS_VALUE.code)).not.toBeInTheDocument();
  });

  /* 폐기된 상태가 붙은 옛 LOT 도 이름으로 읽혀야 한다 — 이름을 푸는 조회는 좁히지 않는다. */
  it('미사용으로 바뀐 상태도 표시명으로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({ heldPart: true, inactiveLotStatus: true });

    await screen.findByText(OLD_LOT_NO);
    await user.type(screen.getByLabelText(t.scan.label), `${NEW_LOT_NO}{Enter}`);

    expect(await screen.findByText(LOT_STATUS_VALUE.codeName)).toBeInTheDocument();
  });

  /* 표시명을 못 받았을 때만 코드를 보이되, 없다는 사실을 함께 적는다 — 이름을 지어내지 않는다. */
  it('표시명을 못 받으면 코드와 함께 표시명이 없다고 적는다', async () => {
    const user = userEvent.setup();
    renderScreen({ heldPart: true, noLotStatuses: true });

    await screen.findByText(OLD_LOT_NO);
    await user.type(screen.getByLabelText(t.scan.label), `${NEW_LOT_NO}{Enter}`);

    expect(
      await screen.findByText(t.replace.statusUnknown(LOT_STATUS_VALUE.code)),
    ).toBeInTheDocument();
  });

  /* #1046 — 화살표 양쪽이 같은 값이면 무엇이 무엇으로 바뀌는지 읽히지 않는다. */
  it('읽은 코드가 곧 LOT 번호면 번호를 한 번만 적는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText(OLD_LOT_NO);
    await user.type(screen.getByLabelText(t.scan.label), `${NEW_LOT_NO}{Enter}`);

    expect(await screen.findByText(t.scan.outcomes.part(NEW_LOT_NO))).toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  /* 읽은 것과 찾은 것이 다를 때는 둘을 함께 적어야 잘못 걸린 것을 알아볼 수 있다. */
  it('부분 검색으로 다른 번호가 걸리면 읽은 코드와 찾은 번호를 함께 적는다', async () => {
    const user = userEvent.setup();
    renderScreen({ partialOnly: true });

    await screen.findByText(OLD_LOT_NO);
    await user.type(screen.getByLabelText(t.scan.label), 'EXT-0031{Enter}');

    expect(
      await screen.findByText(t.scan.outcomes.partResolved('EXT-0031', NEW_LOT_NO)),
    ).toBeInTheDocument();
  });

  it('현재 투입이 비면 고를 것이 없고 등록도 막힌다', async () => {
    renderScreen({ inputs: [] });

    expect(await screen.findByText(t.current.empty)).toBeInTheDocument();
    expect(screen.getByLabelText(t.replace.targetLabel)).toBeDisabled();
    expect(submitButton()).toBeDisabled();
  });
});

describe('러닝체인지 화면 — 교체 등록', () => {
  it('교체 대상을 고르기 전에는 등록이 막힌다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText(OLD_LOT_NO);
    await user.type(screen.getByLabelText(t.scan.label), `${NEW_LOT_NO}{Enter}`);
    await screen.findByText(t.scan.outcomes.part(NEW_LOT_NO));

    expect(screen.getByText(t.disabled.targetMissing)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('교체 대상과 멱등 키·사번 헤더를 실어 한 건을 보낸다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes });

    await fillReplacement(user);
    await user.click(submitButton());

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0];
    expect(request?.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(request?.headers.get('Idempotency-Key')).toBeTruthy();

    const body = (await request?.json()) as Record<string, unknown>;
    expect(body.replacedConsumptionId).toBe(OLD_CONSUMPTION_ID);
    expect(body.inputQty).toBe(120);
    expect(body.workSessionId).toBe(WORK_SESSION_ID);
    expect(body).not.toHaveProperty('consumptionTypeCode');
    expect(body).not.toHaveProperty('changeReasonCode');
  });

  /* C-1 #2·#4 — 담는 것이 곧 성공이고, 미전송 건수가 그 결정의 전제다. */
  it('담자마자 성공을 말하고 미전송 건수를 헤더가 낸다', async () => {
    const user = userEvent.setup();
    renderScreen({ writeStatus: 500 });

    await fillReplacement(user);
    await user.click(submitButton());

    expect(await screen.findByText(t.replace.recorded)).toBeInTheDocument();
  });

  it('서버가 거부하면 그 사유를 낸다', async () => {
    const user = userEvent.setup();
    renderScreen({ writeStatus: 400 });

    await fillReplacement(user);
    await user.click(submitButton());

    expect(await screen.findByText(t.replace.rejected)).toBeInTheDocument();
  });

  /*
   * C-1 #4 — 미전송 건수는 **선택이 아니라 필수 요건**이다. 「담는 것이 곧 성공」을 택한
   * 결정의 전제가 이 표시라, 없으면 서버에 닿지 않은 사실을 알 방법이 사라진다.
   */
  it('서버에 닿지 못하면 미전송 건수가 헤더에 선다', async () => {
    const user = userEvent.setup();
    renderScreen({ writeFails: true });

    await fillReplacement(user);
    await user.click(submitButton());

    expect(await screen.findByText(t.header.unsynced(1))).toBeInTheDocument();
  });

  /*
   * ⛔ 지난 회차의 거부가 이 회차에 남으면 **방금 담은 교체가 거부된 것으로 읽힌다.**
   * 되돌릴 수 없는 기록 앞에서 그 오독은 작업자를 헛되이 다시 등록하게 만든다.
   */
  it('다시 읽기 시작하면 지난 회차의 거부 배너가 사라진다', async () => {
    const user = userEvent.setup();
    renderScreen({ writeStatus: 400 });

    await fillReplacement(user);
    await user.click(submitButton());
    expect(await screen.findByText(t.replace.rejected)).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.scan.label), `${NEW_LOT_NO}{Enter}`);

    await waitFor(() => {
      expect(screen.queryByText(t.replace.rejected)).not.toBeInTheDocument();
    });
  });

  /*
   * ⛔ 집지 못한 재스캔이 앞 부품을 남겨 두면, 화면이 「고르지 않는다」고 해 놓고 앞 회차의
   * 선택을 유지하는 방식으로 **사실상 고른다** — 그대로 누르면 엉뚱한 부품이 계보에 실린다.
   */
  it('다시 읽어 집지 못하면 앞서 담은 부품이 남지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(screen.getByLabelText(t.scan.label), `${NEW_LOT_NO}{Enter}`);
    await screen.findByText(t.scan.outcomes.part(NEW_LOT_NO));

    await user.type(screen.getByLabelText(t.scan.label), 'LOT-SAMPLE-NONE{Enter}');
    await screen.findByText(t.scan.outcomes.notFound('LOT-SAMPLE-NONE'));

    expect(screen.getByText(t.replace.partNone)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('담은 뒤에는 이 회차의 입력이 비워져 같은 교체가 두 번 담기지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes });

    await fillReplacement(user);
    await user.click(submitButton());

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    expect(screen.getByText(t.replace.partNone)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });
});
