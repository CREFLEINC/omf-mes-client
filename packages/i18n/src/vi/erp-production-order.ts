import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * Tra cứu ERP W/O (W-06-23). Màn hình **chỉ đọc** ERP W/O nhận từ ERP, đúng như đã nhận.
 */
export const erpProductionOrder: Translated<typeof ko.erpProductionOrder> = {
  title: 'Tra cứu ERP W/O',
  breadcrumbRoot: 'Quản trị hệ thống',
  fields: {
    productionOrderNo: 'Số ERP W/O',
    item: 'Mặt hàng',
    orderQty: 'Số lượng chỉ thị',
    plannedStartDate: 'Ngày bắt đầu kế hoạch',
    dueDate: 'Hạn giao',
    operationNo: 'Số công đoạn',
    storageLocation: 'Kho',
    rework: 'Làm lại',
    status: 'Trạng thái',
    progress: 'Tiến độ',
    q: 'Tìm số W/O',
  },
  panes: {
    filters: 'Điều kiện tra cứu ERP W/O',
    list: 'Danh sách ERP W/O',
    detail: 'Chi tiết ERP W/O',
  },
  filters: {
    all: 'Tất cả',
    itemSelect: 'Chọn mặt hàng',
    statusSelect: 'Chọn trạng thái',
    itemPlaceholder: 'Tìm và chọn mặt hàng',
    itemClear: 'Xóa mặt hàng',
    itemPick: 'Chọn',
    chip: (label: string, value: string): string => `${label}: ${value}`,
  },
  progress: {
    group: 'Điều kiện tiến độ',
    all: 'Tất cả',
    open: 'Chưa xong',
    done: 'Đã xong',
    status: {
      NOT_STARTED: 'Chưa sản xuất',
      PARTIAL: 'Đang sản xuất',
      COMPLETED: 'Đã sản xuất xong',
      CANCELLED: 'Đã hủy',
    },
  },
  values: {
    searchPlaceholder: 'Nhập số ERP W/O',
    missing: '-',
    unknown: 'Không xác định',
    loadingName: 'Đang tải',
    failedName: 'Không tải được',
    reworkYes: 'Có',
    reworkNo: 'Không',
    qtyWithUom: (qty: string, uom: string): string => `${qty} ${uom}`,
  },
  empty: {
    title: 'Không có ERP W/O phù hợp điều kiện',
    beyondTitle: 'Trang này không có ERP W/O',
    pickTitle: 'Hãy chọn ERP W/O.',
    pickDescription: 'Chọn ERP W/O trong danh sách để xem mọi trường nhận từ ERP.',
  },
  loading: 'Đang tải ERP W/O',
  listLoadFailedTitle: 'Không tải được danh sách ERP W/O',
  loadFailedDescription: 'Hãy thử lại sau giây lát. Nếu vẫn lỗi, hãy liên hệ quản trị viên.',
};
