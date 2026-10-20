import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu đối tác (ERP). Chỉ đọc — dữ liệu nhận từ ERP. */
export const erpPartner: Translated<typeof ko.erpPartner> = {
  title: 'Tra cứu đối tác (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  readOnlyNote: 'Đối tác nhận từ ERP. Không thể sửa trong MES.',
  fields: {
    q: 'Mã·Tên đối tác',
    role: 'Vai trò',
    includeInactive: 'Bao gồm ngừng sử dụng',
  },
  table: {
    partnerCode: 'Mã đối tác',
    partnerName: 'Tên đối tác',
    erpPartnerCode: 'Mã đối tác ERP',
    countryCode: 'Quốc gia',
    roles: 'Vai trò',
    isActive: 'Sử dụng',
  },
  roleNames: {
    customer: 'Khách hàng',
    supplier: 'Nhà cung cấp',
    subcontractor: 'Nhà gia công',
    disposal: 'Đơn vị xử lý phế thải',
    other: 'Khác',
  },
  detail: {
    label: 'Chi tiết đối tác',
    openAction: (partnerCode: string): string => `Xem chi tiết ${partnerCode}`,
    selectHint: 'Chọn một đối tác trong danh sách để xem chi tiết.',
  },
  values: {
    all: 'Tất cả',
    empty: '—',
    active: 'Sử dụng',
    inactive: 'Ngừng sử dụng',
    rolesLoading: 'Đang tải',
    rolesFailed: 'Không tải được',
    roleSeparator: ', ',
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
    list: 'Đang tải danh sách đối tác',
    detail: 'Đang tải chi tiết đối tác',
  },
  empty: {
    noResultTitle: 'Không có đối tác phù hợp',
    noResultDescription: 'Hãy đổi từ khóa, vai trò hoặc bật bao gồm ngừng sử dụng.',
    beyondLastTitle: 'Trang này không có đối tác',
    beyondLastDescription: 'Hãy quay về trang đầu.',
  },
};
