import type { ko } from '../ko';
import type { Translated } from './translated';

/** POP 목록의 쪽 넘김 문구 — 여러 화면이 함께 쓴다. */
export const popPageNav: Translated<typeof ko.popPageNav> = {
  prev: 'Trước',
  next: 'Sau',
  position: (page: number, totalPages: number): string =>
    `${String(page)} / ${String(Math.max(totalPages, 1))}`,
};
