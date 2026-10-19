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
    goFirstPage: 'Về trang đầu',
    post: 'Xử lý nhập kho',
    keepEditing: 'Hủy',
    discardDraft: 'Chọn lại',
    openRow: (inboundReceiptNo: string): string => `Xử lý ${inboundReceiptNo}`,
    nextLine: 'Xử lý dòng tiếp theo',
    toWorklist: 'Về Xử lý nhập hàng đạt',
  },
  actionReasons: {
    postCodeListPending:
      'Danh sách mã của loại nhập kho, trạng thái chất lượng và trạng thái tồn kho chưa sẵn sàng nên chưa xử lý nhập kho được. Hãy liên hệ quản trị viên.',
    postNeedsWarehouse: 'Hãy chọn kho nhập.',
    postNeedsLocation: 'Hãy chọn vị trí cất hàng.',
    postNeedsCodes: 'Hãy chọn loại nhập kho, trạng thái chất lượng và trạng thái tồn kho.',
    postNeedsReceiptDatetime: 'Hãy nhập thời điểm nhập kho.',
  },
  errors: {
    codeTooLong: (max: number): string => `Mã không được vượt quá ${String(max)} ký tự.`,
  },
  reasons: {
    referencesFailed: 'Không tải được tên nhà cung cấp. Lý do sẽ hiện ở chỗ của tên.',
    lineReferencesFailed:
      'Không tải được tên mặt hàng, đơn vị và LOT vật tư. Lý do sẽ hiện ở chỗ của tên.',
    plantFailed: 'Không tải được tên nhà máy.',
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
    go: 'Mở màn hình xử lý',
  },
  postTitle: 'Thông tin nhập kho',
  lineTable: {
    title: 'Dòng nhập hàng',
    lineNo: 'Số dòng',
    item: 'Mặt hàng',
    receivedQty: 'Số lượng nhập hàng',
    lot: 'LOT vật tư',
    expiryDate: 'Hạn sử dụng',
    receivedQtyPair: (receivedQty: number, uom: string): string => `${String(receivedQty)} ${uom}`,
    rowLabel: (lineNo: number): string => `Dòng ${String(lineNo)}`,
  },
  summary: {
    inboundReceiptNo: 'Số nhập hàng',
  },
  lineSummary: {
    lineNo: 'Số dòng',
    item: 'Mặt hàng',
    receivedQty: 'Số lượng nhập hàng',
    lot: 'LOT vật tư',
  },
  filters: {
    all: 'Tất cả',
    lookupTruncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
    lookupLoading: 'Đang tải danh sách chọn.',
    supplierPickFromList: 'Hãy chọn nhà cung cấp trong danh sách.',
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
  empty: {
    noResultTitle: 'Không có phiếu nhập hàng nào khớp điều kiện',
    noResultDescription: 'Hãy bớt điều kiện hoặc nới rộng khoảng ngày nhập hàng rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noLinesTitle: 'Không có dòng để nhập kho',
    noLinesDescription: 'Phiếu này không có dòng mặt hàng nào có thể nhập kho.',
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
    warehousePlant: (plant: string): string => `Nhà máy của kho đã chọn: ${plant}`,
    warehousePlantDiffers: (plant: string): string =>
      `Nhà máy của kho đã chọn khác với nhà máy của phiếu nhập hàng (${plant}).`,
    postRecheck:
      'Hãy kiểm tra xem phiếu nhập kho đã được tạo chưa rồi mới thử lại. Gửi lại mà không kiểm tra thì cùng một lần nhập hàng có thể bị nhập kho hai lần.',
  },
  dialog: {
    submitGroupWhat: 'Đối tượng nhập kho',
    submitGroupWhere: 'Vị trí nhập kho',
    submitGroupHow: 'Điều kiện nhập kho',
    submitIrreversible: 'Sau khi nhập kho sẽ không hoàn tác được trên màn hình này.',
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
  process: {
    steps: {
      line: 'Chọn dòng',
      post: 'Thông tin nhập',
      confirm: 'Xác nhận',
    },
    remaining: {
      pickLine: 'Hãy chọn dòng nhập hàng cần nhập kho.',
      next: 'Hãy sang bước tiếp theo.',
      confirm: 'Kiểm tra nội dung rồi bấm xử lý nhập kho.',
      done: 'Xử lý dòng tiếp theo hoặc quay về danh sách công việc.',
    },
    derived: {
      title: 'Giá trị tự động',
      plant: 'Nhà máy',
      receiptQty: 'Số lượng nhập kho',
      sourceDocumentType: 'Loại chứng từ gốc',
      businessDate: 'Ngày nghiệp vụ',
      fromInboundReceipt: 'Từ phiếu nhập hàng',
      fromInboundLine: 'Toàn bộ dòng nhập hàng',
      fromReceiptDatetime: 'Ngày của thời điểm nhập kho',
    },
    receiptTime: 'Giờ nhập kho',
    effectsTitle: 'Những gì được ghi nhận khi xử lý nhập kho',
    effects: {
      createReceipt: 'Tạo phiếu nhập kho',
      lotStatus: 'Đổi trạng thái LOT vật tư',
      ledger: 'Ghi sổ xuất nhập',
      balance: 'Cập nhật số lượng khả dụng',
      erp: 'Đưa G/R vào hàng đợi gửi ERP',
      erpNote: 'không gửi ngay',
    },
    doneTitle: 'Đã xử lý nhập kho',
    doneReceiptNo: (goodsReceiptNo: string): string => `Số nhập kho ${goodsReceiptNo}`,
    notFoundTitle: 'Không tìm thấy phiếu nhập hàng',
    notFoundDescription: 'Hãy chọn lại phiếu nhập hàng từ danh sách công việc.',
    previousLine: (lineNo: number, item: string, lot: string, qty: string): string =>
      `Dòng ${String(lineNo)} · ${item} · ${lot} · ${qty}`,
    previousWhere: (warehouse: string, location: string): string => `${warehouse} / ${location}`,
  },
};
