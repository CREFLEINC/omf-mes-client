import type { ko } from '../ko';
import type { Translated } from './translated';

export const overReceiptSplit: Translated<typeof ko.overReceiptSplit> = {
  title: 'Tách phần nhập vượt',
  breadcrumbRoot: 'Quản lý mua hàng / vật tư',
  panes: {
    filter: 'Điều kiện tra cứu',
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
    confirmRegister: 'Đăng ký',
    backToEdit: 'Quay lại',
    discardDraft: 'Bỏ nội dung đã nhập',
    keepEditing: 'Nhập tiếp',
    fillRemaining: 'Điền bằng số còn lại',
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
  },
  loading: {
    purchaseOrders: 'Đang tải danh sách đơn đặt hàng',
    lines: 'Đang tải các dòng đơn đặt hàng',
    codes: 'Đang tải danh sách chọn',
  },
  table: {
    purchaseOrderNo: 'Số đơn đặt hàng',
    supplier: 'Nhà cung cấp',
    orderDate: 'Ngày đặt hàng',
    expectedReceiptDate: 'Ngày dự kiến nhập kho',
  },
  lineTable: {
    lineNo: 'No.',
    itemCode: 'Mã mặt hàng',
    itemName: 'Tên mặt hàng',
    ordered: 'Đặt',
    received: 'Đã nhận',
    remaining: 'Còn lại (+dung sai)',
    arrivedQty: 'Đến lần này',
    uom: 'Đơn vị',
    normal: 'Định lượng',
    excess: 'Vượt',
    remainingPair: (remainingQty: string, toleranceOverQty: string): string =>
      `${remainingQty} (+${toleranceOverQty})`,
    arrivedQtyLabel: (lineNo: number): string => `Số lượng đến lần này của dòng ${String(lineNo)}`,
    iqc: 'IQC',
    iqcTitle: 'Mặt hàng thuộc diện kiểm tra đầu vào. Khi đăng ký sẽ tạo kèm yêu cầu kiểm tra.',
    lotNormal: 'LOT phần định lượng',
    lotExcess: 'LOT phần vượt',
    lotNoLabel: (lineNo: number, part: 'normal' | 'excess'): string =>
      `Số LOT nhà cung cấp ${part === 'normal' ? 'phần định lượng' : 'phần vượt'} của dòng ${String(lineNo)}`,
    lotMissingLabel: (lineNo: number, part: 'normal' | 'excess'): string =>
      `Không có nhãn ${part === 'normal' ? 'phần định lượng' : 'phần vượt'} của dòng ${String(lineNo)}`,
    lotReasonLabel: (lineNo: number, part: 'normal' | 'excess'): string =>
      `Lý do LOT thay thế ${part === 'normal' ? 'phần định lượng' : 'phần vượt'} của dòng ${String(lineNo)}`,
    lotNoPlaceholder: 'Quét nhãn hoặc nhập số LOT',
    lotMissing: 'Không có nhãn',
    lotReasonPlaceholder: 'Chọn lý do',
  },
  scan: {
    label: 'Quét nhãn',
    placeholder: 'Hãy quét nhãn LOT của nhà cung cấp',
    added: (lineNo: number, qty: string, part: 'normal' | 'excess'): string =>
      `Đã đưa vào dòng ${String(lineNo)} — số lượng ${qty} · LOT ${part === 'normal' ? 'phần định lượng' : 'phần vượt'}`,
    notFound: (itemCode: string): string => `Mặt hàng 「${itemCode}」 không có trong đơn này.`,
    invalid:
      'Không đúng định dạng nhãn. Phải có năm ô: mã mặt hàng, số lượng, ngày, nhà cung cấp, số thứ tự.',
    itemsPending: 'Chưa tải được thông tin mặt hàng. Hãy quét lại sau giây lát.',
    bothFilled: (lineNo: number): string =>
      `Dòng ${String(lineNo)} đã có đủ LOT phần định lượng và phần vượt. Hãy xóa bớt rồi quét lại.`,
  },
  summary: {
    label: 'Đơn đặt hàng đã chọn',
    purchaseOrderNo: 'Số đơn đặt hàng',
    supplier: 'Nhà cung cấp',
    plant: 'Nhà máy',
    orderDate: 'Ngày đặt hàng',
    expectedReceiptDate: 'Ngày dự kiến nhập kho',
  },
  totals: {
    normalLines: (count: number): string => `${String(count)} dòng định lượng`,
    excessLines: (count: number): string => `${String(count)} dòng vượt`,
    receipts: (count: number): string => `${String(count)} phiếu`,
    none: 'Chưa nhập số lượng đến nào',
  },
  filters: {
    all: 'Tất cả',
    lookupTruncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
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
    noSelectionDescription: 'Hãy bấm vào đơn đặt hàng có hàng đến vượt ở danh sách bên trái.',
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
    docStatus: {
      REGISTERED: 'Đã đăng ký',
      POSTED: 'Đã ghi sổ',
      CANCEL_REQUESTED: 'Đang yêu cầu hủy',
      CANCELLED: 'Đã hủy',
    },
    partNormal: 'Phần định lượng',
    partExcess: 'Phần vượt',
  },
  errors: {
    qtyNotNumber: 'Hãy nhập số lượng bằng chữ số.',
    qtyNotPositive: 'Số lượng phải lớn hơn 0.',
    receiptDatetimeRequired: 'Hãy nhập thời điểm nhập hàng.',
    deliveryNoteNoTooLong: (max: number): string =>
      `Số phiếu giao hàng không được vượt quá ${String(max)} ký tự.`,
    exceptionReasonRequired: 'Đã chọn loại ngoại lệ thì hãy nhập kèm lý do vượt.',
    exceptionTypeRequired: 'Để đăng ký phần vượt, hãy chọn loại ngoại lệ.',
    lotRequired: 'Hãy nhập số LOT hoặc chọn 「Không có nhãn」.',
    lotReasonRequired: 'Không có nhãn thì hãy chọn lý do LOT thay thế.',
    lotFormat:
      'Không đúng định dạng nhãn. Nếu là số chép lại, hãy bật 「Không có nhãn」 rồi nhập số.',
    lotItemMismatch: (itemCode: string): string =>
      `Mã mặt hàng trên nhãn khác với mặt hàng của dòng này (${itemCode}).`,
    lotDuplicate:
      'Không thể dùng cùng một số LOT cho phần định lượng và phần vượt. Phần vượt phải là LOT khác.',
    lineInvalidBlocked:
      'Còn dòng chưa sửa nên chưa đăng ký. Hãy sửa các ô số lượng·LOT đang kèm lý do rồi đăng ký lại.',
  },
  warnings: {
    qtyFarOverOrdered: (times: string): string =>
      `Gấp ${times} lần số lượng đặt. Hãy kiểm tra lại số chữ số.`,
  },
  notes: {
    businessDateDerived:
      'Ngày làm việc được gửi kèm theo ngày của thời điểm nhập hàng. Nếu vật tư nhận ban đêm cần ngày làm việc khác, hãy báo người phụ trách.',
    headerSharedByBoth:
      'Thời điểm nhập hàng, số phiếu giao hàng và ghi chú được ghi giống nhau lên mọi phiếu được tạo.',
    excessOnlyFields: 'Loại ngoại lệ và lý do vượt chỉ được ghi lên phiếu phần vượt.',
    iqcByItem:
      'Việc có thuộc diện kiểm tra đầu vào hay không do máy chủ quyết định theo thông tin chuẩn của mặt hàng. Dòng thuộc diện sẽ có dấu IQC.',
    registerRecheck:
      'Hãy kiểm tra xem đã đăng ký chưa rồi mới thử lại. Gửi lại mà không kiểm tra thì cùng một lần nhập hàng có thể bị đăng ký hai lần.',
  },
  result: {
    count: (count: number): string => `Đã tạo ${String(count)} phiếu.`,
    receiptNo: 'Số phiếu',
    status: 'Trạng thái',
    part: 'Phân loại',
    registerPo: (inboundReceiptNo: string): string =>
      `Đăng ký P/O vật tư theo lần nhập hàng ${inboundReceiptNo}`,
  },
  dialog: {
    discardTitle: 'Bỏ số lượng đến đã nhập',
    registerTitle: 'Đăng ký nhập hàng',
    registerLead: (mode: 'BOTH' | 'NORMAL_ONLY' | 'EXCESS_ONLY'): string =>
      mode === 'BOTH'
        ? 'Tạo cùng lúc hai phiếu: phiếu phần định lượng và phiếu phần vượt.'
        : mode === 'NORMAL_ONLY'
          ? 'Chỉ tạo một phiếu phần định lượng. Không đăng ký phần vượt.'
          : 'Chỉ tạo một phiếu phần vượt. Không đăng ký phần định lượng.',
    registerGroupLines: 'Các dòng được ghi',
    registerGroupHeader: 'Đầu phiếu',
    registerIrreversible:
      'Phiếu đã đăng ký không thể hoàn tác ở màn hình này. Việc hủy phải qua phê duyệt.',
    registerEffects:
      'Số đã nhận lũy kế của dòng đơn sẽ tăng, mặt hàng thuộc diện kiểm tra đầu vào sẽ được tạo kèm yêu cầu kiểm tra.',
    lotOf: (part: 'normal' | 'excess', lotNo: string): string =>
      `LOT ${part === 'normal' ? 'phần định lượng' : 'phần vượt'} ${lotNo}`,
    lotMissingOf: (part: 'normal' | 'excess', reason: string): string =>
      `${part === 'normal' ? 'Phần định lượng' : 'Phần vượt'} không có nhãn (${reason})`,
  },
};
