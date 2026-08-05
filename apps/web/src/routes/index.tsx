import { Navigate, Outlet, createBrowserRouter } from 'react-router';

import { AppLayout } from '../app/layout';
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
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
