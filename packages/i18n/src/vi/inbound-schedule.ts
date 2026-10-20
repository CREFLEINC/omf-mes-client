import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-09 입하 예정 조회. 조회 전용이고, 입하 예정은 아직 다 들어오지 않은 P/O 라인이다(server #741 · #749 · 장부 P-78).
 * 참조 이름의 세 갈래(미도착·목록에 없음·실패)를 가른다.
 */
export const inboundSchedule: Translated<typeof ko.inboundSchedule> = {
  title: 'Tra cứu kế hoạch nhập hàng',
  description: 'Xem các dòng đơn đặt hàng chưa nhận đủ, theo thứ tự hạn giao.',
  breadcrumbRoot: 'Quản lý mua hàng / vật tư',
  panes: {
    list: 'Danh sách kế hoạch nhập hàng',
  },
  fields: {
    periodFrom: 'Hạn giao từ',
    periodTo: 'Hạn giao đến',
    supplier: 'Nhà cung cấp',
    plant: 'Nhà máy',
    item: 'Mặt hàng',
    q: 'Tìm số đơn đặt hàng',
    openOnly: 'Chỉ dòng chưa nhận đủ',
    overdueOnly: 'Chỉ dòng đã quá hạn',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    overReceiptSplit: 'Tách phần nhập vượt',
    overReceiptSplitRow: (purchaseOrderNo: string): string =>
      `Chuyển đến tách phần nhập vượt của ${purchaseOrderNo}`,
  },
  reasons: {
    periodInvalid: 'Hạn giao phải là ngày có thật. Hãy chọn lại ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Hạn giao đến không được sớm hơn hạn giao từ.',
    referencesFailed:
      'Không tải được tên nhà cung cấp, mặt hàng và đơn vị. Lý do sẽ hiện ở chỗ của tên.',
  },
  loading: {
    list: 'Đang tải danh sách kế hoạch nhập hàng',
  },
  table: {
    expectedReceiptDate: 'Hạn giao',
    purchaseOrderNo: 'Số đơn đặt hàng',
    lineNo: 'Dòng',
    supplier: 'Nhà cung cấp',
    item: 'Mặt hàng',
    orderedQty: 'Số lượng đặt',
    receivedQty: 'Số lượng đã nhận',
    remainingQty: 'Còn lại',
    uom: 'Đơn vị',
    receiptStatus: 'Tiến độ',
    storageLocation: 'Kho',
    actions: 'Đi tới',
  },
  receiptStatus: {
    NOT_STARTED: 'Chưa nhận',
    PARTIAL: 'Nhận một phần',
    COMPLETED: 'Đã nhận đủ',
    CANCELLED: 'Đã hủy',
  },
  filters: {
    all: 'Tất cả',
    periodNote:
      'Khoảng hạn giao có thể để trống vẫn tra cứu được. Bỏ chọn 「Chỉ dòng chưa nhận đủ」 để xem cả dòng đã nhận đủ và dòng đã hủy.',
    itemPlaceholder: 'Tìm và chọn mặt hàng',
    itemClear: 'Xóa điều kiện mặt hàng',
    itemPick: 'Tra cứu theo mặt hàng này',
    lookupTruncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
    chipSupplier: (value: string): string => `Nhà cung cấp: ${value}`,
    chipPlant: (value: string): string => `Nhà máy: ${value}`,
    chipItem: (value: string): string => `Mặt hàng: ${value}`,
    chipQ: (value: string): string => `Số đơn đặt hàng: ${value}`,
    chipRemoveSupplier: 'Bỏ điều kiện nhà cung cấp',
    chipRemovePlant: 'Bỏ điều kiện nhà máy',
    chipRemoveItem: 'Bỏ điều kiện mặt hàng',
    chipRemoveQ: 'Bỏ điều kiện số đơn đặt hàng',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} dòng`,
    totalOnly: (total: number): string => `Tổng ${String(total)} dòng`,
  },
  empty: {
    noResultTitle: 'Không có kế hoạch nhập hàng nào khớp điều kiện',
    noResultDescription: 'Hãy nới rộng khoảng ngày hoặc bớt điều kiện rồi tra cứu lại.',
    notQueriedTitle: 'Chưa tra cứu',
    notQueriedDescription: 'Hãy sửa hạn giao theo hướng dẫn ở dòng điều kiện rồi tra cứu.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
  },
  values: {
    empty: '—',
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    overdue: 'Trễ hạn',
    noDueDate: 'Chưa có hạn giao',
    erpPurchaseOrderNo: (value: string): string => `ERP ${value}`,
    inactiveSuffix: ' (không dùng)',
  },
};
