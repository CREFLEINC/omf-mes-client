import { Outlet, createBrowserRouter, type RouteObject } from 'react-router';

import { AppLayout } from '../app/layout';
import { ShellGate } from '../app/shell-gate';
import { ShellHome } from '../app/shell-home';
import { WorkerSignInScreen } from '../screens/device-registration/sign-in';
import { EquipmentFailureScreen } from '../screens/equipment-failure/screen';
import { EquipmentInspectionScreen } from '../screens/equipment-inspection/screen';
import { IqcSkipRequestScreen } from '../screens/iqc-skip-request/screen';
import { InboundReceiptScreen } from '../screens/inbound-receipt/screen';
import { InboundVarianceScreen } from '../screens/inbound-variance/screen';
import { MaterialLocationScreen } from '../screens/material-location/screen';
import { OutboxRejectionsScreen } from '../screens/outbox-rejections/screen';
import { ProductPickingScreen } from '../screens/product-picking/screen';
import { PutawayScreen } from '../screens/putaway/screen';
import { RepairRoundtripScreen } from '../screens/repair-roundtrip/screen';

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
      { path: 'inbound-receipt', element: <InboundReceiptScreen /> },
      { path: 'inbound-variance', element: <InboundVarianceScreen /> },
      { path: 'putaway', element: <PutawayScreen /> },
      { path: 'material-location', element: <MaterialLocationScreen /> },
      { path: 'equipment-failure', element: <EquipmentFailureScreen /> },
      { path: 'equipment-inspection', element: <EquipmentInspectionScreen /> },
      { path: 'iqc-skip-request', element: <IqcSkipRequestScreen /> },
      { path: 'repair-roundtrip', element: <RepairRoundtripScreen /> },
      { path: 'product-picking', element: <ProductPickingScreen /> },
      { path: 'rejections', element: <OutboxRejectionsScreen /> },
    ],
  },
];

export const appRouter = createBrowserRouter(appRoutes);
