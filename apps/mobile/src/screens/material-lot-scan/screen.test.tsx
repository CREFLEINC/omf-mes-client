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
import { runBackStep } from '../../patterns/back-step';
import { formatMaterialLotNo } from '../../patterns/material-lot-no';
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
  /* 셸이 기동할 때 부른다. 빠뜨리면 모의가 실제 모듈과 어긋나 처리되지 않은 오류가 난다. */
  readPlantId: () => Promise.resolve(null),
  rememberPlant: () => Promise.resolve(),
  forgetPlant: () => Promise.resolve(),
}));

const page = { page: 1, size: 200, total: 1, totalElements: 1, totalPages: 1 };

const RECEIPT_NO = 'IR-2026-000041';
/* 제품코드9 · 수량9 · 날짜6 · 공급사6 · 번호4 = 34자리. */
const LOT_NO = '123456789' + '000000500' + '260731' + '778899' + '0007';

interface Options {
  /** 라인 품목의 코드를 바꿔 답한다 - 라벨의 제품코드와 견주는 자리를 재려면 아홉 자리여야 한다. */
  itemCode?: string;
  /** 라인 전부가 이미 LOT 을 가진 것으로 답한다. */
  allFilled?: boolean;
  /** 보낸 요청을 모은다. */
  seen?: Request[];
  /** 물어본 주소를 모은다. 응답만 돌려주는 스텁은 조회 축이 빠진 것을 잡지 못한다. */
  asked?: string[];
  /** 보내기가 끝나지 않는다 - 담긴 채로 남은 건을 화면이 어떻게 보는지 재는 자리다. */
  sendHangs?: boolean;
  /** 서버가 같은 번호를 거절한다 - 스캔값이 곧 번호라 다시 불러도 풀리지 않는다. */
  duplicateLotNo?: boolean;
  /**
   * 보내기의 답을 회차마다 바꾼다.
   *
   * 오프라인에서 담은 건의 판정은 한참 뒤 셸이 도는 회차에 선다. 처음부터 거절로 답하면 그
   * 시차가 없어져, 화면이 뒤늦은 되돌아옴을 알아보는지 잴 수 없다.
   */
  mode?: { value: 'ok' | 'error' | 'duplicate' };
}

const DUPLICATE = {
  code: 'DUPLICATE_LOT_NO',
  message: '이미 등록된 LOT 번호입니다.',
  errors: [],
};

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

      if (options.sendHangs === true) {
        return new Promise<Response>(() => undefined);
      }

      const mode = options.mode?.value;

      if (mode === 'error') {
        return Promise.reject(new Error('연결이 끊겼습니다'));
      }

      /* 409 가 아니라 400 이다. 다시 시도가 아니라 다른 번호를 요구해야 한다. */
      return options.duplicateLotNo === true || mode === 'duplicate'
        ? jsonResponse(DUPLICATE, { status: 400 })
        : jsonResponse({ lotId: 8101 }, { status: 201 });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: [
          {
            itemId: 2002,
            itemCode: options.itemCode ?? 'ABC-123',
            itemName: '하우징',
            fifoPolicyCode: 'FIFO',
          },
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
  const field = screen.getByLabelText(/자재LOT 스캔/) as HTMLInputElement;
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
  await screen.findByText(/라인 #2/);
};

beforeEach(() => {
  held.failWrite = null;
  claims.plantId = 1001;
  store.clear();
  localStorage.clear();
});

describe('자재LOT 스캔·등록 화면', () => {
  /*
   * 라벨의 제품코드가 고른 라인의 품목과 다르면 다른 자재의 라벨이다. 그대로 등록하면 그
   * 라인에 남의 LOT 이 붙고, 그 뒤로는 무엇이 어디 있는지 아무도 모른다.
   */
  it('라인의 품목과 다른 라벨은 등록할 수 없다', async () => {
    const user = userEvent.setup();
    mount({ itemCode: '000123450' });
    await user.click(await screen.findByRole('combobox', { name: '입하 건' }));
    await user.click(await screen.findByRole('option', { name: `${RECEIPT_NO} · 2026-09-05` }));
    await user.click(await screen.findByRole('combobox', { name: '입하 라인' }));
    await user.click(await screen.findByRole('option', { name: /000123450/ }));
    await screen.findByText(/라인 #2/);

    /* 제품코드9 · 수량9 · 날짜6 · 공급사6 · 번호4. 앞 아홉 자리만 라인 품목과 다르다. */
    scan('999999999' + '000000480' + '260905' + '000123' + '0007');

    expect(await screen.findByText('이 입하 라인의 품목과 다른 LOT입니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '이 라인 등록' })).toBeDisabled();
  });

  /*
   * 견주는 자리가 늘 막는 쪽으로 기울면 옳은 라벨까지 전부 막혀 현장이 선다. 막는 시험만으로는
   * 그 기울기가 드러나지 않는다.
   */
  it('라인의 품목과 같은 라벨은 등록할 수 있다', async () => {
    const user = userEvent.setup();
    mount({ itemCode: LOT_NO.slice(0, 9) });
    await user.click(await screen.findByRole('combobox', { name: '입하 건' }));
    await user.click(await screen.findByRole('option', { name: `${RECEIPT_NO} · 2026-09-05` }));
    await user.click(await screen.findByRole('combobox', { name: '입하 라인' }));
    await user.click(await screen.findByRole('option', { name: new RegExp(LOT_NO.slice(0, 9)) }));
    await screen.findByText(/라인 #2/);

    scan(LOT_NO);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '이 라인 등록' })).not.toBeDisabled();
    });
    expect(screen.queryByText('이 입하 라인의 품목과 다른 LOT입니다')).toBeNull();
  });

  /*
   * 라우터 이력에는 이 화면 하나뿐이다. 단계를 되돌리지 않으면 입하 건을 고르고 스캔하던
   * 사람이 뒤로가기 한 번에 작업 목록까지 나가 처음부터 다시 들어와야 한다.
   */
  it('뒤로가기는 고른 라인을 먼저 놓는다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    expect(runBackStep()).toBe(true);

    expect(await screen.findByRole('combobox', { name: '입하 라인' })).toBeTruthy();
    expect(screen.queryByText(/라인 #2/)).toBeNull();
  });

  /* P/O 를 고르는 화면이 아니다. 입하 라인이 이미 있고 원천이 그 라인을 가리킨다. */
  it('입하 건과 라인을 골라야 스캔할 수 있다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    expect(screen.getByLabelText(/자재LOT 스캔/)).toBeTruthy();
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

  /* 서버가 되돌리면 400 이다. 다시 보내도 풀리지 않으니 다른 라벨을 요구해야 한다. */
  it('서버가 같은 번호를 거절하면 되돌아왔다고 말한다', async () => {
    const user = userEvent.setup();
    mount({ duplicateLotNo: true });
    await pickLine(user);

    await scanAndWait(LOT_NO);
    await user.click(screen.getByRole('button', { name: '이 라인 등록' }));

    expect(await screen.findByText('등록을 전송하지 못했습니다')).toBeTruthy();
  });

  /*
   * 오프라인에서 담은 건은 셸이 도는 다른 회차에 판정된다. 그때 화면은 이미 등록됨을
   * 보이고 있어, 완료할 때 다시 보지 않으면 사람은 되돌아온 것을 모른 채 화면을 닫는다.
   */
  it('뒤늦게 되돌아온 건을 완료할 때 알아본다', async () => {
    const user = userEvent.setup();
    const mode = { value: 'error' as 'ok' | 'error' | 'duplicate' };
    mount({ mode });
    await pickLine(user);

    await scanAndWait(LOT_NO);
    await user.click(screen.getByRole('button', { name: '이 라인 등록' }));
    await screen.findByText(/등록됨 \(1건\)/);

    mode.value = 'duplicate';
    window.dispatchEvent(new Event('online'));

    await user.click(screen.getByRole('button', { name: '등록 완료' }));

    expect(await screen.findByText('등록을 전송하지 못했습니다')).toBeTruthy();
  });

  /* 같은 라벨을 두 번 스캔하면 서버가 400 으로 되돌린다. 화면이 미리 막는다. */
  it('이 회차에 이미 등록한 번호는 다시 등록할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    await scanAndWait(LOT_NO);
    await user.click(screen.getByRole('button', { name: '이 라인 등록' }));
    await screen.findByText(/등록됨 \(1건\)/);

    await user.click(await screen.findByRole('combobox', { name: '입하 라인' }));
    await user.click(await screen.findByRole('option', { name: '#3 · RM-1001 · 60' }));
    scan(LOT_NO);

    expect(await screen.findByText('이미 등록된 LOT 번호입니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '이 라인 등록' })).toBeDisabled();
  });

  /* 유일성은 공장과 번호의 짝이다. 공장을 모르면 어느 짝인지 정할 수 없다. */
  it('단말 공장을 모르면 등록할 수 없다', async () => {
    const user = userEvent.setup();
    claims.plantId = null;
    mount();
    await pickLine(user);

    scan(LOT_NO);

    expect(await screen.findByText(/기기의 공장을 읽지 못했습니다/)).toBeTruthy();
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

    expect(await screen.findByText('등록을 저장하지 못했습니다')).toBeTruthy();
  });
  /**
   * 스캔 하나가 이 화면의 대상을 정한다. 이미 읽은 뒤에 다른 라벨을 스치면 대상이 조용히
   * 바뀌는데, 작업자는 앞엣것에 적는 줄 알고 등록 단추를 누른다.
   */
  it('이미 읽은 뒤 다른 값을 읽으면 되묻는다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    await scanAndWait(LOT_NO);

    const other = '123456789' + '000000500' + '260731' + '778899' + '0009';
    scan(other);

    expect(await screen.findByText('다시 스캔했습니다')).toBeTruthy();
    expect(await screen.findByRole('button', { name: '그대로 두기' })).toBeTruthy();
  });

  it('되물은 창에서 그대로 두면 앞엣것이 남는다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    await scanAndWait(LOT_NO);
    scan('123456789' + '000000500' + '260731' + '778899' + '0009');

    await user.click(await screen.findByRole('button', { name: '그대로 두기' }));

    /* 창이 사라지는 것이 아니라 대상이 안 바뀐 것을 잰다 - 그것이 이 단추가 하는 일이다. */
    expect(screen.getByText(formatMaterialLotNo(LOT_NO))).toBeTruthy();
    expect(screen.getByRole('button', { name: '이 라인 등록' })).not.toBeDisabled();
  });

  it('되물은 창에서 바꾸면 새로 읽은 값이 대상이 된다', async () => {
    const user = userEvent.setup();
    mount();
    await pickLine(user);

    await scanAndWait(LOT_NO);
    const other = '123456789' + '000000500' + '260731' + '778899' + '0009';
    scan(other);

    await user.click(await screen.findByRole('button', { name: '새로 읽은 값으로' }));

    expect(await screen.findByText(formatMaterialLotNo(other))).toBeTruthy();
  });
});
