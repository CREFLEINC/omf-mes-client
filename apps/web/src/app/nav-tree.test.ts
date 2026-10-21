import { describe, expect, it } from 'vitest';

import { NAV_ENTRIES, NAV_GROUPS, NAV_LEAD, navEntryPaths, type NavEntry } from './nav-tree';

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
   * 탭 묶음(`tabs`)의 불변식 — 사이드바 한 줄이 화면 여럿을 품게 되면서 생긴 사고 경로다.
   *
   * ⚠ **탭 묶음 자신은 `NAV_ENTRIES` 에 없다**(화면이 아니라 화면 코드가 없다). 그래서 위의
   * 이름·주소 감지기가 묶음 줄을 보지 못한다 — 묶음 줄은 여기서 따로 잰다.
   */
  describe('탭 묶음', () => {
    const rows: readonly NavEntry[] = NAV_GROUPS.flatMap((group) => group.items);
    const hubs = rows.filter(
      (row): row is NavEntry & { tabs: NonNullable<NavEntry['tabs']> } => row.tabs !== undefined,
    );

    /* ⛔ 빈 통과를 막는다 — 묶음이 하나도 없으면 아래 감지기가 전부 초록이다. */
    it('탭 묶음이 있다 — 아래 불변식이 무언가를 재고 있다', () => {
      expect(hubs.length).toBeGreaterThan(0);
    });

    /** 탭 하나짜리 묶음은 묶음이 아니다 — 오갈 곳이 없는 탭 막대가 화면 제목 위에 한 줄을 먹는다. */
    it('탭 묶음은 탭이 둘 이상이다', () => {
      expect(hubs.filter((hub) => hub.tabs.length < 2).map((hub) => hub.label)).toEqual([]);
    });

    /**
     * ⭐ **묶음 줄은 첫 탭으로 건다.** 다른 주소를 걸면 사이드바를 누른 사람이 탭 막대의 첫 탭이
     * 아닌 자리에 떨어지고, 그 주소가 탭에 없으면 탭 막대도 서지 않는다.
     */
    it('탭 묶음의 주소는 첫 탭의 주소다', () => {
      expect(
        hubs.filter((hub) => hub.to !== hub.tabs[0]?.to).map((hub) => `${hub.label} → ${hub.to}`),
      ).toEqual([]);
    });

    /**
     * ⛔ **한 주소는 사이드바 전체에서 한 번만 닿는다** — 줄로도 탭으로도. 같은 주소가 묶음의 탭이면서
     * 따로 한 줄로도 서면 두 줄이 동시에 켜지고, 탭 막대는 그 화면을 어느 묶음의 것으로 그릴지
     * 고를 수 없다(`layout.tsx` `findActiveHub` 는 처음 만난 묶음을 고른다).
     */
    it('사이드바 줄과 탭을 통틀어 주소가 겹치지 않는다', () => {
      const paths = [NAV_LEAD, ...rows].flatMap((entry) => navEntryPaths(entry));

      expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toEqual([]);
      /* 짝 양성 — 탭이 실제로 펼쳐져 줄 수보다 많다. */
      expect(paths.length).toBeGreaterThan(rows.length + 1);
    });

    /** 묶음 줄도 사람이 누르는 줄이다 — 이름·아이콘이 비면 무엇인지 알 수 없다. */
    it('탭 묶음 줄에 아이콘과 두 언어 이름이 있다', () => {
      expect(
        hubs.filter(
          (hub) => hub.icon.trim() === '' || hub.label.trim() === '' || hub.labelVi.trim() === '',
        ),
      ).toEqual([]);
    });

    /**
     * 묶음 이름은 탭 막대의 **접근명**이다(`hub-tabs.tsx` `<nav aria-label>`). 겹치면 보조기술이
     * 어느 묶음의 막대인지 가를 수 없고, 섹션 이름과 겹치면 `role="group"` 과 이름이 같아진다.
     */
    it('탭 묶음 이름이 서로와도, 섹션 이름과도 겹치지 않는다', () => {
      const names = [...hubs.map((hub) => hub.label), ...NAV_GROUPS.map((group) => group.label)];

      expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
    });

    /** 한 막대 안에서 탭 이름이 겹치면 어느 탭이 어느 화면인지 읽을 수 없다. */
    it('한 묶음 안에서 탭 이름이 겹치지 않는다', () => {
      const clashes = hubs.flatMap((hub) => {
        const labels = hub.tabs.map((tab) => tab.label);

        return labels.filter((label, index) => labels.indexOf(label) !== index);
      });

      expect(clashes).toEqual([]);
    });

    /**
     * `NAV_ENTRIES` 는 묶음을 탭으로 펴서 담는다 — 묶음 자신은 빠지고 탭이 묶음의 자리·아이콘을
     * 물려받는다. 펴는 일을 놓치면 검색·화면 목록 대조가 탭 화면을 못 본다.
     */
    it('NAV_ENTRIES 는 묶음 대신 그 탭들을 묶음의 자리에 묶음의 아이콘으로 담는다', () => {
      const expected = [NAV_LEAD, ...rows].flatMap((entry) =>
        navEntryPaths(entry).map((path) => `${path} → ${entry.icon}`),
      );

      expect(allEntries.map((entry) => `${entry.to} → ${entry.icon}`)).toEqual(expected);
      expect(allEntries.some((entry) => entry.tabs !== undefined)).toBe(false);
    });
  });

  it('navEntryPaths — 묶음이면 탭 주소 전부, 아니면 자기 주소 하나', () => {
    expect(navEntryPaths({ to: '/a', icon: 'x', label: '가', labelVi: 'A' })).toEqual(['/a']);
    expect(
      navEntryPaths({
        to: '/b',
        icon: 'x',
        label: '나',
        labelVi: 'B',
        tabs: [
          { to: '/b', label: '다', labelVi: 'C' },
          { to: '/c', label: '라', labelVi: 'D' },
        ],
      }),
    ).toEqual(['/b', '/c']);
  });

  /**
   * 아이콘의 **회귀 그물**(#1079 검토).
   *
   * ⚠ **이 값들을 재는 곳이 저장소에 없었다.** 전수 순서 감지기는 `href` 만 재고 섹션별 감지기는
   * 이름만 잰다 — 아이콘 둘을 맞바꿔도 전부 초록이었다. 그래서 여기서 얼린다.
   *
   * ⭐ **탭 묶음의 탭은 묶음의 아이콘을 물려받는다**(`NAV_ENTRIES` — 레일·검색 결과에서 같은
   * 아이콘으로 선다). 그래서 한 묶음의 탭들은 같은 아이콘이 이어진다.
   *
   * 아이콘을 **바꾸는 것 자체는 자유다** — 바꿀 때 이 목록을 함께 고치면 된다. 막는 것은
   * 「모르는 채로 바뀌는 것」이다.
   */
  it('항목마다 정해진 아이콘을 쓴다', () => {
    expect(allEntries.map((entry) => `${entry.to} → ${entry.icon}`)).toEqual([
      '/dashboard → dashboard',
      '/logistics/inbound-schedule → local_shipping',
      '/logistics/over-receipt-split → local_shipping',
      '/logistics/goods-receipt → local_shipping',
      '/logistics/stock-status → inventory',
      '/logistics/stocktaking → inventory',
      '/logistics/stock-adjust → inventory',
      '/production/material-issue-requests → outbox',
      '/logistics/supplier-return → outbox',
      '/logistics/disposal-issue → outbox',
      '/logistics/document-progress → manage_search',
      '/logistics/iqc-inspection → troubleshoot',
      '/logistics/iqc-skip-approval → approval',
      '/quality/pqc-inspections → fact_check',
      '/shipment/oqc-inspection → local_shipping',
      '/master-data/inspection-standard → rule_settings',
      '/master-data/inspection-sheet-template → checklist',
      '/master-data/defect-cause-code → rule',
      '/master-data/judgment-code → rule',
      '/quality/inspection-results → analytics',
      '/quality/inspection-sheets → assignment',
      '/quality/lot-status → history',
      '/quality/lot-status-transition → history',
      '/quality/suspicious-material-hold → report_problem',
      '/quality/approvals → approval',
      '/quality/dispositions → gavel',
      '/quality/inspection-levels → tune',
      '/production/production-orders → account_tree',
      '/production/po-change-review → account_tree',
      '/production/emergency-work-orders → bolt',
      '/production/work-order-progress → monitoring',
      '/production/work-order-close → archive',
      '/shipment/shipment-request-create → assignment',
      '/shipment/shipment-schedule → event_note',
      '/shipment/shipment-processing → outbound',
      '/shipment/expedited-shipment → outbound',
      '/shipment/shipment-confirm → task_alt',
      '/shipment/return-receipts → keyboard_return',
      '/shipment/disposition-requests → keyboard_return',
      '/shipment/stock-reinstatements → keyboard_return',
      '/shipment/product-disposal-request → keyboard_return',
      '/approval/inbox → inbox',
      '/notification/center → notifications',
      '/notification/notices → campaign',
      '/master-data/item-extended-attrs → category',
      '/master-data/routing → account_tree',
      '/equipment/master → precision_manufacturing',
      '/equipment/work-calendar → precision_manufacturing',
      '/equipment/collection-channels → precision_manufacturing',
      '/equipment/tool-master → handyman',
      '/equipment/shot-conversion → handyman',
      '/equipment/gauge-master → straighten',
      '/equipment/gauge-calibration → straighten',
      '/master-data/warehouse-location → warehouse',
      '/master-data/putaway-rule → warehouse',
      '/master-data/warehouse-layout → warehouse',
      '/master-data/master-change → history',
      '/equipment/failures → build',
      '/equipment/maintenance-orders → build',
      '/equipment/maintenance-results → build',
      '/equipment/tool-pm-order → schedule',
      '/equipment/tool-pm-result → schedule',
      '/equipment/downtime-summary → timelapse',
      '/master-data/integration-sync → sync_alt',
      '/system/erp-data/common-codes → sync_alt',
      '/system/erp-data/employees → sync_alt',
      '/system/erp-data/items → sync_alt',
      '/system/erp-data/partners → sync_alt',
      '/system/erp-data/boms → sync_alt',
      '/system/erp-data/purchase-orders → sync_alt',
      '/system/erp-data/sales-orders → sync_alt',
      '/system/erp-data/production-orders → sync_alt',
      '/system/users-roles → manage_accounts',
      '/system/approval-route → approval',
      '/notification/recipient-settings → notifications_active',
      '/notification/zalo-connection → link',
      '/notification/dispatch-history → history',
      '/master-data/common-code → list_alt',
      '/system/terminal-process-map → tablet_android',
    ]);
  });
});
