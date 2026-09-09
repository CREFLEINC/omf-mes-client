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
import { InboundReceiptScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());
/** 단말 토큰이 싣고 오는 공장. 시험 환경에는 토큰이 없어 값을 여기서 정한다. */
const plant = vi.hoisted(() => ({ id: null as number | null }));

vi.mock('../../patterns/plant', () => ({
  currentPlantId: () => plant.id,
}));
/** 장갑 낀 손은 화면을 안 보고 있을 수 있다. 소리로도 알리는지 본다(공유계약 D-2). */
const tone = vi.hoisted(() => ({ played: 0 }));

vi.mock('../../patterns/error-tone', () => ({
  playErrorTone: () => {
    tone.played += 1;
  },
}));
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

const SCANNED = '7770001118880002229901015554447777';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

/** 공급사 조회에 실린 역할. 거르지 않으면 고객사가 공급사 후보에 섞인다. */
const partnerQueries: (string | null)[] = [];

const order = {
  purchaseOrderId: 7,
  purchaseOrderNo: 'PO-2026-0003',
  supplierId: 2,
  businessUnitId: 1,
  plantId: 1,
  orderDate: '2026-08-20',
  statusCode: 'OPEN',
};

const poLine = (overrides: Record<string, unknown> = {}) => ({
  purchaseOrderLineId: 41,
  purchaseOrderId: 7,
  lineNo: 1,
  itemId: 31,
  orderedQty: 500,
  uomId: 9,
  receivedQty: 0,
  toleranceOverQty: 10,
  toleranceUnderQty: 5,
  ...overrides,
});

interface Options {
  lines?: unknown[];
  ordersStatus?: number;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/logistics/purchase-orders',
    respond: () =>
      options.ordersStatus === undefined
        ? jsonResponse({ items: [order], page })
        : jsonResponse({ message: '실패' }, { status: options.ordersStatus }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/logistics/purchase-orders/7',
    respond: () => jsonResponse({ purchaseOrder: order, lines: options.lines ?? [poLine()] }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/code-values',
    respond: (req) => {
      const group = new URL(req.url).searchParams.get('codeGroupCode');
      const options =
        group === 'INBOUND_RECEIPT_EXCEPTION_TYPE'
          ? [
              { code: 'URGENT_RECEIPT', codeName: '긴급 입하' },
              { code: 'OVER_DELIVERY', codeName: '초과 납품' },
            ]
          : [{ code: 'NO_LABEL', codeName: '라벨 없음' }];

      return jsonResponse({
        items: options.map((option, index) => ({
          codeValueId: 1,
          codeGroupId: 5,
          ...option,
          displayOrder: index + 1,
          isActive: true,
        })),
        page,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: [{ itemId: 31, itemCode: 'ABC-123', itemName: '원자재', fifoPolicyCode: 'FIFO' }],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items/31',
    respond: () =>
      jsonResponse({ item: { itemCode: 'ABC-123', itemName: '원자재', fifoPolicyCode: 'FIFO' } }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/uoms',
    respond: () => jsonResponse({ items: [{ uomId: 9, uomCode: 'EA' }], page }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/partners',
    respond: (req) => {
      partnerQueries.push(new URL(req.url).searchParams.get('roleTypeCode'));

      return jsonResponse({
        items: [{ partnerId: 2, partnerName: '합성공급사' }],
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
        <InboundReceiptScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...extra, ...routes(options)]) },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText('LOT 번호') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

beforeEach(() => {
  plant.id = 1;
  partnerQueries.length = 0;
  store.clear();
  localStorage.clear();
  held.failWrite = null;
});

describe('입하 등록 화면', () => {
  /*
   * 번호 앞 아홉 자리가 제품코드다. 그것으로 품목을 찾으면 후보를 좁힐 수 있고,
   * 좁히지 않으면 담당자가 미마감 전건을 훑는다 - 잘못 고르면 그 입하가 다른 발주에 붙는다.
   */
  it('스캔한 번호의 품목이 있는 ERP W/O 만 후보로 낸다', async () => {
    const asked: (string | null)[] = [];
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/mdm/items',
        respond: () =>
          jsonResponse({
            items: [{ itemId: 77, itemCode: SCANNED.slice(0, 9), itemName: '스캔한 자재' }],
            page,
          }),
      },
      {
        match: (req) => new URL(req.url).pathname === '/logistics/purchase-orders',
        respond: (req) => {
          asked.push(new URL(req.url).searchParams.get('itemId'));
          return jsonResponse({ items: [order], page });
        },
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(await screen.findByText('스캔한 자재의 품목이 있는 ERP W/O만 보입니다.')).toBeTruthy();
    expect(asked).toContain('77');

    await user.click(screen.getByRole('button', { name: '전체 ERP W/O 보기' }));

    await waitFor(() => {
      expect(asked).toContain(null);
    });
    expect(screen.getByText(/담당자가 고릅니다/)).toBeTruthy();
  });

  /*
   * 부품의 골격이 포커스 연동 버퍼다(공유계약 D-4). 고르지도 않은 칸에 숫자판이 붙어 있으면
   * 어느 칸에 들어가는지 알 수 없다. 이 화면은 숫자 칸이 둘이다.
   */
  it('숫자판은 고른 칸에만 붙는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    expect(screen.queryByRole('button', { name: '7' })).toBeNull();

    await user.click(screen.getByLabelText(/실입하\ 수량/));

    expect(screen.getByRole('button', { name: '7' })).toBeTruthy();
  });

  /*
   * 세로 화면이라 채운 구획이 화면을 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다.
   * 한 손은 스캐너를 들고 있어 스크롤로 찾게 두면 안 된다.
   */
  it('LOT 을 받으면 다음 구획을 화면 안으로 들인다', async () => {
    const pulled: string[] = [];

    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value(this: Element) {
        pulled.push(this.textContent?.slice(0, 12) ?? '');
      },
    });

    mount();
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    await screen.findByText('ERP W/O 선택');
    expect(pulled.some((text) => text.startsWith('ERP W/O 선택'))).toBe(true);
  });

  /* 스캔 오류는 소리로도 알린다. 장갑 낀 손은 단말을 허리에 매달고 화면을 안 본다. */
  it('양식이 아닌 값을 받으면 소리로도 알린다', async () => {
    tone.played = 0;
    mount();

    await screen.findByLabelText('LOT 번호');
    scan('123');

    await screen.findByText('자재 LOT 번호는 34자리 숫자입니다 (현재 3자)');
    expect(tone.played).toBe(1);
  });

  /*
   * 스캔 칸은 소프트 키보드를 꺼 둔 자리라 손으로 칠 수 없다. 직접 입력이 그 칸을 연다 -
   * 칸을 따로 두면 어느 쪽이 기본인지 흐려진다(공유계약 D-3).
   */
  it('직접 입력을 누르면 스캔 칸이 열린다', async () => {
    const user = userEvent.setup();
    mount();

    const field = await screen.findByLabelText('LOT 번호');

    expect(field).toHaveAttribute('inputmode', 'none');

    await user.click(screen.getByRole('button', { name: '직접 입력' }));

    expect(field).toHaveAttribute('inputmode', 'text');
    expect(screen.getByRole('button', { name: '넣기' })).toBeTruthy();
  });

  /* 자릿수와 숫자 전용은 저장소가 막지 않는다. 화면이 지키지 않으면 어긋난 채로 저장된다. */
  it('34자리 숫자가 아니면 받지 않고 몇 자인지 말한다', async () => {
    mount();

    await screen.findByLabelText('LOT 번호');
    scan('123');

    expect(await screen.findByText('자재 LOT 번호는 34자리 숫자입니다 (현재 3자)')).toBeTruthy();
    expect(screen.queryByText('ERP W/O 선택')).toBeNull();
  });

  it('스캔하면 공급사 LOT으로 들고 발주 선택을 연다', async () => {
    mount();

    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(await screen.findByText(`공급사 LOT ${SCANNED}`)).toBeTruthy();
    expect(screen.getByText('ERP W/O 선택')).toBeTruthy();
  });

  /* 번호만으로는 어느 발주 물품인지 확정되지 않는다. 담당자가 고른다. */
  it('스캔값이 발주를 정하지 않는다고 말한다', async () => {
    mount();

    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(
      await screen.findByText(
        '스캔한 번호만으로는 ERP W/O가 정해지지 않습니다. 담당자가 고릅니다.',
      ),
    ).toBeTruthy();
  });

  /* 미부착 분기는 데이터에 있는 구분이다. 사유 없이 참으로 보내면 서버가 거부한다. */
  it('LOT 번호 없음을 고르면 대체 사유를 받는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));

    expect(await screen.findByText('LOT 번호가 붙어 있지 않습니다')).toBeTruthy();
    expect(screen.getByText(/대체\ LOT\ 사유/)).toBeTruthy();
  });

  /* 확인하지 못한 것을 발주가 없는 것으로 말하지 않는다. */
  it('발주 조회 실패를 발주 없음으로 말하지 않는다', async () => {
    mount([], { ordersStatus: 500 });

    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(
      await screen.findByText('ERP W/O를 확인할 수 없습니다. 연결을 확인하세요.'),
    ).toBeTruthy();
    expect(screen.queryByText('미마감 ERP W/O가 없습니다')).toBeNull();
  });

  /* 발주 없이 도착한 건은 공급사의 출처가 이 화면에 없다. 있는 것처럼 두지 않는다. */
  it('발주 없이 도착한 건을 넣을 길을 연다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    await user.click(await screen.findByRole('button', { name: 'ERP W/O 없이 등록' }));

    expect(await screen.findByText('ERP W/O 없이 도착')).toBeTruthy();
    expect(await screen.findByRole('combobox', { name: new RegExp('공급사') })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: new RegExp('품목') })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: new RegExp('단위') })).toBeTruthy();
  });

  /* 없어도 등록을 막지 않는다. 다만 없다는 사실은 말한다. */
  it('명세서 번호가 없어도 막지 않고 그 사실만 말한다', async () => {
    mount();

    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(await screen.findByText('명세서 번호가 없습니다. 등록은 진행됩니다.')).toBeTruthy();
  });
});

const choosePoLine = async (
  user: ReturnType<typeof userEvent.setup>,
  lineName: RegExp = /ABC-123|31/,
) => {
  scan(SCANNED);
  await screen.findByText('ERP W/O 선택');
  await user.click(screen.getByRole('combobox', { name: 'ERP W/O 번호' }));
  await user.click(await screen.findByRole('option', { name: 'PO-2026-0003' }));
  await user.click(await screen.findByRole('button', { name: lineName }));
};

describe('입하 등록 화면 — 발주 경로', () => {
  it('발주 라인을 고르면 예정 수량과 누적 입하와 허용치를 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);
    await screen.findByText('ERP W/O 선택');

    await user.click(screen.getByRole('combobox', { name: 'ERP W/O 번호' }));
    await user.click(await screen.findByRole('option', { name: 'PO-2026-0003' }));

    expect(await screen.findByText(/누적 입하 0/)).toBeTruthy();
    expect(screen.getByText(/허용 \+10 \/ -5/)).toBeTruthy();
  });

  /*
   * 판정이 견주는 것은 발주 총량이 아니라 남은 예정이다. 총량만 칸 옆에 두면 적는 사람이
   * 그 수에 맞추려 하고, 판정은 다른 수로 나온다.
   */
  it('칸 옆에 발주 총량과 남은 예정을 함께 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    expect(await screen.findByText('발주 500 EA')).toBeTruthy();
    expect(screen.getByText('남은 예정 500 EA')).toBeTruthy();
  });

  /* 허용치는 발주 라인이 갖고 있고 서버가 다시 판정하지 않는다. */
  it('허용치 안이면 예정과 맞다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '505');

    expect(await screen.findByText('남은 예정과 맞습니다')).toBeTruthy();
  });

  /* 판정 결과를 먼저 보인 뒤에 넘긴다. 조용히 넘기면 왜 왔는지 알 수 없다. */
  it('초과면 판정값을 말하고 같은 화면에 분리 단계를 연다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '511');

    expect(await screen.findByText('수량 초과 — 남은 예정 500, 이번 도착 511')).toBeTruthy();
    expect(screen.getByText('초과 입하 분리')).toBeTruthy();
    expect(screen.getByText('510 EA')).toBeTruthy();
    expect(screen.getByText('1 EA')).toBeTruthy();
    expect(screen.getByRole('button', { name: '정량+초과 분리 등록' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '정량분만 등록' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '초과분만 등록' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '입하 등록' })).toBeNull();
  });

  it('부족이면 부족이라 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '400');

    expect(await screen.findByText('수량 부족 — 남은 예정 500, 이번 도착 400')).toBeTruthy();
  });

  /*
   * 화면은 더 올 것인지 알지 못한다. 트럭과 거래명세서를 본 사람이 안다. 네 수를 보이고
   * 사람이 고르게 한다 - 수 없이 고르라 하면 무엇을 고르는지 모른다.
   */
  it('부족이면 네 수를 보이고 두 갈래를 연다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '400');

    await screen.findByText('더 들어올 물량이 있습니까?');
    expect(screen.getByText('발주')).toBeTruthy();
    expect(screen.getByText('누적')).toBeTruthy();
    expect(screen.getByText('이번 도착')).toBeTruthy();
    /*
     * 판정이 견주는 남은 예정이 아니라 이번 것까지 받고도 남는 몫이다. 둘을 같은 수로 보이면
     * 사람이 무엇을 고르는지 모른 채 고른다. 발주 500 · 누적 0 · 이번 400 이라 100 이다.
     */
    const terms = screen.getAllByRole('term').map((node) => node.textContent);
    const values = screen.getAllByRole('definition').map((node) => node.textContent);

    expect(values[terms.indexOf('남은')]).toBe('100 EA');
    /* 두 길은 대등하다. 하나가 링크면 규격이 달라져 한쪽이 더 무겁게 보인다. */
    expect(screen.getByRole('button', { name: '계속 등록' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '입하 오류 등록' })).toBeTruthy();
    expect(screen.getByText(/분할 납품이면 그대로 등록합니다/)).toBeTruthy();
    expect(screen.getByText(/이번이 마지막인데 모자라면/)).toBeTruthy();
  });

  it('부족인데 고르지 않으면 등록할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '400');
    await user.type(screen.getByLabelText('포장 수'), '10');

    await screen.findByText('더 들어올 물량이 있습니까?');
    expect(screen.getByRole('button', { name: '입하 등록' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '계속 등록' }));

    expect(screen.getByRole('button', { name: '입하 등록' })).not.toBeDisabled();
  });

  /* 남겨 두면 부족하다고 답한 수량이 아닌 다른 수량이 그 답을 타고 넘어간다. */
  it('수량을 고치면 앞서 받은 답을 버린다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    const qty = await screen.findByLabelText(/실입하\ 수량/);
    await user.type(qty, '400');
    await user.type(screen.getByLabelText('포장 수'), '10');
    await screen.findByText('더 들어올 물량이 있습니까?');
    await user.click(screen.getByRole('button', { name: '계속 등록' }));
    expect(screen.getByRole('button', { name: '입하 등록' })).not.toBeDisabled();

    await user.clear(qty);
    await user.type(qty, '300');

    await screen.findByText('수량 부족 — 남은 예정 500, 이번 도착 300');
    expect(screen.getByRole('button', { name: '입하 등록' })).toBeDisabled();
  });

  it('유효기한이 제조일보다 앞서면 등록을 막는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.type(screen.getByLabelText('제조일'), '2026-07-20');
    await user.type(screen.getByLabelText('유효기한'), '2026-07-19');

    expect(await screen.findByText('유효기한이 제조일보다 앞설 수 없습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입하 등록' }).hasAttribute('disabled')).toBe(true);
  });

  /* 검사 대상 여부는 등록 뒤에 라인마다 정해진다. 화면이 정하지 않는 것을 말한다. */
  it('검사 대상 여부를 화면이 정하지 않는다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    expect(
      await screen.findByText('검사 대상 여부는 등록한 뒤에 라인마다 정해집니다'),
    ).toBeTruthy();
  });

  /* 사번은 인증이 아니라 귀속이다. 없으면 서버가 요청 자체를 받지 않는다. */
  it('등록은 헤더와 라인을 한 건에 담아 사번과 함께 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 });
        },
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(seen[0]?.headers.get('Idempotency-Key')).toBeTruthy();

    const body = (await seen[0]!.json()) as { businessDate: string; lines: unknown[] };

    expect(body.lines).toHaveLength(1);
    expect(body.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByText('입하를 등록했습니다')).toBeTruthy();
  });
});

describe('입하 등록 화면 — 초과 입하 분리', () => {
  const prepareSplit = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '511');
    await user.click(await screen.findByRole('combobox', { name: new RegExp('초과 예외 유형') }));
    await user.click(await screen.findByRole('option', { name: '초과 납품' }));
    await user.type(screen.getByLabelText(/초과\ 사유/), '발주 허용치를 넘겨 도착');
  };

  it('정량분과 초과분을 한 요청에 담고 초과분을 ERP W/O에 귀속하지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipts:split' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse(
            { created: [{ inboundReceiptId: 1 }, { inboundReceiptId: 2 }] },
            { status: 201 },
          );
        },
      },
    ]);

    await prepareSplit(user);
    await user.click(screen.getByRole('button', { name: '정량+초과 분리 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const request = seen[0]!;
    const body = (await request.json()) as {
      mode: string;
      normal: { lines: { purchaseOrderLineId: number; receivedQty: number }[] };
      excess: {
        exceptionTypeCode: string;
        exceptionReason: string;
        lines: { purchaseOrderLineId: number | null; receivedQty: number }[];
      };
    };

    expect(request.headers.get('X-Worker-No')).toBe('900028');
    expect(request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(body.mode).toBe('BOTH');
    expect(body.normal.lines[0]).toMatchObject({ purchaseOrderLineId: 41, receivedQty: 510 });
    expect(body.excess.lines[0]).toMatchObject({ purchaseOrderLineId: null, receivedQty: 1 });
    expect(body.excess.exceptionTypeCode).toBe('OVER_DELIVERY');
    expect(body.excess.exceptionReason).toBe('발주 허용치를 넘겨 도착');
    expect(await screen.findByText('입하를 등록했습니다')).toBeTruthy();
  });

  /* 같은 틱의 연타가 서로 다른 멱등키 두 건을 만들면 서버도 중복인지 알 수 없다. */
  it('분리 등록을 연달아 눌러도 단일 멱등 요청만 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/logistics/inbound-receipts:split',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse({ created: [] }, { status: 201 });
        },
      },
    ]);

    await prepareSplit(user);
    const button = screen.getByRole('button', { name: '정량+초과 분리 등록' });
    button.click();
    button.click();
    button.click();

    await screen.findByText('입하를 등록했습니다');
    expect(seen).toHaveLength(1);
  });

  /* 한 호출이 거부되면 정량분만 성공했다고 말하지 않는다. 둘은 한 트랜잭션이다. */
  it('분리 요청이 실패하면 부분 성공으로 표시하지 않는다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/logistics/inbound-receipts:split',
        respond: () =>
          jsonResponse(
            { code: 'SPLIT_REJECTED', message: '분리 등록 실패', errors: [] },
            { status: 400 },
          ),
      },
    ]);

    await prepareSplit(user);
    await user.click(screen.getByRole('button', { name: '정량+초과 분리 등록' }));

    expect(await screen.findByText('입하를 전송하지 못했습니다')).toBeTruthy();
    expect(screen.queryByText('입하를 등록했습니다')).toBeNull();
  });
});

describe('입하 등록 화면 — 되돌릴 수 없는 쓰기', () => {
  const receiptRoute = (seen: Request[]): StubRoute => ({
    match: (req) =>
      new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
    respond: (req) => {
      seen.push(req.clone());
      return jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 });
    },
  });

  /*
   * 장갑 낀 손은 한 번 더 누른다. 등록마다 멱등키를 새로 뽑으므로 두 건이 담기면 서버가
   * 흡수하지 못하고 재고가 두 번 는다. 상태로 잠그면 다시 그리기 전의 연타를 놓친다.
   */
  it('등록 단추를 같은 틱에 두 번 눌러도 한 건만 나간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([receiptRoute(seen)]);
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');

    const button = screen.getByRole('button', { name: '입하 등록' });

    button.click();
    button.click();
    button.click();

    await screen.findByText('입하를 등록했습니다');
    expect(seen).toHaveLength(1);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 등록된 줄 안다. */
  it('담아 두지 못하면 등록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([receiptRoute(seen)]);
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '입하 등록' }));

    expect(await screen.findByText('입하를 저장하지 못했습니다')).toBeTruthy();
    expect(screen.queryByText('입하를 등록했습니다')).toBeNull();
    expect(screen.queryByText('입하를 전송 대기에 넣었습니다')).toBeNull();
    expect(seen).toHaveLength(0);
  });

  /*
   * 서버가 주는 누적 입하에는 큐에 있는 것이 없다. 셈에 넣지 않으면 오프라인에서 같은 라인에
   * 두 번 적었을 때 둘 다 남은 예정 안으로 읽혀, 서버가 거부할 초과가 정상으로 보인다.
   */
  it('담긴 입하를 남은 예정에서 뺀다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
        respond: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));

    await screen.findByText('입하를 전송 대기에 넣었습니다');
    await user.click(screen.getByRole('button', { name: '다음 입하' }));

    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');

    expect(await screen.findByText('수량 초과 — 남은 예정 0, 이번 도착 500')).toBeTruthy();
  });
});

describe('입하 등록 화면 — 발주 없이 도착', () => {
  const openUnordered = async (user: ReturnType<typeof userEvent.setup>) => {
    scan(SCANNED);
    await user.click(await screen.findByRole('button', { name: 'ERP W/O 없이 등록' }));
  };

  const choose = async (user: ReturnType<typeof userEvent.setup>, name: string, option: RegExp) => {
    /* 필수 표시가 라벨에 붙어 이름이 정확히 같지 않다. */
    await user.click(await screen.findByRole('combobox', { name: new RegExp(name) }));
    await user.click(await screen.findByRole('option', { name: option }));
  };

  /*
   * 거래처 역할은 다섯이다. 거르지 않으면 고객사가 공급사 후보에 섞이고, 잘못 실린 거래처로
   * 입하가 서면 되돌릴 자리가 없다.
   */
  it('공급사 후보를 공급사 역할로 걸러 청한다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await openUnordered(user);

    await screen.findByRole('combobox', { name: new RegExp('공급사') });
    expect(partnerQueries).toContain('SUPPLIER');
    expect(partnerQueries.every((role) => role === 'SUPPLIER')).toBe(true);
  });

  it('무발주 사유를 받기 전에는 등록을 열지 않는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await openUnordered(user);
    await choose(user, '공급사', /합성공급사/);
    await choose(user, '품목', /ABC-123/);
    await choose(user, '단위', /EA/);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '40');

    expect(screen.getByRole('button', { name: '입하 등록' })).toBeDisabled();

    await choose(user, '예외입하 유형', /긴급 입하/);
    await user.type(screen.getByLabelText(/예외\ 사유/), '발주서 도착 전 긴급 입하');

    expect(screen.getByRole('button', { name: '입하 등록' })).not.toBeDisabled();
  });

  /* 발주가 없으면 승계할 곳이 없다. 고른 값과 단말의 공장이 그대로 실려야 한다. */
  it('고른 공급사와 품목과 단위를 단말 공장과 함께 싣는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    plant.id = 7;
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 });
        },
      },
    ]);

    await screen.findByLabelText('LOT 번호');
    await openUnordered(user);

    await choose(user, '공급사', /합성공급사/);
    await choose(user, '품목', /ABC-123/);
    await choose(user, '단위', /EA/);
    await choose(user, '예외입하 유형', /긴급 입하/);
    await user.type(screen.getByLabelText(/예외\ 사유/), '발주서 도착 전 긴급 입하');
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '40');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]!.json()) as {
      supplierId: number;
      plantId: number;
      exceptionTypeCode: string;
      exceptionReason: string;
      lines: { purchaseOrderLineId: number | null; itemId: number; uomId: number }[];
    };

    expect(body.supplierId).toBe(2);
    expect(body.plantId).toBe(7);
    expect(body.exceptionTypeCode).toBe('URGENT_RECEIPT');
    expect(body.exceptionReason).toBe('발주서 도착 전 긴급 입하');
    expect(body.lines[0]?.purchaseOrderLineId).toBeNull();
    expect(body.lines[0]?.itemId).toBe(31);
    expect(body.lines[0]?.uomId).toBe(9);
  });

  /* 공장을 모르는 채로 0 이나 1 을 채우면 다른 공장의 재고가 는다. */
  it('단말의 공장을 모르면 등록을 막고 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    plant.id = null;
    mount();

    await screen.findByLabelText('LOT 번호');
    await openUnordered(user);

    await choose(user, '공급사', /합성공급사/);
    await choose(user, '품목', /ABC-123/);
    await choose(user, '단위', /EA/);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '40');

    expect(screen.getByText('이 기기의 공장을 확인할 수 없어 등록할 수 없습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입하 등록' })).toBeDisabled();
  });

  /* 품목 마스터의 주인은 ERP 다. 여기서 만들 길을 찾지 않는다. */
  it('목록에 없는 품목은 여기서 만들 수 없다고 말한다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await openUnordered(user);

    expect(await screen.findByText('목록에 없는 품목은 여기서 만들 수 없습니다')).toBeTruthy();
    expect(screen.getByText('ERP에 품목이 만들어진 뒤에 고를 수 있습니다.')).toBeTruthy();
  });

  /*
   * 둘이 함께 서 있으면 고른 발주는 판정에 쓰이는데 실려 나가는 것은 손으로 고른 값이라,
   * 화면이 보이는 것과 서버에 남는 것이 달라진다.
   */
  it('발주를 고르면 무발주 갈래를 접는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await openUnordered(user);
    await choose(user, '공급사', /합성공급사/);

    await screen.findByRole('combobox', { name: new RegExp('공급사') });

    await user.click(screen.getByRole('combobox', { name: 'ERP W/O 번호' }));
    await user.click(await screen.findByRole('option', { name: 'PO-2026-0003' }));

    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: new RegExp('공급사') })).toBeNull();
    });
    expect(screen.queryByText('ERP W/O 없이 도착')).toBeNull();
    expect(screen.getByRole('button', { name: 'ERP W/O 없이 등록' })).toBeTruthy();
  });

  /* 발주가 없으면 예정 수량이 없어 초과도 부족도 판정할 것이 없다. */
  it('발주가 없으면 예정과 견주지 않는다고 말한다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await openUnordered(user);

    expect(await screen.findByText('ERP W/O가 없어 예정 수량과 비교하지 않습니다')).toBeTruthy();
  });
});
