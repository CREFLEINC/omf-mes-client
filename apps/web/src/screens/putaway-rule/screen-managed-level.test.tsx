import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

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
 * 고정 설계의 창고 관리수준에 따른 위치 칸을 화면 배선 수준에서 잰다.
 *
 * ## 왜 부품 시험으로는 모자란가
 *
 * `rule-form-pane.test.tsx`의 두 벌은 `locationDisabledReason`에 **시험이 직접 문자열을
 * 넘겨** 잰다 — 화면이 무엇을 넘기는지는 재지 않는다. 실제로 그 상태에서 **화면 배선이
 * 엉뚱한 문장을 넘기고 있어도 부품 시험은 초록불이었다.** 이 파일은 **배선 층**을 잰다:
 * 화면이 상수를 읽고 · 고른 창고의 관리수준을 찾고 · 판정을 거쳐 · **어느 문장을 고르는가**.
 *
 * `ZONE`은 위치 입력을 열고 `WAREHOUSE`는 잠근다. 부품 시험은 전달받은 문자열만 확인하므로
 * 여기서 실제 창고 응답 → 판정 → 안내 문구의 연결을 고정한다.
 */
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
 * 픽스처의 두 창고는 둘 다 `ZONE`이라 「위치를 관리하는 창고」만 있고, 그것만으로는
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
  managementLevelCode: 'WAREHOUSE',
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

  await waitFor(() =>
    expect(
      screen
        .getAllByRole('button', { name: t.actions.create })
        .some((button) => !button.hasAttribute('disabled')),
    ).toBe(true),
  );
  const create = screen
    .getAllByRole('button', { name: t.actions.create })
    .find((button) => !button.hasAttribute('disabled'));
  if (create === undefined) throw new Error('사용 가능한 규칙 추가 버튼이 없습니다.');
  await user.click(create);
  await within(formPane()).findByLabelText(t.fields.priorityNo);

  return { user };
};

describe('PutawayRuleScreen — 고정 관리수준에 따른 위치 칸', () => {
  /**
   * **양성 짝.** 목록에 든 관리수준의 창고에서는 위치 칸이 그대로 열린다 —
   * 「값이 채워지면 무조건 잠긴다」로 배선해도 통과하지 않게 한다.
   *
   * 과거의 「아직 정해지지 않았다」 안내는 더 이상 존재하지 않는다.
   */
  it('위치를 관리하는 창고에서는 칸이 열리고 미정 안내가 사라진다', async () => {
    await openCreateForm();

    expect(locationSelect()).toBeEnabled();
  });

  /**
   * ⛔ **음성 짝 — 이 회차가 고친 자리다.**
   *
   * 잠긴 칸은 사유와 해제 위치를 함께 말한다(G-10).
   */
  it('위치를 관리하지 않는 창고로 바꾸면 잠기고 그 창고의 사유가 선다', async () => {
    const { user } = await openCreateForm();

    await user.click(within(formPane()).getByRole('combobox', { name: t.fields.warehouse }));
    await user.click(await screen.findByRole('option', { name: UNMANAGED_WAREHOUSE_LABEL }));

    expect(locationSelect()).toBeDisabled();
    expect(within(formPane()).getByText(t.notes.locationNotManaged)).toBeInTheDocument();
    expect(within(formPane()).getByText(/창고·Location 화면/)).toBeInTheDocument();
  });
});
