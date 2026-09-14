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
    receiptDateFrom: 'Ngày nhập hàng bắt đầu',
    receiptDateTo: 'Ngày nhập hàng kết thúc',
    status: 'Trạng thái',
    q: 'Tìm số nhập hàng · số phiếu giao hàng',
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
    keepEditing: 'Nhập tiếp',
    discardDraft: 'Bỏ nội dung đã nhập',
    viewSourceDocument: 'Xem chứng từ gốc',
  },
  actionReasons: {
    postCodeListPending:
      'Xử lý nhập kho: danh sách mã vận hành của loại nhập kho và trạng thái chất lượng chưa sẵn sàng nên hiện chưa xử lý nhập kho được.',
    postNeedsWarehouse: 'Xử lý nhập kho: hãy chọn kho nhập.',
    postNeedsLocation: 'Xử lý nhập kho: hãy chọn vị trí cất hàng.',
    postNeedsCodes: 'Xử lý nhập kho: hãy chọn đủ các mã bắt buộc.',
    postNeedsReceiptDatetime: 'Xử lý nhập kho: hãy nhập thời điểm nhập kho.',
    locationNeedsWarehouse:
      'Vị trí cất hàng: hãy chọn kho nhập trước thì mới chọn được vị trí của kho đó.',
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
      'Danh sách tên mặt hàng, đơn vị, LOT vật tư và nhà máy chỉ về một phần. 「Không xác định」 ở chỗ của tên có thể không phải là giá trị sai mà là chưa có trong danh sách này.',
    postOptionsFailed: 'Không tải được danh sách chọn kho nhập và vị trí cất hàng.',
    lineNoLot:
      'Dòng này chưa có LOT vật tư nên chưa nhập kho được. Khi LOT vật tư được tạo thì chọn được dòng này.',
    lineQtyNotPositive:
      'Dòng này có số lượng nhập hàng từ 0 trở xuống nên không nhập kho được. Khi số lượng nhập hàng lớn hơn 0 thì chọn được dòng này.',
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
  lineTable: {
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
    periodNote: 'Để trống ngày nhập hàng thì xem toàn bộ, không thu hẹp khoảng thời gian.',
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
    noSelectionTitle: 'Chọn một phiếu nhập hàng để xem các dòng',
    noSelectionDescription:
      'Hãy chọn phiếu nhập hàng cần nhận vào kho ở danh sách trên rồi bấm 「Chọn」.',
    noLinesTitle: 'Phiếu nhập hàng này không có dòng nào',
    noLinesDescription:
      'Phiếu không chứa dòng mặt hàng nào nên không xác định được thứ cần nhập kho.',
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
  },
  notes: {
    singleLineSelect: 'Mỗi lần chỉ chọn được một dòng. Chọn dòng khác thì lựa chọn trước đó bị gỡ.',
    businessDateDerived:
      'Ngày làm việc được lấy theo ngày của thời điểm nhập kho. Không có ô nhập riêng.',
    qtyFromInboundLine:
      'Số lượng nhập kho, mặt hàng, đơn vị và LOT vật tư được lấy nguyên theo dòng nhập hàng đã chọn. Không có ô nhập để nhận tách phần.',
    plantFromInboundReceipt: 'Nhà máy được lấy theo phiếu nhập hàng đã chọn.',
    warehousePlant: (plant: string): string => `Nhà máy của kho đã chọn: ${plant}`,
    warehousePlantDiffers:
      'Nhà máy của kho đã chọn khác với nhà máy của phiếu nhập hàng. Phiếu nhập kho sẽ ghi nhà máy của phiếu nhập hàng.',
    postRecheck:
      'Hãy kiểm tra xem phiếu nhập kho đã được tạo chưa rồi mới thử lại. Gửi lại mà không kiểm tra thì cùng một lần nhập hàng có thể bị nhập kho hai lần.',
  },
  dialog: {
    submitTitle: 'Xử lý nhập kho với nội dung này chứ?',
    submitLead:
      'Phiếu nhập kho sẽ được tạo với các giá trị dưới đây. Hãy kiểm tra một lần nữa trước khi gửi.',
    submitEffects:
      'Một lần xử lý nhập kho sẽ đồng thời tạo và ghi sổ phiếu nhập kho, chuyển trạng thái LOT vật tư, ghi sổ cái xuất nhập, cập nhật số dư tồn kho và đưa vào hàng đợi gửi ERP. Màn hình này không hoàn tác được.',
    discardTitle: 'Bỏ các giá trị đã nhập chứ?',
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
