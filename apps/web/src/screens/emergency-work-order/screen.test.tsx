import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { EmergencyWorkOrderScreen } from './screen';

const t = messages.emergencyWorkOrder;
const KNOWN_CODE = 'SYN_EMERGENCY';
const NOW = new Date('2026-08-05T09:00:00+09:00');
const WORK_ORDER = { workOrderId: 7001, workOrderNo: 'SYN-WO-0007' };

const ITEM = {
  itemId: 5001,
  itemCode: 'SYN-ITEM-0001',
  itemName: '합성 품목',
  itemTypeCode: 'SYN_PRODUCT',
  baseUomId: 11,
  lotControlTypeCode: 'SYN_LOT',
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
}

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
    if (path === '/production/work-orders') return jsonResponse(WORK_ORDER, { status: 201 });
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

  renderWithProviders(
    <EmergencyWorkOrderScreen now={NOW} typeCode={options.typeCode ?? KNOWN_CODE} />,
    { fetch: stubbed.fetch },
  );

  return { user: userEvent.setup(), paths: stubbed.paths, writes: stubbed.writes };
};

const renderWithScreenDefaultTypeCode = (options: StubOptions = {}) => {
  const stubbed = stub(options);

  renderWithProviders(<EmergencyWorkOrderScreen now={NOW} />, { fetch: stubbed.fetch });

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
});
