import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { itemRoutes } from '../../test/master-routes';
import { runBackStep } from '../../patterns/back-step';
import { OUTBOX_KEY } from '../../patterns/outbox';
import { useWorkerSession } from '../../patterns/worker-session';
import { shiftDate } from './lotless';
import { InboundReceiptScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());
/** 단말 토큰이 싣고 오는 공장. 시험 환경에는 토큰이 없어 값을 여기서 정한다. */
const plant = vi.hoisted(() => ({ id: null as number | null }));

vi.mock('../../patterns/plant', () => ({
  currentPlantId: () => plant.id,
  /* 셸이 기동할 때 부른다. 빠뜨리면 모의가 실제 모듈과 어긋나 처리되지 않은 오류가 난다. */
  readPlantId: () => Promise.resolve(null),
  rememberPlant: () => Promise.resolve(),
  forgetPlant: () => Promise.resolve(),
}));
/** 장갑 낀 손은 화면을 안 보고 있을 수 있다. 소리로도 알리는지 본다(공유계약 D-2). */
const tone = vi.hoisted(() => ({ played: 0 }));

vi.mock('../../patterns/error-tone', () => ({
  playErrorTone: () => {
    tone.played += 1;
  },
}));
/** 받아들였는지·거절했는지 앱이 낸 신호. 단말 스캐너의 소리는 «읽혔다»일 뿐이다. */
const signals = vi.hoisted(() => [] as string[]);

vi.mock('../../patterns/scan-feedback', () => ({
  signal: (kind: string) => {
    signals.push(kind);
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

/* 제품코드|수량|날짜|공급사|번호. 발주 라인 품목(ABC-123)과 발주 공급사(SUP-002)에 맞춘 라벨이다. */
const SCANNED = 'ABC-123|500|260731|SUP-002|0007';

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
  /* 2-1 은 처음에 납기예정일 오늘 ±2주만 보인다 - 그 안에 들게 오늘로 둔다. */
  expectedReceiptDate: shiftDate(new Date(), 0),
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
  /** 품목 단건 조회가 연결을 잃는다 - 라벨의 제품코드를 확인하지 못한 채로 두는 자리다. */
  itemFails?: boolean;
  /** 대체 LOT 사유 NO_LABEL 의 이름. 실서버는 「라벨 미부착」이라 표시 글과 겹친다. */
  reasonName?: string;
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
      const values =
        group === 'INBOUND_RECEIPT_EXCEPTION_TYPE'
          ? [
              { code: 'URGENT_RECEIPT', codeName: '긴급 입하' },
              { code: 'OVER_DELIVERY', codeName: '초과 납품' },
            ]
          : [{ code: 'NO_LABEL', codeName: options.reasonName ?? '라벨 없음' }];

      return jsonResponse({
        items: values.map((option, index) => ({
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
    match: (req) => new URL(req.url).pathname === '/mdm/items/31' && options.itemFails === true,
    respond: () => Promise.reject(new TypeError('Failed to fetch')),
  },
  ...itemRoutes([{ itemId: 31, itemCode: 'ABC-123', itemName: '원자재', fifoPolicyCode: 'FIFO' }]),
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

const OTHER_LOT_NO = 'ABC-123|500|260731|SUP-002|0099';

/*
 * 라벨을 스캔하고 자재 P/O 후보가 자리 잡기를 기다린다.
 *
 * 라벨의 제품코드로 품목을 찾으면 후보가 그 품목의 P/O 로 한 번 더 바뀐다. 그 전에 목록을 열면
 * 바뀌는 순간 목록이 닫혀, 고르려던 줄이 없는 것으로 읽힌다. 기본 스텁의 품목 마스터에는
 * `ABC-123` 만 있어 그 제품코드일 때만 좁혀진다.
 */
const scanLabel = async (label: string = SCANNED, narrows = label.startsWith('ABC-123|')) => {
  scan(label);
  await screen.findByRole('heading', { name: new RegExp(`${LINE_STEP}|${QTY_STEP}`) });

  /*
   * 좁힌 후보가 하나뿐이면 알아서 골라 수량 단계로 간다(기본 대역이 그렇다). 그때는 좁혔다는
   * 안내가 서지 않으므로 둘 중 먼저 오는 것을 기다린다.
   */
  if (narrows) {
    await waitFor(() => {
      expect(
        screen.queryByText('스캔한 자재의 품목이 있는 자재 P/O만 보입니다.') ??
          screen.queryByRole('heading', { name: QTY_STEP }),
      ).not.toBeNull();
    });
  }
};

/** 단계 제목. 한 단계에 지시 하나가 제목으로 선다. */
const LINE_STEP = '자재 P/O 라인을 고르세요';
/* 라벨이 없을 때(LOT 번호 없음) 같은 단계의 두 화면. */
const LOTLESS_ORDER_STEP = '구매 발주 목록';
const LOTLESS_ITEM_STEP = '발주 상세 목록';
const QTY_STEP = '수량 확인';
/** 라벨 없이 2-2 에서 품목을 눌러 온 셋째 화면의 제목(사용자 지시 2026-10-22). */
const LOTLESS_QTY_STEP = '부분 입하 등록';
/** 두 길 어느 쪽이든 셋째 화면. */
const ANY_QTY_STEP = /^(수량 확인|부분 입하 등록)$/;
const SCAN_STEP = '자재 LOT 라벨을 스캔하세요';

/** 라인 카드 목록. 발주 카드도 같은 모양이라 발주 목록 이름이 붙은 것은 뺀다. */
const lineCards = () => document.querySelector('ul.receipt__lines:not([aria-label]) li');

/*
 * 아직 고르지 않은 발주. 후보가 몇 건이면 카드로, 많으면 빈 선택칸으로 선다. 알아서 골랐으면
 * 둘 다 없다(선택칸에 그 번호가 선다).
 */
const unpickedOrder = (): HTMLElement | null => {
  /* 라벨이 없으면(LOT 번호 없음) 발주 선택 대신 입고 예정 행을 누른다. 행 이름에 공급사명이 든다. */
  const supplier = screen.queryByRole('button', { name: /합성공급사/ });

  if (supplier !== null) {
    return supplier;
  }

  const card = screen.queryByRole('button', { name: /^PO-2026-0003/ });

  if (card !== null) {
    return card;
  }

  const field = screen.queryByRole('combobox', { name: '자재 P/O 번호' });
  return field !== null && !(field.textContent ?? '').includes('PO-2026-0003') ? field : null;
};

/* 고르지 않은 발주를 고른다 — 카드면 한 번, 선택칸이면 열고 고른다. */
const pickUnpickedOrder = async (user: ReturnType<typeof userEvent.setup>) => {
  const order = unpickedOrder();

  if (order === null) {
    return;
  }

  await user.click(order);

  if (order.getAttribute('role') === 'combobox') {
    await user.click(await screen.findByRole('option', { name: 'PO-2026-0003' }));
  }
};

/*
 * 라인 카드가 선 라인 고르기 단계까지 간다. 발주가 하나뿐이면 화면이 알아서 고르고, 라인까지
 * 하나뿐이면 수량 단계로 넘어가 있다 — 그때는 라인 고르기로 되돌아온다.
 */
const showLines = async (user: ReturnType<typeof userEvent.setup>) => {
  await waitFor(() => {
    expect(
      screen.queryByRole('heading', { name: QTY_STEP }) ?? lineCards() ?? unpickedOrder(),
    ).not.toBeNull();
  });

  if (screen.queryByRole('heading', { name: QTY_STEP }) !== null) {
    await backToLines(user);
  } else if (lineCards() === null) {
    await pickUnpickedOrder(user);
  }

  await waitFor(() => {
    expect(lineCards()).not.toBeNull();
  });
};

/* 작업 헤더의 「자세히」를 펼친다 — 견주는 수(발주·누적·잔여·허용)가 거기 있다. */
const openHeaderDetails = async (user: ReturnType<typeof userEvent.setup>) => {
  const header = screen.getByRole('group', { name: '처리 중인 작업' });
  await user.click(within(header).getByRole('button', { name: '자세히' }));
  return header;
};

/*
 * 수량 단계에서 라인 고르기로 돌아간다. 적은 값은 같은 라인을 다시 고를 때까지 남는다. 카드의
 * 「라인 바꾸기」 단추는 없앴다 - 앱바의 「이전 단계」(단말 뒤로가기와 같은 길)로 돌아간다.
 */
const backToLines = async (_user: ReturnType<typeof userEvent.setup>) => {
  runBackStep();
  /* 라벨이 없으면 보던 공급사의 품목 목록으로 돌아간다. */
  await screen.findByRole('heading', { name: new RegExp(`${LINE_STEP}|${LOTLESS_ITEM_STEP}`) });
};

/*
 * 수량 단계까지 간다. 고를 것이 하나뿐이면 화면이 알아서 고르고, 아니면 발주와 라인을 고른다 —
 * 알아서 고르는 것은 조회가 도착한 뒤라, 어느 쪽이 먼저 오든 같은 자리에 닿게 한다.
 */
const reachQty = async (user: ReturnType<typeof userEvent.setup>, lineName: RegExp) => {
  await waitFor(() => {
    expect(
      screen.queryByRole('heading', { name: QTY_STEP }) ??
        screen.queryByRole('button', { name: lineName }) ??
        unpickedOrder(),
    ).not.toBeNull();
  });

  if (screen.queryByRole('heading', { name: QTY_STEP }) !== null) {
    return;
  }

  if (screen.queryByRole('button', { name: lineName }) === null) {
    await pickUnpickedOrder(user);
  }

  await waitFor(() => {
    expect(
      screen.queryByRole('heading', { name: ANY_QTY_STEP }) ??
        screen.queryByRole('button', { name: lineName }),
    ).not.toBeNull();
  });

  if (screen.queryByRole('heading', { name: ANY_QTY_STEP }) === null) {
    await user.click(screen.getByRole('button', { name: lineName }));
  }

  await screen.findByRole('heading', { name: ANY_QTY_STEP });
};

describe('입하 등록 화면', () => {
  /*
   * 번호 첫 칸이 제품코드다. 그것으로 품목을 찾으면 후보를 좁힐 수 있고,
   * 좁히지 않으면 담당자가 미마감 전건을 훑는다 - 잘못 고르면 그 입하가 다른 발주에 붙는다.
   */
  it('스캔한 번호의 품목이 있는 자재 P/O 만 후보로 낸다', async () => {
    const asked: (string | null)[] = [];
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/mdm/items',
        respond: () =>
          jsonResponse({
            items: [{ itemId: 77, itemCode: 'ABC-123', itemName: '스캔한 자재' }],
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

    expect(await screen.findByText('스캔한 자재의 품목이 있는 자재 P/O만 보입니다.')).toBeTruthy();
    expect(asked).toContain('77');

    await user.click(screen.getByRole('button', { name: '전체 자재 P/O 보기' }));

    await waitFor(() => {
      expect(asked).toContain(null);
    });
    expect(screen.getByText(/담당자가 고릅니다/)).toBeTruthy();
  });

  /*
   * 라벨 품목의 미마감 발주가 없을 때 전체 목록으로 넘기면, 그 목록의 발주는 라벨 품목과 달라
   * 어느 것을 골라도 등록 전에 막힌다(omf-all-around#25). 넘기지 않고 없다고 알린다.
   */
  it('라벨 품목의 후보가 없으면 전체로 넘어가지 않고 알린다', async () => {
    const asked: (string | null)[] = [];
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/mdm/items',
        respond: () =>
          jsonResponse({
            items: [{ itemId: 77, itemCode: 'ABC-123', itemName: '스캔한 자재' }],
            page,
          }),
      },
      {
        match: (req) => new URL(req.url).pathname === '/logistics/purchase-orders',
        respond: (req) => {
          const itemId = new URL(req.url).searchParams.get('itemId');
          asked.push(itemId);

          return jsonResponse({ items: itemId === null ? [order] : [], page });
        },
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(
      await screen.findByText(
        'ABC-123 품목의 미마감 자재 P/O가 없습니다. 구매 담당자에게 알리세요.',
      ),
    ).toBeTruthy();
    expect(asked).toContain('77');
    expect(screen.queryByRole('combobox', { name: '자재 P/O 번호' })).toBeNull();
    expect(screen.queryByRole('button', { name: '전체 자재 P/O 보기' })).toBeNull();
  });

  /* 품목 목록에 없는 제품코드면 어느 발주에도 맞지 않는다. 전체 목록을 대신 내지 않는다. */
  it('라벨 제품코드가 품목 기준정보에 없으면 전체로 넘어가지 않고 알린다', async () => {
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/mdm/items',
        respond: () => jsonResponse({ items: [], page }),
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    scan('XYZ-999|500|260731|SUP-002|0007');

    expect(
      await screen.findByText('등록된 품목 중에 XYZ-999가 없습니다. 라벨을 다시 확인하세요.'),
    ).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: '자재 P/O 번호' })).toBeNull();
  });

  /* 품목을 확인하는 동안 스캔 전의 전체 목록이 그대로 서 있으면 그 사이에 무관한 발주를 고른다. */
  it('라벨 품목을 확인하는 동안 전체 목록을 보이지 않는다', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/mdm/items',
        respond: async () => {
          await held;
          return jsonResponse({
            items: [{ itemId: 31, itemCode: 'ABC-123', itemName: '원자재' }],
            page,
          });
        },
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(await screen.findByText('스캔한 자재의 품목을 확인하는 중입니다')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: '자재 P/O 번호' })).toBeNull();

    release();

    expect(await screen.findByText('스캔한 자재의 품목이 있는 자재 P/O만 보입니다.')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: '자재 P/O 번호' })).toBeTruthy();
  });

  /* 확인하지 못한 것은 없다는 답이 아니다. 연결이 없어도 입하가 담기도록 전체 목록을 내고 알린다. */
  it('라벨 품목을 확인하지 못하면 알리고 전체 목록을 낸다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/mdm/items',
        respond: () => Promise.reject(new TypeError('Failed to fetch')),
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(
      await screen.findByText(/전체 자재 P\/O를 보입니다\. 라벨과 같은 품목의 발주를 고르세요/),
    ).toBeTruthy();
    /* 좁히지 못한 목록은 알아서 고르지 않는다. 후보가 몇 건이라 카드로 늘어놓는다. */
    expect(await screen.findByRole('button', { name: /^PO-2026-0003/ })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: QTY_STEP })).toBeNull();
  });

  /*
   * 라벨 없이 납품서 번호를 손으로 넣은 건은 제품코드 대조가 없다. 좁힌 후보가 비면 전처럼 전체로
   * 넘어가 고를 것을 남긴다.
   */
  it('라벨 미부착 번호는 좁힌 후보가 비면 스스로 전체를 낸다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/mdm/items',
        respond: () =>
          jsonResponse({
            items: [{ itemId: 77, itemCode: 'ABC-123', itemName: '스캔한 자재' }],
            page,
          }),
      },
      {
        match: (req) => new URL(req.url).pathname === '/logistics/purchase-orders',
        respond: (req) =>
          jsonResponse({
            items: new URL(req.url).searchParams.get('itemId') === null ? [order] : [],
            page,
          }),
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: '납품서의 공급사 LOT 번호 입력' }));
    await user.type(screen.getByLabelText('공급사 LOT 번호'), SCANNED);
    await user.click(screen.getByRole('button', { name: '공급사 LOT 번호 넣기' }));

    expect(await screen.findByRole('button', { name: /^PO-2026-0003/ })).toBeTruthy();
  });

  /* 후보가 몇 건이면 카드로 한 번에 누른다. 선택칸은 열고 고르는 두 번이다. */
  it('발주 카드를 누르면 그 발주의 라벨 품목 라인을 알아서 골라 수량 단계로 간다', async () => {
    const user = userEvent.setup();
    const second = { ...order, purchaseOrderId: 8, purchaseOrderNo: 'PO-2026-0004' };
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/logistics/purchase-orders',
        respond: () => jsonResponse({ items: [order, second], page }),
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    /* 후보가 둘이라 발주는 사람이 고른다. */
    await user.click(await screen.findByRole('button', { name: /^PO-2026-0003/ }));

    expect(await screen.findByRole('heading', { name: QTY_STEP })).toBeTruthy();
    const header = screen.getByRole('group', { name: '처리 중인 작업' });
    expect(header).toHaveTextContent('PO-2026-0003');
    /* 라인 번호는 적지 않는다(사용자 지시 2026-10-21). */
    expect(header).not.toHaveTextContent('1번 라인');
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
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');

    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value(this: Element) {
        pulled.push(this.textContent?.slice(0, 12) ?? '');
      },
    });

    try {
      mount();
      await screen.findByLabelText('LOT 번호');
      scan(SCANNED);

      /* 고를 것이 하나뿐인 대역이라 라인까지 알아서 골라 수량 단계가 선다. */
      await screen.findByRole('heading', { name: QTY_STEP });
      /* 스크롤은 구획이 그려진 뒤 효과에서 부른다. 글자가 보이는 순간 바로 재면 그 전일 수 있다. */
      await waitFor(() => {
        expect(pulled.some((text) => text.startsWith('단계 3/3'))).toBe(true);
      });
    } finally {
      /* jsdom 에는 이 함수가 없다. 남겨 두면 뒤에 도는 시험이 다른 환경에서 돈다. */
      if (original === undefined) {
        delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      } else {
        Object.defineProperty(Element.prototype, 'scrollIntoView', original);
      }
    }
  });

  /* 스캔 오류는 소리로도 알린다. 장갑 낀 손은 단말을 허리에 매달고 화면을 안 본다. */
  it('양식이 아닌 값을 받으면 소리로도 알린다', async () => {
    tone.played = 0;
    mount();

    await screen.findByLabelText('LOT 번호');
    scan('123');

    await screen.findByText(/자재 LOT 번호 형식이 아닙니다/);
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

  /*
   * 옛 34자리 숫자 번호도 형식 위반이다. 읽은 값을 보여야 스캐너가 구분자를 다른 글자로 넣었는지
   * 라벨이 틀렸는지 가린다.
   */
  it('자재 LOT 번호 형식이 아니면 받지 않고 읽은 값을 말한다', async () => {
    mount();

    await screen.findByLabelText('LOT 번호');
    scan('7770001118880002229901015554447777');

    expect(
      await screen.findByText(
        '자재 LOT 번호 형식이 아닙니다(제품코드|수량|날짜|공급사|번호). 읽은 값: 7770001118880002229901015554447777',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('자재 P/O 선택')).toBeNull();
  });

  /*
   * 라벨 품목으로 좁힌 발주가 하나, 그 품목의 받을 라인이 하나면 고를 것이 없다. 알아서 고르고
   * 무엇을 골랐는지 알린다 — 정상 입하 한 건의 탭 셋이 이 자리였다.
   */
  it('스캔하면 라벨을 작업 헤더에 들고 하나뿐인 자재 P/O 라인을 알아서 고른다', async () => {
    mount();

    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(await screen.findByRole('heading', { name: QTY_STEP })).toBeTruthy();
    const header = screen.getByRole('group', { name: '처리 중인 작업' });
    expect(header).toHaveTextContent(SCANNED);
    expect(header).toHaveTextContent('PO-2026-0003');
    expect(header).not.toHaveTextContent('1번 라인');
    expect(await screen.findByText('PO-2026-0003 · 1번 라인을 골랐습니다')).toBeTruthy();
  });

  /*
   * 수량을 미리 채우지 않는다(사용자 지시 2026-10-21 - 2026-10-20 의 미리 채움을 되돌림). 받을 남은
   * 수는 칸 뒤 「/500」 으로, 이번 것까지 받고 남는 수는 판 머리 뱃지로 보인다.
   */
  it('고른 라인의 수량을 미리 채우지 않고 받을 남은 수와 잔량을 보인다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    const qty = (await screen.findByLabelText(/실입하\ 수량/)) as HTMLInputElement;
    expect(qty.value).toBe('');
    expect(screen.getByText('/500')).toBeTruthy();
    expect(screen.getByText('잔량 500 EA')).toBeTruthy();
    /* 칸을 누르면 숫자판이 열린다 - 따로 키패드 단추를 두지 않는다. */
    expect(screen.queryByRole('button', { name: /숫자판/ })).toBeNull();

    await user.type(qty, '300');

    expect(qty.value).toBe('300');
    expect(screen.getByText('잔량 200 EA')).toBeTruthy();
  });

  it('라벨 없는 외부 LOT 원문은 자재 LOT 번호 형식 강제 없이 받는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: '납품서의 공급사 LOT 번호 입력' }));
    await user.type(screen.getByLabelText('공급사 LOT 번호'), '납품서-LOT/A-01');
    await user.click(screen.getByRole('button', { name: '공급사 LOT 번호 넣기' }));

    expect(await screen.findByText('라벨 미부착 · 공급사 LOT 납품서-LOT/A-01')).toBeTruthy();
    /* 라벨이 아니라 좁히지도 알아서 고르지도 않는다. 담당자가 고른다. */
    expect(screen.getByRole('heading', { name: LINE_STEP })).toBeTruthy();
  });

  it('외부 LOT 원문이 계약 상한을 넘으면 자르지 않고 입력을 막는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: '납품서의 공급사 LOT 번호 입력' }));
    await user.type(screen.getByLabelText('공급사 LOT 번호'), 'A'.repeat(101));
    await user.click(screen.getByRole('button', { name: '공급사 LOT 번호 넣기' }));

    expect(
      await screen.findByText('공급사 LOT 번호는 100자 이하여야 합니다 (현재 101자)'),
    ).toBeTruthy();
    expect(screen.queryByText('자재 P/O 선택')).toBeNull();
    expect(screen.getByLabelText('공급사 LOT 번호')).toHaveValue('A'.repeat(101));
  });

  /* 양식이 달라 품목을 못 읽으면 좁히지 않는다(화면 스펙 §6). 담당자가 고른다. */
  it('품목을 못 읽는 번호는 발주를 정하지 않는다고 말한다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: '납품서의 공급사 LOT 번호 입력' }));
    await user.type(screen.getByLabelText('공급사 LOT 번호'), '납품서-LOT/A-01');
    await user.click(screen.getByRole('button', { name: '공급사 LOT 번호 넣기' }));

    expect(
      await screen.findByText(
        '스캔한 번호만으로는 자재 P/O가 정해지지 않습니다. 담당자가 고릅니다.',
      ),
    ).toBeTruthy();
  });

  /* 미부착 분기는 데이터에 있는 구분이다. 사유 없이 참으로 보내면 서버가 거부한다. */
  /**
   * ⭐ **사유는 등록 단추 «바로 위»에 선다**(사용자 지시 2026-09-19 · omf-all-around#34).
   *
   * 필수값이라 누르기 직전에 한 번 더 눈에 들어와야 한다 — 스캔 구역에 두면 발주·수량을 거치는
   * 사이 화면 밖으로 밀려났다.
   */
  /*
   * 대체 LOT 사유는 필수지만 기본값(라벨 미부착)이 저절로 들어가 부분 입하 등록 화면에서는 칸을
   * 두지 않는다(사용자 지시 2026-10-22). 기본값이 실려 가는 것은 「등록한 내용」 시험이 본다.
   */
  it('LOT 번호 없음이면 부분 입하 등록 화면에 대체 사유 칸을 두지 않는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));

    /* ⛔ 「공급사 LOT 번호가 없습니다」 띠는 세우지 않는다(사용자 지시 2026-09-19). */
    expect(screen.queryByText('공급사 LOT 번호가 없습니다.')).toBeNull();

    await reachQty(user, /ABC-123|31/);
    expect(screen.getByRole('heading', { name: LOTLESS_QTY_STEP })).toBeTruthy();
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입하 등록' })).not.toBeDisabled();
    });
    expect(screen.queryByText(/대체\ LOT\ 사유/)).toBeNull();
  });

  /* 확인하지 못한 것을 발주가 없는 것으로 말하지 않는다. */
  it('발주 조회 실패를 발주 없음으로 말하지 않는다', async () => {
    mount([], { ordersStatus: 500 });

    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(await screen.findByText(messages.httpError.loadServer)).toBeTruthy();
    expect(screen.queryByText('미마감 자재 P/O가 없습니다')).toBeNull();
  });

  /*
   * 입하는 늘 자재 P/O 가 있다 - 발주 없는 입하는 PDA 에서 받지 않는다(사용자 결정 2026-10-27 ·
   * omf-all-around#182). 라인 고르기에도, 라벨 없이 보는 입고 예정에도 그 길을 두지 않는다.
   */
  it('자재 P/O 없이 등록하는 길을 두지 않는다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);
    await screen.findByRole('heading', { name: QTY_STEP });
    await backToLines(user);
    expect(screen.queryByRole('button', { name: '자재 P/O 없이 등록' })).toBeNull();

    runBackStep();
    await user.click(await screen.findByRole('button', { name: 'LOT 번호 없음' }));
    await screen.findByRole('table', { name: '입고 예정' });
    expect(screen.queryByRole('button', { name: '자재 P/O 없이 등록' })).toBeNull();
    /* 입고 예정 표의 공급사 이름은 공급사 역할로만 청한다 - 거르지 않으면 고객사가 섞인다. */
    expect(partnerQueries).toContain('SUPPLIER');
    expect(partnerQueries.every((role) => role === 'SUPPLIER')).toBe(true);
  });

  /* 없어도 등록을 막지 않는다. 다만 없다는 사실은 말한다. */
  /**
   * ⭐ **사유는 「라벨 미부착」이 미리 골라져 있다**(사용자 지시 2026-09-19 · omf-all-around#34).
   * ⭐ **스캔 구역도 「스캔으로 되돌리기」도 두지 않는다**(사용자 지시 2026-10-21 - 직접 입력과
   *    되돌리기를 한 줄에 두던 2026-09-19 지시를 대신한다). 라벨을 찾았으면 앱바의 「이전 단계」다.
   */
  it('LOT 번호 없음을 고르면 스캔 구역도 되돌리기도 없다', async () => {
    const user = userEvent.setup();
    mount();

    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await reachQty(user, /ABC-123|31/);

    expect(screen.queryByRole('button', { name: '스캔으로 되돌리기' })).toBeNull();
    expect(screen.queryByLabelText('LOT 번호')).toBeNull();
    expect(screen.queryByRole('button', { name: '직접 입력' })).toBeNull();
  });

  /**
   * ⛔ **거래명세서 구역을 화면에 세우지 않는다**(사용자 지시 2026-09-19 · omf-all-around#34).
   *
   * 지운 것이 아니라 감춘 것이다 — 문구도 본문에 값을 싣는 자리도 그대로 두었고, 스위치
   * (`SHOW_DELIVERY_NOTE`) 하나로 되살린다. 두 칸 모두 선택 입력이라 비어도 등록은 막히지 않는다.
   */
  it('거래명세서 구역을 보이지 않는다', async () => {
    mount();

    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    /* 스캔 뒤 구역들이 다 선 상태에서 본다 — 등록 단추가 그 마지막이다. */
    await screen.findByRole('button', { name: '입하 등록' });
    expect(screen.queryByText('거래명세서')).toBeNull();
    expect(screen.queryByLabelText('거래명세서번호')).toBeNull();
    expect(screen.queryByLabelText('차량번호')).toBeNull();
    expect(screen.queryByText('명세서 번호가 없습니다. 등록은 진행됩니다.')).toBeNull();
  });
});

/**
 * 자재 P/O 에 자재가 여럿일 때, 자재를 바꾸면 그 자재에 딸린 칸을 비운다(현장 보고 2026-09-21).
 *
 * 남겨 두면 앞 자재에 적은 수량이 다음 자재에 붙은 채 판정까지 다시 선다 - 발주량 500 짜리에
 * 500 을 적고 발주량 80 짜리로 옮기면 초과 판정이 나서 등록 단추가 사라지고 초과 분리 구획이
 * 섰다. 눈치채지 못하면 앞 자재의 수량이 다른 자재로 등록된다.
 */
describe('입하 등록 화면 — 자재를 바꿀 때', () => {
  const twoLines: Options = {
    lines: [
      poLine({ purchaseOrderLineId: 41, itemId: 31, orderedQty: 500 }),
      poLine({ purchaseOrderLineId: 42, lineNo: 2, itemId: 32, orderedQty: 80 }),
    ],
  };

  const fillFirstLine = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await reachQty(user, /ABC-123|31/);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '450');
    await user.type(screen.getByLabelText(/포장\ 수/), '10');
    await user.type(screen.getByLabelText('제조일'), '2026-07-01');
  };

  /* 다른 자재의 라인은 「라인 바꾸기」로 돌아가 고른다. */
  const pickOtherLine = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
    await backToLines(user);
    await user.click(await screen.findByRole('button', { name }));
    await screen.findByRole('heading', { name: ANY_QTY_STEP });
  };

  it('다른 자재로 옮기면 앞 자재에 적은 값을 비운다', async () => {
    const user = userEvent.setup();
    mount([], twoLines);
    await fillFirstLine(user);

    await pickOtherLine(user, /품목 정보 없음|32/);

    expect((screen.getByLabelText(/실입하\ 수량/) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/포장\ 수/) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('제조일') as HTMLInputElement).value).toBe('');
  });

  /* 앞 자재의 수량이 남으면 발주량 80 짜리에서 초과 판정이 나 등록 단추가 사라진다. */
  it('다른 자재로 옮겨도 앞 자재의 수량으로 초과 판정하지 않는다', async () => {
    const user = userEvent.setup();
    mount([], twoLines);
    await fillFirstLine(user);

    await pickOtherLine(user, /품목 정보 없음|32/);

    expect(screen.queryByText('초과 입하 분리')).toBeNull();
    expect(screen.getByRole('button', { name: '입하 등록' })).toBeTruthy();
  });

  /* 같은 자재를 다시 고른 것은 바꾸는 것이 아니다 - 적어 둔 것을 잃지 않는다. */
  it('라인을 바꾸러 갔다가 같은 자재를 다시 고르면 적어 둔 것을 잃지 않는다', async () => {
    const user = userEvent.setup();
    mount([], twoLines);
    await fillFirstLine(user);

    await pickOtherLine(user, /ABC-123|31/);

    expect((screen.getByLabelText(/실입하\ 수량/) as HTMLInputElement).value).toBe('450');
    expect((screen.getByLabelText(/포장\ 수/) as HTMLInputElement).value).toBe('10');
  });

  /*
   * 뒤로가기(단말 키 · 앱바 「이전 단계」)는 단계를 거꾸로만 밟는다 — 수량 → 품목 → 공급사 → 스캔.
   * 전에는 라인에서 다시 수량으로 돌아가 「이전 단계」 두 번이 2 → 3 이 됐다(사용자 지적 2026-10-21).
   */
  it('뒤로가기는 수량에서 품목, 입고 예정, 스캔 단계로 차례로 간다', async () => {
    const user = userEvent.setup();
    mount([], twoLines);
    await fillFirstLine(user);

    runBackStep();
    expect(await screen.findByRole('heading', { name: LOTLESS_ITEM_STEP })).toBeTruthy();
    /* 돌아오면 다시 받는다 - 받는 동안은 로딩, 그다음 표(사용자 지시 2026-10-22). */
    expect(await screen.findByRole('table', { name: '받을 품목' })).toBeTruthy();

    runBackStep();
    expect(await screen.findByRole('heading', { name: LOTLESS_ORDER_STEP })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '입고 예정' })).toBeTruthy();

    runBackStep();
    expect(await screen.findByRole('heading', { name: SCAN_STEP })).toBeTruthy();
  });

  /*
   * 다 받은 품목은 초록 바탕으로 함께 보이고, 눌러 수량 확인으로 들어가지 않는다(사용자 지시
   * 2026-10-21). 잘못 적은 것을 고치는 길은 나중 일이다.
   */
  it('2-2 에서 다 받은 품목은 초록 행으로 보이고 누를 수 없다', async () => {
    const user = userEvent.setup();
    mount([], {
      lines: [
        poLine({ purchaseOrderLineId: 41, itemId: 31, orderedQty: 100, receivedQty: 100 }),
        poLine({ purchaseOrderLineId: 42, lineNo: 2, itemId: 32, orderedQty: 80 }),
      ],
    });
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    const orders = await screen.findByRole('table', { name: '입고 예정' });
    await user.click(within(orders).getByRole('button', { name: /합성공급사/ }));

    const items = await screen.findByRole('table', { name: '받을 품목' });
    const closed = await within(items).findByRole('row', { name: /입하 완료/ });
    expect(closed).toHaveClass('lotless__row--closed');
    expect(closed).toHaveTextContent('100/100');
    expect(within(closed).queryByRole('button')).toBeNull();
    expect(within(closed).getByRole('checkbox')).toBeDisabled();
    /* 받을 것이 남은 품목은 그대로 누른다. */
    expect(within(items).getAllByRole('button')).toHaveLength(1);
  });

  /* 다 받은 것만 남은 자재 P/O 를 「받을 것만」으로 거르면 그 사실을 그대로 적는다(사용자 지시 2026-10-21). */
  it('2-2 에서 받을 것만 거르다 비면 입하가 모두 끝났다고 적는다', async () => {
    const user = userEvent.setup();
    mount([], {
      lines: [poLine({ purchaseOrderLineId: 41, itemId: 31, orderedQty: 100, receivedQty: 100 })],
    });
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    const orders = await screen.findByRole('table', { name: '입고 예정' });
    await user.click(within(orders).getByRole('button', { name: /합성공급사/ }));
    await screen.findByRole('table', { name: '받을 품목' });

    await user.click(screen.getByRole('button', { name: '받을 것만' }));

    expect(await screen.findByText('입하 처리가 모두 완료된 건입니다')).toBeTruthy();
    expect(screen.queryByText(/받을 품목이 없습니다/)).toBeNull();
  });

  /* 2-1 도 같다 - 라인이 모두 다 받은 자재 P/O 는 초록 행이다(사용자 지시 2026-10-21). */
  it('2-1 에서 입하가 모두 끝난 자재 P/O 는 초록 행으로 보인다', async () => {
    const user = userEvent.setup();
    mount([], {
      lines: [
        poLine({ purchaseOrderLineId: 41, itemId: 31, orderedQty: 100, receivedQty: 100 }),
        poLine({ purchaseOrderLineId: 42, lineNo: 2, itemId: 32, orderedQty: 80, receivedQty: 80 }),
      ],
    });
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));

    const orders = await screen.findByRole('table', { name: '입고 예정' });
    const done = await within(orders).findByRole('button', { name: /입하 완료/ });
    expect(done.closest('tr')).toHaveClass('lotless__row--closed');
  });

  /*
   * 입하가 끝난 자재 P/O 만 보는 필터(사용자 지시 2026-10-22). 미마감 목록에 없는 것이 끝난 것이고,
   * 서버에서는 납기예정일 기간의 끝까지를 발주일로 받는다.
   */
  it('2-1 필터의 입하 완료 건만을 켜면 끝난 자재 P/O 만 보인다', async () => {
    const user = userEvent.setup();
    const asked: URLSearchParams[] = [];
    const finished = { ...order, purchaseOrderId: 9, purchaseOrderNo: 'PO-2026-0009' };
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/logistics/purchase-orders',
        respond: (req) => {
          const params = new URL(req.url).searchParams;
          asked.push(params);
          return jsonResponse({
            items: params.get('openOnly') === 'true' ? [order] : [order, finished],
            page,
          });
        },
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    expect(
      await within(await screen.findByRole('table', { name: '입고 예정' })).findByRole('button', {
        name: /PO-2026-0003/,
      }),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '입하 완료 건만' }));

    const orders = await screen.findByRole('table', { name: '입고 예정' });
    expect(await within(orders).findByRole('button', { name: /PO-2026-0009/ })).toBeTruthy();
    expect(within(orders).queryByRole('button', { name: /PO-2026-0003/ })).toBeNull();
    const done = asked.find((each) => each.get('openOnly') === null);
    expect(done?.get('orderDateTo')).toBe(shiftDate(new Date(), 14));
  });

  it('2-1 에서 받을 것이 남은 자재 P/O 는 초록으로 칠하지 않는다', async () => {
    const user = userEvent.setup();
    mount([], {
      lines: [
        poLine({ purchaseOrderLineId: 41, itemId: 31, orderedQty: 100, receivedQty: 100 }),
        poLine({ purchaseOrderLineId: 42, lineNo: 2, itemId: 32, orderedQty: 80 }),
      ],
    });
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));

    /* 품목 표까지 들어가 라인을 다 읽힌 뒤 돌아와 잰다 - 읽기 전에는 어느 행도 초록이 아니다. */
    await user.click(
      within(await screen.findByRole('table', { name: '입고 예정' })).getByRole('button', {
        name: /합성공급사/,
      }),
    );
    const items = await screen.findByRole('table', { name: '받을 품목' });
    await within(items).findByRole('row', { name: /입하 완료/ });
    runBackStep();

    const orders = await screen.findByRole('table', { name: '입고 예정' });
    const row = within(orders)
      .getByRole('button', { name: /합성공급사/ })
      .closest('tr');
    expect(row).not.toHaveClass('lotless__row--closed');
    expect(within(orders).queryByRole('button', { name: /입하 완료/ })).toBeNull();
  });

  /*
   * 라벨이 없으면 자재 P/O 번호로는 무엇이 무엇인지 모른다. 입고 예정을 P/O No. · 공급사 · 납기예정일
   * 표로 보이고, 행을 누르면 그 자재 P/O 의 품목 표로 간다(사용자 지시 2026-10-21, 칸 2026-10-22).
   */
  it('LOT 번호 없음이면 입고 예정 표에서 행을 눌러 그 품목 표로 간다', async () => {
    const user = userEvent.setup();
    mount([], twoLines);
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));

    const orders = await screen.findByRole('table', { name: '입고 예정' });
    expect(
      within(orders)
        .getAllByRole('columnheader')
        .map((each) => each.getAttribute('aria-label') ?? each.textContent),
    ).toEqual(['P/O No.', '공급사', '납기예정일']);
    /* 마지막 칸을 뺀 머리마다 오른쪽 경계를 끌어 폭을 바꾼다(사용자 지시 2026-10-22). */
    expect(
      within(orders)
        .getAllByRole('separator')
        .map((each) => each.getAttribute('aria-label')),
    ).toEqual(['P/O No. 칸 폭', '공급사 칸 폭']);
    const row = within(orders).getByRole('row', { name: /합성공급사/ });
    expect(row).toHaveTextContent('PO-2026-0003');
    /* 발주일 칸은 뺐다(사용자 지시 2026-10-22). 납기예정일이 없는 발주는 그 칸을 비운다. */
    expect(row).not.toHaveTextContent('26.08.20');
    expect(screen.getByText('입하 예정 1건')).toBeTruthy();
    await user.click(within(orders).getByRole('button', { name: /합성공급사/ }));

    const items = await screen.findByRole('table', { name: '받을 품목' });
    /* 첫 칸은 「모두 선택」 체크 칸이다. */
    expect(
      within(items)
        .getAllByRole('columnheader')
        .map((each) => each.textContent),
    ).toEqual(['', 'No.', '품목', '입고/발주 수량']);
    /* 품목 앞에 행 번호 - 보이는 차례대로 1 부터(사용자 지시 2026-10-22). */
    expect(
      within(items)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.querySelector('.lotless__no')?.textContent),
    ).toEqual(['1', '2']);
    /* 품목명 아래 품목코드를 같은 칸에 적는다(사용자 지시 2026-10-22). */
    const named = await within(items).findByRole('button', { name: /원자재/ });
    expect(named.closest('td')?.querySelector('.lotless__item-code')?.textContent).toMatch(/\S/);
    /* 보고 있는 구매 발주를 이름표와 함께 적는다. 되돌아가기는 앱바의 「이전 단계」 하나뿐이다. */
    expect(screen.getByText('발주번호').nextElementSibling).toHaveTextContent('PO-2026-0003');
    expect(screen.queryByRole('button', { name: '입고 예정 목록으로' })).toBeNull();
    expect(within(items).getByRole('checkbox', { name: '모두 선택' })).toBeTruthy();
    expect(await within(items).findByRole('button', { name: /원자재/ })).toBeTruthy();
    expect(within(items).getByRole('button', { name: /품목 정보 없음/ })).toBeTruthy();
    expect(screen.getByText('품목 2건')).toBeTruthy();
    /* 수량 아래 「발주 · 잔여」 를 적지 않는다(사용자 지시 2026-10-21). */
    expect(within(items).queryByText(/^(발주|잔여)$/)).toBeNull();

    /* 품목 찾기는 「필터」 로 접혀 있다(사용자 지시 2026-10-21). 펴서 이름으로 찾으면 하나만 남는다. */
    const filter = screen.getByRole('button', { name: '필터' });
    expect(filter).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('searchbox', { name: '품목 찾기' })).toBeNull();
    await user.click(filter);
    await user.type(screen.getByRole('searchbox', { name: '품목 찾기' }), '원자');

    expect(screen.queryByRole('button', { name: /품목 정보 없음/ })).toBeNull();
    expect(screen.getByText('품목 1건')).toBeTruthy();
    expect(screen.getByRole('button', { name: '필터 1' })).toBeTruthy();
    /* 카드에는 자재 P/O 번호도 라인 번호도 적지 않는다(사용자 지시 2026-10-21). */
    const card = screen.getByRole('button', { name: /원자재/ });
    expect(card).not.toHaveTextContent('PO-2026-0003');
    expect(card).not.toHaveTextContent('번 라인');
    await user.click(card);

    expect(await screen.findByRole('heading', { name: LOTLESS_QTY_STEP })).toBeTruthy();
    expect((screen.getByLabelText(/실입하\ 수량/) as HTMLInputElement).value).toBe('');
    /*
     * 수량 확인도 2-2 와 같은 정보 칸 - 작업 카드 · 라인 번호 · 「라인 바꾸기」 단추가 없다(사용자 지시
     * 2026-10-21). 돌아가기는 앱바의 「이전 단계」뿐이다.
     */
    expect(screen.queryByRole('group', { name: '처리 중인 작업' })).toBeNull();
    expect(screen.getByText('발주번호').nextElementSibling).toHaveTextContent('PO-2026-0003');
    expect(screen.getByText('품목명').nextElementSibling).toHaveTextContent('원자재');
    expect(screen.queryByText(/1번 라인/)).toBeNull();
    expect(screen.queryByRole('button', { name: '자재 P/O 라인 바꾸기' })).toBeNull();
  });

  /*
   * 거의 다 문제없이 들어온다. 이상 없는 품목은 체크해 남은 수량 그대로 요청 하나로 등록하고(서버가 품목마다 입하 한 건을
   * 세운다 — `:per-line` · 장부 P-117), 문제가 있는 품목만 따로 처리한다(사용자 지시 2026-10-21 · 2026-10-24).
   */
  it('LOT 번호 없음의 품목 표에서 체크한 품목을 남은 수량 그대로 한꺼번에(품목마다 입하 한 건) 등록한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount(
      [
        {
          match: (req) =>
            new URL(req.url).pathname === '/logistics/inbound-receipts:per-line' &&
            req.method === 'POST',
          respond: (req) => {
            seen.push(req.clone());
            return jsonResponse(
              {
                /* 서버 모양 — 건마다 입하 등록 응답과 같은 한 벌(머리 + 줄). */
                created: [1, 2].map((index) => ({
                  inboundReceipt: { inboundReceiptNo: `SAMPLE-IR-${String(index)}` },
                  lines: [{ inboundReceiptLineId: 9500 + index, lineNo: 1 }],
                })),
              },
              { status: 201 },
            );
          },
        },
      ],
      twoLines,
    );
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await user.click(await screen.findByRole('button', { name: /합성공급사/ }));
    const items = await screen.findByRole('table', { name: '받을 품목' });
    await within(items).findByRole('button', { name: /원자재/ });

    /* 체크 전에는 잠겨 있고 왜 잠겼는지 말한다. */
    const submit = screen.getByRole('button', { name: /체크한 품목 입하 등록/ });
    expect(submit).toBeDisabled();
    expect(screen.getByText('등록할 품목을 체크하세요')).toBeTruthy();

    /* 체크하면 입고 수량이 발주 수량으로 찬다. */
    expect(within(items).getByRole('row', { name: /원자재/ })).toHaveTextContent('0/500 EA');
    await user.click(within(items).getByRole('checkbox', { name: '모두 선택' }));
    expect(within(items).getByRole('checkbox', { name: '원자재 선택' })).toBeChecked();
    expect(within(items).getByRole('row', { name: /원자재/ })).toHaveTextContent('500/500 EA');
    /* 단추 글자는 고정이고 체크한 수는 표 위에 적는다(사용자 지시 2026-10-22). */
    expect(screen.getByText('(선택 2건)')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '체크한 품목 입하 등록' }));

    /* 누르면 몇 건인지 한 번 묻는다(사용자 지시 2026-10-27). 묻는 동안은 보내지 않는다. */
    const asking = await screen.findByRole('dialog', { name: '2건을 입하 등록할까요?' });
    expect(seen).toHaveLength(0);
    await user.click(within(asking).getByRole('button', { name: '등록합니다' }));

    expect(await screen.findByText('2건을 입하 등록했습니다')).toBeTruthy();
    expect(seen).toHaveLength(1);
    const body = (await seen[0]!.json()) as {
      supplierId: number;
      lines: {
        purchaseOrderLineId: number;
        receivedQty: number;
        supplierLotMissing: boolean;
        supplierLotLabelAttached: boolean;
        substituteLotReasonCode: string;
      }[];
    };
    expect(body.supplierId).toBe(2);
    expect(body.lines.map((line) => [line.purchaseOrderLineId, line.receivedQty]).sort()).toEqual([
      [41, 500],
      [42, 80],
    ]);
    expect(body.lines.every((line) => line.supplierLotMissing)).toBe(true);
    expect(body.lines.every((line) => !line.supplierLotLabelAttached)).toBe(true);
    expect(body.lines.every((line) => line.substituteLotReasonCode === 'NO_LABEL')).toBe(true);
  });

  it('체크한 품목 등록을 묻는 창에서 돌아가면 보내지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount(
      [
        {
          match: (req) =>
            new URL(req.url).pathname === '/logistics/inbound-receipts:per-line' &&
            req.method === 'POST',
          respond: (req) => {
            seen.push(req.clone());
            return jsonResponse({ created: [] }, { status: 201 });
          },
        },
      ],
      twoLines,
    );
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await user.click(await screen.findByRole('button', { name: /합성공급사/ }));
    const items = await screen.findByRole('table', { name: '받을 품목' });
    await user.click(await within(items).findByRole('checkbox', { name: '원자재 선택' }));
    await user.click(screen.getByRole('button', { name: '체크한 품목 입하 등록' }));

    const asking = await screen.findByRole('dialog', { name: '1건을 입하 등록할까요?' });
    await user.click(within(asking).getByRole('button', { name: '돌아가기' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(seen).toHaveLength(0);
    /* 체크는 그대로 남아 다시 누르면 된다. */
    expect(within(items).getByRole('checkbox', { name: '원자재 선택' })).toBeChecked();
  });

  /*
   * 실기기에서 나온 것이다(2026-10-27). 자재 P/O 의 품목을 한꺼번에 다 받으면 그 자재 P/O 가
   * 미마감 목록에서 빠진다. 번호로 목록에서 다시 찾던 때는 못 찾아, 제목 · 바닥 바는 2-2 인데 표는
   * 입고 예정(2-1)이 섞여 나왔다.
   */
  it('한꺼번에 다 받아 자재 P/O 가 미마감 목록에서 빠져도 품목 표에 남는다', async () => {
    const user = userEvent.setup();
    let closed = false;
    mount(
      [
        {
          match: (req) =>
            new URL(req.url).pathname === '/logistics/inbound-receipts:per-line' &&
            req.method === 'POST',
          respond: () => {
            closed = true;
            return jsonResponse({ created: [] }, { status: 201 });
          },
        },
        {
          match: (req) =>
            new URL(req.url).pathname === '/logistics/purchase-orders' && req.method === 'GET',
          respond: () => jsonResponse({ items: closed ? [] : [order], page }),
        },
        {
          match: (req) => new URL(req.url).pathname === '/logistics/purchase-orders/7',
          respond: () =>
            jsonResponse({
              purchaseOrder: order,
              lines: [
                poLine({ receivedQty: closed ? 500 : 0 }),
                poLine({
                  purchaseOrderLineId: 42,
                  lineNo: 2,
                  itemId: 32,
                  orderedQty: 80,
                  ...(closed ? { receivedQty: 80 } : {}),
                }),
              ],
            }),
        },
      ],
      twoLines,
    );
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await user.click(await screen.findByRole('button', { name: /합성공급사/ }));
    const items = await screen.findByRole('table', { name: '받을 품목' });
    await user.click(await within(items).findByRole('checkbox', { name: '모두 선택' }));
    await user.click(screen.getByRole('button', { name: '체크한 품목 입하 등록' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '등록합니다' }),
    );

    expect(await screen.findByText('2건을 입하 등록했습니다')).toBeTruthy();
    /* 다 받은 품목 표가 그대로 - 입고 예정 표가 섞이지 않는다. */
    expect(await screen.findByRole('row', { name: /원자재/ })).toHaveTextContent('500/500 EA');
    expect(screen.getByRole('heading', { name: LOTLESS_ITEM_STEP })).toBeTruthy();
    expect(screen.getByRole('table', { name: '받을 품목' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: '입고 예정' })).toBeNull();
    expect(screen.queryByText(/입하 예정 \d+건/)).toBeNull();
  });

  /*
   * 부분 입하한 품목은 「모두 선택」이 빼고 그 사실을 알린다 - 남은 수량을 그대로 넣으면 부분
   * 입하가 무색해진다(사용자 지시 2026-10-22). 하나씩 체크하면 넣을 수 있다.
   */
  it('2-2 의 모두 선택은 부분 입하한 품목을 빼고 알린다', async () => {
    const user = userEvent.setup();
    mount([], {
      lines: [
        poLine({ purchaseOrderLineId: 41, itemId: 31, orderedQty: 500, receivedQty: 200 }),
        poLine({ purchaseOrderLineId: 42, lineNo: 2, itemId: 32, orderedQty: 80 }),
      ],
    });
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await user.click(await screen.findByRole('button', { name: /합성공급사/ }));
    const items = await screen.findByRole('table', { name: '받을 품목' });
    await within(items).findByRole('button', { name: /원자재/ });

    expect(within(items).getByRole('row', { name: /원자재/ })).toHaveTextContent('부분 입하');

    await user.click(within(items).getByRole('checkbox', { name: '모두 선택' }));

    expect(within(items).getByRole('checkbox', { name: '원자재 선택' })).not.toBeChecked();
    expect(within(items).getByRole('checkbox', { name: '품목 정보 없음 선택' })).toBeChecked();
    expect(await screen.findByText('부분 입하 1건은 빼고 선택했습니다')).toBeTruthy();
    /* 뺀 것도 하나씩은 체크할 수 있다. */
    await user.click(within(items).getByRole('checkbox', { name: '원자재 선택' }));
    expect(within(items).getByRole('checkbox', { name: '원자재 선택' })).toBeChecked();
  });

  it('2-2 의 필터에서 부분 입하한 품목만 본다', async () => {
    const user = userEvent.setup();
    mount([], {
      lines: [
        poLine({ purchaseOrderLineId: 41, itemId: 31, orderedQty: 500, receivedQty: 200 }),
        poLine({ purchaseOrderLineId: 42, lineNo: 2, itemId: 32, orderedQty: 80 }),
      ],
    });
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await user.click(await screen.findByRole('button', { name: /합성공급사/ }));
    const items = await screen.findByRole('table', { name: '받을 품목' });
    await within(items).findByRole('button', { name: /원자재/ });

    await user.click(screen.getByRole('button', { name: '필터' }));
    await user.click(screen.getByRole('button', { name: '부분 입하만' }));

    expect(within(items).getByRole('button', { name: /원자재/ })).toBeTruthy();
    expect(within(items).queryByRole('button', { name: /품목 정보 없음/ })).toBeNull();
    expect(screen.getByText('품목 1건')).toBeTruthy();
    expect(screen.getByRole('button', { name: '필터 1' })).toBeTruthy();
  });

  /* 문제가 있는 품목만 품목명을 눌러 따로 - 체크는 그 품목을 고르지 않는다. */
  it('체크 칸을 눌러도 수량 단계로 가지 않는다', async () => {
    const user = userEvent.setup();
    mount([], twoLines);
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await user.click(await screen.findByRole('button', { name: /합성공급사/ }));
    const items = await screen.findByRole('table', { name: '받을 품목' });

    await user.click(await within(items).findByRole('checkbox', { name: '원자재 선택' }));

    expect(screen.getByRole('heading', { name: LOTLESS_ITEM_STEP })).toBeTruthy();
    expect(screen.getByRole('button', { name: '체크한 품목 입하 등록' })).not.toBeDisabled();
  });

  /* 입고 예정은 공급사명 · 기간으로 거른다. 거르기 칸은 접혀 있고 걸린 조건 수를 단추가 말한다. */
  it('LOT 번호 없음의 입고 예정을 공급사명으로 거르고 지울 수 있다', async () => {
    const user = userEvent.setup();
    mount([], twoLines);
    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await screen.findByRole('table', { name: '입고 예정' });

    const toggle = screen.getByRole('button', { name: '필터' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    await user.type(screen.getByRole('searchbox', { name: '공급사명' }), '대한');

    expect(screen.getByText('조건에 맞는 입고 예정이 없습니다')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '입고 예정' })).toBeNull();
    expect(screen.getByRole('button', { name: '필터 1' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '필터 지우기' }));
    expect(await screen.findByRole('table', { name: '입고 예정' })).toBeTruthy();
    expect(screen.getByText('입하 예정 1건')).toBeTruthy();
  });

  /* 공급사 LOT 과 대체 사유는 «이 도착»의 것이다. 비우면 자재마다 다시 고르게 된다. */
  it('LOT 번호 없음과 그 사유는 자재를 바꿔도 그대로 둔다', async () => {
    const user = userEvent.setup();
    mount(
      [
        {
          match: (req) =>
            new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
          respond: () => jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 }),
        },
      ],
      twoLines,
    );
    await fillFirstLine(user);

    await pickOtherLine(user, /품목 정보 없음|32/);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '80');
    await user.click(await screen.findByRole('button', { name: '입하 등록' }));

    /* 사유 칸은 숨었어도 고른 사유가 실려 간다 - 「등록한 내용」이 그 이름을 다시 보인다. */
    expect(await screen.findByText('라벨 미부착 · 라벨 없음')).toBeTruthy();
  });
});

/**
 * 등록한 값을 등록 «뒤»에 확인할 수 있어야 한다(현장 요청 2026-09-21).
 *
 * 전에는 「등록했습니다」 띠와 「다음 입하」 단추뿐이라, 같은 자재 P/O 의 자재를 여러 번 넣을 때
 * 앞 자재를 무엇으로 얼마나 넣었는지 되짚을 곳이 화면에 없었다.
 */
describe('입하 등록 화면 — 등록한 내용', () => {
  const accepts: StubRoute = {
    match: (req) =>
      new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
    respond: () => jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 }),
  };

  it('등록한 자재와 수량과 LOT 을 적은 그대로 다시 보인다', async () => {
    const user = userEvent.setup();
    mount([accepts]);

    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await reachQty(user, /ABC-123|31/);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.type(screen.getByLabelText(/포장\ 수/), '10');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));

    expect(await screen.findByText('입하를 등록했습니다')).toBeTruthy();
    expect(screen.getByText('등록한 내용')).toBeTruthy();
    expect(screen.getByText('PO-2026-0003 · 1번 라인')).toBeTruthy();
    expect(screen.getByText('ABC-123 원자재')).toBeTruthy();
    expect(screen.getByText('500 EA')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('라벨 미부착 · 라벨 없음')).toBeTruthy();
    /* 라벨 미부착이면 LOT 이 만들어지지 않는다 - 만들었다고 말하지 않는다(사용자 확인 2026-10-22). */
    expect(screen.queryByText(/자재 LOT도 함께 만들어졌습니다/)).toBeNull();
  });

  /* 사유 이름이 「라벨 미부착」 그 말이면 한 번만 적는다 - 겹쳐 보였다(사용자 지시 2026-10-22). */
  it('대체 사유가 라벨 미부착이면 공급사 LOT 에 한 번만 적는다', async () => {
    const user = userEvent.setup();
    mount([accepts], { reasonName: '라벨 미부착' });

    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await reachQty(user, /ABC-123|31/);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));

    expect(await screen.findByText('입하를 등록했습니다')).toBeTruthy();
    expect(screen.getByText('라벨 미부착')).toBeTruthy();
    expect(screen.queryByText('라벨 미부착 · 라벨 미부착')).toBeNull();
  });

  /*
   * 라벨 없이 한 품목을 부분 입하하면 결과 화면으로 가지 않고 부분 입하 화면에 남아 알린다. 수량
   * 칸은 비워 남은 것을 이어 받게 하고, 이미 받은 수는 따로 눈에 띄게 둔다(사용자 지시 2026-10-22).
   */
  it('라벨 없는 부분 입하는 결과 화면 대신 부분 입하 화면에서 알린다', async () => {
    const user = userEvent.setup();
    const sent: unknown[] = [];
    /* 서버처럼 - 입하를 받으면 발주 라인의 받은 수가 는다. */
    let receivedOnServer = 0;
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
        respond: async (req) => {
          const body = (await req.json()) as { lines: { receivedQty: number }[] };
          sent.push(body);
          receivedOnServer += body.lines[0]?.receivedQty ?? 0;
          return jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 });
        },
      },
      {
        match: (req) => new URL(req.url).pathname === '/logistics/purchase-orders/7',
        respond: () =>
          jsonResponse({
            purchaseOrder: order,
            lines: [poLine({ receivedQty: receivedOnServer })],
          }),
      },
    ]);

    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await reachQty(user, /ABC-123|31/);
    expect(screen.getByText('기입하 수량')).toBeTruthy();
    expect(screen.getByText('0 / 500 EA')).toBeTruthy();

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '200');
    await user.click(await screen.findByRole('combobox', { name: /부분 입하 사유/ }));
    await user.click(await screen.findByRole('option', { name: '공급사 분할 납품' }));
    await user.click(screen.getByRole('button', { name: '부분 입하 등록' }));

    expect(await screen.findByText('부분 입하 200 EA를 등록했습니다')).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(screen.queryByText('입하를 등록했습니다')).toBeNull();
    expect(screen.getByRole('heading', { name: LOTLESS_QTY_STEP })).toBeTruthy();
    expect((screen.getByLabelText(/실입하\ 수량/) as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('combobox', { name: /부분 입하 사유/ })).toBeNull();
    /* 받은 수가 그 자리에서 는다 - 고를 때의 0 에 머물지 않는다(사용자 확인 2026-10-22). */
    expect(await screen.findByText('200 / 500 EA')).toBeTruthy();

    /* 목록으로 돌아갔다 다시 들어오면 앞 알림은 없고 받은 수는 그대로다. */
    await backToLines(user);
    const items = await screen.findByRole('table', { name: '받을 품목' });
    await user.click(await within(items).findByRole('button', { name: /원자재/ }));
    expect(await screen.findByRole('heading', { name: LOTLESS_QTY_STEP })).toBeTruthy();
    expect(screen.queryByText('부분 입하 200 EA를 등록했습니다')).toBeNull();
    expect(screen.getByText('200 / 500 EA')).toBeTruthy();
  });

  /* 「다음 입하」로 넘어가면 앞 건의 요약이 남아 있으면 안 된다 - 다음 건의 것으로 읽힌다. */
  it('다음 입하로 넘어가면 앞 건의 요약을 지운다', async () => {
    const user = userEvent.setup();
    mount([accepts]);

    await screen.findByLabelText('LOT 번호');
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await reachQty(user, /ABC-123|31/);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));

    await screen.findByText('등록한 내용');
    await user.click(screen.getByRole('button', { name: '다음 입하' }));

    expect(screen.queryByText('등록한 내용')).toBeNull();
    expect(await screen.findByLabelText('LOT 번호')).toBeTruthy();
  });
});

const choosePoLine = async (
  user: ReturnType<typeof userEvent.setup>,
  lineName: RegExp = /ABC-123|31/,
  label: string = SCANNED,
  narrows?: boolean,
) => {
  await scanLabel(label, narrows);
  await reachQty(user, lineName);
};

describe('입하 등록 화면 — 발주 경로', () => {
  /* 서버가 등록할 때 같은 대조로 거부한다. 담아 둔 뒤에 되돌아오면 한참 뒤 전송 실패로만 보인다. */
  it('라벨의 제품코드가 발주 라인 품목과 다르면 등록할 수 없다', async () => {
    const user = userEvent.setup();
    /* 라벨 품목(XYZ-999)이 있는 발주를 고르되, 그 발주의 다른 품목 줄(ABC-123)을 고른 자리다. */
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/mdm/items',
        respond: () =>
          jsonResponse({
            items: [{ itemId: 99, itemCode: 'XYZ-999', itemName: '다른 자재' }],
            page,
          }),
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user, /ABC-123|31/, 'XYZ-999|500|260731|SUP-002|0007', true);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');

    expect(
      await screen.findByText('스캔한 라벨의 제품코드가 이 건의 품목과 다릅니다'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '입하 등록' })).toBeDisabled();
  });

  /* 막는 쪽으로만 기울면 옳은 라벨까지 막혀 현장이 선다. 막는 시험만으로는 그 기울기가 안 보인다. */
  it('라벨의 제품코드가 맞으면 등록할 수 있다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입하 등록' })).not.toBeDisabled();
    });
    expect(screen.queryByText(/스캔한 라벨의/)).toBeNull();
  });

  /* 입하 등록은 연결 없이도 담겨야 한다. 확인하지 못했다고 막으면 오프라인 입하가 선다. */
  it('라벨의 제품코드를 확인하지 못하면 알리되 막지 않는다', async () => {
    const user = userEvent.setup();
    mount([], { itemFails: true });
    await screen.findByLabelText('LOT 번호');
    /* 품목을 못 받은 라인은 코드 대신 "품목 정보 없음" 으로 선다. 그래도 고를 수 있어야 한다. */
    await choosePoLine(user, /품목 정보 없음/);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');

    expect(await screen.findByText(/라벨의 제품코드를 확인하지 못했습니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '입하 등록' })).not.toBeDisabled();
  });

  /* 카드는 받을 수량과 허용치를 한 줄로 말한다. 여섯 줄짜리 카드 둘이면 화면이 찼다. */
  it('라인 카드는 받을 수량과 허용치를 한 줄로 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await scanLabel();
    await showLines(user);

    expect(screen.getByText(/발주량 500 EA · 허용 \+10 \/ -5/)).toBeTruthy();
  });

  /* 견주는 수는 작업 헤더의 「자세히」에 있다 — 수량을 적는 동안 화면 밖으로 나가지 않는다. */
  it('라인을 고르면 작업 헤더가 발주·누적·허용치를 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    const header = await openHeaderDetails(user);
    const terms = within(header)
      .getAllByRole('term')
      .map((node) => node.textContent);
    const values = within(header)
      .getAllByRole('definition')
      .map((node) => node.textContent);

    expect(values[terms.indexOf('발주')]).toBe('500 EA');
    expect(values[terms.indexOf('누적')]).toBe('0 EA');
    expect(values[terms.indexOf('허용')]).toBe('+10 / -5');
  });

  /*
   * 실기기에서 나온 것이다. 발주는 라인마다 열고 닫히는데 후보 목록은 발주 단위라, 그 품목의
   * 라인이 다 찬 발주도 후보에 선다. 카드가 발주량과 누적만 보이면 작업자는 굵게 보이는 발주량
   * 대로 적고 초과 판정을 받는다 - 견주는 수인 남은 예정을 카드가 직접 말해야 한다.
   */
  it('라인 카드가 잔여 수량을 보이고 다 받은 줄을 표식한다', async () => {
    const user = userEvent.setup();
    mount([], {
      lines: [
        poLine({ purchaseOrderLineId: 41, orderedQty: 100, receivedQty: 100 }),
        poLine({ purchaseOrderLineId: 42, lineNo: 2, itemId: 32, orderedQty: 50, receivedQty: 0 }),
      ],
    });
    await screen.findByLabelText('LOT 번호');
    await scanLabel();
    /* 라벨 품목(31)의 라인은 다 받아 고를 것이 없다 — 알아서 고르지 않고 카드를 세운다. */
    await showLines(user);

    expect(await screen.findByText(/잔여 수량 0/)).toBeTruthy();
    expect(screen.getByText('다 받았습니다')).toBeTruthy();
    /*
     * ⭐ **발주량과 같으면 잔여 수량을 세우지 않는다**(사용자 지시 2026-09-19). 둘째 줄은 아직
     *    하나도 받지 않아 잔여가 발주량과 같다 — 같은 수를 두 번 말할 뿐이다.
     */
    expect(screen.queryByText(/잔여 수량 50/)).toBeNull();
    expect(screen.getByText(/발주량 50/)).toBeTruthy();
  });

  /*
   * 품목과 단위는 다른 조회에서 온다. 그 조회가 비거나 이 품목을 담고 있지 않으면 지금은
   * 빈 글자가 들어가, 카드에 이름도 단위도 없이 발주 수량만 남는다 - 작업자는 무엇을
   * 세는지 모르는 채 수량을 적는다. 없으면 없다고 적는다.
   */
  it('품목과 단위를 못 찾으면 없다고 적는다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) => new URL(req.url).pathname === '/mdm/items',
        respond: () =>
          jsonResponse({ items: [{ itemId: 31, itemCode: 'ABC-123', itemName: '원자재' }], page }),
      },
      {
        match: (req) => new URL(req.url).pathname === '/mdm/items/31',
        respond: () => jsonResponse({ message: '없음' }, { status: 404 }),
      },
      {
        match: (req) => new URL(req.url).pathname === '/mdm/uoms',
        respond: () => jsonResponse({ items: [], page }),
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    /* 라벨 제품코드로는 품목을 찾아 좁히지만, 라인 카드가 쓰는 품목 단건 조회는 비어 있다. */
    await choosePoLine(user, /품목 정보 없음/, SCANNED, true);

    /* 작업 헤더의 견주는 수에도 단위가 없다고 선다. */
    const header = await openHeaderDetails(user);
    expect(within(header).getAllByText(/단위 없음/)).not.toHaveLength(0);

    /* 라인 카드에도 선다. */
    await backToLines(user);
    expect(await screen.findByText(/품목 정보 없음/)).toBeTruthy();
    expect(screen.getByText(/발주량 500 단위 없음/)).toBeTruthy();
  });

  /*
   * 실기기에서 다 받은 줄이 맨 위에 섰다. 그대로 두면 작업자가 그것부터 고르고 초과 판정을
   * 받는다 - 감추지 않고 차례만 내려, 고를 것이 먼저 눈에 들어오게 한다.
   */
  it('받을 것이 남은 줄을 위로 올린다', async () => {
    const user = userEvent.setup();
    mount([], {
      lines: [
        poLine({ purchaseOrderLineId: 41, itemId: 31, orderedQty: 100, receivedQty: 100 }),
        poLine({ purchaseOrderLineId: 42, lineNo: 2, itemId: 32, orderedQty: 50, receivedQty: 0 }),
      ],
    });
    await screen.findByLabelText('LOT 번호');
    await scanLabel();
    await showLines(user);

    /* 카드 차례로 잰다. 받을 것이 남은 둘째 라인(발주량 50)이 다 받은 첫째 라인보다 앞이다. */
    const cards = [...document.querySelectorAll('.receipt__lines li')].map(
      (each) => each.textContent ?? '',
    );

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatch(/발주량 50/);
    expect(cards[1]).toMatch(/다 받았습니다/);
  });

  /*
   * 담아 둔 것은 서버의 누적에 없다. 카드가 그것을 빼지 않으면 카드는 잔여 수량 500,
   * 그 카드를 누른 뒤 수량 칸은 0 이 되어 고치려던 어긋남이 오프라인 경로에 그대로 남는다.
   */
  it('라인 카드가 담아 둔 수량까지 빼고 잔여 수량을 낸다', async () => {
    const user = userEvent.setup();
    store.set(
      OUTBOX_KEY,
      JSON.stringify([
        {
          id: 'queued-1',
          label: messages.inboundReceipt.record,
          idempotencyKey: 'queued-key',
          method: 'POST',
          path: '/logistics/inbound-receipts',
          body: { lines: [{ purchaseOrderLineId: 41, receivedQty: 500 }] },
          occurredAt: '2026-09-01T02:30:00.000Z',
          confirmation: 'pending',
        },
      ]),
    );
    mount();
    await screen.findByLabelText('LOT 번호');
    await scanLabel();
    /* 담아 둔 것까지 빼면 받을 것이 없다 — 알아서 고르지 않고 카드를 세운다. */
    await showLines(user);

    expect(await screen.findByText(/잔여 수량 0/)).toBeTruthy();
    expect(screen.getByText('다 받았습니다')).toBeTruthy();
  });

  /*
   * 판정이 견주는 것은 발주 총량이 아니라 남은 예정이다. 총량만 칸 옆에 두면 적는 사람이
   * 그 수에 맞추려 하고, 판정은 다른 수로 나온다.
   */
  it('작업 헤더가 발주량을 보이고, 잔여가 그와 다를 때만 잔여 수량을 더한다', async () => {
    const user = userEvent.setup();
    mount([], { lines: [poLine({ orderedQty: 500, receivedQty: 200 })] });
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    const header = await openHeaderDetails(user);
    const terms = within(header)
      .getAllByRole('term')
      .map((node) => node.textContent);
    const values = within(header)
      .getAllByRole('definition')
      .map((node) => node.textContent);

    expect(values[terms.indexOf('발주')]).toBe('500 EA');
    expect(values[terms.indexOf('잔여 수량')]).toBe('300 EA');
    /* 칸 뒤의 「/300」 도 판정이 견주는 그 수다. */
    expect(screen.getByText('/300')).toBeTruthy();
  });

  /* ⭐ 같은 수를 두 번 말하지 않는다(사용자 지시 2026-09-19). */
  it('잔여가 발주량과 같으면 잔여 수량을 세우지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    const header = await openHeaderDetails(user);

    expect(
      within(header)
        .getAllByRole('term')
        .map((node) => node.textContent),
    ).not.toContain('잔여 수량');
  });

  /*
   * 허용치는 발주 라인이 갖고 있고 서버가 다시 판정하지 않는다. 뱃지는 판정 글 없이 수만 말한다
   * (사용자 지시 2026-10-21) - 허용치 안의 초과면 넘친 수를 그대로 적는다.
   */
  it('허용치 안의 초과는 넘친 수만 말하고 등록을 막지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '505');

    expect(await screen.findByText('초과 5 EA')).toBeTruthy();
    expect(screen.queryByText('잔여 수량과 맞습니다')).toBeNull();
    expect(screen.getByRole('button', { name: '입하 등록' })).not.toBeDisabled();
  });

  /* 판정 결과를 먼저 보인 뒤에 넘긴다. 조용히 넘기면 왜 왔는지 알 수 없다. */
  it('초과면 판정값을 말하고 같은 화면에 분리 단계를 연다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '511');

    expect(await screen.findByText('수량 초과 — 잔여 수량 500, 이번 도착 511')).toBeTruthy();
    expect(screen.getByText('초과 입하 분리')).toBeTruthy();
    expect(screen.getByText('510 EA')).toBeTruthy();
    expect(screen.getByText('1 EA')).toBeTruthy();
    /* 예외 유형 · 사유 없이 바로 나눠 등록한다(장부 P-100 · 사용자 결정 2026-10-22). */
    expect(screen.getByRole('button', { name: '초과분 나눠 등록' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '정량분만 등록' })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: '초과분만 등록' })).toBeNull();
    expect(screen.queryByRole('button', { name: '입하 등록' })).toBeNull();
  });

  it('부족이면 부족이라 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '400');

    expect(await screen.findByText('수량 부족 — 잔여 수량 500, 이번 도착 400')).toBeTruthy();
  });

  /*
   * 화면은 더 올 것인지 알지 못한다. 트럭과 거래명세서를 본 사람이 안다. 네 수를 보이고
   * 사람이 고르게 한다 - 수 없이 고르라 하면 무엇을 고르는지 모른다.
   */
  it('부족이면 남는 수를 보이고 부분 입하 한 길만 연다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '400');

    const ask = await screen.findByRole('group', { name: '부분 입하 수량' });
    expect(within(ask).getByText('이번 도착')).toBeTruthy();
    /*
     * 판정이 견주는 남은 예정이 아니라 이번 것까지 받고도 남는 몫이다. 둘을 같은 수로 보이면
     * 사람이 무엇을 고르는지 모른 채 고른다. 발주 500 · 누적 0 · 이번 400 이라 100 이다.
     */
    const terms = within(ask)
      .getAllByRole('term')
      .map((node) => node.textContent);
    const values = within(ask)
      .getAllByRole('definition')
      .map((node) => node.textContent);

    expect(values[terms.indexOf('남은')]).toBe('100 EA');
    /* 발주·누적은 작업 헤더의 「자세히」에 있다. */
    const header = await openHeaderDetails(user);
    expect(within(header).getByText('발주')).toBeTruthy();
    expect(within(header).getByText('누적')).toBeTruthy();
    /* 수량 부족(더 오지 않음)은 입하 오류 등록 메뉴에서 따로 - 여기에는 부분 입하 한 길이다(사용자 지시 2026-10-22). */
    expect(screen.getByRole('button', { name: '부분 입하 등록' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /오류 등록/ })).toBeNull();
    expect(screen.getByText(/부분 입하로 그대로 등록합니다/)).toBeTruthy();
  });

  /*
   * 숫자판은 누른 칸에만 적는다. 앞 · 다음 칸 단추가 있으면 접힌 「추가 정보」 안의 포장 수처럼
   * 보고 있지 않은 칸에 숫자가 들어간다(사용자 지시 2026-10-21).
   */
  it('수량 숫자판에는 다른 칸으로 옮기는 단추가 없다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.click(await screen.findByLabelText(/실입하\ 수량/));

    expect(screen.queryByRole('button', { name: '앞 칸' })).toBeNull();
    expect(screen.queryByRole('button', { name: '다음 칸' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText(/실입하\ 수량/));
  });

  /*
   * 부족이면 「더 오는가」를 사람이 답해야 등록된다. 그 답이 곧 등록 단추다 — 전에는 답을 고른
   * 뒤 「입하 등록」을 한 번 더 눌러야 했고, 답만 고르고 떠나는 일이 생겼다.
   */
  it('부족이면 「입하 등록」 대신 더 오는지를 묻는 두 단추가 선다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '400');

    await screen.findByRole('group', { name: '부분 입하 수량' });
    expect(screen.queryByRole('button', { name: '입하 등록' })).toBeNull();
    expect(screen.getByRole('button', { name: '부분 입하 등록' })).toBeTruthy();
  });

  /* 부분 입하는 사유를 적어야 등록된다(사용자 지시 2026-10-22). */
  it('부분 입하 사유를 적기 전에는 「부분 입하 등록」이 잠긴다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '400');

    const partial = await screen.findByRole('button', { name: '부분 입하 등록' });
    expect(partial).toBeDisabled();
    expect(screen.getByText('부분 입하 사유를 먼저 고르세요')).toBeTruthy();

    /* 기타를 고르면 적는 칸이 열리고, 적어야 풀린다. */
    await user.click(screen.getByRole('combobox', { name: /부분 입하 사유/ }));
    await user.click(await screen.findByRole('option', { name: '기타 (직접 입력)' }));
    expect(partial).toBeDisabled();
    expect(screen.getByText('기타 사유를 먼저 적으세요')).toBeTruthy();

    await user.type(screen.getByRole('textbox', { name: '기타 사유' }), '트럭 한 대 늦음');
    expect(partial).not.toBeDisabled();
  });

  it('부족이면 「부분 입하 등록」 한 번으로 등록하고 사유를 비고로 보낸다', async () => {
    const sent: unknown[] = [];
    const user = userEvent.setup();
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
        respond: async (req) => {
          sent.push(await req.json());
          return jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 });
        },
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '400');
    await user.click(await screen.findByRole('combobox', { name: /부분 입하 사유/ }));
    await user.click(await screen.findByRole('option', { name: '공급사 분할 납품' }));
    await user.click(await screen.findByRole('button', { name: '부분 입하 등록' }));

    expect(await screen.findByText('입하를 등록했습니다')).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect((sent[0] as { remarks?: string }).remarks).toBe('공급사 분할 납품');
    /* 스캔한 라벨이 붙은 입하는 LOT 이 함께 만들어진다. */
    expect(screen.getByText(/자재 LOT도 함께 만들어졌습니다/)).toBeTruthy();
  });

  /* 고쳐서 허용치 안으로 들어오면 물음이 걷히고 평소 등록 단추로 돌아온다. */
  it('수량을 고쳐 허용치 안으로 오면 부족 물음을 걷는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    const qty = await screen.findByLabelText(/실입하\ 수량/);
    await user.type(qty, '400');
    await screen.findByRole('group', { name: '부분 입하 수량' });

    await user.clear(qty);
    await user.type(qty, '500');

    expect(await screen.findByText('잔량 0 EA')).toBeTruthy();
    expect(screen.queryByRole('group', { name: '부분 입하 수량' })).toBeNull();
    expect(screen.getByRole('button', { name: '입하 등록' })).not.toBeDisabled();
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

  /*
   * 실기기에서 나온 것이다. 라인이 하나뿐인 발주를 다 받아 닫은 뒤 곧바로 다음 입하로 넘어가면
   * 그 발주가 후보에 그대로 남았다. 목록 조회는 키가 바뀌지 않아 다시 돌지 않는다 - 작업자가
   * 받을 것이 없는 발주를 골라 실물 수량을 넣고 초과 판정을 받는다.
   */
  it('등록에 성공하면 발주 목록을 다시 받는다', async () => {
    const user = userEvent.setup();
    let orders = 0;
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/purchase-orders' && req.method === 'GET',
        respond: () => {
          orders += 1;
          return jsonResponse({ items: [order], page });
        },
      },
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
        respond: () => jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 }),
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    /* 스캔한 제품코드로 좁히느라 이미 두 번 받았다(전체 → 그 품목). 그 뒤로 늘어야 다시 받은 것이다. */
    await waitFor(() => {
      expect(orders).toBe(2);
    });

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));
    await screen.findByText('입하를 등록했습니다');

    await waitFor(() => {
      expect(orders).toBeGreaterThan(2);
    });
  });
});

/**
 * 초과 — 초과분을 나눠 한 건으로 받는다(장부 P-100 · 사용자 결정 2026-10-22). 입하 한 건 · LOT 한
 * 개, 정량분만 자재 P/O 에 넣고 초과분은 서버의 초과분 목록에 남긴다. 예외 유형 · 사유는 받지 않는다.
 */
describe('입하 등록 화면 — 초과분 나눠 등록', () => {
  const accepts = (seen: Request[]): StubRoute => ({
    match: (req) =>
      new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
    respond: (req) => {
      seen.push(req.clone());
      return jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 });
    },
  });

  const prepareOver = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    /* 발주 500 · 허용 +10 이라 511 은 1 이 넘친다. */
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '511');
    await screen.findByRole('button', { name: '초과분 나눠 등록' });
  };

  it('입하 한 건으로 보내고 초과분만 자재 P/O 에 넣지 않게 나눠 싣는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([accepts(seen)]);

    await prepareOver(user);
    /* 예외 유형 · 사유는 받지 않는다. */
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByLabelText(/초과\ 사유/)).toBeNull();
    expect(screen.queryByRole('button', { name: '초과분만 등록' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '초과분 나눠 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    const body = (await seen[0]!.json()) as {
      exceptionTypeCode?: string;
      lines: { purchaseOrderLineId: number; receivedQty: number; excessQty?: number }[];
    };
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatchObject({
      purchaseOrderLineId: 41,
      receivedQty: 511,
      excessQty: 1,
    });
    expect(body.exceptionTypeCode).toBeUndefined();

    /* 등록한 내용은 정량분과 초과분으로 나눠 되읽는다. */
    expect(await screen.findByText('입하를 등록했습니다')).toBeTruthy();
    expect(screen.getByText('510 EA')).toBeTruthy();
    expect(screen.getByText('1 EA')).toBeTruthy();
  });

  /*
   * 받을 것이 남지 않은 라인이면 전부 그 라인의 초과분이다 - 발주 없는 입하로 보내지 않는다(사용자
   * 결정 2026-10-27 · omf-all-around#182). 서버는 excessQty == receivedQty 를 받는다.
   */
  it('받을 것이 남지 않은 라인은 모두 초과분으로 등록한다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([accepts(seen)], { lines: [poLine({ receivedQty: 500, toleranceOverQty: 0 })] });

    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '30');

    expect(
      await screen.findByText('이 라인은 받을 수량이 남지 않았습니다. 모두 초과분으로 등록합니다.'),
    ).toBeTruthy();
    /* 넣을 정량분이 없으니 정량분만은 서지 않는다. */
    expect(screen.queryByRole('button', { name: '정량분만 등록' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '모두 초과분으로 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    const body = (await seen[0]!.json()) as {
      exceptionTypeCode?: string;
      lines: { purchaseOrderLineId: number | null; receivedQty: number; excessQty?: number }[];
    };
    expect(body.lines[0]).toMatchObject({
      purchaseOrderLineId: 41,
      receivedQty: 30,
      excessQty: 30,
    });
    expect(body.exceptionTypeCode).toBeUndefined();
    expect(await screen.findByText('입하를 등록했습니다')).toBeTruthy();
  });

  it('정량분만 등록하면 초과분은 싣지 않는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipts:split' &&
          req.method === 'POST',
        respond: (req) => {
          seen.push(req.clone());
          return jsonResponse({ created: [{ inboundReceiptId: 1 }] }, { status: 201 });
        },
      },
    ]);

    await prepareOver(user);
    await user.click(screen.getByRole('button', { name: '정량분만 등록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    const body = (await seen[0]!.json()) as {
      mode: string;
      normal: { lines: { receivedQty: number }[] };
      excess?: unknown;
    };
    expect(body.mode).toBe('NORMAL_ONLY');
    expect(body.normal.lines[0]?.receivedQty).toBe(510);
    expect(body.excess).toBeUndefined();
  });

  /* 같은 틱의 연타가 서로 다른 멱등키 두 건을 만들면 서버도 중복인지 알 수 없다. */
  it('초과분 나눠 등록을 연달아 눌러도 단일 멱등 요청만 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount([accepts(seen)]);

    await prepareOver(user);
    const button = screen.getByRole('button', { name: '초과분 나눠 등록' });
    button.click();
    button.click();
    button.click();

    await screen.findByText('입하를 등록했습니다');
    expect(seen).toHaveLength(1);
  });

  it('거부되면 등록했다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount([
      {
        match: (req) =>
          new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
        respond: () =>
          jsonResponse(
            { code: 'VALIDATION_FAILED', message: '등록 실패', errors: [] },
            { status: 400 },
          ),
      },
    ]);

    await prepareOver(user);
    await user.click(screen.getByRole('button', { name: '초과분 나눠 등록' }));

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
   * 두 번 적었을 때 둘 다 잔여 수량 안으로 읽혀, 서버가 거부할 초과가 정상으로 보인다.
   */
  it('담긴 입하를 잔여 수량에서 뺀다', async () => {
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

    expect(await screen.findByText('수량 초과 — 잔여 수량 0, 이번 도착 500')).toBeTruthy();
  });
});

describe('입하 등록 화면 — 라벨 다시 읽기', () => {
  /*
   * 스캔 하나가 이 화면의 대상을 정한다. 이미 읽은 뒤에 다른 라벨을 스치면 대상이 조용히
   * 바뀌는데, 작업자는 앞엣것에 적는 줄 알고 다음 단계로 넘어간다.
   */
  it('이미 읽은 뒤 다른 값을 읽으면 되묻는다', async () => {
    mount();
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);
    const header = await screen.findByRole('group', { name: '처리 중인 작업' });

    scan(OTHER_LOT_NO);

    /* 제목은 창이 닫혀도 DOM 에 남는다. 닿을 수 있는 단추로 열렸는지를 잰다. */
    expect(await screen.findByRole('button', { name: '그대로 두기' })).toBeTruthy();
    /* 묻는 동안에는 아직 바뀌지 않는다. */
    expect(header).not.toHaveTextContent(OTHER_LOT_NO);
  });

  it('되물은 창에서 새 값을 받으면 그때 대상이 바뀐다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);
    await screen.findByRole('group', { name: '처리 중인 작업' });
    scan(OTHER_LOT_NO);

    await user.click(await screen.findByRole('button', { name: '새로 읽은 값으로' }));

    await waitFor(() => {
      expect(screen.getByRole('group', { name: '처리 중인 작업' })).toHaveTextContent(OTHER_LOT_NO);
    });
  });

  /*
   * 라벨의 앞자리가 어느 발주 라인이 후보인지를 가른다. 다른 품목의 라벨로 바꿨는데 앞서 고른
   * 라인이 남으면, 그 라인에 남의 라벨이 붙은 채 등록된다 - 화면은 아무 말도 하지 않는다.
   *
   * 되묻는 창이 이미 바꿀 것인지를 물었으므로 비워도 놀라지 않는다. 같은 품목의 라벨이면 새
   * 라벨로 다시 고르고 남은 수량을 새로 채운다 — 앞 라벨에 적은 수량은 남지 않는다.
   */
  it('새 라벨을 받으면 그 아래 고른 것과 적은 것이 비워진다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '450');
    await user.type(screen.getByLabelText('포장 수'), '10');

    scan(OTHER_LOT_NO);
    await user.click(await screen.findByRole('button', { name: '새로 읽은 값으로' }));

    await waitFor(() => {
      expect(screen.getByRole('group', { name: '처리 중인 작업' })).toHaveTextContent(OTHER_LOT_NO);
    });
    expect(((await screen.findByLabelText(/실입하\ 수량/)) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('포장 수') as HTMLInputElement).value).toBe('');
  });
});

describe('입하 등록 화면 — 이미 등록된 LOT 라벨(omf-all-around#28)', () => {
  const lotRoute = (respond: StubRoute['respond']): StubRoute => ({
    match: (req) => new URL(req.url).pathname === '/trace/lots',
    respond,
  });

  const lotOf = (plantId: number) => ({ lotId: 501, lotNo: SCANNED, plantId, itemId: 31 });

  /*
   * 사전부착 라벨이면 서버가 라벨 원문으로 LOT 을 만든다. 이 공장에 이미 있으면 전송 뒤에야
   * 「이미 있는 값입니다」로 거부된다 — 스캔 자리에서 막고 발주 선택으로 넘어가지 않는다.
   */
  it('⛔ 이 공장에 이미 있는 LOT 의 라벨은 받지 않고 발주 선택으로 넘어가지 않는다', async () => {
    const asked: (string | null)[] = [];
    const before = tone.played;
    mount([
      lotRoute((req) => {
        asked.push(new URL(req.url).searchParams.get('lotNo'));

        return jsonResponse({ items: [lotOf(1)], page });
      }),
    ]);
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    expect(await screen.findByText(`이미 등록된 LOT입니다. 읽은 값: ${SCANNED}`)).toBeTruthy();
    expect(asked).toEqual([SCANNED]);
    expect(tone.played).toBeGreaterThan(before);
    /* 스캔 단계에 머문다 — 라인도 수량도 서지 않고, 알아서 고르지도 않는다. */
    expect(screen.getByRole('heading', { name: '자재 LOT 라벨을 스캔하세요' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: QTY_STEP })).toBeNull();
    expect(screen.queryByText(/라인을 골랐습니다/)).toBeNull();
  });

  /* 서버 유일키는 공장 단위다 — 다른 공장의 같은 번호는 이 입하를 막지 않는다. */
  it('다른 공장의 LOT 이면 막지 않는다', async () => {
    let asked = 0;
    mount([
      lotRoute(() => {
        asked += 1;

        return jsonResponse({ items: [lotOf(2)], page });
      }),
    ]);
    await screen.findByLabelText('LOT 번호');

    await scanLabel();
    /* 조회가 돌아온 뒤에 본다 — 늦게 오는 답이 판정을 뒤집을 틈을 남기지 않는다. */
    await waitFor(() => {
      expect(asked).toBe(1);
    });

    expect(screen.queryByText(/이미 등록된 LOT입니다/)).toBeNull();
    expect(await screen.findByRole('heading', { name: QTY_STEP })).toBeTruthy();
  });

  /* 「확인하지 못함」은 「없음」이 아니다 — 연결 없이도 입하가 담겨야 한다. 서버 거부로 남는다. */
  it('LOT 을 확인하지 못하면 막지 않는다', async () => {
    let asked = 0;
    mount([
      lotRoute(() => {
        asked += 1;

        return Promise.reject(new TypeError('Failed to fetch'));
      }),
    ]);
    await screen.findByLabelText('LOT 번호');

    await scanLabel();
    await waitFor(() => {
      expect(asked).toBe(1);
    });

    expect(screen.queryByText(/이미 등록된 LOT입니다/)).toBeNull();
    expect(await screen.findByRole('heading', { name: QTY_STEP })).toBeTruthy();
  });
});

/**
 * 공통 골격 위의 흐름 — 단계 되짚기 · 적던 것 붙들기 · 결과 신호 · 결과 화면에서 다음 스캔.
 */
describe('입하 등록 화면 — 단계와 이어 하기', () => {
  const accepts: StubRoute = {
    match: (req) =>
      new URL(req.url).pathname === '/logistics/inbound-receipts' && req.method === 'POST',
    respond: () => jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 }),
  };

  /* 홈에 다녀오는 것을 흉내 낸다 — 화면은 사라져도 셸의 공급자는 남는다. */
  const Away = () => {
    const [shown, setShown] = useState(true);

    return (
      <>
        <button type="button" onClick={() => setShown((current) => !current)}>
          홈 다녀오기
        </button>
        {shown ? <InboundReceiptScreen /> : null}
      </>
    );
  };

  const mountAway = (extra: StubRoute[] = []) =>
    renderWithProviders(
      <MemoryRouter>
        <SignedIn>
          <Away />
        </SignedIn>
      </MemoryRouter>,
      { fetch: createStubFetch([...extra, ...routes()]) },
    );

  beforeEach(() => {
    signals.length = 0;
  });

  /* 홈에서 위치를 확인하고 돌아왔을 뿐인데 스캔·선택을 처음부터 다시 했다. */
  it('화면을 떠났다 돌아와도 적던 것이 남는다', async () => {
    const user = userEvent.setup();
    mountAway();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '450');

    await user.click(screen.getByRole('button', { name: '홈 다녀오기' }));
    await user.click(screen.getByRole('button', { name: '홈 다녀오기' }));

    expect(await screen.findByRole('heading', { name: QTY_STEP })).toBeTruthy();
    expect(screen.getByRole('group', { name: '처리 중인 작업' })).toHaveTextContent(SCANNED);
    expect((screen.getByLabelText(/실입하\ 수량/) as HTMLInputElement).value).toBe('450');
  });

  /* 등록을 마친 것을 남기면 돌아온 사람이 같은 입하를 한 번 더 등록한다. */
  it('등록을 마치면 적던 것을 거둔다', async () => {
    const user = userEvent.setup();
    mountAway([accepts]);
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));
    await screen.findByText('입하를 등록했습니다');

    await user.click(screen.getByRole('button', { name: '홈 다녀오기' }));
    await user.click(screen.getByRole('button', { name: '홈 다녀오기' }));

    expect(await screen.findByRole('heading', { name: '자재 LOT 라벨을 스캔하세요' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: '처리 중인 작업' })).toBeNull();
  });

  /* 정상 입하는 스캔 · 수량 · 등록이다 — 라인은 알아서 고르고, 받은 수는 사람이 적는다. */
  it('예정대로 도착하면 스캔하고 수량을 적어 등록 한 번으로 끝난다', async () => {
    const sent: { lines: { purchaseOrderLineId: number; receivedQty: number }[] }[] = [];
    const user = userEvent.setup();
    mount([
      {
        ...accepts,
        respond: async (req) => {
          sent.push((await req.json()) as (typeof sent)[number]);
          return jsonResponse({ inboundReceipt: {}, lines: [] }, { status: 201 });
        },
      },
    ]);
    await screen.findByLabelText('LOT 번호');
    scan(SCANNED);

    await screen.findByRole('heading', { name: QTY_STEP });
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입하 등록' })).not.toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: '입하 등록' }));

    expect(await screen.findByText('입하를 등록했습니다')).toBeTruthy();
    expect(sent[0]?.lines[0]).toMatchObject({ purchaseOrderLineId: 41, receivedQty: 500 });
  });

  /* 화면을 보지 않는 손이 결과를 안다 — 받아들이면 confirm, 되돌아오면 reject. */
  it('라벨을 받아들이고 등록을 마치면 받아들였다는 신호를 낸다', async () => {
    const user = userEvent.setup();
    mount([accepts]);
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    expect(signals).toEqual(['confirm']);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));
    await screen.findByText('입하를 등록했습니다');

    expect(signals).toEqual(['confirm', 'confirm']);
  });

  it('담아 두지 못하면 거절 신호를 낸다', async () => {
    held.failWrite = OUTBOX_KEY;
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);

    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));

    expect(await screen.findByText('입하를 저장하지 못했습니다')).toBeTruthy();
    expect(signals.at(-1)).toBe('reject');
  });

  /* 「다음 입하」를 누르고 다시 스캔하는 한 걸음을 줄인다. */
  it('결과 화면에서 다음 라벨을 읽으면 그 자리에서 다음 입하를 시작한다', async () => {
    const user = userEvent.setup();
    mount([accepts]);
    await screen.findByLabelText('LOT 번호');
    await choosePoLine(user);
    await user.type(await screen.findByLabelText(/실입하\ 수량/), '500');
    await user.click(screen.getByRole('button', { name: '입하 등록' }));
    await screen.findByText('입하를 등록했습니다');

    scan(OTHER_LOT_NO);

    expect(await screen.findByRole('heading', { name: QTY_STEP })).toBeTruthy();
    expect(screen.getByRole('group', { name: '처리 중인 작업' })).toHaveTextContent(OTHER_LOT_NO);
    expect(screen.queryByText('입하를 등록했습니다')).toBeNull();
  });

  /* 라인 고르기에서 뒤로가기는 라벨을 비우고 스캔 자리로 — 다음 라벨을 받을 자리다. */
  it('라인 고르기에서 단말의 뒤로가기를 누르면 스캔 단계로 돌아간다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('LOT 번호');
    /* 라벨이 없으면 알아서 고르지 않아 라인 고르기에 선다. */
    await user.click(screen.getByRole('button', { name: 'LOT 번호 없음' }));
    await screen.findByRole('heading', { name: LOTLESS_ORDER_STEP });

    runBackStep();

    expect(await screen.findByRole('heading', { name: '자재 LOT 라벨을 스캔하세요' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: '처리 중인 작업' })).toBeNull();
  });
});
