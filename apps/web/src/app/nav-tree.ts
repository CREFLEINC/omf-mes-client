/**
 * 관리웹 주 메뉴의 **차례와 묶음** — 셸이 그대로 읽어 그린다.
 *
 * ⭐ **JSX 가 아니라 데이터다.** 사이드바 항목이 44개(탭을 펴면 화면 75개)·묶음이 8개인데 화면 검색과 섹션 접기는 이 목록을
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
 *
 * ⭐ **베트남어도 그래서 여기 있다**(`labelVi` · #1113). 이름을 옮기는 일과 이름을 번역하는 일은
 * 같은 자리에서 일어나야 한다 — 사전을 따로 두면 항목을 더한 사람이 번역을 빠뜨리고, 그 빠짐은
 * 이름을 읽는 쪽에서만 드러난다. 새 항목은 `label` 과 `labelVi` 를 **함께** 적는다.
 */

import type { LocalizedLabel } from '../patterns/localized-label';

/**
 * 탭 묶음 안의 화면 하나 — 주소와 두 언어의 탭 이름. 아이콘은 묶음의 것을 쓴다.
 *
 * 탭 이름은 **그 화면의 원래 메뉴 이름**이다. 화면 제목·브레드크럼·검색이 같은 말을 해야
 * 사람이 「이 탭이 그 화면」임을 알아본다.
 */
export interface NavTab extends LocalizedLabel {
  readonly to: string;
}

/** 메뉴 항목 하나 — 주소 · 아이콘(Material Symbols 리가처) · 두 언어의 보이는 이름. */
export interface NavEntry extends LocalizedLabel {
  /** 탭 묶음이면 **첫 탭의 주소**다(`nav-tree.test.ts` 가 그 짝을 잰다). 권한으로 탭이 걸러지면 셸이 볼 수 있는 첫 탭으로 바꿔 건다. */
  readonly to: string;
  readonly icon: string;
  /**
   * 있으면 **탭 묶음**이다 — 짝을 이루는 화면 여럿을 사이드바 한 줄로 세우고, 본문 위의 탭
   * 막대로 오간다(`hub-tabs.tsx`). 탭 하나가 기존 화면 하나라 주소·화면 코드·권한은 탭마다
   * 그대로다. 탭은 둘 이상이다 — 하나뿐이면 묶음이 아니다.
   */
  readonly tabs?: readonly NavTab[];
  /**
   * 탭 막대를 본문 맨 위가 아니라 **화면 제목 아래**에 세운다 — 화면 머리가 묶음 이름을 제목으로 쓴다
   * (`patterns/page-hub.tsx`). 그 화면들이 `usePageHub` 로 자리를 받아야 한다.
   */
  readonly tabsInPage?: boolean;
  /** 탭 묶음의 탭을 **화면이 직접 그린다** — 셸 탭 막대를 세우지 않는다(사이드바 선택·권한은 묶음 그대로). */
  readonly inlineTabs?: true;
  /**
   * 이 화면이 **품은 옛 화면의 주소**(탭 없는 항목만). 그중 하나라도 볼 수 있으면 항목을 세운다 — 옛 화면 권한만 가진
   * 사람이 합친 뒤에 메뉴를 잃지 않게. 권한 코드가 아니라 주소다(코드는 `web-screen-catalog` 한 곳이 안다).
   */
  readonly alsoFor?: readonly string[];
}

/**
 * 이름 붙은 업무 묶음. 섹션 라벨은 DS 가 `role="group"` 의 접근명으로도 쓴다.
 *
 * ⚠ **묶음의 신원은 `label`(한국어) 이다.** 펼침 상태의 키도 「지금 보고 있는 묶음」 판정도 그
 * 값으로 도는데, 보이는 이름으로 돌면 **언어를 바꾸는 순간 열어 둔 묶음이 사라진다.** 언어에
 * 따라 갈리는 것은 **그리는 글자**뿐이다(`layout.tsx`).
 */
export interface NavGroup extends LocalizedLabel {
  /**
   * 묶음 손잡이의 아이콘(Material Symbols 리가처).
   *
   * ⭐ **아이콘은 묶음이 갖고 항목은 그리지 않는다.** 묶음 아래 항목들은 아이콘 없이 들여 써서
   * 세로 안내선으로 묶는다 — 아이콘이 일흔 개 서 있으면 눈이 아이콘을 훑느라 이름을 놓친다.
   * 항목의 `icon` 은 레일(아이콘 전용 폭)에서만 그린다.
   */
  readonly icon: string;
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
export const NAV_LEAD: NavEntry = {
  to: '/dashboard',
  icon: 'dashboard',
  label: '통합 대시보드',
  labelVi: 'Bảng điều khiển tổng hợp',
};

/**
 * 묶음들 — **배열 순서가 사이드바 순서다.**
 *
 * ⭐ **묶음의 뼈대는 「MES 메뉴 아키텍처」이고, 차례는 「매일 일하는 순서」다**(사용자 2026-10-20).
 * 매일 여는 업무 묶음(구매/자재 → 품질 → 생산 → 영업/출하)과 자기에게 온 것을 보는 업무함을
 * 앞에 두고, **정해 두고 가끔 여는 묶음**(기준정보 관리 → 설비 보전 관리 → 시스템 관리)을 뒤에
 * 둔다. 아키텍처는 기준정보를 맨 앞에 두었으나, 자주 열지 않는 마스터가 첫 줄을 차지하면 매일
 * 쓰는 묶음이 아래로 밀린다.
 *
 * ⭐ **짝을 이루는 화면은 탭 묶음 한 줄로 선다**(`tabs` · 사용자 2026-10-20). 같은 데이터를 나눠
 * 갖거나 한 흐름의 앞뒤인 화면들이고, 대부분 자주 열지 않는 설정·마스터라 한 줄씩 차지하면
 * 매일 쓰는 화면이 그 사이에 묻힌다. 탭 하나가 기존 화면 하나이므로 주소·화면 코드·권한은
 * 화면마다 그대로다.
 *
 * ⚠ **주소는 옮기지 않았다.** 항목이 묶음을 옮겨도 `to` 의 앞머리(`/equipment` · `/master-data`
 * …)는 그대로다 — 주소는 화면 코드·권한·북마크가 붙잡고 있는 열쇠이고 묶음은 보이는 자리일
 * 뿐이라, 묶음을 바꿀 때마다 주소를 바꾸면 그 셋이 함께 흔들린다.
 *
 * ⭐ **ERP 에서 받은 것을 보기만 하는 화면은 업무 묶음에 두지 않는다** — 「시스템 관리 > ERP
 * 연동 현황·이력」의 탭으로 모았다(사용자 2026-10-20). 업무 묶음에는 MES 가 일하는 화면만 선다.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  /*
   * 구매 / 자재 관리 — **입고 → 재고 → 출고 3축이다**(사용자 2026-10-20 · 1단계). 상용 MES·WMS 가
   * 자재를 나누는 축이고, 사이드바 한 줄이 「대상」 하나다(동작 이름은 탭으로 내렸다). 흐름이 남긴
   * 전표를 가로질러 보는 물류 전표 조회가 끝에 선다.
   *
   * ⚠ **입하와 입고를 가른다.** 입하는 «도착»이고 입고는 «창고로 받아들임»이다 — 아키텍처가
   * 둘을 따로 세웠다. 입고 처리(W-01-10)는 입고 관리 화면의 창이다. IQC 수입검사는 「품질 관리」에 있다 —
   * 입고 관리는 검사 단계를 보이기만 한다.
   *
   * ⭐ 2단계(입고 작업대 — 상태 탭 하나로 예정·입하·검사 대기·입고 대기를 오가는 한 화면)는 사용자가
   * 1단계를 써 본 뒤 정한다.
   */
  {
    label: '구매 / 자재 관리',
    labelVi: 'Quản lý mua hàng / vật tư',
    icon: 'inventory_2',
    items: [
      /*
       * 입고 관리 — 들어올 것(아직 다 들어오지 않은 P/O 라인)을 보고 → 도착한 것을 등록하고 → 창고로 받아들인다.
       * **화면 하나다**(W-01-09). 입하 등록(W-01-03) · 초과분 연결 · 입고 처리(W-01-10)는 그 화면의 오른쪽 창이 됐다
       * (사용자 지시 2026-10-21 「분리된 화면을 그 화면으로 차츰 모은다」 · 2026-10-23 탭 합치기). 옛 「자재 입고 처리」
       * 탭(입하 전표 기준)은 뺐다 — 발주 없이 들어오는 입하가 없어(사용자 확인 2026-10-23) 발주 기준 화면이 입하를 다 품는다.
       * 탭이 하나면 묶음이 아니라 탭을 두지 않는다 — 이름과 단계 칩은 화면이 제 막대에 세운다.
       */
      {
        to: '/logistics/inbound-schedule',
        icon: 'local_shipping',
        label: '입고 관리',
        labelVi: 'Quản lý nhập kho',
        /* 입하 등록(W-01-03) · 입고 처리(W-01-10)만 가진 사람도 이 화면에서 그 일을 한다. */
        alsoFor: ['/logistics/over-receipt-split', '/logistics/goods-receipt'],
      },
      /*
       * 재고 관리 — **가장 자주 여는 재고 현황이 첫 탭이다**(사이드바 한 번에 그 화면). 실사로 장부와
       * 실물을 맞추고, 어긋난 것을 조정으로 고친다. 조정은 직접 등록도 정상 경로라(착수 이슈 §6)
       * 탭으로 바로 연다.
       */
      {
        to: '/logistics/stock-status',
        icon: 'inventory',
        label: '재고 관리',
        labelVi: 'Quản lý tồn kho',
        tabs: [
          {
            to: '/logistics/stock-status',
            label: '재고 현황·상태 조회',
            labelVi: 'Tra cứu tồn kho · trạng thái',
          },
          { to: '/logistics/stocktaking', label: '재고실사', labelVi: 'Kiểm kê tồn kho' },
          { to: '/logistics/stock-adjust', label: '재고조정', labelVi: 'Điều chỉnh tồn kho' },
        ],
      },
      /*
       * 출고 관리 — 셋 다 **출고 전표를 만든다**: 생산으로 내보내고(자재 불출) · 공급사로 되돌려
       * 보내고(반품) · 장부에서 덜어낸다(폐기·기타출고).
       *
       * ⚠ **자재 불출 요청(W-02-10)은 생산 관리에서 옮겨 왔다**(사용자 2026-10-20). 요청하는 사람은
       * 생산 담당이지만 결과는 자재 출고이고, 아키텍처의 「자재 불출 / 재고 관리」 자리도 여기다.
       * 상용 제품도 불출을 자재 쪽에 둔다. 화면 이름도 「추가 자재 출고 요청」에서 「자재 불출 요청」
       * 으로 바꿨다 — 출고 관리 안에서 「출고」를 되풀이하지 않고, 생산으로 내보내는 출고임을 말한다.
       */
      {
        to: '/production/material-issue-requests',
        icon: 'outbox',
        label: '출고 관리',
        labelVi: 'Quản lý xuất kho',
        tabs: [
          {
            to: '/production/material-issue-requests',
            label: '자재 불출 요청',
            labelVi: 'Yêu cầu cấp phát vật tư',
          },
          {
            to: '/logistics/supplier-return',
            label: '공급사 반품 처리',
            labelVi: 'Xử lý trả hàng nhà cung cấp',
          },
          {
            to: '/logistics/disposal-issue',
            label: '폐기 품의·기타출고',
            labelVi: 'Đề nghị hủy · xuất khác',
          },
        ],
      },
      /*
       * W-01-13 — **섹션 맨 뒤다.** 입하·입고·출고·이동 전표를 가로질러 찾고 되돌리는 자리라 세 축
       * 어디에도 들지 않는다. 이름을 「물류 전표 조회·취소」로 바꿨다 — 「진행현황」보다 무엇을
       * 하는 곳인지(전표를 찾는다)가 먼저 읽힌다. 취소가 승인을 타지만 하는 일은 결재가 아니라
       * 상신과 실행이라 결재함이 아니다.
       */
      {
        to: '/logistics/document-progress',
        icon: 'manage_search',
        label: '물류 전표 조회·취소',
        labelVi: 'Tra cứu · hủy chứng từ logistics',
      },
    ],
  },
  /*
   * 품질 관리 — **독립 영역이다.** 검사를 IQC(입하) → PQC(공정) → OQC(출하) 흐름 차례로 세우고,
   * 검사기준·코드, 이력, 그리고 LOT 상태·보류·승인·처분의 판정 갈래가 뒤따른다.
   *
   * ⚠ IQC 는 자재 쪽에서, OQC 는 출하 쪽에서 옮겨 왔다 — 아키텍처가 검사를 업무 흐름이 아니라
   * 품질 한 곳에 모았다. 검사기준·불량코드·판정코드도 같은 이유로 기준정보에서 옮겼다.
   */
  {
    label: '품질 관리',
    labelVi: 'Quản lý chất lượng',
    icon: 'verified',
    items: [
      /*
       * 검사 조회·판정 — IQC · PQC · OQC 판정 화면을 사이드바 한 줄 · 본문 위 탭으로 묶는다(사용자 2026-10-26).
       * 탭 하나가 기존 화면 하나라 주소·권한·다른 화면에서 거는 연결은 그대로다.
       */
      {
        to: '/logistics/iqc-inspection',
        icon: 'troubleshoot',
        label: '검사 조회·판정',
        labelVi: 'Tra cứu · đánh giá kiểm tra',
        /* 제목(묶음 이름) 아래 탭 — 참고 화면 「품질 승인 처리」와 같은 모양(사용자 2026-10-26). */
        tabsInPage: true,
        tabs: [
          {
            to: '/logistics/iqc-inspection',
            label: 'IQC (수입검사)',
            labelVi: 'IQC (kiểm tra đầu vào)',
          },
          {
            to: '/quality/pqc-inspections',
            label: 'PQC (공정검사)',
            labelVi: 'PQC (kiểm tra công đoạn)',
          },
          {
            to: '/shipment/oqc-inspection',
            label: 'OQC (출하검사)',
            labelVi: 'OQC (kiểm tra xuất hàng)',
          },
        ],
      },
      {
        to: '/master-data/inspection-standard',
        icon: 'rule_settings',
        label: '검사기준',
        labelVi: 'Tiêu chuẩn kiểm tra',
      },
      /* W-06-24 — OA 제품 검사표의 모델별 단계·항목(omf-all-around#89). 검사기준 바로 뒤 — 같은 「기준」 갈래다. */
      {
        to: '/master-data/inspection-sheet-template',
        icon: 'checklist',
        label: '검사표 기준',
        labelVi: 'Tiêu chuẩn phiếu kiểm tra',
      },
      /* 품질 코드 — 불량·원인과 판정유형은 둘 다 판정에 붙이는 코드 마스터다. */
      {
        to: '/master-data/defect-cause-code',
        icon: 'rule',
        label: '품질 코드',
        labelVi: 'Mã chất lượng',
        tabs: [
          {
            to: '/master-data/defect-cause-code',
            label: '불량·원인코드',
            labelVi: 'Mã lỗi · nguyên nhân',
          },
          {
            to: '/master-data/judgment-code',
            label: '판정유형 코드',
            labelVi: 'Mã loại đánh giá',
          },
        ],
      },
      {
        to: '/quality/inspection-results',
        icon: 'analytics',
        label: '검사실적·검사결과 조회',
        labelVi: 'Tra cứu thực hiện · kết quả kiểm tra',
      },
      /* W-03-13 — OA 제품 검사표(시리얼별) 조회·서명(omf-all-around#89). 검사실적 조회 바로 뒤 — 같은 「조회」 갈래다. */
      {
        to: '/quality/inspection-sheets',
        icon: 'assignment',
        label: '제품 검사표 조회',
        labelVi: 'Tra cứu phiếu kiểm tra sản phẩm',
      },
      /* LOT 상태 — 조회에서 찾은 LOT 을 판정·전이한다. */
      {
        to: '/quality/lot-status',
        icon: 'history',
        label: 'LOT 상태',
        labelVi: 'Trạng thái LOT',
        tabs: [
          { to: '/quality/lot-status', label: 'LOT 상태 조회', labelVi: 'Tra cứu trạng thái LOT' },
          {
            to: '/quality/lot-status-transition',
            label: 'LOT 상태 판정',
            labelVi: 'Đánh giá trạng thái LOT',
          },
        ],
      },
      {
        to: '/quality/suspicious-material-hold',
        icon: 'report_problem',
        label: '의심자재 등록',
        labelVi: 'Đăng ký vật tư nghi ngờ',
      },
      /*
       * 품질 승인 처리 — 긴급 IQC 생략 한도승인(W-01-02)을 유형 탭 하나로 품는다(#144). 탭은 화면이 유형 탭
       * 줄에 직접 그린다(`inlineTabs`) — 셸 탭 막대까지 서면 탭 줄이 둘이 된다.
       */
      {
        to: '/quality/approvals',
        icon: 'approval',
        label: '품질 승인 처리',
        labelVi: 'Xử lý phê duyệt chất lượng',
        inlineTabs: true,
        tabs: [
          {
            to: '/quality/approvals',
            label: '품질 승인 처리',
            labelVi: 'Xử lý phê duyệt chất lượng',
          },
          {
            to: '/logistics/iqc-skip-approval',
            label: 'IQC (수입검사) 생략',
            labelVi: 'Bỏ qua IQC (kiểm tra đầu vào)',
          },
        ],
      },
      /* W-03-10 — 여기서 정한 처분이 폐기·재등록·재작업 화면의 진입을 연다. */
      {
        to: '/quality/dispositions',
        icon: 'gavel',
        label: '처분 판정 처리',
        labelVi: 'Ra quyết định xử lý',
      },
      /* W-03-12 — 품목별 IQC 검사 수준과 자동 전환 이력(omf-all-around#64). */
      {
        to: '/quality/inspection-levels',
        icon: 'tune',
        label: '검사 수준 관리',
        labelVi: 'Quản lý mức kiểm tra',
      },
    ],
  },
  /*
   * 생산 관리 — ERP W/O 를 받아 보고(바뀐 것은 같은 자리에서 확인) → MES W/O 로 확정·배포하고 →
   * (예외로 긴급 발행) → 진행을 보고 → 마감한다. 긴급 W/O 의 부족 자재는 「구매 / 자재 관리 > 출고
   * 관리」의 자재 불출 요청으로 잇는다.
   */
  {
    label: '생산 관리',
    labelVi: 'Quản lý sản xuất',
    icon: 'factory',
    items: [
      /*
       * ERP W/O — 받은 ERP W/O 를 보고, 그것이 «바뀌었을 때» 판정한다(W-02-06). 옛 이름의
       * 「P/O」는 서버 용어 정리로 구매오더만 뜻하게 되었다(서버 `CONTEXT.md` 「오더」 · #731 —
       * P/O = 구매오더 · ERP W/O = ERP 에서 받은 생산 오더 · 맨 「W/O」 = MES W/O). 「작업지시」·
       * 「생산오더」로 부르지 않는다.
       *
       * 「ERP W/O 처리」(W-02-01)는 작업함과 처리 화면이다. 옛 W-02-02(W/O 전개와 편성)와 W-02-03(4M 자원배정)은
       * 처리 화면의 단계로 합쳐 메뉴에도 탭에도 두지 않는다. 옛 주소는 `?productionOrderId=`, `?productionPlanId=`로
       * 대상을 찾아 처리 화면으로 넘긴다(`production-order/process/legacy-redirects.tsx`, omf-all-around#129).
       */
      {
        to: '/production/production-orders',
        icon: 'account_tree',
        label: 'ERP W/O',
        labelVi: 'ERP W/O',
        tabs: [
          {
            to: '/production/production-orders',
            label: 'ERP W/O 처리',
            labelVi: 'Xử lý ERP W/O',
          },
          {
            to: '/production/po-change-review',
            label: 'ERP W/O 변경 확인',
            labelVi: 'Xác nhận thay đổi ERP W/O',
          },
        ],
      },
      /*
       * W-02-04(W/O 확정, 배포)는 메뉴에서 뺐다. 배포는 「ERP W/O 처리」 작업함의 일괄 배포와 처리 화면 마지막 단계가
       * 맡는다(화면 구성 규범 C-17, T-W-C). 옛 주소는 작업함의 「자동 계획 완료」 조건으로 넘어간다.
       */
      /* W-02-07 — 계획을 거치지 않고 직접 발행한다. 갈래가 달라 정규 흐름 뒤에 둔다. */
      {
        to: '/production/emergency-work-orders',
        icon: 'bolt',
        label: '긴급 W/O 발행',
        labelVi: 'Phát hành W/O khẩn',
      },
      {
        to: '/production/work-order-progress',
        icon: 'monitoring',
        label: 'W/O 진행현황 조회',
        labelVi: 'Tra cứu tiến độ W/O',
      },
      /* W-02-05 — 진행을 본 뒤 닫는다. 생산 흐름의 끝이다. */
      {
        to: '/production/work-order-close',
        icon: 'archive',
        label: 'W/O 마감·ERP 실적 송신',
        labelVi: 'Đóng W/O · gửi kết quả sang ERP',
      },
    ],
  },
  /*
   * 영업 / 출하 관리 — 출하지시 편성 → 예정 → 출하 처리(정상·긴급 직행) → 확정·취소,
   * 그리고 확정된 출하가 되돌아오는 반품·클레임 갈래가 뒤따른다. OQC 판정은 「품질 관리」로 옮겼다.
   */
  {
    label: '영업 / 출하 관리',
    labelVi: 'Quản lý bán hàng / xuất hàng',
    icon: 'local_shipping',
    items: [
      {
        to: '/shipment/shipment-request-create',
        icon: 'assignment',
        label: '출하지시서 Import·작업지시 생성',
        labelVi: 'Import lệnh xuất hàng · tạo lệnh sản xuất',
      },
      {
        to: '/shipment/shipment-schedule',
        icon: 'event_note',
        label: '출하 예정 목록',
        labelVi: 'Danh sách kế hoạch xuất hàng',
      },
      /*
       * 출하 처리 — 정상 흐름(상차·실물 출고)과 창고 경유·피킹·포장을 건너뛰는 긴급 직행은 **같은
       * 출하 생성 경로**다. 정상을 첫 탭에 두어 예외가 기본으로 읽히지 않게 한다.
       */
      {
        to: '/shipment/shipment-processing',
        icon: 'outbound',
        label: '출하 처리',
        labelVi: 'Xử lý xuất hàng',
        tabs: [
          {
            to: '/shipment/shipment-processing',
            label: '출하 처리(상차·실물 출고)',
            labelVi: 'Xử lý xuất hàng (lên xe · xuất thực tế)',
          },
          {
            to: '/shipment/expedited-shipment',
            label: '긴급 직행 출하 처리',
            labelVi: 'Xử lý xuất hàng thẳng khẩn',
          },
        ],
      },
      {
        to: '/shipment/shipment-confirm',
        icon: 'task_alt',
        label: '출하 확정·취소',
        labelVi: 'Xác nhận · hủy xuất hàng',
      },
      /*
       * 반품·클레임 — 확정된 출하가 되돌아오는 한 흐름이다: 입고 등록 → 판정 의뢰(판정은 품질의
       * 처분 판정 처리 W-03-10 몫) → 판정 결과에 따라 재고 재등록 또는 제품 폐기 요청.
       */
      {
        to: '/shipment/return-receipts',
        icon: 'keyboard_return',
        label: '반품·클레임',
        labelVi: 'Hàng trả · khiếu nại',
        tabs: [
          {
            to: '/shipment/return-receipts',
            label: '반품·클레임 입고 등록',
            labelVi: 'Đăng ký nhập kho hàng trả · khiếu nại',
          },
          {
            to: '/shipment/disposition-requests',
            label: '재작업/폐기 판정 의뢰',
            labelVi: 'Yêu cầu quyết định làm lại / hủy',
          },
          {
            to: '/shipment/stock-reinstatements',
            label: '재고 재등록',
            labelVi: 'Đăng ký lại tồn kho',
          },
          {
            to: '/shipment/product-disposal-request',
            label: '제품 폐기 요청',
            labelVi: 'Yêu cầu hủy thành phẩm',
          },
        ],
      },
    ],
  },
  /*
   * 업무함 — **누구나 자기에게 온 것을 보는 자리**다(W-CO-09 결재함 · W-CO-03 알림센터 ·
   * W-CO-04 공지). 「승인」(결재함 하나)과 「알림」을 따로 두었다가 합쳤다 — 항목 하나짜리 묶음은
   * 제목이 항목보다 무겁다. 관리자가 남을 설정하는 알림 수신자 설정은 「시스템 관리」로 옮겼다.
   *
   * ⛔ **상단 바에 종 배지를 만들지 않는다**(결정 ②). 배지는 셸의 책임이고 갱신 주기가
   * 아직 정해지지 않았다 — 요청이 하나도 없는 이 파일에 조회를 들이면 **모든 화면이**
   * 라우트 전환마다 그 요청을 지고, 미인증 실패가 전 화면의 상단 바에 나타난다.
   */
  {
    label: '업무함',
    labelVi: 'Hộp công việc',
    icon: 'inbox',
    items: [
      { to: '/approval/inbox', icon: 'inbox', label: '결재함', labelVi: 'Hộp phê duyệt' },
      {
        to: '/notification/center',
        icon: 'notifications',
        label: '알림센터',
        labelVi: 'Trung tâm thông báo',
      },
      /* W-CO-04 — 알림센터가 받는 자리이고 이쪽이 보내는 자리다. */
      {
        to: '/notification/notices',
        icon: 'campaign',
        label: '공지·전달',
        labelVi: 'Thông cáo · truyền đạt',
      },
    ],
  },
  /*
   * 기준정보 관리 — 품목·BOM(ERP 원본 위에 MES 확장속성)을 앞에 두고, MES 가 직접 세우는
   * 마스터(공정 → 설비 → 툴·금형 → 계측기 → 창고)를 뒤에 둔다. 횡단 조회인 마스터
   * 변경관리가 끝이다. ERP 에서 받은 원본만 보는 표는 「시스템 관리 > ERP 연동 현황·이력」에 있다.
   */
  {
    label: '기준정보 관리',
    labelVi: 'Quản lý dữ liệu gốc',
    icon: 'database',
    items: [
      /*
       * W-06-05 — **품목·BOM 의 ERP 조회와 확장속성 편집이 한 화면이다**(사용자 2026-10-20).
       * 아키텍처의 「품목정보 조회 (ERP)」·「BOM 조회 (ERP)」를 따로 세웠다가, 이 화면이 이미
       * ERP 원본 정보와 BOM 구역을 갖고 있어 합쳤다 — 같은 품목을 두 화면에서 고르게 하지 않는다.
       * 이름에 「(ERP)」를 붙이지 않은 것은 확장속성을 MES 가 고치기 때문이다.
       */
      {
        to: '/master-data/item-extended-attrs',
        icon: 'category',
        label: '품목·BOM 정보',
        labelVi: 'Thông tin mặt hàng · BOM',
      },
      {
        to: '/master-data/routing',
        icon: 'account_tree',
        label: '공정(Routing)',
        labelVi: 'Công đoạn (Routing)',
      },
      /*
       * 설비 — 설비를 세우고(마스터) 그 설비가 언제 돌고(작업 캘린더) 무엇을 보내오는지(수집
       * 채널)를 정한다. 셋 다 **설비에 붙는 설정**이라 한 묶음이다.
       */
      {
        to: '/equipment/master',
        icon: 'precision_manufacturing',
        label: '설비',
        labelVi: 'Thiết bị',
        tabs: [
          {
            to: '/equipment/master',
            label: '설비·설비그룹 마스터',
            labelVi: 'Dữ liệu gốc thiết bị · nhóm thiết bị',
          },
          {
            to: '/equipment/work-calendar',
            label: '작업 캘린더 설정',
            labelVi: 'Thiết lập lịch làm việc',
          },
          {
            to: '/equipment/collection-channels',
            label: '수집 채널 매핑 관리',
            labelVi: 'Quản lý ánh xạ kênh thu thập',
          },
        ],
      },
      /* ⭐ 툴·금형 — 캐비티 수는 툴 마스터가, 환산 비율은 타발수 환산이 갖는 **한 계산의 두 입력**이다. */
      {
        to: '/equipment/tool-master',
        icon: 'handyman',
        label: '툴·금형',
        labelVi: 'Công cụ · khuôn',
        tabs: [
          {
            to: '/equipment/tool-master',
            label: '툴/금형/지그 마스터',
            labelVi: 'Dữ liệu gốc công cụ / khuôn / đồ gá',
          },
          {
            to: '/equipment/shot-conversion',
            label: '타발수 환산 파라미터 설정',
            labelVi: 'Thiết lập tham số quy đổi số nhát dập',
          },
        ],
      },
      /*
       * 계측기 — 마스터와 검교정 이력이 **같은 계측기를 다룬다**. 검교정은 보전 묶음에 있었으나
       * 이력이 마스터 없이는 적힐 수 없어 마스터 옆으로 옮겼다.
       */
      {
        to: '/equipment/gauge-master',
        icon: 'straighten',
        label: '계측기',
        labelVi: 'Thiết bị đo',
        tabs: [
          {
            to: '/equipment/gauge-master',
            label: '계측기 마스터 관리',
            labelVi: 'Quản lý dữ liệu gốc thiết bị đo',
          },
          {
            to: '/equipment/gauge-calibration',
            label: '계측기 검교정 이력',
            labelVi: 'Lịch sử hiệu chuẩn thiết bị đo',
          },
        ],
      },
      /*
       * 창고·위치 — 창고·Location → 적치 규칙(위치를 참조) → 창고 배치도(위치를 도면에 얹음).
       * 물건이 오가는 「구매 / 자재 관리」가 아니라 어디에 둘지 **정해 두는** 일이라 기준정보다.
       */
      {
        to: '/master-data/warehouse-location',
        icon: 'warehouse',
        label: '창고·위치',
        labelVi: 'Kho · vị trí',
        tabs: [
          {
            to: '/master-data/warehouse-location',
            label: '창고·Location',
            labelVi: 'Kho · Vị trí',
          },
          { to: '/master-data/putaway-rule', label: '적치 규칙', labelVi: 'Quy tắc cất hàng' },
          {
            to: '/master-data/warehouse-layout',
            label: '창고 배치도',
            labelVi: 'Sơ đồ bố trí kho',
          },
        ],
      },
      /* 특정 마스터에 속하지 않는 횡단 조회라 마스터 항목들 뒤에 둔다. */
      {
        to: '/master-data/master-change',
        icon: 'history',
        label: '마스터 변경관리',
        labelVi: 'Quản lý thay đổi dữ liệu gốc',
      },
    ],
  },
  /*
   * 설비 보전 관리 — 아키텍처에 없는 묶음이다. 기준정보 관리 뒤·시스템 관리 앞이다(사용자 2026-10-20). 설비·툴·
   * 계측기 마스터는 「기준정보 관리」로 갔고 여기에는 **일하는 화면**만 남았다: 설비 보전(고장
   * → 지시 → 실적) · 툴 보전(오더 → 실적) · 결과를 보는 비가동 집계.
   */
  {
    label: '설비 보전 관리',
    labelVi: 'Quản lý bảo trì thiết bị',
    icon: 'build',
    items: [
      /* 설비 보전 — 고장이 보전지시의 한 원천이고, 지시가 실적의 대상이다. 한 흐름의 세 단계다. */
      {
        to: '/equipment/failures',
        icon: 'build',
        label: '설비 보전',
        labelVi: 'Bảo trì thiết bị',
        tabs: [
          {
            to: '/equipment/failures',
            label: '설비고장 상세처리',
            labelVi: 'Xử lý chi tiết sự cố thiết bị',
          },
          {
            to: '/equipment/maintenance-orders',
            label: '보전지시 발행',
            labelVi: 'Phát hành lệnh bảo trì',
          },
          {
            to: '/equipment/maintenance-results',
            label: '보전 실적·예비품',
            labelVi: 'Kết quả bảo trì · phụ tùng',
          },
        ],
      },
      /* 툴 보전 — 오더가 실적의 대상이다. */
      {
        to: '/equipment/tool-pm-order',
        icon: 'schedule',
        label: '툴 보전',
        labelVi: 'Bảo trì công cụ',
        tabs: [
          {
            to: '/equipment/tool-pm-order',
            label: '툴 보전오더 생성',
            labelVi: 'Tạo lệnh bảo trì công cụ',
          },
          {
            to: '/equipment/tool-pm-result',
            label: '툴 PM 실적 등록',
            labelVi: 'Đăng ký kết quả PM công cụ',
          },
        ],
      },
      /* 돌아간 결과를 보는 자리라 일하는 화면들 뒤다. */
      {
        to: '/equipment/downtime-summary',
        icon: 'timelapse',
        label: '비가동 집계 조회',
        labelVi: 'Tra cứu tổng hợp dừng máy',
      },
    ],
  },
  /*
   * 시스템 관리 — **관리자가 남을 설정하고 연동을 지켜보는 자리**다. ERP 연동 현황(받은 데이터 조회 포함) → 사용자·권한 → 결재·알림
   * 설정 → 공통 설정 차례다(아키텍처).
   *
   * ⚠ **비밀번호 변경은 여기 없다** — 상단 바의 사용자 자리로 옮겼다(`layout.tsx`
   * `SessionActions`). 누구나 자기 것을 바꾸는 자리라 관리자 묶음에 둘 이유가 없고, 상단 바는
   * 권한 판정 없이 늘 서므로 「관리자가 아닌 사용자도 바꿀 길이 있어야 한다」(W-CO-10)가
   * 그대로 지켜진다.
   */
  {
    label: '시스템 관리',
    labelVi: 'Quản trị hệ thống',
    icon: 'settings',
    items: [
      /*
       * ERP 연동 현황·이력 — **ERP 에서 받은 것을 보기만 하는 자리를 한 묶음에 모았다**(사용자
       * 2026-10-20). 첫 탭은 연동 실행 로그와 실패 재처리(W-06-10 · 옛 「연계 동기화 현황」)이고,
       * 나머지는 받은 데이터를 **종류별 표**로 본다(W-06-16~23) — 기준 데이터(공통코드·사원·품목·
       * 거래처·BOM) 다음 전표(구매발주·수주·ERP W/O) 차례다.
       *
       * ⛔ **MES 가 고치거나 이어서 일하는 화면은 여기 두지 않는다.** 품목 확장속성(「품목·BOM
       * 정보」 W-06-05)과 ERP W/O 전개(「ERP W/O」 W-02-01 → 전개·편성)는 같은 데이터를 다루지만
       * MES 의 일이라 업무 묶음에 남는다. 이 묶음은 「ERP 가 무엇을 보냈는가」만 답한다.
       */
      {
        to: '/master-data/integration-sync',
        icon: 'sync_alt',
        label: 'ERP 연동 현황·이력',
        labelVi: 'Tình trạng · lịch sử liên kết ERP',
        tabs: [
          {
            to: '/master-data/integration-sync',
            label: '연동 현황·이력',
            labelVi: 'Tình trạng · lịch sử liên kết',
          },
          /*
           * ERP 받기 표의 상태와 「지금 읽기」 — 연동 현황·이력 위에 접혀 있던 것을 탭으로 뗐다(사용자 지시 2026-10-27).
           * 설계 화면 코드가 따로 없어 묶음 화면(연동 현황·이력 W-06-10)의 코드를 따른다(web-screen-catalog.ts `WEB_SCREEN_TABS`).
           */
          { to: '/master-data/erp-inbound', label: 'ERP 수신', labelVi: 'Nhận ERP' },
          /* 송신 항목과 그 송신 예정 목록(W-06-12) — 받기(아래 ERP 데이터 탭)와 갈라 연동 현황 바로 뒤. */
          { to: '/master-data/erp-outbound', label: 'ERP 송신', labelVi: 'Gửi ERP' },
          { to: '/system/erp-data/common-codes', label: '공통코드', labelVi: 'Mã chung' },
          { to: '/system/erp-data/employees', label: '사원', labelVi: 'Nhân viên' },
          { to: '/system/erp-data/items', label: '품목', labelVi: 'Mặt hàng' },
          { to: '/system/erp-data/partners', label: '거래처', labelVi: 'Đối tác' },
          { to: '/system/erp-data/boms', label: 'BOM', labelVi: 'BOM' },
          { to: '/system/erp-data/purchase-orders', label: '구매발주', labelVi: 'Đơn mua hàng' },
          { to: '/system/erp-data/sales-orders', label: '수주', labelVi: 'Đơn bán hàng' },
          { to: '/system/erp-data/production-orders', label: 'ERP W/O', labelVi: 'ERP W/O' },
        ],
      },
      {
        to: '/system/users-roles',
        icon: 'manage_accounts',
        label: '사용자·역할·권한',
        labelVi: 'Người dùng · vai trò · quyền',
      },
      /* W-06-15 — 승인자를 정할 수 있게 된 다음에 결재선을 세운다. */
      {
        to: '/system/approval-route',
        icon: 'approval',
        label: '결재선 정의',
        labelVi: 'Định nghĩa luồng phê duyệt',
      },
      /* W-CO-11 — 결재선처럼 **누가 받을지**를 관리자가 정한다. 그래서 결재선 바로 뒤다. */
      {
        to: '/notification/recipient-settings',
        icon: 'notifications_active',
        label: '알림 수신자 설정',
        labelVi: 'Thiết lập người nhận thông báo',
      },
      /* W-CO-12 — 알림이 «어디로» 나가는지. 받을 사람을 정한 다음이다(001). */
      {
        to: '/notification/zalo-connection',
        icon: 'link',
        label: '알림 연결 설정',
        labelVi: 'Thiết lập kết nối thông báo',
      },
      /* W-CO-13 — 나간 결과를 본다. 연결 설정 다음이다(001). */
      {
        to: '/notification/dispatch-history',
        icon: 'history',
        label: '알림 발송 이력',
        labelVi: 'Lịch sử gửi thông báo',
      },
      {
        to: '/master-data/common-code',
        icon: 'list_alt',
        label: '공통코드·조직·작업자',
        labelVi: 'Mã chung · tổ chức · nhân viên',
      },
      /* W-CO-06 — 단말은 시스템 관리의 자원이다. */
      {
        to: '/system/terminal-process-map',
        icon: 'tablet_android',
        label: '단말기-공정 매핑',
        labelVi: 'Ánh xạ máy quét - công đoạn',
      },
    ],
  },
];

/** 항목이 닿는 주소 전부 — 탭 묶음이면 탭들의 주소, 아니면 자기 주소 하나. */
export const navEntryPaths = (entry: NavEntry): readonly string[] =>
  entry.tabs === undefined ? [entry.to] : entry.tabs.map((tab) => tab.to);

/**
 * 사이드바로 닿는 **화면 전부** — `NAV_LEAD` 와, 탭 묶음은 탭 하나하나를 한 화면으로 편다.
 *
 * ⭐ **훑는 쪽이 합치기를 잊지 않게 여기서 합친다.** `NAV_GROUPS` 만 훑으면 섹션 밖 항목이
 * 조용히 빠진다 — 검색창에 「대시보드」를 쳤을 때 결과가 0건이 되는 식이다.
 *
 * ⚠ **탭 묶음 자신은 담지 않는다.** 묶음 이름(「툴·금형」)은 화면이 아니라 화면 코드가 없다 —
 * 화면 목록 대조(`routes/web-screen-catalog.test.ts`)가 재는 것은 탭 하나하나다. 펼친 탭은
 * 묶음의 아이콘을 물려받는다(레일·검색 결과에서 같은 아이콘으로 선다).
 */
export const NAV_ENTRIES: readonly NavEntry[] = [
  NAV_LEAD,
  ...NAV_GROUPS.flatMap((group) =>
    group.items.flatMap((item) =>
      item.tabs === undefined ? [item] : item.tabs.map((tab) => ({ ...tab, icon: item.icon })),
    ),
  ),
];
