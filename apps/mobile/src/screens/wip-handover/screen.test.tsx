import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { WipHandoverScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const page = { page: 0, size: 50, totalElements: 0, totalPages: 1 };

const LOT_NO = 'PLOT-2026-0805-0031';

const lot = (overrides: Record<string, unknown> = {}) => ({
  lotId: 4,
  lotNo: LOT_NO,
  itemId: 31,
  lotTypeCode: 'PRODUCTION',
  plantId: 1,
  initialQty: 500,
  uomId: 9,
  sourceTypeCode: 'WORK_ORDER',
  sourceId: 13,
  statusCode: 'NORMAL',
  completedAt: '2026-08-11T17:40:00+09:00',
  held: false,
  ...overrides,
});

const workOrder = (overrides: Record<string, unknown> = {}) => ({
  workOrderId: 27,
  workOrderNo: 'WO-2026-0027',
  productionPlanId: 1,
  routingOperationId: 2,
  itemId: 31,
  orderQty: 500,
  uomId: 9,
  workOrderTypeCode: 'NORMAL',
  priorityNo: 1,
  statusCode: 'RELEASED',
  releasedAt: '2026-08-10T09:00:00+09:00',
  routingOperationName: '조립 2호',
  ...overrides,
});

interface Options {
  lots?: ReturnType<typeof lot>[];
  successors?: ReturnType<typeof workOrder>[];
  seen?: Request[];
  /** 실제로 만들어 낸 양. 넘길 수 있는 상한이 이것이다. */
  goodQty?: number | null;
  /** 인계 확정을 실패시킨다. 재시도 경로를 밟기 위한 것이다. */
  failConfirm?: boolean;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/trace/lots',
    respond: (req) => {
      const lotNo = new URL(req.url).searchParams.get('lotNo');
      const all = options.lots ?? [lot()];

      return jsonResponse({
        items: all.filter((each) => lotNo === null || each.lotNo === lotNo),
        page,
      });
    },
  },
  {
    match: (req) => /^\/trace\/lots\/\d+$/.test(new URL(req.url).pathname),
    respond: (req) => {
      const id = Number(new URL(req.url).pathname.split('/').pop());
      const found = (options.lots ?? [lot()]).find((each) => each.lotId === id);
      const good = options.goodQty === undefined ? 500 : options.goodQty;

      return jsonResponse({
        lot:
          good === null
            ? found
            : {
                ...found,
                progress: {
                  goodQty: good,
                  achievementRate: 1,
                  varianceQty: 0,
                  completionJudgmentCode: 'NORMAL',
                },
              },
        externalIdentifiers: [],
        holds: [],
      });
    },
  },
  {
    match: (req) =>
      new URL(req.url).pathname === '/production/work-orders' && req.method === 'GET',
    respond: (req) => {
      options.seen?.push(req.clone());
      return jsonResponse({ items: options.successors ?? [workOrder()], page });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/production/operation-handovers',
    respond: (req) => {
      options.seen?.push(req.clone());

      if (options.failConfirm === true) {
        return jsonResponse({ code: 'SERVER_ERROR', message: '실패' }, { status: 500 });
      }

      return jsonResponse({ operationHandoverId: 1, handoverNo: 'OH-1' }, { status: 201 });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({ items: [{ itemId: 31, itemCode: 'ABC-123', itemName: '완제품A' }], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 9, uomCode: 'EA' }], page }),
  },
];

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn({ workerNo: '900028', workerName: '김철수' });
    }
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (options: Options = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <WipHandoverScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch(routes(options)) },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText('LOT 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const goOffline = () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
};

beforeEach(() => {
  store.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WIP 공정 이동 화면', () => {
  /*
   * 스캔은 연속 작업이라, 다 해 놓고 저장에서 막히면 작업을 통째로 버린다. 진입 자체를
   * 막고 왜 막는지를 함께 적는다.
   */
  it('연결이 없으면 진입을 막고 이유를 적는다', async () => {
    goOffline();
    mount();

    expect(await screen.findByText('연결이 필요한 작업입니다')).toBeTruthy();
    expect(screen.queryByLabelText('LOT 스캔')).toBeNull();
  });

  it('스캔한 LOT 과 다음 공정 후보를 보인다', async () => {
    mount();
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);

    expect(await screen.findByText(LOT_NO)).toBeTruthy();
    expect(await screen.findByRole('combobox', { name: '인계할 공정' })).toBeTruthy();
  });

  /* 서버가 공정 의존을 푼다. 화면이 라우팅을 걸어 맞추지 않는다. */
  it('출발 W/O 의 후속만 묻는다', async () => {
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);
    await screen.findByText(LOT_NO);

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });

    expect(new URL(seen[0]!.url).searchParams.get('successorOfWorkOrderId')).toBe('13');
  });

  it('완료되지 않은 LOT 은 막고 다음 공정을 묻지 않는다', async () => {
    const seen: Request[] = [];
    mount({ lots: [lot({ completedAt: null })], seen });
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);

    expect(await screen.findByText('생산 완료 처리가 필요합니다')).toBeTruthy();
    expect(seen).toHaveLength(0);
  });

  /* 다음 공정이 홀드품을 투입하면 불량이 퍼진다. 막는 근거를 함께 적는다. */
  it('홀드 중인 LOT 은 막고 근거를 적는다', async () => {
    mount({ lots: [lot({ held: true })] });
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);

    expect(await screen.findByText('홀드 중인 LOT 입니다')).toBeTruthy();
    expect(
      screen.getByText('다음 공정이 홀드품을 투입하면 불량이 퍼집니다. 보류를 먼저 푸세요.'),
    ).toBeTruthy();
  });

  it('생산LOT 이 아니면 막는다', async () => {
    mount({ lots: [lot({ lotTypeCode: 'MATERIAL' })] });
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);

    expect(
      await screen.findByText('생산LOT이 아닙니다. 공정 인계는 생산LOT만 넘깁니다.'),
    ).toBeTruthy();
  });

  /* 최종 공정이면 다음이 없다. 오류가 아니라 여기서 끝났다는 뜻이다. */
  it('후속이 없으면 없다고 말한다', async () => {
    mount({ successors: [] });
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);

    expect(
      await screen.findByText('다음 공정이 없습니다. 최종 공정이면 출하로 갑니다.'),
    ).toBeTruthy();
  });

  /* 배포 시각으로 가른다. 막지 않고 경고만 한다. */
  it('아직 배포되지 않은 공정을 고르면 경고하되 막지 않는다', async () => {
    const user = userEvent.setup();
    mount({ successors: [workOrder({ releasedAt: undefined })] });
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);
    await screen.findByText(LOT_NO);

    await user.click(await screen.findByRole('combobox', { name: '인계할 공정' }));
    await user.click(await screen.findByRole('option', { name: '조립 2호 (WO-2026-0027)' }));
    await user.type(screen.getByLabelText('인계 수량'), '100');

    expect(
      await screen.findByText('아직 배포되지 않은 공정입니다. 미리 보낼 수 있습니다.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '인계 확정' })).not.toBeDisabled();
  });

  it('완료 수량을 넘으면 막는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);
    await screen.findByText(LOT_NO);

    await user.click(await screen.findByRole('combobox', { name: '인계할 공정' }));
    await user.click(await screen.findByRole('option', { name: '조립 2호 (WO-2026-0027)' }));
    await user.type(screen.getByLabelText('인계 수량'), '501');

    expect(
      await screen.findByText('완료 수량 500 EA 을(를) 넘을 수 없습니다'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '인계 확정' })).toBeDisabled();
  });

  /*
   * 초기 수량은 계획이다. 미달 마감된 LOT 을 계획으로 재면 만들지 않은 양까지 넘어간다.
   */
  it('상한을 계획이 아니라 실제로 만든 양으로 잡는다', async () => {
    const user = userEvent.setup();
    mount({ goodQty: 430 });
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);
    await screen.findByText(LOT_NO);

    expect(await screen.findByText('완료 수량 430 EA')).toBeTruthy();

    await user.click(await screen.findByRole('combobox', { name: '인계할 공정' }));
    await user.click(await screen.findByRole('option', { name: '조립 2호 (WO-2026-0027)' }));
    await user.type(screen.getByLabelText('인계 수량'), '440');

    expect(await screen.findByText('완료 수량 430 EA 을(를) 넘을 수 없습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '인계 확정' })).toBeDisabled();
  });

  /* 넉넉한 쪽으로 물러서지 않는다 - 되돌릴 수 없는 쓰기다. */
  it('완료 수량을 못 받으면 인계할 수 없다고 말한다', async () => {
    mount({ goodQty: null });
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);

    expect(await screen.findByText('완료 수량을 확인할 수 없어 인계할 수 없습니다')).toBeTruthy();
  });

  /*
   * 본 단추는 막혀 있는데 오류 배너 안의 재시도만 열려 있었다. 실패한 뒤 수량을 상한 위로
   * 고쳐 놓고 누르면 그 값이 그대로 나간다.
   */
  it('다시 보내기도 수량 검증을 지난다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen, goodQty: 430, failConfirm: true });
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);
    await screen.findByText(LOT_NO);
    await user.click(await screen.findByRole('combobox', { name: '인계할 공정' }));
    await user.click(await screen.findByRole('option', { name: '조립 2호 (WO-2026-0027)' }));

    const qty = screen.getByLabelText('인계 수량');
    await user.type(qty, '100');
    await user.click(screen.getByRole('button', { name: '인계 확정' }));
    await screen.findByText('인계하지 못했습니다');

    /* 실패한 뒤 상한을 넘긴 값으로 고친다. 본 단추는 막히고, 재시도도 막혀야 한다. */
    await user.clear(qty);
    await user.type(qty, '9999');
    await screen.findByText('완료 수량 430 EA 을(를) 넘을 수 없습니다');

    await user.click(screen.getByRole('button', { name: '다시 보내기' }));

    const posted = seen.filter((each) => each.method === 'POST');
    expect(posted).toHaveLength(1);
  });

  it('확정하면 출발·도착 W/O 와 사번을 싣는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);
    await screen.findByText(LOT_NO);

    await user.click(await screen.findByRole('combobox', { name: '인계할 공정' }));
    await user.click(await screen.findByRole('option', { name: '조립 2호 (WO-2026-0027)' }));
    await user.type(screen.getByLabelText('인계 수량'), '100');
    await user.click(screen.getByRole('button', { name: '인계 확정' }));

    expect(await screen.findByText('인계했습니다')).toBeTruthy();

    const posted = seen.find((each) => each.method === 'POST');
    const body = (await posted!.json()) as {
      fromWorkOrderId: number;
      toWorkOrderId: number;
      lines: { lotId: number; handoverQty: number }[];
    };

    expect(body.fromWorkOrderId).toBe(13);
    expect(body.toWorkOrderId).toBe(27);
    expect(body.lines).toEqual([{ lotId: 4, handoverQty: 100, uomId: 9 }]);
    expect(posted!.headers.get('X-Worker-No')).toBe('900028');
    expect(posted!.headers.get('Idempotency-Key')).toBeTruthy();
  });

  /* 받는 쪽 화면이 없다. 기다릴 것이 없다는 것을 말한다. */
  it('수령도 함께 기록됐다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 스캔');

    scan(LOT_NO);
    await screen.findByText(LOT_NO);

    await user.click(await screen.findByRole('combobox', { name: '인계할 공정' }));
    await user.click(await screen.findByRole('option', { name: '조립 2호 (WO-2026-0027)' }));
    await user.type(screen.getByLabelText('인계 수량'), '100');
    await user.click(screen.getByRole('button', { name: '인계 확정' }));

    expect(
      await screen.findByText('수령도 함께 기록됐습니다. 받는 쪽에서 따로 확인할 것이 없습니다.'),
    ).toBeTruthy();
  });
});
