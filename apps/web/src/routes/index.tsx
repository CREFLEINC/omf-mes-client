import { Navigate, Outlet, createBrowserRouter } from 'react-router';

import { AppLayout } from '../app/layout';
import { ApprovalInboxScreen } from '../screens/approval-inbox/screen';
import { ApprovalRouteScreen } from '../screens/approval-route/screen';
import { JudgmentCodeScreen } from '../screens/common-code/judgment-code-screen';
import { CommonCodeScreen } from '../screens/common-code/screen';
import { DefectCauseCodeScreen } from '../screens/defect-cause-code/screen';
import { DisposalIssueScreen } from '../screens/disposal-issue/screen';
import { DocumentProgressScreen } from '../screens/document-progress/screen';
import { GaugeMasterScreen } from '../screens/gauge-master/screen';
import { ToolMasterScreen } from '../screens/tool-master/screen';
import { WorkCalendarScreen } from '../screens/work-calendar/screen';
import { WorkOrderCloseScreen } from '../screens/work-order-close/screen';
import { GoodsReceiptScreen } from '../screens/goods-receipt/screen';
import { InboundScheduleScreen } from '../screens/inbound-schedule/screen';
import { InspectionStandardScreen } from '../screens/inspection-standard/screen';
import { IntegrationSyncScreen } from '../screens/integration-sync/screen';
import { CollectionChannelScreen } from '../screens/collection-channel/screen';
import { EquipmentMasterScreen } from '../screens/equipment-master/screen';
import { ShotConversionScreen } from '../screens/shot-conversion/screen';
import { IqcInspectionScreen } from '../screens/iqc-inspection/screen';
import { IqcSkipApprovalScreen } from '../screens/iqc-skip-approval/screen';
import { ItemExtendedAttrsScreen } from '../screens/item-extended-attrs/screen';
import { LoginScreen } from '../screens/login/screen';
import { LotStatusHistoryScreen } from '../screens/lot-status-history/screen';
import { MasterChangeScreen } from '../screens/master-change/screen';
import { NotificationCenterScreen } from '../screens/notification-center/screen';
import { OverReceiptSplitScreen } from '../screens/over-receipt-split/screen';
import { PasswordChangeScreen } from '../screens/password-change/screen';
import { PoRegisterScreen } from '../screens/po-register/screen';
import { PutawayRuleScreen } from '../screens/putaway-rule/screen';
import { RoutingScreen } from '../screens/routing/screen';
import { StockAdjustScreen } from '../screens/stock-adjust/screen';
import { StockStatusScreen } from '../screens/stock-status/screen';
import { StocktakingScreen } from '../screens/stocktaking/screen';
import { SupplierReturnScreen } from '../screens/supplier-return/screen';
import { UsersRolesScreen } from '../screens/users-roles/screen';
import { WarehouseLocationScreen } from '../screens/warehouse-location/screen';

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: (
      <AppLayout>
        <Outlet />
      </AppLayout>
    ),
    children: [
      { index: true, element: <Navigate to="/master-data/warehouse-location" replace /> },
      { path: 'master-data/warehouse-location', element: <WarehouseLocationScreen /> },
      /*
       * W-06-14 — 계약 경로는 `/logistics/putaway-rules`인데 앞머리는 같은 규칙(사이드바
       * 섹션)을 따른다. 적치 규칙은 물건이 오가는 일이 아니라 **어디에 둘지 미리 정해 두는
       * 것**이라 창고·품목과 같은 기준정보 마스터다. 자리도 **창고·Location 바로 뒤**다 —
       * 창고와 위치를 참조해야 성립하는 화면이라 인접이 관계를 드러낸다.
       *
       * **다섯 PR이 함께 여는 자리다.** 목록·사용률·등록/수정이 다 서도 **끄고 켤 수 없는
       * 동안에는** 이 줄을 두지 않았다 — 끄지 못하는 마스터를 노출하면 사용자가 잘못 만든
       * 규칙을 지울 수도 끌 수도 없고, 그 규칙은 현장의 적치를 계속 막는다
       * (정책 §5.2 — 접근 불가능한 경계).
       */
      { path: 'master-data/putaway-rule', element: <PutawayRuleScreen /> },
      { path: 'master-data/routing', element: <RoutingScreen /> },
      { path: 'master-data/inspection-standard', element: <InspectionStandardScreen /> },
      { path: 'master-data/defect-cause-code', element: <DefectCauseCodeScreen /> },
      { path: 'master-data/common-code', element: <CommonCodeScreen /> },
      /* W-06-04 — 전용 자원이 아니라 공통코드의 코드값 편집기를 한 그룹으로 고정해 여는 진입점이다. */
      { path: 'master-data/judgment-code', element: <JudgmentCodeScreen /> },
      { path: 'master-data/integration-sync', element: <IntegrationSyncScreen /> },
      { path: 'master-data/item-extended-attrs', element: <ItemExtendedAttrsScreen /> },
      { path: 'master-data/master-change', element: <MasterChangeScreen /> },
      /* W-CO-02 — 기준정보가 아니라 시스템 운영이라 경로 앞머리를 가른다. */
      { path: 'system/users-roles', element: <UsersRolesScreen /> },
      /*
       * W-06-15 — 같은 규칙(사이드바 섹션)이다. 결재선은 마스터이지만 창고·품목 같은 업무
       * 기준정보가 아니라 **운영 설정**이고, 그 승인자가 곧 사용자·역할·권한의 사용자다.
       *
       * **네 PR이 함께 여는 자리다.** 단계를 세울 수 없는 상태에서는 이 줄을 두지 않았다 —
       * 단계가 0인 결재선만 만들 수 있는 화면을 노출하면 그 유형의 상신이 전부 거부된다
       * (정책 §5.2 — 접근 불가능한 경계).
       */
      { path: 'system/approval-route', element: <ApprovalRouteScreen /> },
      /*
       * W-CO-10 — 앞머리는 같은 규칙(사이드바 섹션)을 따른다. 다만 **이 섹션에서 성격이 다른
       * 첫 화면**이다: 앞의 둘은 관리자가 남을 설정하는 자리이고, 이것은 **누구나 자기 것을
       * 바꾸는 자리**다. 그래서 메뉴 권한이 붙는 날 이 항목은 **감추면 안 된다**(`app/layout.tsx`의
       * 같은 자리와 `docs/decisions.md`에 함께 적었다).
       *
       * **세 PR이 함께 여는 자리다.** 세 칸과 규칙(①)·요청과 성공(②)이 다 선 뒤에 이 줄을 둔다 —
       * 보낼 수 없는 비밀번호 변경 화면을 노출하면 사용자는 바꿨다고 믿고 떠난다
       * (정책 §5.2 — 접근 불가능한 경계).
       */
      { path: 'system/password-change', element: <PasswordChangeScreen /> },
      /*
       * W-01-09 — 자재창고(도메인 01)의 첫 화면. 앞머리를 계약 경로(`/logistics/**`)와 같은
       * 낱말로 두어 화면과 계약의 대응이 주소에서 읽히게 한다. 뒤따르는 W-01 화면들이 그대로 쓴다.
       */
      { path: 'logistics/inbound-schedule', element: <InboundScheduleScreen /> },
      /*
       * W-01-03 — 도메인 01의 **첫 쓰기 화면**이다. 앞머리는 같은 규칙(사이드바 섹션)을 따르고,
       * 차례는 업무 순서를 따른다 — 도착 예정을 보고(입하 예정) 도착을 처리한 뒤(초과 입하 분리)
       * 그 결과를 재고에서 확인한다.
       */
      { path: 'logistics/over-receipt-split', element: <OverReceiptSplitScreen /> },
      /*
       * W-01-11 — **이 저장소에서 처음으로 사이드바에 두지 않는 화면이다.**
       *
       * 근거: 이 화면은 **일반 구매 발주를 만드는 곳이 아니다**(착수 이슈 §6 ① · 스펙 §5-2).
       * 초과 입하분을 사후에 정산하는 자리이고, 무엇을 정산하는지가 주소의 질의값으로 실려야
       * 화면이 성립한다. 메뉴에 「신규 P/O 등록」이 서면 맥락 없는 진입이 기본 경로가 되고,
       * 그때 사용자가 하는 일이 곧 일반 구매 발주 등록이다 — 그 오인이 요구사항 위반이다.
       *
       * 대안 둘을 버린 이유. **상단 배너로 범위를 밝히고 메뉴에 올리는 것**은 배너가 읽히지
       * 않는 것을 전제로 설계해야 하므로 진입 자체를 줄이는 편이 싸다(배너는 화면에 그대로
       * 두었다). **항상 비활성인 메뉴 항목**은 죽은 항목을 남긴다.
       *
       * 그래서 **라우트만 연다.** 진입은 초과 입하 분리(W-01-03)의 등록 결과 구획에서
       * **초과분이 실린 갈래의 전표마다** 서는 링크로만 하고, 그 링크가 이 주소를 가리키는지는
       * `index.test.tsx`가 잇는다.
       *
       * 주소 앞머리는 다른 자재창고 화면과 같은 규칙(사이드바 섹션)을 따른다 — 메뉴에 서지
       * 않아도 이 화면이 속한 업무 묶음은 자재창고이고, 주소가 그 사실을 말해야 한다.
       * **차례는 진입 경로를 따른다** — 초과 입하 분리 바로 뒤다. 메뉴가 없어 아래 화면들의
       * 업무 순서 사슬(예정 → 초과 분리 → 입고 → 재고 → 실사 → 반품 → 폐기)에 들지 않으므로,
       * 이 화면을 여는 화면 옆이 읽히는 자리다.
       */
      { path: 'logistics/po-register', element: <PoRegisterScreen /> },
      /*
       * W-01-01 — **차례가 업무 순서다.** 도착을 처리한 뒤(초과 입하 분리) **받아들여도
       * 되는지를 먼저 판정하고**(IQC 수입검사·판정) 그 다음 창고로 받아들인다.
       *
       * 합격이 곧 Release 이고 그 LOT 이 정상품 입하 처리로 넘어간다(스펙 §5-1) — 두 화면이
       * 이 순서로 이어져 있어 사이에 다른 것을 끼우지 않는다.
       *
       * ⛔ **「품질」 섹션을 새로 만들지 않는다.** 통합 IA 가 이 화면을 **「자재/창고 >
       * 입하·검사」**에 두었고 형제 화면(W-01-02 긴급 IQC 생략 한도승인)이 이미 이 섹션에
       * 서 있다. 품질 섹션은 Lot Status 계열(W-03-xx)이 들어올 때 그 화면들이 연다.
       */
      { path: 'logistics/iqc-inspection', element: <IqcInspectionScreen /> },
      /*
       * W-01-10 — 같은 규칙(사이드바 섹션)을 따르고 차례도 업무 순서다: 도착을 처리한 뒤
       * (초과 입하 분리) 창고로 받아들이고(정상품 입하 처리) 그 결과를 재고에서 확인한다.
       */
      { path: 'logistics/goods-receipt', element: <GoodsReceiptScreen /> },
      /*
       * W-01-07 — 앞머리는 **사이드바 섹션(도메인)을 따른다.** 계약 경로와 같아지는 경우가
       * 많지만 그것이 근거는 아니다: 이 화면의 계약 경로는 `/inventory/**`·`/trace/**`인데
       * 화면은 「자재창고」 섹션에 들어간다. 한 섹션 안의 화면들이 서로 다른 앞머리를 가지면
       * 사용자와 개발자 모두 섹션과 주소를 대응시킬 수 없다.
       */
      { path: 'logistics/stock-status', element: <StockStatusScreen /> },
      /*
       * W-01-04 — 같은 규칙(사이드바 섹션)이고 차례도 업무 순서다: 재고를 확인한 뒤
       * (재고 현황·상태 조회) 장부와 실물을 맞춘다(재고실사).
       *
       * **네 PR이 함께 여는 자리다.** 개시·결과 등록·마감이 다 서기 전에는 이 줄을 두지
       * 않았다 — 마감할 수 없는 「재고실사」 화면을 노출하면 마감 없는 전표가 쌓인다
       * (정책 §5.2 — 접근 불가능한 경계).
       */
      { path: 'logistics/stocktaking', element: <StocktakingScreen /> },
      /*
       * W-01-12 — 같은 규칙(사이드바 섹션)이고 차례도 업무 순서다: 재고를 확인하고
       * (재고 현황) 장부와 실물을 맞춘 뒤(재고실사) **어긋난 것을 고친다**(재고조정).
       * 계약 경로는 `/inventory/adjustments`인데 주소 앞머리는 섹션을 따른다 — 이름은
       * `stock-status`(재고 현황)와 한 글자도 겹치지 않게 두었다.
       *
       * **여섯 PR이 함께 여는 자리다.** 등록·상신·전기·이력이 다 서기 전에는 이 줄을 두지
       * 않았다 — 전기할 수 없는 「재고조정」을 노출하면 사용자가 조정 전표를 만들어 놓고
       * **재고를 실제로 움직이지 못한다**(정책 §5.2 — 접근 불가능한 경계).
       *
       * **진입 경로가 둘이다**(W-01-11과 갈리는 자리): 사이드바 항목과 재고실사 마감 결과의
       * 링크. 메뉴에 두는 근거는 세 원천 중 **직접 등록**이 다른 화면을 거치지 않고 들어오는
       * 정상 경로라는 것이고(착수 이슈 §6), 링크가 이 주소를 가리키는지는 `index.test.tsx`가 잇는다.
       */
      { path: 'logistics/stock-adjust', element: <StockAdjustScreen /> },
      /*
       * W-01-05 — 같은 규칙(사이드바 섹션)이고 차례도 업무 순서다: 예정 → 초과 분리 →
       * 입고 처리 → 재고 확인 → 실사 → **반품**. 되돌려 보내는 것은 앞의 다섯이 남긴
       * 결과를 대상으로 삼는다.
       *
       * **세 PR이 함께 여는 자리다.** 대상 조회·줄 선택까지만 선 상태에서는 이 줄을 두지
       * 않았다 — 반품할 수 없는 「공급사 반품 처리」를 노출하면 미완성 기능을 사용자에게
       * 내보이는 것이다(정책 §5.2 — 접근 불가능한 경계).
       */
      { path: 'logistics/supplier-return', element: <SupplierReturnScreen /> },
      /*
       * W-01-06 — 같은 규칙(사이드바 섹션)이고 차례도 업무 순서다: 예정 → 초과 분리 → 입고
       * 처리 → 재고 확인 → 실사 → 반품 → **폐기**. 못 쓰게 된 자재를 장부에서 덜어내는 일이라
       * 앞의 여섯이 남긴 결과를 대상으로 삼는다.
       *
       * 계약 경로는 반품과 같은 `/logistics/goods-issues`인데 주소는 **화면**을 가리킨다 —
       * 일반 출고·반품·기타 출고가 한 경로를 쓰므로(착수 이슈 §6) 리소스 이름을 주소로 삼으면
       * 세 화면이 한 주소를 다투게 된다.
       *
       * **다섯 PR이 함께 여는 자리다.** 상신까지만 선 상태에서는 이 줄을 두지 않았다 —
       * 처리할 수 없는 화면을 노출하면 사용자가 **승인까지 받아 놓고 아무것도 할 수 없다**
       * (정책 §5.2 — 접근 불가능한 경계).
       */
      { path: 'logistics/disposal-issue', element: <DisposalIssueScreen /> },
      /*
       * W-01-02 — 계약 경로는 결재함과 같은 `/app/approval-requests`인데 주소 앞머리는
       * **사이드바 섹션을 따라** `/logistics/`다. 판정하는 것이 자재 입하 검사의 생략이라
       * 그 판단의 맥락이 이 섹션에 있다(설계 스펙의 breadcrumb도 「자재창고」다).
       *
       * **세 PR이 함께 여는 자리다.** 목록·상세까지만 선 상태에서는 이 줄을 두지 않았다 —
       * 결재할 수 없는 판정 화면을 노출하면 승인자가 **판단 근거를 다 보고서도 아무것도
       * 할 수 없다**(정책 §5.2 — 접근 불가능한 경계).
       */
      { path: 'logistics/iqc-skip-approval', element: <IqcSkipApprovalScreen /> },
      /*
       * W-01-13 — 앞머리는 같은 규칙(사이드바 섹션)을 따른다. 계약 경로도 `/logistics/**`라 둘이
       * **우연히 같지만** 근거는 여기서도 섹션이다 — 계약을 근거로 삼았다면 W-01-07·W-01-12에서
       * 앞머리가 갈렸을 것이다(그쪽 계약은 `/inventory/**`인데 주소는 `/logistics/`다).
       *
       * ⛔ **취소 리소스의 이름을 주소로 삼지 않는다.** 이 화면이 취소를 보내는 계약 경로는 셋이고
       * (`goods-receipts`·`inbound-receipts`·`goods-issues`) 그 셋은 이미 다른 화면들이 쓴다 —
       * 리소스를 주소로 삼으면 한 주소를 여러 화면이 다툰다. 주소는 **화면**을 가리킨다.
       *
       * **차례는 「자재창고」 섹션의 맨 뒤다.** 앞의 여덟이 물건이 오가는 순서이고(예정 → 초과
       * 분리 → 입고 → 재고 확인 → 실사 → 조정 → 반품 → 폐기) 「긴급 IQC 생략」이 그 흐름 위에서
       * 예외를 허가하는 자리인데, 이 화면은 그 흐름이 **남긴 문서들을 가로질러 보고 되돌리는**
       * 일이라 순서에 끼워 넣을 자리가 없다(`master-data/master-change`가 같은 이유로 마스터
       * 항목들 뒤에 섰다).
       *
       * **다섯 PR이 함께 여는 자리다.** 목록·상세·취소 요청·승인 진행·취소 실행이 다 서기 전에는
       * 이 줄을 두지 않았다 — 취소는 반드시 승인을 타는데 실행할 자리가 없는 채로 열면 사용자가
       * **승인을 받아 놓고 아무것도 할 수 없다**(정책 §5.2 — 접근 불가능한 경계).
       *
       * ⚠ **지금 이 화면은 목록을 한 번도 부르지 못한다.** 문서 유형 값 목록이 아직 확정되지 않아
       * (자리표시 빈 표) 계약이 필수로 두는 질의값을 만들 수 없고, 화면은 그 사실을 말하는 안내만
       * 낸다. 그럼에도 여는 이유는 **남은 것이 값 하나뿐**이라는 것이다 — 취소 실행까지 다 서
       * 있어 표가 채워지는 순간 화면 전체가 저절로 살아난다.
       */
      { path: 'logistics/document-progress', element: <DocumentProgressScreen /> },
      /* W-02-05 — 생산실행의 첫 공개 화면이며 주소는 API 리소스가 아니라 화면을 가리킨다. */
      { path: 'production/work-order-close', element: <WorkOrderCloseScreen /> },
      /*
       * W-03-01 — Lot Status 계열의 첫 화면이므로 품질관리 섹션을 연다.
       * 계약의 /quality/**와 주소 앞머리가 같지만 근거는 사이드바 업무 섹션이다.
       * 현재 LOT 상태와 보류 등록·해제 이력을 함께 보는 조회 화면이다.
       */
      { path: 'quality/lot-status', element: <LotStatusHistoryScreen /> },
      /*
       * W-CO-09 — 앞머리는 같은 규칙(사이드바 섹션)이고 계약 경로(`/app/**`)를 따르지 않는다.
       * 결재함은 기준정보도 시스템 운영도 아니라 **일하는 자리**여서 섹션을 새로 연다.
       *
       * **세 PR이 함께 여는 자리다.** 목록·상세까지만 선 상태에서는 이 줄을 두지 않았다 —
       * 결재할 수 없는 「결재함」을 노출하면 사용자가 **자기 차례인 요청을 보면서 아무것도
       * 할 수 없다**(정책 §5.2 — 접근 불가능한 경계).
       */
      /*
       * W-05-12 — **도메인 05(설비/툴)의 첫 화면이자 주소 앞머리 `/equipment`의 첫 자리다.**
       *
       * 앞머리는 **사이드바 섹션(도메인)을 따른다** — 계약 경로는 `/mdm/**`이지만 그것이
       * 근거가 아니다(기준정보 화면들이 이미 같은 규칙을 쓴다). 한정어 없는 `master`가
       * 설비 마스터인 이유는 이 섹션의 주어가 「설비」이기 때문이며, 뒤따르는 형제들은
       * 자기 이름을 붙인다(`tool-master`·`gauge-master`·`work-calendar`…).
       *
       * **여섯 PR이 함께 여는 자리다.** 그룹 목록·등록·수정·중지와 설비 목록·등록·수정·중지가
       * 다 서기 전에는 이 줄을 두지 않았다 — 그룹만 있고 설비를 붙일 수 없는 「설비 마스터」를
       * 노출하면 사용자가 화면을 열어 놓고 할 일을 할 수 없다(정책 §5.2 — 접근 불가능한 경계).
       *
       * ⚠ **점검 항목은 아직 없다.** 이 화면의 범위인지 설계에 물어 두었고(`omf-mes#186`),
       * 범위라면 별도 슬라이스로 잇는다. 착수 이슈가 적은 범위 — 설비와 설비 그룹 — 는
       * 이것으로 완결된다.
       */
      { path: 'equipment/master', element: <EquipmentMasterScreen /> },
      /*
       * W-05-11 — **라우트만 연다. 사이드바에는 두지 않는다.**
       *
       * 이 화면은 `equipmentTypeCode` 로 계측기를 가려내는데 **그 값 목록이 아직 없다**
       * (설계 질의 `omf-mes#195` · 추적 `#145`). 그동안은 조건을 걸지 않고 전체 설비를
       * 보이며 배너로 그 사실을 밝힌다 — 조건을 걸면 목록이 늘 비어 화면이 통째로 죽는다.
       *
       * ⚠ **그 상태를 「계측기 마스터」라는 이름의 메뉴로 여는 것이 맞는지 설계에 물어 두었고,
       * 회신 전까지 메뉴를 세우지 않는다.** 메뉴 이름은 사용자에게 「여기 있는 것은 계측기다」를
       * 약속하는데 지금은 그렇지 않다 — 배너가 있어도 메뉴 이름이 먼저 읽힌다.
       * 값 목록이 들어오면 배너가 저절로 사라지고, 그때 메뉴 한 줄만 더하면 된다.
       *
       * 라우트를 먼저 여는 이유는 **주소가 회신이 걸릴 자리**이기 때문이다 — 메뉴도 다른
       * 화면의 링크도 이 주소를 가리키게 되고, 주소가 없으면 어느 쪽도 이을 수 없다.
       * 형제 화면(W-05-12)의 검교정 주기 칸이 「계측기 마스터에서 정합니다」라고 말하고 있어
       * **거기서 이리로 잇는 링크**가 다음 자리다(그 링크는 저장하지 않은 입력을 버리게 되므로
       * 파기 확인과 함께 가야 한다 — 이 슬라이스에 넣지 않는다).
       *
       * 앞머리는 형제와 같은 규칙(사이드바 섹션)을 따르고, 이름은 위 주석이 예고한 대로
       * `gauge-master` 다 — 한정어 없는 `master` 는 이 섹션의 주어인 설비의 것이다.
       *
       * ⭐ **미루던 이유가 없어져 메뉴를 세웠다**(설계 회신 `omf-mes#195` · 시드 `omf-mes#182`).
       * 유형 값 목록이 확정돼 사용자가 실제로 계측기만 골라 볼 수 있으므로 이름이 더는
       * 거짓이 아니다. 이제 메뉴에 서지 않는 화면은 W-01-11 하나뿐이다 — 그쪽은 **맥락 없는
       * 진입이 요구사항 위반**이라 영영 두지 않는 것이라 수명이 다르다.
       */
      { path: 'equipment/gauge-master', element: <GaugeMasterScreen /> },
      /*
       * W-05-13 — **라우트와 메뉴를 함께 연다.**
       *
       * ⭐ **형제(W-05-11)와 갈리는 자리다.** 그쪽은 계측기 전용 자원이 없어 전체 설비를
       * 보이는 중이라 「계측기 마스터」라는 메뉴 이름이 약속을 어긴다. 이쪽은 **자원이 따로
       * 있어**(`/mdm/molds`) 목록에 서는 것이 정확히 툴이다 — 도구 유형 값 목록이 미결이지만
       * (`omf-mes#145`) 그것은 **좁히는 축 하나**이지 목록의 내용을 정하는 조건이 아니다.
       * 메뉴 이름이 참이므로 미룰 이유가 없다.
       *
       * **네 PR이 함께 여는 자리다.** 목록·등록/수정·사용 중지/폐기·엑셀 올리기가 다 선 뒤에
       * 연다 — 등록할 수 없는 「마스터」를 노출하면 사용자가 화면을 열어 놓고 할 일을 할 수
       * 없다(정책 §5.2 — 접근 불가능한 경계).
       *
       * 앞머리는 형제들과 같은 규칙(사이드바 섹션)을 따르고, 이름은 W-05-12 주석이 예고한
       * 대로 `tool-master` 다 — 한정어 없는 `master` 는 이 섹션의 주어인 설비의 것이다.
       */
      { path: 'equipment/tool-master', element: <ToolMasterScreen /> },
      /*
       * W-05-09 — **라우트와 메뉴를 함께 연다.**
       *
       * **일곱 PR이 함께 여는 자리다.** 캘린더 목록·등록/수정 · 사용 중지 · 달력 그리드 ·
       * 하루 편집 · 일괄 적용 · 적용 대상 · 해석 미리보기가 다 선 뒤에 연다 — 일자를 고칠 수
       * 없는 「작업 캘린더 설정」을 노출하면 사용자가 화면을 열어 놓고 할 일을 할 수 없다
       * (정책 §5.2 — 접근 불가능한 경계).
       *
       * ⚠ **사유 코드 값 목록이 미결이지만 메뉴를 미루지 않는다**(`omf-mes#145`).
       * 사유는 계약이 **선택**으로 둔 값이라 비워 두어도 저장되고, 목록의 내용을 정하는
       * 조건도 아니다 — 「작업 캘린더 설정」이라는 메뉴 이름이 약속하는 것은 그대로 참이다.
       * (형제 W-05-11 이 메뉴를 미룬 것과 갈리는 근거다.)
       *
       * 앞머리는 형제들과 같은 규칙(사이드바 섹션)을 따르고, 이름은 W-05-12 주석이 예고한
       * 대로 `work-calendar` 다.
       */
      { path: 'equipment/work-calendar', element: <WorkCalendarScreen /> },
      /*
       * W-05-07 — **라우트와 메뉴를 함께 연다.**
       *
       * **다섯 PR이 함께 여는 자리다.** 설비별 채널 목록 · 등록/수정 · 검사 항목 연결 ·
       * 수신 로그에서 가져오기 · 사용 여부가 다 선 뒤에 연다 — **잇지 못하는 「매핑 관리」를
       * 노출하면 사용자가 미매핑 채널을 보면서 아무것도 할 수 없다**(정책 §5.2 — 접근
       * 불가능한 경계). 이 화면은 특히 그렇다: 목록만 있으면 「값이 버려진다」는 경고만
       * 읽히고 그것을 멈출 방법이 화면에 없다.
       *
       * ⚠ **계약이 이어 둔 검사 항목의 이름을 내려주지 않지만 메뉴를 미루지 않는다**
       * (`omf-mes#203`). 그것은 **표시의 한계**이지 「수집 채널 매핑 관리」라는 이름이
       * 약속하는 것 — 채널을 항목에 잇는 자리 — 을 어기지 않는다. 잇는 일은 온전히 된다.
       * (형제 W-05-11 이 메뉴를 미룬 것과 갈리는 근거다. 그쪽은 목록에 서는 것이 계측기가
       * 아니어서 **이름 자체가 거짓**이었다.)
       *
       * 앞머리는 형제들과 같은 규칙(사이드바 섹션)을 따른다. 이름은 `collection-channels` 로
       * **복수**다 — 형제들이 단수인 것은 그것들이 「마스터」라는 한 벌을 가리키기 때문이고,
       * 이 화면이 다루는 것은 설비마다 여럿인 채널이다.
       */
      { path: 'equipment/collection-channels', element: <CollectionChannelScreen /> },
      /*
       * W-05-01 — **라우트와 메뉴를 함께 연다. 도메인 05 의 마지막 화면이다.**
       *
       * **다섯 PR이 함께 여는 자리다.** 비율 목록 · 등록/수정 · 종료 · 환산 스위치 ·
       * 미리보기가 다 선 뒤에 연다 — **비율을 정할 수 없는 「파라미터 설정」을 노출하면
       * 사용자가 스위치만 켜 놓고 아무것도 못 한다**(정책 §5.2 — 접근 불가능한 경계).
       *
       * ⚠ **낙관적 잠금이 이 자원에 없지만 메뉴를 미루지 않는다**(`omf-mes#210`).
       * 그것은 **동시 편집에서만 드러나는 한계**이지 「타발수 환산 파라미터 설정」이라는
       * 이름이 약속하는 것 — 비율과 사용 여부를 정하는 자리 — 을 어기지 않는다.
       * 정하는 일은 온전히 된다.
       *
       * 앞머리는 형제들과 같은 규칙(사이드바 섹션)을 따른다. 이름은 `shot-conversion` 이다 —
       * 계약 경로는 `/app/operation-policies` 지만 그것은 **여러 화면이 나눠 쓰는 범용 표**라
       * 주소로 삼으면 이 화면이 그 표 전체를 다루는 것처럼 읽힌다. 화면이 정하는 것의
       * 이름을 쓴다.
       */
      { path: 'equipment/shot-conversion', element: <ShotConversionScreen /> },
      { path: 'approval/inbox', element: <ApprovalInboxScreen /> },
      /*
       * W-CO-03 — 계약 경로는 `/app/notifications`인데 앞머리는 같은 규칙(사이드바 섹션)을
       * 따른다. 알림은 **자기 섹션**을 갖는다 — 설계의 IA가 「시스템/공통 > 알림」으로 두었고,
       * 뒤따르는 알람 수신자 설정·공지가 같은 섹션에 들어온다.
       *
       * ⛔ **「시스템 관리」에 넣지 않는다.** 그 섹션은 **관리자가 남을 설정하는 자리**인데
       * (사용자·역할·권한 · 결재선 정의) 알림센터는 **누구나 자기가 받은 것을 보는 자리**다.
       *
       * **네 PR이 함께 여는 자리다.** 기간·목록·조건·쪽 이동·읽음 처리가 다 선 뒤에 연다 —
       * 읽음으로 바꿀 수 없는 동안에는 이 줄을 두지 않았다(정책 §5.2 — 접근 불가능한 경계).
       * 알림은 계속 쌓이는데 지울 수도 읽음으로 바꿀 수도 없으면 화면이 늘 밀린 것으로 보인다.
       */
      { path: 'notification/center', element: <NotificationCenterScreen /> },
    ],
  },
  /*
   * W-CO-01 — **셸 자식이 아닌 첫 라우트다.** 위 배열의 형제로 서서 `AppLayout`을 지나지 않는다.
   *
   * 근거: 아직 로그인하지 않은 사람에게 사이드바를 보이면 **누를 수 없는 항목만 늘어선 화면**이
   * 된다. 링크가 서 있으니 눌러 보고, 눌러도 아무 일이 없거나 같은 로그인 화면으로 되돌아온다 —
   * 그 자리에서 사용자가 배우는 것은 「이 앱은 고장 났다」다. 상단 바의 사용자 이름 자리도
   * 비어 있어야 할 이유가 없는 자리에 비어 선다.
   *
   * 대안 둘을 버린 이유. **셸 안에 두고 사이드바만 감추는 것**은 셸이 「인증 상태」를 알아야
   * 하므로 지금 두지 않기로 한 라우트 가드를 셸에 흘려 넣는다. **별도 라우터**는 라우트 표가
   * 둘이 되어 「이 주소가 어디 있는가」를 두 곳에서 찾게 만든다.
   *
   * ⛔ **사이드바에 올리지 않는다.** 로그인은 메뉴 항목이 아니다 — 이미 로그인한 사람에게는
   * 죽은 항목이고, 로그인하지 않은 사람은 그 메뉴를 볼 수 없다(이 화면에 사이드바가 없다).
   * W-01-11이 세운 규율(라우트만 열고 메뉴에 두지 않는다)과 같은 형태이며, 근거는 다르다 —
   * 그쪽은 맥락 없는 진입을 막는 것이고 이쪽은 **메뉴가 성립하지 않는 것**이다.
   *
   * ⚠ **이 라우트는 접근을 제한하지 않는다.** 미인증 상태로 다른 주소에 들어가는 길은 그대로
   * 열려 있다(라우트 가드는 이 작업의 범위 밖 — 후속 작업). 로그인 화면이 생겼다는 것이
   * 보호가 생겼다는 뜻이 아니다.
   */
  { path: '/login', element: <LoginScreen /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
