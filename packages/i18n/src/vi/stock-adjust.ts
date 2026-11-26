import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-12 재고조정. 수량을 부르는 말은 **장부 · 실물 · 차이** 셋뿐이다 —
 * 결과 수량을 뜻하는 말을 쓰면 사용자가 덮어쓰기 화면으로 읽는다.
 * 승인·반려는 결재함이 소유하므로 이 묶음이 말하지 않는다.
 */
export const stockAdjust: Translated<typeof ko.stockAdjust> = {
  title: 'Điều chỉnh tồn kho',
  breadcrumbRoot: 'Quản lý mua hàng / vật tư',
  panes: {
    source: 'Nguồn điều chỉnh',
    lines: 'Đối tượng điều chỉnh',
    register: 'Đăng ký điều chỉnh',
    history: 'Lịch sử xử lý',
    historyDetail: 'Chi tiết phiếu điều chỉnh',
  },
  tabs: {
    label: 'Cách xem điều chỉnh tồn kho',
    register: 'Đăng ký điều chỉnh',
    history: 'Lịch sử xử lý',
  },
  fields: {
    reasonCode: 'Lý do điều chỉnh',
    reasonCodePlaceholder: 'Hãy chọn lý do',
    sendToErp: 'Gửi ERP',
  },
  submit: {
    reason: 'Lý do trình',
    reasonPlaceholder: 'Hãy ghi một dòng về điều chỉnh cái gì và vì sao.',
  },
  source: {
    kindLabel: 'Nguồn điều chỉnh',
    count: 'Chênh lệch kiểm kê',
    direct: 'Đăng ký trực tiếp',
    countField: 'Kiểm kê liên quan',
    countPlaceholder: 'Hãy chọn kiểm kê',
    warehouseField: 'Kho liên quan',
    warehousePlaceholder: 'Hãy chọn kho',
    countRefLabel: 'Kiểm kê liên quan',
    loadedNote: (lineCount: number): string =>
      `Đã lấy ${String(lineCount)} dòng chênh lệch kiểm kê làm đối tượng điều chỉnh.`,
    loadedEmptyNote: 'Kiểm kê này không có dòng nào bị chênh lệch.',
    loadedTruncatedNote: (lineCount: number, total: number): string =>
      `Trong ${String(total)} dòng bị chênh lệch chỉ lấy được ${String(lineCount)} dòng đầu. Phần còn lại chưa phải là đối tượng điều chỉnh.`,
    changeDiscardNote: (lineCount: number): string =>
      `Đổi nguồn thì ${String(lineCount)} dòng đối tượng điều chỉnh đang dựng sẽ mất.`,
    countNotFoundNote:
      'Không tìm thấy kiểm kê mà địa chỉ trỏ tới trong danh sách nên đã bỏ khỏi đối tượng. Hãy chọn kiểm kê ở dưới.',
  },
  lineTable: {
    location: 'Vị trí',
    item: 'Mặt hàng',
    lot: 'LOT vật tư',
    bookQty: 'Sổ sách',
    actualQty: 'Thực tế',
    adjustmentQty: 'Chênh lệch',
    rowActions: 'Thao tác dòng',
    locationLabel: (lineNo: number): string => `Vị trí của dòng ${String(lineNo)}`,
    itemLabel: (lineNo: number): string => `Mặt hàng của dòng ${String(lineNo)}`,
    lotLabel: (lineNo: number): string => `LOT vật tư của dòng ${String(lineNo)}`,
    uomLabel: (lineNo: number): string => `Đơn vị của dòng ${String(lineNo)}`,
    adjustmentQtyLabel: (lineNo: number): string =>
      `Số lượng chênh lệch của dòng ${String(lineNo)}`,
    inherited: 'Kế thừa kiểm kê',
    excluded: 'Loại trừ',
    countReason: (code: string): string => `Lý do kiểm kê ${code}`,
    qtyWithUom: (qty: string, uom: string): string => `${qty} ${uom}`,
  },
  historyFields: {
    period: 'Ngày ghi sổ',
    periodFrom: 'Từ ngày ghi sổ',
    periodTo: 'Đến ngày ghi sổ',
    count: 'Kiểm kê liên quan',
    reason: 'Lý do điều chỉnh',
  },
  historyFilters: {
    all: 'Tất cả',
    chipPeriodBoth: (from: string, to: string): string => `Ngày ghi sổ ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `Ngày ghi sổ từ ${from}`,
    chipPeriodTo: (to: string): string => `Ngày ghi sổ đến ${to}`,
    chipCount: (countName: string): string => `Kiểm kê liên quan ${countName}`,
    chipRemoveCount: 'Gỡ điều kiện kiểm kê liên quan',
    chipReason: (code: string): string => `Lý do điều chỉnh ${code}`,
    chipRemoveReason: 'Gỡ điều kiện lý do điều chỉnh',
  },
  historyTable: {
    inventoryAdjustmentNo: 'Số phiếu điều chỉnh',
    countRef: 'Kiểm kê liên quan',
    reason: 'Lý do điều chỉnh',
    status: 'Trạng thái',
    adjustedAt: 'Ngày ghi sổ',
    select: 'Chọn',
    notPosted: 'Chưa ghi sổ',
  },
  historySummary: {
    label: 'Tóm tắt phiếu điều chỉnh',
    inventoryAdjustmentNo: 'Số phiếu điều chỉnh',
    countRef: 'Kiểm kê liên quan',
    reason: 'Lý do điều chỉnh',
    status: 'Trạng thái',
    adjustedAt: 'Ngày ghi sổ',
    erp: 'Gửi ERP',
    lines: 'Dòng điều chỉnh',
    lineCount: (lineCount: number): string => `${String(lineCount)} dòng`,
  },
  historyLineTable: {
    lineNo: 'Dòng',
    itemCode: 'Mã mặt hàng',
    itemName: 'Tên mặt hàng',
    lot: 'LOT vật tư',
    bookQty: 'Sổ sách',
    actualQty: 'Thực tế',
    adjustmentQty: 'Chênh lệch',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (from: number, to: number, total: number): string =>
      `${String(from)}–${String(to)} / Tổng ${String(total)} phiếu`,
    totalOnly: (total: number): string => `Tổng ${String(total)} phiếu`,
  },
  bookQty: {
    loading: 'Đang xác nhận sổ sách',
    failed: 'Không xác nhận được sổ sách',
  },
  actions: {
    addLine: 'Thêm dòng',
    removeLine: (lineNo: number): string => `Xóa dòng ${String(lineNo)}`,
    loadVariance: 'Tải chênh lệch kiểm kê',
    register: 'Đăng ký điều chỉnh',
    discard: 'Bỏ bản nháp',
    requestApproval: 'Trình điều chỉnh',
    togglePost: 'Ghi sổ không qua phê duyệt',
    post: 'Ghi sổ tồn kho',
    keepEditing: 'Nhập tiếp',
    keepReviewing: 'Xem lại',
    confirmRegister: 'Đăng ký',
    confirmSubmit: 'Trình phê duyệt',
    confirmPost: 'Làm chuyển động tồn kho',
    confirmDiscard: 'Bỏ bản nháp',
    prevPage: 'Trang trước',
    nextPage: 'Trang sau',
    goFirstPage: 'Về trang đầu',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    selectAdjustmentRow: (adjustmentNo: string): string => `Chọn ${adjustmentNo}`,
    deselectAdjustmentRow: (adjustmentNo: string): string => `Bỏ chọn ${adjustmentNo}`,
  },
  actionReasons: {
    loadVarianceNeedsCount:
      'Tải chênh lệch kiểm kê chỉ thực hiện được sau khi chọn kiểm kê liên quan.',
    loadVarianceLoading:
      'Tải chênh lệch kiểm kê chỉ làm lại được sau khi lần tra cứu trước kết thúc.',
    addLineNeedsWarehouse: 'Thêm dòng chỉ thực hiện được sau khi chọn kho liên quan.',
    addLineCountSource:
      'Thêm dòng không thực hiện được khi nguồn điều chỉnh là chênh lệch kiểm kê.',
    saving: 'Đang gửi. Có phản hồi thì sẽ mở lại.',
    alreadyRegistered: 'Đã đăng ký rồi. Muốn dựng điều chỉnh khác thì hãy mở lại màn hình.',
    registerVarianceTruncated:
      'Không đăng ký điều chỉnh được vì chưa tải đủ chênh lệch của kiểm kê này.',
    registerNeedsReason: 'Đăng ký điều chỉnh chỉ thực hiện được sau khi chọn lý do điều chỉnh.',
    registerNeedsLines: 'Đăng ký điều chỉnh cần có ít nhất một dòng đối tượng điều chỉnh.',
    registerLineInvalid: 'Đăng ký điều chỉnh chỉ thực hiện được sau khi sửa các lỗi gắn trên bảng.',
    registerAllExcluded:
      'Đăng ký điều chỉnh cần có ít nhất một dòng có chênh lệch khác 0. Hiện mọi dòng đều bị loại khỏi đăng ký.',
    discardNothing: 'Bỏ bản nháp cần có giá trị để bỏ.',
    submitReasonRequired: 'Trình điều chỉnh chỉ thực hiện được sau khi ghi lý do.',
    submitting: 'Đang trình phê duyệt. Có phản hồi thì sẽ mở lại.',
    submitWhilePosting: 'Trình điều chỉnh chỉ thực hiện được sau khi có phản hồi của việc ghi sổ.',
    submitAfterPosted: 'Trình điều chỉnh không thực hiện được với phiếu đã ghi sổ.',
    posting: 'Đang ghi sổ. Có phản hồi thì sẽ mở lại.',
    postWhileSubmitting: 'Ghi sổ tồn kho chỉ thực hiện được sau khi có phản hồi của việc trình.',
    postDraftInvalid:
      'Ghi sổ tồn kho chỉ thực hiện được sau khi có đủ ngày làm việc và thời điểm phát sinh.',
  },
  errors: {
    adjustmentQtyRequired: 'Hãy nhập số lượng chênh lệch.',
    adjustmentQtyNotNumber: 'Hãy nhập số lượng chênh lệch bằng chữ số.',
    locationRequired: 'Hãy chọn vị trí.',
    itemRequired: 'Hãy chọn mặt hàng.',
    uomRequired: 'Hãy chọn đơn vị.',
    businessDateRequired: 'Hãy nhập ngày làm việc.',
    businessDateFormat: 'Hãy nhập ngày làm việc theo dạng 2026-08-18.',
    occurredAtRequired: 'Hãy nhập thời điểm phát sinh.',
    occurredAtFormat: 'Hãy nhập thời điểm phát sinh theo dạng 2026-08-18 14:05.',
  },
  notes: {
    excludedZero: (lineCount: number): string =>
      `${String(lineCount)} dòng có chênh lệch bằng 0 sẽ bị loại khỏi đăng ký.`,
    networkUnconfirmed:
      'Không nhận được phản hồi nên không biết phiếu điều chỉnh đã được tạo hay chưa. Đừng đăng ký lại ngay cùng nội dung — hãy vào tab 「Lịch sử xử lý」, lọc theo lý do điều chỉnh để kiểm tra trước xem phiếu đó đã được tạo chưa.',
    unconfirmedRegisterNote:
      'Một lần đăng ký đã gửi trước đó không nhận được phản hồi nên không biết phiếu đã được tạo hay chưa. Hãy kiểm tra ở tab 「Lịch sử xử lý」.',
  },
  values: {
    empty: '—',
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Tải tên thất bại',
    inactiveSuffix: ' (không dùng)',
    unknownRequester: 'Không có tên người trình',
    unknownApprover: 'Không có tên người phê duyệt',
  },
  lookups: {
    truncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    failed: 'Không tải được danh sách chọn.',
  },
  loading: {
    varianceLines: 'Đang tải chênh lệch kiểm kê',
    approvalRequest: 'Đang tải tiến trình phê duyệt',
    adjustments: 'Đang tải lịch sử xử lý',
    adjustmentDetail: 'Đang tải phiếu điều chỉnh',
  },
  empty: {
    noLinesTitle: 'Chưa có đối tượng điều chỉnh nào',
    historyNoResultTitle: 'Không có phiếu điều chỉnh nào khớp điều kiện',
    historyBeyondLastTitle: 'Trang này không có kết quả',
    historyNoSelectionTitle: 'Chọn một phiếu điều chỉnh để xem các dòng',
    historyNotFoundTitle: 'Không tìm thấy phiếu điều chỉnh đã chọn',
    historyNotFoundDescription: 'Phiếu đã bị xóa hoặc bạn không có quyền xem.',
  },
  reasons: {
    lineReferencesFailed:
      'Không tải được tên vị trí, mặt hàng, đơn vị và LOT vật tư. Lý do sẽ hiện ở chỗ của tên.',
    warehousesFailed:
      'Không tải được tên kho. Không chọn được kho thì cũng không xác nhận được vị trí và sổ sách.',
    balancesFailed: 'Không tải được số lượng sổ sách. Lý do sẽ hiện ở chỗ của sổ sách.',
    historyReferencesFailed:
      'Không tải được tên mặt hàng, đơn vị và LOT vật tư. Lý do sẽ hiện ở chỗ của tên.',
  },
  dialog: {
    registerTitle: 'Đăng ký điều chỉnh này chứ?',
    registerLead: 'Phiếu điều chỉnh sẽ được tạo với nội dung dưới đây.',
    reasonCode: 'Lý do điều chỉnh',
    sendToErp: 'Gửi ERP',
    sendToErpOn: 'Có gửi',
    sendToErpOff: 'Không gửi',
    countRef: 'Kiểm kê liên quan',
    includedLineCount: (lineCount: number): string =>
      `Gửi kèm ${String(lineCount)} dòng điều chỉnh.`,
    excludedLineCount: (lineCount: number): string =>
      `${String(lineCount)} dòng có chênh lệch bằng 0 sẽ bị loại khỏi đăng ký.`,
    noExcludedLine: 'Không có dòng nào bị loại.',
    registerNoUndo: 'Phiếu điều chỉnh đã tạo thì màn hình này không hoàn tác được.',
    discardTitle: 'Bỏ các đối tượng điều chỉnh đã dựng chứ?',
    discardLead:
      'Các dòng trên bảng và lý do điều chỉnh đã chọn sẽ mất. Chênh lệch kiểm kê thì tải lại được.',
    discardWhileSaving:
      'Cửa sổ này không hoàn tác lần đăng ký đang gửi. Nếu máy chủ nhận thì phiếu điều chỉnh vẫn được tạo.',
    submitTitle: 'Trình phê duyệt với lý do này chứ?',
    submitLead: 'Yêu cầu phê duyệt phiếu điều chỉnh này với lý do dưới đây.',
    reasonFull: 'Toàn văn lý do',
    reasonFirstLine: 'Dòng đầu sẽ hiện làm tóm tắt trong hộp phê duyệt',
    submitNoUndo:
      'Sau khi trình phê duyệt thì màn hình này không hoàn tác được. Việc hủy làm ở hộp phê duyệt.',
    postTitle: 'Ghi sổ điều chỉnh này chứ?',
    postLead:
      'Tồn kho sẽ chuyển động theo các giá trị dưới đây. Muốn hoàn nguyên thì phải dựng một điều chỉnh ngược chiều mới.',
    postDatesApart:
      'Ngày của ngày làm việc và thời điểm phát sinh khác nhau. Nếu là điều chỉnh làm qua nửa đêm thì bình thường, nếu không thì hãy đóng lại và sửa.',
  },
  result: {
    label: 'Kết quả đăng ký',
    createdTitle: (adjustmentNo: string): string => `Đã tạo phiếu điều chỉnh ${adjustmentNo}.`,
    inventoryAdjustmentNo: 'Số phiếu điều chỉnh',
    statusCode: 'Trạng thái tại thời điểm đăng ký',
    lineCount: (lineCount: number): string =>
      `Máy chủ đã lưu ${String(lineCount)} dòng điều chỉnh.`,
    erp: 'Gửi ERP',
    erpQueued: 'Đã vào hàng đợi gửi',
    erpNotQueued: 'Chưa vào hàng đợi gửi',
    erpUnknown: 'Không xác định',
    unboundCreatedNote: (adjustmentNos: string): string =>
      `Lần đăng ký đã gửi trước đó đã kết thúc và phiếu điều chỉnh được tạo — ${adjustmentNos}. Việc đó tách biệt với bản nháp đang dựng, và tìm lại được ở tab 「Lịch sử xử lý」.`,
    submitting: 'Đang trình phê duyệt.',
    submittedTitle: (adjustmentNo: string): string =>
      `Đã trình phê duyệt phiếu điều chỉnh ${adjustmentNo}.`,
    submitFailedTitle: (adjustmentNo: string): string =>
      `Phiếu điều chỉnh ${adjustmentNo} đã được tạo nhưng chưa trình phê duyệt.`,
    submitFailedDescription:
      'Đừng tạo lại phiếu. Bạn có thể sửa lý do rồi trình lại — đăng ký lại thì sẽ còn lại hai phiếu điều chỉnh.',
    unboundSubmittedNote: (adjustmentNos: string): string =>
      `Lần trình đã gửi trước đó đã kết thúc và phiếu điều chỉnh đã lên phê duyệt — ${adjustmentNos}. Việc đó tách biệt với thứ đang xem, và tìm lại được ở tab 「Lịch sử xử lý」.`,
  },
  post: {
    label: 'Ghi sổ',
    businessDate: 'Ngày làm việc',
    occurredAt: 'Thời điểm phát sinh',
    posting: 'Đang ghi sổ.',
    postedTitle: (adjustmentNo: string): string => `Đã ghi sổ phiếu điều chỉnh ${adjustmentNo}.`,
    postedDescription:
      'Tồn kho đã chuyển động. Muốn hoàn nguyên thì phải dựng một điều chỉnh ngược chiều mới.',
    adjustedAt: 'Thời điểm ghi sổ',
    adjustedAtUnknown: 'Máy chủ không gửi về thời điểm ghi sổ',
    statusAfterPost: 'Trạng thái sau khi ghi sổ',
    failedTitle: (adjustmentNo: string): string =>
      `Phiếu điều chỉnh ${adjustmentNo} vẫn còn, chỉ việc ghi sổ thất bại.`,
    failedDescription:
      'Tồn kho chưa chuyển động. Đừng tạo lại phiếu — sửa nguyên nhân rồi ghi sổ lại được.',
    networkUnconfirmed:
      'Không nhận được phản hồi nên không biết tồn kho đã chuyển động hay chưa. Đừng ghi sổ lại ngay cùng một phiếu — hãy vào tab 「Lịch sử xử lý」 kiểm tra ngày ghi sổ của phiếu đó trước.',
    unboundPostedNote: (adjustmentNos: string): string =>
      `Lần ghi sổ đã gửi trước đó đã kết thúc và tồn kho đã chuyển động — ${adjustmentNos}. Việc đó tách biệt với thứ đang xem, và tìm lại được ở tab 「Lịch sử xử lý」.`,
  },
  progress: {
    label: 'Tiến trình phê duyệt',
    position: (current: number, total: number): string =>
      `Bước ${String(current)} / ${String(total)}`,
    finished: (total: number): string => `Đã kết thúc phê duyệt · tổng ${String(total)} bước`,
    noSteps: 'Chưa có bước phê duyệt nào.',
    waitingCurrent: 'Đang chờ phê duyệt',
    waitingPending: 'Đang chờ bước trước kết thúc',
    requestNo: 'Số yêu cầu phê duyệt',
    approvalType: 'Loại phê duyệt',
    status: 'Trạng thái',
    requester: 'Người trình',
    requestedAt: 'Ngày trình',
    reason: 'Lý do trình',
    reasonPane: 'Toàn văn lý do trình',
    emptyReason: 'Lý do đang để trống.',
    unusableTitle: 'Không xem được tiến trình phê duyệt',
    unusableDescription:
      'Giá trị yêu cầu phê duyệt kèm theo phản hồi trình không phải là giá trị tra cứu được. Hãy xem ở hộp phê duyệt hoặc báo người phụ trách.',
    loadFailedTitle: 'Không tải được tiến trình phê duyệt',
    forbiddenTitle: 'Bạn không có quyền xem tiến trình phê duyệt của yêu cầu này',
    forbiddenDescription:
      'Không phải người phê duyệt cũng không phải người trình thì tiến trình phê duyệt không mở. Hãy xác nhận với người phụ trách.',
    notFoundTitle: 'Không tìm thấy tiến trình phê duyệt',
    notFoundDescription: 'Yêu cầu phê duyệt đã bị xóa hoặc không nối với phiếu này.',
    loadFailedNote:
      'Dù không đọc được tiến trình phê duyệt thì việc trình vẫn đã được tiếp nhận. Xem được ở hộp phê duyệt.',
    approvedNote: 'Đã được phê duyệt. Tồn kho chưa chuyển động — ghi sổ là thao tác riêng.',
  },
};
