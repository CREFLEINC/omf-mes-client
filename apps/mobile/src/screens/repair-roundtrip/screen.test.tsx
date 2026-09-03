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
import { RepairRoundtripScreen } from './screen';

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

const SCANNED = 'PLOT-2026-0805-0031-D';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const lot = {
  lotId: 4,
  lotNo: SCANNED,
  itemId: 31,
  lotTypeCode: 'PRODUCT',
  plantId: 1,
  initialQty: 200,
  uomId: 9,
  sourceTypeCode: 'PRODUCTION',
  sourceId: 1,
  statusCode: 'DEFECTIVE',
};

const defect = {
  defectRecordId: 501,
  workOrderId: 88,
  lotId: 4,
  defectCodeId: 12,
  defectQty: 40,
  uomId: 9,
  occurrenceProcessId: 3,
  detectionProcessId: 4,
  detectedAt: '2026-08-12T10:22:00+09:00',
};

const execution = {
  repairExecutionId: 1001,
  defectRecordId: 501,
  startedAt: '2026-09-01T08:14:00+09:00',
  repairQty: 20,
  uomId: 9,
};

interface Options {
  defects?: unknown[];
  /** 스캔한 LOT 의 열린 건. 서버가 lotId 로 걸러 준 결과다. */
  open?: unknown[];
  /** 전체 열린 건. 거르지 않고 물었을 때 오는 것으로, 아래 목록이 쓴다. */
  openAll?: unknown[];
  defectsStatus?: number;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (request) => new URL(request.url).pathname === '/trace/lots',
    respond: () => jsonResponse({ items: [lot], page }),
  },
  {
    match: (request) => new URL(request.url).pathname === '/mdm/items/31',
    respond: () => jsonResponse({ item: { itemCode: 'ABC-123', itemName: '하우징' } }),
  },
  {
    match: (request) => new URL(request.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 9, uomCode: 'EA' }], page }),
  },
  {
    match: (request) => new URL(request.url).pathname === '/quality/defect-records',
    respond: () =>
      options.defectsStatus === undefined
        ? jsonResponse({ items: options.defects ?? [defect], page })
        : jsonResponse({ message: '실패' }, { status: options.defectsStatus }),
  },
  {
    /* 서버는 lotId 로 거른다. 스텁이 그것을 무시하면 범위가 어긋난 결함을 시험이 덮는다. */
    match: (request) =>
      new URL(request.url).pathname === '/production/repair-executions' && request.method === 'GET',
    respond: (request) => {
      const lotId = new URL(request.url).searchParams.get('lotId');

      return jsonResponse({
        items: lotId === null ? (options.openAll ?? options.open ?? []) : (options.open ?? []),
        page,
      });
    },
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

const mount = (extra: StubRoute[] = [], options: Options = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <RepairRoundtripScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]) },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText('불량 LOT 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
};

beforeEach(() => {
  store.clear();
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

describe('수리 왕복 스캔 화면', () => {
  /* 앞쪽이 서버에 없으면 반출이 붙을 곳이 없다. 담아 두는 길을 두지 않는다. */
  it('연결이 없으면 진입을 막고 스캔 자리를 열지 않는다', async () => {
    setOnline(false);
    mount();

    expect(await screen.findByText('연결이 있어야 쓸 수 있는 화면입니다')).toBeTruthy();
    expect(screen.queryByLabelText('불량 LOT 스캔')).toBeNull();
  });

  it('불량이 없으면 불량 LOT이 아니라고 말하고 조회한 창의 길이를 함께 말한다', async () => {
    mount([], { defects: [] });

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);

    expect(await screen.findByText('불량 판정된 LOT이 아닙니다')).toBeTruthy();
    expect(screen.getByText('최근 180일 안에서 찾았습니다')).toBeTruthy();
  });

  /* 확인하지 못한 것을 불량이 아닌 것으로 말하면 현장은 맞는 LOT을 들고 돌아선다. */
  it('불량 조회가 실패한 것을 불량 없음으로 말하지 않는다', async () => {
    mount([], { defectsStatus: 500 });

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);

    expect(
      await screen.findByText('불량 기록을 확인할 수 없습니다. 연결을 확인한 뒤 다시 스캔하세요.'),
    ).toBeTruthy();
    expect(screen.queryByText('불량 판정된 LOT이 아닙니다')).toBeNull();
  });

  it('불량을 찾으면 LOT과 품목과 불량 수량을 보인다', async () => {
    mount();

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);

    expect(await screen.findByText('불량 40 EA')).toBeTruthy();
    expect(screen.getByText('ABC-123')).toBeTruthy();
  });

  /* 같은 불량을 두 번 투입하면 왕복이 갈라져 어느 쪽이 닫혔는지 알 수 없다. */
  it('이미 열린 수리 건이 있으면 투입을 막고 그 사실을 말한다', async () => {
    mount([], { open: [execution] });

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);

    expect(await screen.findByText('이미 수리 투입되었습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '투입 등록' }).hasAttribute('disabled')).toBe(true);
  });

  it('수리 수량이 불량 수량을 넘으면 투입을 막는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');

    await user.type(screen.getByLabelText('수리 수량'), '41');

    expect(await screen.findByText('수리 수량은 불량 수량 40을(를) 넘을 수 없습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '투입 등록' }).hasAttribute('disabled')).toBe(true);
  });

  /* 사번은 인증이 아니라 귀속이다. 없으면 서버가 요청 자체를 받지 않는다. */
  it('투입은 사번과 멱등키를 실어 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (request) =>
          new URL(request.url).pathname === '/production/repair-executions' &&
          request.method === 'POST',
        respond: (request) => {
          seen.push(request.clone());
          return jsonResponse({ ...execution, repairQty: 20 }, { status: 201 });
        },
      },
    ]);

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');

    await user.type(screen.getByLabelText('수리 수량'), '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(await screen.findByText('수리 투입을 기록했습니다')).toBeTruthy();
  });

  /*
   * 보낼 때마다 키를 새로 만들면 멱등키가 아무것도 막지 못한다. 서버가 기록한 뒤 응답이
   * 유실되면 화면은 실패로 보이고, 사람이 다시 누르면 새 키라 서버가 같은 일을 한 번 더 한다.
   */
  it('투입을 다시 시도해도 같은 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    let reachable = false;
    mount([
      {
        match: (request) =>
          new URL(request.url).pathname === '/production/repair-executions' &&
          request.method === 'POST',
        respond: (request) => {
          seen.push(request.clone());

          if (!reachable) {
            throw new TypeError('Failed to fetch');
          }

          return jsonResponse({ ...execution, repairQty: 20 }, { status: 201 });
        },
      },
    ]);

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');

    await user.type(screen.getByLabelText('수리 수량'), '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    reachable = true;
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).toBe(seen[0]?.headers.get('Idempotency-Key'));
    expect(await screen.findByText('수리 투입을 기록했습니다')).toBeTruthy();
  });

  /* 성공한 쓰기를 같은 키로 다시 보내면 서버가 흡수해 조용히 사라진다. */
  it('투입에 성공한 뒤 다시 적으면 새 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (request) =>
          new URL(request.url).pathname === '/production/repair-executions' &&
          request.method === 'POST',
        respond: (request) => {
          seen.push(request.clone());
          return jsonResponse({ ...execution, repairQty: 20 }, { status: 201 });
        },
      },
    ]);

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');
    await user.type(screen.getByLabelText('수리 수량'), '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    await user.click(await screen.findByRole('button', { name: '다음 LOT 스캔' }));

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');
    await user.type(screen.getByLabelText('수리 수량'), '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).not.toBe(
      seen[0]?.headers.get('Idempotency-Key'),
    );
  });

  /*
   * 앞 키를 들고 가면 서버가 그것을 앞 시도로 보고 흡수한다. 화면은 기록했다고 말하는데
   * 아무것도 기록되지 않는다 - 중복과 정확히 대칭인 조용한 유실이다.
   */
  it('다른 불량 건을 고르면 새 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const other = { ...defect, defectRecordId: 502, defectQty: 30 };
    mount(
      [
        {
          match: (request) =>
            new URL(request.url).pathname === '/production/repair-executions' &&
            request.method === 'POST',
          respond: (request) => {
            seen.push(request.clone());
            throw new TypeError('Failed to fetch');
          },
        },
      ],
      { defects: [defect, other] },
    );

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);

    const picks = await screen.findAllByRole('button', { name: /불량 \d+ EA/ });

    await user.click(picks[0] as HTMLElement);
    await user.type(await screen.findByLabelText('수리 수량'), '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    await user.click(screen.getAllByRole('button', { name: /불량 \d+ EA/ })[1] as HTMLElement);
    await user.type(await screen.findByLabelText('수리 수량'), '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).not.toBe(
      seen[0]?.headers.get('Idempotency-Key'),
    );
  });

  /*
   * 값이 잠깐 달라졌다 돌아오면 최종 대상은 같다. 직전 렌더와 견주면 그 사이에 키가 버려져,
   * 같은 것을 다시 보내는데 새 키로 간다 - 막으려던 중복이 그대로 난다.
   */
  it('수량을 고쳤다 되돌리면 앞 시도와 같은 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    let reachable = false;
    mount([
      {
        match: (request) =>
          new URL(request.url).pathname === '/production/repair-executions' &&
          request.method === 'POST',
        respond: (request) => {
          seen.push(request.clone());

          if (!reachable) {
            throw new TypeError('Failed to fetch');
          }

          return jsonResponse({ ...execution, repairQty: 20 }, { status: 201 });
        },
      },
    ]);

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');

    const field = screen.getByLabelText('수리 수량');

    await user.type(field, '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    /* 손이 미끄러져 지웠다 다시 넣는다. 보낼 값은 그대로 20 이다. */
    await user.type(field, '{backspace}');
    await user.type(field, '0');

    reachable = true;
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).toBe(seen[0]?.headers.get('Idempotency-Key'));
  });

  /* 대상은 친 문자열이 아니라 보낼 값이다. 20 과 20.0 은 같은 쓰기다. */
  it('같은 수량을 다르게 적어도 같은 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    let reachable = false;
    mount([
      {
        match: (request) =>
          new URL(request.url).pathname === '/production/repair-executions' &&
          request.method === 'POST',
        respond: (request) => {
          seen.push(request.clone());

          if (!reachable) {
            throw new TypeError('Failed to fetch');
          }

          return jsonResponse({ ...execution, repairQty: 20 }, { status: 201 });
        },
      },
    ]);

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');

    const field = screen.getByLabelText('수리 수량');

    await user.type(field, '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    await user.type(field, '.0');

    reachable = true;
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(await seen[1]?.clone().json()).toMatchObject({ repairQty: 20 });
    expect(seen[1]?.headers.get('Idempotency-Key')).toBe(seen[0]?.headers.get('Idempotency-Key'));
  });

  /* 보낼 값이 달라졌으면 다른 쓰기다. 앞 키로 가면 서버가 앞 시도로 보고 흡수한다. */
  it('수량을 바꾸면 새 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (request) =>
          new URL(request.url).pathname === '/production/repair-executions' &&
          request.method === 'POST',
        respond: (request) => {
          seen.push(request.clone());
          throw new TypeError('Failed to fetch');
        },
      },
    ]);

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');

    const field = screen.getByLabelText('수리 수량');

    await user.type(field, '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    await user.clear(field);
    await user.type(field, '30');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).not.toBe(
      seen[0]?.headers.get('Idempotency-Key'),
    );
  });

  /* 성공과 실패는 다른 쓰기다. 앞 키로 가면 서버가 앞 판정을 되돌려 준다. */
  it('결과를 바꾸면 새 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount(
      [
        {
          match: (request) =>
            new URL(request.url).pathname === '/production/repair-executions/1001:return',
          respond: (request) => {
            seen.push(request.clone());
            throw new TypeError('Failed to fetch');
          },
        },
      ],
      { open: [execution], openAll: [execution] },
    );

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await user.click(await screen.findByRole('tab', { name: '수리 반출' }));
    await user.click(await screen.findByRole('button', { name: '수리 성공' }));
    await user.click(screen.getByRole('button', { name: '반출 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '수리 실패' }));
    await user.click(screen.getByRole('button', { name: '반출 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).not.toBe(
      seen[0]?.headers.get('Idempotency-Key'),
    );
  });

  /* 한 LOT 에 열린 건이 둘 이상인 것은 화면이 설계로 받는 상태다. 건을 바꾸면 다른 쓰기다. */
  it('다른 수리 건을 고르면 새 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const other = { ...execution, repairExecutionId: 1002, repairQty: 35 };
    mount(
      [
        {
          match: (request) => /\/production\/repair-executions\/\d+:return$/.test(request.url),
          respond: (request) => {
            seen.push(request.clone());
            throw new TypeError('Failed to fetch');
          },
        },
      ],
      { open: [execution, other], openAll: [execution, other] },
    );

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await user.click(await screen.findByRole('tab', { name: '수리 반출' }));

    const picks = await screen.findAllByRole('button', { name: /EA ·/ });

    await user.click(picks[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: '수리 성공' }));
    await user.click(screen.getByRole('button', { name: '반출 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    await user.click(screen.getAllByRole('button', { name: /EA ·/ })[1] as HTMLElement);
    await user.click(screen.getByRole('button', { name: '반출 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(new URL(seen[1]?.url ?? '').pathname).not.toBe(new URL(seen[0]?.url ?? '').pathname);
    expect(seen[1]?.headers.get('Idempotency-Key')).not.toBe(
      seen[0]?.headers.get('Idempotency-Key'),
    );
  });

  /* 되돌아오면 최종 대상은 같다. 그 사이에 키가 버려지면 같은 것을 새 키로 보낸다. */
  it('결과를 바꿨다 되돌리면 앞 시도와 같은 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount(
      [
        {
          match: (request) =>
            new URL(request.url).pathname === '/production/repair-executions/1001:return',
          respond: (request) => {
            seen.push(request.clone());
            throw new TypeError('Failed to fetch');
          },
        },
      ],
      { open: [execution], openAll: [execution] },
    );

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await user.click(await screen.findByRole('tab', { name: '수리 반출' }));
    await user.click(await screen.findByRole('button', { name: '수리 성공' }));
    await user.click(screen.getByRole('button', { name: '반출 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '수리 실패' }));
    await user.click(screen.getByRole('button', { name: '수리 성공' }));
    await user.click(screen.getByRole('button', { name: '반출 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).toBe(seen[0]?.headers.get('Idempotency-Key'));
  });

  /* 반출도 같은 성질을 가져야 한다. 투입만 재면 반출의 회귀를 잡지 못한다. */
  it('반출을 다시 시도해도 같은 멱등키로 간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    let reachable = false;
    mount(
      [
        {
          match: (request) =>
            new URL(request.url).pathname === '/production/repair-executions/1001:return',
          respond: (request) => {
            seen.push(request.clone());

            if (!reachable) {
              throw new TypeError('Failed to fetch');
            }

            return jsonResponse(execution);
          },
        },
      ],
      { open: [execution], openAll: [execution] },
    );

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await user.click(await screen.findByRole('tab', { name: '수리 반출' }));
    await user.click(await screen.findByRole('button', { name: '수리 성공' }));
    await user.click(screen.getByRole('button', { name: '반출 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    reachable = true;
    await user.click(screen.getByRole('button', { name: '반출 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    expect(seen[1]?.headers.get('Idempotency-Key')).toBe(seen[0]?.headers.get('Idempotency-Key'));
  });

  /*
   * 투입과 반출이 키 그릇을 나눠 쓰면, 실패한 투입의 키가 살아 있는 채로 반출에 실린다. 서버가
   * 투입의 응답을 되돌려 주면 화면은 반출을 기록했다고 말하는데 왕복은 열린 채다.
   */
  it('투입이 실패한 뒤 반출해도 투입의 멱등키를 쓰지 않는다', async () => {
    const user = userEvent.setup();
    const dispatched: Request[] = [];
    const returned: Request[] = [];
    mount(
      [
        {
          match: (request) =>
            new URL(request.url).pathname === '/production/repair-executions' &&
            request.method === 'POST',
          respond: (request) => {
            dispatched.push(request.clone());
            throw new TypeError('Failed to fetch');
          },
        },
        {
          match: (request) =>
            new URL(request.url).pathname === '/production/repair-executions/1001:return',
          respond: (request) => {
            returned.push(request.clone());
            return jsonResponse(execution);
          },
        },
      ],
      /* 열린 건이 다른 불량에 걸려 있어야 투입 패널이 막히지 않는다. */
      { open: [{ ...execution, defectRecordId: 599 }], openAll: [execution] },
    );

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');
    await user.type(screen.getByLabelText('수리 수량'), '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    await waitFor(() => {
      expect(dispatched).toHaveLength(1);
    });

    await user.click(await screen.findByRole('tab', { name: '수리 반출' }));
    await user.click(await screen.findByRole('button', { name: '수리 성공' }));
    await user.click(screen.getByRole('button', { name: '반출 등록' }));

    await waitFor(() => {
      expect(returned).toHaveLength(1);
    });
    expect(returned[0]?.headers.get('Idempotency-Key')).not.toBe(
      dispatched[0]?.headers.get('Idempotency-Key'),
    );
  });

  /* 서버가 충돌로 되돌린 것은 다시 시도해서 풀리지 않는다. 다시 하라고 말하지 않는다. */
  it('서버가 충돌로 되돌리면 이미 투입된 것으로 말한다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (request) =>
          new URL(request.url).pathname === '/production/repair-executions' &&
          request.method === 'POST',
        respond: () => jsonResponse({ message: '이미 열린 수리 건' }, { status: 409 }),
      },
    ]);

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');

    await user.type(screen.getByLabelText('수리 수량'), '20');
    await user.click(screen.getByRole('button', { name: '투입 등록' }));

    expect(await screen.findByText('이미 수리 투입되었습니다')).toBeTruthy();
    expect(screen.queryByText('수리 투입을 기록하지 못했습니다. 다시 시도하세요.')).toBeNull();
  });

  it('반출 탭에서 열린 건이 없으면 투입 기록이 없다고 말한다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('불량 40 EA');

    await user.click(screen.getByRole('tab', { name: '수리 반출' }));

    expect(await screen.findByText('수리 투입 기록이 없습니다')).toBeTruthy();
  });

  it('반출은 고른 결과를 실어 왕복을 닫는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount(
      [
        {
          match: (request) =>
            new URL(request.url).pathname === '/production/repair-executions/1001:return',
          respond: (request) => {
            seen.push(request.clone());
            return jsonResponse({ ...execution, returnedAt: '2026-09-01T11:40:00+09:00' });
          },
        },
      ],
      { open: [execution] },
    );

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await user.click(screen.getByRole('tab', { name: '수리 반출' }));
    await screen.findByRole('button', { name: '수리 실패' });

    await user.click(screen.getByRole('button', { name: '수리 실패' }));
    await user.click(screen.getByRole('button', { name: '반출 등록' }));

    expect(await screen.findByText('수리 반출을 기록했습니다')).toBeTruthy();
    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(((await seen[0]!.json()) as { repairResultCode: string }).repairResultCode).toBe(
      'FAILED',
    );
  });

  /*
   * 스캔 전에는 이 LOT 의 열린 건이 무엇인지 알 수 없다. 그 자리에 전체 목록이 들어오면 남의
   * 건이 자동으로 골라지고, 결과만 고르면 반출이 열린다 - 되돌릴 수 없는 상태 전이다.
   */
  it('스캔하지 않았으면 남의 열린 건으로 반출할 수 없다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount(
      [
        {
          match: (request) =>
            new URL(request.url).pathname === '/production/repair-executions/1001:return',
          respond: (request) => {
            seen.push(request.clone());
            return jsonResponse(execution);
          },
        },
      ],
      { open: [], openAll: [execution] },
    );

    await user.click(await screen.findByRole('tab', { name: '수리 반출' }));

    /* 전제 - 전체 목록에는 그 남의 건이 실제로 담겨 있다. 담기지 않으면 이 시험은 공회전이다. */
    expect(await screen.findByText('수리 중 1건')).toBeTruthy();

    /* 빈 화면으로 두지 않는다. 무엇을 해야 하는지 말하고, 반출로 가는 길은 열지 않는다. */
    expect(await screen.findByText('불량 LOT 을 먼저 스캔하세요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '수리 실패' })).toBeNull();
    expect(screen.queryByRole('button', { name: '반출 등록' })).toBeNull();
    expect(seen).toHaveLength(0);
  });

  it('결과를 고르기 전에는 반출할 수 없다', async () => {
    const user = userEvent.setup();
    mount([], { open: [execution] });

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await user.click(screen.getByRole('tab', { name: '수리 반출' }));

    const submit = await screen.findByRole('button', { name: '반출 등록' });

    expect(submit.hasAttribute('disabled')).toBe(true);
  });

  /* 반출까지가 이 화면의 몫이다. 재투입을 여기서 약속하지 않는다. */
  it('재투입을 이 화면이 하지 않는 것을 말한다', async () => {
    const user = userEvent.setup();
    mount([], { open: [execution] });

    await screen.findByLabelText('불량 LOT 스캔');
    scan(SCANNED);
    await user.click(screen.getByRole('tab', { name: '수리 반출' }));

    expect(await screen.findByText('수리분의 재투입은 이 화면에서 하지 않습니다')).toBeTruthy();
  });

  it('수리 중인 건을 표로 보인다', async () => {
    mount([], { open: [execution] });

    expect(await screen.findByText('수리 중 1건')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });
});
