import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  createTestQueryClient,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkerSession } from '../../patterns/worker-session';
import { PhysicalCountScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());
/** 단말 보관소가 거절하는 상황을 만든다. 담기지 못한 것을 화면이 말하는지 보기 위해서다. */
const held = vi.hoisted(() => ({ failWrite: null as string | null }));

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
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

const page = { page: 1, size: 200, total: 1, totalElements: 1, totalPages: 1 };

const COUNT_NO = 'IC-2026-000031';
const LOC_CODE = 'A-01-03';

interface Options {
  /** 장부를 감춘 실사로 답한다 - 서버가 장부 수량을 내려보내지 않는다. */
  blind?: boolean;
  /** 첫 줄을 이미 센 것으로 답한다. */
  firstCounted?: boolean;
  /** 이 위치에 실사 라인이 없다고 답한다. */
  emptyLocation?: boolean;
  /**
   * 다음 조회부터 둘째 줄이 이미 센 것으로 바뀐다 - 다른 단말이 그 줄을 센 상황이다.
   *
   * 같은 응답을 그대로 돌려주면 조회 캐시가 같은 배열을 그대로 내주어 화면이 다시 세우지
   * 않는다. 덮어쓰는 결함이 있어도 그 자리에서는 드러나지 않는다.
   */
  otherDevice?: { counted: boolean };
  /** 보낸 요청을 모은다. */
  seen?: Request[];
  /**
   * 물어본 주소를 모은다.
   *
   * 응답만 돌려주는 스텁은 조회 축이 빠진 것을 잡지 못한다 - 마감된 실사까지 목록에 서도
   * 스텁이 진행 중인 것만 답하면 시험이 통과한다.
   */
  asked?: string[];
}

const line = (overrides: Record<string, unknown> = {}) => ({
  inventoryCountLineId: 5101,
  inventoryCountId: 5001,
  lineNo: 1,
  locationId: 3001,
  itemId: 2002,
  lotId: 8001,
  systemQty: 120,
  countedQty: 0,
  varianceQty: 0,
  uomId: 1001,
  counted: false,
  countedAt: '2026-09-07T09:00:00+09:00',
  ...overrides,
});

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/inventory/counts',
    respond: (req) => {
      options.asked?.push(req.url);

      return jsonResponse({
        items: [
          {
            inventoryCountId: 5001,
            inventoryCountNo: COUNT_NO,
            countTypeCode: 'PERIODIC',
            warehouseId: 1001,
            plannedDate: '2026-09-07',
            blindCount: options.blind === true,
            statusCode: 'IN_PROGRESS',
          },
        ],
        page,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/locations',
    respond: () =>
      jsonResponse({
        items: [
          {
            locationId: 3001,
            warehouseId: 1001,
            locationCode: LOC_CODE,
            locationName: 'A구역 01열 03단',
            isActive: true,
          },
        ],
        page,
      }),
  },
  {
    match: (req) => /\/inventory\/counts\/\d+\/lines/.test(new URL(req.url).pathname),
    respond: (req) => {
      options.asked?.push(req.url);

      if (req.method === 'PUT') {
        options.seen?.push(req.clone());
        return jsonResponse({ items: [] });
      }

      if (options.emptyLocation === true) {
        return jsonResponse({ items: [], page });
      }

      /* 블라인드 실사는 어느 줄에도 장부가 오지 않는다. */
      const hideSystemQty = options.blind === true ? { systemQty: undefined } : {};

      return jsonResponse({
        items: [
          line({
            ...hideSystemQty,
            counted: options.firstCounted === true,
            countedQty: options.firstCounted === true ? 118 : 0,
          }),
          line({
            ...hideSystemQty,
            inventoryCountLineId: 5102,
            lineNo: 2,
            itemId: 2001,
            lotId: null,
            systemQty: options.blind === true ? undefined : 40,
            counted: options.otherDevice?.counted === true,
            countedQty: options.otherDevice?.counted === true ? 37 : 0,
          }),
        ],
        page,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: [
          { itemId: 2002, itemCode: 'ABC-123', itemName: '하우징', fifoPolicyCode: 'FIFO' },
          { itemId: 2001, itemCode: 'RM-1001', itemName: '수지A', fifoPolicyCode: 'FEFO' },
        ],
        page,
      }),
  },
];

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { worker, signIn } = useWorkerSession();

  useEffect(() => {
    if (worker === null) {
      signIn({ workerNo: '100028', workerName: '김영수' });
    }
  }, [signIn, worker]);

  return worker === null ? null : children;
};

const mount = (options: Options = {}, queryClient?: ReturnType<typeof createTestQueryClient>) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <PhysicalCountScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch(routes(options)), queryClient },
  );

const scanLocation = (code: string) => {
  const field = screen.getByLabelText('위치 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const openLocation = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('combobox', { name: '실사' }));
  await user.click(await screen.findByRole('option', { name: `${COUNT_NO} · 2026-09-07` }));
  scanLocation(LOC_CODE);
  await screen.findByText(`위치 ${LOC_CODE}`);
};

beforeEach(() => {
  held.failWrite = null;
  store.clear();
  localStorage.clear();
});

describe('실물 카운트 화면', () => {
  it('진행 중인 실사를 고르면 위치를 스캔할 수 있다', async () => {
    const user = userEvent.setup();
    mount();

    await user.click(await screen.findByRole('combobox', { name: '실사' }));
    await user.click(await screen.findByRole('option', { name: `${COUNT_NO} · 2026-09-07` }));

    expect(await screen.findByLabelText('위치 스캔')).toBeTruthy();
  });

  /*
   * 마감된 실사를 고르면 쓰기가 서버에서 되돌아온다. 화면이 목록에서 미리 거르지 않으면
   * 사람은 한 위치를 다 센 뒤에야 그 사실을 안다.
   */
  it('진행 중인 실사만 물어본다', async () => {
    const asked: string[] = [];
    mount({ asked });

    await screen.findByRole('combobox', { name: '실사' });

    expect(asked.some((url) => url.includes('inProgressOnly=true'))).toBe(true);
  });

  /* 창고 하나의 라인이 수천 건이다. 위치로 끊어 묻지 않으면 옆 선반의 줄까지 적게 된다. */
  it('그 위치의 라인만 물어본다', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];
    mount({ asked });
    await openLocation(user);

    expect(asked.some((url) => url.includes('/lines') && url.includes('locationId=3001'))).toBe(
      true,
    );
  });

  it('위치를 스캔하면 그 위치의 라인이 뜬다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    expect(await screen.findByLabelText(/ABC-123 · 8001 실물 수량/)).toBeTruthy();
    expect(screen.getByText('장부 120')).toBeTruthy();
  });

  /*
   * 이 화면의 핵심이다. 안 센 것을 0 으로 보내면 관리웹이 그것을 전량 손실로 잡는다.
   */
  it('안 센 줄은 보내지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await openLocation(user);

    await user.type(await screen.findByLabelText(/ABC-123 · 8001 실물 수량/), '118');
    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]?.json()) as {
      locationId: number;
      lines: { inventoryCountLineId: number }[];
    };

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]?.inventoryCountLineId).toBe(5101);
    expect(body.locationId).toBe(3001);
  });

  /* 세어 보니 없더라는 유효한 답이다. 0 을 못 적으면 그 사실을 남길 길이 없다. */
  it('0 을 적으면 센 것으로 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await openLocation(user);

    await user.type(await screen.findByLabelText(/ABC-123 · 8001 실물 수량/), '0');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '이 위치 완료' })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]?.json()) as { lines: { countedQty: number }[] };

    expect(body.lines[0]?.countedQty).toBe(0);
  });

  /* 안 센 줄과 0 으로 센 줄이 화면에서도 갈려야 한다. */
  it('아직 세지 않은 줄임을 화면이 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    expect(await screen.findAllByText('아직 세지 않음')).toHaveLength(2);
  });

  /*
   * 적은 값 옆에 그대로 두면 적은 것이 안 먹은 것으로 읽힌다. 서버 상태가 안 센 것인
   * 사실은 그대로라, 화면은 칸이 빈 동안에만 그 말을 한다.
   */
  it('값을 적은 줄에는 아직 세지 않았다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    await user.type(await screen.findByLabelText(/ABC-123 · 8001 실물 수량/), '118');

    await waitFor(() => {
      expect(screen.getAllByText('아직 세지 않음')).toHaveLength(1);
    });
  });

  /* 지우면 다시 안 센 줄이다. 한 번 적었다고 그 사실이 사라지지 않는다. */
  it('적은 값을 지우면 아직 세지 않았다고 다시 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    const field = await screen.findByLabelText(/ABC-123 · 8001 실물 수량/);
    await user.type(field, '118');
    await user.clear(field);

    await waitFor(() => {
      expect(screen.getAllByText('아직 세지 않음')).toHaveLength(2);
    });
  });

  it('이미 센 줄은 이전 값을 보인다', async () => {
    const user = userEvent.setup();
    mount({ firstCounted: true });
    await openLocation(user);

    expect(await screen.findByText('이전 값 118')).toBeTruthy();
  });

  /* 장부를 보고 그대로 적는 것을 막는 실사다. 서버가 장부를 안 내려보낸다. */
  it('장부를 감춘 실사에서는 장부를 보이지 않는다', async () => {
    const user = userEvent.setup();
    mount({ blind: true });
    await openLocation(user);

    expect(await screen.findByText(/장부 수량을 감춘 실사입니다/)).toBeTruthy();
    expect(screen.queryByText(/^장부 \d/)).toBeNull();
  });

  it('한 줄도 적지 않으면 완료할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    await screen.findByLabelText(/ABC-123 · 8001 실물 수량/);

    expect(screen.getByRole('button', { name: '이 위치 완료' })).toBeDisabled();
  });

  /*
   * 단말이 재접속하면 조회가 다시 돈다. 그때 적어 둔 것을 덮어쓰면 한 선반을 다 센 사람이
   * 아무 말 없이 처음부터 다시 센다.
   */
  it('다시 읽어와도 적어 둔 수량이 남는다', async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const otherDevice = { counted: false };
    mount({ otherDevice }, queryClient);
    await openLocation(user);

    await user.type(await screen.findByLabelText(/ABC-123 · 8001 실물 수량/), '118');

    /* 다른 단말이 둘째 줄을 센다. 그 사실은 받아 오되 내가 적은 것은 그대로여야 한다. */
    otherDevice.counted = true;
    await queryClient.invalidateQueries({ queryKey: ['physical-count-lines'] });

    expect(await screen.findByText('이전 값 37')).toBeTruthy();
    expect((screen.getByLabelText(/ABC-123 · 8001 실물 수량/) as HTMLInputElement).value).toBe(
      '118',
    );
  });

  it('라인이 없는 위치는 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    mount({ emptyLocation: true });
    await openLocation(user);

    expect(await screen.findByText(/이 위치에는 실사 라인이 없습니다/)).toBeTruthy();
  });

  /*
   * 연타는 button.click() 을 연속으로 불러야 갈린다. await user.click() 세 번은 클릭 사이에
   * 다시 그리기가 끼어 결함이 있어도 통과한다.
   */
  it('연타해도 한 건만 담는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await openLocation(user);

    await user.type(await screen.findByLabelText(/ABC-123 · 8001 실물 수량/), '118');

    const button = screen.getByRole('button', { name: '이 위치 완료' });
    button.click();
    button.click();
    button.click();

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });

    const keys = new Set(seen.map((each) => each.headers.get('Idempotency-Key')));

    expect(keys.size).toBe(1);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 센 줄 안다. */
  it('단말 보관소가 거절하면 기록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openLocation(user);

    await user.type(await screen.findByLabelText(/ABC-123 · 8001 실물 수량/), '118');

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '이 위치 완료' }));

    expect(await screen.findByText('센 것을 저장하지 못했습니다')).toBeTruthy();
  });
});
