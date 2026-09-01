import { Outlet, createBrowserRouter, type RouteObject } from 'react-router';

import { AppLayout } from '../app/layout';
import { ShellGate } from '../app/shell-gate';
import { ShellHome } from '../app/shell-home';
import { WorkerSignInScreen } from '../screens/device-registration/sign-in';
import { EquipmentFailureScreen } from '../screens/equipment-failure/screen';
import { MaterialLocationScreen } from '../screens/material-location/screen';
import { OutboxRejectionsScreen } from '../screens/outbox-rejections/screen';

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
      { path: 'material-location', element: <MaterialLocationScreen /> },
      { path: 'equipment-failure', element: <EquipmentFailureScreen /> },
      { path: 'rejections', element: <OutboxRejectionsScreen /> },
    ],
  },
];

export const appRouter = createBrowserRouter(appRoutes);
