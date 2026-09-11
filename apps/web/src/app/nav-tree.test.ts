import { describe, expect, it } from 'vitest';

import { NAV_ENTRIES, NAV_GROUPS, NAV_LEAD } from './nav-tree';

/**
 * ⚠ **중복은 `indexOf`로 잰다 — `Set.add` 의 반환값으로 가르지 않는다.** 이 감지기의 첫 판은
 * `filter((to) => !seen.add(to))` 로 썼는데, `Set.prototype.add` 는 불리언이 아니라 **Set 자신을
 * 돌려준다.** 늘 참이라 `!` 가 늘 거짓이고, 주소를 일부러 겹쳐 봐도 **초록이었다**(결함 재주입에서
 * 드러났다). 고친 쪽은 재주입 두 건에 실제로 막힌다.
 *
 * 메뉴 트리의 **불변식** — 렌더 감지기가 보지 못하는 것만 본다(#1079).
 *
 * `layout.test.tsx`의 전수 순서 감지기가 차례와 경로를 이미 못 박으므로 여기서 그것을 되풀이하지
 * 않는다. 대신 **데이터가 되면서 새로 생긴 사고 경로**를 막는다 — 항목을 복사해 붙이다 주소나
 * 묶음 이름이 겹치는 것이다. JSX 였을 때는 눈에 보였지만 450줄 배열에서는 보이지 않는다.
 */
describe('주 메뉴 트리', () => {
  const allEntries = NAV_ENTRIES;

  /*
   * ⛔ **빈 통과를 막는다.** 트리를 비우면 아래 불변식이 **전부** 성립한다 — 중복도 빈 묶음도
   * 없고 남는 것이 없으니 이름·아이콘도 찼다. 같은 관례가 `layout.test.tsx` 의 섹션 밖 항목
   * 감지기에 이미 있다(그쪽은 `ungrouped.length`를 먼저 본다).
   */
  it('트리가 비어 있지 않다 — 아래 불변식이 무언가를 재고 있다', () => {
    expect(allEntries.length).toBeGreaterThan(1);
    expect(NAV_GROUPS.length).toBeGreaterThan(0);
  });

  /**
   * ⛔ 주소가 겹치면 **두 항목이 동시에 선택 상태가 되고**(`NavItem`이 경로로 판정한다) React
   * 목록 키도 겹친다. 겹친 쪽이 둘 다 틀린 자리에 있다는 뜻이라 고를 수 있는 쪽이 없다.
   */
  it('주소가 겹치지 않는다', () => {
    const addresses = allEntries.map((entry) => entry.to);

    expect(addresses.filter((to, index) => addresses.indexOf(to) !== index)).toEqual([]);
  });

  /**
   * ⛔ 묶음 이름이 겹치면 DS 가 `role="group"`의 접근명으로 쓰는 값이 모호해지고, 화면을 이름으로
   * 찾는 시험과 보조기술이 **어느 묶음인지 가를 수 없다.** 목록 키도 이름이다.
   */
  it('묶음 이름이 겹치지 않는다', () => {
    const labels = NAV_GROUPS.map((group) => group.label);

    expect(labels.filter((label, index) => labels.indexOf(label) !== index)).toEqual([]);
  });

  /** 빈 묶음은 **제목만 있는 줄**로 그려진다 — 접기 손잡이까지 붙으면 눌러도 아무것도 안 열린다. */
  it('빈 묶음이 없다', () => {
    expect(NAV_GROUPS.filter((group) => group.items.length === 0)).toEqual([]);
  });

  /**
   * ⛔ 섹션 밖 항목이 어느 묶음에도 **중복해 들어가지 않는다.** 들어가면 같은 화면이 사이드바에
   * 두 번 서고, 그 둘이 동시에 선택 상태가 된다.
   */
  it('섹션 밖 항목이 묶음 안에 다시 들어 있지 않다', () => {
    const grouped = NAV_GROUPS.flatMap((group) => group.items).map((item) => item.to);

    expect(grouped).not.toContain(NAV_LEAD.to);
  });

  /**
   * 아이콘·이름이 빈 항목은 **누를 수는 있지만 무엇인지 알 수 없는 줄**이 된다.
   *
   * ⚠ **공백만 있는 것도 빈 것이다.** `''` 만 거르면 `'   '` 가 통과하는데, 그리면 아무것도
   * 보이지 않는 줄이 선다 — 「알 수 없는 줄을 만들지 않는다」는 이 감지기의 선언이 거기에
   * 닿지 않으면 선언만 남는다.
   */
  it('모든 항목에 아이콘과 이름이 있다', () => {
    const blank = allEntries.filter(
      (entry) => entry.icon.trim() === '' || entry.label.trim() === '',
    );

    expect(blank).toEqual([]);
  });

  /**
   * ⛔ **주소는 `/` 로 시작한다.** `to: ''` 는 중복도 아니고 이름·아이콘도 차 있어 다른 불변식을
   * **전부 통과**하는데, `NavItem` 의 선택 판정이 `pathname.startsWith(`${to}/`)` 라 빈 주소는
   * `'/'` 가 되어 **모든 화면에서 그 항목이 선택 상태로** 그려진다. 상대 주소도 막는다 —
   * `useHref` 가 현재 위치를 기준으로 풀어, 같은 항목이 화면마다 다른 곳으로 간다.
   */
  it('모든 주소가 절대 경로다', () => {
    expect(allEntries.filter((entry) => !entry.to.startsWith('/'))).toEqual([]);
  });

  /**
   * 아이콘 69개의 **회귀 그물**(#1079 검토).
   *
   * ⚠ **이 값들을 재는 곳이 저장소에 없었다.** 전수 순서 감지기는 `href` 만 재고 섹션별 감지기는
   * 이름만 잰다 — 아이콘 둘을 맞바꿔도 전부 초록이었다. 69개를 손으로 옮기는 회차라 여기서
   * 얼린다. 아래 목록은 **옮기기 전 JSX**(`9cb13e97`)에서 뽑았고, 그 쪽과 데이터가 같다는 것은
   * 삼중항 대조로 따로 확인했다.
   *
   * 아이콘을 **바꾸는 것 자체는 자유다** — 바꿀 때 이 목록을 함께 고치면 된다. 막는 것은
   * 「모르는 채로 바뀌는 것」이다.
   */
  it('항목마다 정해진 아이콘을 쓴다', () => {
    expect(allEntries.map((entry) => `${entry.to} → ${entry.icon}`)).toEqual([
      '/dashboard → dashboard',
      '/master-data/warehouse-location → warehouse',
      '/master-data/putaway-rule → shelves',
      '/master-data/warehouse-layout → map',
      '/master-data/routing → account_tree',
      '/master-data/inspection-standard → fact_check',
      '/master-data/defect-cause-code → rule',
      '/master-data/common-code → list_alt',
      '/master-data/judgment-code → verified',
      '/master-data/integration-sync → sync_alt',
      '/master-data/item-extended-attrs → inventory_2',
      '/master-data/master-change → history',
      '/logistics/inbound-schedule → local_shipping',
      '/logistics/over-receipt-split → call_split',
      '/logistics/iqc-inspection → troubleshoot',
      '/logistics/goods-receipt → inventory_2',
      '/logistics/stock-status → inventory',
      '/logistics/stocktaking → checklist',
      '/logistics/stock-adjust → tune',
      '/logistics/supplier-return → assignment_return',
      '/logistics/disposal-issue → delete_forever',
      '/logistics/iqc-skip-approval → approval',
      '/logistics/document-progress → manage_search',
      '/shipment/shipment-request-create → assignment',
      '/shipment/shipment-schedule → local_shipping',
      '/shipment/oqc-inspection → fact_check',
      '/shipment/shipment-processing → outbound',
      '/shipment/expedited-shipment → bolt',
      '/shipment/shipment-confirm → task_alt',
      '/shipment/return-receipts → keyboard_return',
      '/shipment/disposition-requests → assignment_return',
      '/shipment/stock-reinstatements → move_to_inbox',
      '/shipment/product-disposal-request → delete_sweep',
      '/production/production-orders → account_tree',
      '/production/po-change-review → published_with_changes',
      '/production/production-plans → schema',
      '/production/work-order-assignments → tune',
      '/production/work-order-release → rocket_launch',
      '/production/work-order-close → archive',
      '/production/emergency-work-orders → bolt',
      '/production/material-issue-requests → playlist_add',
      '/production/work-order-progress → monitoring',
      '/quality/lot-status → history',
      '/quality/lot-status-transition → published_with_changes',
      '/quality/suspicious-material-hold → report_problem',
      '/quality/inspection-results → analytics',
      '/quality/approvals → approval',
      '/quality/dispositions → gavel',
      '/equipment/master → precision_manufacturing',
      '/equipment/tool-master → handyman',
      '/equipment/work-calendar → calendar_month',
      '/equipment/collection-channels → sensors',
      '/equipment/shot-conversion → calculate',
      '/equipment/gauge-master → straighten',
      '/equipment/gauge-calibration → event_available',
      '/equipment/failures → build',
      '/equipment/maintenance-orders → assignment',
      '/equipment/maintenance-results → task_alt',
      '/equipment/tool-pm-order → schedule',
      '/equipment/tool-pm-result → restart_alt',
      '/equipment/downtime-summary → timelapse',
      '/approval/inbox → inbox',
      '/notification/center → notifications',
      '/notification/recipient-settings → notifications_active',
      '/notification/notices → campaign',
      '/system/users-roles → manage_accounts',
      '/system/approval-route → approval',
      '/system/terminal-process-map → tablet_android',
      '/system/password-change → password',
    ]);
  });
});
