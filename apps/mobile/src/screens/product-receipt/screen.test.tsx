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
import { ProductReceiptScreen } from './screen';

const store = vi.hoisted(() => new Map<string, string>());
const tone = vi.hoisted(() => ({ played: 0 }));

vi.mock('../../patterns/error-tone', () => ({
  playErrorTone: () => {
    tone.played += 1;
  },
}));
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

const UNIT_NO = 'HU-2026-000710';
const LOT_NO = 'FG-2026-000311';
const LOC_CODE = 'FG-A-02-01';

interface Options {
  /** 창고가 위치를 관리하지 않는다 - 대표 위치로 들어간다. */
  unmanaged?: boolean;
  /** 대표 위치가 없다 - 목적지를 지어낼 수 없다. */
  noDefaultLocation?: boolean;
  /** LOT 이 아직 검사 대기다. */
  pending?: boolean;
  /** 입고 응답이 적치 지시를 싣지 않는다. */
  noPutawayTask?: boolean;
  /** 적치 완료를 서버가 거절한다 - 입고는 섰고 적치만 되돌아온다. */
  putawayRejected?: boolean;
  /** 인식표에 담긴 것이 없다. */
  emptyUnit?: boolean;
  /** 보낸 요청을 모은다. */
  seen?: Request[];
  /** 물어본 주소를 모은다. */
  asked?: string[];
  /** 이 품목에 정해진 자리가 없다 - 규칙이 비어 있는 갈래다. */
  noRule?: boolean;
  /** 규칙이 다른 자리를 가리킨다 - 스캔한 곳이 권장이 아닌 갈래다. */
  recommendsOther?: boolean;
  /** 이 LOT 이 이미 재고로 서 있다 - 다른 기기가 먼저 입고한 갈래다. */
  alreadyStocked?: boolean;
  /** 재고 조회가 닿지 않는다 - 오프라인에서 이 판정을 할 수 없는 자리다. */
  stockUnreachable?: boolean;
  /** 한 인식표에 품목이 둘이다 - 어느 규칙으로 재야 할지 정해진 것이 없는 자리다. */
  twoItems?: boolean;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (req) => new URL(req.url).pathname === '/mdm/warehouses',
    respond: () =>
      jsonResponse({
        items: [
          {
            warehouseId: 1002,
            plantId: 1001,
            businessUnitId: 1001,
            warehouseCode: 'FG',
            warehouseName: '완제품창고',
            warehouseTypeCode: 'PRODUCT',
            managementLevelCode: options.unmanaged === true ? 'WAREHOUSE' : 'CELL',
            isExternal: false,
            isDefect: false,
            isActive: true,
          },
        ],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/inventory/handling-units',
    respond: (req) => {
      options.asked?.push(req.url);

      return jsonResponse({
        items: [
          /* 부분 검색이라 이웃 번호가 함께 온다. 화면이 정확 일치만 골라야 한다. */
          {
            handlingUnitId: 6002,
            handlingUnitNo: `${UNIT_NO}-A`,
            handlingUnitTypeCode: 'PALLET',
            statusCode: 'ACTIVE',
          },
          {
            handlingUnitId: 6001,
            handlingUnitNo: UNIT_NO,
            handlingUnitTypeCode: 'PALLET',
            statusCode: 'ACTIVE',
          },
        ],
        page,
      });
    },
  },
  {
    match: (req) => /\/inventory\/handling-units\/\d+\/contents/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        items:
          options.emptyUnit === true
            ? []
            : [
                {
                  handlingUnitContentId: 6101,
                  handlingUnitId: 6001,
                  itemId: 2101,
                  lotId: 8201,
                  qty: 500,
                  uomId: 1001,
                },
                ...(options.twoItems === true
                  ? [
                      {
                        handlingUnitContentId: 6102,
                        handlingUnitId: 6001,
                        itemId: 2102,
                        lotId: 8202,
                        qty: 200,
                        uomId: 1001,
                      },
                    ]
                  : []),
              ],
      }),
  },
  {
    match: (req) => /\/trace\/lots\/\d+$/.test(new URL(req.url).pathname),
    respond: () =>
      jsonResponse({
        lot: {
          lotId: 8201,
          lotNo: LOT_NO,
          itemId: 2101,
          lotTypeCode: 'PRODUCT',
          plantId: 1001,
          initialQty: 500,
          uomId: 1001,
          manufacturedAt: '2026-08-06T14:20:00+09:00',
          expiryDate: '2027-02-06',
          sourceTypeCode: 'PRODUCTION_RESULT',
          sourceId: 5501,
          statusCode: options.pending === true ? 'INSPECTION_PENDING' : 'NORMAL',
        },
        externalIdentifiers: [],
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/locations',
    respond: () =>
      jsonResponse({
        items: [
          {
            locationId: 3101,
            warehouseId: 1002,
            locationCode: LOC_CODE,
            locationName: 'A구역 02열 01단',
            locationTypeCode: 'RACK',
            allowMixedItem: true,
            allowMixedLot: true,
            isActive: true,
          },
          ...(options.noDefaultLocation === true
            ? []
            : [
                {
                  locationId: 3199,
                  warehouseId: 1002,
                  locationCode: 'FG-DEFAULT',
                  locationName: '대표',
                  locationTypeCode: 'DEFAULT',
                  allowMixedItem: true,
                  allowMixedLot: true,
                  isActive: true,
                },
              ]),
        ],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/logistics/goods-receipts',
    respond: (req) => {
      options.seen?.push(req.clone());

      return jsonResponse(
        {
          goodsReceipt: { goodsReceiptId: 9501, goodsReceiptNo: 'GR-2026-000501' },
          lines: [
            {
              goodsReceiptLineId: 9601,
              putawayTaskId: options.noPutawayTask === true ? null : 7701,
            },
          ],
        },
        { status: 201 },
      );
    },
  },
  {
    match: (req) => /\/logistics\/putaway-tasks\/\d+:complete$/.test(new URL(req.url).pathname),
    respond: (req) => {
      options.seen?.push(req.clone());

      /* 고쳐야 풀리는 거절이다. 다시 보내도 같은 답이 온다. */
      return options.putawayRejected === true
        ? jsonResponse(
            { code: 'STATE_LOCKED', message: '완료할 수 없는 지시입니다.', errors: [] },
            { status: 400 },
          )
        : jsonResponse({ putawayTaskId: 7701, statusCode: 'COMPLETED' });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/logistics/putaway-rules',
    respond: () =>
      jsonResponse({
        items:
          options.noRule === true
            ? []
            : [
                {
                  putawayRuleId: 4401,
                  itemId: 2101,
                  warehouseId: 1002,
                  locationId: options.recommendsOther === true ? 3199 : 3101,
                  capacityQty: 1000,
                  uomId: 1001,
                  priorityNo: 1,
                  isActive: true,
                },
              ],
        page,
      }),
  },
  {
    match: (req) => new URL(req.url).pathname === '/inventory/balances',
    respond: () => {
      if (options.stockUnreachable === true) {
        return jsonResponse(
          { code: 'SERVICE_UNAVAILABLE', message: '연결할 수 없습니다.', errors: [] },
          { status: 503 },
        );
      }

      return jsonResponse({
        items:
          options.alreadyStocked === true
            ? [{ balanceId: 7001, lotId: 8201, locationId: 3101, onHandQty: 500 }]
            : [],
        page,
      });
    },
  },
  {
    match: (req) => new URL(req.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: [
          { itemId: 2101, itemCode: 'FG-1001', itemName: '완제품A', fifoPolicyCode: 'FEFO' },
          { itemId: 2102, itemCode: 'FG-1002', itemName: '완제품B', fifoPolicyCode: 'FEFO' },
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
        <ProductReceiptScreen />
      </SignedIn>
    </MemoryRouter>,
    { fetch: createStubFetch(routes(options)) },
  );

const scanUnit = (value: string) => {
  const field = screen.getByLabelText(/인식표 스캔/) as HTMLInputElement;
  field.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
};

const pickWarehouse = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('combobox', { name: '입고 창고' }));
  await user.click(await screen.findByRole('option', { name: '완제품창고' }));
};

const openUnit = async (user: ReturnType<typeof userEvent.setup>) => {
  await pickWarehouse(user);
  scanUnit(UNIT_NO);
  await screen.findByText(`인식표 ${UNIT_NO}`);
};

const pickLocation = async (user: ReturnType<typeof userEvent.setup>) => {
  /* 칸은 하나다. 직접 입력을 누르면 그 스캔 칸이 손 입력으로 열린다. */
  await user.click(await screen.findByRole('button', { name: '위치 직접 입력' }));
  await user.type(await screen.findByLabelText(/위치 스캔/), LOC_CODE);
  await user.click(screen.getByRole('button', { name: '위치 넣기' }));
  await screen.findByText(`위치 ${LOC_CODE}`);
};

const readyToSubmit = async () => {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '입고·적치 완료' })).not.toBeDisabled();
  });
};

beforeEach(() => {
  held.failWrite = null;
  claims.plantId = 1001;
  store.clear();
  localStorage.clear();
  tone.played = 0;
});

describe('제품 입고·적치 화면', () => {
  /* 계약에 정확 일치 축이 없어 부분 검색으로 받는다. 화면이 정확 일치만 골라야 한다. */
  it('부분 검색 결과에서 정확히 일치하는 인식표만 고른다', async () => {
    const user = userEvent.setup();
    mount();
    await openUnit(user);

    expect(await screen.findByLabelText(/FG-1001 · FG-2026-000311 실물 수량/)).toBeTruthy();
  });

  it('담긴 수량을 기본으로 채운다', async () => {
    const user = userEvent.setup();
    mount();
    await openUnit(user);

    const field = (await screen.findByLabelText(
      /FG-1001 · FG-2026-000311 실물 수량/,
    )) as HTMLInputElement;

    expect(field.value).toBe('500');
  });

  /* 실물이 다르면 실물대로 받는다. 사유를 담을 자리가 계약에 없다. */
  it('인식표 수량과 다르면 말하되 막지 않는다', async () => {
    const user = userEvent.setup();
    mount();
    await openUnit(user);

    const field = await screen.findByLabelText(/FG-1001 · FG-2026-000311 실물 수량/);
    await user.clear(field);
    await user.type(field, '498');
    await pickLocation(user);

    expect(await screen.findByText(/인식표 수량과 다릅니다/)).toBeTruthy();
    await readyToSubmit();
  });

  it('수량이 0 이면 완료할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await openUnit(user);

    const field = await screen.findByLabelText(/FG-1001 · FG-2026-000311 실물 수량/);
    await user.clear(field);
    await user.type(field, '0');
    await pickLocation(user);

    expect(await screen.findByText('입고 수량은 0보다 커야 합니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고·적치 완료' })).toBeDisabled();
  });

  /* 여기서 막으면 물건이 갈 곳이 없다. 막히는 것은 하류의 피킹·출하다. */
  it('검사 대기 LOT 도 입고할 수 있다', async () => {
    const user = userEvent.setup();
    mount({ pending: true });
    await openUnit(user);
    await pickLocation(user);

    expect(await screen.findByText(/피킹·출하는 막힙니다/)).toBeTruthy();
    await readyToSubmit();
  });

  it('위치를 안 고르면 완료할 수 없다', async () => {
    const user = userEvent.setup();
    mount();
    await openUnit(user);

    await screen.findByLabelText(/FG-1001 · FG-2026-000311 실물 수량/);

    expect(screen.getByRole('button', { name: '입고·적치 완료' })).toBeDisabled();
  });

  /* 계약이 목적지를 필수로 요구한다. 위치를 안 받는 창고도 어딘가로 들어가야 한다. */
  it('위치를 관리하지 않는 창고는 대표 위치로 들어간다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ unmanaged: true, seen });
    await openUnit(user);

    expect(await screen.findByText(/대표 위치로 들어갑니다/)).toBeTruthy();
    await readyToSubmit();
    await user.click(screen.getByRole('button', { name: '입고·적치 완료' }));

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });

    const body = (await seen[0]?.json()) as { lines: { destinationLocationId: number }[] };

    expect(body.lines[0]?.destinationLocationId).toBe(3199);
  });

  /* 아무 위치나 골라 넣으면 재고가 남의 자리에 선다. */
  it('대표 위치가 없으면 완료할 수 없다', async () => {
    const user = userEvent.setup();
    mount({ unmanaged: true, noDefaultLocation: true });
    await openUnit(user);

    expect(await screen.findByText(/대표 위치가 없습니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고·적치 완료' })).toBeDisabled();
  });

  it('입고하고 적치까지 이어 보낸다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await openUnit(user);
    await pickLocation(user);
    await readyToSubmit();

    await user.click(screen.getByRole('button', { name: '입고·적치 완료' }));

    expect(await screen.findByText('입고하고 적치했습니다')).toBeTruthy();

    const paths = seen.map((each) => new URL(each.url).pathname);

    expect(paths).toContain('/logistics/goods-receipts');
    expect(paths).toContain('/logistics/putaway-tasks/7701:complete');
  });

  /*
   * 적치가 되돌아왔는데 입고까지 섰다고 말하면 사람은 물건이 자리에 든 줄 안다. 입고는 실제로
   * 섰으므로 되돌아온 것이 적치라는 사실이 문구에 남아야 한다.
   */
  it('적치가 되돌아오면 입고만 섰다고 말한다', async () => {
    const user = userEvent.setup();
    mount({ putawayRejected: true });
    await openUnit(user);
    await pickLocation(user);
    await readyToSubmit();

    await user.click(screen.getByRole('button', { name: '입고·적치 완료' }));

    expect(await screen.findByText('입고했습니다. 적치를 전송하지 못했습니다')).toBeTruthy();
  });

  /* 적치 지시 식별자는 입고 응답에만 있다. 없으면 적치를 이어 담을 수 없다. */
  it('적치 지시가 없으면 적치가 남았다고 말한다', async () => {
    const user = userEvent.setup();
    mount({ noPutawayTask: true });
    await openUnit(user);
    await pickLocation(user);
    await readyToSubmit();

    await user.click(screen.getByRole('button', { name: '입고·적치 완료' }));

    expect(await screen.findByText('입고했습니다. 적치가 남았습니다')).toBeTruthy();
  });

  /* 유일성이 아니라 재고다. 공장을 모르면 어느 공장의 재고인지 정할 수 없다. */
  it('단말 공장을 모르면 완료할 수 없다', async () => {
    const user = userEvent.setup();
    claims.plantId = null;
    mount();
    await openUnit(user);
    await pickLocation(user);

    expect(await screen.findByText(/기기의 공장을 읽지 못했습니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고·적치 완료' })).toBeDisabled();
  });

  /*
   * 연타는 button.click() 을 연속으로 불러야 갈린다. await user.click() 세 번은 클릭 사이에
   * 다시 그리기가 끼어 결함이 있어도 통과한다.
   */
  it('연타해도 한 건만 담는다', async () => {
    const user = userEvent.setup();
    const seen: Request[] = [];
    mount({ seen });
    await openUnit(user);
    await pickLocation(user);
    await readyToSubmit();

    const button = screen.getByRole('button', { name: '입고·적치 완료' });
    button.click();
    button.click();
    button.click();

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });

    const receipts = seen.filter(
      (each) => new URL(each.url).pathname === '/logistics/goods-receipts',
    );
    const keys = new Set(receipts.map((each) => each.headers.get('Idempotency-Key')));

    expect(keys.size).toBe(1);
  });

  /* 담기지 못하면 입고가 어디에도 없다. 말하지 않으면 사람은 입고된 줄 안다. */
  it('단말 보관소가 거절하면 기록되지 않았다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openUnit(user);
    await pickLocation(user);
    await readyToSubmit();

    held.failWrite = 'outbox';
    await user.click(screen.getByRole('button', { name: '입고·적치 완료' }));

    expect(await screen.findByText('입고를 저장하지 못했습니다')).toBeTruthy();
  });

  it('담긴 것이 없는 인식표는 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    mount({ emptyUnit: true });
    await openUnit(user);

    expect(await screen.findByText(/담긴 물건이 없습니다/)).toBeTruthy();
  });

  /* 다른 칸에 두면 다음 피킹이 물건을 찾지 못한다. 서버도 막는다. */
  it('권장과 다른 위치를 스캔하면 막고 권장 위치를 말한다', async () => {
    const user = userEvent.setup();
    mount({ recommendsOther: true });
    await openUnit(user);
    await pickLocation(user);

    expect(await screen.findByText('권장 위치 FG-DEFAULT 이(가) 아닙니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고·적치 완료' })).toBeDisabled();
    expect(tone.played).toBeGreaterThan(0);
  });

  /* 권장 자리를 먼저 보인다. 다 스캔한 뒤에 막히면 물건을 들고 되돌아온다. */
  it('권장 위치를 스캔 전에 보이고 맞으면 맞다고 말한다', async () => {
    const user = userEvent.setup();
    mount();
    await openUnit(user);

    expect(await screen.findByText(`권장 위치 ${LOC_CODE}`)).toBeTruthy();

    await pickLocation(user);

    expect(await screen.findByText('권장 위치와 같습니다')).toBeTruthy();
    await readyToSubmit();
  });

  /* 규칙이 없다고 막으면 미등록 품목이 적치 자체를 못 해 현장이 선다. */
  it('정해진 위치가 없으면 그 사실을 말하고 확인을 받아 통과시킨다', async () => {
    const user = userEvent.setup();
    mount({ noRule: true });
    await openUnit(user);
    await pickLocation(user);

    expect(await screen.findByText('이 품목에 정해진 위치가 없습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고·적치 완료' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '여기 적치합니다' }));

    await readyToSubmit();
  });

  /* 이 화면이 재고를 세우는 지점이다. 두 번 서면 같은 제품이 두 벌이 된다. */
  it('다른 기기가 먼저 입고한 LOT 은 막는다', async () => {
    const user = userEvent.setup();
    mount({ alreadyStocked: true });
    await openUnit(user);
    await pickLocation(user);

    expect(await screen.findByText('이미 입고 처리된 제품 LOT 입니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '입고·적치 완료' })).toBeDisabled();
  });

  /* 확인하지 못한 것을 서 있지 않은 것으로 읽지 않는다. 다만 막지도 않는다. */
  it('이미 입고됐는지 확인하지 못하면 그 사실을 밝히되 막지는 않는다', async () => {
    const user = userEvent.setup();
    mount({ stockUnreachable: true });
    await openUnit(user);
    await pickLocation(user);

    expect(await screen.findByText('이미 입고됐는지 확인할 수 없습니다')).toBeTruthy();
    await readyToSubmit();
  });

  /* 장갑을 끼고 한 손으로 조작한다. 기기 키보드는 위치 스캔 칸과 완료 단추를 덮는다. */
  it('실물 수량을 숫자판으로 넣는다', async () => {
    const user = userEvent.setup();
    mount();
    await openUnit(user);

    await user.click(await screen.findByLabelText(/FG-1001 · FG-2026-000311 실물 수량/));
    await user.click(await screen.findByRole('button', { name: '8' }));

    expect(await screen.findByDisplayValue('5008')).toBeTruthy();
  });

  /* 기기를 허리에 매단 채 읽는다. 화면에만 적으면 통과한 줄 알고 다음 동작으로 넘어간다. */
  it('인식표를 찾지 못한 것을 소리로도 알린다', async () => {
    const user = userEvent.setup();
    mount();
    await pickWarehouse(user);

    scanUnit('HU-2026-999999');

    await screen.findByText('HU-2026-999999 인식표를 찾지 못했습니다');
    expect(tone.played).toBeGreaterThan(0);
  });

  /* 첫 줄의 규칙으로 재면 다른 품목의 옳은 자리를 막아 현장이 선다. */
  it('한 인식표에 품목이 여럿이면 규칙으로 재지 않고 확인을 받는다', async () => {
    const user = userEvent.setup();
    mount({ twoItems: true, recommendsOther: true });
    await openUnit(user);
    await pickLocation(user);

    expect(await screen.findByText('이 품목에 정해진 위치가 없습니다')).toBeTruthy();
    expect(screen.queryByText('권장 위치 FG-DEFAULT 이(가) 아닙니다')).toBeNull();

    await user.click(screen.getByRole('button', { name: '여기 적치합니다' }));

    await readyToSubmit();
  });
});
