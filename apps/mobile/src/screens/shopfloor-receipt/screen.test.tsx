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
import { itemRoutes } from '../../test/master-routes';
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
  /** 출고의 원천 유형. 피킹지시가 아니면 작업지시를 이어받을 사슬이 없다. */
  sourceTypeCode?: string;
  /** 피킹지시의 원천 유형. 출하 지시면 자재 출고요청이 아니라 사슬이 거기서 끊긴다. */
  pickingSourceTypeCode?: string;
  /** 물어본 주소를 모은다. 응답만 돌려주는 스텁은 부르지 말아야 할 것을 부른 것을 못 잡는다. */
  asked?: string[];
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
            sourceDocumentTypeCode: options.sourceTypeCode ?? 'PICKING_ORDER',
            sourceDocumentId: 300,
            sourceWarehouseId: 5,
            issuedAt: '2026-09-07T09:00:00+09:00',
            statusCode: 'POSTED',
          },
          {
            goodsIssueId: 501,
            goodsIssueNo: SECOND_ISSUE_NO,
            issueTypeCode: 'PRODUCTION',
            sourceDocumentTypeCode: 'PICKING_ORDER',
            sourceDocumentId: 300,
            sourceWarehouseId: 5,
            issuedAt: '2026-09-07T10:00:00+09:00',
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
    respond: (req) => {
      options.asked?.push(new URL(req.url).pathname);

      return jsonResponse({
        pickingOrder: {
          pickingOrderId: 300,
          pickingOrderNo: 'PK-2026-000300',
          pickingTypeCode: 'MATERIAL',
          sourceDocumentTypeCode: options.pickingSourceTypeCode ?? 'MATERIAL_ISSUE_REQUEST',
          sourceDocumentId: 200,
          warehouseId: 5,
          statusCode: 'REGISTERED',
        },
        lines: [],
      });
    },
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
          /* 호퍼가 지정되지 않은 설비. 잴 자리가 없어 고를 것에 서면 안 된다. */
          {
            equipmentId: 8,
            plantId: 1,
            equipmentCode: 'EQ-02',
            equipmentName: '조립 1호',
            equipmentTypeCode: 'ASSEMBLY',
            locationId: null,
            statusCode: 'IN_SERVICE',
            calibrationRequired: false,
            isActive: true,
          },
        ],
        page: { ...page, total: 2 },
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
    /*
     * 같은 품목이 여러 LOT 으로 남은 호퍼를 그린다. 한 줄만 돌려주면 자재를 여러 번 채운
     * 호퍼를 시험이 재지 못한다 - 현장에서는 그것이 보통이다.
     */
    respond: () =>
      jsonResponse({
        items: [
          {
            groupBy: 'LOT',
            itemId: 100,
            lotId: 4,
            lotNo: 'LOT-A',
            onHandQty: 120,
            reservedQty: 0,
            pickedQty: 0,
            blockedQty: 0,
            availableQty: 120,
            uomId: 9,
            ownershipTypeCode: 'OWN',
          },
          {
            groupBy: 'LOT',
            itemId: 100,
            lotId: 5,
            lotNo: 'LOT-B',
            onHandQty: 30,
            reservedQty: 0,
            pickedQty: 0,
            blockedQty: 0,
            availableQty: 30,
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
    respond: (req) => {
      options.asked?.push(new URL(req.url).pathname);

      return jsonResponse({
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
      });
    },
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
  ...itemRoutes([{ itemId: 100, itemCode: 'RM-1001', itemName: '원자재', fifoPolicyCode: 'FEFO' }]),
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

const OTHER_ISSUE_NO = 'GI-2026-000999';
const SECOND_ISSUE_NO = 'GI-2026-000403';

describe('생산창고 입고 화면', () => {
  /*
   * 서버가 없다고 답한 것을 연결 탓으로 말하면, 붙어 있는 사람이 신호를 찾아 자리를 옮긴다.
   * 옮겨도 그대로라 시간만 버리고 정작 누구에게 알려야 하는지는 끝내 모른다.
   */
  it('도착 위치가 404 면 연결을 확인하라고 말하지 않는다', async () => {
    mount({
      extra: [
        {
          match: (req) => new URL(req.url).pathname === '/mdm/locations/42',
          respond: () => jsonResponse({ message: 'not found' }, { status: 404 }),
        },
      ],
    });
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);

    expect(
      await screen.findByText(
        '도착 위치를 확인하지 못했습니다. 연결 문제가 아니니 담당자에게 알리세요.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('도착 위치를 확인할 수 없습니다. 연결을 확인하세요.')).toBeNull();
  });

  it('도착 위치 조회가 끊기면 연결을 확인하라고 말한다', async () => {
    mount({
      extra: [
        {
          match: (req) => new URL(req.url).pathname === '/mdm/locations/42',
          respond: () => {
            throw new TypeError('Failed to fetch');
          },
        },
      ],
    });
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);

    expect(
      await screen.findByText('도착 위치를 확인할 수 없습니다. 연결을 확인하세요.'),
    ).toBeTruthy();
  });

  /*
   * 실기 실측 2026-09-14 - 입고 전표 원천 출고를 넣으니 조회 권한 문구가 떴다. 단말은 멀쩡한데
   * 작업자는 관리자에게 기기 설정을 물으러 간다. 원천 유형을 보지 않고 피킹지시를 불러 401 이
   * 난 것이었다.
   */
  it('피킹지시 원천이 아니면 피킹지시를 부르지 않는다', async () => {
    const asked: string[] = [];
    mount({ sourceTypeCode: 'GOODS_RECEIPT', asked });
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);

    expect(await screen.findByText('생산창고 입고 대상이 아닌 출고 전표입니다')).toBeTruthy();
    expect(asked.some((url) => url.includes('/logistics/picking-orders/'))).toBe(false);
    /* 단말 설정과 무관한 일에 조회 권한 문구를 달지 않는다. */
    expect(screen.queryByText(/기기 설정을 확인하세요/)).toBeNull();
  });

  /*
   * 사슬이 한 겹 더 있다. 피킹지시의 원천도 판별자라 자재 출고요청과 출하 지시를 가른다 -
   * 출하 피킹에서 나온 출고를 여기 대면 출하 지시 번호로 자재 출고요청을 묻게 된다.
   */
  it('출하 피킹에서 나온 출고면 자재 출고요청을 부르지 않는다', async () => {
    const asked: string[] = [];
    mount({ pickingSourceTypeCode: 'SHIPMENT_REQUEST', asked });
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);

    expect(await screen.findByText('생산창고 입고 대상이 아닌 출고 전표입니다')).toBeTruthy();
    expect(asked.some((url) => url.includes('/logistics/material-issue-requests/'))).toBe(false);
    expect(screen.queryByText(/기기 설정을 확인하세요/)).toBeNull();
  });

  /* 두 값이 없으면 수령 전표를 만들 수 없다. 지어내면 다른 작업지시에 재고가 붙는다. */
  it('피킹지시 원천이 아니면 수령 기록을 열지 않는다', async () => {
    mount({ sourceTypeCode: 'GOODS_RECEIPT' });
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await screen.findByText('생산창고 입고 대상이 아닌 출고 전표입니다');

    expect(screen.getByRole('button', { name: '입고 확정' })).toBeDisabled();
  });

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
  it('설비를 고르면 그 호퍼의 전산 잔량을 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await receivedField();

    await user.click(await screen.findByRole('combobox', { name: '설비' }));
    await user.click(await screen.findByRole('option', { name: /EQ-01/ }));

    expect(await screen.findByText(/HOP-01/)).toBeTruthy();
    expect(await screen.findByText('전산 잔량 120')).toBeTruthy();
  });

  /*
   * 숫자판에 상한을 두면 넘기는 키를 조용히 무시한다 - 눌러도 아무 일이 없어 사람은 기기가
   * 멎은 줄 안다. 넘겨 적히게 두고 무엇이 잘못됐는지와 어디로 가야 하는지를 말해야 한다.
   */
  it('숫자판으로 출고 수량을 넘겨 적으면 까닭과 다음 걸음을 말한다', async () => {
    const user = userEvent.setup();
    mount({ issueQty: 12 });
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);

    const field = await receivedField();
    await user.click(field);

    /* 12 를 넘겨 13 을 만든다. 상한이 걸려 있으면 3 이 무시돼 1 만 남는다. */
    await user.click(await screen.findByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '3' }));

    expect((field as HTMLInputElement).value).toBe('13');
    expect(await screen.findByText('출고 수량 12 보다 많이 받을 수 없습니다')).toBeTruthy();
    expect(await screen.findByText('출고 수량보다 많이 받을 수 없습니다')).toBeTruthy();
    expect(await screen.findByText(/물류 문서 진행현황·취소/)).toBeTruthy();
    expect(await screen.findByText(/추가 자재 출고 요청/)).toBeTruthy();
  });

  /*
   * 호퍼가 지정되지 않은 설비는 잴 자리가 없다. 목록에 세워 두면 골라 본 뒤에야 알게 되고,
   * 작업자는 자기가 잘못 골랐는지 설비가 잘못 등록됐는지 가리지 못한다.
   */
  it('호퍼가 지정되지 않은 설비는 고를 것에 서지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await receivedField();

    await user.click(await screen.findByRole('combobox', { name: '설비' }));

    expect(await screen.findByRole('option', { name: /EQ-01/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /EQ-02/ })).toBeNull();
  });

  /*
   * 같은 품목이 여러 LOT 으로 남는 것은 호퍼에서 보통이다. 품목 코드만 적으면 줄이 서로
   * 구별되지 않아 어느 줄에 적는지 알 수 없다.
   */
  /*
   * 품목을 못 받으면 그 자리에 대리키가 들어가 있었다. 호퍼 줄은 전표에 없는 품목도 서므로
   * 이 화면에서 특히 잘 드러난다 - 사람이 읽을 수 없는 숫자가 품목 코드인 척한다.
   */
  it('호퍼 줄의 품목을 못 받으면 대리키를 보이지 않는다', async () => {
    const user = userEvent.setup();
    mount({
      extra: [
        {
          match: (req) => /^\/mdm\/items\/\d+$/.test(new URL(req.url).pathname),
          respond: () => {
            throw new TypeError('Failed to fetch');
          },
        },
      ],
    });
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);

    /* 품목을 막았으므로 줄 이름으로 기다릴 수 없다 - 설비 고르는 자리가 설 때까지 기다린다. */
    await user.click(await screen.findByRole('combobox', { name: '설비' }));
    await user.click(await screen.findByRole('option', { name: /EQ-01/ }));

    const shown = await screen.findAllByText('이름을 불러오지 못했습니다');

    expect(shown.length).toBeGreaterThan(0);
    expect(screen.queryByText('100')).toBeNull();
  });

  it('호퍼 줄마다 LOT 번호를 함께 보인다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await receivedField();

    await user.click(await screen.findByRole('combobox', { name: '설비' }));
    await user.click(await screen.findByRole('option', { name: /EQ-01/ }));

    expect(await screen.findByLabelText('RM-1001 · LOT-A 실측 잔량')).toBeTruthy();
    expect(await screen.findByLabelText('RM-1001 · LOT-B 실측 잔량')).toBeTruthy();

    /*
     * 읽어 주는 이름만으로는 눈으로 훑는 사람이 어느 줄인지 알 수 없다. 값만 세워도 34자리
     * 숫자가 무엇인지 알 수 없어, 무엇을 보고 있는지 함께 적는다.
     */
    expect(await screen.findByText('LOT-A')).toBeTruthy();
    expect(await screen.findByText('LOT-B')).toBeTruthy();

    /* 라인 수령 한 줄과 호퍼 두 줄. 세 줄 모두 같은 꼴로 선다. */
    expect((await screen.findAllByText('RM-1001')).length).toBe(3);
    expect((await screen.findAllByText('품목')).length).toBe(3);
    expect((await screen.findAllByText('LOT')).length).toBe(3);
  });

  /*
   * 기록이 서버에 닿으면 전산 잔량이 그만큼 움직인다. 화면이 앞 값을 들고 있으면 곧바로 다시 잰
   * 사람이 이미 반영된 차이를 또 보낸다 - 100 을 99 로 고친 뒤 다시 99 를 적으면 98 이 된다.
   */
  it('호퍼 잔량을 기록하면 그 호퍼의 전산 잔량을 다시 받는다', async () => {
    const user = userEvent.setup();
    let asked = 0;
    mount({
      extra: [
        {
          match: (req) => new URL(req.url).pathname === '/inventory/balances',
          respond: () => {
            asked += 1;

            return jsonResponse({
              items: [
                {
                  groupBy: 'LOT',
                  itemId: 100,
                  lotId: 4,
                  lotNo: 'LOT-A',
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
            });
          },
        },
        {
          match: (req) =>
            new URL(req.url).pathname === '/inventory/adjustments' && req.method === 'POST',
          respond: () => jsonResponse({ inventoryAdjustmentId: 1 }, { status: 201 }),
        },
      ],
    });
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await receivedField();

    await user.click(await screen.findByRole('combobox', { name: '설비' }));
    await user.click(await screen.findByRole('option', { name: /EQ-01/ }));
    await user.type(await screen.findByLabelText('RM-1001 · LOT-A 실측 잔량'), '100');

    const before = asked;

    await user.click(screen.getByRole('button', { name: '호퍼 잔량 기록' }));
    expect(await screen.findByText('호퍼 잔량을 기록했습니다')).toBeTruthy();

    await waitFor(() => {
      expect(asked).toBeGreaterThan(before);
    });
  });

  /*
   * 잰 값을 품목으로 묶으면 한 칸에 적은 것이 같은 품목의 나머지 줄로 번지고, 줄마다 전산 잔량이
   * 달라 서로 다른 차이가 만들어진다 - 실기에서 레진 한 칸에 120 을 적으니 일곱 줄이 차고
   * 차이 합계가 +95 로 섰다. 사람이 뜻한 것은 -625 였다.
   */
  it('한 LOT 에 적은 값이 같은 품목의 다른 LOT 으로 번지지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await receivedField();

    await user.click(await screen.findByRole('combobox', { name: '설비' }));
    await user.click(await screen.findByRole('option', { name: /EQ-01/ }));

    await user.type(await screen.findByLabelText('RM-1001 · LOT-A 실측 잔량'), '100');

    expect((screen.getByLabelText('RM-1001 · LOT-B 실측 잔량') as HTMLInputElement).value).toBe('');
    expect(await screen.findByText('차이 -20')).toBeTruthy();
    expect(screen.queryByText('차이 70')).toBeNull();
  });

  /*
   * 사람이 넣는 것은 잰 값이고 뺀 값이 아니다. 차이를 사람에게 계산시키면 부호를 뒤집어 적는
   * 순간 재고가 반대로 움직인다.
   */
  it('잰 값에서 전산 잔량을 빼 증감량으로 보낸다', async () => {
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
    await user.type(await screen.findByLabelText('RM-1001 · LOT-A 실측 잔량'), '100');

    expect(await screen.findByText('차이 -20')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '호퍼 잔량 기록' }));

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    const body = (await seen[0]!.json()) as {
      reasonCode: string;
      lines: { locationId: number; itemId: number; lotId: number; adjustmentQty: number }[];
    };

    expect(body.reasonCode).toBe('HOPPER_MEASUREMENT');
    /* 적은 줄만 간다. 적지 않은 LOT 이 함께 실리면 전산 잔량이 그만큼 틀어진다. */
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatchObject({
      locationId: 55,
      itemId: 100,
      lotId: 4,
      adjustmentQty: -20,
    });
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
  it('출고 수량보다 많이 받지 못한다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '501');

    expect(await screen.findByText(/출고 수량 500 보다 많이 받을 수 없습니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고 확정' })).toBeDisabled();
  });

  /* 왜 모자란지를 아는 사람은 물건을 받은 그 자리에 있다. */
  it('모자라면 사유를 고르기 전에는 확정할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '480');

    expect(await screen.findByText('차이 20 부족')).toBeTruthy();
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
    expect(await screen.findByText('차이 20 부족')).toBeTruthy();
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

    expect(await screen.findByText('차이 20 부족')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고 확정' })).toBeDisabled();
  });

  /* 초과는 모자란 것이 아니다. 부호를 보지 않고 뭉치면 모자란 양이 음수로 적힌다. */
  it('출고보다 많이 받으면 모자라다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);

    scan(ISSUE_NO);
    await user.type(await receivedField(), '501');

    expect(await screen.findByText(/출고 수량 500 보다 많이 받을 수 없습니다/)).toBeTruthy();
    expect(screen.queryByText(/부족/)).toBeNull();
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
    expect(screen.queryByText('차이 0 부족')).toBeNull();
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
  /*
   * 스캔 하나가 이 화면의 대상을 정한다. 이미 읽은 뒤에 다른 라벨을 스치면 대상이 조용히
   * 바뀌는데, 작업자는 앞엣것에 적는 줄 알고 다음 단계로 넘어간다.
   */
  it('이미 읽은 뒤 다른 값을 읽으면 되묻는다', async () => {
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await screen.findByText(`${ISSUE_NO} · 1라인`);

    scan(OTHER_ISSUE_NO);

    /* 제목은 창이 닫혀도 DOM 에 남는다. 닿을 수 있는 단추로 열렸는지를 잰다. */
    expect(await screen.findByRole('button', { name: '그대로 두기' })).toBeTruthy();
    expect(screen.queryByText(`${OTHER_ISSUE_NO} 출고 전표를 찾지 못했습니다`)).toBeNull();
  });

  it('되물은 창에서 새 값을 받으면 그때 대상이 바뀐다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await screen.findByText(`${ISSUE_NO} · 1라인`);
    scan(OTHER_ISSUE_NO);

    await user.click(await screen.findByRole('button', { name: '새로 읽은 값으로' }));

    expect(await screen.findByText(`${OTHER_ISSUE_NO} 출고 전표를 찾지 못했습니다`)).toBeTruthy();
  });

  /*
   * 전표를 바꿨는데 앞 전표를 보며 고른 설비와 잰 값이 남으면, 그 값이 다른 전표의 작업으로
   * 이어진다. 수령 수량은 전표가 바뀌면 다시 만들어지는데 호퍼 쪽만 남는다.
   */
  it('새 전표를 받으면 고른 설비와 잰 값이 비워진다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await receivedField();

    await user.click(await screen.findByRole('combobox', { name: '설비' }));
    await user.click(await screen.findByRole('option', { name: /EQ-01/ }));
    await screen.findByText(/HOP-01/);

    scan(SECOND_ISSUE_NO);
    await user.click(await screen.findByRole('button', { name: '새로 읽은 값으로' }));

    await screen.findByText(`${SECOND_ISSUE_NO} · 1라인`);
    /* 전표가 바뀌었는데 앞 전표를 보며 고른 설비가 남아 있으면 그 호퍼가 계속 보인다. */
    expect(screen.queryByText(/HOP-01/)).toBeNull();
  });
  /*
   * 호퍼 결과 배너도 전표에 딸린 값이다. 남으면 새 전표 화면에 앞 전표의 기록 결과가 떠 있어,
   * 이번 것도 이미 적은 줄로 읽힌다.
   */
  it('새 전표를 받으면 앞 전표의 호퍼 결과가 남지 않는다', async () => {
    const user = userEvent.setup();
    mount({
      extra: [
        {
          match: (req: Request) =>
            new URL(req.url).pathname === '/inventory/adjustments' && req.method === 'POST',
          respond: () => jsonResponse({ inventoryAdjustmentId: 1 }, { status: 201 }),
        },
      ],
    });
    await screen.findByLabelText(/출고 QR 스캔/);
    scan(ISSUE_NO);
    await receivedField();

    await user.click(await screen.findByRole('combobox', { name: '설비' }));
    await user.click(await screen.findByRole('option', { name: /EQ-01/ }));
    await user.type(await screen.findByLabelText('RM-1001 · LOT-A 실측 잔량'), '100');
    await user.click(screen.getByRole('button', { name: '호퍼 잔량 기록' }));

    expect(await screen.findByText('호퍼 잔량을 기록했습니다')).toBeTruthy();

    scan(SECOND_ISSUE_NO);
    await user.click(await screen.findByRole('button', { name: '새로 읽은 값으로' }));
    await screen.findByText(`${SECOND_ISSUE_NO} · 1라인`);

    expect(screen.queryByText('호퍼 잔량을 기록했습니다')).toBeNull();
  });
});
