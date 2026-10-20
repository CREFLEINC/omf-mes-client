import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * Tra cứu ERP W/O (W-06-23). Màn hình **chỉ đọc** ERP W/O nhận từ ERP, đúng như đã nhận.
 */
export const erpProductionOrder: Translated<typeof ko.erpProductionOrder> = {
  title: 'Tra cứu ERP W/O',
  breadcrumbRoot: 'Quản trị hệ thống',
  readOnlyNote: 'Thông tin nhận từ ERP. Không thể sửa trong MES.',
  fields: {
    productionOrderNo: 'Số ERP W/O',
    erpOrderNo: 'Số gốc ERP',
    businessUnit: 'Đơn vị kinh doanh',
    plant: 'Nhà máy',
    item: 'Mặt hàng',
    orderQty: 'Số lượng chỉ thị',
    uom: 'Đơn vị',
    plannedStartDate: 'Ngày bắt đầu kế hoạch',
    dueDate: 'Hạn giao',
    operationNo: 'Số công đoạn',
    storageLocation: 'Kho',
    rework: 'Làm lại',
    status: 'Trạng thái',
    remarks: 'Ghi chú',
    plannedStartFrom: 'Ngày bắt đầu kế hoạch từ',
    plannedStartTo: 'Ngày bắt đầu kế hoạch đến',
    q: 'Số ERP W/O',
    lastChange: 'Thay đổi ERP gần nhất',
    lastChangeReceivedAt: 'Thời điểm nhận',
  },
  panes: {
    filters: 'Điều kiện tra cứu ERP W/O',
    list: 'Danh sách ERP W/O',
    detail: 'Chi tiết ERP W/O',
  },
  filters: {
    all: 'Tất cả',
    dateRangeError: 'Ngày bắt đầu kế hoạch "từ" muộn hơn "đến". Hãy sửa lại khoảng ngày.',
    itemPlaceholder: 'Tìm và chọn mặt hàng',
    itemClear: 'Xóa mặt hàng',
    itemPick: 'Chọn',
  },
  actions: {
    select: (orderNo: string): string => `Chọn ${orderNo}`,
    firstPage: 'Trang đầu',
    prevPage: 'Trước',
    nextPage: 'Sau',
  },
  values: {
    searchPlaceholder: 'Một phần số ERP W/O',
    missing: '-',
    unknown: 'Không xác định',
    loadingName: 'Đang tải',
    failedName: 'Không tải được',
    reworkYes: 'Có',
    reworkNo: 'Không',
    qtyWithUom: (qty: string, uom: string): string => `${qty} ${uom}`,
    changeArrow: (before: string, after: string): string => `${before} → ${after}`,
    noChangedFields: 'Không có mục thay đổi trong danh sách (một mục khác đã thay đổi).',
    noLastChange: 'Chưa nhận thay đổi nào.',
  },
  empty: {
    title: 'Không có ERP W/O phù hợp điều kiện',
    description: 'Hãy đổi điều kiện tra cứu rồi tra cứu lại.',
    beyondTitle: 'Trang này không có ERP W/O',
    beyondDescription: 'Hãy quay về trang đầu rồi xem lại.',
    notSelectedTitle: 'Hãy chọn một ERP W/O',
    notSelectedDescription: 'Nhấn số ERP W/O trong danh sách để xem toàn bộ nội dung đã nhận.',
  },
  loading: 'Đang tải ERP W/O',
  listLoadFailedTitle: 'Không tải được danh sách ERP W/O',
  detailLoadFailedTitle: 'Không tải được chi tiết ERP W/O',
  loadFailedDescription: 'Hãy thử lại sau giây lát. Nếu vẫn lỗi, hãy liên hệ quản trị viên.',
  page: {
    label: 'Chuyển trang ERP W/O',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)}`,
    total: (total: number): string => `Tổng ${String(total)}`,
  },
};
