import type { ko } from '../ko';
import type { Translated } from './translated';

/** POP 본문 통일 부품 문구(#295). */
export const popUniform: Translated<typeof ko.popUniform> = {
  scan: {
    ready: 'Chờ quét',
    done: 'Đã quét',
    manual: 'Nhập tay',
    search: 'Tìm',
    manualTitle: (label: string): string => `Nhập ${label}`,
    manualPlaceholder: (label: string): string => `Hãy nhập ${label}`,
  },
  keypad: {
    noTarget: 'Hãy chạm vào ô cần nhập',
    clearAll: 'Xóa hết',
    backspace: 'Xóa một ký tự',
    region: 'Bàn phím số',
  },
  textKeyboard: {
    region: 'Bàn phím chữ',
    shift: 'Chữ hoa',
    lang: '한/EN',
    symbols: 'Ký hiệu',
    space: 'Dấu cách',
  },
  /** 왼쪽 목록 위 찾기 칸(`PuSearchBox`). */
  search: {
    clear: 'Xóa từ khóa',
  },
  pager: {
    total: (total: number): string => `Tổng ${String(total)}`,
    position: (page: number, pages: number): string =>
      `${String(page)} / ${String(Math.max(pages, 1))}`,
    prev: 'Trang trước',
    next: 'Trang sau',
  },
  dialog: {
    cancel: 'Hủy',
    close: 'Đóng',
    confirm: 'Xác nhận',
  },
  pick: {
    search: (title: string): string => `Tìm ${title}`,
    empty: 'Không có mục phù hợp',
  },
  fold: {
    fold: (name: string): string => `Thu gọn ${name}`,
    open: (name: string): string => `Mở ${name}`,
  },
  order: {
    label: 'Sắp xếp',
    newest: 'Mới nhất',
    oldest: 'Cũ nhất',
  },
  help: 'Trợ giúp',
  remove: 'Bỏ',
};
