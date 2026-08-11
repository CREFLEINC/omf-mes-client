import { Navigate, Outlet, createBrowserRouter } from 'react-router';

import { AppLayout } from '../app/layout';
import { JudgmentCodeScreen } from '../screens/common-code/judgment-code-screen';
import { CommonCodeScreen } from '../screens/common-code/screen';
import { DefectCauseCodeScreen } from '../screens/defect-cause-code/screen';
import { GoodsReceiptScreen } from '../screens/goods-receipt/screen';
import { InboundScheduleScreen } from '../screens/inbound-schedule/screen';
import { InspectionStandardScreen } from '../screens/inspection-standard/screen';
import { IntegrationSyncScreen } from '../screens/integration-sync/screen';
import { ItemExtendedAttrsScreen } from '../screens/item-extended-attrs/screen';
import { MasterChangeScreen } from '../screens/master-change/screen';
import { OverReceiptSplitScreen } from '../screens/over-receipt-split/screen';
import { RoutingScreen } from '../screens/routing/screen';
import { StockStatusScreen } from '../screens/stock-status/screen';
import { StocktakingScreen } from '../screens/stocktaking/screen';
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
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
