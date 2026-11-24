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
    status: 'Trạng thái đăng ký',
    progress: 'Tiến độ',
    lineNo: 'Dòng',
    item: 'Mặt hàng',
    itemCode: 'Mã mặt hàng',
    itemName: 'Tên mặt hàng',
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
    customsClearance: 'Số thông quan',
    q: 'Tìm số đơn mua',
  },
  panes: {
    filters: 'Điều kiện tra cứu đơn mua hàng',
    list: 'Danh sách đơn mua hàng',
    detail: 'Chi tiết đơn mua hàng',
    lines: 'Dòng đơn mua hàng',
  },
  filters: {
    all: 'Tất cả',
    supplierSelect: 'Tìm nhà cung cấp',
    plantSelect: 'Tìm nhà máy',
    statusSelect: 'Chọn trạng thái đăng ký',
    orderDatePlaceholder: 'Chọn ngày đặt hàng',
    orderTypeSelect: 'Chọn loại đơn mua',
    chip: (label: string, value: string): string => `${label}: ${value}`,
  },
  registrationStatus: {
    OPEN: 'Đang xử lý',
    CLOSED: 'Hoàn tất',
    CANCELLED: 'Đã hủy',
  },
  progress: {
    group: 'Điều kiện tiến độ',
    all: 'Tất cả',
    open: 'Chưa xong',
    done: 'Đã xong',
    withCount: (label: string, count: number): string => `${label} ${String(count)}`,
    status: {
      NOT_STARTED: 'Chưa nhận',
      PARTIAL: 'Nhận một phần',
      COMPLETED: 'Đã nhận đủ',
      CANCELLED: 'Đã hủy',
    },
  },
  customs: {
    fetch: 'Lấy số thông quan',
    fetchFailedTitle: 'Không lấy được số thông quan',
    notFoundOrder: 'Không tìm thấy đơn mua hàng.',
    summary: (total: number, saved: number, notFound: number, multiple: number): string =>
      [
        `Đã nhận ${String(saved)}/${String(total)} dòng`,
        ...(notFound > 0 ? [`${String(notFound)} dòng chưa thông quan`] : []),
        ...(multiple > 0 ? [`${String(multiple)} dòng cần kiểm tra`] : []),
      ].join(' · '),
    multipleTitle: 'Có dòng không lưu vì có nhiều số thông quan — cần kiểm tra',
    multipleLine: (lineNo: number, candidates: string): string =>
      `Dòng ${String(lineNo)}: ${candidates}`,
  },
  values: {
    searchPlaceholder: 'Nhập số đơn mua',
    missing: '-',
    unknown: 'Không xác định',
    loadingName: 'Đang tải',
    failedName: 'Không tải được',
    cancelled: 'Đã hủy',
  },
  empty: {
    title: 'Không có đơn mua hàng phù hợp điều kiện',
    beyondTitle: 'Trang này không có đơn mua hàng',
    notSelectedTitle: 'Hãy chọn đơn mua hàng.',
    notSelectedDescription: 'Chọn đơn mua hàng trong danh sách để xem thông tin chung và các dòng.',
    linesTitle: 'Không có dòng',
  },
  loading: 'Đang tải đơn mua hàng',
  listLoadFailedTitle: 'Không tải được danh sách đơn mua hàng',
  detailLoadFailedTitle: 'Không tải được chi tiết đơn mua hàng',
  loadFailedDescription: 'Hãy thử lại sau. Nếu vẫn lỗi, hãy liên hệ quản trị viên.',
};
