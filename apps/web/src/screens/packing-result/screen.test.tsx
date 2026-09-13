import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider } from '../../patterns/pop-identity';
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
  labelNotFound?: boolean;
  /** 출하번호 정확 일치 조회가 아무것도 못 찾은 상태 */
  shipmentNotFound?: boolean;
  /** 단말 게이팅 플래그 */
  canInputResult?: boolean;
  /** 이 단말에 «그 공정 행이 아예 없는» 상태 — 구성되지 않은 공정은 열려 있지 않다 */
  missingProcessRow?: boolean;
  /** 쓰기 요청을 담아 둔다 — 확정이 세 단계를 도는지 본다 */
  writes?: Request[];
  /** 포장 만들기가 실패하는 갈래 — 담긴 줄은 있는데 포장이 없는 상태를 만든다(#1093). */
  createUnitFails?: boolean;
  reads?: Request[];
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
        const missing =
          queryOf(request).has('q') &&
          (options.shipmentNotFound === true || requestedNo?.includes('없음') === true);

        return jsonResponse({
          items: missing
            ? []
            : [
                {
                  shipmentId: requestedNo === 'SYN-SH-0502' ? 502 : 501,
                  shipmentNo: requestedNo ?? 'SYN-SH-0501',
                  shipmentRequestId: 1,
                  warehouseId: 1001,
                  statusCode: 'CONFIRMED',
                  expedited: false,
                },
              ],
          page: { page: 1, size: 50, total: 1 },
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
      respond: () =>
        jsonResponse({
          items: [{ codeValueId: 1, codeGroupId: 9, code: 'CARTON', codeName: '카톤' }],
          page: { page: 1, size: 50, total: 1 },
        }),
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

        return options.createUnitFails === true
          ? jsonResponse({ message: '만들지 못했습니다' }, { status: 500 })
          : jsonResponse(handlingUnitBody, { status: 201, headers: { ETag: '"7"' } });
      },
    },
    {
      match: (request) => pathOf(request) === '/inventory/handling-units/4001:pack',
      respond: (request) => {
        options.writes?.push(request.clone());

        return jsonResponse(handlingUnitBody);
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

        /* ① 납품라벨 스캔 — 빈 목록이 「없는 라벨」이다(계약이 404 를 내지 않는다). */
        if (query.has('q')) {
          const missing =
            options.labelNotFound === true || query.get('q')?.includes('없음') === true;

          return missing
            ? jsonResponse({ items: [], page: { ...page, total: 0 } })
            : jsonResponse({ items: [allocation()], page });
        }

        /* ② 생산LOT 스캔 — 판정은 서버가 내린다. */
        if (query.has('lotQ')) {
          const match = options.match ?? { matched: true };

          return jsonResponse({ items: match.matched ? [allocation()] : [], page, match });
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
        workerNo: '3391',
      }}
    >
      <PackingResultScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes), route: '/pop/packing' },
  );
};

const scan = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  code: string,
): Promise<void> => {
  /* 스캐너는 코드 끝에 Enter 를 붙여 보낸다 — 화면에 [읽기] 단추가 없으므로 그 길이 전부다. */
  await user.type(screen.getByLabelText(label), `${code}{Enter}`);
};

describe('PackingResultScreen', () => {
  it('출하번호 스캔은 정확 일치로 찾고 선택한 출하의 미포장 배분을 이어서 읽는다', async () => {
    const user = userEvent.setup();
    const reads: Request[] = [];
    renderScreen({ reads });

    await scan(user, t.scan.label.shipment, 'SYN-SH-0501');

    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label.productionLot)).toBeEnabled();
    });
    /*
     * ⚠ **`shipmentNo` 는 이제 보내지 않는다**(통보 219 · `queries.ts` 머리말) — 정확 일치
     * 스캔도 검색용 `q` 로 나가고, 응답에서 정확히 같은 번호만 다시 골라낸다.
     */
    const shipmentRequest = reads.find(
      (request) => pathOf(request) === '/logistics/shipments' && queryOf(request).has('q'),
    );
    const allocationRequest = reads.find(
      (request) =>
        pathOf(request) === '/logistics/shipment-lot-allocations' &&
        queryOf(request).get('unpackedOnly') === 'true',
    );

    expect(queryOf(shipmentRequest as Request).get('q')).toBe('SYN-SH-0501');
    expect(queryOf(shipmentRequest as Request).get('pickedOnly')).toBe('true');
    expect(queryOf(shipmentRequest as Request).has('shipDateFrom')).toBe(true);
    expect(queryOf(allocationRequest as Request).get('shipmentId')).toBe('501');
  });

  it('피킹 완료된 출하번호를 찾지 못하면 출하 조회 사유로 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ shipmentNotFound: true });

    await scan(user, t.scan.label.shipment, 'SYN-SH-없음');

    expect(await screen.findByText(t.match.shipmentNotFound)).toBeTruthy();
  });

  it('들어오면 두 스캔 칸이 서고 생산LOT 칸은 «잠긴 채» 사유를 말한다', () => {
    renderScreen();

    expect(screen.getByRole('heading', { name: t.title })).toBeTruthy();
    expect(screen.getByLabelText(t.scan.label.deliveryLabel)).toBeTruthy();
    /* 잠긴 사유는 칸 «안»에 선다 — 아래 한 줄로 달면 구획이 그만큼 커진다(§3 예산 88). */
    const lotField = screen.getByLabelText(t.scan.label.productionLot);

    expect(lotField).toHaveProperty('disabled', true);
    expect(lotField).toHaveAttribute('placeholder', t.scan.lotLocked);
  });

  it('납품라벨을 읽으면 어느 출하인지 서고 생산LOT 칸이 열린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');

    expect(await screen.findByText(t.header.shipment(501))).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label.productionLot)).toHaveProperty('disabled', false);
    });
  });

  /*
   * ⛔ **라벨 모드에서 돌아올 길이 사라지면 현장 단말은 갇힌다**(E-4 — 주 액션을 화면 «안»에
   * 유지한다). 한때 액션 줄을 통째로 숨겼는데 되돌아가는 단추가 그 안에 있었다. 개발용
   * 브라우저는 새로고침으로 빠져나오지만 단말에는 주소창이 없다(88단계 2회차 실측 · #1092).
   */
  it('라벨 모드에 들어가도 돌아오는 단추가 남는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.labels })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: t.actions.labels }));

    const back = await screen.findByRole('button', { name: t.actions.packing });
    expect(back).toBeEnabled();

    /* ⛔ 포장 조작은 함께 서지 않는다 — 라벨 화면에서 누를 일이 없다. */
    expect(screen.queryByRole('button', { name: t.actions.confirm })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.rescan })).not.toBeInTheDocument();

    /* 눌러서 실제로 돌아온다 — 단추가 있는 것과 동작하는 것은 다른 축이다. */
    await user.click(back);
    expect(await screen.findByRole('button', { name: t.actions.confirm })).toBeInTheDocument();
  });

  it('없는 납품라벨은 «빈 목록»으로 오고 화면이 그것을 사유로 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ labelNotFound: true });

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-없음');

    expect(await screen.findByText(t.match.labelNotFound)).toBeTruthy();
  });

  it('새 출하번호 조회가 실패하면 이전 출하 문맥을 폐기해 그 출하로 계속 작업하지 못한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, t.scan.label.shipment, 'SYN-SH-0501');
    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label.productionLot)).toBeEnabled();
    });
    await scan(user, t.scan.label.shipment, 'SYN-SH-없음');

    expect(await screen.findByText(t.match.shipmentNotFound)).toBeInTheDocument();
    expect(screen.getByLabelText(t.scan.label.productionLot)).toBeDisabled();
    expect(screen.queryByText(t.header.shipment(501))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.confirm })).toBeDisabled();
  });

  it('새 납품라벨 조회가 실패해도 이전 출하 문맥으로 LOT을 담을 수 없다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');
    await waitFor(() => {
      expect(screen.getByLabelText(t.scan.label.productionLot)).toBeEnabled();
    });
    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-없음');

    expect(await screen.findByText(t.match.labelNotFound)).toBeInTheDocument();
    expect(screen.getByLabelText(t.scan.label.productionLot)).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.confirm })).toBeDisabled();
  });

  it('매칭되면 «서버가 준 판정»을 그대로 보이고 수량 패드가 선다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');
    await scan(user, t.scan.label.productionLot, 'SYN-LOT-000123450');

    expect(await screen.findByText(t.match.ok)).toBeTruthy();
    expect(screen.getByLabelText(t.qty.label)).toBeTruthy();
  });

  it('⛔ 품목이 다르면 «계약이 준 품목 코드»로 막는다 — 화면이 대응표를 갖지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ match: { matched: false, reasonCode: 'LABEL_ITEM_MISMATCH' } });

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');
    await scan(user, t.scan.label.productionLot, 'SYN-LOT-다른품목');

    expect(await screen.findByText(t.match.itemMismatch('SYN-FG-1001'))).toBeTruthy();
    expect(screen.queryByLabelText(t.qty.label)).toBeNull();
  });

  it('⛔ 배분에 없는 LOT 은 그 사유로 막는다', async () => {
    const user = userEvent.setup();
    renderScreen({ match: { matched: false, reasonCode: 'LOT_NOT_ALLOCATED' } });

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');
    await scan(user, t.scan.label.productionLot, 'SYN-LOT-남의것');

    expect(await screen.findByText(t.match.notAllocated)).toBeTruthy();
  });

  it('단말 플래그가 닫혀 있으면 확정을 막고 «권한이 없다»고 말한다', async () => {
    renderScreen({ canInputResult: false });

    expect(await screen.findByText(t.locks.gateDenied)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.actions.confirm })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('⛔ 그 공정 «행이 없으면» 막는다 — 구성되지 않은 공정을 열어 두지 않는다', async () => {
    renderScreen({ missingProcessRow: true });

    expect(await screen.findByText(t.locks.gateDenied)).toBeTruthy();
  });

  it('진행에 «예상 포장 수»와 진행 막대를 그리지 않는다 — 낼 근거가 없다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');

    expect(await screen.findByText(/미포장/u)).toBeTruthy();
    expect(screen.queryByText(/예상/u)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

/** 매칭까지 마친 상태를 만든다 — 담기·확정 시험의 공통 전제다. */
const scanUntilMatched = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await scan(user, t.scan.label.deliveryLabel, 'SYN-DL-0455-001');
  await scan(user, t.scan.label.productionLot, 'SYN-LOT-000123450');
  await screen.findByText(t.match.ok);
};

/** 키패드로 수량을 치고 담는다. */
const pack = async (user: ReturnType<typeof userEvent.setup>, digits: string): Promise<void> => {
  const pad = screen.getByLabelText(t.qty.label);

  for (const digit of digits) {
    await user.click(within(pad).getByRole('button', { name: digit }));
  }

  await user.click(within(pad).getByRole('button', { name: /확인|담기/u }));
};

describe('PackingResultScreen — 담기와 확정', () => {
  /*
   * ⚠ **동작이 바뀌었다.** 이 시험은 원래 「취소 성공 뒤에만 새 출하를 조회한다」였다.
   * `DELETE /inventory/handling-units/{id}` 는 설계 공지 3(2026-09-08)이 더한 경로라 이번
   * 서버 구현 기준(공지 2 · v0.1.2)에 없다(`mutations.ts` 의 `useHandlingUnitCancel` 머리말
   * 참고) — 그래서 취소는 이제 늘 「준비 중」으로 거부되고, 열린 포장은 거둬지지 않는다.
   * 다른 출하로의 전환도 그 상태 그대로 계속 막힌다. 서버가 이 경로를 구현하면 이 시험을
   * 원래의 성공 시나리오로 되돌리면 된다.
   */
  it('열린 포장이 있으면 다른 출하 전환을 막고, 취소는 아직 지원하지 않아 계속 막힌 채로 남는다', async () => {
    const user = userEvent.setup();
    const reads: Request[] = [];
    renderScreen({ reads });

    await scanUntilMatched(user);
    await pack(user, '60');
    await user.click(screen.getByRole('combobox', { name: t.fields.handlingUnitType }));
    await user.click(await screen.findByRole('option', { name: '카톤' }));
    await screen.findByText('SYN-CTN-0091');

    const sentToOtherShipment = () =>
      reads.some(
        (request) =>
          pathOf(request) === '/logistics/shipments' && queryOf(request).get('q') === 'SYN-SH-0502',
      );

    await scan(user, t.scan.label.shipment, 'SYN-SH-0502');
    expect(await screen.findByText(t.match.openUnitBlocksShipmentChange)).toBeInTheDocument();
    expect(sentToOtherShipment()).toBe(false);

    await user.click(screen.getByRole('button', { name: t.actions.cancelUnit }));

    /* ⛔ 네트워크 요청이 나가지 않는다 — 경로 자체가 없다. 「준비 중」이 드러나고 포장은 남는다. */
    expect(await screen.findByText(HANDLING_UNIT_CANCEL_NOT_READY_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText('SYN-CTN-0091')).toBeInTheDocument();

    /* 취소가 되지 않았으니 다른 출하 전환도 여전히 막혀 있다. */
    await scan(user, t.scan.label.shipment, 'SYN-SH-0502');
    expect(await screen.findByText(t.match.openUnitBlocksShipmentChange)).toBeInTheDocument();
    expect(sentToOtherShipment()).toBe(false);
  });

  /**
   * ⛔ **포장이 없으면 확정 단추를 잠근다**(#1093 · 사용자 지시 「눌러도 안 되면 비활성」).
   *
   * 담는 것은 화면이 즉시 하고 포장은 서버가 만들어 준다. 만들기가 실패하면 담긴 줄은 있는데
   * 포장이 없는 상태로 남는데, 그때 확정 처리기는 조용히 되돌아온다 — 단추가 열려 있으면
   * 작업자는 계속 누르고 아무 말도 듣지 못한다.
   */
  it('포장 만들기가 실패하면 확정이 잠기고 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ createUnitFails: true });

    await scanUntilMatched(user);
    await pack(user, '60');
    await user.click(screen.getByRole('combobox', { name: t.fields.handlingUnitType }));
    await user.click(await screen.findByRole('option', { name: '카톤' }));

    expect(await screen.findByText(t.locks.unitMissing)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.confirm })).toBeDisabled();
  });

  it('키패드로 친 수량이 화면에 보인다 — 누른 값이 어디로 갔는지 보이지 않으면 오입력을 못 알아챈다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);

    const pad = screen.getByLabelText(t.qty.label);

    await user.click(within(pad).getByRole('button', { name: '1' }));
    await user.click(within(pad).getByRole('button', { name: '2' }));

    expect(screen.getByText('12')).toBeTruthy();
  });

  it('같은 LOT 을 다시 담으면 «합쳤다고 말한다» — 조용히 합치면 중복 스캔을 못 알아챈다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);
    await pack(user, '120');
    await scanUntilMatched(user);
    await pack(user, '60');

    expect(await screen.findByText(t.qty.merged(120, 60, 180))).toBeTruthy();
  });

  it('⛔ 잔여를 넘기면 한도를 말하고 담기를 잠근다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanUntilMatched(user);

    const pad = screen.getByLabelText(t.qty.label);
    for (const digit of '181') {
      await user.click(within(pad).getByRole('button', { name: digit }));
    }

    expect(await screen.findByText(t.qty.overRemaining(180))).toBeTruthy();
  });

  it('⭐ 담는 동안 «포장 번호»가 선다 — 번호는 서버가 매기므로 먼저 만들어 받아 온다', async () => {
    const user = userEvent.setup();
    renderScreen();

    /* 담기 전에는 번호가 아예 없다 — 서버가 담는 순간 매긴다(사용자 지시로 설명을 걷었다). */
    expect(screen.queryByText('SYN-CTN-0091')).toBeNull();

    await scanUntilMatched(user);
    await pack(user, '60');
    await user.click(screen.getByRole('combobox', { name: t.fields.handlingUnitType }));
    await user.click(await screen.findByRole('option', { name: '카톤' }));

    expect(await screen.findByText('SYN-CTN-0091')).toBeTruthy();
  });

  it('확정하면 세 단계를 돌고 «포장 번호»를 말한 뒤 담긴 것을 비운다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes });

    await scanUntilMatched(user);
    await pack(user, '120');

    await user.click(screen.getByRole('combobox', { name: t.fields.handlingUnitType }));
    await user.click(await screen.findByRole('option', { name: '카톤' }));

    await user.click(screen.getByRole('button', { name: t.actions.confirm }));

    expect(await screen.findByText(t.confirmed('SYN-CTN-0091'))).toBeTruthy();
    expect(writes.map((request) => `${request.method} ${pathOf(request)}`)).toEqual([
      'POST /inventory/handling-units',
      'POST /inventory/handling-units/4001:pack',
      'PUT /logistics/shipment-lot-allocations/9001',
    ]);
    expect(screen.getByText(t.contents.empty)).toBeTruthy();
  });
});
