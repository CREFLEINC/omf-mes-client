import { Outlet, createBrowserRouter, type RouteObject } from 'react-router';

import { AppLayout } from '../app/layout';
import { ShellGate } from '../app/shell-gate';
import { ShellHome } from '../app/shell-home';
import { WorkerSignInScreen } from '../screens/device-registration/sign-in';
import { MaterialLocationScreen } from '../screens/material-location/screen';

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
    ],
  },
];

export const appRouter = createBrowserRouter(appRoutes);
