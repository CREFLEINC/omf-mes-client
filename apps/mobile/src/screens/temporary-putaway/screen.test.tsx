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
import { TemporaryPutawayScreen } from './screen';

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

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const task = (overrides: Record<string, unknown> = {}) => ({
  putawayTaskId: 90,
  putawayTaskNo: 'PT-2026-0007',
  goodsReceiptLineId: 12,
  itemId: 31,
  lotId: 4,
  taskQty: 120,
  uomId: 9,
  fromLocationId: 1,
  recommendedLocationId: 5,
  warehouseId: 2,
  priorityNo: 1,
  statusCode: 'ASSIGNED',
  ...overrides,
});

const location = (overrides: Record<string, unknown> = {}) => ({
  locationId: 5,
  warehouseId: 2,
  locationCode: 'A-01-03',
  locationName: '자재 A열',
  locationTypeCode: 'RACK',
  allowMixedItem: true,
  allowMixedLot: true,
  isActive: true,
  ...overrides,
});

const TEMP = location({ locationId: 9, locationCode: 'TMP-01', locationName: '임시 자리' });

const codeValue = (code: string, name: string) => ({
  codeValueId: 1,
  codeGroupId: 5,
  code,
  codeName: name,
  displayOrder: 1,
  isActive: true,
});

interface Options {
  reasons?: unknown[];
  locations?: unknown[];
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/mdm/locations',
    respond: (req) => {
      const code = new URL(req.url).searchParams.get('locationCode');
      const all = options.locations ?? [location(), TEMP];

      return jsonResponse({
        items:
          code === null
            ? all
            : all.filter((each) => (each as { locationCode: string }).locationCode === code),
        page,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/code-values',
    respond: () => jsonResponse({ items: options.reasons ?? [codeValue('FULL', '정위치 포화')], page }),
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

const mount = (
  state: unknown,
  extra: StubRoute[] = [],
  options: Options = {},
) =>
  renderWithProviders(
    <MemoryRouter initialEntries={[{ pathname: '/temporary-putaway', state }]}>
      <SignedIn>
        <TemporaryPutawayScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]) },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText('임시 위치 코드 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

beforeEach(() => {
  store.clear();
  localStorage.clear();
});

describe('임시 위치 적재 화면', () => {
  /* 지시는 앞 화면이 들고 온다. 없으면 지어내지 않고 어디서 오는지 알린다. */
  it('지시 없이 열면 어디서 오는지 알리고 아무것도 열지 않는다', async () => {
    mount(null);

    expect(await screen.findByText('적치 지시를 가지고 오세요')).toBeTruthy();
    expect(screen.queryByLabelText('임시 위치 코드 스캔')).toBeNull();
  });

  it('넘어온 지시를 보인다', async () => {
    mount({ task: task() });

    expect(await screen.findByText('PT-2026-0007')).toBeTruthy();
    expect(screen.getByLabelText('임시 위치 코드 스캔')).toBeTruthy();
  });

  /* 임시 위치를 가려낼 값이 아직 없다. 걸러 낸 척하지 않는다. */
  it('위치를 걸러 내지 않는다는 것을 말한다', async () => {
    mount({ task: task() });

    expect(
      await screen.findByText('임시 위치를 가려낼 값이 아직 없어 전체 위치를 보입니다'),
    ).toBeTruthy();
  });

  /* 실제 적치 위치는 완료된 건에만 채워진다. 또 적으면 두 기록이 남는다. */
  it('이미 적치된 지시는 막고 현재 위치를 보인다', async () => {
    mount({ task: task({ actualLocationId: 5 }) });

    expect(await screen.findByText('이미 임시 적치되었습니다')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('현재 위치 A-01-03')).toBeTruthy();
    });
  });

  /* 서버가 둘 다 비면 막는다. 무엇이 있어야 하는지를 먼저 말한다. */
  it('사유와 비고가 둘 다 비면 등록을 막고 무엇이 필요한지 말한다', async () => {
    mount({ task: task(), location: TEMP });

    expect(await screen.findByText('사유를 고르거나 비고를 적으세요')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '임시 적치 등록' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('비고만 적어도 등록할 수 있다', async () => {
    const user = userEvent.setup();
    mount({ task: task(), location: TEMP });

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');

    expect(
      screen.getByRole('button', { name: '임시 적치 등록' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  /* 값이 없으면 고를 것이 없다. 비고로 적게 두고 그 사실을 말한다. */
  it('고를 사유가 없으면 그 사실을 말하고 선택을 잠근다', async () => {
    mount({ task: task() }, [], { reasons: [] });

    expect(await screen.findByText('고를 사유가 아직 없습니다. 비고에 적으세요.')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: '사유' }).hasAttribute('disabled')).toBe(true);
  });

  it('스캔한 위치를 임시 위치로 잡는다', async () => {
    mount({ task: task() });

    await screen.findByLabelText('임시 위치 코드 스캔');
    scan('TMP-01');

    expect(await screen.findByText('TMP-01 임시 자리')).toBeTruthy();
  });

  it('이 창고에 없는 코드를 스캔하면 찾지 못했다고 말한다', async () => {
    mount({ task: task() });

    await screen.findByLabelText('임시 위치 코드 스캔');
    scan('Z-99');

    expect(await screen.findByText('Z-99 위치를 이 창고에서 찾지 못했습니다')).toBeTruthy();
  });

  /* 임시 위치는 수용량으로 막지 않는다. 값이 있으면 알리기만 한다. */
  it('수용량이 있어도 막지 않고 알리기만 한다', async () => {
    const user = userEvent.setup();
    mount({ task: task(), location: { ...TEMP, capacityQty: 100 } });

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');

    expect(screen.getByText('수용량 100 — 임시 위치라 막지 않습니다')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '임시 적치 등록' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  /* 사번은 인증이 아니라 귀속이다. 정상 적치와 다른 경로로 보낸다. */
  it('등록은 임시 경로로 사번과 멱등키를 실어 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    const bodies: unknown[] = [];
    mount({ task: task(), location: TEMP }, [
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete-temporary' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req);
          void req
            .clone()
            .json()
            .then((body: unknown) => bodies.push(body));
          return jsonResponse(task({ actualLocationId: 9 }));
        },
      },
    ]);

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');
    await user.click(screen.getByRole('button', { name: '임시 적치 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });

    const body = bodies[0] as { actualLocationId: number; remarks: string; reasonCode: unknown };

    expect(body.actualLocationId).toBe(9);
    expect(body.remarks).toBe('통로에 둠');
    expect(body.reasonCode).toBeNull();
    expect(await screen.findByText('임시 적치를 기록했습니다')).toBeTruthy();
  });

  /* 이 화면은 닫히지 않는다. 정위치로 옮기는 것은 다른 화면이 한다. */
  it('정위치 이동을 여기서 하지 않는다고 말한다', async () => {
    const user = userEvent.setup();
    mount({ task: task(), location: TEMP }, [
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/putaway-tasks/90:complete-temporary',
        respond: () => jsonResponse(task({ actualLocationId: 9 })),
      },
    ]);

    await screen.findByLabelText('비고');
    await user.type(screen.getByLabelText('비고'), '통로에 둠');
    await user.click(screen.getByRole('button', { name: '임시 적치 등록' }));

    expect(
      await screen.findByText(
        '정위치 이동은 재고 이동 화면에서 합니다. 그 화면은 아직 이 앱에 없습니다.',
      ),
    ).toBeTruthy();
  });
});
