import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu mã chung (ERP). Chỉ đọc — dữ liệu nhận từ ERP. */
export const erpCommonCode: Translated<typeof ko.erpCommonCode> = {
  title: 'Tra cứu mã chung (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  splitter: 'Kéo để điều chỉnh độ rộng nhóm mã·giá trị mã',
  listCollapse: 'Thu gọn nhóm mã ERP',
  listExpand: 'Mở nhóm mã ERP',
  groups: {
    label: 'Nhóm mã ERP',
    groupCode: 'Mã nhóm',
    groupName: 'Tên nhóm',
    description: 'Mô tả',
    isActive: 'Sử dụng',
    openAction: (groupCode: string): string => `Xem giá trị mã của ${groupCode}`,
    count: (count: number): string => `${String(count)} nhóm`,
  },
  values: {
    label: 'Giá trị mã',
    labelOf: (groupCode: string): string => `Giá trị mã ${groupCode}`,
    selectHint: 'Hãy chọn nhóm mã',
    code: 'Mã',
    codeName: 'Tên mã',
    displayOrder: 'Thứ tự hiển thị',
    effectiveFrom: 'Hiệu lực từ',
    effectiveTo: 'Hiệu lực đến',
    isActive: 'Sử dụng',
  },
  fields: {
    q: 'Mã·Tên mã',
    includeInactive: 'Bao gồm ngừng sử dụng',
  },
  display: {
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
    groups: 'Đang tải nhóm mã ERP',
    values: 'Đang tải giá trị mã',
  },
  empty: {
    noGroupsTitle: 'Chưa có nhóm mã nhận từ ERP',
    noValuesTitle: 'Không có giá trị mã phù hợp',
    beyondLastTitle: 'Trang này không có giá trị mã',
  },
};
