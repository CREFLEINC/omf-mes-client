import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * Tra cứu thông tin đơn bán hàng (ERP). Màn hình **chỉ đọc** đơn bán hàng do ERP gửi xuống.
 */
export const erpSalesOrder: Translated<typeof ko.erpSalesOrder> = {
  title: 'Tra cứu đơn bán hàng (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  fields: {
    salesOrderNo: 'Số đơn bán',
    customer: 'Khách hàng',
    orderDate: 'Ngày nhận đơn',
    status: 'Trạng thái',
    progress: 'Tiến độ',
    lineNo: 'Dòng',
    item: 'Mặt hàng',
    itemCode: 'Mã mặt hàng',
    itemName: 'Tên mặt hàng',
    orderedQty: 'Số lượng đặt',
    shippedQty: 'Số lượng đã xuất',
    remainingQty: 'Số lượng chưa xuất',
    uom: 'Đơn vị',
    requestedDeliveryDate: 'Ngày giao yêu cầu',
    unassignedOnly: 'Chỉ đơn chưa xếp',
    q: 'Tìm số đơn bán',
    orderType: 'Loại đơn bán',
    movementType: 'Loại di chuyển',
    salesGroup: 'Nhóm bán hàng',
    storageLocation: 'Kho',
    cancelled: 'Hủy',
  },
  panes: {
    filters: 'Điều kiện tra cứu đơn bán hàng',
    list: 'Danh sách đơn bán hàng',
    detail: 'Chi tiết đơn bán hàng',
    lines: 'Dòng đơn bán hàng',
  },
  filters: {
    all: 'Tất cả',
    customerSelect: 'Tìm khách hàng',
    orderDatePlaceholder: 'Chọn ngày đặt hàng',
    statusSelect: 'Chọn trạng thái',
    chip: (label: string, value: string): string => `${label}: ${value}`,
  },
  progress: {
    group: 'Điều kiện tiến độ',
    all: 'Tất cả',
    open: 'Chưa xong',
    done: 'Đã xong',
    withCount: (label: string, count: number): string => `${label} ${String(count)}`,
    status: {
      NOT_STARTED: 'Chưa xuất',
      PARTIAL: 'Xuất một phần',
      COMPLETED: 'Đã xuất đủ',
      CANCELLED: 'Đã hủy',
    },
  },
  values: {
    searchPlaceholder: 'Nhập số đơn bán',
    missing: '-',
    unknown: 'Không xác định',
    loadingName: 'Đang tải',
    failedName: 'Không tải được',
    cancelled: 'Đã hủy',
  },
  empty: {
    title: 'Không có đơn bán hàng phù hợp điều kiện',
    beyondTitle: 'Trang này không có đơn bán hàng',
    notSelectedTitle: 'Hãy chọn đơn bán hàng.',
    notSelectedDescription: 'Chọn đơn bán hàng trong danh sách để xem thông tin chung và các dòng.',
    linesTitle: 'Không có dòng',
  },
  loading: 'Đang tải đơn bán hàng',
  listLoadFailedTitle: 'Không tải được danh sách đơn bán hàng',
  detailLoadFailedTitle: 'Không tải được chi tiết đơn bán hàng',
  loadFailedDescription: 'Hãy thử lại sau. Nếu vẫn lỗi, hãy liên hệ quản trị viên.',
};
