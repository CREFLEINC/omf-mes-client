import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * 비동기 조회(`findBy*`·`waitFor`)가 기다리는 한도 (#1072).
 *
 * ⛔ **`--testTimeout` 이 이 값을 정하지 않는다.** 이미지 빌드(`Dockerfile:23`)가
 * `--testTimeout=15000` 을 주지만 그것은 **vitest 의 시험 단위 제한**이고, Testing Library 의
 * 비동기 조회는 **자기 한도(`asyncUtilTimeout`)** 를 쓴다 — 설정하지 않으면 **1000ms** 다.
 *
 * 그래서 이 저장소는 오래도록 「CI 가 15초를 준다」고 여기면서 실제로는 **1초**만 기다리고
 * 있었다. CI 러너는 로컬의 2.5배 느리고(실측 677s vs 266s) 워커 넷이 CPU 를 나눠 쓴다 —
 * 단독 120ms 짜리 조회가 1초를 넘겨 이미지 빌드가 떨어졌다.
 *
 * ⚠ **무한정 키우지 않는다.** 한도는 「이 안에 못 끝나면 결함」이라는 판정이기도 하다. 키울수록
 * 진짜 회귀가 «느린 통과»로 숨는다. 늘려도 **틀린 단언은 그대로 실패한다** — 늦어질 뿐이다.
 *
 * ⭐ **값과 짝은 `@omf-mes/mobile` 에서 그대로 가져왔다.** 그쪽은 같은 증상(단독 통과·전체
 * 실패)을 겪고 이미 이 자리를 메워 두었다 — 형제 앱이 서로 다른 한도로 도는 데서 오는 이득이
 * 없다. 짝은 `vitest.config.ts` 의 `testTimeout` 이며 **이 값보다 위여야 한다**(사정은 그쪽에).
 */
const ASYNC_UTIL_TIMEOUT_MS = 5000;

configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS });

// RTL의 자동 cleanup은 전역 afterEach가 있을 때만 등록된다.
// 이 저장소는 vitest `globals`를 켜지 않으므로 여기서 직접 잇는다.
// 없으면 이전 테스트의 DOM이 남아 랜드마크 조회가 중복으로 잡힌다.
afterEach(() => {
  cleanup();
});

// jsdom이 구현하지 않는 <dialog> API의 방어적 보완. 이미 있으면 덮어쓰지 않는다.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};
