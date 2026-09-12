import '@crefle/web-ui/styles/index.css';
import '@crefle/web-ui/css';
import './app.css';

import { activeLocale, setLocale } from '@omf-mes/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { startingLocale } from '../patterns/locale-preference';
import { AppProviders } from './providers';
import { localizedLabel, SHELL_BRAND } from './shell-label';

const container = document.getElementById('root');
if (!container) {
  throw new Error('root 요소가 index.html에 없습니다');
}

/*
 * 화면을 싣기 전에 언어를 정한다. 화면 1,539곳이 문구 슬라이스를 모듈 최상위에서 붙잡으므로,
 * 싣고 나서 정하면 이미 붙잡은 자리는 바뀌지 않는다. 그래서 화면을 이 아래에서 동적으로
 * 싣는다 - 정적 import 는 이 줄보다 먼저 돈다(모바일 진입점이 같은 이유로 같은 모양이다).
 *
 * ⛔ POP 진입점(`pop-main.tsx`)은 이것을 부르지 않는다. 부르지 않으면 기본값인 한국어라
 * 단말 화면은 달라지는 것이 없다.
 */
setLocale(startingLocale());
document.documentElement.lang = activeLocale();
/* 탭 이름도 맞춘다 - `index.html` 의 제목은 언어를 정하기 전에 박히는 한국어 한 벌이다. */
document.title = localizedLabel(SHELL_BRAND);

const { appRouter } = await import('../routes');

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={appRouter} />
    </AppProviders>
  </StrictMode>,
);
