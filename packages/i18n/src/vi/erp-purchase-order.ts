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
    supplier: 'Nhà cung cấp',
    plant: 'Nhà máy',
    orderDate: 'Ngày đặt hàng',
    expectedReceiptDate: 'Ngày nhập dự kiến',
    status: 'Trạng thái',
    progress: 'Tiến độ',
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
    q: 'Số đơn mua',
  },
  splitter: 'Kéo để điều chỉnh độ rộng danh sách·chi tiết',
  listCollapse: 'Thu gọn danh sách đơn mua hàng',
  listExpand: 'Mở danh sách đơn mua hàng',
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
  },
  progress: {
    group: 'Điều kiện tiến độ',
    all: 'Tất cả',
    open: 'Chưa xong',
    done: 'Đã xong',
    status: {
      NOT_STARTED: 'Chưa nhận',
      PARTIAL: 'Nhận một phần',
      COMPLETED: 'Đã nhận đủ',
      CANCELLED: 'Đã hủy',
    },
  },
  values: {
    searchPlaceholder: 'Số P/O',
    missing: '-',
    unknown: 'Không xác định',
    loadingName: 'Đang tải',
    failedName: 'Không tải được',
    cancelled: 'Đã hủy',
  },
  empty: {
    title: 'Không có đơn mua hàng phù hợp điều kiện',
    beyondTitle: 'Trang này không có đơn mua hàng',
    notSelectedTitle: 'Hãy chọn một đơn mua hàng',
    linesTitle: 'Không có dòng',
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
