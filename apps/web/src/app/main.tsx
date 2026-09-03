import '@crefle/web-ui/styles/index.css';
import '@crefle/web-ui/css';
import './app.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { appRouter } from '../routes';
import { AppProviders } from './providers';

const container = document.getElementById('root');
if (!container) {
  throw new Error('root 요소가 index.html에 없습니다');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={appRouter} />
    </AppProviders>
  </StrictMode>,
);
