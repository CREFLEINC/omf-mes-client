import type { ko } from '../ko';
import type { Translated } from './translated';

/** POP 목록의 쪽 넘김 문구 — 여러 화면이 함께 쓴다. */
export const popPageNav: Translated<typeof ko.popPageNav> = {
  pageUp: 'Trang trên',
  pageDown: 'Trang dưới',
  position: (page: number, totalPages: number): string =>
    `Trang ${String(page)} / ${String(totalPages)}`,
};
