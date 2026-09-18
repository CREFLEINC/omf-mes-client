import type { ko } from '../ko';

import type { Translated } from './translated';

/** Hộp thoại chọn mặt hàng — bộ phận dùng chung. Thuật ngữ theo GLOSSARY.md. */
export const itemPicker: Translated<typeof ko.itemPicker> = {
  title: 'Chọn mặt hàng',

  typeLabel: 'Loại',
  typeAll: 'Tất cả',
  typeLoading: 'Đang tải loại mặt hàng…',
  typeFailed: 'Không tải được danh sách loại. Vẫn tìm được với «Tất cả».',

  keywordLabel: 'Từ khóa',
  keywordPlaceholder: 'Mã hoặc tên mặt hàng',
  search: 'Tìm',

  columns: {
    select: 'Chọn',
    itemCode: 'Mã',
    itemName: 'Tên',
    itemType: 'Loại',
    availableQty: 'Khả dụng',
  },

  noResult: 'Không có kết quả. Hãy thử một phần mã hoặc tên.',
  searchFailed: 'Không tìm được mặt hàng.',
  searching: 'Đang tìm…',

  availability: {
    loading: 'Đang tra',
    failed: 'Chưa xác nhận',
  },

  alreadyAdded: 'Đã thêm',

  page: {
    range: (from: number, to: number, total: number): string =>
      `${String(from)}–${String(to)} / tổng ${String(total)}`,
    previous: 'Trước',
    next: 'Sau',
  },

  selectedCount: (count: number): string => `Đã chọn ${String(count)}`,
  cancel: 'Hủy',
  add: 'Thêm dòng',
  replace: 'Đổi',
  needsSelection: 'Chọn mặt hàng thì bấm được.',
};
