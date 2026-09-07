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
import { MaterialLotScanScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());
/** 단말 보관소가 거절하는 상황을 만든다. 담기지 못한 것을 화면이 말하는지 보기 위해서다. */
const held = vi.hoisted(() => ({ failWrite: null as string | null }));
const claims = vi.hoisted(() => ({ plantId: 1001 as number | null }));

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

vi.mock('../../patterns/plant', () => ({
  currentPlantId: () => claims.plantId,
}));

const page = { page: 1, size: 200, total: 1, totalElements: 1, totalPages: 1 };

const RECEIPT_NO = 'IR-2026-000041';
/* 제품코드9 · 수량9 · 날짜6 · 공급사6 · 번호4 = 34자리. */
const LOT_NO = '123456789' + '000000500' + '260731' + '778899' + '0007';

interface Options {
  /** 라인 전부가 이미 LOT 을 가진 것으로 답한다. */
  allFilled?: boolean;
  /** 보낸 요청을 모은다. */
  seen?: Request[];
  /** 물어본 주소를 모은다. 응답만 돌려주는 스텁은 조회 축이 빠진 것을 잡지 못한다. */
  asked?: string[];
  /** 보내기가 끝나지 않는다 - 담긴 채로 남은 건을 화면이 어떻게 보는지 재는 자리다. */
  sendHangs?: boolean;
}

const line = (overrides: Record<string, unknown> = {}) => ({
  inboundReceiptLineId: 7101,
  inboundReceiptId: 7001,
  lineNo: 2,
  itemId: 2002,
  receivedQty: 480,
  uomId: 1001,
  supplierLotMissing: false,
  inspectionRequired: true,
  statusCode: 'REGISTERED',
  lotId: null,
  ...overrides,
});

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/logistics/inbound-receipts',
    respond: (req) => {
      options.asked?.push(req.url);

      return jsonResponse({
        items: [
          {
            inboundReceiptId: 7001,
            inboundReceiptNo: RECEIPT_NO,
            supplierId: 4001,
            plantId: 1001,
            receiptDatetime: '2026-09-05T09:00:00+09:00',
            statusCode: 'REGISTERED',
          },
        ],
        page,
      });
    },
  },
  {
    match: (req) => /\/logistics\/inbound-receipts\/\d+\/lines/.test(new URL(req.url).pathname),
    respond: (req) => {
      options.asked?.push(req.url);

      return jsonResponse({
        items: [
          line({ lotId: options.allFilled === true ? 8001 : null }),
          line({
            inboundReceiptLineId: 7102,
            lineNo: 3,
            itemId: 2001,
            receivedQty: 60,
            lotId: options.allFilled === true ? 8002 : null,
          }),
        ],
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/trace/lots',
    respond: (req) => {
      options.seen?.push(req.clone());

      return options.sendHangs === true
        ? new Promise<Response>(() => undefined)
        : jsonResponse({ lotId: 8101 }, { status: 201 });
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

const mount = (options: Options = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <MaterialLotScanScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch(routes(options)) },
  );

const scan = (value: string) => {
  const field = screen.getByLabelText('자재LOT 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

/**
 * 스캔하고 화면이 그 값을 받은 것을 확인한다.
 *
 * 단추는 라인을 고른 순간부터 있고 그때는 아직 비활성이다. 다시 그리기를 기다리지 않고
 * 누르면 비활성 단추를 누른 것이라 아무 일도 일어나지 않는데, 시험은 그것을 클릭이 먹은
 * 것으로 읽는다.
 */
const scanAndWait = async (value: string) => {
  scan(value);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '이 라인 등록' })).not.toBeDisabled();
  });
};

const pickLine = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('combobox', { name: '입하 건' }));
  await user.click(await screen.findByRole('option', { name: `${RECEIPT_NO} · 2026-09-05` }));
  await user.click(await screen.findByRole('combobox', { name: '입하 라인' }));
  await user.click(await screen.findByRole('option', { name: '#2 · ABC-123 · 480' }));
  await screen.findByText('라인 #2');
};

beforeEach(() => {
  held.failWrite = null;
  claims.plantId = 1001;
  store.clear();
  localStorage.clear();
});

describe('자재LOT 스캔·등록 화면', () => {
  /* P/O 를 고르는 화면이 아니다. 입하 라인이 이미 있고 원천이 그 라인을 가리킨다. */
  it('입하 건과 라인을 골라야 스캔할 수 있다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    expect(screen.getByLabelText('자재LOT 스캔')).toBeTruthy();
  });

  /* 사전부착 라인만 이 화면 몫이다. 미부착은 서버 채번이라 다른 화면이 한다. */
  it('사전부착 건과 사전부착 라인을 각각 물어본다', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];
    mount({ asked });
    await pickLine(user);

    const carries = (part: string) =>
      asked.some((url) => url.includes(part) && url.includes('supplierLotMissing=false'));

    expect(carries('/logistics/inbound-receipts?')).toBe(true);
    expect(carries('/lines')).toBe(true);
  });

  /*
   * 화면을 나갔다 들어오면 이 회차의 등록 목록은 비어 있다. 큐를 보지 않으면 아직 안 간 건의
   * 라인이 다시 목록에 서고, 같은 라인에 LOT 이 둘 생긴다.
   */
  it('앞선 회차가 큐에 담아 둔 라인은 고를 수 없다', async () => {
    const user = userEvent.setup();
    store.set(
      'outbox',
      JSON.stringify([
        {
          id: 'queued-1',
          label: '자재LOT 등록',
          workerNo: '100028',
          idempotencyKey: 'key-queued-1',
          method: 'POST',
          path: '/trace/lots',
          body: { lotNo: LOT_NO, sourceId: 7101 },
          occurredAt: '2026-09-06T09:00:00+09:00',
          confirmation: 'pending',
        },
      ]),
    );
    mount({ sendHangs: true });

    await user.click(await screen.findByRole('combobox', { name: '입하 건' }));
    await user.click(await screen.findByRole('option', { name: `${RECEIPT_NO} · 2026-09-05` }));
    await user.click(await screen.findByRole('combobox', { name: '입하 라인' }));

    expect(await screen.findByRole('option', { name: '#3 · RM-1001 · 60' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '#2 · ABC-123 · 480' })).toBeNull();
  });

  /* 도착 때 스캔한 라인은 입하 등록이 이미 만들었다. 여기서 또 만들면 400 이다. */
  it('LOT 이 이미 있는 라인은 고를 수 없다', async () => {
    const user = userEvent.setup();
    mount({ allFilled: true });

    await user.click(await screen.findByRole('combobox', { name: '입하 건' }));
    await user.click(await screen.findByRole('option', { name: `${RECEIPT_NO} · 2026-09-05` }));

    expect(await screen.findByText(/LOT 이 비어 있는 사전부착 라인이 없습니다/)).toBeTruthy();
  });

  it('34자리가 아니면 등록할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    scan(LOT_NO.slice(0, 30));

    expect(await screen.findByText(/34자리입니다 \(현재 30자리\)/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '이 라인 등록' })).toBeDisabled();
  });

  /* Date 는 2월 31일을 3월 3일로 굴려 받는다. 라벨에 없는 날짜가 기록으로 남는다. */
  it('라벨의 날짜가 없는 날짜면 등록할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    scan('123456789' + '000000500' + '260231' + '778899' + '0007');

    expect(await screen.findByText(/날짜 자리가 날짜가 아닙니다/)).toBeTruthy();
  });

  /* 라벨 수량은 최초 납품 스냅샷이라 라인 수량과 다를 수 있다. 막지는 않는다. */
  it('라벨 수량이 라인 수량과 다르면 말하되 막지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    scan(LOT_NO);

    expect(await screen.findByText(/라벨 수량 500 이 라인 수량 480 과 다릅니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '이 라인 등록' })).not.toBeDisabled();
  });

  it('등록하면 공급사 채번으로 그 라인의 LOT 을 만든다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await pickLine(user);

    await scanAndWait(LOT_NO);
    await user.click(screen.getByRole('button', { name: '이 라인 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]?.json()) as {
      numberSourceCode: string;
      lotNo: string;
      sourceTypeCode: string;
      sourceId: number;
      initialQty: number;
    };

    expect(body.numberSourceCode).toBe('SUPPLIER');
    expect(body.lotNo).toBe(LOT_NO);
    expect(body.sourceTypeCode).toBe('INBOUND_RECEIPT_LINE');
    expect(body.sourceId).toBe(7101);
    expect(body.initialQty).toBe(500);
  });

  /* 라인 하나에 LOT 은 하나다. 큐에 담긴 것은 서버 목록에 없어 라인이 그대로 남는다. */
  it('등록한 라인은 다시 고를 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    await scanAndWait(LOT_NO);
    await user.click(screen.getByRole('button', { name: '이 라인 등록' }));
    await screen.findByText(/등록됨 \(1건\)/);

    await user.click(await screen.findByRole('combobox', { name: '입하 라인' }));

    expect(screen.queryByRole('option', { name: '#2 · ABC-123 · 480' })).toBeNull();
    expect(screen.getByRole('option', { name: '#3 · RM-1001 · 60' })).toBeTruthy();
  });

  /* 유일성은 공장과 번호의 짝이다. 공장을 모르면 어느 짝인지 정할 수 없다. */
  it('단말 공장을 모르면 등록할 수 없다', async () => {
    const user = userEvent.setup();
    claims.plantId = null;
    mount();
    await pickLine(user);

    scan(LOT_NO);

    expect(await screen.findByText(/단말 공장을 읽지 못했습니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '이 라인 등록' })).toBeDisabled();
  });

  /*
   * 연타는 button.click() 을 연속으로 불러야 갈린다. await user.click() 세 번은 클릭 사이에
   * 다시 그리기가 끼어 결함이 있어도 통과한다.
   */
  it('연타해도 한 건만 담는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await pickLine(user);

    await scanAndWait(LOT_NO);
    const button = screen.getByRole('button', { name: '이 라인 등록' });
    button.click();
    button.click();
    button.click();

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });

    const keys = new Set(seen.map((each) => each.headers.get('Idempotency-Key')));

    expect(keys.size).toBe(1);
  });

  /* 담기지 못하면 등록이 어디에도 없다. 말하지 않으면 사람은 등록된 줄 안다. */
  it('단말 보관소가 거절하면 등록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    await scanAndWait(LOT_NO);
    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '이 라인 등록' }));

    expect(await screen.findByText('등록을 담아 두지 못했습니다')).toBeTruthy();
  });
});
