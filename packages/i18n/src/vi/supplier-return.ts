import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-05 공급사 반품 처리. 상태말을 화면이 짓지 않고 서버 코드를 그대로 낸다.
 * 보유 수량을 못 구한 줄은 「확인하지 못함」이라 적고 그 줄을 막지 않는다.
 */
export const supplierReturn: Translated<typeof ko.supplierReturn> = {
  title: 'Xử lý trả hàng nhà cung cấp',
  breadcrumbRoot: 'Kho vật tư',
  panes: {
    list: 'Danh sách phiếu nhập kho',
    lines: 'Các dòng của phiếu nhập kho đã chọn',
    form: 'Thông tin trả hàng',
    result: 'Kết quả xử lý trả hàng',
  },
  fields: {
    warehouse: 'Kho',
    period: 'Ngày nhập kho',
    receiptType: 'Loại nhập kho',
    status: 'Trạng thái',
    q: 'Tìm số nhập kho',
    supplier: 'Nhà cung cấp',
    issueType: 'Loại xuất kho',
    sourceDocumentType: 'Loại chứng từ gốc',
    destinationType: 'Loại nơi đến',
    reason: 'Lý do trả hàng',
    issuedDate: 'Ngày xuất kho',
    issuedTime: 'Giờ xuất kho',
    issuedAt: 'Thời điểm xuất kho',
    businessDate: 'Ngày làm việc',
    replacementExpected: 'Dự kiến nhập bù',
    sendToErp: 'Gửi ERP',
    remarks: 'Ghi chú',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    refresh: 'Tra cứu lại',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    selectRow: (goodsReceiptNo: string): string => `Chọn ${goodsReceiptNo}`,
    deselectRow: (goodsReceiptNo: string): string => `Bỏ chọn ${goodsReceiptNo}`,
    submit: 'Xử lý trả hàng',
    discardDrafts: 'Xóa nội dung đã nhập',
    keepEditing: 'Nhập tiếp',
    confirmSubmit: 'Thực hiện xử lý trả hàng',
    confirmDiscard: 'Thực hiện xóa nội dung đã nhập',
  },
  actionReasons: {
    codeListPending:
      'Danh sách giá trị của loại xuất kho, loại chứng từ gốc, loại nơi đến và lý do trả hàng chưa được chốt nên chưa xử lý trả hàng được. Phần tra cứu đối tượng và nhập dòng, số lượng thì hiện vẫn dùng được.',
    needsSupplier: 'Hãy chọn nhà cung cấp cần trả hàng về.',
    needsCodes: 'Hãy chọn đủ các mã trong thông tin trả hàng.',
    needsIssuedDate: 'Hãy chọn ngày xuất kho.',
    needsIssuedTime: 'Hãy ghi giờ xuất kho.',
    nothingToDiscard: 'Không có nội dung nhập nào để xóa.',
  },
  errors: {
    qtyNotNumber: 'Hãy ghi số lượng trả hàng bằng chữ số.',
    qtyNotPositive: 'Số lượng trả hàng phải lớn hơn 0.',
    qtyOverOnHand: (onHandQty: number): string =>
      `Không trả về được nhiều hơn số lượng hiện có ${String(onHandQty)}.`,
    codeTooLong: (max: number): string => `Không được vượt quá ${String(max)} ký tự.`,
  },
  filters: {
    all: 'Tất cả',
    periodNote:
      'Không đặt khoảng thời gian thì hiện phạm vi mặc định do máy chủ quy định. Muốn thu hẹp thì hãy chọn ngày nhập kho.',
    periodClearNote:
      'Ngày nhập kho chỉ xóa được bằng 「Đặt lại」. Các điều kiện khác thì gỡ bằng dấu × trên bảng điều kiện.',
    lookupFailed: 'Không tải được danh sách tên. Hãy thử lại.',
    lookupTruncated:
      'Danh sách tên chỉ về một phần. Giá trị cần tìm có thể không có trong danh sách — không phải là đã mất.',
    chipWarehouse: (name: string): string => `Kho: ${name}`,
    chipPeriodBoth: (from: string, to: string): string => `Ngày nhập kho: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `Ngày nhập kho: từ ${from}`,
    chipPeriodTo: (to: string): string => `Ngày nhập kho: đến ${to}`,
    chipReceiptType: (code: string): string => `Loại nhập kho: ${code}`,
    chipStatus: (code: string): string => `Trạng thái: ${code}`,
    chipQ: (q: string): string => `Từ khóa: ${q}`,
    chipRemoveWarehouse: 'Gỡ điều kiện kho',
    chipRemoveReceiptType: 'Gỡ điều kiện loại nhập kho',
    chipRemoveStatus: 'Gỡ điều kiện trạng thái',
    chipRemoveQ: 'Gỡ điều kiện từ khóa',
  },
  loading: {
    goodsReceipts: 'Đang tải danh sách phiếu nhập kho',
    detail: 'Đang tải phiếu nhập kho đã chọn',
  },
  empty: {
    noResultTitle: 'Không có phiếu nhập kho nào khớp điều kiện',
    noResultDescription: 'Hãy nới rộng khoảng thời gian hoặc gỡ bớt điều kiện rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Quay về trang trước thì xem được kết quả.',
    noSelectionTitle: 'Chưa chọn phiếu nhập kho nào',
    noSelectionDescription: 'Hãy chọn ở danh sách trên phiếu nhập kho có chứa vật tư cần trả về.',
    noLinesTitle: 'Phiếu nhập kho này không có dòng nào',
    noLinesDescription: 'Hãy chọn phiếu nhập kho khác hoặc hỏi người phụ trách.',
    notFoundTitle: 'Không tìm thấy phiếu nhập kho đã chọn',
    notFoundDescription: 'Phiếu đã bị xóa hoặc số trên địa chỉ bị sai. Hãy chọn lại từ danh sách.',
  },
  reasons: {
    referencesFailed: 'Không tải được tên kho. Lý do sẽ hiện ở chỗ của tên.',
    lineReferencesFailed:
      'Không tải được tên mặt hàng, đơn vị, LOT vật tư và vị trí. Lý do sẽ hiện ở chỗ của tên.',
    lineReferencesTruncated:
      'Danh sách tên mặt hàng, đơn vị, LOT vật tư và vị trí chỉ về một phần. 「Không xác định」 ở chỗ của tên có thể không phải là giá trị sai mà là chưa có trong danh sách này.',
    lineMissingValues:
      'Dòng này thiếu các giá trị cần cho việc trả hàng (mặt hàng, LOT vật tư, đơn vị, vị trí).',
    lineQtyNotPositive: 'Số lượng nhập kho từ 0 trở xuống nên không có gì để trả về.',
    selectNone: 'Hãy chọn ít nhất một dòng để trả hàng.',
    selectQtyMissing: 'Hãy điền số lượng trả hàng cho các dòng đã chọn.',
    selectQtyInvalid: 'Có dòng bị lỗi ở số lượng trả hàng. Hãy sửa dòng đó trước.',
    balancesFailed:
      'Không tải được số lượng hiện có. Lý do sẽ hiện ở chỗ số lượng hiện có của dòng đó.',
    balancesTruncated:
      'Danh sách số lượng hiện có chỉ về một phần. Tổng có thể ít hơn thực tế nên không dùng làm hạn mức của dòng đó.',
    onHandUnknownNote:
      'Những dòng chưa xác nhận được số lượng hiện có thì màn hình không chặn bằng hạn mức. Sau khi gửi, máy chủ sẽ quyết định cuối cùng.',
    partnersFailed: 'Không tải được danh sách nhà cung cấp. Hãy thử lại.',
    partnersTruncated:
      'Danh sách nhà cung cấp chỉ về một phần. Nếu không thấy nhà cung cấp cần tìm, hãy báo người phụ trách — không phải là đã mất.',
  },
  table: {
    goodsReceiptNo: 'Số nhập kho',
    warehouse: 'Kho',
    receiptType: 'Loại nhập kho',
    receiptDatetime: 'Thời điểm nhập kho',
    status: 'Trạng thái',
    select: 'Chọn',
  },
  lineTable: {
    select: 'Chọn',
    item: 'Mặt hàng',
    lot: 'LOT vật tư',
    location: 'Vị trí',
    receiptQty: 'Số lượng nhập kho',
    onHandQty: 'Số lượng hiện có',
    returnQty: 'Số lượng trả hàng',
    receiptQtyPair: (receiptQty: number, uom: string): string => `${String(receiptQty)} ${uom}`,
    onHandQtyPair: (onHandQty: number, uom: string): string => `${String(onHandQty)} ${uom}`,
    returnQtyPair: (issueQty: number, uom: string): string => `${String(issueQty)} ${uom}`,
    selectLabel: (ordinal: number): string => `Chọn dòng thứ ${String(ordinal)}`,
    returnQtyLabel: (ordinal: number): string =>
      `Số lượng trả hàng của dòng thứ ${String(ordinal)}`,
  },
  selection: {
    none: 'Chưa chọn dòng nào.',
    summary: (count: number, totalQty: number, uom: string): string =>
      `Đã chọn ${String(count)} dòng · tổng số lượng trả hàng ${String(totalQty)} ${uom}`,
    summaryMixedUom: (count: number): string =>
      `Đã chọn ${String(count)} dòng · đơn vị lẫn lộn nên không tính tổng`,
  },
  summary: {
    label: 'Phiếu nhập kho đã chọn',
    goodsReceiptNo: 'Số nhập kho',
    warehouse: 'Kho',
    receiptDatetime: 'Thời điểm nhập kho',
    receiptType: 'Loại nhập kho',
    status: 'Trạng thái',
  },
  dialog: {
    submitTitle: 'Xử lý trả hàng với nội dung này chứ?',
    submitLead: 'Phiếu trả hàng sẽ được tạo với nội dung dưới đây và ghi sổ ngay.',
    linePair: (item: string, lot: string, qty: string): string => `${item} · ${lot} · ${qty}`,
    lineCount: (count: number): string => `Đã chọn ${String(count)} dòng`,
    businessDateDerived: (businessDate: string): string =>
      `${businessDate} (giá trị lấy từ ngày xuất kho)`,
    submitEffects: 'Thao tác này trừ tồn kho, và việc đăng ký với ghi sổ xảy ra cùng một lúc.',
    submitNoUndoHere: 'Màn hình này không có cách nào để hoàn tác.',
    submitLotHoldKept: 'Dù đã trả hàng thì phần tạm giữ của LOT vật tư vẫn giữ nguyên.',
    submitOnHandUnknown:
      'Có dòng chưa xác nhận được số lượng hiện có. Nếu vượt hạn mức thì máy chủ sẽ trả về 400.',
    discardTitle: 'Xóa nội dung đã nhập chứ?',
  },
  result: {
    label: 'Kết quả xử lý trả hàng',
    goodsIssueNo: 'Số phiếu trả hàng',
    status: 'Trạng thái',
    lines: 'Các dòng đã trả hàng',
    linePair: (item: string, lot: string, qty: string): string => `${item} · ${lot} · ${qty}`,
    created: 'Đã tạo phiếu trả hàng và gửi kèm yêu cầu ghi sổ.',
    statusNote: 'Mã trạng thái được hiện nguyên theo giá trị máy chủ trả về.',
    erpQueued: 'Đã đưa vào hàng đợi gửi ERP — là đưa vào hàng đợi chứ không phải đã gửi.',
    erpNotQueued: 'Chưa được đưa vào hàng đợi gửi ERP.',
    erpUnknown: 'Phản hồi không cho biết đã đưa vào hàng đợi gửi ERP hay chưa.',
    notConfirmed:
      'Tồn kho giảm bao nhiêu và việc ghi sổ đã thực sự xong hay chưa thì màn hình này chưa xác nhận — phản hồi không có thông tin đó.',
    linesNote: 'Danh sách dòng dưới đây là nội dung phiếu trả hàng do máy chủ trả về.',
  },
  notes: {
    lotHold:
      'LOT vật tư có dấu 「Tạm giữ」 đang bị tạm giữ vì chất lượng. Màn hình này không gỡ được.',
    returnQtyEmptyStart:
      'Số lượng trả hàng bắt đầu bằng ô trống. Hãy tự ghi lượng cần trả về cho từng dòng.',
    submitRecheck:
      'Không xác nhận được đã gửi đến máy chủ hay chưa. Hãy tra cứu lại danh sách để xem phiếu trả hàng đã được tạo chưa rồi mới thử lại.',
    businessDateDerived: 'Ngày làm việc được gửi kèm theo giá trị lấy từ ngày xuất kho.',
    sendToErpNote:
      'Cấu hình gửi ERP không đổi được ở màn hình này. Ở đây chỉ quyết định có gửi hay không.',
    replacementExpectedNote:
      'Dự kiến nhập bù chỉ được ghi làm dấu trên phiếu. Không nối sang danh sách kế hoạch nhập hàng.',
  },
  values: {
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Tải tên thất bại',
    onHandLoading: 'Đang tải',
    onHandUnknown: 'Chưa xác nhận được',
    inactiveSuffix: ' (không dùng)',
    lotHeld: 'Tạm giữ',
    yes: 'Có',
    no: 'Không',
    empty: 'Không có',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (from: number, to: number, total: number): string =>
      `${String(from)}–${String(to)} / Tổng ${String(total)} phiếu`,
    totalOnly: (total: number): string => `Tổng ${String(total)} phiếu`,
  },
};
