import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  itemFixtures,
  locationFixtures,
  ruleFixtures,
  uncoveredItemFixtures,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { PutawayRuleScreen } from './screen';

/**
 * **창고 관리수준 값 목록이 확정된 뒤의 위치 칸**을 미리 재는 자리.
 *
 * 지금 `management-level.ts`의 배열은 비어 있고(`omf-mes#64`) 그동안 위치 칸은 **어느
 * 창고에서도 잠기지 않는다** — 그래서 「잠겼을 때 화면이 무엇을 사유로 내는가」를 다른 어떤
 * 방법으로도 볼 수 없다. 값 목록이 확정되는 회차가 이 파일을 지우는 회차이고, 그때까지
 * 이 파일이 **「배열만 채우면 살아난다」를 화면 수준에서 증명한다**(전례
 * `approval-route/screen-create.test.tsx`와 같은 형태).
 *
 * ## 왜 부품 시험으로는 모자란가
 *
 * `rule-form-pane.test.tsx`의 두 벌은 `locationDisabledReason`에 **시험이 직접 문자열을
 * 넘겨** 잰다 — 화면이 무엇을 넘기는지는 재지 않는다. 실제로 그 상태에서 **화면 배선이
 * 엉뚱한 문장을 넘기고 있어도 부품 시험은 초록불이었다.** 이 파일은 **배선 층**을 잰다:
 * 화면이 상수를 읽고 · 고른 창고의 관리수준을 찾고 · 판정을 거쳐 · **어느 문장을 고르는가**.
 *
 * **자리표시 상수 하나만 갈아 끼운다.** 판정 함수도 조회도 실물 그대로다 —
 * 그래야 「배열만 채우면」이 참인지가 증명된다.
 */
vi.mock('./management-level', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./management-level')>();

  return { ...actual, LOCATION_MANAGED_LEVEL_CODES: ['SYN-LEVEL'] };
});

const t = messages.putawayRule;

const RULES_PATH = '/logistics/putaway-rules';
const UNCOVERED_PATH = '/logistics/putaway-rules/uncovered-items';
const BALANCES_PATH = '/inventory/balances';
const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';

/**
 * **위치를 관리하지 않는 창고** — 관리수준이 위 목록에 없다.
 *
 * 픽스처의 두 창고는 둘 다 `SYN-LEVEL`이라 「목록에 있는 창고」만 있고, 그것만으로는
 * 「잠기는 갈래」에 닿을 수 없다. 여기 하나를 더해 **양성·음성 짝**을 같은 파일에서 잰다 —
 * 한쪽만 재면 「늘 열린다」나 「늘 잠긴다」로 배선해도 통과한다.
 */
const UNMANAGED_WAREHOUSE = {
  warehouseId: 9203,
  plantId: 9001,
  businessUnitId: 9002,
  warehouseCode: 'SYN-WH-03',
  warehouseName: '합성창고 다',
  warehouseTypeCode: 'SYN-WH-TYPE',
  managementLevelCode: 'SYN-LEVEL-NO-LOCATION',
  isExternal: false,
  isActive: true,
};

const UNMANAGED_WAREHOUSE_LABEL = 'SYN-WH-03 · 합성창고 다';

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 20, total: items.length },
});

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const route = (pathname: string, items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items)),
});

/** 계약이 창고를 필수로 요구하는 조회다 — 창고로 걸러 돌려준다. */
const locationsRoute: StubRoute = {
  match: (request) => isGet(request, LOCATIONS_PATH),
  respond: (request) => {
    const warehouseId = Number(new URL(request.url).searchParams.get('warehouseId'));

    return jsonResponse(
      listBody(locationFixtures.filter((location) => location.warehouseId === warehouseId)),
    );
  },
};

const routes: StubRoute[] = [
  route(UNCOVERED_PATH, uncoveredItemFixtures),
  route(RULES_PATH, ruleFixtures),
  route(BALANCES_PATH, []),
  route(WAREHOUSES_PATH, [...warehouseFixtures, UNMANAGED_WAREHOUSE]),
  locationsRoute,
  route(ITEMS_PATH, itemFixtures),
  route(UOMS_PATH, uomFixtures),
];

const formPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.form });

const locationSelect = (): HTMLElement =>
  within(formPane()).getByRole('combobox', { name: t.fields.location });

/** 조건 줄의 창고(9201)로 목록을 세우고 등록 폼을 연다. */
const openCreateForm = async () => {
  const user = userEvent.setup();

  renderWithProviders(<PutawayRuleScreen />, {
    fetch: createStubFetch(routes),
    route: '/?wh=9201',
  });

  await user.click(await screen.findByRole('button', { name: t.actions.create }));
  await within(formPane()).findByLabelText(t.fields.priorityNo);

  return { user };
};

describe('PutawayRuleScreen — 관리수준 값이 확정된 뒤의 위치 칸', () => {
  /**
   * **양성 짝.** 목록에 든 관리수준의 창고에서는 위치 칸이 그대로 열린다 —
   * 「값이 채워지면 무조건 잠긴다」로 배선해도 통과하지 않게 한다.
   *
   * 「아직 정해지지 않았다」 안내도 **함께 사라진다** — 그 문장은 미정 상태의 사실이라
   * 값이 정해진 뒤에 남아 있으면 화면이 지난 사정을 계속 말하게 된다.
   */
  it('위치를 관리하는 창고에서는 칸이 열리고 미정 안내가 사라진다', async () => {
    await openCreateForm();

    expect(locationSelect()).toBeEnabled();
    expect(within(formPane()).queryByText(t.notes.managementLevelPending)).not.toBeInTheDocument();
  });

  /**
   * ⛔ **음성 짝 — 이 회차가 고친 자리다.**
   *
   * 잠긴 칸의 사유로 「…아직 정해지지 않아 **모든 창고에서 위치를 고를 수 있습니다**」를
   * 넘기면 화면이 자기모순을 말한다. **화면이 무엇을 넘기는지**를 여기서 잰다 —
   * 부품 시험은 시험이 직접 넘긴 문자열을 되읽을 뿐이라 이 배선을 보지 못한다.
   */
  it('위치를 관리하지 않는 창고로 바꾸면 잠기고 그 창고의 사유가 선다', async () => {
    const { user } = await openCreateForm();

    await user.click(within(formPane()).getByRole('combobox', { name: t.fields.warehouse }));
    await user.click(await screen.findByRole('option', { name: UNMANAGED_WAREHOUSE_LABEL }));

    expect(locationSelect()).toBeDisabled();
    expect(within(formPane()).getByText(t.notes.locationNotManaged)).toBeInTheDocument();
    /* 잠긴 칸이 「고를 수 있습니다」라고 말하지 않는다. */
    expect(within(formPane()).queryByText(t.notes.managementLevelPending)).not.toBeInTheDocument();
  });
});
