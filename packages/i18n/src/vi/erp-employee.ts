import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu thông tin nhân viên (ERP). Chỉ đọc — dữ liệu nhận từ ERP. */
export const erpEmployee: Translated<typeof ko.erpEmployee> = {
  title: 'Tra cứu thông tin nhân viên (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  panes: {
    filter: 'Điều kiện tra cứu',
    list: 'Danh sách nhân viên',
  },
  fields: {
    q: 'Mã NV·Họ tên',
    includeInactive: 'Bao gồm đã nghỉ việc',
  },
  table: {
    workerNo: 'Mã NV',
    workerName: 'Họ tên',
    plantId: 'Nhà máy',
    departmentId: 'Bộ phận',
    statusCode: 'Trạng thái ERP',
    isActive: 'Đang làm việc',
  },
  values: {
    empty: '—',
    active: 'Đang làm việc',
    inactive: 'Đã nghỉ việc',
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
    list: 'Đang tải danh sách nhân viên',
  },
  empty: {
    noResultTitle: 'Không có nhân viên phù hợp',
    beyondLastTitle: 'Trang này không có nhân viên',
  },
};
