import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-01-03 초과 입하 분리. 「정량분」과 「초과분」 두 낱말로 말하고, 그것이 화면이 만든 값임을 밝힌다. */
export const overReceiptSplit: Translated<typeof ko.overReceiptSplit> = {
  title: 'Tách phần nhập vượt',
  breadcrumbRoot: 'Kho vật tư',
  panes: {
    list: 'Danh sách đơn đặt hàng',
    lines: 'Các dòng của đơn đã chọn',
    register: 'Thông tin đăng ký',
    result: 'Kết quả đăng ký',
  },
  fields: {
    supplier: 'Nhà cung cấp',
    q: 'Tìm số đơn đặt hàng',
    openOnly: 'Chỉ đơn chưa hoàn tất',
    receiptDatetime: 'Thời điểm nhập hàng',
    deliveryNoteNo: 'Số phiếu giao hàng',
    remarks: 'Ghi chú',
    exceptionType: 'Loại ngoại lệ',
    exceptionReason: 'Lý do vượt',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    registerBoth: 'Đăng ký tách',
    registerNormalOnly: 'Chỉ lưu phần định lượng',
    registerExcessOnly: 'Chỉ lưu phần vượt',
    createPurchaseOrder: 'Đăng ký ERP W/O mới',
    discardDraft: 'Bỏ nội dung đã nhập',
    keepEditing: 'Nhập tiếp',
    selectRow: (purchaseOrderNo: string): string => `Chọn ${purchaseOrderNo}`,
    deselectRow: (purchaseOrderNo: string): string => `Bỏ chọn ${purchaseOrderNo}`,
  },
  reasons: {
    referencesFailed: 'Không tải được tên nhà cung cấp. Lý do sẽ hiện ở chỗ của tên.',
    lineReferencesFailed:
      'Không tải được tên mặt hàng, đơn vị và nhà máy. Lý do sẽ hiện ở chỗ của tên.',
  },
  actionReasons: {
    noQty:
      'Chưa nhập số lượng đến nào. Hãy nhập số lượng đến lần này ở các dòng thì mới đăng ký được.',
    bothNeedsExcess:
      'Đăng ký tách không có phần vượt nên không có gì để tách. Hãy đăng ký bằng 「Chỉ lưu phần định lượng」.',
    bothNeedsNormal:
      'Đăng ký tách không có phần định lượng nên không có gì để tách. Hãy đăng ký bằng 「Chỉ lưu phần vượt」.',
    normalOnlyNeedsNormal:
      'Chỉ lưu phần định lượng không có phần định lượng nào để nhận. Khi có số lượng đến nằm trong số lượng còn lại và dung sai thì dùng được nút này.',
    excessOnlyNeedsExcess:
      'Chỉ lưu phần vượt không có phần vượt nào. Khi có số lượng đến vượt quá hạn mức định lượng thì dùng được nút này.',
    createPurchaseOrderUnavailable:
      'Đăng ký ERP W/O mới không bắt đầu ở đây. Hãy đăng ký nhập hàng phần vượt trước, rồi tiếp tục ở kết quả đăng ký.',
  },
  loading: {
    purchaseOrders: 'Đang tải danh sách đơn đặt hàng',
    lines: 'Đang tải các dòng đơn đặt hàng',
  },
  table: {
    purchaseOrderNo: 'Số đơn đặt hàng',
    supplier: 'Nhà cung cấp',
    orderDate: 'Ngày đặt hàng',
    expectedReceiptDate: 'Ngày dự kiến nhập kho',
    status: 'Trạng thái',
    select: 'Chọn',
  },
  lineTable: {
    lineNo: 'Số dòng',
    item: 'Mặt hàng',
    ordered: 'Đặt · Đã nhận',
    remaining: 'Còn lại · Dung sai',
    arrivedQty: 'Số lượng đến lần này',
    split: 'Định lượng · Vượt',
    orderedPair: (orderedQty: number, receivedQty: number): string =>
      `Đặt ${String(orderedQty)} · Đã nhận ${String(receivedQty)}`,
    remainingPair: (remainingQty: number, toleranceOverQty: number): string =>
      `Còn lại ${String(remainingQty)} (+${String(toleranceOverQty)})`,
    splitPair: (normalQty: number, excessQty: number): string =>
      `Định lượng ${String(normalQty)} · Vượt ${String(excessQty)}`,
    arrivedQtyLabel: (lineNo: number): string => `Số lượng đến lần này của dòng ${String(lineNo)}`,
    uomNote: (uom: string): string => `Đơn vị ${uom}`,
  },
  summary: {
    label: 'Đơn đặt hàng đã chọn',
    purchaseOrderNo: 'Số đơn đặt hàng',
    supplier: 'Nhà cung cấp',
    plant: 'Nhà máy',
    orderDate: 'Ngày đặt hàng',
    expectedReceiptDate: 'Ngày dự kiến nhập kho',
    status: 'Trạng thái',
  },
  filters: {
    all: 'Tất cả',
    lookupTruncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
    openOnlyNote:
      'Mặc định chỉ xem các đơn chưa nhập hàng xong. Tắt đi thì các đơn đã xong cũng hiện ra.',
    chipSupplier: (value: string): string => `Nhà cung cấp: ${value}`,
    chipQ: (value: string): string => `Số đơn đặt hàng: ${value}`,
    chipRemoveSupplier: 'Bỏ điều kiện nhà cung cấp',
    chipRemoveQ: 'Bỏ điều kiện số đơn đặt hàng',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} phiếu`,
    totalOnly: (total: number): string => `Tổng ${String(total)} phiếu`,
  },
  empty: {
    noResultTitle: 'Không có đơn đặt hàng nào khớp điều kiện',
    noResultDescription: 'Hãy bớt điều kiện hoặc tắt 「Chỉ đơn chưa hoàn tất」 rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noSelectionTitle: 'Chọn một đơn đặt hàng để xem các dòng',
    noSelectionDescription:
      'Hãy chọn đơn đặt hàng có hàng đến vượt ở danh sách trên rồi bấm 「Chọn」.',
    listFailedTitle: 'Không tải được danh sách đơn nên không mở được đơn này',
    listFailedDescription: 'Hãy bấm 「Thử lại」 ở trên để tải danh sách rồi chọn lại.',
    noLinesTitle: 'Đơn đặt hàng này không có dòng nào',
    noLinesDescription:
      'Đơn đặt hàng không chứa dòng mặt hàng nào nên không xác định được thứ cần nhận.',
  },
  values: {
    empty: '—',
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    notSplit: '—',
    inactiveSuffix: ' (không dùng)',
  },
  errors: {
    qtyNotNumber: 'Hãy nhập số lượng bằng chữ số.',
    qtyNotPositive: 'Số lượng phải lớn hơn 0.',
    receiptDatetimeRequired: 'Hãy nhập thời điểm nhập hàng.',
    deliveryNoteNoTooLong: (max: number): string =>
      `Số phiếu giao hàng không được vượt quá ${String(max)} ký tự.`,
    exceptionReasonRequired: 'Đã chọn loại ngoại lệ thì hãy nhập kèm lý do vượt.',
    qtyInvalidBlocked:
      'Còn số lượng đến chưa sửa nên chưa đăng ký. Hãy sửa các dòng đang kèm lý do rồi đăng ký lại.',
  },
  notes: {
    splitDerived:
      'Định lượng · Vượt là giá trị màn hình này tự tính. Phần đến trong khoảng số lượng còn lại cộng dung sai vượt (+) là phần định lượng, phần đến nhiều hơn thế là phần vượt.',
    arrivedQtyOptional: 'Dòng nào lần này không nhận thì để trống số lượng.',
    businessDateDerived:
      'Ngày làm việc được gửi kèm theo ngày của thời điểm nhập hàng. Nếu vật tư nhận ban đêm cần ngày làm việc khác, hãy báo người phụ trách.',
    headerSharedByBoth:
      'Thời điểm nhập hàng, số phiếu giao hàng và ghi chú được ghi giống nhau lên mọi phiếu được tạo.',
    excessOnlyFields: 'Loại ngoại lệ và lý do vượt chỉ được ghi lên phiếu phần vượt.',
    excessInspection:
      'Màn hình này không gửi kèm việc phần vượt có thuộc diện kiểm tra đầu vào hay không. Nếu cần xác nhận, hãy báo người phụ trách.',
    registerRecheck:
      'Hãy kiểm tra xem đã đăng ký chưa rồi mới thử lại. Gửi lại mà không kiểm tra thì cùng một lần nhập hàng có thể bị đăng ký hai lần.',
  },
  result: {
    count: (count: number): string => `Đã tạo ${String(count)} phiếu.`,
    receiptNo: 'Số phiếu',
    status: 'Trạng thái',
    unlabeled: 'Không hiển thị phiếu nào là phần định lượng, phiếu nào là phần vượt.',
    registerPo: (inboundReceiptNo: string): string =>
      `Đăng ký ERP W/O theo lần nhập hàng ${inboundReceiptNo}`,
  },
  dialog: {
    discardTitle: 'Bỏ số lượng đến đã nhập',
  },
};
