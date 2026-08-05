import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
