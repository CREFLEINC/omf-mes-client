import '@crefle/web-ui/styles/index.css';
import '@crefle/web-ui/css';
import './app.css';

import { activeLocale, resolveLocale, setLocale } from '@omf-mes/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { AppProviders } from './providers';

const container = document.getElementById('root');
if (!container) {
  throw new Error('root 요소가 index.html에 없습니다');
}

/*
 * 화면을 싣기 전에 언어를 정한다. 화면 33곳이 문구 슬라이스를 모듈 최상위에서 붙잡으므로,
 * 싣고 나서 정하면 이미 붙잡은 자리는 바뀌지 않는다. 그래서 화면을 이 아래에서 동적으로
 * 싣는다 - 정적 import 는 이 줄보다 먼저 돈다.
 */
setLocale(resolveLocale(navigator.languages));
document.documentElement.lang = activeLocale();

const { appRouter } = await import('../routes');

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={appRouter} />
    </AppProviders>
  </StrictMode>,
);
