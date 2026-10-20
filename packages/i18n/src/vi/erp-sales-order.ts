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
    erpSalesOrderNo: 'Số gốc ERP',
    customer: 'Khách hàng',
    shipTo: 'Nơi giao',
    orderDate: 'Ngày nhận đơn',
    status: 'Trạng thái',
    lineNo: 'Dòng',
    item: 'Mặt hàng',
    orderedQty: 'Số lượng đặt',
    shippedQty: 'Số lượng đã xuất',
    remainingQty: 'Còn lại',
    uom: 'Đơn vị',
    requestedDeliveryDate: 'Ngày giao yêu cầu',
    orderDateFrom: 'Ngày nhận đơn từ',
    orderDateTo: 'Ngày nhận đơn đến',
    unassignedOnly: 'Chỉ đơn chưa xếp',
    q: 'Số đơn bán',
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
    dateRangeError: 'Ngày nhận đơn từ muộn hơn ngày đến. Hãy sửa lại khoảng thời gian.',
  },
  actions: {
    select: (orderNo: string): string => `Chọn ${orderNo}`,
    firstPage: 'Trang đầu',
    prevPage: 'Trước',
    nextPage: 'Sau',
    integrationSync: 'Xem tình trạng liên kết',
  },
  values: {
    erpReadOnlyNotice:
      'Thông tin nhận từ ERP nên không thể sửa tại màn hình này. Hãy sửa trên ERP rồi đồng bộ lại.',
    erpSyncHint: 'Có thể xem kết quả đồng bộ tại tình trạng liên kết.',
    searchPlaceholder: 'Số đơn bán · số gốc ERP',
    missing: '-',
    unknown: 'Không xác định',
    loadingName: 'Đang tải',
    failedName: 'Không tải được',
    cancelled: 'Đã hủy',
  },
  empty: {
    title: 'Không có đơn bán hàng phù hợp điều kiện',
    description: 'Hãy đổi điều kiện và tra cứu lại.',
    beyondTitle: 'Trang này không có đơn bán hàng',
    beyondDescription: 'Hãy quay về trang đầu.',
    notSelectedTitle: 'Hãy chọn một đơn bán hàng',
    notSelectedDescription: 'Bấm số đơn bán trong danh sách để xem chi tiết và các dòng.',
    linesTitle: 'Không có dòng',
    linesDescription: 'Đơn bán hàng này không có dòng nào.',
  },
  loading: 'Đang tải đơn bán hàng',
  listLoadFailedTitle: 'Không tải được danh sách đơn bán hàng',
  detailLoadFailedTitle: 'Không tải được chi tiết đơn bán hàng',
  loadFailedDescription: 'Hãy thử lại sau. Nếu vẫn lỗi, hãy liên hệ quản trị viên.',
  page: {
    label: 'Chuyển trang đơn bán hàng',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)}`,
    total: (total: number): string => `Tổng ${String(total)}`,
  },
};
