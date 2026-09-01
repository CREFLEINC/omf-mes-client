import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL 의 자동 cleanup 은 전역 afterEach 가 있을 때만 등록되는데 이 저장소는 vitest globals 를
// 켜지 않는다. 없으면 이전 테스트의 DOM 이 남아 랜드마크 조회가 중복으로 잡힌다.
afterEach(() => {
  cleanup();
});

/*
 * jsdom 은 dialog 의 showModal·close 를 구현하지 않는다. 없으면 대화상자를 쓰는 화면이
 * 렌더 도중 죽어, 시험이 화면의 잘못이 아닌 것으로 실패한다. open 속성만 맞춰 준다.
 */
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.show ??= function show(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
