import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { MaterialPickingScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());

/** 보관소 읽기를 한 열쇠에서만 붙잡아 둔다. 큐를 아직 모르는 사이를 재는 시험이 쓴다. */
const held = vi.hoisted(() => ({
  key: null as string | null,
  release: null as (() => void) | null,
  failWrite: null as string | null,
}));

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => {
    if (held.key !== key) {
      return Promise.resolve(store.get(key) ?? null);
    }

    return new Promise<string | null>((resolve) => {
      held.release = () => {
        held.key = null;
        resolve(store.get(key) ?? null);
      };
    });
  },
  writeLocal: (key: string, value: string) => {
    if (held.failWrite === key) {
      return Promise.reject(new Error('보관소가 가득 찼습니다'));
    }

    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const page = { page: 0, size: 20, totalElements: 1, totalPages: 1 };

const LOT_NO = '0001234500000012002607310001230007';

const WORKER_NO = '100027';

const line = (overrides: Record<string, unknown> = {}) => ({
  pickingLineId: 41,
  pickingOrderId: 7,
  lineNo: 1,
  itemId: 31,
  lotId: 4,
  locationId: 21,
  plannedQty: 200,
  pickedQty: 0,
  uomId: 9,
  statusCode: 'ASSIGNED',
  held: false,
  itemCode: 'ABC-123',
  itemName: '하우징 커버 A',
  lotNo: LOT_NO,
  locationCode: 'A-01-03',
  pickSequenceRank: 1,
  ...overrides,
});

const order = {
  pickingOrderId: 7,
  pickingOrderNo: 'PK-2026-000077',
  pickingTypeCode: 'PRODUCTION',
  sourceDocumentTypeCode: 'MATERIAL_ISSUE_REQUEST',
  sourceDocumentId: 3,
  warehouseId: 11,
  statusCode: 'ASSIGNED',
};

const codeValue = (code: string, nameKo: string, displayOrder: number) => ({
  code,
  codeName: code,
  nameKo,
  displayOrder,
  isActive: true,
});

const secondLine = () =>
  line({
    pickingLineId: 42,
    lineNo: 2,
    itemCode: 'ABC-124',
    itemName: '하우징 커버 B',
    pickSequenceRank: 2,
  });

/** 보내기 한 번이 어떻게 끝나는지. 오프라인·거부·성공을 시험마다 갈아 끼운다. */
type Behaviour = 'ok' | 'offline' | 'rejected';

interface Options {
  lines?: ReturnType<typeof line>[];
  pick?: Behaviour;
  issue?: Behaviour;
  issueTypes?: unknown[];
}

const rest = (options: Options, serverPicked: Map<number, number>): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/mdm/workers',
    respond: () =>
      jsonResponse({
        items: [{ workerId: 501, workerNo: WORKER_NO, workerName: '홍길동' }],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/logistics/picking-orders',
    respond: () => jsonResponse({ items: [order], page }),
  },
  {
    /* 보낸 피킹을 서버가 기억한다. 기억하지 않으면 다시 조회해도 안 집은 값이 돌아온다. */
    match: (req) => new URL(req.url).pathname === '/logistics/picking-orders/7',
    respond: () =>
      jsonResponse({
        pickingOrder: order,
        lines: (options.lines ?? [line()]).map((each) => ({
          ...each,
          pickedQty: each.pickedQty + (serverPicked.get(each.pickingLineId) ?? 0),
        })),
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/code-values',
    respond: () =>
      jsonResponse({
        items: options.issueTypes ?? [
          codeValue('SCRAP', '폐기 출고', 1),
          codeValue('PRODUCTION', '생산 투입', 2),
        ],
        page,
      }),
  },
];

const respondWith = (behaviour: Behaviour, body: unknown, seen: Request[], request: Request) => {
  seen.push(request.clone());

  if (behaviour === 'offline') {
    throw new TypeError('Failed to fetch');
  }

  return behaviour === 'rejected'
    ? jsonResponse({ code: 'INVALID_STATE', message: '보류' }, { status: 400 })
    : jsonResponse(body, { status: 201 });
};

const PICK_LINE = /\/lines\/(\d+):pick$/;

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn({ workerNo: WORKER_NO, workerName: '홍길동' });
    }
  }, [signIn, worker]);

  return worker === null ? null : children;
};

interface Mounted {
  picks: Request[];
  issues: Request[];
  /** 시험 도중에 갈아 끼운다 - 오프라인에 담아 둔 뒤 다시 붙었을 때를 재기 위해서다. */
  set: (next: { pick?: Behaviour; issue?: Behaviour; rejectNextPicks?: number }) => void;
  /** 다음 응답을 붙잡아 둔다. 아직 보내는 중인 상태를 재는 시험이 쓴다. */
  holdNextPick: () => void;
  releasePick: () => void;
  holdNextIssue: () => void;
  releaseIssue: () => void;
}

const mount = (options: Options = {}): Mounted => {
  const picks: Request[] = [];
  const issues: Request[] = [];
  const serverPicked = new Map<number, number>();
  const current = {
    pick: options.pick ?? 'ok',
    issue: options.issue ?? 'ok',
    rejectNextPicks: 0,
    hold: false,
    holdIssue: false,
  };
  let release: (() => void) | null = null;
  let releaseIssue: (() => void) | null = null;

  const answerPick = async (req: Request): Promise<Response> => {
    const held = current.hold ? new Promise<void>((resolve) => (release = resolve)) : null;

    current.hold = false;

    const lineId = Number(PICK_LINE.exec(new URL(req.url).pathname)?.[1] ?? Number.NaN);
    const body = (await req.clone().json()) as { pickedQty: number };
    const behaviour =
      current.rejectNextPicks > 0 ? ('rejected' as Behaviour) : (current.pick as Behaviour);

    if (current.rejectNextPicks > 0) {
      current.rejectNextPicks -= 1;
    }

    if (held !== null) {
      await held;
    }

    if (behaviour === 'ok') {
      serverPicked.set(lineId, (serverPicked.get(lineId) ?? 0) + body.pickedQty);
    }

    return respondWith(behaviour, line({ pickingLineId: lineId }), picks, req);
  };

  const routes: StubRoute[] = [
    {
      match: (req) => PICK_LINE.test(new URL(req.url).pathname) && req.method === 'POST',
      respond: (req) => answerPick(req),
    },
    {
      match: (req) =>
        new URL(req.url).pathname === '/logistics/goods-issues' && req.method === 'POST',
      respond: async (req) => {
        const waiting = current.holdIssue
          ? new Promise<void>((resolve) => (releaseIssue = resolve))
          : null;

        current.holdIssue = false;

        if (waiting !== null) {
          await waiting;
        }

        return respondWith(current.issue, { goodsIssueId: 900 }, issues, req);
      },
    },
    ...rest(options, serverPicked),
  ];

  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <MaterialPickingScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch(routes) },
  );

  return {
    picks,
    issues,
    set: (next) => {
      Object.assign(current, next);
    },
    holdNextPick: () => {
      current.hold = true;
    },
    releasePick: () => {
      release?.();
      release = null;
    },
    holdNextIssue: () => {
      current.holdIssue = true;
    },
    releaseIssue: () => {
      releaseIssue?.();
      releaseIssue = null;
    },
  };
};

const chooseOrder = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /PK-2026-000077/ }));
  await screen.findByRole('button', { name: /ABC-123/ });
};

/** 스캔이 실패했을 때의 길이 손 입력이다. 시험은 그 길로 같은 값을 넣는다. */
const pickLine = async (user: ReturnType<typeof userEvent.setup>, qty: string) => {
  await user.click(screen.getByRole('button', { name: /ABC-123/ }));
  await user.type(await screen.findByLabelText('직접 입력'), LOT_NO);
  await user.click(screen.getByRole('button', { name: '넣기' }));
  await screen.findByText('라인의 LOT 과 같습니다');
  await user.type(screen.getByLabelText('출고 수량'), qty);
  await user.click(screen.getByRole('button', { name: '이 라인 피킹' }));
};

const chooseIssueType = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('combobox', { name: '출고 유형' }));
  await user.click(await screen.findByRole('option', { name: '생산 투입' }));
};

beforeEach(() => {
  store.clear();
  held.key = null;
  held.release = null;
  held.failWrite = null;
});

describe('자재 출고·피킹 화면', () => {
  it('집으면 라인 경로로 사번과 멱등키를 실어 보낸다', async () => {
    const user = userEvent.setup();
    const sent = mount();
    await chooseOrder(user);
    await pickLine(user, '50');

    expect(await screen.findByText('집었습니다')).toBeTruthy();
    await waitFor(() => {
      expect(sent.picks).toHaveLength(1);
    });
    expect(sent.picks[0]?.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(sent.picks[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(await sent.picks[0]?.json()).toMatchObject({ pickedQty: 50, lotId: 4 });
  });

  /*
   * 담긴 것을 서버가 모르는 채로 두면 화면이 안 집은 것으로 보인다. 작업자는 같은 라인을 다시
   * 집고 큐에 두 건이 쌓여 둘 다 나간다 - 되돌릴 수 없는 재고 차감이다.
   */
  it('오프라인에서 집으면 미확정으로 보이고 남은 요청이 준다', async () => {
    const user = userEvent.setup();
    mount({ pick: 'offline' });
    await chooseOrder(user);
    await pickLine(user, '50');

    expect(await screen.findByText('피킹을 담아 두었습니다')).toBeTruthy();
    expect(await screen.findByText('50 미확정 — 아직 서버에 없습니다')).toBeTruthy();
    expect(screen.getByText('요청 200 / 피킹 50')).toBeTruthy();
  });

  it('담아 둔 것까지 계획을 채웠으면 그 라인을 다시 집을 수 없다', async () => {
    const user = userEvent.setup();
    mount({ pick: 'offline' });
    await chooseOrder(user);
    await pickLine(user, '200');

    expect(await screen.findByText('다 집었습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: /ABC-123/ }).hasAttribute('disabled')).toBe(true);
  });

  /* 서버가 아는 것만 세면 오프라인에서 확정이 영영 열리지 않는다. */
  it('오프라인에 담아 둔 것만 있어도 출고를 확정할 수 있다', async () => {
    const user = userEvent.setup();
    const sent = mount({ pick: 'offline', issue: 'offline' });
    await chooseOrder(user);
    await chooseIssueType(user);

    expect(screen.getByRole('button', { name: '출고 확정' }).hasAttribute('disabled')).toBe(true);

    await pickLine(user, '50');
    await screen.findByText('피킹을 담아 두었습니다');

    const submit = screen.getByRole('button', { name: '출고 확정' });

    expect(submit.hasAttribute('disabled')).toBe(false);

    await user.click(submit);

    expect(await screen.findByText('출고를 담아 두었습니다')).toBeTruthy();
    expect(sent.issues).toHaveLength(0);
  });

  /* 서버는 담긴 피킹을 아직 모른다. 그 만큼을 빼고 실으면 집은 것이 나가지 않는다. */
  it('담아 둔 만큼을 출고에 합쳐 싣는다', async () => {
    const user = userEvent.setup();
    const sent = mount({ pick: 'offline' });
    await chooseOrder(user);
    await pickLine(user, '50');
    await screen.findByText('피킹을 담아 두었습니다');

    sent.set({ pick: 'ok' });
    await chooseIssueType(user);
    await user.click(screen.getByRole('button', { name: '출고 확정' }));

    await waitFor(() => {
      expect(sent.issues).toHaveLength(1);
    });
    expect(await sent.issues[0]?.json()).toMatchObject({
      issueTypeCode: 'PRODUCTION',
      lines: [{ pickingLineId: 41, issueQty: 50 }],
    });
  });

  /* 거부를 조용히 넘기면 왜 안 집혔는지 알 수 없고, 작업자는 집힌 줄 안다. */
  it('피킹이 거부되면 사유를 말하고 되돌아온 기록으로 가는 길을 낸다', async () => {
    const user = userEvent.setup();
    mount({ pick: 'rejected' });
    await chooseOrder(user);
    await pickLine(user, '50');

    expect(await screen.findByText('피킹이 되돌아왔습니다')).toBeTruthy();
    expect(await screen.findByText('이 지시에서 되돌아온 건 1')).toBeTruthy();
    expect(screen.getByRole('link', { name: '되돌아온 건 보기' })).toBeTruthy();
    expect(screen.queryByText('집었습니다')).toBeNull();
  });

  /*
   * 출고가 피킹의 결과를 싣는다. 묶지 않으면 피킹이 거부돼도 출고가 그대로 나가 집지 않은
   * 것이 나간 것으로 기록된다.
   */
  it('피킹이 거부되면 딸린 출고도 함께 되돌아간다', async () => {
    const user = userEvent.setup();
    const sent = mount({ pick: 'offline' });
    await chooseOrder(user);
    await pickLine(user, '50');
    await screen.findByText('피킹을 담아 두었습니다');

    sent.set({ pick: 'rejected' });
    await chooseIssueType(user);
    await user.click(screen.getByRole('button', { name: '출고 확정' }));

    expect(await screen.findByText('출고가 되돌아왔습니다')).toBeTruthy();
    expect(sent.issues).toHaveLength(0);
  });

  /* 목록의 첫 값을 조용히 쓰면 틀린 값을 소리 없이 보내는 것과 같다. */
  it('출고 유형을 고르기 전에는 확정을 막는다', async () => {
    const user = userEvent.setup();
    mount({ lines: [line({ pickedQty: 120 })] });
    await chooseOrder(user);

    expect(screen.getByRole('button', { name: '출고 확정' }).hasAttribute('disabled')).toBe(true);

    await chooseIssueType(user);

    expect(screen.getByRole('button', { name: '출고 확정' }).hasAttribute('disabled')).toBe(false);
  });

  /*
   * 담긴 출고는 서버에 없어 다시 조회해도 나타나지 않는다. 확정 단추가 다시 열리면 같은 지시가
   * 두 건으로 나가고, 멱등키가 달라 서버도 흡수하지 못한다 - 재고가 두 번 깎인다.
   */
  it('확정한 뒤 같은 지시를 다시 열어도 출고를 두 번 담지 않는다', async () => {
    const user = userEvent.setup();
    const sent = mount({ pick: 'offline', issue: 'offline' });
    await chooseOrder(user);
    await pickLine(user, '50');
    await screen.findByText('피킹을 담아 두었습니다');
    await chooseIssueType(user);
    await user.click(screen.getByRole('button', { name: '출고 확정' }));
    await screen.findByText('출고를 담아 두었습니다');

    await user.click(screen.getByRole('button', { name: '다음 지시' }));
    await chooseOrder(user);
    await chooseIssueType(user);

    expect(
      await screen.findByText('이 지시의 출고가 이미 담겨 있습니다. 연결되면 나갑니다.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '출고 확정' }).hasAttribute('disabled')).toBe(true);
    expect(sent.issues).toHaveLength(0);
  });

  /*
   * 셸이 스스로 큐를 비운다. 그때 다시 조회하지 않으면 담긴 것이 셈에서 빠진 자리에 서버가 아직
   * 모르는 값이 남아, 화면이 안 집은 것으로 되돌아간다 - 작업자는 같은 라인을 다시 집는다.
   */
  it('셸이 스스로 큐를 비우면 화면이 서버 값으로 갱신된다', async () => {
    const user = userEvent.setup();
    const sent = mount({ pick: 'offline' });
    await chooseOrder(user);
    await pickLine(user, '50');
    await screen.findByText('50 미확정 — 아직 서버에 없습니다');

    sent.set({ pick: 'ok' });
    window.dispatchEvent(new Event('online'));

    /* 담긴 것이 빠진 자리에 서버 값이 들어와야 한다. 안 그러면 피킹 0 으로 되돌아간다. */
    await waitFor(() => {
      expect(screen.getByText('요청 200 / 피킹 50')).toBeTruthy();
      expect(screen.queryByText('50 미확정 — 아직 서버에 없습니다')).toBeNull();
    });
  });

  /*
   * 큐가 비는 시점은 대개 이 화면 밖이다. 돌아왔을 때 낡은 응답을 그대로 쓰면 담긴 것이 셈에서
   * 빠진 자리에 안 집은 값이 남아, 작업자가 같은 라인을 다시 집는다.
   */
  it('목록으로 나가 있는 사이 큐가 비어도 다시 열면 서버 값을 보인다', async () => {
    const user = userEvent.setup();
    const sent = mount({ pick: 'offline' });
    await chooseOrder(user);
    await pickLine(user, '50');
    await screen.findByText('50 미확정 — 아직 서버에 없습니다');

    await user.click(screen.getByRole('button', { name: '다른 지시 고르기' }));
    await screen.findByRole('button', { name: /PK-2026-000077/ });

    sent.set({ pick: 'ok' });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(sent.picks.filter((each) => each.url.includes('/lines/41:pick'))).toHaveLength(2);
    });

    await chooseOrder(user);

    await waitFor(() => {
      expect(screen.getByText('요청 200 / 피킹 50')).toBeTruthy();
    });
    expect(screen.queryByText('50 미확정 — 아직 서버에 없습니다')).toBeNull();
  });

  /*
   * 도는 회차의 목록은 담기 전에 떠진 것이라 방금 담은 건이 없다. 그 결과를 그대로 받으면 보낸
   * 적 없는 건에 집었다는 말이 붙는다.
   */
  it('보내는 도중에 집어도 그 건이 실제로 나간다', async () => {
    const user = userEvent.setup();
    const sent = mount({ pick: 'offline', lines: [line(), secondLine()] });
    await chooseOrder(user);
    await pickLine(user, '50');
    await screen.findByText('피킹을 담아 두었습니다');

    sent.set({ pick: 'ok' });
    sent.holdNextPick();
    window.dispatchEvent(new Event('online'));

    await user.click(screen.getByRole('button', { name: /ABC-124/ }));
    await user.type(await screen.findByLabelText('직접 입력'), LOT_NO);
    await user.click(screen.getByRole('button', { name: '넣기' }));
    await screen.findByText('라인의 LOT 과 같습니다');
    await user.type(screen.getByLabelText('출고 수량'), '30');
    await user.click(screen.getByRole('button', { name: '이 라인 피킹' }));

    sent.releasePick();

    await waitFor(() => {
      expect(sent.picks.filter((each) => each.url.includes('/lines/42:pick'))).toHaveLength(1);
    });
  });

  /*
   * 묶음 이름을 화면 상태로 지으면 지시를 다시 여는 순간 갈린다. 앞서 담긴 피킹과 뒤에 담긴
   * 출고가 다른 묶음이 되어, 피킹이 거부돼도 출고가 그 수량을 싣고 그대로 나간다.
   */
  it('지시를 다시 연 뒤 확정해도 앞서 담긴 피킹과 한 묶음이다', async () => {
    const user = userEvent.setup();
    const sent = mount({ pick: 'offline', issue: 'offline' });
    await chooseOrder(user);
    await pickLine(user, '50');
    await screen.findByText('피킹을 담아 두었습니다');

    await user.click(screen.getByRole('button', { name: '다른 지시 고르기' }));
    await chooseOrder(user);
    await chooseIssueType(user);
    await user.click(screen.getByRole('button', { name: '출고 확정' }));
    await screen.findByText('출고를 담아 두었습니다');

    sent.set({ pick: 'rejected', issue: 'ok' });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(
        sent.picks.filter((each) => each.url.includes('/lines/41:pick')).length,
      ).toBeGreaterThan(1);
    });
    /* 집지 않은 것으로 판정된 수량이 즉시 전기로 나가면 되돌릴 수 없다. */
    expect(sent.issues).toHaveLength(0);
  });

  /*
   * 큐를 읽기 전에는 담긴 것이 없는 것과 구별되지 않는다. 그 사이에 집게 두면 이미 담아 둔
   * 라인을 안 집은 것으로 보고 다시 집는다.
   */
  it('큐를 아직 읽지 못했으면 집을 수 없다', async () => {
    const user = userEvent.setup();
    held.key = 'outbox';
    mount();
    await chooseOrder(user);

    await user.click(screen.getByRole('button', { name: /ABC-123/ }));
    await user.type(await screen.findByLabelText('직접 입력'), LOT_NO);
    await user.click(screen.getByRole('button', { name: '넣기' }));
    await screen.findByText('라인의 LOT 과 같습니다');
    await user.type(screen.getByLabelText('출고 수량'), '50');

    expect(screen.getByRole('button', { name: '이 라인 피킹' }).hasAttribute('disabled')).toBe(
      true,
    );

    held.release?.();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '이 라인 피킹' }).hasAttribute('disabled')).toBe(
        false,
      );
    });
  });

  /*
   * 장갑 낀 손이 한 번 더 누르면 멱등키가 다른 두 건이 담긴다. 서버가 흡수할 수 없어 재고가
   * 두 번 움직인다.
   */
  it('보내는 동안 같은 단추를 다시 눌러도 한 건만 나간다', async () => {
    const user = userEvent.setup();
    const sent = mount();
    await chooseOrder(user);

    await user.click(screen.getByRole('button', { name: /ABC-123/ }));
    await user.type(await screen.findByLabelText('직접 입력'), LOT_NO);
    await user.click(screen.getByRole('button', { name: '넣기' }));
    await screen.findByText('라인의 LOT 과 같습니다');
    await user.type(screen.getByLabelText('출고 수량'), '50');

    sent.holdNextPick();

    const button = screen.getByRole('button', { name: '이 라인 피킹' });

    await user.click(button);
    await user.click(button);
    await user.click(button);

    sent.releasePick();

    await screen.findByText('집었습니다');
    expect(sent.picks).toHaveLength(1);
  });

  /*
   * 앞 건이 앞 회차에 거부돼 큐에서 빠지면 이 회차에는 그 사실을 볼 자리가 없다. 그 결과를
   * 실은 뒤 건이 혼자 나가면 서버가 받지 않은 수량이 그대로 기록된다.
   */
  it('앞 회차에서 피킹이 거부됐으면 다음 회차의 출고도 나가지 않는다', async () => {
    const user = userEvent.setup();
    const sent = mount({ pick: 'offline', issue: 'ok' });
    await chooseOrder(user);
    await pickLine(user, '50');
    await screen.findByText('피킹을 담아 두었습니다');

    /*
     * 셸이 스스로 보내는 회차가 도는 중에 확정한다. 그 회차의 목록에는 출고가 없어 딸림
     * 되돌리기가 걸리지 않고, 출고는 다음 회차에 혼자 남는다.
     */
    sent.set({ pick: 'rejected' });
    sent.holdNextPick();
    window.dispatchEvent(new Event('online'));

    await chooseIssueType(user);
    await user.click(screen.getByRole('button', { name: '출고 확정' }));

    sent.releasePick();

    expect(await screen.findByText('출고가 되돌아왔습니다')).toBeTruthy();
    expect(sent.issues).toHaveLength(0);
  });

  /*
   * 딸림 되돌리기를 묶음 이름만으로 걸면 그 지시가 통째로 잠긴다. 사람이 사유를 보고 다시 한
   * 것은 앞 거부와 무관한 새 기록이라 서버까지 가야 한다.
   */
  it('피킹이 거부된 뒤 다시 집으면 그 건은 서버까지 간다', async () => {
    const user = userEvent.setup();
    const sent = mount({ pick: 'rejected' });
    await chooseOrder(user);
    await pickLine(user, '50');
    await screen.findByText('피킹이 되돌아왔습니다');

    sent.set({ pick: 'ok' });
    await pickLine(user, '50');

    expect(await screen.findByText('집었습니다')).toBeTruthy();
    expect(sent.picks.filter((each) => each.url.includes('/lines/41:pick'))).toHaveLength(2);
  });

  /*
   * 서버는 출고 뒤에도 집은 양을 그대로 내려주고, 라인에 이미 내보낸 양을 담은 자리가 없다.
   * 빼지 않으면 같은 지시를 다시 열었을 때 같은 수량이 한 번 더 나간다.
   */
  it('온라인으로 확정한 뒤 같은 지시를 다시 열어도 같은 수량이 다시 나가지 않는다', async () => {
    const user = userEvent.setup();
    const sent = mount({ lines: [line({ pickedQty: 120 })] });
    await chooseOrder(user);
    await chooseIssueType(user);
    await user.click(screen.getByRole('button', { name: '출고 확정' }));
    await screen.findByText('출고를 확정했습니다');

    await user.click(screen.getByRole('button', { name: '다음 지시' }));
    await chooseOrder(user);
    await chooseIssueType(user);

    expect(await screen.findByText('이 지시에서 내보낼 것이 남아 있지 않습니다.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '출고 확정' }).hasAttribute('disabled')).toBe(true);
    expect(sent.issues).toHaveLength(1);
  });

  /*
   * 셸이 배경으로 담긴 출고를 보내면 큐가 빈다. 보냈는지로 세면 그 순간 담긴 출고를 세는
   * 방어와 함께 꺼져, 다시 열었을 때 같은 수량이 한 번 더 나간다.
   */
  it('오프라인에서 담아 둔 출고가 셸을 통해 나간 뒤에도 다시 나가지 않는다', async () => {
    const user = userEvent.setup();
    const sent = mount({ issue: 'offline', lines: [line({ pickedQty: 120 })] });
    await chooseOrder(user);
    await chooseIssueType(user);
    await user.click(screen.getByRole('button', { name: '출고 확정' }));
    await screen.findByText('출고를 담아 두었습니다');

    sent.set({ issue: 'ok' });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(sent.issues).toHaveLength(2);
    });

    await user.click(screen.getByRole('button', { name: '다음 지시' }));
    await chooseOrder(user);
    await chooseIssueType(user);

    expect(await screen.findByText('이 지시에서 내보낼 것이 남아 있지 않습니다.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '출고 확정' }).hasAttribute('disabled')).toBe(true);
  });

  /* 되돌아온 것은 나간 적이 없다. 빼 두면 다시 내보낼 길이 사라진다. */
  it('담아 둔 출고가 거부되면 다시 확정할 때 전액이 실린다', async () => {
    const user = userEvent.setup();
    const sent = mount({ issue: 'offline', lines: [line({ pickedQty: 120 })] });
    await chooseOrder(user);
    await chooseIssueType(user);
    await user.click(screen.getByRole('button', { name: '출고 확정' }));
    await screen.findByText('출고를 담아 두었습니다');

    sent.set({ issue: 'rejected' });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(sent.issues).toHaveLength(2);
    });

    await user.click(screen.getByRole('button', { name: '다음 지시' }));
    await chooseOrder(user);
    await chooseIssueType(user);

    sent.set({ issue: 'ok' });
    await user.click(screen.getByRole('button', { name: '출고 확정' }));
    await screen.findByText('출고를 확정했습니다');

    const last = sent.issues[sent.issues.length - 1];

    expect(await last?.json()).toMatchObject({ lines: [{ issueQty: 120 }] });
  });

  /*
   * 더 집어서 또 내보내는 것은 정상 흐름이다. 이미 내보낸 만큼만 빼야 하고, 지시 단위로 막으면
   * 그 흐름이 끊긴다.
   */
  it('더 집어서 또 확정하면 이번에 늘어난 만큼만 나간다', async () => {
    const user = userEvent.setup();
    const sent = mount();
    await chooseOrder(user);
    await pickLine(user, '50');
    await screen.findByText('집었습니다');
    await chooseIssueType(user);
    await user.click(screen.getByRole('button', { name: '출고 확정' }));
    await screen.findByText('출고를 확정했습니다');

    await user.click(screen.getByRole('button', { name: '다음 지시' }));
    await chooseOrder(user);
    await waitFor(() => {
      expect(screen.getByText('요청 200 / 피킹 50')).toBeTruthy();
    });

    await pickLine(user, '70');
    await screen.findByText('집었습니다');
    await chooseIssueType(user);
    await user.click(screen.getByRole('button', { name: '출고 확정' }));
    await screen.findByText('출고를 확정했습니다');

    await waitFor(() => {
      expect(sent.issues).toHaveLength(2);
    });
    expect(await sent.issues[0]?.json()).toMatchObject({ lines: [{ issueQty: 50 }] });
    expect(await sent.issues[1]?.json()).toMatchObject({ lines: [{ issueQty: 70 }] });
  });

  it('보내는 동안 확정을 다시 눌러도 한 건만 나간다', async () => {
    const user = userEvent.setup();
    const sent = mount({ lines: [line({ pickedQty: 120 })] });
    await chooseOrder(user);
    await chooseIssueType(user);

    sent.holdNextIssue();

    const button = screen.getByRole('button', { name: '출고 확정' });

    await user.click(button);
    await user.click(button);
    await user.click(button);

    sent.releaseIssue();

    await screen.findByText('출고를 확정했습니다');
    expect(sent.issues).toHaveLength(1);
  });

  /*
   * 담기지 못한 것을 내보낸 것으로 세면, 나가지도 않은 양이 셈에 들어가 확정이 영영 잠긴다.
   */
  it('담기에 실패하면 그 사실을 말하고 내보낸 것으로 세지 않는다', async () => {
    const user = userEvent.setup();
    const sent = mount({ lines: [line({ pickedQty: 120 })] });
    await chooseOrder(user);
    await chooseIssueType(user);

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '출고 확정' }));

    expect(
      await screen.findByText('단말에 담지 못했습니다. 저장 공간을 확인하고 다시 시도하세요.'),
    ).toBeTruthy();
    expect(screen.queryByText('이 지시에서 내보낼 것이 남아 있지 않습니다.')).toBeNull();
    expect(screen.getByRole('button', { name: '출고 확정' }).hasAttribute('disabled')).toBe(false);
    expect(sent.issues).toHaveLength(0);
  });

  it('보낼 출고 유형이 없으면 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    mount({ issueTypes: [], lines: [line({ pickedQty: 120 })] });
    await chooseOrder(user);

    expect(
      await screen.findByText('보낼 출고 유형이 없습니다. 공통코드를 확인하세요.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '출고 확정' }).hasAttribute('disabled')).toBe(true);
  });
});
