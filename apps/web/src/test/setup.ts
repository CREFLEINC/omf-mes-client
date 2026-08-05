import '@testing-library/jest-dom/vitest';

// jsdom이 구현하지 않는 <dialog> API의 방어적 보완. 이미 있으면 덮어쓰지 않는다.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};
