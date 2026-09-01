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
  open?: unknown[];
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
    match: (request) =>
      new URL(request.url).pathname === '/production/repair-executions' &&
      request.method === 'GET',
    respond: () => jsonResponse({ items: options.open ?? [], page }),
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

    expect(await screen.findByText('불량 기록을 확인할 수 없습니다. 연결을 확인한 뒤 다시 스캔하세요.')).toBeTruthy();
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
          seen.push(request);
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
    const bodies: unknown[] = [];
    mount(
      [
        {
          match: (request) =>
            new URL(request.url).pathname === '/production/repair-executions/1001:return',
          respond: (request) => {
            void request
              .clone()
              .json()
              .then((body: unknown) => bodies.push(body));
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
      expect(bodies).toHaveLength(1);
    });
    expect((bodies[0] as { repairResultCode: string }).repairResultCode).toBe('FAILED');
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
