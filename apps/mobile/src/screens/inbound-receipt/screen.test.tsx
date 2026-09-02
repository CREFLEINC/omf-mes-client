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

const SCANNED = '7770001118880002229901015554447777';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

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
    match: (req) => new URL(req.url).pathname === '/logistics/purchase-orders/7/lines',
    respond: () => jsonResponse({ items: options.lines ?? [poLine()] }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/code-values',
    respond: () =>
      jsonResponse({
        items: [
          {
            codeValueId: 1,
            codeGroupId: 5,
            code: 'NO_LABEL',
            codeName: '라벨 없음',
            displayOrder: 1,
            isActive: true,
          },
        ],
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
  const field = screen.getByLabelText('자재 LOT 스캔') as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

beforeEach(() => {
  store.clear();
  localStorage.clear();
});

describe('입하 등록 화면', () => {
  /* 자릿수와 숫자 전용은 저장소가 막지 않는다. 화면이 지키지 않으면 어긋난 채로 저장된다. */
  it('34자리 숫자가 아니면 받지 않고 몇 자인지 말한다', async () => {
    mount();

    await screen.findByLabelText('자재 LOT 스캔');
    scan('123');

    expect(await screen.findByText('자재 LOT 번호는 34자리 숫자입니다 (현재 3자)')).toBeTruthy();
    expect(screen.queryByText('P/O 선택')).toBeNull();
  });

  it('스캔하면 공급사 LOT으로 들고 발주 선택을 연다', async () => {
    mount();

    await screen.findByLabelText('자재 LOT 스캔');
    scan(SCANNED);

    expect(await screen.findByText(`공급사 LOT ${SCANNED}`)).toBeTruthy();
    expect(screen.getByText('P/O 선택')).toBeTruthy();
  });

  /* 번호만으로는 어느 발주 물품인지 확정되지 않는다. 담당자가 고른다. */
  it('스캔값이 발주를 정하지 않는다고 말한다', async () => {
    mount();

    await screen.findByLabelText('자재 LOT 스캔');
    scan(SCANNED);

    expect(
      await screen.findByText('스캔한 번호만으로는 발주가 정해지지 않습니다. 담당자가 고릅니다.'),
    ).toBeTruthy();
  });

  /* 미부착 분기는 데이터에 있는 구분이다. 사유 없이 참으로 보내면 서버가 거부한다. */
  it('LOT 번호 없음을 고르면 대체 사유를 받는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('자재 LOT 스캔');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));

    expect(await screen.findByText('LOT 번호가 붙어 있지 않습니다')).toBeTruthy();
    expect(screen.getByText('대체 LOT 사유')).toBeTruthy();
  });

  /* 확인하지 못한 것을 발주가 없는 것으로 말하지 않는다. */
  it('발주 조회 실패를 발주 없음으로 말하지 않는다', async () => {
    mount([], { ordersStatus: 500 });

    await screen.findByLabelText('자재 LOT 스캔');
    scan(SCANNED);

    expect(
      await screen.findByText('발주를 확인할 수 없습니다. 연결을 확인하세요.'),
    ).toBeTruthy();
    expect(screen.queryByText('미마감 발주가 없습니다')).toBeNull();
  });

  /* 발주 없이 도착한 건은 공급사의 출처가 이 화면에 없다. 있는 것처럼 두지 않는다. */
  it('발주 없이 도착한 건을 여기서 등록할 수 없다고 말한다', async () => {
    mount();

    await screen.findByLabelText('자재 LOT 스캔');
    scan(SCANNED);

    expect(
      await screen.findByText('발주 없이 도착한 건은 아직 이 화면에서 등록할 수 없습니다'),
    ).toBeTruthy();
  });

  /* 없어도 등록을 막지 않는다. 다만 없다는 사실은 말한다. */
  it('명세서 번호가 없어도 막지 않고 그 사실만 말한다', async () => {
    mount();

    await screen.findByLabelText('자재 LOT 스캔');
    scan(SCANNED);

    expect(await screen.findByText('명세서 번호가 없습니다. 등록은 진행됩니다.')).toBeTruthy();
  });
});

const choosePoLine = async (
  user: ReturnType<typeof userEvent.setup>,
  lineName: RegExp = /ABC-123|31/,
) => {
  scan(SCANNED);
  await screen.findByText('P/O 선택');
  await user.click(screen.getByRole('combobox', { name: '발주 번호' }));
  await user.click(await screen.findByRole('option', { name: 'PO-2026-0003' }));
  await user.click(await screen.findByRole('button', { name: lineName }));
};

describe('입하 등록 화면 — 발주 경로', () => {
  it('발주 라인을 고르면 예정 수량과 누적 입하와 허용치를 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('자재 LOT 스캔');
    scan(SCANNED);
    await screen.findByText('P/O 선택');

    await user.click(screen.getByRole('combobox', { name: '발주 번호' }));
    await user.click(await screen.findByRole('option', { name: 'PO-2026-0003' }));

    expect(await screen.findByText(/누적 입하 0/)).toBeTruthy();
    expect(screen.getByText(/허용 \+10 \/ -5/)).toBeTruthy();
  });

  /* 허용치는 발주 라인이 갖고 있고 서버가 다시 판정하지 않는다. */
  it('허용치 안이면 예정과 맞다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('자재 LOT 스캔');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText('실입하 수량'), '505');

    expect(await screen.findByText('예정 수량과 맞습니다')).toBeTruthy();
  });

  /* 판정 결과를 먼저 보인 뒤에 넘긴다. 조용히 넘기면 왜 왔는지 알 수 없다. */
  it('초과면 초과라 말하고 넘어갈 화면이 없다는 것도 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('자재 LOT 스캔');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText('실입하 수량'), '511');

    expect(await screen.findByText('수량 초과 — 예정 500, 실입하 511')).toBeTruthy();
    expect(
      screen.getByText('초과분은 초과 입하 분리에서 나눕니다. 그 화면은 아직 이 앱에 없습니다.'),
    ).toBeTruthy();
  });

  it('부족이면 부족이라 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('자재 LOT 스캔');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText('실입하 수량'), '400');

    expect(await screen.findByText('수량 부족 — 예정 500, 실입하 400')).toBeTruthy();
  });

  it('유효기한이 제조일보다 앞서면 등록을 막는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('자재 LOT 스캔');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText('실입하 수량'), '500');
    await user.type(screen.getByLabelText('제조일'), '2026-07-20');
    await user.type(screen.getByLabelText('유효기한'), '2026-07-19');

    expect(await screen.findByText('유효기한이 제조일보다 앞설 수 없습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입하 등록' }).hasAttribute('disabled')).toBe(true);
  });

  /* 검사 대상 여부는 서버가 라인마다 정한다. 화면이 정하지 않는 것을 말한다. */
  it('검사 대상 여부를 서버가 정한다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('자재 LOT 스캔');
    await choosePoLine(user);

    expect(
      await screen.findByText('검사 대상 여부는 등록 뒤 서버가 라인마다 정합니다'),
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
    await screen.findByLabelText('자재 LOT 스캔');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText('실입하 수량'), '500');
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
