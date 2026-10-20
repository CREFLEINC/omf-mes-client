import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu mặt hàng (ERP). Chỉ đọc — dữ liệu gốc nhận từ ERP. */
export const erpItem: Translated<typeof ko.erpItem> = {
  title: 'Tra cứu mặt hàng (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  readOnlyNote: 'Thông tin nhận từ ERP. Không thể sửa trong MES.',
  fields: {
    q: 'Mã·Tên mặt hàng',
    itemType: 'Loại mặt hàng',
    includeInactive: 'Bao gồm ngừng sử dụng',
  },
  filters: {
    all: 'Tất cả',
  },
  table: {
    itemCode: 'Mã mặt hàng',
    itemName: 'Tên mặt hàng',
    itemType: 'Loại mặt hàng',
    erpSpec: 'Quy cách',
    erpItemGroupCode: 'Nhóm mặt hàng',
    baseUom: 'Đơn vị cơ sở',
    isActive: 'Sử dụng',
  },
  detail: {
    label: 'Chi tiết mặt hàng',
    openAction: (itemCode: string): string => `Xem chi tiết ${itemCode}`,
    selectHint: 'Chọn một mặt hàng trong danh sách để xem chi tiết.',
  },
  values: {
    empty: '—',
    active: 'Sử dụng',
    inactive: 'Ngừng sử dụng',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)}`,
    totalOnly: (total: number): string => `Tổng ${String(total)}`,
  },
  loading: {
    list: 'Đang tải danh sách mặt hàng',
    detail: 'Đang tải chi tiết mặt hàng',
  },
  empty: {
    noResultTitle: 'Không có mặt hàng phù hợp',
    noResultDescription: 'Hãy đổi từ khóa, loại mặt hàng hoặc bật bao gồm ngừng sử dụng.',
    beyondLastTitle: 'Trang này không có mặt hàng',
    beyondLastDescription: 'Hãy quay về trang đầu.',
  },
};
