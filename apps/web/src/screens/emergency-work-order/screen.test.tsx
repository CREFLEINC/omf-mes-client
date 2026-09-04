import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { EmergencyWorkOrderScreen } from './screen';

const t = messages.emergencyWorkOrder;
const KNOWN_CODE = 'SYN_EMERGENCY';
const WORK_ORDER = { workOrderId: 7001, workOrderNo: 'SYN-WO-0007' };

const ITEM = {
  itemId: 5001,
  itemCode: 'SYN-ITEM-0001',
  itemName: '합성 품목',
  itemTypeCode: 'SYN_PRODUCT',
  baseUomId: 11,
  lotControlled: true,
  serialControlTypeCode: 'SYN_NONE',
  inspectionRequired: false,
  fifoPolicyCode: 'SYN_FIFO',
  negativeStockAllowed: false,
  isActive: true,
};

const BOM = {
  bomId: 71,
  parentItemId: 5001,
  bomCode: 'SYN-BOM-0001',
  bomVersion: 3,
  statusCode: 'SYN_ACTIVE',
  isDefault: true,
  effectiveFrom: '2026-01-01',
  baseQty: 1,
  baseUomId: 11,
};

const ROUTING = {
  routingId: 31,
  itemId: 5001,
  routingCode: 'SYN-RT-0001',
  routingVersion: 2,
  statusCode: 'SYN_ACTIVE',
};

const OPERATION = {
  routingOperationId: 901,
  routingId: 31,
  operationSeq: 10,
  processId: 41,
  operationName: '사출',
  mesManaged: true,
  materialInputManaged: true,
  productionResultManaged: true,
  inspectionManaged: false,
  outputLotRequired: true,
  equipmentRequired: false,
  moldRequired: false,
};

interface StubOptions {
  boms?: unknown[];
  routings?: unknown[];
  failRelease?: boolean;
  /** 배포되지 않은 채 남아 있는 긴급 W/O. 기본은 없음 — 그것이 정상이다. */
  unreleased?: unknown[];
  /** 되찾기 조회가 실패한다 — 「밀린 것 없음」과 갈리는지 보려는 것이다. */
  failUnreleased?: boolean;
  /** 발행이 반려된다 — 고른 개정이 조회와 저장 사이에 폐기된 상황이다. */
  rejectIssue?: boolean;
}

/** 되찾기 목록의 한 줄. 발행으로 만들어지는 것과 번호를 달리해 둘이 섞이지 않게 한다. */
const UNRELEASED = {
  workOrderId: 7009,
  workOrderNo: 'SYN-WO-0009',
  productionPlanId: 3009,
  routingOperationId: 901,
  itemId: 5001,
  orderQty: 150,
  uomId: 11,
  workOrderTypeCode: 'EMERGENCY',
  statusCode: 'SYN_CONFIRMED',
  priorityNo: 1,
  remarks: '앞서 멈춘 발행',
};

const listOf = (items: unknown[]): Response =>
  jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });

/** 나간 쓰기 하나. 경로만으로는 **무엇을 보냈는지**를 볼 수 없다. */
interface SentWrite {
  path: string;
  body: Record<string, unknown>;
}

const stub = (
  options: StubOptions = {},
): { paths: string[]; writes: SentWrite[]; fetch: StubFetch } => {
  const paths: string[] = [];
  const writes: SentWrite[] = [];

  const fetch: StubFetch = async (request) => {
    const path = new URL(request.url).pathname;
    paths.push(path);
    if (request.method !== 'GET') {
      writes.push({ path, body: (await request.clone().json()) as Record<string, unknown> });
    }

    if (path === '/mdm/items') return listOf([ITEM]);
    if (path === '/mdm/uoms') return listOf([{ uomId: 11, uomCode: 'EA', isActive: true }]);
    if (path === '/planning/boms') return listOf(options.boms ?? [BOM]);
    if (path === '/planning/routings') return listOf(options.routings ?? [ROUTING]);
    if (path === '/planning/routings/31/operations') return listOf([OPERATION]);
    if (path.endsWith(':release')) {
      return options.failRelease === true
        ? jsonResponse(
            { errors: [{ scope: 'screen', code: 'SYN_CODE', message: '서버 문구' }] },
            { status: 500 },
          )
        : jsonResponse(WORK_ORDER);
    }
    /*
     * ⛔ **경로가 같아도 메서드가 다르면 다른 요청이다.** 발행(POST)과 배포 안 된 목록
     * 조회(GET)가 같은 경로를 쓴다 — 경로만 보고 답하면 조회에 발행 응답이 돌아가고,
     * 그 어긋남은 화면이 아니라 스텁의 결함인데 감지기 실패로만 나타나 찾기 어렵다.
     */
    if (path === '/production/work-orders' && request.method === 'GET') {
      return options.failUnreleased === true
        ? jsonResponse({ message: '실패' }, { status: 500 })
        : listOf(options.unreleased ?? []);
    }
    /* ⭐ 발행 응답이 잠금 토큰을 준다 — 그래서 배포 전에 상세를 부르지 않는다. */
    if (path === '/production/work-orders') {
      return options.rejectIssue === true
        ? jsonResponse(
            {
              errors: [
                {
                  scope: 'screen',
                  code: 'SYN_CODE',
                  message: '고른 개정이 폐기되어 발행할 수 없습니다',
                },
              ],
            },
            { status: 400 },
          )
        : jsonResponse(WORK_ORDER, { status: 201, headers: { ETag: 'W/"9"' } });
    }
    if (path === '/production/work-orders/7001') {
      return jsonResponse(WORK_ORDER, { headers: { ETag: 'W/"3"' } });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${path}`);
  };

  return { paths, writes, fetch };
};

/**
 * `typeCode` 를 넘기지 않으면 **화면이 쓰는 상수가 그대로 간다** — 상수부터 전선까지를
 * 한 번에 보려는 검사가 그 모양을 쓴다.
 */
const renderScreen = (options: StubOptions & { typeCode?: string } = {}) => {
  const stubbed = stub(options);

  renderWithProviders(<EmergencyWorkOrderScreen typeCode={options.typeCode ?? KNOWN_CODE} />, {
    fetch: stubbed.fetch,
  });

  return { user: userEvent.setup(), paths: stubbed.paths, writes: stubbed.writes };
};

const renderWithScreenDefaultTypeCode = (options: StubOptions = {}) => {
  const stubbed = stub(options);

  renderWithProviders(<EmergencyWorkOrderScreen />, { fetch: stubbed.fetch });

  return { user: userEvent.setup(), paths: stubbed.paths, writes: stubbed.writes };
};

/**
 * 품목을 찾아 고르고, 수량·사유를 채운다 — 발행 직전까지.
 *
 * ⭐ 수량 칸을 **단위 이름으로** 집으므로, 이 함수를 쓰는 모든 검사가 「수량 라벨에 고른
 * 품목의 단위가 붙는다」를 함께 고정한다.
 */
const fillForm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.type(screen.getByLabelText(t.itemPicker.label), 'SYN');
  await user.click(screen.getByRole('button', { name: t.itemPicker.search }));
  await user.click(await screen.findByRole('button', { name: /SYN-ITEM-0001/ }));
  await user.type(await screen.findByLabelText(/EA/), '200');
  await user.type(screen.getByLabelText(t.form.reason), '고객 긴급 요청');
};

describe('EmergencyWorkOrderScreen', () => {
  it('고정 조건·품목·발행 정보·자동 전개·발행 준비를 제목이 있는 구획으로 나눈다', () => {
    renderScreen();

    for (const title of [
      t.fixedTerms.title,
      t.itemPicker.title,
      t.form.title,
      t.expansion.title,
      t.actionTitle,
    ]) {
      const region = screen.getByRole('region', { name: title });
      expect(within(region).getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it('바꿀 수 없는 조건을 먼저 보이고, 발행은 사유와 함께 잠겨 있다', () => {
    renderScreen();

    expect(screen.getByRole('region', { name: t.fixedTerms.title })).toBeInTheDocument();

    const action = screen.getByRole('button', { name: t.action });
    expect(action).toBeDisabled();
    /* ⛔ 잠긴 이유를 감추지 않고, 버튼에 «묶어» 낸다. */
    expect(action).toHaveAccessibleDescription(t.lock.itemNotChosen);
    /* 배포 재시도는 낼 것이 있을 때만 나온다. */
    expect(screen.queryByRole('button', { name: t.outcome.retryRelease })).not.toBeInTheDocument();
  });

  /*
   * ⛔ **빈 유형으로는 보내지 않는다.** 보내면 서버가 양산으로 채워, 화면은 「유형: 긴급」이라
   * 적어 놓고 **양산 작업지시가 만들어진다** — 오류가 나지 않아 아무 데서도 드러나지 않는다.
   * 값이 확정된 뒤에도 이 잠금은 남는다.
   */
  it('⛔ 유형 값이 없으면 잠그고 사유를 말한다 — 입력을 다 채우기 «전에»', () => {
    renderScreen({ typeCode: '' });

    const action = screen.getByRole('button', { name: t.action });
    expect(action).toBeDisabled();
    expect(action).toHaveAccessibleDescription(t.lock.typeCodeUnknown);
  });

  /*
   * ⛔⛔ **이 화면에서 가장 조용한 사고를 막는 자리다.**
   *
   * 상수·명령·본문 어느 한 마디에서 값이 새면 서버가 유형을 양산으로 채우고, **오류 없이**
   * 긴급이 아닌 작업지시가 만들어진다. 화면은 「유형: 긴급」이라 적혀 있고, 그렇게 만들어진
   * 지시는 긴급으로 세어지지도 긴급 현장 투입 화면에 뜨지도 않는다.
   *
   * ⭐ **`typeCode` 를 넘기지 않는다** — 화면이 실제로 쓰는 상수가 전선까지 가는지를 봐야
   * 하므로, 검사가 값을 주입하면 정작 확인하려던 것을 확인하지 못한다.
   */
  it('⛔ 화면이 쓰는 유형 값이 발행 본문에 그대로 실린다 — 새면 양산 지시가 조용히 만들어진다', async () => {
    const { user, writes } = renderWithScreenDefaultTypeCode();

    await fillForm(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.action })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.action }));

    await screen.findByText(t.outcome.released('SYN-WO-0007'));

    const created = writes.find((write) => write.path === '/production/work-orders');
    expect(created?.body).toMatchObject({ workOrderTypeCode: 'EMERGENCY' });
  });

  it('품목을 고르면 BOM·Routing 이 자동으로 펼쳐진다', async () => {
    const { user } = renderScreen();

    await fillForm(user);

    expect(await screen.findByText(/SYN-BOM-0001/)).toBeInTheDocument();
    expect(screen.getByText(/SYN-RT-0001/)).toBeInTheDocument();
    expect(screen.getByText('사출')).toBeInTheDocument();
  });

  it('⛔ BOM 이 없으면 막고 무엇이 없는지 말한다', async () => {
    const { user } = renderScreen({ boms: [] });

    await fillForm(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.action })).toHaveAccessibleDescription(
        t.lock.blocked.bomMissing,
      );
    });
    expect(screen.getByRole('button', { name: t.action })).toBeDisabled();
  });

  it('⛔ 개정이 여럿이면 고르기 전에는 발행하지 않는다', async () => {
    const { user } = renderScreen({
      routings: [ROUTING, { ...ROUTING, routingId: 32, routingVersion: 3 }],
    });

    await fillForm(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.action })).toHaveAccessibleDescription(
        t.lock.revisionNotChosen,
      );
    });
  });

  it('갖춰지면 발행이 열리고, 누르면 발행·배포가 끝난다', async () => {
    const { user, paths } = renderScreen();

    await fillForm(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.action })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.action }));

    expect(await screen.findByText(t.outcome.released('SYN-WO-0007'))).toBeInTheDocument();
    expect(paths).toContain('/production/work-orders');
    expect(paths).toContain('/production/work-orders/7001:release');
    /* ⭐ 발행 응답이 토큰을 주므로 가운데 상세 조회가 없다 — 호출이 셋에서 둘로 줄었다. */
    expect(paths).not.toContain('/production/work-orders/7001');
  });

  /*
   * ⛔ 이 화면의 핵심 위험 — 만들어졌는데 배포가 끝나지 않은 창. 「발행 실패」로 말하지 않고
   * 번호를 보이며 배포만 다시 내게 한다.
   */
  it('⛔ 배포가 멈추면 「실패」가 아니라 번호와 함께 알리고 재시도를 낸다', async () => {
    const { user } = renderScreen({ failRelease: true });

    await fillForm(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.action })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.action }));

    expect(await screen.findByText(t.outcome.releaseUnknown('SYN-WO-0007'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.outcome.retryRelease })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.action })).toBeDisabled();
  });

  it('⛔ 잠금 사유를 한 곳에서만 말한다 — 두 곳이면 갈라진다', () => {
    renderScreen();

    expect(screen.getAllByText(t.lock.itemNotChosen)).toHaveLength(1);
  });

  /*
   * ⭐ **개정은 조회와 저장 «사이»에 폐기될 수 있다.** 그때 서버가 발행을 반려하는데, 화면이
   * 아무 말도 하지 않으면 사용자는 **아무 일도 안 일어난 줄 알고 다시 누른다.** 그리고 낡은
   * 목록을 그대로 두면 **같은 폐기된 개정으로** 다시 누르게 된다.
   */
  describe('발행이 반려됐을 때', () => {
    it('⛔ 서버가 되돌린 문구를 그대로 보인다', async () => {
      const { user } = renderScreen({ rejectIssue: true });

      await fillForm(user);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.action })).toBeEnabled();
      });
      await user.click(screen.getByRole('button', { name: t.action }));

      expect(
        await screen.findByText('고른 개정이 폐기되어 발행할 수 없습니다'),
      ).toBeInTheDocument();
    });

    it('⭐ 전개를 다시 받는다 — 낡은 목록으로 같은 개정을 또 고르지 않게', async () => {
      const { user, paths } = renderScreen({ rejectIssue: true });

      await fillForm(user);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.action })).toBeEnabled();
      });

      const before = paths.filter((path) => path === '/planning/routings').length;
      await user.click(screen.getByRole('button', { name: t.action }));

      await waitFor(() => {
        expect(paths.filter((path) => path === '/planning/routings').length).toBeGreaterThan(
          before,
        );
      });
    });
  });

  describe('배포 안 된 W/O 이어받기', () => {
    /* ⚠ 밀린 것이 없는 것이 정상이다 — 그때 구획이 서면 늘 켜진 경고가 된다. */
    it('⚠ 밀린 것이 없으면 구획이 서지 않는다', async () => {
      renderScreen();

      await screen.findByRole('button', { name: t.itemPicker.search });
      expect(screen.queryByRole('region', { name: t.handover.title })).not.toBeInTheDocument();
    });

    it('밀린 것이 있으면 번호와 함께 보이고 배포 재시도를 낸다', async () => {
      renderScreen({ unreleased: [UNRELEASED] });

      expect(await screen.findByRole('region', { name: t.handover.title })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'SYN-WO-0009' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t.handover.retry })).toBeInTheDocument();
    });

    /*
     * ⛔⛔ **같은 W/O 에 배포 버튼이 둘이면 안 된다.**
     *
     * 방금 발행했는데 배포가 멈춘 W/O 는 되찾기 목록에도 들어온다. 그대로 두면 위쪽 발행
     * 구획과 아래 목록이 **같은 지시에 각각 [배포 재시도]를 내주고, 둘은 서로 다른 멱등 키를
     * 쓴다.** 서버는 그것을 다른 쓰기로 보므로 **이중 배포**가 열린다 — 되돌릴 수 없다.
     */
    it('⛔ 지금 화면이 들고 있는 W/O 는 목록에서 뺀다 — 배포 버튼이 둘이 되지 않게', async () => {
      const { user } = renderScreen({
        failRelease: true,
        /* 방금 발행할 것과 같은 번호가 목록에도 들어와 있는 상태를 만든다. */
        unreleased: [{ ...UNRELEASED, workOrderId: 7001, workOrderNo: 'SYN-WO-0007' }],
      });

      await fillForm(user);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.action })).toBeEnabled();
      });
      await user.click(screen.getByRole('button', { name: t.action }));

      /* 발행 구획이 그 W/O 를 맡는다 — 재시도는 거기 하나뿐이다. */
      expect(await screen.findByText(t.outcome.releaseUnknown('SYN-WO-0007'))).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: t.outcome.retryRelease })).toHaveLength(1);
      expect(screen.queryByRole('button', { name: t.handover.retry })).not.toBeInTheDocument();
    });

    /* ⛔ 못 받은 것을 「밀린 것 없음」으로 두면 화면이 조용히 틀린다. */
    it('⛔ 목록을 받지 못하면 그 사실을 알린다', async () => {
      renderScreen({ failUnreleased: true });

      expect(await screen.findByText(t.handover.loadError)).toBeInTheDocument();
    });
  });
});
