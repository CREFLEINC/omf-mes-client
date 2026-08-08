import { Navigate, Outlet, createBrowserRouter } from 'react-router';

import { AppLayout } from '../app/layout';
import { JudgmentCodeScreen } from '../screens/common-code/judgment-code-screen';
import { CommonCodeScreen } from '../screens/common-code/screen';
import { DefectCauseCodeScreen } from '../screens/defect-cause-code/screen';
import { InboundScheduleScreen } from '../screens/inbound-schedule/screen';
import { InspectionStandardScreen } from '../screens/inspection-standard/screen';
import { IntegrationSyncScreen } from '../screens/integration-sync/screen';
import { ItemExtendedAttrsScreen } from '../screens/item-extended-attrs/screen';
import { MasterChangeScreen } from '../screens/master-change/screen';
import { RoutingScreen } from '../screens/routing/screen';
import { StockStatusScreen } from '../screens/stock-status/screen';
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
       * W-01-07 — 앞머리는 **사이드바 섹션(도메인)을 따른다.** 계약 경로와 같아지는 경우가
       * 많지만 그것이 근거는 아니다: 이 화면의 계약 경로는 `/inventory/**`·`/trace/**`인데
       * 화면은 「자재창고」 섹션에 들어간다. 한 섹션 안의 화면들이 서로 다른 앞머리를 가지면
       * 사용자와 개발자 모두 섹션과 주소를 대응시킬 수 없다.
       */
      { path: 'logistics/stock-status', element: <StockStatusScreen /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
