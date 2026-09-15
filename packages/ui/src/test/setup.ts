import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/*
 * RTL 의 자동 청소는 전역 `afterEach` 가 있을 때만 붙는다. 이 저장소는 vitest `globals` 를
 * 켜지 않으므로 여기서 직접 잇는다 — 없으면 앞 시험의 DOM 이 남아 역할 조회가 둘씩 잡힌다.
 * (@omf-mes/web 의 같은 자리와 같은 이유.)
 */
afterEach(() => {
  cleanup();
});
