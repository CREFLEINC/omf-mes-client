import type { ko } from '../ko';
import type { Translated } from './translated';

export const overReceiptSplit: Translated<typeof ko.overReceiptSplit> = {
  title: 'Đăng ký nhập hàng',
  panes: {
    lines: 'Các dòng của đơn đã chọn',
    register: 'Thông tin đăng ký',
    result: 'Kết quả đăng ký',
  },
  fields: {
    receiptDatetime: 'Thời điểm nhập hàng',
    deliveryNoteNo: 'Số phiếu giao hàng',
    remarks: 'Ghi chú',
  },
  actions: {
    register: 'Đăng ký nhập hàng',
    confirmRegister: 'Đăng ký',
    backToEdit: 'Quay lại',

    discardDraft: 'Bỏ nội dung đã nhập',
    keepEditing: 'Nhập tiếp',
    fillRemaining: 'Điền bằng số còn lại',
  },
  reasons: {
    lineReferencesFailed:
      'Không tải được tên nhà cung cấp, mặt hàng, đơn vị và nhà máy. Lý do sẽ hiện ở chỗ của tên.',
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
      select: 'Hãy chọn đơn đặt hàng của vật tư vừa đến.',
      lines: 'Hãy quét nhãn hoặc nhập số lượng vào 「Đến lần này」.',
      info: 'Hãy kiểm tra thời điểm nhập hàng.',
      register: 'Bấm 「Đăng ký nhập hàng」 để đăng ký.',
    },
  },
  loading: {
    lines: 'Đang tải các dòng đơn đặt hàng',
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
    normal: 'Ghi vào P/O',
    excess: 'Phần vượt',
    remainingPair: (remainingQty: string, toleranceOverQty: string): string =>
      `${remainingQty} (+${toleranceOverQty})`,
    arrivedQtyLabel: (lineNo: number): string => `Số lượng đến lần này của dòng ${String(lineNo)}`,
    iqc: 'IQC',
    iqcTitle: 'Mặt hàng thuộc diện kiểm tra đầu vào. Khi đăng ký sẽ tạo kèm yêu cầu kiểm tra.',
    lotHead: 'LOT nhà cung cấp',
    lotNoLabel: (lineNo: number): string => `Số LOT nhà cung cấp của dòng ${String(lineNo)}`,
    lotMissingLabel: (lineNo: number): string => `Không có nhãn của dòng ${String(lineNo)}`,
    lotReasonLabel: (lineNo: number): string => `Lý do LOT thay thế của dòng ${String(lineNo)}`,
    lotNoPlaceholder: 'Quét nhãn hoặc nhập số LOT',
    lotMissing: 'Không có nhãn',
    lotReasonPlaceholder: 'Chọn lý do',
  },
  scan: {
    label: 'Quét nhãn',
    placeholder: 'Hãy quét nhãn LOT của nhà cung cấp',
    added: (lineNo: number, qty: string): string =>
      `Đã đưa vào dòng ${String(lineNo)} — số lượng ${qty}`,
    notFound: (itemCode: string): string => `Mặt hàng 「${itemCode}」 không có trong đơn này.`,
    invalid:
      'Không đúng định dạng nhãn. Phải có năm ô: mã mặt hàng, số lượng, ngày, nhà cung cấp, số thứ tự.',
    itemsPending: 'Chưa tải được thông tin mặt hàng. Hãy quét lại sau giây lát.',
    lotFilled: (lineNo: number): string =>
      `Dòng ${String(lineNo)} đã có LOT. Muốn đổi nhãn thì xóa ô rồi quét lại.`,
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
    receipt: (lines: number): string => `1 phiếu nhập hàng (${String(lines)} dòng)`,
    excess: (lines: number): string => `trong đó ${String(lines)} dòng có phần vượt`,
    none: 'Chưa nhập số lượng đến nào',
  },
  form: {
    linesTitle: 'Số lượng đến và LOT',
    headerTitle: 'Thông tin nhập hàng',
    optional: '(tùy chọn)',
  },
  filters: {
    lookupTruncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
  },
  empty: {
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
    docStatus: {
      REGISTERED: 'Đã đăng ký',
      POSTED: 'Đã ghi sổ',
      CANCEL_REQUESTED: 'Đang yêu cầu hủy',
      CANCELLED: 'Đã hủy',
    },
  },
  errors: {
    qtyNotNumber: 'Hãy nhập số lượng bằng chữ số.',
    qtyNotPositive: 'Số lượng phải lớn hơn 0.',
    receiptDatetimeRequired: 'Hãy nhập thời điểm nhập hàng.',
    deliveryNoteNoTooLong: (max: number): string =>
      `Số phiếu giao hàng không được vượt quá ${String(max)} ký tự.`,
    qtyNoRoom: 'Dòng này đã nhận đủ số lượng đặt. Hãy nhận theo P/O bổ sung.',
    lotRequired: 'Hãy nhập số LOT hoặc chọn 「Không có nhãn」.',
    lotReasonRequired: 'Không có nhãn thì hãy chọn lý do LOT thay thế.',
    lotFormat:
      'Không đúng định dạng nhãn. Nếu là số chép lại, hãy bật 「Không có nhãn」 rồi nhập số.',
    lotItemMismatch: (itemCode: string): string =>
      `Mã mặt hàng trên nhãn khác với mặt hàng của dòng này (${itemCode}).`,
    lineInvalidBlocked: (lineNos: string): string =>
      `Dòng ${lineNos} còn chỗ cần sửa nên chưa đăng ký. Hãy sửa các ô số lượng·LOT đang kèm lý do rồi đăng ký lại.`,
  },
  warnings: {
    qtyFarOverOrdered: (times: string): string =>
      `Gấp ${times} lần số lượng đặt. Hãy kiểm tra lại số chữ số.`,
  },
  notes: {
    headerShared: 'Ngày làm việc là ngày của thời điểm nhập hàng.',
    registerRecheck:
      'Hãy kiểm tra xem đã đăng ký chưa rồi mới thử lại. Gửi lại mà không kiểm tra thì cùng một lần nhập hàng có thể bị đăng ký hai lần.',
  },
  result: {
    count: (count: number): string => `Đã tạo ${String(count)} phiếu.`,
    receiptNo: 'Số phiếu',
    status: 'Trạng thái',
    excessLine: (lineNo: number, qty: string): string => `dòng ${String(lineNo)} ${qty}`,
    excessWaiting: (lines: string): string => `Phần vượt chưa liên kết: ${lines}`,
    goLinkExcess: 'Liên kết phần vượt với P/O',
  },
  dialog: {
    discardTitle: 'Bỏ số lượng đến đã nhập',
    registerTitle: 'Đăng ký nhập hàng',
    registerLead: (lines: number, excessLines: number): string =>
      excessLines === 0
        ? `Đăng ký ${String(lines)} dòng vào 1 phiếu nhập hàng.`
        : `Đăng ký ${String(lines)} dòng vào 1 phiếu nhập hàng. Trong đó ${String(excessLines)} dòng có phần vượt.`,
    registerGroupLines: 'Các dòng được ghi',
    registerGroupHeader: 'Thông tin nhập hàng',
    registerIrreversible:
      'Phiếu đã đăng ký không thể hoàn tác ở màn hình này. Việc hủy phải qua phê duyệt.',
    registerEffects:
      'Số đã nhận lũy kế của dòng đơn sẽ tăng, mặt hàng thuộc diện kiểm tra đầu vào sẽ được tạo kèm yêu cầu kiểm tra.',
    excessOf: (normalQty: string, excessQty: string): string =>
      `Ghi vào P/O ${normalQty} · Phần vượt ${excessQty}`,
    lotOf: (lotNo: string): string => `LOT ${lotNo}`,
    lotMissingOf: (reason: string): string => `Không có nhãn (${reason})`,
  },
};
