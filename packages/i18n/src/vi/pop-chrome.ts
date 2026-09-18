import type { ko } from '../ko';
import type { Translated } from './translated';

/** POP 화면 위에 늘 서 있는 공통 조작 문구 — 모든 POP 화면이 함께 쓴다. */
export const popChrome: Translated<typeof ko.popChrome> = {
  screenNav: 'Chuyển màn hình',
  userSwitch: 'Đổi người dùng',
  workerMissing: 'Chưa xác nhận mã nhân viên. Hãy xác thực mã nhân viên trước.',
  select: 'Chọn',

  selectDialog: {
    fallbackName: 'mục',
    title: (name: string): string => `Chọn ${name}`,
    searchLabel: 'Tìm trong danh sách',
    searchPlaceholder: 'Tìm trong danh sách',
    clearSearch: 'Xóa',
    empty: 'Không có mục nào để hiển thị.',
    position: (page: number, totalPages: number, count: number): string =>
      `${String(page)} / ${String(totalPages)} · Tổng ${String(count)} mục`,
  },
};
