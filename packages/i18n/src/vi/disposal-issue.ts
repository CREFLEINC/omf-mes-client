import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-06 폐기 품의·기타출고. 코드 값을 지어내지 않고, 화면이 아는 것만 말한다.
 * 승인 요청 한 번에 요청 둘이 나가므로 중간 상태(전표만 생김)를 결과 구획이 정확히 말한다.
 */
export const disposalIssue: Translated<typeof ko.disposalIssue> = {
  title: 'Đề nghị hủy · xuất khác',
  breadcrumbRoot: 'Kho vật tư',
  panes: {
    list: 'Danh sách phiếu nhập kho có thể hủy',
    lines: 'Phiếu nhập kho đã chọn',
    historyList: 'Danh sách lịch sử xử lý',
    historyDetail: 'Yêu cầu hủy đã chọn',
  },
  tabs: {
    label: 'Yêu cầu hủy · lịch sử xử lý',
    disposal: 'Yêu cầu hủy',
    history: 'Lịch sử xử lý',
    note: 'Việc phê duyệt làm ở hộp phê duyệt. Màn hình này trình yêu cầu hủy và xử lý xuất khác cho yêu cầu đã được duyệt.',
  },
  fields: {
    warehouse: 'Kho',
    period: 'Ngày nhập kho',
    receiptType: 'Loại nhập kho',
    status: 'Trạng thái',
    q: 'Tìm số nhập kho',
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
    selectIssueRow: (goodsIssueNo: string): string => `Chọn ${goodsIssueNo}`,
    deselectIssueRow: (goodsIssueNo: string): string => `Bỏ chọn ${goodsIssueNo}`,
    submitDisposal: 'Yêu cầu phê duyệt',
    resubmit: 'Yêu cầu lại',
    postIssue: 'Xử lý xuất khác',
    confirmPost: 'Xử lý',
    keepReviewing: 'Xem lại',
    discardDrafts: 'Xóa nội dung đã nhập',
    keepEditing: 'Viết tiếp',
    confirmSubmit: 'Yêu cầu',
    confirmDiscard: 'Xóa',
    openIssue: 'Mở yêu cầu này',
  },
  errors: {
    qtyNotNumber: 'Hãy ghi số lượng hủy bằng chữ số.',
    qtyNotPositive: 'Số lượng hủy phải lớn hơn 0.',
    qtyOverOnHand: (onHandQty: number): string =>
      `Không hủy được nhiều hơn số lượng hiện có ${String(onHandQty)}.`,
    codeTooLong: (max: number): string => `Hãy ghi trong ${String(max)} ký tự.`,
    reasonRequired:
      'Hãy ghi lý do yêu cầu. Chỉ toàn khoảng trắng thì không yêu cầu phê duyệt được.',
  },
  filters: {
    all: 'Tất cả',
    periodNote: 'Để trống ngày nhập kho thì xem toàn bộ, không thu hẹp khoảng thời gian.',
    periodClearNote:
      'Ngày nhập kho chỉ xóa được bằng 「Đặt lại」. Các điều kiện khác thì gỡ bằng dấu × trên bảng điều kiện.',
    lookupFailed: 'Không tải được danh sách tên. Hãy thử lại.',
    lookupTruncated:
      'Danh sách tên chỉ về một phần. Giá trị cần tìm có thể không có trong danh sách — không phải là đã mất.',
    warehouseTypePending:
      'Màn hình không lọc được kho thuộc diện hủy nên hiện mọi kho. Hãy tự chọn kho đang chứa vật tư cần hủy.',
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
  historyFields: {
    period: 'Ngày xuất kho',
    issueType: 'Loại xuất kho',
    reason: 'Lý do hủy',
    status: 'Trạng thái',
    q: 'Tìm số xuất kho',
  },
  historyFilters: {
    periodNote: 'Để trống ngày xuất kho thì xem toàn bộ, không thu hẹp khoảng thời gian.',
    periodClearNote:
      'Ngày xuất kho chỉ xóa được bằng 「Đặt lại」. Các điều kiện khác thì gỡ bằng dấu × trên bảng điều kiện.',
    chipPeriodBoth: (from: string, to: string): string => `Ngày xuất kho: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `Ngày xuất kho: từ ${from}`,
    chipPeriodTo: (to: string): string => `Ngày xuất kho: đến ${to}`,
    chipIssueType: (code: string): string => `Loại xuất kho: ${code}`,
    chipReason: (code: string): string => `Lý do hủy: ${code}`,
    chipStatus: (code: string): string => `Trạng thái: ${code}`,
    chipQ: (q: string): string => `Từ khóa: ${q}`,
    chipRemoveIssueType: 'Gỡ điều kiện loại xuất kho',
    chipRemoveReason: 'Gỡ điều kiện lý do hủy',
    chipRemoveStatus: 'Gỡ điều kiện trạng thái',
    chipRemoveQ: 'Gỡ điều kiện từ khóa',
  },
  loading: {
    goodsReceipts: 'Đang tải danh sách phiếu nhập kho có thể hủy',
    detail: 'Đang tải phiếu nhập kho đã chọn',
    goodsIssues: 'Đang tải danh sách lịch sử xử lý',
    issueDetail: 'Đang tải yêu cầu hủy đã chọn',
    approvalRequest: 'Đang tải tiến trình phê duyệt',
  },
  empty: {
    noResultTitle: 'Không có phiếu nhập kho nào khớp điều kiện',
    noResultDescription: 'Hãy nới rộng khoảng thời gian hoặc gỡ bớt điều kiện rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Quay về trang trước thì xem được kết quả.',
    noSelectionTitle: 'Chưa chọn phiếu nhập kho nào',
    noSelectionDescription: 'Hãy chọn ở danh sách trên phiếu nhập kho có chứa vật tư cần hủy.',
    noLinesTitle: 'Phiếu nhập kho này không có dòng nào',
    noLinesDescription: 'Hãy chọn phiếu nhập kho khác hoặc hỏi người phụ trách.',
    notFoundTitle: 'Không tìm thấy phiếu nhập kho đã chọn',
    notFoundDescription: 'Phiếu đã bị xóa hoặc số trên địa chỉ bị sai. Hãy chọn lại từ danh sách.',
    historyNoResultTitle: 'Không có yêu cầu hủy nào khớp điều kiện',
    historyNoResultDescription:
      'Hãy nới rộng khoảng thời gian hoặc gỡ bớt điều kiện rồi tra cứu lại.',
    historyBeyondLastTitle: 'Trang này không có kết quả',
    historyBeyondLastDescription: 'Quay về trang trước thì xem được kết quả.',
    historyNoSelectionTitle: 'Chưa chọn yêu cầu hủy nào',
    historyNoSelectionDescription:
      'Hãy chọn ở danh sách trên yêu cầu hủy cần xem nội dung và tiến trình phê duyệt.',
    noIssueLinesTitle: 'Yêu cầu hủy này không có dòng nào',
    noIssueLinesDescription: 'Hãy chọn yêu cầu hủy khác hoặc hỏi người phụ trách.',
    issueNotFoundTitle: 'Không tìm thấy yêu cầu hủy đã chọn',
    issueNotFoundDescription:
      'Phiếu đã bị xóa hoặc số trên địa chỉ bị sai. Hãy chọn lại từ danh sách.',
  },
  reasons: {
    referencesFailed: 'Không tải được tên kho. Lý do sẽ hiện ở chỗ của tên.',
    lineReferencesFailed:
      'Không tải được tên mặt hàng, đơn vị, LOT vật tư và vị trí. Lý do sẽ hiện ở chỗ của tên.',
    lineReferencesTruncated:
      'Danh sách tên mặt hàng, đơn vị, LOT vật tư và vị trí chỉ về một phần. 「Không xác định」 ở chỗ của tên có thể không phải là giá trị sai mà là chưa có trong danh sách này.',
    lineMissingValues:
      'Dòng này thiếu các giá trị cần cho việc hủy (mặt hàng, LOT vật tư, đơn vị, vị trí).',
    lineQtyNotPositive: 'Số lượng nhập kho từ 0 trở xuống nên không có gì để hủy.',
    selectNone: 'Hãy chọn ít nhất một dòng để hủy.',
    selectQtyMissing: 'Hãy điền số lượng hủy cho các dòng đã chọn.',
    selectQtyInvalid: 'Có dòng bị lỗi ở số lượng hủy. Hãy sửa dòng đó trước.',
    balancesFailed:
      'Không tải được số lượng hiện có. Lý do sẽ hiện ở chỗ số lượng hiện có của dòng đó.',
    balancesTruncated:
      'Danh sách số lượng hiện có chỉ về một phần. Tổng có thể ít hơn thực tế nên không dùng làm hạn mức của dòng đó.',
    onHandUnknownNote:
      'Những dòng chưa xác nhận được số lượng hiện có thì màn hình không chặn bằng hạn mức. Sau khi gửi, máy chủ sẽ quyết định cuối cùng.',
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
    disposalQty: 'Số lượng hủy',
    receiptQtyPair: (receiptQty: number, uom: string): string => `${String(receiptQty)} ${uom}`,
    onHandQtyPair: (onHandQty: number, uom: string): string => `${String(onHandQty)} ${uom}`,
    selectLabel: (ordinal: number): string => `Chọn dòng thứ ${String(ordinal)}`,
    disposalQtyLabel: (ordinal: number): string => `Số lượng hủy của dòng thứ ${String(ordinal)}`,
  },
  selection: {
    none: 'Chưa chọn dòng nào.',
    summary: (count: number, totalQty: number, uom: string): string =>
      `Đã chọn ${String(count)} dòng · tổng số lượng hủy ${String(totalQty)} ${uom}`,
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
  formFields: {
    issueType: 'Loại xuất kho',
    sourceDocumentType: 'Loại chứng từ gốc',
    reason: 'Lý do hủy',
    issuedDate: 'Ngày xuất kho',
    issuedTime: 'Giờ xuất kho',
    businessDate: 'Ngày làm việc',
    remarks: 'Ghi chú',
    selfDisposal: 'Tự hủy (không có đơn vị bên ngoài)',
    disposalPartner: 'Đối tác hủy',
    destination: 'Nơi đến',
    submitReason: 'Lý do yêu cầu',
  },
  form: {
    label: 'Thông tin yêu cầu hủy',
    reasonPlaceholder: 'VD) Hủy phần bị đánh giá lỗi — 12 thùng không đạt kiểm tra đầu vào',
    reasonHelper:
      'Dòng đầu sẽ thành phần tóm tắt trong danh sách hộp phê duyệt. Hãy ghi ở dòng đầu là hủy cái gì, bao nhiêu và vì sao.',
    businessDateDerived:
      'Ngày làm việc được dựng từ ngày xuất kho và gửi kèm — không có ô ghi riêng.',
    selfDisposalChosen: 'Đã chọn tự hủy nên không chọn đối tác hủy.',
    partnerFailedPlaceholder: 'Không tải được danh sách chọn',
    partnerFailedNote: 'Không tải được danh sách chọn. Với tự hủy thì vẫn trình được.',
    partnerTruncatedNote:
      'Danh sách chọn chỉ về một phần đầu. Nếu không thấy đối tác cần tìm, hãy báo người phụ trách.',
    partnerEmptyNote: 'Không có đối tác hủy nào để chọn. Với tự hủy thì vẫn trình được.',
    partnerEmptyPlaceholder: 'Không có đối tác để chọn',
    destinationNote:
      'Nơi đến được gửi cùng phiếu khi yêu cầu phê duyệt — sau khi phê duyệt thì màn hình này không đổi được.',
    sendToErpNote:
      'Việc có gửi ERP hay không không do màn hình này quyết định — theo mặc định của máy chủ.',
    chainNote:
      'Bấm 「Yêu cầu phê duyệt」 thì phiếu yêu cầu hủy được tạo rồi trình lên phê duyệt. Lúc này tồn kho chưa chuyển động — nó chuyển động ở 「Xử lý xuất khác」 sau khi phê duyệt xong.',
  },
  actionReasons: {
    codeListPending:
      'Các giá trị mã cần cho yêu cầu hủy chưa được chốt nên chưa yêu cầu phê duyệt được. Phần xác nhận đối tượng thì hiện vẫn làm được.',
    needsCodes: 'Hãy chọn đủ các mã trong thông tin yêu cầu hủy.',
    needsIssuedDate: 'Hãy chọn ngày xuất kho.',
    needsIssuedTime: 'Hãy ghi giờ xuất kho.',
    needsDisposalDestination: 'Hãy chọn đối tác hủy hoặc đánh dấu tự hủy.',
    disposalPartnerPending:
      'Danh sách chọn đối tác hủy chưa được chuẩn bị. Đánh dấu tự hủy thì trình được.',
    disposalPartnerUnavailable:
      'Hiện không có đối tác hủy nào để chọn. Đánh dấu tự hủy thì trình được.',
    needsReason: 'Hãy ghi lý do yêu cầu.',
    nothingToDiscard: 'Không có nội dung nhập nào để xóa.',
    alreadySubmitted:
      'Đây là phiếu đã yêu cầu phê duyệt. Xem tiến trình phê duyệt ở dưới để biết đã đi đến đâu.',
    submissionUnknown:
      'Không xác nhận được đã yêu cầu phê duyệt hay chưa nên không mở phần yêu cầu lại. Hãy xác nhận với người phụ trách.',
    openIssueLocked: 'Trong lúc đang gửi thì không chuyển sang chỗ khác được. Xong sẽ mở.',
    postNeedsSubmission:
      'Đây là phiếu chưa yêu cầu phê duyệt. Yêu cầu phê duyệt ở trên thì việc phê duyệt bắt đầu, và phê duyệt xong mới xử lý được.',
    postNotApproved: 'Việc phê duyệt chưa xong. Phê duyệt xong thì xử lý được ở chỗ này.',
    postLocked: 'Trong lúc đang gửi thì không bấm lại được. Xong sẽ mở.',
  },
  dialog: {
    submitTitle: 'Trình yêu cầu hủy chứ?',
    submitLead: 'Phiếu yêu cầu hủy sẽ được tạo với nội dung dưới đây rồi trình lên phê duyệt.',
    resubmitTitle: 'Trình yêu cầu hủy này lên phê duyệt chứ?',
    resubmitLead: 'Trình lên phê duyệt phiếu yêu cầu hủy đã được tạo. Không tạo phiếu mới.',
    discardTitle: 'Xóa nội dung đã nhập chứ?',
    lineCount: (count: number): string => `${String(count)} dòng sẽ gửi`,
    mixedUom: 'Đơn vị lẫn lộn nên không tính tổng',
    linePair: (item: string, lot: string, qty: string): string => `${item} · ${lot} · ${qty}`,
    businessDateDerived: (businessDate: string): string =>
      `${businessDate} (dựng từ ngày xuất kho)`,
    reasonFull: 'Toàn văn lý do yêu cầu',
    reasonFirstLine: 'Dòng đầu sẽ hiện làm tóm tắt trong hộp phê duyệt',
    reasonSummaryNote: 'Dòng đầu sẽ thành phần tóm tắt trong danh sách hộp phê duyệt.',
    submitEffects:
      'Lúc này tồn kho chưa chuyển động. Sau khi phê duyệt thì chuyển động ở 「Xử lý xuất khác」.',
    submitNoUndo:
      'Yêu cầu phê duyệt không hoàn tác được. Bị trả lại thì trình lại được, nhưng khi đó là một yêu cầu mới.',
    submitOnHandUnknown:
      'Có lẫn dòng chưa xác nhận được số lượng hiện có. Số lượng do máy chủ quyết định cuối cùng.',
    postTitle: 'Xử lý thành xuất khác chứ?',
    postLead: 'Xử lý yêu cầu hủy dưới đây thành xuất kho thực tế.',
    postDeducts: 'Bấm xác nhận thì tồn kho bị trừ đúng bằng số lượng của phiếu này.',
    postNoUndo:
      'Màn hình này không có cách hoàn tác. Muốn hoàn nguyên thì cần hủy phiếu xuất kho, và việc đó lại phải qua phê duyệt.',
    postJudgePending:
      'Màn hình chưa xét được là đã phê duyệt hay chưa. Nếu chưa phê duyệt thì máy chủ sẽ từ chối xử lý.',
    postProgressUnread: 'Xử lý mà chưa xác nhận được tiến trình phê duyệt.',
    postAlreadyPosted:
      'Phiếu này có dòng đã ghi sổ. Xử lý lại thì tồn kho có thể chuyển động thêm một lần nữa.',
    postReasonFirstLine: 'Dòng đầu của lý do yêu cầu',
  },
  result: {
    label: 'Kết quả yêu cầu',
    createdTitle: (goodsIssueNo: string): string => `Đã tạo phiếu yêu cầu hủy ${goodsIssueNo}`,
    submittedTitle: (goodsIssueNo: string): string => `Đã trình ${goodsIssueNo} lên phê duyệt`,
    submittedDescription:
      'Việc phê duyệt đã bắt đầu. Phê duyệt xong thì trừ tồn kho bằng 「Xử lý xuất khác」.',
    submittedNoRequestNo:
      'Số yêu cầu phê duyệt xem được ở tiến trình phê duyệt trong tab 「Lịch sử xử lý」.',
    partialTitle: (goodsIssueNo: string): string =>
      `Phiếu ${goodsIssueNo} đã được tạo nhưng yêu cầu phê duyệt thất bại`,
    partialDescription:
      'Không cần tạo lại phiếu. Hãy bấm 「Mở yêu cầu này」 để yêu cầu tiếp ở tab 「Lịch sử xử lý」.',
    lineCount: (count: number): string => `${String(count)} dòng đã ghi trên phiếu`,
    linePair: (item: string, lot: string, qty: string): string => `${item} · ${lot} · ${qty}`,
    statusCode: 'Trạng thái',
    createdStatusCode: 'Trạng thái lúc tạo',
    notSubmittedYet: 'Chưa yêu cầu phê duyệt.',
    submitting: 'Đang trình phê duyệt.',
    postLabel: 'Kết quả xử lý',
    postedTitle: (goodsIssueNo: string): string => `Đã xử lý ${goodsIssueNo} thành xuất khác`,
    postedDescription:
      'Máy chủ đã tiếp nhận việc ghi sổ. Các giá trị dưới đây là do máy chủ trả về, còn các dòng của phiếu thì do lần tải chi tiết lại điền vào.',
    postedNoLines: 'Phản hồi ghi sổ không kèm dòng nào. Hãy xem dấu ghi sổ trên bảng dòng ở trên.',
  },
  resubmit: {
    label: 'Yêu cầu phê duyệt lại',
    lead: 'Yêu cầu hủy này chưa được trình lên phê duyệt. Hãy ghi lý do rồi trình lên phê duyệt.',
    submittedLead: 'Yêu cầu hủy này đã được trình lên phê duyệt rồi.',
  },
  post: {
    label: 'Xử lý xuất khác',
    lead: 'Đây là nơi xử lý yêu cầu hủy đã được phê duyệt thành xuất kho thực tế.',
    destinationLabel: 'Nơi đến',
    effectsLabel: 'Những việc xảy ra khi xử lý',
    effectDeducts: 'Thao tác này trừ tồn kho.',
    effectApprovalIsNotPosting:
      'Phê duyệt không trừ tồn kho — sau khi phê duyệt vẫn phải bấm nút này thì việc xuất kho mới xảy ra.',
    effectNoUndoHere:
      'Muốn hoàn nguyên thì cần hủy phiếu xuất kho và việc hủy lại phải qua phê duyệt — màn hình này không có cách đó.',
    unjudgeableNote:
      'Màn hình không xét được là phê duyệt đã xong hay chưa nên không khóa nút này. Nếu chưa phê duyệt thì máy chủ sẽ từ chối xử lý.',
  },
  notes: {
    disposalQtyEmptyStart:
      'Số lượng hủy bắt đầu bằng ô trống. Hãy tự ghi lượng cần hủy cho từng dòng.',
    submitRecheck:
      'Không xác nhận được đã gửi đến nơi hay chưa. Hãy kiểm tra ở tab 「Lịch sử xử lý」 xem phiếu đã được tạo chưa rồi mới thử lại.',
    reloadFailed:
      'Không tải được trạng thái mới nhất. Hãy thử lại sau ít phút hoặc yêu cầu tiếp ở tab 「Lịch sử xử lý」.',
    postRecheck:
      'Không xác nhận được đã gửi đến nơi hay chưa. Hãy tra cứu lại để kiểm tra các dòng của phiếu này đã ghi sổ chưa rồi mới thử lại.',
    lotHold:
      'LOT vật tư có dấu 「Tạm giữ」 đang bị tạm giữ vì chất lượng. Màn hình này không gỡ được.',
  },
  values: {
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải',
    referenceFailed: 'Không tải được tên',
    onHandLoading: 'Đang tải',
    onHandUnknown: 'Chưa xác nhận được',
    lotHeld: 'Tạm giữ',
    inactiveSuffix: ' (không dùng)',
    empty: 'Không có',
    selfDisposal: 'Tự hủy',
    notSubmitted: 'Chưa yêu cầu',
    posted: 'Đã ghi sổ',
    notPosted: 'Chưa ghi sổ',
    erpQueued: 'Đã vào hàng đợi ERP',
    erpNotQueued: 'Chưa vào hàng đợi ERP',
    erpUnknown: 'Không nhận được thông tin đã vào hàng đợi ERP hay chưa',
    noReasonCode: 'Không có mã lý do',
    unknownRequester: 'Không xác nhận được tên người yêu cầu',
    unknownApprover: 'Không xác nhận được tên người phê duyệt',
    emptyReason: 'Lý do đang để trống',
  },
  historyTable: {
    goodsIssueNo: 'Số xuất kho',
    warehouse: 'Kho',
    reason: 'Lý do hủy',
    issuedAt: 'Thời điểm xuất kho',
    status: 'Trạng thái',
    select: 'Chọn',
  },
  issueLineTable: {
    item: 'Mặt hàng',
    lot: 'LOT vật tư',
    location: 'Vị trí',
    issueQty: 'Số lượng hủy',
    posted: 'Ghi sổ',
    issueQtyPair: (issueQty: number, uom: string): string => `${String(issueQty)} ${uom}`,
  },
  issueSummary: {
    label: 'Yêu cầu hủy đã chọn',
    goodsIssueNo: 'Số xuất kho',
    issueType: 'Loại xuất kho',
    reason: 'Lý do hủy',
    issuedAt: 'Thời điểm xuất kho',
    status: 'Trạng thái',
    warehouse: 'Kho',
    erp: 'Hàng đợi ERP',
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
    requester: 'Người yêu cầu',
    requestedAt: 'Ngày yêu cầu',
    reason: 'Lý do yêu cầu',
    reasonPane: 'Toàn văn lý do yêu cầu',
    notSubmittedTitle: 'Chưa yêu cầu phê duyệt',
    notSubmittedDescription:
      'Yêu cầu hủy này chưa được trình lên phê duyệt. Phải yêu cầu phê duyệt thì việc phê duyệt mới bắt đầu, và phê duyệt xong mới xử lý thành xuất khác được.',
    unusableTitle: 'Không xác nhận được đã yêu cầu phê duyệt hay chưa',
    unusableDescription:
      'Giá trị yêu cầu phê duyệt kèm theo phiếu này không phải là giá trị tra cứu được. Hãy xác nhận với người phụ trách.',
    loadFailedTitle: 'Không tải được tiến trình phê duyệt',
    forbiddenTitle: 'Bạn không có quyền xem tiến trình phê duyệt của yêu cầu này',
    forbiddenDescription:
      'Không phải người phê duyệt cũng không phải người yêu cầu thì tiến trình phê duyệt không mở. Hãy xác nhận với người phụ trách.',
    notFoundTitle: 'Không tìm thấy tiến trình phê duyệt',
    notFoundDescription: 'Yêu cầu phê duyệt đã bị xóa hoặc không nối với phiếu này.',
    loadFailedNote:
      'Dù không đọc được tiến trình phê duyệt thì những việc làm được với yêu cầu hủy này cũng không thay đổi.',
    postSeparateNote:
      'Phê duyệt không trừ tồn kho. Sau khi phê duyệt xong phải làm riêng 「Xử lý xuất khác」 thì việc xuất kho mới xảy ra.',
    unjudgeableNote:
      'Màn hình không xét được là phê duyệt đã xong hay chưa. Hãy nhìn các bước và mã trạng thái ở trên để tự đánh giá.',
    approvedNotPostedNote:
      'Đã được phê duyệt. Tồn kho chưa bị trừ — hãy tiến hành 「Xử lý xuất khác」.',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (from: number, to: number, total: number): string =>
      `${String(from)}–${String(to)} / Tổng ${String(total)} phiếu`,
    totalOnly: (total: number): string => `Tổng ${String(total)} phiếu`,
  },
};
