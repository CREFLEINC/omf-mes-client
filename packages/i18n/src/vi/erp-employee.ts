import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu thông tin nhân viên (ERP). Chỉ đọc — dữ liệu nhận từ ERP. */
export const erpEmployee: Translated<typeof ko.erpEmployee> = {
  title: 'Tra cứu thông tin nhân viên (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  readOnlyNote: 'Thông tin nhân viên nhận từ ERP. Không thể sửa trong MES.',
  fields: {
    q: 'Mã NV·Họ tên',
    includeInactive: 'Bao gồm đã nghỉ việc',
  },
  table: {
    workerNo: 'Mã NV',
    workerName: 'Họ tên',
    nameKo: 'Tên tiếng Hàn',
    nameVi: 'Tên tiếng Việt',
    plantId: 'Nhà máy',
    departmentId: 'Bộ phận',
    statusCode: 'Trạng thái ERP',
    isActive: 'Đang làm việc',
  },
  detail: {
    label: 'Chi tiết nhân viên',
    openAction: (workerNo: string): string => `Xem chi tiết ${workerNo}`,
    businessUnitId: 'Đơn vị kinh doanh',
    appUserId: 'Người dùng liên kết',
    selectHint: 'Chọn một nhân viên trong danh sách để xem chi tiết.',
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
    detail: 'Đang tải chi tiết nhân viên',
  },
  empty: {
    noResultTitle: 'Không có nhân viên phù hợp',
    noResultDescription: 'Hãy đổi từ khóa hoặc bật bao gồm đã nghỉ việc.',
    beyondLastTitle: 'Trang này không có nhân viên',
    beyondLastDescription: 'Hãy quay về trang đầu.',
  },
};
