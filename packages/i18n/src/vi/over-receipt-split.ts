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
    register: 'Đăng ký nhập hàng',
    confirmRegister: 'Đăng ký',
    backToEdit: 'Quay lại',
    excessLotAsMissing: 'Chuyển thành không có nhãn',
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
  },
  guide: {
    label: 'Các bước',
    steps: {
      select: 'Chọn đơn',
      lines: 'Số lượng đến · LOT',
      info: 'Thông tin nhập hàng',
      register: 'Đăng ký',
    },
    hints: {
      select: 'Hãy bấm vào đơn đặt hàng của vật tư vừa đến ở danh sách bên trái.',
      lines:
        'Hãy quét nhãn hoặc nhập số lượng vào ô 「Đến lần này」. Phần đến nhiều hơn đơn đặt sẽ được màn hình tự tách thành phần vượt.',
      info: 'Hãy kiểm tra thời điểm nhập hàng và nếu có phần vượt thì ghi lý do vượt.',
      register: 'Bấm 「Đăng ký nhập hàng」 để xem các phiếu sẽ tạo rồi đăng ký.',
    },
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
    lotDerivedNote:
      'Số này được tạo từ nhãn phần định lượng. Nếu kiện phần vượt có nhãn riêng, hãy quét nhãn đó hoặc nhập số.',
    legend:
      'Phần định lượng là phần nhận trong số lượng đặt và dung sai, được ghi vào đơn đặt hàng. Phần vượt là phần đến nhiều hơn thế, thành phiếu riêng và sau đó được quyết toán bằng 「Đăng ký P/O vật tư mới」.',
  },
  scan: {
    label: 'Quét nhãn',
    placeholder: 'Hãy quét nhãn LOT của nhà cung cấp',
    hint: 'Không có máy quét thì nhập số lượng vào ô 「Đến lần này」, rồi ở dòng LOT nhập số hoặc chọn 「Không có nhãn」.',
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
    label: 'Phiếu sẽ tạo',
    normal: (lines: number): string => `1 phiếu phần định lượng (${String(lines)} dòng)`,
    excess: (lines: number): string => `1 phiếu phần vượt (${String(lines)} dòng)`,
    none: 'Chưa nhập số lượng đến nào',
  },
  form: {
    linesTitle: 'Số lượng đến và LOT',
    headerTitle: 'Thông tin nhập hàng',
    excessTitle: 'Thông tin phần vượt',
    optional: '(tùy chọn)',
    exceptionReasonPlaceholder: 'VD: nhà cung cấp giao theo đơn vị đóng gói nên dư',
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
    lineInvalidBlocked: (lineNos: string): string =>
      `Dòng ${lineNos} còn chỗ cần sửa nên chưa đăng ký. Hãy sửa các ô số lượng·LOT đang kèm lý do rồi đăng ký lại.`,
  },
  warnings: {
    qtyFarOverOrdered: (times: string): string =>
      `Gấp ${times} lần số lượng đặt. Hãy kiểm tra lại số chữ số.`,
  },
  notes: {
    headerSharedByBoth:
      'Thời điểm nhập hàng, số phiếu giao hàng và ghi chú được ghi giống nhau lên mọi phiếu được tạo; ngày làm việc là ngày của thời điểm nhập hàng.',
    excessOnlyFields: 'Loại ngoại lệ và lý do vượt chỉ được ghi lên phiếu phần vượt.',
    iqcByItem: 'Mặt hàng có dấu IQC sẽ được tạo kèm yêu cầu kiểm tra đầu vào khi đăng ký.',
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
    registerGroupReceipts: 'Phiếu sẽ tạo',
    registerReceiptNormal: (lines: number): string =>
      `Phiếu phần định lượng — ${String(lines)} dòng`,
    registerReceiptExcess: (lines: number): string => `Phiếu phần vượt — ${String(lines)} dòng`,
    registerReceiptHint: 'Bỏ chọn phiếu không muốn tạo. Phải giữ lại ít nhất một phiếu.',
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
