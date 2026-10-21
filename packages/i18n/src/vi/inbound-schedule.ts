import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-09 입하 예정 조회. 조회 전용이고, 입하 예정은 아직 다 들어오지 않은 P/O 라인이다(server #741 · #749 · 장부 P-78).
 * 참조 이름의 세 갈래(미도착·목록에 없음·실패)를 가른다.
 */
export const inboundSchedule: Translated<typeof ko.inboundSchedule> = {
  title: 'Tra cứu kế hoạch nhập hàng',
  breadcrumbRoot: 'Quản lý mua hàng / vật tư',
  breadcrumbHub: 'Quản lý nhập kho',
  /** 두 표 사이 끌기 막대(키보드 ←·→ 로도 움직인다). */
  splitter: 'Kéo để điều chỉnh độ rộng danh sách·chi tiết',
  panes: {
    filter: 'Điều kiện tra cứu',
    list: 'Danh sách kế hoạch nhập hàng',
    orders: 'Danh sách đơn đặt hàng',
    lines: 'Dòng đơn đặt hàng',
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
    selectOrder: (purchaseOrderNo: string): string => `Xem dòng của ${purchaseOrderNo}`,
    overReceiptSplit: 'Tách phần nhập vượt',
    overReceiptSplitRow: (purchaseOrderNo: string): string =>
      `Chuyển đến tách phần nhập vượt của ${purchaseOrderNo}`,
  },
  reasons: {
    periodInvalid: 'Hạn giao phải là ngày có thật. Hãy chọn lại ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Hạn giao đến không được sớm hơn hạn giao từ.',
  },
  loading: {
    list: 'Đang tải danh sách kế hoạch nhập hàng',
    lines: 'Đang tải dòng đơn đặt hàng',
  },
  table: {
    receiptStatus: 'Trạng thái',
    expectedReceiptDate: 'Hạn giao',
    purchaseOrderNo: 'Số đơn đặt hàng',
    lineNo: 'No.',
    supplierCode: 'Mã nhà cung cấp',
    supplierName: 'Tên nhà cung cấp',
    openLines: 'Mặt hàng chưa nhập',
    itemCode: 'Mã mặt hàng',
    itemName: 'Tên mặt hàng',
    orderedQty: 'Số lượng đặt',
    receivedQty: 'Số lượng đã nhận',
    remainingQty: 'Còn lại',
    uom: 'Đơn vị',
    orderDate: 'Ngày đặt hàng',
    storageLocation: 'Kho',
  },
  detail: {
    purchaseOrderNo: 'Số đơn mua',
    supplierCode: 'Mã nhà cung cấp',
    supplierName: 'Tên nhà cung cấp',
    expectedReceiptDate: 'Ngày giao',
    orderDate: 'Ngày đặt hàng',
  },
  receiptStatus: {
    NOT_STARTED: 'Chưa nhận',
    PARTIAL: 'Nhận một phần',
    COMPLETED: 'Đã nhận đủ',
    CANCELLED: 'Đã hủy',
  },
  quick: {
    supplier: 'Nhà cung cấp',
    supplierPlaceholder: 'Nhập tên hoặc ID nhà cung cấp',
    item: 'Mã mặt hàng',
    itemPlaceholder: 'Nhập mã mặt hàng',
    scanNotFound: (value: string): string => `Không có mặt hàng khớp với 「${value}」.`,
    scanFailed: 'Không tìm được mặt hàng. Hãy quét lại sau giây lát.',
    today: 'Đến hôm nay',
    overdue: 'Trễ hạn',
    detailOpen: 'Mở điều kiện chi tiết',
    detailClose: 'Thu gọn điều kiện chi tiết',
  },
  filters: {
    all: 'Tất cả',
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
    noOrderTitle: 'Hãy chọn đơn đặt hàng',
    noOrderDescription: 'Bấm số đơn ở danh sách bên trái để xem các dòng.',
    noLinesTitle: 'Đơn này không có dòng nào',
  },
  values: {
    /** 열린 발주가 납기 안에 있다. */
    onTrack: 'Bình thường',
    empty: '—',
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    overdue: 'Trễ hạn',
    noDueDate: 'Chưa có hạn giao',
    lineRatio: (open: number, total: number): string => `${String(open)} / ${String(total)}`,
    linesOf: (purchaseOrderNo: string, supplierName: string): string =>
      `${purchaseOrderNo} · ${supplierName}`,
    matchedLine: 'Mặt hàng đã tìm',
    inactiveSuffix: ' (không dùng)',
  },
};
