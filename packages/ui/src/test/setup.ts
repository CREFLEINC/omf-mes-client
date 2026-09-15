import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * 비동기 조회(`findBy*`·`waitFor`)가 기다리는 한도 (#1072).
 *
 * ⛔ **`--testTimeout` 이 이 값을 정하지 않는다** — 그것은 vitest 의 시험 단위 제한이고 Testing
 * Library 는 자기 한도를 쓴다(설정하지 않으면 1000ms). 짝은 `vitest.config.ts` 의 `testTimeout`
 * 이며 이 값보다 위여야 한다. 값과 사정은 `@omf-mes/web` 의 같은 자리에 적어 두었다 — 형제
 * 패키지가 서로 다른 한도로 도는 데서 오는 이득이 없다.
 */
const ASYNC_UTIL_TIMEOUT_MS = 5000;

configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS });

/*
 * RTL 의 자동 청소는 전역 `afterEach` 가 있을 때만 붙는다. 이 저장소는 vitest `globals` 를
 * 켜지 않으므로 여기서 직접 잇는다 — 없으면 앞 시험의 DOM 이 남아 역할 조회가 둘씩 잡힌다.
 * (@omf-mes/web 의 같은 자리와 같은 이유.)
 */
afterEach(() => {
  cleanup();
});
