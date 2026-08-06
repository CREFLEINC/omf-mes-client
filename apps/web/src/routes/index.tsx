import { Navigate, Outlet, createBrowserRouter } from 'react-router';

import { AppLayout } from '../app/layout';
import { DefectCauseCodeScreen } from '../screens/defect-cause-code/screen';
import { RoutingScreen } from '../screens/routing/screen';
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
      { path: 'master-data/defect-cause-code', element: <DefectCauseCodeScreen /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
