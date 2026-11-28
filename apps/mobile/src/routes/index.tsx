import { Navigate, Outlet, createBrowserRouter, type RouteObject } from 'react-router';

import { AppLayout } from '../app/layout';
import { ShellGate } from '../app/shell-gate';
import { HomeAreaScreen, ShellHome } from '../app/shell-home';
import { WorkerSignInScreen } from '../screens/device-registration/sign-in';
import { EquipmentFailureScreen } from '../screens/equipment-failure/screen';
import { EquipmentInspectionScreen } from '../screens/equipment-inspection/screen';
import { InboundReceiptScreen } from '../screens/inbound-receipt/screen';
import { InboundCloseScreen } from '../screens/inbound-close/screen';
import { InboundVarianceScreen } from '../screens/inbound-variance/screen';
import { MaterialLocationScreen } from '../screens/material-location/screen';
import { MaterialReturnScreen } from '../screens/material-return/screen';
import { MaterialPickingScreen } from '../screens/material-picking/screen';
import { OutboxPendingScreen } from '../screens/outbox-pending/screen';
import { OutboxRejectionsScreen } from '../screens/outbox-rejections/screen';
import { PackingRepackScreen } from '../screens/packing-repack/screen';
import { PhysicalCountScreen } from '../screens/physical-count/screen';
import { ShopfloorReceiptScreen } from '../screens/shopfloor-receipt/screen';
import { StockTransferScreen } from '../screens/stock-transfer/screen';
import { ProductPickingScreen } from '../screens/product-picking/screen';
import { ProductLotSplitConfirmScreen } from '../screens/product-lot-split-confirm/screen';
import { ProductReceiptScreen } from '../screens/product-receipt/screen';
import { PutawayScreen } from '../screens/putaway/screen';
import { PutawayHistoryScreen } from '../screens/putaway-history/screen';
import { RecycleEntryScreen } from '../screens/recycle-entry/screen';
import { TemporaryPutawayScreen } from '../screens/temporary-putaway/screen';
import { RepairRoundtripScreen } from '../screens/repair-roundtrip/screen';
import { SettingsScreen } from '../screens/settings/screen';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: (
      <AppLayout>
        <ShellGate>
          <Outlet />
        </ShellGate>
      </AppLayout>
    ),
    children: [
      { index: true, element: <WorkerSignInScreen /> },
      { path: 'screens', element: <ShellHome /> },
      { path: 'screens/:area', element: <HomeAreaScreen /> },
      { path: 'inbound-receipt', element: <InboundReceiptScreen /> },
      /* M-01-03 입하 마감(005 · omf-all-around#254) — 입하 중 입하 LOT 마감 · 마감 취소. */
      { path: 'inbound-close', element: <InboundCloseScreen /> },
      { path: 'inbound-variance', element: <InboundVarianceScreen /> },
      { path: 'putaway', element: <PutawayScreen /> },
      /* M-01-15 반납 입고(019 · omf-all-around#367) — 생산창고로 돌아온 자재 LOT 을 받아 위치에 놓는다. */
      { path: 'material-return', element: <MaterialReturnScreen /> },
      { path: 'temporary-putaway', element: <TemporaryPutawayScreen /> },
      /* M-01-14 적치 기록(011 · omf-all-around#325) — 서버에 남은 적치를 내 기록 / 이 단말로. */
      { path: 'putaway-history', element: <PutawayHistoryScreen /> },
      { path: 'recycle-entry', element: <RecycleEntryScreen /> },
      { path: 'material-location', element: <MaterialLocationScreen /> },
      { path: 'material-picking', element: <MaterialPickingScreen /> },
      { path: 'shopfloor-receipt', element: <ShopfloorReceiptScreen /> },
      { path: 'stock-transfer', element: <StockTransferScreen /> },
      { path: 'physical-count', element: <PhysicalCountScreen /> },
      { path: 'equipment-failure', element: <EquipmentFailureScreen /> },
      { path: 'equipment-inspection', element: <EquipmentInspectionScreen /> },
      /*
       * M-02-01 공정 인계(WIP 공정 이동)는 닫았다 — 반제품은 다음 공정 POP 자재 투입으로 넣는다(피처 016 · D-7,
       * 서버 409 HANDOVER_RETIRED). 메뉴는 이미 없고, 주소로 열던 길도 홈으로 넘긴다. 지난 인계 기록은 서버에 남는다.
       */
      { path: 'wip-handover', element: <Navigate to="/screens" replace /> },
      { path: 'repair-roundtrip', element: <RepairRoundtripScreen /> },
      { path: 'product-picking', element: <ProductPickingScreen /> },
      /* M-04-05 LOT 분리 확인(피처 013) — 온라인 전용, 메뉴 배지 없음. */
      { path: 'product-lot-split-confirm', element: <ProductLotSplitConfirmScreen /> },
      { path: 'product-receipt', element: <ProductReceiptScreen /> },
      { path: 'packing-repack', element: <PackingRepackScreen /> },
      { path: 'outbox', element: <OutboxPendingScreen /> },
      { path: 'rejections', element: <OutboxRejectionsScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
];

export const appRouter = createBrowserRouter(appRoutes);
