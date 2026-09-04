import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
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
  processId: PROCESS_ID,
  workerNo: WORKER_NO,
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

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
  /** 교체 등록 요청을 담아 둔다 */
  writes?: Request[];
  /** 교체 등록 응답 상태. 기본 201 */
  writeStatus?: number;
  /** 교체 등록이 **통신 실패**한다. 거부와 달리 큐에 남는다 */
  writeFails?: boolean;
}

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
        return jsonResponse({ items: [makeLot()], page: { page: 1, size: 20, total: 1 } });
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
  await user.type(screen.getByLabelText(t.scan.label), NEW_LOT_NO);
  await user.click(screen.getByRole('button', { name: t.scan.submit }));
  await screen.findByText(t.scan.outcomes.part(NEW_LOT_NO, NEW_LOT_NO));

  await user.click(screen.getByLabelText(t.replace.targetLabel));
  await user.click(await screen.findByRole('option', { name: /ITEM-SAMPLE/ }));

  await user.type(screen.getByLabelText(t.replace.qtyLabel), '120');
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

  /* 값 목록이 확정 전이다(omf-mes#397 ②) — 감추지 않고 사유를 말한다. */
  it('교체 사유는 고를 수 없는 상태로 사유와 함께 선다', async () => {
    renderScreen();

    expect(await screen.findByText(t.replace.reasonUnavailable)).toBeInTheDocument();
    expect(screen.getByLabelText(t.replace.reasonLabel)).toBeDisabled();
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
    renderScreen({}, { terminalId: null, processId: null, workerNo: WORKER_NO });

    expect(await screen.findByText(t.disabled.unidentified)).toBeInTheDocument();
    expect(screen.getByText(t.header.terminalUnknown)).toBeInTheDocument();
  });

  it('사번을 모르면 사유를 말하고 막는다', async () => {
    renderScreen({}, { terminalId: TERMINAL_ID, processId: PROCESS_ID, workerNo: null });

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
    await user.type(screen.getByLabelText(t.scan.label), NEW_LOT_NO);
    await user.click(screen.getByRole('button', { name: t.scan.submit }));
    await screen.findByText(t.scan.outcomes.part(NEW_LOT_NO, NEW_LOT_NO));

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

    await user.type(screen.getByLabelText(t.scan.label), NEW_LOT_NO);
    await user.click(screen.getByRole('button', { name: t.scan.submit }));

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

    await user.type(screen.getByLabelText(t.scan.label), NEW_LOT_NO);
    await user.click(screen.getByRole('button', { name: t.scan.submit }));
    await screen.findByText(t.scan.outcomes.part(NEW_LOT_NO, NEW_LOT_NO));

    await user.type(screen.getByLabelText(t.scan.label), 'LOT-SAMPLE-NONE');
    await user.click(screen.getByRole('button', { name: t.scan.submit }));
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
