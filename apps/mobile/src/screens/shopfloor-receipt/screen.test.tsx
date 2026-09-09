import { act, screen, waitFor } from '@testing-library/react';
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
import { useWorkerSession } from '../../patterns/worker-session';
import { ShopfloorReceiptScreen } from './screen';

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

/*
 * 계약의 쪽 정보는 total 이다. 다른 이름으로 두면 쪽을 끝까지 도는 조회가 종료 조건을 만나지
 * 못해 같은 쪽을 끝없이 다시 부른다.
 */
const page = { page: 0, size: 200, total: 0 };

const ISSUE_NO = 'GI-2026-000402';

interface Options {
  /** 이 출고 전표를 서버가 이미 받았다고 답한다. */
  alreadyReceived?: boolean;
  /** 수령 등록을 서버가 거부한다. */
  rejectReceipt?: boolean;
  /** 보낸 요청을 모은다. 한 건인지는 요청 수가 아니라 멱등키가 하나인지로 잰다. */
  seen?: Request[];
  /** 출고 라인 수량. */
  issueQty?: number;
  /** 이미 받았는지 묻는 조회가 닿지 않는다 - 오프라인에서 이 판정을 할 수 없는 자리다. */
  receivedCheckUnreachable?: boolean;
  /** 차이 사유 값 목록을 비워 답한다 - 아직 확정 전이라 실서버가 그렇게 답한다. */
  noReasonOptions?: boolean;
  /** 차이 사유 값 목록이 늦게 답한다 - 아직 모르는 것과 없는 것이 갈리는 자리다. */
  reasonsPending?: boolean;
  /** 이 시험에서만 필요한 길. 기본 길보다 먼저 본다. */
  extra?: StubRoute[];
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/logistics/goods-issues',
    respond: () =>
      jsonResponse({
        items: [
          {
            goodsIssueId: 500,
            goodsIssueNo: ISSUE_NO,
            issueTypeCode: 'PRODUCTION',
            sourceDocumentTypeCode: 'PICKING_ORDER',
            sourceDocumentId: 300,
            sourceWarehouseId: 5,
            issuedAt: '2026-09-07T09:00:00+09:00',
            statusCode: 'POSTED',
          },
        ],
        page,
      }),
  },
  {
    match: (req) => /\/logistics\/goods-issues\/\d+\/lines$/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        items: [
          {
            goodsIssueLineId: 1,
            goodsIssueId: 500,
            lineNo: 1,
            itemId: 100,
            lotId: 1000,
            issueQty: options.issueQty ?? 500,
            uomId: 9,
          },
        ],
        page,
      }),
  },
  {
    match: (req) => /\/logistics\/picking-orders\/\d+$/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        pickingOrder: {
          pickingOrderId: 300,
          pickingOrderNo: 'PK-2026-000300',
          pickingTypeCode: 'MATERIAL',
          sourceDocumentTypeCode: 'MATERIAL_ISSUE_REQUEST',
          sourceDocumentId: 200,
          warehouseId: 5,
          statusCode: 'REGISTERED',
        },
        lines: [],
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/equipments',
    respond: () =>
      jsonResponse({
        items: [
          {
            equipmentId: 7,
            plantId: 1,
            equipmentCode: 'EQ-01',
            equipmentName: '사출 1호',
            equipmentTypeCode: 'INJECTION',
            locationId: 55,
            statusCode: 'IN_SERVICE',
            calibrationRequired: false,
            isActive: true,
          },
        ],
        page: { ...page, total: 1 },
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/locations/55',
    respond: () =>
      jsonResponse({
        location: {
          locationId: 55,
          warehouseId: 12,
          locationCode: 'HOP-01',
          locationName: '사출 1호 호퍼',
          locationTypeCode: 'HOPPER',
          allowMixedItem: true,
          allowMixedLot: true,
          isActive: true,
        },
        editability: {},
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/inventory/balances',
    respond: () =>
      jsonResponse({
        items: [
          {
            groupBy: 'LOT',
            itemId: 100,
            lotId: 4,
            onHandQty: 120,
            reservedQty: 0,
            pickedQty: 0,
            blockedQty: 0,
            availableQty: 120,
            uomId: 9,
            ownershipTypeCode: 'OWN',
          },
        ],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/locations/42',
    respond: () =>
      jsonResponse({
        location: {
          locationId: 42,
          warehouseId: 12,
          locationCode: 'L1-STG',
          locationName: '사출 1호 라인사이드',
          locationTypeCode: 'FLOOR',
          allowMixedItem: true,
          allowMixedLot: true,
          isActive: true,
        },
        editability: {},
      }),
  },
  {
    match: (req) => /\/logistics\/material-issue-requests\/\d+$/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        materialIssueRequest: {
          materialIssueRequestId: 200,
          issueRequestNo: 'MR-2026-000200',
          workOrderId: 700,
          destinationLocationId: 42,
          requiredAt: '2026-09-07T08:00:00+09:00',
          statusCode: 'REGISTERED',
          requestedBy: 900028,
        },
        lines: [],
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/logistics/shopfloor-receipts',
    respond: (req) => {
      if (req.method === 'POST') {
        options.seen?.push(req.clone());

        if (options.rejectReceipt === true) {
          return jsonResponse(
            { code: 'VALIDATION_FAILED', message: '이미 받은 전표입니다.', errors: [] },
            { status: 400 },
          );
        }

        return jsonResponse({ shopfloorReceiptId: 900 }, { status: 201 });
      }

      if (options.receivedCheckUnreachable === true) {
        return jsonResponse(
          { code: 'SERVICE_UNAVAILABLE', message: '연결할 수 없습니다.', errors: [] },
          { status: 503 },
        );
      }

      return jsonResponse({
        items: options.alreadyReceived === true ? [{ shopfloorReceiptId: 900 }] : [],
        page,
      });
    },
  },
  {
    match: (req) => /^\/trace\/lots\/\d+$/.test(new URL(req.url).pathname),
    respond: (req) => {
      const id = Number(new URL(req.url).pathname.split('/').pop());

      return jsonResponse({
        lot: { lotId: id, lotNo: `FLOT-2026-0${String(id)}` },
        externalIdentifiers: [],
        holds: [],
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: [{ itemId: 100, itemCode: 'RM-1001', itemName: '원자재', fifoPolicyCode: 'FEFO' }],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/code-values',
    respond: (req) => {
      /* 그룹을 가리지 않으면 차이 사유 목록이 조정 사유 자리에도 답해 판정이 어긋난다. */
      if (new URL(req.url).searchParams.get('codeGroupCode') === 'INVENTORY_ADJUSTMENT_REASON') {
        return jsonResponse({
          items: [
            {
              code: 'HOPPER_MEASUREMENT',
              codeName: 'Hopper measurement',
              nameKo: '호퍼 실측',
              isActive: true,
              displayOrder: 1,
            },
          ],
          page,
        });
      }

      if (options.reasonsPending === true) {
        return new Promise<Response>(() => {
          /* 답하지 않는다. 목록을 기다리는 동안 화면이 무엇을 허락하는지 재는 자리다. */
        });
      }

      return jsonResponse({
        items:
          options.noReasonOptions === true
            ? []
            : [
                {
                  code: 'TRANSPORT_DAMAGE',
                  codeName: 'Transport damage',
                  nameKo: '운반 중 파손',
                  isActive: true,
                  displayOrder: 1,
                },
              ],
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

const mount = (options: Options = {}) =>
  renderWithProviders(
    <MemoryRouter>
      <SignedIn>
        <ShopfloorReceiptScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch([...(options.extra ?? []), ...routes(options)]) },
  );

const scan = (code: string) => {
  const field = screen.getByLabelText(/출고 QR 스캔/) as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, code);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const receivedField = () => screen.findByLabelText(/RM-1001 · FLOT-2026-01000 수령 수량/);

beforeEach(() => {
  held.failWrite = null;
  store.clear();
  localStorage.clear();
  /* 연결 상태를 흉내 낸 것이 다음 시험으로 새면 엉뚱한 자리에서 오프라인이 된다. */
  vi.restoreAllMocks();
});

describe('생산창고 입고 화면', () => {
  it('스캔한 출고 전표의 라인을 보인다', async () => {
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);

    expect(await screen.findByText(`${ISSUE_NO} · 1라인`)).toBeTruthy();
    expect(await receivedField()).toBeTruthy();
  });

  /*
   * 숫자판이 붙는 자리를 라인 번호로 기억한다. 전표를 되돌릴 때 두고 가면 다른 전표의 같은
   * 번호 줄에 붙은 채로 열려, 어느 칸에 들어가는지가 어긋난다.
   */
  it('전표를 되돌리면 숫자판도 함께 접는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.click(await receivedField());
    expect(screen.getByRole('button', { name: '7' })).toBeTruthy();

    act(() => {
      runBackStep();
    });

    scan(ISSUE_NO);
    await receivedField();

    expect(screen.queryByRole('button', { name: '7' })).toBeNull();
  });

  /*
   * 자재가 라인에 들어오는 이 시점에 사람이 눈으로 잰다. 여기서 적지 않으면 호퍼에 무엇이
   * 얼마나 남았는지가 어디에도 남지 않는다.
   */
  it('설비를 고르면 그 호퍼의 장부 잔량을 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await receivedField();

    await user.click(await screen.findByRole('combobox', { name: '설비' }));
    await user.click(await screen.findByRole('option', { name: /EQ-01/ }));

    expect(await screen.findByText(/HOP-01/)).toBeTruthy();
    expect(await screen.findByText('장부 120')).toBeTruthy();
  });

  /*
   * 사람이 넣는 것은 잰 값이고 뺀 값이 아니다. 차이를 사람에게 계산시키면 부호를 뒤집어 적는
   * 순간 재고가 반대로 움직인다.
   */
  it('잰 값에서 장부를 빼 증감량으로 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({
      extra: [
        {
          match: (req) =>
            new URL(req.url).pathname === '/inventory/adjustments' && req.method === 'POST',
          respond: (req) => {
            seen.push(req.clone());
            return jsonResponse({ inventoryAdjustmentId: 1 }, { status: 201 });
          },
        },
      ],
    });
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await receivedField();

    await user.click(await screen.findByRole('combobox', { name: '설비' }));
    await user.click(await screen.findByRole('option', { name: /EQ-01/ }));
    await user.type(await screen.findByLabelText(/RM-1001 실측 잔량/), '100');

    expect(await screen.findByText('차이 -20')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '호퍼 잔량 기록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]!.json()) as {
      reasonCode: string;
      lines: { locationId: number; itemId: number; adjustmentQty: number }[];
    };

    expect(body.reasonCode).toBe('HOPPER_MEASUREMENT');
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatchObject({ locationId: 55, itemId: 100, adjustmentQty: -20 });
  });

  /* 어디로 들어온 것인가. 없으면 받은 자리가 전표에만 남는다. */
  it('어디로 들어온 것인지 보인다', async () => {
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);

    expect(await screen.findByText(/L1-STG/)).toBeTruthy();
  });

  /*
   * 통신이 끊기면 출고와 입고가 한 기기로 합쳐진다(결정 17 시나리오 2). 말하지 않으면
   * 작업자는 평소처럼 다른 기기를 기다린다.
   */
  it('오프라인이면 출고분도 이 기기에서 한다고 알린다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    mount();

    expect(await screen.findByText('오프라인입니다')).toBeTruthy();
  });

  it('연결돼 있으면 그 말을 하지 않는다', async () => {
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    expect(screen.queryByText('오프라인입니다')).toBeNull();
  });

  /*
   * 장갑을 끼고 한 손으로 조작한다. 단말 키보드는 키가 촘촘하고, 올라오면 라인 목록과 확정
   * 단추를 덮는다(설계 §7 · 공유계약 G-6).
   */
  it('수령 수량을 숫자판으로 넣는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);

    expect(screen.queryByRole('button', { name: '7' })).toBeNull();

    await user.click(await receivedField());
    await user.click(await screen.findByRole('button', { name: '5' }));
    await user.click(screen.getByRole('button', { name: '0' }));

    expect(((await receivedField()) as HTMLInputElement).value).toBe('50');
  });

  /* 초과는 데이터베이스가 막는다. 화면이 통과시키면 확정이 서버에서 되돌아온다. */
  it('출고한 것보다 많이 받지 못한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '501');

    expect(await screen.findByText(/출고한 500 보다 많이 받을 수 없습니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고 확정' })).toBeDisabled();
  });

  /* 왜 모자란지를 아는 사람은 물건을 받은 그 자리에 있다. */
  it('모자라면 사유를 고르기 전에는 확정할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '480');

    expect(await screen.findByText('차이 20 모자람')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고 확정' })).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: /차이 사유/ }));
    await user.click(screen.getByRole('option', { name: '운반 중 파손' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입고 확정' })).not.toBeDisabled();
    });
  });

  /*
   * 사유 값 목록은 아직 확정 전이라 실서버에서 빈 목록이 온다. 고를 것이 없는데 요구하면
   * 부족 수령을 영영 확정하지 못한다 - 물건은 이미 와 있다.
   */
  it('고를 사유가 없으면 모자라도 확정할 수 있다', async () => {
    const user = userEvent.setup();
    mount({ noReasonOptions: true });
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '480');

    /* 모자란 사실은 고를 사유가 있든 없든 보인다. 숨기면 그냥 덜 받은 것이 된다. */
    expect(await screen.findByText('차이 20 모자람')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: /차이 사유/ })).toBeNull();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입고 확정' })).not.toBeDisabled();
    });
  });

  /*
   * 아직 묻는 중인 것을 없는 것으로 세면, 목록이 오기 전 그 짧은 창에 사유 없이 확정된다.
   * 왜 모자랐는지는 그 자리에서만 알 수 있어 뒤에 채울 수 없다.
   */
  it('사유 목록을 기다리는 동안에는 모자란 수령을 확정하지 않는다', async () => {
    const user = userEvent.setup();
    mount({ reasonsPending: true });
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '480');

    expect(await screen.findByText('차이 20 모자람')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고 확정' })).toBeDisabled();
  });

  /* 초과는 모자란 것이 아니다. 부호를 보지 않고 뭉치면 모자란 양이 음수로 적힌다. */
  it('출고보다 많이 받으면 모자라다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '501');

    expect(await screen.findByText(/출고한 500 보다 많이 받을 수 없습니다/)).toBeTruthy();
    expect(screen.queryByText(/모자람/)).toBeNull();
    expect(screen.queryByRole('combobox', { name: /차이 사유/ })).toBeNull();
  });

  it('전량 받으면 사유 없이 확정한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입고 확정' })).not.toBeDisabled();
    });
    expect(screen.queryByText('차이 0 모자람')).toBeNull();
  });

  /*
   * 수령 전표는 출고 전표와 1:1 이다. 단말이 기억하는 것으로는 재시작을 넘지 못해, 앱을 다시
   * 켜거나 다른 단말로 같은 전표를 열면 같은 물건을 두 번 받은 것이 된다.
   */
  it('이미 받은 출고 전표로 들어오면 그 사실을 말하고 막는다', async () => {
    mount({ alreadyReceived: true });
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);

    expect(await screen.findByText('이미 입고된 출고 전표입니다')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '입고 확정' })).toBeNull();
  });

  /*
   * 막지 않는다 - 오프라인 입고 자체가 이 화면이 하는 일이다. 다만 조용히 넘기면 작업자는
   * 확인된 줄 알고 이미 받은 전표를 또 받는다.
   */
  it('이미 받았는지 확인하지 못하면 그 사실을 밝히되 막지는 않는다', async () => {
    const user = userEvent.setup();
    mount({ receivedCheckUnreachable: true });
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);

    expect(await screen.findByText('이미 받은 전표인지 확인하지 못했습니다')).toBeTruthy();

    await user.type(await receivedField(), '500');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입고 확정' })).not.toBeDisabled();
    });
  });

  it('확인이 끝나면 확인하지 못했다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '입고 확정' })).not.toBeDisabled();
    });
    expect(screen.queryByText('이미 받은 전표인지 확인하지 못했습니다')).toBeNull();
  });

  it('확정하면 작업지시와 도착 위치를 함께 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');
    await user.click(screen.getByRole('button', { name: '입고 확정' }));

    expect(await screen.findByText('입고를 기록했습니다')).toBeTruthy();

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]?.json()) as {
      goodsIssueId: number;
      workOrderId: number;
      destinationLocationId: number;
      lines: { receivedQty: number }[];
    };

    expect(body.goodsIssueId).toBe(500);
    expect(body.workOrderId).toBe(700);
    expect(body.destinationLocationId).toBe(42);
    expect(body.lines[0]?.receivedQty).toBe(500);
  });

  /*
   * 연타는 button.click() 을 연속으로 불러야 갈린다. await user.click() 세 번은 클릭 사이에
   * 다시 그리기가 끼어 결함이 있어도 통과한다. 요청 수가 아니라 멱등키가 하나인지로 잰다.
   */
  it('연타해도 한 건만 담는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');

    const button = screen.getByRole('button', { name: '입고 확정' });
    button.click();
    button.click();
    button.click();

    expect(await screen.findByText('입고를 기록했습니다')).toBeTruthy();

    const keys = new Set(seen.map((each) => each.headers.get('Idempotency-Key')));

    expect(keys.size).toBe(1);
  });

  /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 입고된 줄 안다. */
  it('단말 보관소가 거절하면 기록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '입고 확정' }));

    expect(await screen.findByText('입고를 저장하지 못했습니다')).toBeTruthy();
  });

  it('서버가 되돌리면 되돌아왔다고 말한다', async () => {
    const user = userEvent.setup();
    mount({ rejectReceipt: true });
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '500');
    await user.click(screen.getByRole('button', { name: '입고 확정' }));

    expect(await screen.findByText('입고를 전송하지 못했습니다')).toBeTruthy();
  });
});
