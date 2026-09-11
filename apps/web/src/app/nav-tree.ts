/**
 * 관리웹 주 메뉴의 **차례와 묶음** — 셸이 그대로 읽어 그린다.
 *
 * ⭐ **JSX 가 아니라 데이터다.** 항목이 69개·묶음이 9개인데 화면 검색과 섹션 접기는 이 목록을
 * **훑어야** 하고, 트리가 JSX 로만 있으면 훑을 대상이 없다(#1079). 그리는 일은 `layout.tsx`가,
 * 무엇을 어느 차례로 그릴지는 이 파일이 갖는다.
 *
 * ⭐ **항목마다 적힌 배치 근거가 이 파일의 본체다.** 차례는 업무 순서이거나 분류이고, 그 판단의
 * 이유가 사라지면 다음 사람이 「보기 좋은 순서」로 다시 섞는다. 항목을 더하거나 옮길 때는
 * **왜 그 자리인지**를 같은 자리에 적는다.
 *
 * ⛔ **여기에 조건을 들이지 않는다.** 권한·기능 토글로 항목을 감추는 일이 생기면 그 판단은 읽는
 * 쪽이 지고, 이 파일은 「있는 화면 전부」를 차례대로 적은 목록으로 남는다 — 조건이 섞이면
 * 「왜 안 보이나」를 두 파일에서 찾게 된다.
 *
 * ⛔ **라벨을 `@omf-mes/i18n` 으로 옮기지 않는다.** 이 문구들은 화면 **이름**이라, 옮기면 차례와
 * 이름이 두 파일로 갈려 배치 근거 주석이 이름에서 멀어진다. 셸이 `messages` 에서 가져오는 것은
 * 로그아웃 같은 **동작** 문구뿐이고 그 경계를 여기서 넘지 않는다.
 */

/** 메뉴 항목 하나 — 주소 · 아이콘(Material Symbols 리가처) · 보이는 이름. */
export interface NavEntry {
  readonly to: string;
  readonly icon: string;
  readonly label: string;
}

/** 이름 붙은 업무 묶음. 섹션 라벨은 DS 가 `role="group"` 의 접근명으로도 쓴다. */
export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavEntry[];
}

/**
 * 묶음에 속하지 않는 맨 위 한 항목.
 *
 * ⛔ **둘로 늘리지 않는다.** 섹션 밖 항목은 DS 에서 목록의 직계 flex 자식이 되어 배치 보정이
 * 따로 필요하고(`layout.tsx` 의 `.sidebar-lead` · #1077), 늘어나면 그 보정을 빠뜨린 항목이
 * 생긴다. 둘째가 필요해지는 날은 **그 둘이 묶음인지**를 먼저 묻는다. 배열이 아니라 항목 하나인
 * 것도 그래서다 — 배열이면 둘째가 조용히 들어온다.
 */

/*
 * W-CO-05 — **맨 위이고 섹션이 없다.** 이 화면은 어느 업무 묶음에도 속하지 않고
 * 모든 묶음의 숫자를 모아 보인다. 「기준정보」 아래에 넣으면 마스터 관리 화면들
 * 사이에 서서 분류가 무너지고, 자기 섹션을 하나 만들면 항목 하나짜리 섹션이 생겨
 * 제목이 항목보다 무거워진다.
 */
export const NAV_LEAD: NavEntry = { to: '/dashboard', icon: 'dashboard', label: '통합 대시보드' };

/** 묶음들 — **배열 순서가 사이드바 순서다.** */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: '기준정보',
    items: [
      { to: '/master-data/warehouse-location', icon: 'warehouse', label: '창고·Location' },
      /*
       * W-06-14 — **창고·Location 바로 뒤다.** 적치 규칙은 창고와 위치를 참조해야
       * 성립하고 그 마스터에서 이어지는 화면이라, 인접이 관계를 드러낸다. 계약 경로는
       * `/logistics/**`이지만 주소 앞머리는 **이 섹션을 따른다** — 어디에 둘지 미리
       * 정해 두는 일이라 물건이 오가는 「자재창고」가 아니라 기준정보다.
       */
      { to: '/master-data/putaway-rule', icon: 'shelves', label: '적치 규칙' },
      /*
       * W-CO-08 — 창고 계열의 끝에 둔다. 창고·Location 이 만든 위치를 여기서 도면에
       * 얹으므로 그 뒤이고, 적치 규칙과 창고·Location 의 인접은 흔들지 않는다.
       */
      { to: '/master-data/warehouse-layout', icon: 'map', label: '창고 배치도' },
      { to: '/master-data/routing', icon: 'account_tree', label: 'Routing(공정)' },
      { to: '/master-data/inspection-standard', icon: 'fact_check', label: '검사기준' },
      { to: '/master-data/defect-cause-code', icon: 'rule', label: '불량·원인코드' },
      { to: '/master-data/common-code', icon: 'list_alt', label: '공통코드·조직·작업자' },
      /* 같은 코드값 편집기를 여는 화면이라 공통코드 바로 뒤에 둔다 — 인접이 관계를 드러낸다. */
      { to: '/master-data/judgment-code', icon: 'verified', label: '판정유형 코드' },
      { to: '/master-data/integration-sync', icon: 'sync_alt', label: '연계 동기화 현황' },
      { to: '/master-data/item-extended-attrs', icon: 'inventory_2', label: '품목 확장속성' },
      /* 특정 마스터에 속하지 않는 횡단 조회라 마스터 항목들 뒤에 둔다. */
      { to: '/master-data/master-change', icon: 'history', label: '마스터 변경관리' },
    ],
  },
  /*
   * 입하 예정은 기준정보도 시스템 운영도 아닌 **현장 물류**다 —
   * 도메인 01(자재창고)의 첫 화면이고, 뒤따르는 W-01 화면들이 이 섹션에 들어온다.
   */
  {
    label: '자재창고',
    items: [
      { to: '/logistics/inbound-schedule', icon: 'local_shipping', label: '입하 예정 조회' },
      /*
       * W-01-03 — **차례가 업무 순서다.** 도착 예정을 보고(입하 예정) 도착을 처리한 뒤
       * (초과 입하 분리) 그 결과를 재고에서 확인한다. 이 도메인의 첫 쓰기 화면이다.
       */
      { to: '/logistics/over-receipt-split', icon: 'call_split', label: '초과 입하 분리' },
      /*
       * W-01-01 — **차례가 업무 순서다.** 도착을 처리한 뒤(초과 입하 분리) 받아들여도
       * 되는지를 먼저 판정하고, 그 다음 창고로 받아들인다(정상품 입하 처리).
       *
       * ⛔ **「품질」 섹션을 새로 만들지 않는다.** 통합 IA 가 이 화면을 「자재/창고 >
       * 입하·검사」에 두었고 형제 화면(W-01-02)이 이미 이 섹션에 있다.
       */
      { to: '/logistics/iqc-inspection', icon: 'troubleshoot', label: 'IQC 수입검사·판정' },
      /*
       * W-01-10 — **차례가 업무 순서다.** 도착을 처리한 뒤(초과 입하 분리) 창고로
       * 받아들이고(정상품 입하 처리) 그 결과를 재고에서 확인한다.
       */
      { to: '/logistics/goods-receipt', icon: 'inventory_2', label: '정상품 입하 처리' },
      /*
       * W-01-07 — 같은 도메인이라 **섹션을 새로 만들지 않는다.** 계약 경로가
       * `/inventory/**`·`/trace/**`이지만 주소 앞머리는 이 섹션을 따른다.
       */
      { to: '/logistics/stock-status', icon: 'inventory', label: '재고 현황·상태 조회' },
      /*
       * W-01-04 — **차례가 업무 순서다.** 예정을 보고 · 도착을 처리하고 · 창고로
       * 받아들이고 · 재고를 확인한 뒤 **장부와 실물을 맞춘다.** 실사가 그 끝에 서는
       * 것은 앞의 넷이 남긴 결과를 대상으로 삼기 때문이다.
       */
      { to: '/logistics/stocktaking', icon: 'checklist', label: '재고실사' },
      /*
       * W-01-12 — **차례가 업무 순서다.** 재고를 확인하고(재고 현황) 장부와 실물을
       * 맞춘 뒤(재고실사) **어긋난 것을 고친다.** 실사 바로 뒤가 그 자리이며, 반품·폐기보다
       * 앞이다 — 저 둘은 물건을 내보내는 일이고 이것은 장부를 실물에 맞추는 일이다.
       *
       * **메뉴에 둔다**(W-01-11과 갈리는 자리). 그쪽은 맥락 없는 진입이 곧 요구사항 위반이라
       * 라우트만 열었는데, 이 화면은 세 원천 중 **직접 등록**이 다른 화면을 거치지 않고
       * 들어오는 정상 경로다(착수 이슈 §6). 재고실사 마감 결과의 링크는 그 위의 한 갈래일 뿐이다.
       */
      { to: '/logistics/stock-adjust', icon: 'tune', label: '재고조정' },
      /*
       * W-01-05 — **차례가 업무 순서다.** 예정 → 도착 → 입고 → 재고 확인 → 실사 뒤에
       * **되돌려 보내기**가 선다. 반품은 앞의 다섯이 남긴 결과(입고된 자재)를 대상으로
       * 삼으므로 그것들보다 앞에 둘 자리가 없다.
       */
      { to: '/logistics/supplier-return', icon: 'assignment_return', label: '공급사 반품 처리' },
      /*
       * W-01-06 — **차례가 업무 순서다.** 예정 → 초과 분리 → 입고 → 재고 확인 → 실사 →
       * 반품 뒤에 **폐기**가 선다. 못 쓰게 된 자재를 장부에서 덜어내는 일이라 앞의 여섯이
       * 남긴 결과를 대상으로 삼고, 그것들보다 앞에 둘 자리가 없다.
       *
       * **승인 성격의 화면(긴급 IQC 생략)보다는 앞이다** — 이 화면은 물건이 오가는 흐름의
       * 한 갈래이고, 그 뒤엣것은 흐름 위에서 예외를 허가하는 일이라 축이 다르다.
       */
      { to: '/logistics/disposal-issue', icon: 'delete_forever', label: '폐기 품의·기타출고' },
      /*
       * W-01-02 — **자재창고 업무의 승인 자리**다. 결재라는 일 때문에 「승인」 섹션이
       * 떠오르지만, 이 화면이 판정하는 것은 **자재 입하 검사를 생략할 것인가**이고
       * 그 판단의 맥락(입하·재고·입고)이 이 섹션에 다 있다. 설계 스펙의 breadcrumb도
       * 「자재창고」다 — 결재함은 **올라온 결재를 두루 처리하는 자리**라 축이 다르다.
       *
       * **기존 항목 뒤에 둔다.** 앞의 여섯이 물건이 오가는 순서이고, 이것은 그 흐름
       * 위에서 예외를 허가하는 일이라 순서에 끼워 넣을 자리가 없다.
       */
      { to: '/logistics/iqc-skip-approval', icon: 'approval', label: '긴급 IQC 생략 한도승인' },
      /*
       * W-01-13 — **섹션 맨 뒤다.** 앞의 여덟이 물건이 오가는 순서이고(예정 → 초과 분리 →
       * 입고 → 재고 확인 → 실사 → 조정 → 반품 → 폐기) 「긴급 IQC 생략」이 그 흐름 위에서
       * 예외를 허가하는 자리인데, 이 화면은 그 흐름이 **남긴 문서들을 가로질러 보고
       * 되돌리는** 일이라 순서에 끼워 넣을 자리가 없다. 기준정보의 「마스터 변경관리」가
       * 같은 이유(횡단 조회)로 마스터 항목들 뒤에 섰다.
       *
       * ⛔ **「승인」 섹션이 아니다.** 취소가 승인을 타지만 이 화면이 하는 일은 결재가
       * 아니라 **상신과 실행**이다 — 결재함은 올라온 결재를 두루 처리하는 자리라 축이
       * 다르다(W-01-02가 같은 자리에서 같은 판정을 했다).
       *
       * **다섯 PR이 함께 여는 자리다.** 목록·상세·취소 요청·승인 진행·취소 실행이 다 서기
       * 전에는 이 항목을 두지 않았다 — 취소는 반드시 승인을 타는데 실행할 자리가 없으면
       * 사용자가 **승인을 받아 놓고 아무것도 할 수 없다**(정책 §5.2 — 접근 불가능한 경계).
       */
      {
        to: '/logistics/document-progress',
        icon: 'manage_search',
        label: '물류 문서 진행현황·취소',
      },
    ],
  },
  /*
   * W-04-02 — **출하(도메인 04)의 첫 화면이고 그래서 새 섹션을 연다.** 착수 이슈 §1의
   * IA 위치가 「관리웹 > 출하 > 출하 지시·확정」이라 「자재창고」에 넣지 않는다 —
   * 입고 중심의 그 섹션과 축이 다르다. 자재창고 바로 뒤·생산 앞이다: 물류 흐름상
   * 입고를 처리한 뒤(자재창고) 출하를 다루고, 그 결과가 생산과는 독립이다.
   */
  {
    label: '출하',
    items: [
      /*
       * W-04-01 — 출하지시서 Import·작업지시 생성. 「출하 예정 목록」(W-04-02)이 먼저
       * 이 섹션을 열었으나, 업무 순서로는 지시서를 편성해야 예정이 생긴다 — 그래서
       * 목록보다 앞자리에 둔다.
       */
      {
        to: '/shipment/shipment-request-create',
        icon: 'assignment',
        label: '출하지시서 Import·작업지시 생성',
      },
      { to: '/shipment/shipment-schedule', icon: 'local_shipping', label: '출하 예정 목록' },
      /*
       * W-04-03 — 예정 목록에서 출하 대상이 정해진 뒤, 상차하기 «전»에 출하검사를 판정한다.
       * 그래서 예정 목록 뒤·출하 처리 앞이다: 편성 → 예정 → **OQC 판정** → 출하 처리.
       */
      { to: '/shipment/oqc-inspection', icon: 'fact_check', label: 'OQC 출하검사 판정' },
      /*
       * W-04-04 — 예정 목록(W-04-02)에서 피킹까지 끝난 후보를 상차·실물 출고 처리하므로
       * 그 바로 뒤에 둔다. 되돌릴 수 없는 쓰기(재고 차감·genealogy 종결)이지만 출하 자체는
       * 미확정 상태로 남는다 — 확정·취소는 W-04-12(미착수) 소관이다.
       */
      { to: '/shipment/shipment-processing', icon: 'outbound', label: '출하 처리(상차·실물 출고)' },
      /*
       * W-04-05 — 같은 출하 생성 경로를 쓰되 창고 경유·피킹·포장을 건너뛰는 예외 흐름이라
       * 정상 흐름 바로 뒤에 둔다. 앞에 두면 예외가 기본으로 읽힌다.
       */
      { to: '/shipment/expedited-shipment', icon: 'bolt', label: '긴급 직행 출하 처리' },
      /*
       * W-04-12 — 앞의 두 화면이 만든 미확정 출하를 확정·취소한다. 되돌릴 수 있는 구간이
       * 여기서 끝나므로 두 화면 뒤에 둔다.
       */
      { to: '/shipment/shipment-confirm', icon: 'task_alt', label: '출하 확정·취소' },
      /*
       * W-04-06 — 출하 섹션의 «반품·재고» 갈래 첫 화면이다. 확정된 출하는 취소되지 않고 여기로
       * 돌아오므로 확정·취소 바로 뒤에 둔다. 반품은 보류로 들어오고 판정은 다음 화면 몫이다.
       */
      { to: '/shipment/return-receipts', icon: 'keyboard_return', label: '반품·클레임 입고 등록' },
      /*
       * W-04-07 — 반품·재고 갈래의 둘째 화면이다. 앞 화면이 들인 반품과 불합격품의 판정을
       * 의뢰한다. 판정은 품질 화면 몫이고 여기서는 부적합 등록과 판정 의뢰까지다.
       */
      {
        to: '/shipment/disposition-requests',
        icon: 'assignment_return',
        label: '재작업/폐기 판정 의뢰',
      },
      /* W-04-11 — 판정이 끝난 반품 LOT을 원 LOT 그대로 판매 가능 재고로 되돌린다. */
      { to: '/shipment/stock-reinstatements', icon: 'move_to_inbox', label: '재고 재등록' },
      /*
       * W-04-10 — 처분 판정이 선행이고 결재를 타는 화면이라 출하 흐름 넷 뒤에 둔다.
       * 나가는 일이 아니라 «버리는» 일이다.
       */
      { to: '/shipment/product-disposal-request', icon: 'delete_sweep', label: '제품 폐기 요청' },
    ],
  },
  /* W-02-01 — 생산의 계획·지시 첫 화면이며 현재 생산 블록의 첫 항목으로 둔다. */
  {
    label: '생산',
    items: [
      { to: '/production/production-orders', icon: 'account_tree', label: 'P/O 수신·조회' },
      /*
       * W-02-06 — 받은 P/O 가 «바뀌었을 때» 판정하는 자리라 수신·조회 바로 뒤다.
       * 그 화면이 만든 목록 위에서 이어진다.
       */
      {
        to: '/production/po-change-review',
        icon: 'published_with_changes',
        label: 'P/O 변경 관리자 확인',
      },
      /* W-02-02 — 선택한 P/O를 계획·W/O로 전개하므로 조회 바로 뒤에 둔다. */
      { to: '/production/production-plans', icon: 'schema', label: 'W/O 전개·편성' },
      /* W-02-03 — 전개된 W/O의 4M 자원을 배정하므로 편성 바로 뒤에 둔다. */
      { to: '/production/work-order-assignments', icon: 'tune', label: '4M 자원배정·유효성 점검' },
      /* W-02-04 — 4M 배정을 통과한 W/O를 배포하므로 배정 뒤·마감 앞에 둔다. */
      {
        to: '/production/work-order-release',
        icon: 'rocket_launch',
        label: 'W/O 확정·배포·생산LOT 선발행',
      },
      /* W-02-05 — 같은 생산 섹션의 마감·모니터링 화면이다. */
      { to: '/production/work-order-close', icon: 'archive', label: 'W/O 마감·ERP 실적 송신' },
      /* W-02-07 — 계획을 거치지 않고 직접 발행한다. 갈래가 달라 정규 흐름 뒤에 둔다. */
      { to: '/production/emergency-work-orders', icon: 'bolt', label: '긴급 W/O 발행' },
      /* W-02-10 — 긴급 W/O 의 부족 자재를 정식 출고로 경유시킨다. 긴급 발행 바로 뒤가 흐름이다. */
      {
        to: '/production/material-issue-requests',
        icon: 'playlist_add',
        label: '추가 자재 출고 요청',
      },
      /* W-02-08 — 발행한 W/O 가 지금 어디까지 왔는지 본다. 만드는 화면들 뒤, 조회 자리다. */
      { to: '/production/work-order-progress', icon: 'monitoring', label: 'W/O 진행현황 조회' },
    ],
  },
  /*
   * W-03-01 — Lot Status 계열의 첫 화면이 독립된 「품질관리」 섹션을 연다.
   * IQC 수입검사는 입하 흐름의 판정이라 자재창고에 남고, 여기서는
   * 자재·생산 LOT의 상태와 보류 사건을 품질 관점에서 횡단한다.
   */
  {
    label: '품질관리',
    items: [
      { to: '/quality/lot-status', icon: 'history', label: 'Lot Status 현황·변경이력 조회' },
      /* W-03-02 — 현황에서 찾은 LOT을 판정·전이하므로 W-03-01 바로 뒤에 둔다. */
      {
        to: '/quality/lot-status-transition',
        icon: 'published_with_changes',
        label: 'Lot Status 판정·전이 처리',
      },
      /* W-03-03 — 판정할 의심 LOT을 먼저 보류하므로 W-03-02 바로 뒤에 둔다. */
      { to: '/quality/suspicious-material-hold', icon: 'report_problem', label: '의심자재 등록' },
      /* W-03-05 — 보류 등록 뒤에 검사 결과를 조회하고, 승인 처리 전에 판단 근거를 본다. */
      { to: '/quality/inspection-results', icon: 'analytics', label: '검사실적·검사결과 조회' },
      /* W-03-09 — Lot Status 조회·판정·의심자재 등록 다음에 서는 품질 승인 화면이다. */
      { to: '/quality/approvals', icon: 'approval', label: '특채·한도승인 승인 처리' },
      /* W-03-10 — 승인 처리 다음이다. 여기서 정한 처분이 폐기·재등록·재작업 화면의 진입을 연다. */
      { to: '/quality/dispositions', icon: 'gavel', label: '처분 판정 처리' },
    ],
  },
  /*
   * W-05-12 — **도메인 05(설비/툴)의 첫 섹션이다.** 통합 IA 의 최상위 그룹이며,
   * 뒤따르는 W-05 화면들(툴 마스터·계측기·작업 캘린더·수집 채널…)이 여기 들어온다.
   *
   * **자재창고 뒤·승인 앞이다** — 업무 도메인 섹션들을 붙여 두고, 그 위를 가로지르는
   * 것(승인·알림)과 운영 설정(시스템 관리)을 끝에 남긴다. 자재창고가 도메인 01,
   * 이것이 도메인 05라 번호 차례이기도 하다.
   *
   * 주소 앞머리는 `/equipment` 다 — 계약 경로(`/mdm/**`)가 아니라 이 섹션을 따른다.
   */
  {
    label: '설비/툴',
    items: [
      { to: '/equipment/master', icon: 'precision_manufacturing', label: '설비·설비그룹 마스터' },
      /*
       * W-05-13 — 설비 **다음**이다. 이 섹션의 주어가 설비이고 툴은 그 옆 축이라,
       * 한정어 없는 이름(설비 마스터)이 먼저 서고 자기 이름을 붙인 것들이 뒤따른다.
       * 화면 번호 차례(12 → 13)이기도 하다.
       */
      { to: '/equipment/tool-master', icon: 'handyman', label: '툴/금형/지그 마스터' },
      /*
       * W-05-09 — 마스터 셋 **뒤**다. 앞의 둘이 「무엇이 있는가」를 정하고 이것은
       * 「언제 도는가」를 정한다 — 대상이 있어야 달력을 붙일 자리가 생긴다.
       */
      { to: '/equipment/work-calendar', icon: 'calendar_month', label: '작업 캘린더 설정' },
      /*
       * W-05-07 — 섹션 **맨 뒤**다. 앞의 셋이 「무엇이 있고 언제 도는가」를 정하고,
       * 이것은 그 설비가 **보내오는 것을 어디에 담을지**를 정한다 — 설비가 먼저 있어야
       * 채널을 붙일 자리가 생긴다.
       *
       * IA 는 이 화면을 「설비/툴 > 비가동·계측」 아래 두었으나, 그 하위 묶음은 아직
       * 이 화면 하나뿐이라 **묶음을 만들지 않는다** — 항목 하나짜리 묶음은 층만 늘리고
       * 찾는 길을 길게 한다. 형제(W-05-06·W-05-08)가 서면 그때 묶는다.
       */
      { to: '/equipment/collection-channels', icon: 'sensors', label: '수집 채널 매핑 관리' },
      /*
       * W-05-01 — 섹션 **맨 뒤**다. 앞의 넷이 「무엇이 있고 언제 도는가」와 「무엇을
       * 받는가」를 정하고, 이것은 **받은 것을 어떻게 세는가**를 정한다 — 세는 규칙은
       * 셀 대상이 다 선 뒤에 온다.
       *
       * ⭐ **툴 마스터와 짝이다** — 캐비티 수는 그쪽이 갖고 비율은 여기가 갖는다.
       * 두 화면이 한 계산의 입력을 나눠 갖는다.
       */
      { to: '/equipment/shot-conversion', icon: 'calculate', label: '타발수 환산 파라미터 설정' },
      /*
       * W-05-11 — **섹션 맨 뒤다.** 라우트는 진작 열려 있었고 메뉴만 미뤄 두었던
       * 화면이라(설계 질의 `omf-mes#195`), 형제들이 자리를 잡은 뒤에 붙는다.
       *
       * ⭐ **미루던 이유가 없어졌다** — 유형 값 목록이 확정돼(회신 · 시드 `omf-mes#182`)
       * 사용자가 실제로 계측기만 골라 볼 수 있으므로 「계측기 마스터」라는 이름이
       * 더는 거짓이 아니다.
       */
      { to: '/equipment/gauge-master', icon: 'straighten', label: '계측기 마스터 관리' },
      /*
       * W-05-10 — **계측기 마스터 바로 뒤다.** 이력은 그 마스터가 있어야 적을 수 있고,
       * 인접이 그 관계를 드러낸다. 비가동 집계보다 앞인 것은 이쪽이 계측기라는 같은
       * 대상을 다루기 때문이다.
       */
      { to: '/equipment/gauge-calibration', icon: 'event_available', label: '계측기 검교정 이력' },
      /*
       * W-05-04 — 마스터·이력 뒤, 집계 앞이다. 고장 처리는 **일하는 화면**이라 정해 두는
       * 화면들과 결과를 보는 화면 사이에 선다.
       */
      { to: '/equipment/failures', icon: 'build', label: '설비고장 상세처리' },
      /*
       * W-05-05 — **고장 처리 바로 뒤다.** 고장이 트리거의 한 원천이라 앞선 화면이 만든
       * 것을 이 화면이 묶는다.
       */
      { to: '/equipment/maintenance-orders', icon: 'assignment', label: '보전지시 발행' },
      /* W-05-06 — 지시가 이 실적의 대상이라 발행 바로 뒤다. */
      { to: '/equipment/maintenance-results', icon: 'task_alt', label: '보전 실적·예비품' },
      /* W-05-02 — 설비 보전 실적 뒤다. 「설비 보전 → 툴 보전」 차례를 만든다. */
      { to: '/equipment/tool-pm-order', icon: 'schedule', label: '툴 보전오더 생성' },
      /* W-05-03 — 오더 생성 바로 뒤다. 오더가 이 실적의 대상이다. */
      { to: '/equipment/tool-pm-result', icon: 'restart_alt', label: '툴 PM 실적 등록' },
      /*
       * W-05-08 — 마스터·설정 항목들 **뒤**다. 앞의 것들은 설비를 어떻게 다룰지 정해 두는
       * 자리이고 이것은 그렇게 돌아간 결과를 보는 자리라, 정하는 것과 보는 것을 섞지 않는다.
       */
      { to: '/equipment/downtime-summary', icon: 'timelapse', label: '비가동 집계 조회' },
    ],
  },
  /*
   * W-CO-09 — 결재함은 기준정보도 시스템 운영도 아니라 **일하는 자리**다.
   * 결재선 정의(W-06-15)가 「시스템 관리」에 든 것은 그것이 **운영 설정**이기
   * 때문이고, 올라온 결재를 처리하는 일은 그것과 축이 다르다.
   *
   * **자재창고 뒤·시스템 관리 앞이다** — 업무를 하는 섹션들을 붙여 두고 운영 설정을
   * 끝에 남긴다. 뒤따르는 승인 화면들이 이 섹션에 들어온다.
   */
  {
    label: '승인',
    items: [{ to: '/approval/inbox', icon: 'inbox', label: '결재함' }],
  },
  /*
   * W-CO-03 — **알림은 자기 섹션을 갖는다.** 설계의 IA가 「시스템/공통 > 알림」으로
   * 별도 그룹을 두었고, 뒤따르는 알람 수신자 설정·공지가 이 섹션에 들어온다 —
   * 지금 열어 두면 그 둘이 항목 한 줄씩만 더한다.
   *
   * ⛔ **「시스템 관리」에 넣지 않는다.** 그 섹션은 **관리자가 남을 설정하는 자리**인데
   * (사용자·역할·권한 · 결재선 정의) 알림센터는 **누구나 자기가 받은 것을 보는 자리**다.
   * 뒤의 둘까지 들어오면 그 섹션이 성격이 다른 다섯을 담게 된다.
   *
   * **승인 뒤·시스템 관리 앞이다** — 일하는 섹션들을 붙여 두고 운영 설정을 끝에 남긴다
   * (「승인」 섹션이 같은 이유로 그 자리에 섰다).
   *
   * ⛔ **상단 바에 종 배지를 만들지 않는다**(결정 ②). 배지는 셸의 책임이고 갱신 주기가
   * 아직 정해지지 않았다 — 요청이 하나도 없는 이 파일에 조회를 들이면 **모든 화면이**
   * 라우트 전환마다 그 요청을 지고, 미인증 실패가 전 화면의 상단 바에 나타난다.
   */
  {
    label: '알림',
    items: [
      { to: '/notification/center', icon: 'notifications', label: '알림센터' },
      {
        to: '/notification/recipient-settings',
        icon: 'notifications_active',
        label: '알람 수신자 설정',
      },
      /* W-CO-04 — 알림센터가 받는 자리이고 이쪽이 보내는 자리다. */
      { to: '/notification/notices', icon: 'campaign', label: '공지·전달' },
    ],
  },
  /*
   * 사용자·역할·권한은 기준정보가 아니라 **시스템 운영**이다 —
   * 기준정보 섹션에 넣으면 「창고·Location」 옆에 서서 분류가 무너진다.
   */
  {
    label: '시스템 관리',
    items: [
      { to: '/system/users-roles', icon: 'manage_accounts', label: '사용자·역할·권한' },
      /*
       * W-06-15 — **차례가 순서다.** 승인자를 정할 수 있게 된 다음에 결재선을 세운다.
       * 결재선은 마스터이지만 업무 기준정보가 아니라 운영 설정이라 이 섹션에 든다.
       */
      { to: '/system/approval-route', icon: 'approval', label: '결재선 정의' },
      /* W-CO-06 — 단말은 시스템 관리의 자원이다. */
      { to: '/system/terminal-process-map', icon: 'tablet_android', label: '단말기-공정 매핑' },
      /*
       * W-CO-10 — **섹션 맨 끝이다.** 앞의 둘은 관리자가 남을 설정하는 자리이고 이것은
       * 누구나 자기 것을 바꾸는 자리라, 앞의 순서(권한 → 결재선)를 흔들지 않고 뒤에 붙인다.
       *
       * ⛔ **메뉴 권한이 붙어도 이 항목은 감추지 않는다.** 지금은 권한에 따른 감춤이 없어
       * 문제가 드러나지 않지만, 감추는 날 비밀번호를 바꿀 길이 사라지는 것은 **관리자가 아닌
       * 모든 사용자**다. 같은 사실을 `routes/index.tsx`와 `docs/decisions.md`에 함께 적었다.
       */
      { to: '/system/password-change', icon: 'password', label: '비밀번호 변경' },
    ],
  },
];
