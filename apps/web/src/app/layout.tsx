import { AppShell, Sidebar, SidebarItem, SidebarSection, Topbar } from '@crefle/web-ui';
import type { ReactNode } from 'react';
import { useHref, useLinkClickHandler, useLocation } from 'react-router';

import { useSession } from '../patterns/session';

interface NavItemProps {
  to: string;
  icon: string;
  children: ReactNode;
}

/**
 * DS `SidebarItem`을 라우터에 잇는 어댑터.
 * `href`는 `useHref`로 만들고, 클릭은 `useLinkClickHandler`로 가로채 전체 새로고침 없이 이동한다.
 */
const NavItem = ({ to, icon, children }: NavItemProps) => {
  const href = useHref(to);
  const handleClick = useLinkClickHandler(to);
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <SidebarItem icon={icon} href={href} active={isActive} onClick={handleClick}>
      {children}
    </SidebarItem>
  );
};

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * 관리웹 셸.
 *
 * **상단 바 오른쪽에 로그인 사용자의 이름을 보인다.** 세션이 없으면 그 자리를 **비운다** —
 * 「알 수 없음」류의 글자를 두지 않는다(공유계약 G-9: 모르는 값과 없는 값을 같은 모양으로
 * 그리지 않는다). 지금은 미인증 접근을 막는 장치가 없어 **비어 있는 것이 정상 상태**다.
 *
 * ⛔ 귀속(사업부·공장)은 그리지 않는다 — 계약이 정수 ID만 주고 이름을 주지 않아, 사람이 읽을
 * 값을 만들려면 셸이 기준정보 조회를 지게 된다. 값 자체는 세션에 그대로 실려 있다.
 */
export const AppLayout = ({ children }: AppLayoutProps) => {
  const { session } = useSession();

  return (
    <AppShell
      mainLabel="본문"
      topbar={
        <Topbar
          brand={<strong>OMF-MES 관리웹</strong>}
          actions={session === null ? undefined : <span>{session.userName}</span>}
        />
      }
      sidebar={
        <Sidebar aria-label="주 메뉴">
          <SidebarSection label="기준정보">
            <NavItem to="/master-data/warehouse-location" icon="warehouse">
              창고·Location
            </NavItem>
            {/*
             * W-06-14 — **창고·Location 바로 뒤다.** 적치 규칙은 창고와 위치를 참조해야
             * 성립하고 그 마스터에서 이어지는 화면이라, 인접이 관계를 드러낸다. 계약 경로는
             * `/logistics/**`이지만 주소 앞머리는 **이 섹션을 따른다** — 어디에 둘지 미리
             * 정해 두는 일이라 물건이 오가는 「자재창고」가 아니라 기준정보다.
             */}
            <NavItem to="/master-data/putaway-rule" icon="shelves">
              적치 규칙
            </NavItem>
            <NavItem to="/master-data/routing" icon="account_tree">
              Routing(공정)
            </NavItem>
            <NavItem to="/master-data/inspection-standard" icon="fact_check">
              검사기준
            </NavItem>
            <NavItem to="/master-data/defect-cause-code" icon="rule">
              불량·원인코드
            </NavItem>
            <NavItem to="/master-data/common-code" icon="list_alt">
              공통코드·조직·작업자
            </NavItem>
            {/* 같은 코드값 편집기를 여는 화면이라 공통코드 바로 뒤에 둔다 — 인접이 관계를 드러낸다. */}
            <NavItem to="/master-data/judgment-code" icon="verified">
              판정유형 코드
            </NavItem>
            <NavItem to="/master-data/integration-sync" icon="sync_alt">
              연계 동기화 현황
            </NavItem>
            <NavItem to="/master-data/item-extended-attrs" icon="inventory_2">
              품목 확장속성
            </NavItem>
            {/* 특정 마스터에 속하지 않는 횡단 조회라 마스터 항목들 뒤에 둔다. */}
            <NavItem to="/master-data/master-change" icon="history">
              마스터 변경관리
            </NavItem>
          </SidebarSection>
          {/*
           * 입하 예정은 기준정보도 시스템 운영도 아닌 **현장 물류**다 —
           * 도메인 01(자재창고)의 첫 화면이고, 뒤따르는 W-01 화면들이 이 섹션에 들어온다.
           */}
          <SidebarSection label="자재창고">
            <NavItem to="/logistics/inbound-schedule" icon="local_shipping">
              입하 예정 조회
            </NavItem>
            {/*
             * W-01-03 — **차례가 업무 순서다.** 도착 예정을 보고(입하 예정) 도착을 처리한 뒤
             * (초과 입하 분리) 그 결과를 재고에서 확인한다. 이 도메인의 첫 쓰기 화면이다.
             */}
            <NavItem to="/logistics/over-receipt-split" icon="call_split">
              초과 입하 분리
            </NavItem>
            {/*
             * W-01-01 — **차례가 업무 순서다.** 도착을 처리한 뒤(초과 입하 분리) 받아들여도
             * 되는지를 먼저 판정하고, 그 다음 창고로 받아들인다(정상품 입하 처리).
             *
             * ⛔ **「품질」 섹션을 새로 만들지 않는다.** 통합 IA 가 이 화면을 「자재/창고 >
             * 입하·검사」에 두었고 형제 화면(W-01-02)이 이미 이 섹션에 있다.
             */}
            <NavItem to="/logistics/iqc-inspection" icon="troubleshoot">
              IQC 수입검사·판정
            </NavItem>
            {/*
             * W-01-10 — **차례가 업무 순서다.** 도착을 처리한 뒤(초과 입하 분리) 창고로
             * 받아들이고(정상품 입하 처리) 그 결과를 재고에서 확인한다.
             */}
            <NavItem to="/logistics/goods-receipt" icon="inventory_2">
              정상품 입하 처리
            </NavItem>
            {/*
             * W-01-07 — 같은 도메인이라 **섹션을 새로 만들지 않는다.** 계약 경로가
             * `/inventory/**`·`/trace/**`이지만 주소 앞머리는 이 섹션을 따른다.
             */}
            <NavItem to="/logistics/stock-status" icon="inventory">
              재고 현황·상태 조회
            </NavItem>
            {/*
             * W-01-04 — **차례가 업무 순서다.** 예정을 보고 · 도착을 처리하고 · 창고로
             * 받아들이고 · 재고를 확인한 뒤 **장부와 실물을 맞춘다.** 실사가 그 끝에 서는
             * 것은 앞의 넷이 남긴 결과를 대상으로 삼기 때문이다.
             */}
            <NavItem to="/logistics/stocktaking" icon="checklist">
              재고실사
            </NavItem>
            {/*
             * W-01-12 — **차례가 업무 순서다.** 재고를 확인하고(재고 현황) 장부와 실물을
             * 맞춘 뒤(재고실사) **어긋난 것을 고친다.** 실사 바로 뒤가 그 자리이며, 반품·폐기보다
             * 앞이다 — 저 둘은 물건을 내보내는 일이고 이것은 장부를 실물에 맞추는 일이다.
             *
             * **메뉴에 둔다**(W-01-11과 갈리는 자리). 그쪽은 맥락 없는 진입이 곧 요구사항 위반이라
             * 라우트만 열었는데, 이 화면은 세 원천 중 **직접 등록**이 다른 화면을 거치지 않고
             * 들어오는 정상 경로다(착수 이슈 §6). 재고실사 마감 결과의 링크는 그 위의 한 갈래일 뿐이다.
             */}
            <NavItem to="/logistics/stock-adjust" icon="tune">
              재고조정
            </NavItem>
            {/*
             * W-01-05 — **차례가 업무 순서다.** 예정 → 도착 → 입고 → 재고 확인 → 실사 뒤에
             * **되돌려 보내기**가 선다. 반품은 앞의 다섯이 남긴 결과(입고된 자재)를 대상으로
             * 삼으므로 그것들보다 앞에 둘 자리가 없다.
             */}
            <NavItem to="/logistics/supplier-return" icon="assignment_return">
              공급사 반품 처리
            </NavItem>
            {/*
             * W-01-06 — **차례가 업무 순서다.** 예정 → 초과 분리 → 입고 → 재고 확인 → 실사 →
             * 반품 뒤에 **폐기**가 선다. 못 쓰게 된 자재를 장부에서 덜어내는 일이라 앞의 여섯이
             * 남긴 결과를 대상으로 삼고, 그것들보다 앞에 둘 자리가 없다.
             *
             * **승인 성격의 화면(긴급 IQC 생략)보다는 앞이다** — 이 화면은 물건이 오가는 흐름의
             * 한 갈래이고, 그 뒤엣것은 흐름 위에서 예외를 허가하는 일이라 축이 다르다.
             */}
            <NavItem to="/logistics/disposal-issue" icon="delete_forever">
              폐기 품의·기타출고
            </NavItem>
            {/*
             * W-01-02 — **자재창고 업무의 승인 자리**다. 결재라는 일 때문에 「승인」 섹션이
             * 떠오르지만, 이 화면이 판정하는 것은 **자재 입하 검사를 생략할 것인가**이고
             * 그 판단의 맥락(입하·재고·입고)이 이 섹션에 다 있다. 설계 스펙의 breadcrumb도
             * 「자재창고」다 — 결재함은 **올라온 결재를 두루 처리하는 자리**라 축이 다르다.
             *
             * **기존 항목 뒤에 둔다.** 앞의 여섯이 물건이 오가는 순서이고, 이것은 그 흐름
             * 위에서 예외를 허가하는 일이라 순서에 끼워 넣을 자리가 없다.
             */}
            <NavItem to="/logistics/iqc-skip-approval" icon="approval">
              긴급 IQC 생략 한도승인
            </NavItem>
            {/*
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
             */}
            <NavItem to="/logistics/document-progress" icon="manage_search">
              물류 문서 진행현황·취소
            </NavItem>
          </SidebarSection>
          {/*
           * W-04-02 — **출하(도메인 04)의 첫 화면이고 그래서 새 섹션을 연다.** 착수 이슈 §1의
           * IA 위치가 「관리웹 > 출하 > 출하 지시·확정」이라 「자재창고」에 넣지 않는다 —
           * 입고 중심의 그 섹션과 축이 다르다. 자재창고 바로 뒤·생산 앞이다: 물류 흐름상
           * 입고를 처리한 뒤(자재창고) 출하를 다루고, 그 결과가 생산과는 독립이다.
           */}
          <SidebarSection label="출하">
            <NavItem to="/shipment/shipment-schedule" icon="local_shipping">
              출하 예정 목록
            </NavItem>
          </SidebarSection>
          {/* W-02-01 — 생산의 계획·지시 첫 화면이며 현재 생산 블록의 첫 항목으로 둔다. */}
          <SidebarSection label="생산">
            <NavItem to="/production/production-orders" icon="account_tree">
              P/O 수신·조회
            </NavItem>
            {/* W-02-05 — 같은 생산 섹션의 마감·모니터링 화면이다. */}
            <NavItem to="/production/work-order-close" icon="archive">
              W/O 마감·ERP 실적 송신
            </NavItem>
          </SidebarSection>
          {/*
           * W-03-01 — Lot Status 계열의 첫 화면이 독립된 「품질관리」 섹션을 연다.
           * IQC 수입검사는 입하 흐름의 판정이라 자재창고에 남고, 여기서는
           * 자재·생산 LOT의 상태와 보류 사건을 품질 관점에서 횡단한다.
           */}
          <SidebarSection label="품질관리">
            <NavItem to="/quality/lot-status" icon="history">
              Lot Status 현황·변경이력 조회
            </NavItem>
            {/* W-03-02 — 현황에서 찾은 LOT을 판정·전이하므로 W-03-01 바로 뒤에 둔다. */}
            <NavItem to="/quality/lot-status-transition" icon="published_with_changes">
              Lot Status 판정·전이 처리
            </NavItem>
            {/* W-03-03 — 판정할 의심 LOT을 먼저 보류하므로 W-03-02 바로 뒤에 둔다. */}
            <NavItem to="/quality/suspicious-material-hold" icon="report_problem">
              의심자재 등록
            </NavItem>
            {/* W-03-09 — Lot Status 조회·판정·의심자재 등록 다음에 서는 품질 승인 화면이다. */}
            <NavItem to="/quality/approvals" icon="approval">
              특채·한도승인 승인 처리
            </NavItem>
          </SidebarSection>
          {/*
           * W-05-12 — **도메인 05(설비/툴)의 첫 섹션이다.** 통합 IA 의 최상위 그룹이며,
           * 뒤따르는 W-05 화면들(툴 마스터·계측기·작업 캘린더·수집 채널…)이 여기 들어온다.
           *
           * **자재창고 뒤·승인 앞이다** — 업무 도메인 섹션들을 붙여 두고, 그 위를 가로지르는
           * 것(승인·알림)과 운영 설정(시스템 관리)을 끝에 남긴다. 자재창고가 도메인 01,
           * 이것이 도메인 05라 번호 차례이기도 하다.
           *
           * 주소 앞머리는 `/equipment` 다 — 계약 경로(`/mdm/**`)가 아니라 이 섹션을 따른다.
           */}
          <SidebarSection label="설비/툴">
            <NavItem to="/equipment/master" icon="precision_manufacturing">
              설비·설비그룹 마스터
            </NavItem>
            {/*
             * W-05-13 — 설비 **다음**이다. 이 섹션의 주어가 설비이고 툴은 그 옆 축이라,
             * 한정어 없는 이름(설비 마스터)이 먼저 서고 자기 이름을 붙인 것들이 뒤따른다.
             * 화면 번호 차례(12 → 13)이기도 하다.
             */}
            <NavItem to="/equipment/tool-master" icon="handyman">
              툴/금형/지그 마스터
            </NavItem>
            {/*
             * W-05-09 — 마스터 셋 **뒤**다. 앞의 둘이 「무엇이 있는가」를 정하고 이것은
             * 「언제 도는가」를 정한다 — 대상이 있어야 달력을 붙일 자리가 생긴다.
             */}
            <NavItem to="/equipment/work-calendar" icon="calendar_month">
              작업 캘린더 설정
            </NavItem>
            {/*
             * W-05-07 — 섹션 **맨 뒤**다. 앞의 셋이 「무엇이 있고 언제 도는가」를 정하고,
             * 이것은 그 설비가 **보내오는 것을 어디에 담을지**를 정한다 — 설비가 먼저 있어야
             * 채널을 붙일 자리가 생긴다.
             *
             * IA 는 이 화면을 「설비/툴 > 비가동·계측」 아래 두었으나, 그 하위 묶음은 아직
             * 이 화면 하나뿐이라 **묶음을 만들지 않는다** — 항목 하나짜리 묶음은 층만 늘리고
             * 찾는 길을 길게 한다. 형제(W-05-06·W-05-08)가 서면 그때 묶는다.
             */}
            <NavItem to="/equipment/collection-channels" icon="sensors">
              수집 채널 매핑 관리
            </NavItem>
            {/*
             * W-05-01 — 섹션 **맨 뒤**다. 앞의 넷이 「무엇이 있고 언제 도는가」와 「무엇을
             * 받는가」를 정하고, 이것은 **받은 것을 어떻게 세는가**를 정한다 — 세는 규칙은
             * 셀 대상이 다 선 뒤에 온다.
             *
             * ⭐ **툴 마스터와 짝이다** — 캐비티 수는 그쪽이 갖고 비율은 여기가 갖는다.
             * 두 화면이 한 계산의 입력을 나눠 갖는다.
             */}
            <NavItem to="/equipment/shot-conversion" icon="calculate">
              타발수 환산 파라미터 설정
            </NavItem>
            {/*
             * W-05-11 — **섹션 맨 뒤다.** 라우트는 진작 열려 있었고 메뉴만 미뤄 두었던
             * 화면이라(설계 질의 `omf-mes#195`), 형제들이 자리를 잡은 뒤에 붙는다.
             *
             * ⭐ **미루던 이유가 없어졌다** — 유형 값 목록이 확정돼(회신 · 시드 `omf-mes#182`)
             * 사용자가 실제로 계측기만 골라 볼 수 있으므로 「계측기 마스터」라는 이름이
             * 더는 거짓이 아니다.
             */}
            <NavItem to="/equipment/gauge-master" icon="straighten">
              계측기 마스터 관리
            </NavItem>
          </SidebarSection>
          {/*
           * W-CO-09 — 결재함은 기준정보도 시스템 운영도 아니라 **일하는 자리**다.
           * 결재선 정의(W-06-15)가 「시스템 관리」에 든 것은 그것이 **운영 설정**이기
           * 때문이고, 올라온 결재를 처리하는 일은 그것과 축이 다르다.
           *
           * **자재창고 뒤·시스템 관리 앞이다** — 업무를 하는 섹션들을 붙여 두고 운영 설정을
           * 끝에 남긴다. 뒤따르는 승인 화면들이 이 섹션에 들어온다.
           */}
          <SidebarSection label="승인">
            <NavItem to="/approval/inbox" icon="inbox">
              결재함
            </NavItem>
          </SidebarSection>
          {/*
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
           */}
          <SidebarSection label="알림">
            <NavItem to="/notification/center" icon="notifications">
              알림센터
            </NavItem>
          </SidebarSection>
          {/*
           * 사용자·역할·권한은 기준정보가 아니라 **시스템 운영**이다 —
           * 기준정보 섹션에 넣으면 「창고·Location」 옆에 서서 분류가 무너진다.
           */}
          <SidebarSection label="시스템 관리">
            <NavItem to="/system/users-roles" icon="manage_accounts">
              사용자·역할·권한
            </NavItem>
            {/*
             * W-06-15 — **차례가 순서다.** 승인자를 정할 수 있게 된 다음에 결재선을 세운다.
             * 결재선은 마스터이지만 업무 기준정보가 아니라 운영 설정이라 이 섹션에 든다.
             */}
            <NavItem to="/system/approval-route" icon="approval">
              결재선 정의
            </NavItem>
            {/*
             * W-CO-10 — **섹션 맨 끝이다.** 앞의 둘은 관리자가 남을 설정하는 자리이고 이것은
             * 누구나 자기 것을 바꾸는 자리라, 앞의 순서(권한 → 결재선)를 흔들지 않고 뒤에 붙인다.
             *
             * ⛔ **메뉴 권한이 붙어도 이 항목은 감추지 않는다.** 지금은 권한에 따른 감춤이 없어
             * 문제가 드러나지 않지만, 감추는 날 비밀번호를 바꿀 길이 사라지는 것은 **관리자가 아닌
             * 모든 사용자**다. 같은 사실을 `routes/index.tsx`와 `docs/decisions.md`에 함께 적었다.
             */}
            <NavItem to="/system/password-change" icon="password">
              비밀번호 변경
            </NavItem>
          </SidebarSection>
        </Sidebar>
      }
    >
      {children}
    </AppShell>
  );
};
