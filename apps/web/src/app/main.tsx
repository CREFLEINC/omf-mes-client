import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('root 요소가 index.html에 없습니다');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
