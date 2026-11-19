import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PopIdentityProvider } from '../../patterns/pop-identity';
import { PuToastHost } from '../../patterns/pop-uniform';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';

import { HANDLING_UNIT_CANCEL_NOT_READY_MESSAGE } from './mutations';
import { PackingResultScreen } from './screen';

const t = messages.packingResult;

const pathOf = (request: Request): string => new URL(request.url).pathname;
const queryOf = (request: Request): URLSearchParams => new URL(request.url).searchParams;

/** 배분 하나. 값은 전부 지어낸 것이다. */
const allocation = (overrides: Record<string, unknown> = {}) => ({
  shipmentLotAllocationId: 9001,
  shipmentId: 501,
  shipmentLineId: 701,
  itemId: 5001,
  itemCode: 'SYN-FG-1001',
  lotId: 8001,
  lotNo: 'SYN-LOT-000123450',
  warehouseId: 1001,
  allocatedQty: 180,
  uomId: 920001,
  oqcPassed: true,
  packedQty: 0,
  ...overrides,
});

interface Options {
  /** 둘째 스캔의 서버 판정. 화면이 스스로 만들지 않는 값이다. */
  match?: { matched: boolean; reasonCode?: string };
  /** 첫 스캔이 아무것도 못 찾은 상태 */
  /** 출하번호 정확 일치 조회가 아무것도 못 찾은 상태 */
  /** 셸이 넘기는 사번. 생략하면 '3391' */
  workerNo?: string | null;
  /** 단말 게이팅 플래그 */
  canInputResult?: boolean;
  /** 이 단말에 «그 공정 행이 아예 없는» 상태 — 구성되지 않은 공정은 열려 있지 않다 */
  missingProcessRow?: boolean;
  /** 확정(`:pack`)이 409 로 되돌아오는 상태 — 배너가 무엇을 말하는지 본다 */
  packConflict?: boolean;
  /** 쓰기 요청을 담아 둔다 — 확정이 세 단계를 도는지 본다 */
  writes?: Request[];
  /** 포장 만들기가 실패하는 갈래 — 담긴 줄은 있는데 포장이 없는 상태를 만든다(#1093). */
  createUnitFails?: boolean;
  /** 포장 만들기가 «앞의 N 번만» 실패한다 — 담는 동안 실패하고 확정 때 성공하는 갈래. */
  createUnitFailures?: number;
  /** 포장 만들기 실패의 상태 코드. 생략하면 500. */
  createUnitFailStatus?: number;
  /** 이 LOT 번호의 스캔만 서버가 「배분에 없다」고 판정한다. */
  rejectLot?: string;
  /** 아직 출하 단위에 안 들어간 상자 수. `'error'` 면 그 조회가 실패한다. */
  unassignedBoxes?: number | 'error';
  /** 포장 유형 선택지. **서버가 준 순서 그대로** 내려간다. */
  typeCodes?: { code: string; codeName: string }[];
  reads?: Request[];
  /** 이 출하는 미포장 배분이 없다 — 확정할 수 없는 출하가 된다. */
  noUnpackedShipmentId?: number;
  /** 목록 항목의 `unpackedLotCount`(출하 식별자 → 수). 생략하면 그 칸이 없다(옛 서버). */
  listedUnpackedLotCounts?: Record<number, number>;
}

const handlingUnitBody = {
  handlingUnit: {
    handlingUnitId: 4001,
    handlingUnitNo: 'SYN-CTN-0091',
    handlingUnitTypeCode: 'CARTON',
    statusCode: 'SYN-OPEN',
  },
  contents: [],
};

const renderScreen = (options: Options = {}) => {
  let createUnitCalls = 0;
  const routes: StubRoute[] = [
    {
      /*
       * ⚠ **`shipmentNo` 정확 일치 파라미터는 서버 구현 기준(v0.1.2)에 없다**(통보 219 ·
       * `queries.ts` 의 `useShipmentScan` 머리말). 그룹 D 가 그 스캔을 `q` + `shipDateFrom` +
       * 응답 재필터로 고쳤으므로, 이 목도 같은 모양으로 읽는다 — `q` 가 있는 요청만 「출하번호
       * 스캔」으로 본다(`useTodayShipments` 는 `q` 없이 부른다).
       */
      match: (request) => pathOf(request) === '/logistics/shipments',
      respond: (request) => {
        options.reads?.push(request.clone());
        const requestedNo = queryOf(request).get('q');

        /*
         * ⭐ **미구성 상자 수는 «목록»에서만 온다**(계약 명시 — 상세는 세지 않는다). 그 축을
         *    함께 준 요청이 그것을 묻는 자리다.
         */
        if (queryOf(request).has('hasUnassignedPackedBox')) {
          if (options.unassignedBoxes === 'error') {
            return jsonResponse({ message: '실패' }, { status: 500 });
          }

          const count = options.unassignedBoxes ?? 0;

          return jsonResponse({
            items:
              count === 0
                ? []
                : [
                    {
                      shipmentId: 501,
                      shipmentNo: requestedNo ?? 'SYN-SH-0501',
                      shipmentRequestId: 1,
                      warehouseId: 1001,
                      statusCode: 'CONFIRMED',
                      expedited: false,
                      unassignedPackedBoxCount: count,
                    },
                  ],
            page: { page: 1, size: 50, total: count === 0 ? 0 : 1 },
          });
        }

        /*
         * ⭐ **출하대상 목록이다**(#1351). 종전에는 번호로 좁힌 스캔 조회가 따로 있어 `q` 갈래를
         *    두었는데, 그 조회를 걷고 **고를 수 있는 것을 이 목록 하나로** 정했다. 두 건을 내려
         *    전환(다른 출하 고르기) 시험이 설 자리를 만든다.
         */
        const counted = (shipmentId: number) => {
          const count = options.listedUnpackedLotCounts?.[shipmentId];
          return count === undefined ? {} : { unpackedLotCount: count };
        };

        return jsonResponse({
          items: [
            {
              shipmentId: 501,
              shipmentNo: 'SYN-SH-0501',
              shipmentRequestId: 1,
              warehouseId: 1001,
              statusCode: 'CONFIRMED',
              expedited: false,
              ...counted(501),
            },
            {
              shipmentId: 502,
              shipmentNo: 'SYN-SH-0502',
              shipmentRequestId: 2,
              warehouseId: 1001,
              statusCode: 'CONFIRMED',
              expedited: false,
              ...counted(502),
            },
          ],
          page: { page: 1, size: 50, total: 2 },
        });
      },
    },
    {
      match: (request) => pathOf(request).endsWith('/processes'),
      respond: () =>
        jsonResponse({
          items:
            options.missingProcessRow === true
              ? [{ processId: 999, canInputResult: true }]
              : [{ processId: 301, canInputResult: options.canInputResult ?? true }],
        }),
    },
    {
      match: (request) => pathOf(request) === '/mdm/code-values',
      respond: () => {
        /*
         * ⚠ **서버가 준 순서 그대로 돌려준다.** 화면이 다시 정렬하지 않는 것이 규율이라, 목이
         *   정렬해 주면 그 규율을 시험이 못 본다.
         */
        const items = options.typeCodes ?? [{ code: 'CARTON', codeName: '카톤' }];

        return jsonResponse({
          items: items.map((item, index) => ({ codeValueId: index + 1, codeGroupId: 9, ...item })),
          page: { page: 1, size: 50, total: items.length },
        });
      },
    },
    {
      match: (request) =>
        request.method === 'GET' && pathOf(request) === '/inventory/handling-units',
      respond: () => jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } }),
    },
    {
      match: (request) =>
        request.method === 'POST' && pathOf(request) === '/inventory/handling-units',
      respond: (request) => {
        options.writes?.push(request.clone());

        createUnitCalls += 1;
        const fails =
          options.createUnitFails === true || createUnitCalls <= (options.createUnitFailures ?? 0);

        return fails
          ? jsonResponse(
              { message: '만들지 못했습니다' },
              { status: options.createUnitFailStatus ?? 500 },
            )
          : jsonResponse(handlingUnitBody, { status: 201, headers: { ETag: '"7"' } });
      },
    },
    {
      match: (request) => pathOf(request) === '/inventory/handling-units/4001:pack',
      respond: (request) => {
        options.writes?.push(request.clone());

        return options.packConflict === true
          ? jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })
          : jsonResponse(handlingUnitBody);
      },
    },
    {
      /*
       * ⚠ **닿을 일이 없다.** `useHandlingUnitCancel` 이 이제 이 요청을 만들지 않는다(경로
       * 자체가 서버에 없다 — `mutations.ts` 머리말). 스텁은 그대로 두어, 서버가 공지 3을
       * 구현해 되돌릴 때 이 목도 다시 살아나게 한다.
       */
      match: (request) =>
        request.method === 'DELETE' && pathOf(request) === '/inventory/handling-units/4001',
      respond: (request) => {
        options.writes?.push(request.clone());

        return new Response(null, { status: 204 });
      },
    },
    {
      match: (request) =>
        request.method === 'PUT' &&
        pathOf(request).startsWith('/logistics/shipment-lot-allocations/'),
      respond: (request) => {
        options.writes?.push(request.clone());

        return jsonResponse(allocation({ handlingUnitId: 4001 }));
      },
    },
    {
      match: (request) =>
        request.method === 'GET' && pathOf(request) === '/logistics/shipment-lot-allocations',
      respond: (request) => {
        options.reads?.push(request.clone());
        const query = queryOf(request);
        const page = { page: 1, size: 50, total: 1 };

        /* 생산LOT 스캔 — 판정은 서버가 내린다. */
        if (query.has('lotQ')) {
          const match =
            options.rejectLot !== undefined && query.get('lotQ') === options.rejectLot
              ? { matched: false, reasonCode: 'LOT_NOT_ALLOCATED' }
              : (options.match ?? { matched: true });

          return jsonResponse({ items: match.matched ? [allocation()] : [], page, match });
        }

        if (
          query.get('unpackedOnly') === 'true' &&
          query.get('shipmentId') === String(options.noUnpackedShipmentId)
        ) {
          return jsonResponse({ items: [], page: { ...page, total: 0 } });
        }

        return jsonResponse({ items: [allocation()], page });
      },
    },
  ];

  return renderWithProviders(
    <PopIdentityProvider
      value={{
        terminalId: 101,
        processes: [{ processId: 301 }],
        equipment: null,
        workerNo: options.workerNo === undefined ? '3391' : options.workerNo,
      }}
    >
      <PackingResultScreen />
      <PuToastHost />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes), route: '/pop/packing' },
  );
};

type User = ReturnType<typeof userEvent.setup>;

const LOT = 'SYN-LOT-000123450';
const keypadName = messages.popUniform.keypad.region;

const shipmentCard = (shipmentNo: string): Promise<HTMLElement> =>
  screen.findByRole('button', { name: new RegExp(shipmentNo, 'u') });

/** ① 출하 카드를 누른다. */
const chooseShipment = async (user: User, shipmentNo = 'SYN-SH-0501'): Promise<void> => {
  await user.click(await shipmentCard(shipmentNo));
};

const clickNext = async (user: User): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: t.actions.next })).toBeEnabled();
  });
  await user.click(screen.getByRole('button', { name: t.actions.next }));
};

/** ① 출하를 고르고 ② 로 넘어간다. */
const enterScanStep = async (user: User, shipmentNo = 'SYN-SH-0501'): Promise<void> => {
  await chooseShipment(user, shipmentNo);
  await clickNext(user);
  await waitFor(() => {
    expect(screen.getByLabelText(t.scan.productionLot)).toBeEnabled();
  });
};

const scan = async (user: User, code: string): Promise<void> => {
  await user.type(screen.getByLabelText(t.scan.productionLot), `${code}{Enter}`);
};

/** 생산 LOT 을 읽어 매칭(키패드가 그 LOT 을 잡음)까지 간다. */
const matchLot = async (user: User): Promise<void> => {
  await scan(user, LOT);
  await waitFor(() => {
    expect(screen.getByRole('group', { name: keypadName })).toHaveTextContent(LOT);
  });
};

/** ② 까지 가서 LOT 을 매칭한 상태를 만든다 — 담기·확정 시험의 공통 전제다. */
const scanUntilMatched = async (user: User): Promise<void> => {
  await enterScanStep(user);
  await matchLot(user);
};

/** 키패드로 수량만 친다(담지 않는다). */
const typeDigits = async (user: User, digits: string): Promise<void> => {
  const pad = screen.getByRole('group', { name: keypadName });

  for (const digit of digits) {
    await user.click(within(pad).getByRole('button', { name: digit }));
  }
};

/** 키패드로 지금 잡힌 줄의 수량을 친다 — 스캔한 LOT 은 이미 줄로 담겨 있다(#295 시안). */
const typeQty = typeDigits;

const rowQty = (lotNo = LOT): HTMLElement => screen.getByLabelText(t.rows.qtyLabel(lotNo));

/** ③ 으로 넘어가 [포장 확정] → 확인 창 [확정]. */
const confirmFromReview = async (user: User): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: t.actions.confirm })).toBeEnabled();
  });
  await user.click(screen.getByRole('button', { name: t.actions.confirm }));
  await user.click(
    within(await screen.findByRole('dialog', { name: t.confirmDialog.title })).getByRole('button', {
      name: t.confirmDialog.confirm,
    }),
  );
};

const typeTile = (label: string): HTMLElement => screen.getByRole('radio', { name: label });

describe('PackingResultScreen', () => {
  /* ⭐ 사번이 없으면 출하대상부터 못 고르고, 맨 위 경고가 사유를 말한다(사용자 지시 2026-09-17). */
  it('사번이 없으면 출하 카드와 [다음]이 잠기고 사번 경고가 선다', async () => {
    renderScreen({ workerNo: null });

    expect(await screen.findByText(messages.popChrome.workerMissing)).toBeInTheDocument();
    expect(await shipmentCard('SYN-SH-0501')).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.next })).toBeDisabled();
  });

  it('출하대상을 고르면 그 출하의 미포장 배분을 이어서 읽는다', async () => {
    const user = userEvent.setup();
    const reads: Request[] = [];
    renderScreen({ reads });

    await enterScanStep(user);

    const allocationRequest = reads.find(
      (request) =>
        pathOf(request) === '/logistics/shipment-lot-allocations' &&
        queryOf(request).get('unpackedOnly') === 'true',
    );

    expect(queryOf(allocationRequest as Request).get('shipmentId')).toBe('501');

    /* ⛔ 고른 출하를 «다시» 조회하지 않는다(#1351). 목록 조회(`pickedOnly` + 기간)만 남는다. */
    const byNumber = reads.filter(
      (request) =>
        pathOf(request) === '/logistics/shipments' &&
        queryOf(request).has('q') &&
        !queryOf(request).has('hasUnassignedPackedBox'),
    );

    expect(byNumber).toHaveLength(0);
  });

  it('출하 카드를 누르면 그 출하가 골라지고 [다음]이 켜진다', async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByRole('button', { name: t.actions.next })).toBeDisabled();
    await chooseShipment(user, 'SYN-SH-0502');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /SYN-SH-0502/u })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(screen.getByRole('button', { name: t.actions.next })).toBeEnabled();
  });

  /* ⭐ **찍어서도 고른다**(#1351) — 받아 둔 목록 안에서 번호가 같은 것이 골라진다. */
  it('출하번호를 찍으면 받아 둔 목록에서 그 출하가 골라진다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await shipmentCard('SYN-SH-0502');
    await user.type(screen.getByLabelText(t.shipments.scan), 'syn-sh-0502{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /SYN-SH-0502/u })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    await user.type(screen.getByLabelText(t.shipments.scan), 'SYN-SH-9999{Enter}');
    expect(await screen.findByText(t.shipments.notFound('SYN-SH-9999'))).toBeInTheDocument();
  });

  /* ⭐ 확정할 수 없는 출하는 카드에 「확정 불가」와 사유를 남기고 잠근다 — 위 빨간 안내로 띄우지 않는다. */
  it('미포장 배분이 없는 출하는 고르지 않고 「확정 불가」로 잠그며 사유를 카드에 적는다', async () => {
    const user = userEvent.setup();
    renderScreen({ noUnpackedShipmentId: 502 });

    await chooseShipment(user, 'SYN-SH-0502');

    const card = await screen.findByRole('button', {
      name: new RegExp(t.shipments.blockedChip, 'u'),
    });
    expect(card).toHaveTextContent('SYN-SH-0502');
    expect(card).toHaveTextContent(t.shipments.noLots);
    expect(card).toBeDisabled();
    expect(card).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: t.actions.next })).toBeDisabled();
    expect(screen.queryByText(t.locks.warehouseMissing)).not.toBeInTheDocument();

    /* 다른 출하는 그대로 고를 수 있다. */
    await chooseShipment(user, 'SYN-SH-0501');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /SYN-SH-0501/u })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  /* ⭐ omf-all-around#329 — 목록의 미포장 배분 수가 0 이면 누르기 «전», 처음 그릴 때부터 잠근다. */
  it('목록의 unpackedLotCount 가 0 인 출하는 처음부터 「확정 불가」·사유로 잠겨 있다', async () => {
    const user = userEvent.setup();
    const reads: Request[] = [];
    renderScreen({ listedUnpackedLotCounts: { 501: 2, 502: 0 }, reads });

    const card = await screen.findByRole('button', {
      name: new RegExp(t.shipments.blockedChip, 'u'),
    });
    expect(card).toHaveTextContent('SYN-SH-0502');
    expect(card).toHaveTextContent(t.shipments.noLots);
    expect(card).toBeDisabled();
    expect(await shipmentCard('SYN-SH-0501')).toBeEnabled();

    /* 찍어도 조회 없이 같은 사유를 띄운다. */
    await user.type(screen.getByLabelText(t.shipments.scan), 'SYN-SH-0502{Enter}');
    expect(screen.getByLabelText(t.shipments.scan)).toHaveAccessibleDescription(t.shipments.noLots);
    expect(reads.some((request) => pathOf(request) === '/logistics/shipment-lot-allocations')).toBe(
      false,
    );

    await chooseShipment(user, 'SYN-SH-0501');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /SYN-SH-0501/u })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  it('확정할 수 없는 출하번호를 찍으면 고르지 않고 사유를 스캔 오류로 띄운다', async () => {
    const user = userEvent.setup();
    renderScreen({ noUnpackedShipmentId: 502 });

    await shipmentCard('SYN-SH-0502');
    await user.type(screen.getByLabelText(t.shipments.scan), 'SYN-SH-0502{Enter}');

    await waitFor(() => {
      expect(screen.getByLabelText(t.shipments.scan)).toHaveAccessibleDescription(
        t.shipments.noLots,
      );
    });
    expect(screen.getByRole('button', { name: t.actions.next })).toBeDisabled();

    /* 이미 잠긴 출하를 다시 찍어도 고르지 않고 같은 사유를 띄운다. */
    await user.type(screen.getByLabelText(t.shipments.scan), 'SYN-SH-0502{Enter}');
    expect(screen.getByLabelText(t.shipments.scan)).toHaveAccessibleDescription(t.shipments.noLots);
    expect(screen.getByRole('button', { name: t.actions.next })).toBeDisabled();
  });

  /*
   * ⭐ **다음 걸음이 남았는지 여기서 말한다**(SHIP-UNIT-01 §7). ⛔ 화면이 배분으로 세지 않는다 —
   *    서버가 상자 기준으로 센 값을 그대로 쓴다.
   */
  it('아직 출하 단위에 안 들어간 상자 수를 정보 띠에 적는다', async () => {
    const user = userEvent.setup();
    renderScreen({ unassignedBoxes: 3 });

    await enterScanStep(user);

    const band = screen.getByRole('group', { name: t.band.label });
    expect(await within(band).findByText(t.band.boxes(3))).toBeInTheDocument();
  });

  /* ⛔ 「없다」와 「모른다」를 같은 모양으로 그리지 않는다(공유계약 G-9). */
  it('미구성 상자를 세지 못하면 0 이라 하지 않고 모른다고 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ unassignedBoxes: 'error' });

    await enterScanStep(user);

    expect(await screen.findByText(t.band.unknown)).toBeInTheDocument();
    expect(screen.queryByText(t.band.boxes(0))).not.toBeInTheDocument();
  });

  /*
   * ⭐ **열리면 첫 유형이 이미 골라져 있다**(사용자 지시 2026-09-18). ⛔ 「첫 번째」는 서버가 준
   *    순서 그대로다 — 목이 사전순과 어긋나는 순서를 준다.
   */
  it('유형 목록이 오면 첫 값이 이미 골라져 있다', async () => {
    const user = userEvent.setup();
    renderScreen({
      typeCodes: [
        { code: 'PALLET', codeName: '팔레트' },
        { code: 'CARTON', codeName: '카톤' },
      ],
    });

    await enterScanStep(user);

    await waitFor(() => {
      expect(typeTile('팔레트')).toHaveAttribute('aria-checked', 'true');
    });
  });

  /* ⛔ **고른 값을 덮지 않는다.** 단계를 오가도 담당이 고른 유형이 그대로다. */
  it('사용자가 고른 유형을 뒤이은 조작이 덮지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      typeCodes: [
        { code: 'CARTON', codeName: '카톤' },
        { code: 'PALLET', codeName: '팔레트' },
      ],
    });

    await enterScanStep(user);
    await waitFor(() => {
      expect(typeTile('카톤')).toHaveAttribute('aria-checked', 'true');
    });
    await user.click(typeTile('팔레트'));

    await user.click(screen.getByRole('button', { name: t.actions.prev }));
    await clickNext(user);

    expect(typeTile('팔레트')).toHaveAttribute('aria-checked', 'true');
    expect(typeTile('카톤')).toHaveAttribute('aria-checked', 'false');
  });

  /* ⛔ `noType` 잠금을 지우지 않았다 — 코드 그룹이 비면 여전히 빈 값이다. */
  it('유형 목록이 비면 채우지 못하고 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ typeCodes: [] });

    await enterScanStep(user);

    expect(await screen.findByText(t.notes.typeUnavailable)).toBeInTheDocument();
  });

  it('들어오면 ① 출하 대상 단계에서 시작하고 [다음]은 고르기 전까지 꺼져 있다', async () => {
    renderScreen();

    const flow = screen.getByRole('list', { name: t.steps.label });
    expect(within(flow).getByText(t.steps.shipment).closest('[aria-current]')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(await shipmentCard('SYN-SH-0501')).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.next })).toBeDisabled();
    expect(screen.queryByLabelText(t.scan.productionLot)).not.toBeInTheDocument();
  });

  /* ⛔ **출하번호를 따로 받는 칸은 없다**(사용자 지시 2026-09-18 · #1351). */
  it('출하번호를 따로 받는 칸을 두지 않는다', () => {
    renderScreen();

    expect(screen.queryByLabelText('출하번호')).not.toBeInTheDocument();
  });

  /* ⛔ OQC 상태 줄과 ④ 의 「포장 N 개」·「미포장 N」은 두지 않는다(#1351). 「미구성 상자」만 남는다. */
  it('OQC 상태 줄과 포장·미포장 수치를 그리지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ unassignedBoxes: 2 });

    await enterScanStep(user);
    await screen.findAllByText(t.band.boxes(2));

    expect(screen.queryByText(/OQC/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/미포장/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/이 출하 포장/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/예상/u)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('라벨 화면에 들어가도 [이전]으로 돌아오고, 포장 조작은 함께 서지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseShipment(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.labels })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: t.actions.labels }));

    const back = await screen.findByRole('button', { name: t.actions.prev });
    expect(back).toBeEnabled();
    expect(screen.queryByRole('button', { name: t.actions.next })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.confirm })).not.toBeInTheDocument();

    await user.click(back);
    expect(await screen.findByRole('button', { name: t.actions.next })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SYN-SH-0501/u })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  /* ⭐ 다른 출하로 갈아타면 이전 출하 문맥을 버린다 — 담긴 줄이 엉뚱한 출하로 확정되지 않게. */
  it('다른 출하대상을 고르면 이전 출하 문맥을 폐기한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseShipment(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /SYN-SH-0501/u })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    await chooseShipment(user, 'SYN-SH-0502');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /SYN-SH-0502/u })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(screen.getByRole('button', { name: /SYN-SH-0501/u })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('매칭되면 수량 없는 줄이 생기고 키패드가 그 LOT 을 잡으며, 수량을 치기 전에는 [다음]이 잠겨 있다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);

    expect(screen.getByText(messages.popUniform.scan.done)).toBeInTheDocument();
    expect(rowQty()).toHaveTextContent(t.rows.qtyPlaceholder);
    expect(rowQty()).toHaveClass('is-target');
    expect(screen.getByRole('button', { name: t.actions.next })).toBeDisabled();

    await typeQty(user, '60');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.next })).toBeEnabled();
    });
  });

  /* ⭐ 스캐너가 Enter 를 붙이지 않아도 생산LOT 이 읽힌다(사용자 지시 2026-09-17). */
  it('생산LOT 은 Enter 없이 스캐너 속도로 들어오면 읽는다', async () => {
    const user = userEvent.setup();
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    renderScreen();

    await enterScanStep(user);
    await user.type(screen.getByLabelText(t.scan.productionLot), LOT);

    await waitFor(() => {
      expect(screen.getByRole('group', { name: keypadName })).toHaveTextContent(LOT);
    });
    now.mockRestore();
  });

  it('⛔ 품목이 다르면 «계약이 준 품목 코드»로 막는다 — 화면이 대응표를 갖지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ match: { matched: false, reasonCode: 'LABEL_ITEM_MISMATCH' } });

    await enterScanStep(user);
    await scan(user, 'SYN-LOT-다른품목');

    expect(await screen.findByText(t.match.itemMismatch('SYN-FG-1001'))).toBeTruthy();
    expect(screen.getByRole('group', { name: keypadName })).not.toHaveTextContent(LOT);
  });

  it('⛔ 배분에 없는 LOT 은 그 사유로 막는다', async () => {
    const user = userEvent.setup();
    renderScreen({ match: { matched: false, reasonCode: 'LOT_NOT_ALLOCATED' } });

    await enterScanStep(user);
    await scan(user, 'SYN-LOT-남의것');

    expect(await screen.findByText(t.match.notAllocated)).toBeTruthy();
  });

  it('단말 플래그가 닫혀 있으면 확정을 막고 «권한이 없다»고 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ canInputResult: false });

    expect(await screen.findByText(t.locks.gateDenied)).toBeTruthy();

    await scanUntilMatched(user);
    await typeQty(user, '60');
    await clickNext(user);

    expect(screen.getByRole('button', { name: t.actions.confirm })).toBeDisabled();
  });

  it('⛔ 그 공정 «행이 없으면» 막는다 — 구성되지 않은 공정을 열어 두지 않는다', async () => {
    renderScreen({ missingProcessRow: true });

    expect(await screen.findByText(t.locks.gateDenied)).toBeTruthy();
  });
});

describe('PackingResultScreen — 담기와 확정', () => {
  /*
   * ⚠ `DELETE /inventory/handling-units/{id}` 가 서버에 없어(`mutations.ts` 머리말) 취소는 늘
   * 「준비 중」으로 거부되고, 열린 포장은 거둬지지 않는다 — 다른 출하로의 전환도 계속 막힌다.
   */
  it('열린 포장이 있으면 다른 출하 전환을 막고, 취소는 아직 지원하지 않아 계속 막힌 채로 남는다', async () => {
    const user = userEvent.setup();
    const reads: Request[] = [];
    renderScreen({ reads });

    await scanUntilMatched(user);
    await typeQty(user, '60');
    const band = screen.getByRole('group', { name: t.band.label });
    expect(await within(band).findByText('SYN-CTN-0091')).toBeInTheDocument();

    /* ⚠ 전환이 막혔음을 «요청»으로도 잰다 — 고른 출하의 배분을 받아 오면 담던 줄이 섞인다. */
    const sentToOtherShipment = () =>
      reads.some(
        (request) =>
          pathOf(request) === '/logistics/shipment-lot-allocations' &&
          queryOf(request).get('shipmentId') === '502',
      );

    await user.click(screen.getByRole('button', { name: t.actions.prev }));
    expect(screen.getByText(t.shipments.inProgress)).toBeInTheDocument();
    await chooseShipment(user, 'SYN-SH-0502');
    expect(await screen.findByText(t.match.openUnitBlocksShipmentChange)).toBeInTheDocument();
    expect(sentToOtherShipment()).toBe(false);

    await user.click(screen.getByRole('button', { name: t.actions.cancelUnit }));

    /* ⛔ 네트워크 요청이 나가지 않는다 — 경로 자체가 없다. 「준비 중」이 드러나고 포장은 남는다. */
    expect(await screen.findByText(HANDLING_UNIT_CANCEL_NOT_READY_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(t.shipments.inProgress)).toBeInTheDocument();

    await chooseShipment(user, 'SYN-SH-0502');
    expect(await screen.findByText(t.match.openUnitBlocksShipmentChange)).toBeInTheDocument();
    expect(sentToOtherShipment()).toBe(false);
  });

  /*
   * ⭐ **포장이 없어도 담긴 것이 있으면 확정할 수 있다**(사용자 지시 2026-09-18 · omf-all-around#5).
   *    ⛔ 이 시험을 예전 잠금으로 되돌리지 않는다.
   */
  const UNIT_MISSING_TEXT = '포장을 만들지 못했습니다';

  it('담는 동안 포장 만들기가 실패해도 확정은 열려 있고, 「포장을 만들지 못했습니다」를 띄우지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ createUnitFails: true, writes });

    await scanUntilMatched(user);
    await typeQty(user, '60');

    await waitFor(() => {
      expect(writes.map(pathOf)).toContain('/inventory/handling-units');
    });
    await clickNext(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.confirm })).toBeEnabled();
    });
    expect(screen.queryByText(new RegExp(UNIT_MISSING_TEXT, 'u'))).toBeNull();
  });

  it('포장이 없으면 다시 만들어 담는다 — 생성 재시도는 같은 멱등 키다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ createUnitFailures: 1, writes });

    await scanUntilMatched(user);
    await typeQty(user, '60');
    await clickNext(user);
    await confirmFromReview(user);

    expect(await screen.findByText(t.confirmed('SYN-CTN-0091'))).toBeTruthy();
    expect(writes.map((request) => `${request.method} ${pathOf(request)}`)).toEqual([
      'POST /inventory/handling-units',
      'POST /inventory/handling-units',
      'POST /inventory/handling-units/4001:pack',
      'PUT /logistics/shipment-lot-allocations/9001',
    ]);
    const createKeys = writes
      .filter((request) => pathOf(request) === '/inventory/handling-units')
      .map((request) => request.headers.get('Idempotency-Key'));
    expect(createKeys[0]).toBeTruthy();
    expect(createKeys[1]).toBe(createKeys[0]);
  });

  it('확정 때 포장 만들기가 403 이면 확정 실패 자리에 안내하고, 다시 누를 수 있다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ createUnitFails: true, createUnitFailStatus: 403, writes });

    await scanUntilMatched(user);
    await typeQty(user, '60');
    await clickNext(user);

    await confirmFromReview(user);
    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    /* 서버 원문은 보이지 않는다 — 공통 문구만 낸다. */
    expect(screen.queryByText(/만들지 못했습니다/u)).toBeNull();
    expect(writes.map(pathOf)).not.toContain('/inventory/handling-units/4001:pack');

    const before = writes.length;
    await confirmFromReview(user);
    await waitFor(() => {
      expect(writes.length).toBeGreaterThan(before);
    });
    expect(pathOf(writes[writes.length - 1] as Request)).toBe('/inventory/handling-units');
  });

  it('배분에 없는 LOT 을 읽어도 이미 담은 것은 확정할 수 있고, 안내는 LOT 칸 아래 한 줄뿐이다', async () => {
    const user = userEvent.setup();
    renderScreen({ createUnitFails: true, rejectLot: 'SYN-LOT-남의것' });

    await scanUntilMatched(user);
    await typeQty(user, '60');
    await scan(user, 'SYN-LOT-남의것');

    expect(await screen.findByText(t.match.notAllocated)).toBeTruthy();
    expect(screen.queryByText(new RegExp(UNIT_MISSING_TEXT, 'u'))).toBeNull();
    await clickNext(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.confirm })).toBeEnabled();
    });
  });

  it('키패드로 친 수량이 그 줄의 수량 칸에 보인다 — 누른 값이 어디로 갔는지 보여야 한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);
    await typeDigits(user, '12');

    expect(rowQty()).toHaveTextContent('12');
  });

  /* ⭐ 같은 LOT 은 한 줄 — 다시 찍으면 더하지 않고 그 줄을 잡는다(#295 시안). */
  it('같은 LOT 을 다시 찍으면 줄을 늘리지 않고 「이미 담은 LOT」으로 그 줄을 잡는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);
    await typeQty(user, '120');
    await scan(user, LOT);

    expect(await screen.findByText(t.match.alreadyAdded(LOT))).toBeInTheDocument();
    expect(screen.getAllByLabelText(t.rows.qtyLabel(LOT))).toHaveLength(1);
    expect(rowQty()).toHaveTextContent('120');
    expect(rowQty()).toHaveClass('is-target');
  });

  it('⛔ 잔여를 넘기면 그 줄 아래 빨간 한 줄로 말하고 [다음]을 잠근다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);
    await typeDigits(user, '181');

    expect(screen.getByText(t.qty.overRemaining('180'))).toBeInTheDocument();
    expect(rowQty()).toHaveClass('is-need');
    expect(screen.getByRole('button', { name: t.actions.next })).toBeDisabled();
  });

  it('[X]로 줄을 빼면 포장에서 제외된다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);
    await typeQty(user, '60');
    await user.click(screen.getByRole('button', { name: t.rows.remove }));

    expect(screen.queryByLabelText(t.rows.qtyLabel(LOT))).toBeNull();
    expect(screen.getByText(t.rows.empty)).toBeInTheDocument();
  });

  it('⭐ 담는 동안 «포장 번호»가 선다 — 번호는 서버가 매기므로 먼저 만들어 받아 온다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await enterScanStep(user);
    /* 줄이 생기기 전에는 번호가 아직 없다 — 유형만 골라서는 포장을 만들지 않는다. */
    expect(screen.queryByText('SYN-CTN-0091')).toBeNull();
    await matchLot(user);

    expect(await screen.findByText('SYN-CTN-0091')).toBeTruthy();
  });

  it('확정하면 세 단계를 돌고 «포장 번호»를 알린 뒤 ② 로 돌아와 담긴 것을 비운다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes });

    await scanUntilMatched(user);
    await typeQty(user, '120');
    await clickNext(user);

    /* ⭐ 누르면 먼저 되묻는다(사용자 지시 2026-09-17) — [취소]하면 확정 요청이 나가지 않는다. */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.confirm })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.actions.confirm }));
    const dialog = await screen.findByRole('dialog', { name: t.confirmDialog.title });
    expect(within(dialog).getByText('카톤')).toBeInTheDocument();
    expect(within(dialog).getByText(t.confirmDialog.labelNotice)).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: messages.popUniform.dialog.cancel }),
    );
    expect(writes.map(pathOf)).not.toContain('/inventory/handling-units/4001:pack');

    await confirmFromReview(user);

    expect(await screen.findByText(t.confirmed('SYN-CTN-0091'))).toBeTruthy();
    expect(writes.map((request) => `${request.method} ${pathOf(request)}`)).toEqual([
      'POST /inventory/handling-units',
      'POST /inventory/handling-units/4001:pack',
      'PUT /logistics/shipment-lot-allocations/9001',
    ]);
    expect(await screen.findByText(t.rows.empty)).toBeTruthy();
    expect(screen.getByLabelText(t.scan.productionLot)).toBeInTheDocument();
  });

  /* ⛔ 실패를 정규화 갈래 이름으로 말하지 않는다 — 공통 규약 문구로 옮겼는지 붙든다. */
  it('확정이 실패하면 갈래 이름이 아니라 «무엇을 할 것인가»를 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ packConflict: true });

    await scanUntilMatched(user);
    await typeQty(user, '120');
    await clickNext(user);
    await confirmFromReview(user);

    expect(await screen.findByText(messages.conflict.user)).toBeInTheDocument();
    expect(screen.queryByText('conflict')).toBeNull();
    /* 되돌릴 수 없는 쓰기다 — 다시 불러올 편집본이 없으므로 「최신 불러오기」를 내지 않는다. */
    expect(screen.queryByRole('button', { name: messages.conflict.reloadAction })).toBeNull();
  });
});
