import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu đối tác (ERP). Chỉ đọc — dữ liệu nhận từ ERP. */
export const erpPartner: Translated<typeof ko.erpPartner> = {
  title: 'Tra cứu đối tác (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  panes: {
    filter: 'Điều kiện tra cứu',
    list: 'Danh sách đối tác',
  },
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
  },
  empty: {
    noResultTitle: 'Không có đối tác phù hợp',
    beyondLastTitle: 'Trang này không có đối tác',
  },
};
