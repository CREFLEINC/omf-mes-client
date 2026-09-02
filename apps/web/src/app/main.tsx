import '@crefle/web-ui/styles/index.css';
import '@crefle/web-ui/css';
import './app.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { appRouter } from '../routes';
import { syncDocumentTitle } from './document-title';
import { AppProviders } from './providers';

const container = document.getElementById('root');
if (!container) {
  throw new Error('root 요소가 index.html에 없습니다');
}

/*
 * ⛔ **라우터 밖에서 건다.** 라우트 표 안에 감싸는 요소를 넣으면 POP 라우트가 「최상위 라우트로
 *    서 있는가」를 지키는 잣대가 깨지고, 화면마다 훅을 부르게 하면 새 POP 화면이 그것을
 *    빠뜨려도 아무 데서도 안 보인다. 제목은 화면의 일이 아니라 셸의 일이다.
 */
syncDocumentTitle(appRouter);

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={appRouter} />
    </AppProviders>
  </StrictMode>,
);
