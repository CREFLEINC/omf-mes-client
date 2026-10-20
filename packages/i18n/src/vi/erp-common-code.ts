import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu mã chung (ERP). Chỉ đọc — dữ liệu nhận từ ERP. */
export const erpCommonCode: Translated<typeof ko.erpCommonCode> = {
  title: 'Tra cứu mã chung (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  readOnlyNote: 'Mã chung nhận từ ERP. Không thể sửa trong MES.',
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
    selectHint: 'Chọn một nhóm để xem giá trị mã.',
    code: 'Mã',
    codeName: 'Tên mã',
    nameKo: 'Tên tiếng Hàn',
    nameVi: 'Tên tiếng Việt',
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
    noGroupsDescription: 'Liên kết ERP chưa gửi mã chung.',
    noValuesTitle: 'Không có giá trị mã phù hợp',
    noValuesDescription: 'Hãy đổi từ khóa hoặc bật bao gồm ngừng sử dụng.',
    beyondLastTitle: 'Trang này không có giá trị mã',
    beyondLastDescription: 'Hãy quay về trang đầu.',
  },
};
