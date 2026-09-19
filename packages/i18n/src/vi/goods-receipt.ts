import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-10 정상품 입하 처리. 고르는 것은 **입하 전표**이고 만드는 것은 **입고 전표**라
 * 두 낱말을 가려 쓴다. ERP 는 「대기열 적재」까지만 말하고 「전송 완료」라고 쓰지 않는다.
 */
export const goodsReceipt: Translated<typeof ko.goodsReceipt> = {
  title: 'Xử lý nhập hàng đạt',
  breadcrumbRoot: 'Kho vật tư',
  panes: {
    list: 'Danh sách phiếu nhập hàng',
    lines: 'Các dòng của phiếu đã chọn',
    post: 'Nhập thông tin xử lý nhập kho',
  },
  fields: {
    supplier: 'Nhà cung cấp',
    supplierPlaceholder: 'Mã hoặc tên nhà cung cấp',
    receiptDateFrom: 'Ngày nhập hàng bắt đầu',
    receiptDateTo: 'Ngày nhập hàng kết thúc',
    status: 'Trạng thái',
    q: 'Tìm số nhập hàng · số phiếu giao hàng',
    qPlaceholder: 'Số nhập hàng hoặc số phiếu giao hàng',
    warehouse: 'Kho nhập',
    location: 'Vị trí cất hàng',
    receiptType: 'Loại nhập kho',
    sourceDocumentType: 'Loại chứng từ gốc',
    qualityStatus: 'Trạng thái chất lượng',
    inventoryStatus: 'Trạng thái tồn kho',
    reason: 'Lý do',
    receiptDatetime: 'Thời điểm nhập kho',
    remarks: 'Ghi chú',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    selectRow: (inboundReceiptNo: string): string => `Chọn ${inboundReceiptNo}`,
    deselectRow: (inboundReceiptNo: string): string => `Bỏ chọn ${inboundReceiptNo}`,
    selectLine: (lineNo: number): string => `Chọn dòng ${String(lineNo)}`,
    deselectLine: (lineNo: number): string => `Bỏ chọn dòng ${String(lineNo)}`,
    post: 'Xử lý nhập kho',
    confirmPost: 'Thực hiện xử lý nhập kho',
    keepEditing: 'Hủy',
    cancelPost: 'Hủy',
    discardDraft: 'Chọn lại',
    viewSourceDocument: 'Xem chứng từ gốc',
  },
  actionReasons: {
    postCodeListPending:
      'Xử lý nhập kho: danh sách mã vận hành của loại nhập kho và trạng thái chất lượng chưa sẵn sàng nên hiện chưa xử lý nhập kho được.',
    postNeedsWarehouse: 'Xử lý nhập kho: hãy chọn kho nhập.',
    postNeedsLocation: 'Xử lý nhập kho: hãy chọn vị trí cất hàng.',
    postNeedsCodes: 'Xử lý nhập kho: hãy chọn đủ các mã bắt buộc.',
    postNeedsReceiptDatetime: 'Xử lý nhập kho: hãy nhập thời điểm nhập kho.',
    sourceDocumentUnavailable:
      'Xem chứng từ gốc: quy ước tương ứng giữa loại chứng từ gốc và đối tượng chưa được chốt nên không mở được chứng từ. Chỉ thấy mã loại và số nhập hàng.',
  },
  errors: {
    codeTooLong: (max: number): string => `Mã không được vượt quá ${String(max)} ký tự.`,
  },
  reasons: {
    referencesFailed: 'Không tải được tên nhà cung cấp. Lý do sẽ hiện ở chỗ của tên.',
    lineReferencesFailed:
      'Không tải được tên mặt hàng, đơn vị, LOT vật tư và nhà máy. Lý do sẽ hiện ở chỗ của tên.',
    lineReferencesTruncated:
      'Thông tin chưa xác nhận có thể hiện 「Không xác định」; đó không phải lỗi của giá trị thực.',
    postOptionsFailed: 'Không tải được danh sách chọn kho nhập và vị trí cất hàng.',
    lineNoLot: 'Chưa tạo LOT vật tư.',
    lineQtyNotPositive: 'Số lượng nhập phải lớn hơn 0 mới chọn được.',
  },
  loading: {
    inboundReceipts: 'Đang tải danh sách phiếu nhập hàng',
    lines: 'Đang tải các dòng nhập hàng',
  },
  table: {
    inboundReceiptNo: 'Số nhập hàng',
    supplier: 'Nhà cung cấp',
    receiptDatetime: 'Thời điểm nhập hàng',
    deliveryNoteNo: 'Số phiếu giao hàng',
    status: 'Trạng thái',
    select: 'Chọn',
  },
  postTitle: 'Thông tin nhập kho',
  lineTable: {
    title: 'Dòng nhập hàng',
    lineNo: 'Số dòng',
    item: 'Mặt hàng',
    receivedQty: 'Số lượng nhập hàng',
    lot: 'LOT vật tư',
    expiryDate: 'Hạn sử dụng',
    select: 'Chọn',
    receivedQtyPair: (receivedQty: number, uom: string): string => `${String(receivedQty)} ${uom}`,
  },
  summary: {
    label: 'Phiếu nhập hàng đã chọn',
    inboundReceiptNo: 'Số nhập hàng',
    supplier: 'Nhà cung cấp',
    plant: 'Nhà máy',
    receiptDatetime: 'Thời điểm nhập hàng',
    deliveryNoteNo: 'Số phiếu giao hàng',
    status: 'Trạng thái',
  },
  lineSummary: {
    label: 'Dòng nhập hàng đã chọn',
    lineNo: 'Số dòng',
    item: 'Mặt hàng',
    receivedQty: 'Số lượng nhập hàng',
    lot: 'LOT vật tư',
    expiryDate: 'Hạn sử dụng',
    inspectionRequired: 'Diện kiểm tra đầu vào',
    status: 'Trạng thái',
    inspectionYes: 'Thuộc diện',
    inspectionNo: 'Không thuộc diện',
  },
  filters: {
    all: 'Tất cả',
    lookupTruncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
    lookupLoading: 'Đang tải danh sách chọn.',
    supplierPickFromList: 'Hãy chọn nhà cung cấp trong danh sách.',
    statusPending: 'Chưa chốt mã nên chưa chọn được.',
    codePending: 'Chưa chốt mã nên chưa chọn được.',
    chipSupplier: (value: string): string => `Nhà cung cấp: ${value}`,
    chipPeriodBoth: (from: string, to: string): string => `Ngày nhập hàng: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `Ngày nhập hàng: từ ${from}`,
    chipPeriodTo: (to: string): string => `Ngày nhập hàng: đến ${to}`,
    chipStatus: (value: string): string => `Trạng thái: ${value}`,
    chipQ: (value: string): string => `Từ khóa: ${value}`,
    chipRemoveSupplier: 'Bỏ điều kiện nhà cung cấp',
    chipRemovePeriod: 'Bỏ điều kiện ngày nhập hàng',
    chipRemoveStatus: 'Bỏ điều kiện trạng thái',
    chipRemoveQ: 'Bỏ điều kiện từ khóa',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} phiếu`,
    totalOnly: (total: number): string => `Tổng ${String(total)} phiếu`,
  },
  empty: {
    noResultTitle: 'Không có phiếu nhập hàng nào khớp điều kiện',
    noResultDescription: 'Hãy bớt điều kiện hoặc nới rộng khoảng ngày nhập hàng rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noSelectionTitle: 'Hãy chọn phiếu nhập hàng',
    noSelectionDescription: 'Bấm 「Chọn」 ở phiếu cần nhập trong danh sách.',
    noLinesTitle: 'Không có dòng để nhập kho',
    noLinesDescription: 'Phiếu này không có dòng mặt hàng nào có thể nhập kho.',
    listFailedTitle: 'Không tải được danh sách phiếu nhập hàng nên không mở được phiếu này',
    listFailedDescription: 'Hãy bấm 「Thử lại」 ở trên để tải danh sách rồi chọn lại.',
  },
  values: {
    empty: '—',
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    inactiveSuffix: ' (không dùng)',
    selectPlaceholder: 'Hãy chọn',
    fieldPlaceholders: {
      warehouse: 'Hãy chọn kho nhập',
      location: 'Hãy chọn vị trí cất hàng',
      receiptType: 'Hãy chọn loại nhập kho',
      sourceDocumentType: 'Hãy chọn loại chứng từ gốc',
      qualityStatus: 'Hãy chọn trạng thái chất lượng',
      inventoryStatus: 'Hãy chọn trạng thái tồn kho',
      reason: 'Hãy chọn lý do',
    },
  },
  notes: {
    singleLineSelect: 'Mỗi lần chỉ chọn được một dòng nhập hàng.',
    businessDateDerived: 'Ngày nghiệp vụ tự đặt theo thời điểm nhập kho đã chọn.',
    qtyFromInboundLine:
      'Nhập nguyên mặt hàng, số lượng, đơn vị, LOT vật tư của dòng đã chọn; không nhập tách số lượng.',
    plantFromInboundReceipt: 'Nhà máy tự áp dụng theo phiếu nhập hàng đã chọn.',
    warehousePlant: (plant: string): string => `Nhà máy của kho đã chọn: ${plant}`,
    warehousePlantDiffers: (plant: string): string =>
      `Nhà máy của kho đã chọn khác với nhà máy của phiếu nhập hàng (${plant}).`,
    postRecheck:
      'Hãy kiểm tra xem phiếu nhập kho đã được tạo chưa rồi mới thử lại. Gửi lại mà không kiểm tra thì cùng một lần nhập hàng có thể bị nhập kho hai lần.',
  },
  dialog: {
    submitTitle: 'Xử lý nhập kho với nội dung này chứ?',
    submitLead: 'Hãy kiểm tra nội dung nhập kho rồi thực hiện.',
    submitGroupWhat: 'Đối tượng nhập kho',
    submitGroupWhere: 'Vị trí nhập kho',
    submitGroupHow: 'Điều kiện nhập kho',
    submitIrreversible: 'Sau khi nhập kho sẽ không hoàn tác được trên màn hình này.',
    submitEffects:
      'Tạo và ghi sổ phiếu nhập kho, đổi trạng thái LOT vật tư, ghi sổ xuất nhập, cập nhật tồn kho, xếp hàng đợi gửi ERP được xử lý cùng lúc.',
    discardTitle: 'Hủy các thay đổi chứ?',
    discardLead: 'Có nội dung chưa lưu. Nếu hủy, các thay đổi sẽ mất.',
  },
  result: {
    label: 'Kết quả xử lý nhập kho',
    receiptNo: 'Số nhập kho',
    status: 'Trạng thái',
    sourceDocument: 'Chứng từ gốc',
    sourceDocumentPair: (typeCode: string, inboundReceiptNo: string): string =>
      `${typeCode} · ${inboundReceiptNo}`,
    lotStatus: 'Trạng thái LOT vật tư',
    lotStatusLoading: 'Đang tải lại trạng thái LOT vật tư',
    lotStatusFailed: 'Không tải lại được trạng thái LOT vật tư.',
    lotStatusNote:
      'Đây là giá trị nhận được khi tra cứu lại LOT vật tư sau khi xử lý nhập kho. Màn hình hiện nguyên giá trị này mà không diễn giải.',
    ledgerAll: 'Mỗi dòng nhập kho đều đã được tạo kèm một dòng sổ cái xuất nhập.',
    ledgerSome: 'Chỉ một phần các dòng nhập kho có dòng sổ cái xuất nhập.',
    ledgerNone: 'Phản hồi không kèm dòng sổ cái xuất nhập nào.',
    balanceNote:
      'Màn hình này không kiểm tra số dư tồn kho. Hãy xem số dư ở màn hình tra cứu tồn kho.',
    erpQueued:
      'Đã đưa vào hàng đợi gửi ERP. Chưa phải là đã cập nhật sang hệ thống bên kia nên tra cứu ngay lúc này có thể chưa thấy.',
    erpNotQueued:
      'Chưa được đưa vào hàng đợi gửi ERP. Việc hệ thống bên kia đã cập nhật hay chưa, hãy xem ở màn hình tình trạng đồng bộ liên kết.',
    erpUnknown:
      'Không xác định được đã đưa vào hàng đợi gửi ERP hay chưa. Phản hồi không kèm giá trị đó.',
  },
};
