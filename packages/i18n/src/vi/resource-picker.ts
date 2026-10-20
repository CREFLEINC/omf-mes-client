import type { ko } from '../ko';

import type { Translated } from './translated';

/** Chọn thiết bị · khuôn — bộ phận dùng chung. */
export const resourcePicker: Translated<typeof ko.resourcePicker> = {
  title: { equipment: 'Chọn thiết bị', mold: 'Chọn khuôn' },
  open: 'Bấm để tìm',
  clear: { equipment: 'Xóa thiết bị', mold: 'Xóa khuôn' },
  keywordLabel: 'Từ khóa',
  keywordPlaceholder: 'Mã hoặc tên',
  search: 'Tìm',
  columns: { select: 'Chọn', code: 'Mã', name: 'Tên' },
  noResult: 'Không có kết quả.',
  searchFailed: 'Không tải được danh sách.',
  searching: 'Đang tìm…',
  page: {
    range: (from: number, to: number, total: number) =>
      `${String(from)}–${String(to)} / tổng ${String(total)}`,
    previous: 'Trước',
    next: 'Sau',
  },
  cancel: 'Hủy',
  pick: 'Chọn',
};
