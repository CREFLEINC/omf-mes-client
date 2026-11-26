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
    q: 'Tìm nhân viên',
    qPlaceholder: 'Nhập mã NV hoặc họ tên',
    plant: 'Chọn nhà máy',
    department: 'Chọn bộ phận',
    includeInactive: 'Bao gồm đã nghỉ việc',
  },
  filters: {
    allPlants: 'Tất cả nhà máy',
    allDepartments: 'Tất cả bộ phận',
  },
  table: {
    workerNo: 'Mã NV',
    workerName: 'Họ tên',
    businessUnitId: 'Đơn vị kinh doanh',
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
    goFirstPage: 'Về trang đầu',
  },
  loading: {
    list: 'Đang tải danh sách nhân viên',
  },
  empty: {
    noResultTitle: 'Không có nhân viên phù hợp',
    beyondLastTitle: 'Trang này không có nhân viên',
  },
};
