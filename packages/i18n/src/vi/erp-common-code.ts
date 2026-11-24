import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu mã chung (ERP). Chỉ đọc — dữ liệu nhận từ ERP. */
export const erpCommonCode: Translated<typeof ko.erpCommonCode> = {
  title: 'Tra cứu mã chung (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  panes: {
    filter: 'Điều kiện tra cứu',
    detail: 'Chi tiết nhóm mã',
  },
  groups: {
    label: 'Danh sách nhóm mã ERP',
    groupCode: 'Mã nhóm',
    groupName: 'Tên nhóm',
    description: 'Mô tả',
    isActive: 'Sử dụng',
  },
  values: {
    label: 'Giá trị mã',
    labelOf: (groupCode: string): string => `Giá trị mã ${groupCode}`,
    filterLabel: 'Điều kiện tra cứu giá trị mã',
    code: 'Mã',
    codeName: 'Tên mã',
    displayOrder: 'Thứ tự hiển thị',
    effectiveFrom: 'Hiệu lực từ',
    effectiveTo: 'Hiệu lực đến',
    isActive: 'Sử dụng',
  },
  fields: {
    groupSearch: 'Tìm nhóm mã',
    groupSearchPlaceholder: 'Nhập mã nhóm hoặc tên nhóm',
    q: 'Tìm giá trị mã',
    qPlaceholder: 'Nhập mã hoặc tên mã',
    includeInactive: 'Bao gồm ngừng sử dụng',
  },
  display: {
    empty: '—',
    active: 'Sử dụng',
    inactive: 'Ngừng sử dụng',
  },
  actions: {
    goFirstPage: 'Về trang đầu',
  },
  loading: {
    groups: 'Đang tải nhóm mã ERP',
    values: 'Đang tải giá trị mã',
  },
  empty: {
    noGroupsTitle: 'Chưa có nhóm mã nhận từ ERP',
    noValuesTitle: 'Không có giá trị mã phù hợp',
    beyondLastTitle: 'Trang này không có giá trị mã',
    noMatchTitle: 'Không có nhóm mã phù hợp',
    pickTitle: 'Hãy chọn nhóm mã.',
    pickDescription: 'Chọn nhóm mã trong danh sách để xem thông tin và các giá trị mã của nhóm.',
  },
};
