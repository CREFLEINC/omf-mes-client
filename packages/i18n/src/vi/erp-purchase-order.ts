import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * Tra cứu đơn mua hàng (ERP). Màn hình **chỉ đọc** P/O (đơn mua hàng) do ERP gửi xuống.
 */
export const erpPurchaseOrder: Translated<typeof ko.erpPurchaseOrder> = {
  title: 'Tra cứu đơn mua hàng (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  fields: {
    purchaseOrderNo: 'Số P/O',
    erpPurchaseOrderNo: 'Số đơn mua ERP',
    supplier: 'Nhà cung cấp',
    plant: 'Nhà máy',
    orderDate: 'Ngày đặt hàng',
    expectedReceiptDate: 'Ngày nhập dự kiến',
    status: 'Trạng thái',
    lineNo: 'Dòng',
    item: 'Mặt hàng',
    orderedQty: 'Số lượng đặt',
    receivedQty: 'Số lượng đã nhận',
    remainingQty: 'Còn lại',
    uom: 'Đơn vị',
    tolerance: 'Dung sai (vượt/thiếu)',
    orderType: 'Loại đơn mua',
    purchaseGroup: 'Nhóm mua hàng',
    ioType: 'Loại nhập/xuất',
    storageLocation: 'Kho',
    cancelled: 'Hủy',
    orderDateFrom: 'Ngày đặt từ',
    orderDateTo: 'Ngày đặt đến',
    openOnly: 'Chỉ đơn chưa nhận đủ',
    q: 'Số đơn mua',
  },
  panes: {
    filters: 'Điều kiện tra cứu đơn mua hàng',
    list: 'Danh sách đơn mua hàng',
    detail: 'Chi tiết đơn mua hàng',
    lines: 'Dòng đơn mua hàng',
  },
  filters: {
    all: 'Tất cả',
    dateRangeError: 'Ngày đặt từ muộn hơn ngày đặt đến. Hãy sửa lại khoảng thời gian.',
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
    searchPlaceholder: 'Số P/O · số đơn mua ERP',
    missing: '-',
    unknown: 'Không xác định',
    loadingName: 'Đang tải',
    failedName: 'Không tải được',
    cancelled: 'Đã hủy',
  },
  empty: {
    title: 'Không có đơn mua hàng phù hợp điều kiện',
    description: 'Hãy đổi điều kiện và tra cứu lại.',
    beyondTitle: 'Trang này không có đơn mua hàng',
    beyondDescription: 'Hãy quay về trang đầu.',
    notSelectedTitle: 'Hãy chọn một đơn mua hàng',
    notSelectedDescription: 'Bấm số P/O trong danh sách để xem chi tiết và các dòng.',
    linesTitle: 'Không có dòng',
    linesDescription: 'Đơn mua hàng này không có dòng nào.',
  },
  loading: 'Đang tải đơn mua hàng',
  listLoadFailedTitle: 'Không tải được danh sách đơn mua hàng',
  detailLoadFailedTitle: 'Không tải được chi tiết đơn mua hàng',
  loadFailedDescription: 'Hãy thử lại sau. Nếu vẫn lỗi, hãy liên hệ quản trị viên.',
  page: {
    label: 'Chuyển trang đơn mua hàng',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)}`,
    total: (total: number): string => `Tổng ${String(total)}`,
  },
};
