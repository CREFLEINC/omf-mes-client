import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-13 물류 문서 진행현황·취소. 취소 불가 사유는 계약이 열거한 값만 문면을 갖고,
 * 그 밖의 코드는 그대로 낸다. 취소 요청은 승인을 타고, 실행은 사람이 다시 누른다.
 */
export const documentProgress: Translated<typeof ko.documentProgress> = {
  title: 'Tiến độ · hủy chứng từ logistics',
  breadcrumbRoot: 'Kho vật tư',
  panes: {
    detail: 'Chứng từ đã chọn',
  },
  fields: {
    documentType: 'Loại chứng từ',
    status: 'Trạng thái',
    period: 'Ngày chứng từ',
    item: 'Số mặt hàng',
    lot: 'Số LOT vật tư',
    warehouse: 'Số kho',
    cancellableOnly: 'Chỉ phiếu hiện hủy được',
    q: 'Số chứng từ',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    selectRow: (documentNo: string): string => `Chọn ${documentNo}`,
    deselectRow: (documentNo: string): string => `Bỏ chọn ${documentNo}`,
    openDocument: 'Mở chứng từ',
    openSuccessor: (successorNo: string): string => `Mở ${successorNo}`,
  },
  filters: {
    all: 'Tất cả',
    idNote:
      'Mặt hàng, LOT vật tư và kho được thu hẹp bằng số. Giá trị không phải số sẽ bị bỏ khỏi điều kiện.',
    periodNote: 'Không chọn ngày chứng từ thì tra cứu mà không thu hẹp khoảng thời gian.',
    disabledTypes: (reasons: string): string => `Có loại không chọn được. ${reasons}`,
  },
  loading: {
    list: 'Đang tải tiến độ chứng từ',
    detail: 'Đang tải chi tiết chứng từ đã chọn',
    approval: 'Đang tải tiến trình phê duyệt của yêu cầu hủy',
  },
  table: {
    documentNo: 'Số chứng từ',
    documentDate: 'Ngày chứng từ',
    subType: 'Phân loại chi tiết',
    status: 'Trạng thái',
    plannedQty: 'Số lượng kế hoạch',
    processedQty: 'Số lượng đã xử lý',
    remainingQty: 'Số lượng còn lại',
    successorCount: 'Kế tiếp',
    cancelAvailability: 'Hủy được',
    select: 'Chọn',
  },
  cancel: {
    available: 'Yêu cầu hủy được',
    blocked: 'Không hủy được',
  },
  blockReasons: {
    SUCCESSOR_EXISTS: 'Có chứng từ kế tiếp',
    ALREADY_CANCELLED: 'Chứng từ đã bị hủy',
    CANCEL_IN_PROGRESS: 'Yêu cầu hủy đang được xử lý',
    STATE_LOCKED: 'Ở trạng thái hiện tại thì không hủy được',
    TYPE_NOT_CANCELABLE: 'Loại chứng từ này không hủy được',
  },
  detail: {
    summary: (documentNo: string): string => `Tóm tắt ${documentNo}`,
    documentType: 'Loại chứng từ',
    documentNo: 'Số chứng từ',
    documentDate: 'Ngày chứng từ',
    subType: 'Phân loại chi tiết',
    status: 'Trạng thái',
    plannedQty: 'Số lượng kế hoạch',
    processedQty: 'Số lượng đã xử lý',
    remainingQty: 'Số lượng còn lại',
    summaryNote:
      'Tóm tắt là kết quả tra cứu chi tiết của chứng từ này. Thời điểm tra cứu có thể khác với danh sách ở trên.',
    openBlocked: {
      noScreenId:
        'Chưa nhận được thông tin chứng từ này mở ở màn hình nào nên không mở được tại đây.',
      unmapped: 'Màn hình mở chứng từ này chưa có trong chương trình nên không mở được tại đây.',
    },
  },
  steps: {
    caption: 'Diễn tiến xử lý',
    stepCode: 'Bước',
    occurredAt: 'Thời điểm',
    actor: 'Người xử lý',
    ledger: 'Sổ cái',
    systemActor: 'Bước không do người làm',
    emptyTitle: 'Không có diễn tiến xử lý',
    emptyDescription: 'Chứng từ này chưa có diễn tiến xử lý nào được ghi.',
    ledgerNote:
      'Số sổ cái được hiện kèm ngày làm việc cần cho việc tra cứu. Màn hình tra cứu sổ cái chưa có nên không mở được tại đây.',
  },
  ledger: {
    pair: (transactionNo: string, businessDate: string): string =>
      `${transactionNo} · ngày làm việc ${businessDate}`,
    noBusinessDate: (transactionNo: string): string =>
      `${transactionNo} · không nhận được ngày làm việc nên không tìm được sổ cái`,
    noTransactionNo: (businessDate: string): string =>
      `Ngày làm việc ${businessDate} · không nhận được số sổ cái`,
  },
  successors: {
    caption: 'Chứng từ kế tiếp',
    typeCode: 'Loại',
    documentNo: 'Số chứng từ',
    qty: 'Số lượng',
    open: 'Mở',
    emptyTitle: 'Không có chứng từ kế tiếp',
    emptyDescription: 'Chưa có chứng từ hạ nguồn nào lấy chứng từ này làm gốc.',
    openBlocked: {
      noScreenId:
        'Có chứng từ kế tiếp chưa nhận được thông tin mở ở màn hình nào nên dòng đó không mở được.',
      unmapped:
        'Có chứng từ kế tiếp mà màn hình mở nó chưa có trong chương trình nên dòng đó không mở được.',
    },
  },
  empty: {
    typesPendingTitle: 'Danh sách chọn loại chứng từ đang được chuẩn bị',
    typesPendingDescription:
      'Khi danh sách loại chứng từ được chốt thì tra cứu tiến độ được ở màn hình này. Hiện chưa tra cứu được.',
    noDocumentTypeTitle: 'Hãy chọn loại chứng từ rồi tra cứu',
    noDocumentTypeDescription: 'Tiến độ chỉ tra cứu được khi đã xác định loại chứng từ.',
    noResultTitle: 'Không có chứng từ nào khớp điều kiện',
    noResultDescription: 'Hãy nới rộng khoảng thời gian hoặc bớt điều kiện rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noSelectionTitle: 'Chọn một chứng từ để xem chi tiết ở dưới',
    noSelectionDescription:
      'Chọn chứng từ ở danh sách thì diễn tiến xử lý và danh sách kế tiếp sẽ hiện ở chỗ này.',
    detailNotFoundTitle: 'Không tìm thấy chứng từ đã chọn',
    detailNotFoundDescription:
      'Chứng từ có thể đã bị xóa hoặc chuyển sang điều kiện khác. Hãy tra cứu lại rồi chọn.',
  },
  errors: {
    unsupportedTitle: 'Loại chứng từ này không thuộc phạm vi màn hình',
    unsupportedDescription:
      'Loại chứng từ đã chọn không xem được ở màn hình này. Hãy chọn loại khác hoặc hỏi người phụ trách.',
  },
  notes: {
    lock: {
      request:
        'Cho đến khi yêu cầu hủy đang gửi kết thúc thì không tra cứu lại hay chuyển sang chứng từ khác được.',
      execute:
        'Cho đến khi việc thực hiện hủy đang gửi kết thúc thì không tra cứu lại hay chuyển sang chứng từ khác được.',
    },
  },
  cancelRequest: {
    label: 'Yêu cầu hủy',
    lead: 'Trình việc hủy chứng từ này lên phê duyệt. Phê duyệt xong thì bấm lại để thực hiện hủy.',
    reason: 'Lý do hủy',
    reasonPlaceholder: 'Hãy ghi vì sao hủy',
    reasonHelper:
      'Chứng từ không có chỗ chứa lý do hủy nên lý do này trở thành lịch sử hủy. Chọn chứng từ khác thì lý do đang ghi sẽ không được giữ.',
    reasonRequired: 'Phải ghi lý do hủy mới trình được yêu cầu.',
    unsupportedTitle: 'Loại này không hủy được tại đây',
    unsupportedDescription:
      'Khi các loại chứng từ hủy được đã xác định thì yêu cầu hủy sẽ hiện ở chỗ này. Hiện chưa trình được.',
    preparing: 'Đang chuẩn bị yêu cầu hủy',
    lockForbiddenTitle: 'Bạn không có quyền chuẩn bị hủy chứng từ này',
    lockForbiddenDescription: 'Hãy hỏi người phụ trách. Tiến độ thì vẫn xem được như thường.',
    lockNotFoundTitle: 'Không tìm thấy chứng từ cần hủy',
    lockNotFoundDescription:
      'Chứng từ có thể đã bị xóa hoặc đường hủy khác đi. Hãy thử lại hoặc hỏi người phụ trách.',
    lockFailedTitle: 'Không chuẩn bị được yêu cầu hủy',
    lockFailedNote: 'Tiến độ và danh sách kế tiếp thì vẫn xem được như thường.',
    blocked: (reason: string): string => `Hiện chưa trình được yêu cầu hủy. ${reason}`,
    successorBlocked:
      'Có chứng từ kế tiếp nên không trình được yêu cầu hủy. Danh sách kế tiếp ở dưới đã được tải lại — phải hủy chứng từ kế tiếp trước.',
    submitted: 'Đã trình yêu cầu hủy. Phê duyệt xong thì thực hiện hủy được.',
  },
  cancelDialog: {
    title: 'Trình yêu cầu hủy chứ?',
    target: (documentNo: string): string => `Trình việc hủy ${documentNo} lên phê duyệt.`,
    approval:
      'Việc hủy nhất định phải qua phê duyệt. Bây giờ chưa hủy, chỉ một yêu cầu phê duyệt được tạo.',
    noWithdraw:
      '⚠ Yêu cầu đã trình thì không rút lại được. Nếu trình nhầm thì người phê duyệt phải trả lại.',
    confirm: 'Trình yêu cầu hủy',
    keepEditing: 'Quay lại',
  },
  approval: {
    label: 'Tiến trình phê duyệt',
    notSubmittedTitle: 'Chưa có yêu cầu hủy nào',
    notSubmittedDescription:
      'Chứng từ này không có yêu cầu hủy nào đang xử lý. Trình yêu cầu hủy ở trên thì tiến trình phê duyệt sẽ hiện ở đây.',
    unusableTitle: 'Không xem được tiến trình phê duyệt',
    unusableDescription:
      'Giá trị yêu cầu phê duyệt kèm theo chứng từ này không phải là giá trị tra cứu được. Hãy xác nhận với người phụ trách.',
    requestNo: 'Số yêu cầu phê duyệt',
    approvalType: 'Loại phê duyệt',
    status: 'Trạng thái',
    requester: 'Người yêu cầu',
    requestedAt: 'Ngày yêu cầu',
    reason: 'Lý do hủy',
    reasonPane: 'Toàn văn lý do hủy',
    position: (current: number, total: number): string =>
      `Bước ${String(current)} / ${String(total)}`,
    finished: (total: number): string => `Đã kết thúc phê duyệt · tổng ${String(total)} bước`,
    noSteps: 'Chưa có bước phê duyệt nào.',
    waitingCurrent: 'Đang chờ phê duyệt',
    waitingPending: 'Đang chờ bước trước kết thúc',
    forbiddenTitle: 'Bạn không có quyền xem tiến trình phê duyệt của yêu cầu hủy này',
    forbiddenDescription:
      'Không phải người phê duyệt cũng không phải người yêu cầu thì tiến trình phê duyệt không mở. Hãy xác nhận với người phụ trách.',
    notFoundTitle: 'Không tìm thấy tiến trình phê duyệt',
    notFoundDescription: 'Yêu cầu phê duyệt đã bị xóa hoặc không nối với chứng từ này.',
    loadFailedTitle: 'Không tải được tiến trình phê duyệt',
    loadFailedNote:
      'Dù không đọc được tiến trình phê duyệt thì vẫn thử thực hiện hủy ở dưới được như thường.',
    manualExecuteNote:
      'Phê duyệt xong thì chứng từ cũng không tự hủy. Phải bấm lại 「Thực hiện hủy」 ở dưới thì mới hoàn nguyên.',
    unjudgeableNote:
      'Màn hình không xét được là phê duyệt đã xong hay chưa. Hãy nhìn các bước và mã trạng thái ở trên để tự đánh giá.',
    approvedNote: 'Phê duyệt đã xong. Bạn có thể thực hiện hủy ở dưới.',
  },
  executeCancel: {
    label: 'Thực hiện hủy',
    lead: 'Thực sự thực hiện yêu cầu hủy đã được phê duyệt. Thực hiện rồi thì không hoàn tác được.',
    notRequestedNote: 'Trình yêu cầu hủy và phê duyệt xong thì thực hiện ở chỗ này.',
    preparing: 'Đang chuẩn bị thực hiện hủy',
    lockFailedNote:
      'Không chuẩn bị được việc hủy nên hiện chưa thực hiện được. Hãy chuẩn bị lại bằng 「Thử lại」 ở trên.',
    executed: 'Đã thực hiện hủy.',
  },
  executeDialog: {
    title: 'Thực hiện hủy chứ?',
    target: (documentNo: string): string => `Thực hiện hủy ${documentNo}.`,
    ledgerImpact:
      'Nếu chứng từ đã ghi sổ thì một giao dịch đảo sẽ phát sinh trên sổ cái. Nếu chưa ghi sổ thì chỉ trạng thái đổi và sổ cái không phát sinh gì.',
    irreversible:
      '⛔ Thực hiện rồi thì không hoàn tác được. Không có đường nào để hoàn lại việc hủy.',
    confirm: 'Thực hiện hủy',
    keepEditing: 'Quay lại',
  },
  executionResult: {
    label: 'Kết quả thực hiện hủy',
    status: 'Trạng thái chứng từ',
    reversedTitle: 'Một giao dịch đảo đã phát sinh trên sổ cái',
    ledger: 'Giao dịch đảo',
    notReversedTitle: 'Sổ cái không phát sinh gì',
    notReversedDescription: 'Là chứng từ chưa ghi sổ nên chỉ trạng thái thay đổi.',
  },
  blockedExecution: {
    title: 'Phê duyệt vẫn còn hiệu lực nhưng hiện chưa thực hiện được',
    description:
      'Trong lúc chờ phê duyệt đã phát sinh chứng từ kế tiếp lấy chứng từ này làm gốc. Phải hủy chứng từ kế tiếp trước thì mới hoàn nguyên được chứng từ này.',
    successorsLabel: 'Chứng từ kế tiếp đang vướng',
    successorLine: (successorNo: string, typeCode: string): string =>
      `${successorNo} · ${typeCode}`,
    successorsEmpty: 'Danh sách kế tiếp vừa tải lại thì chưa thấy. Hãy tra cứu lại sau ít phút.',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} chứng từ`,
    totalOnly: (total: number): string => `Tổng ${String(total)} chứng từ`,
  },
  values: {
    empty: '—',
    noBlockReason: 'Không nhận được lý do',
    unknownApprover: 'Không nhận được tên người phê duyệt',
    unknownRequester: 'Không nhận được tên người yêu cầu',
  },
};
