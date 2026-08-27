import { Outlet, createBrowserRouter } from 'react-router';

import { AppLayout } from '../app/layout';
import { ShellHome } from '../app/shell-home';
import { MaterialLocationScreen } from '../screens/material-location/screen';

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: (
      <AppLayout>
        <Outlet />
      </AppLayout>
    ),
    children: [
      { index: true, element: <ShellHome /> },
      { path: 'material-location', element: <MaterialLocationScreen /> },
    ],
  },
]);
