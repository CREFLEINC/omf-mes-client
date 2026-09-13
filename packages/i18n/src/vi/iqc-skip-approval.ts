import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-02 긴급 IQC 생략 한도승인. 결재함과 계약은 같아도 문구는 나눠 갖는다.
 * 《승인 시 결과》 세 문장이 「승인=입고」라는 오해를 하나씩 막는다.
 */
export const iqcSkipApproval: Translated<typeof ko.iqcSkipApproval> = {
  title: 'Phê duyệt hạn mức bỏ qua IQC khẩn',
  breadcrumbRoot: 'Kho vật tư',
  panes: {
    list: 'Danh sách yêu cầu phê duyệt',
    detail: 'Yêu cầu đã chọn',
    request: 'Thông tin yêu cầu',
    target: 'Đối tượng',
    progress: 'Tiến trình phê duyệt',
    reason: 'Toàn văn lý do',
    decision: 'Phê duyệt',
    approvalOutcome: 'Kết quả khi phê duyệt',
    decisionSubject: 'Đối tượng phê duyệt',
  },
  typePendingNote:
    'Mã loại phê duyệt chưa được chốt nên màn hình này hiện mọi yêu cầu mà tôi là người phê duyệt. Hãy xem cột loại và lý do để xác nhận có phải phiếu bỏ qua IQC khẩn không.',
  fields: {
    approvalRequestNo: 'Số yêu cầu',
    approvalTypeCode: 'Loại phê duyệt',
    target: 'Đối tượng',
    reason: 'Lý do',
    requestedByName: 'Người trình',
    requestedAt: 'Thời điểm trình',
    status: 'Trạng thái',
    period: 'Ngày trình',
    q: 'Tìm số yêu cầu',
    pendingOnly: 'Chỉ xem phiếu chờ phê duyệt',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    reload: 'Tra cứu lại',
    selectRow: (approvalRequestNo: string): string => `Chọn ${approvalRequestNo}`,
  },
  loading: {
    list: 'Đang tải danh sách yêu cầu phê duyệt',
    detail: 'Đang tải yêu cầu đã chọn',
  },
  target: {
    open: 'Mở',
    blockedNotOpenable: 'Mở: đối tượng này không có màn hình nào để mở',
    blockedNoScreenId: 'Mở: chưa xác định màn hình mở đối tượng này',
    blockedUnmapped: 'Mở: màn hình này chưa có trên web quản trị',
    note: 'Nội dung được xem ở màn hình gốc',
  },
  progress: {
    position: (current: number, total: number): string =>
      `Bước ${String(current)} / ${String(total)}`,
    finished: (total: number): string => `Đã kết thúc phê duyệt · tổng ${String(total)} bước`,
    myTurn: 'Bây giờ đến lượt bạn phê duyệt yêu cầu này',
    notMyTurn: 'Bây giờ chưa đến lượt bạn phê duyệt yêu cầu này',
    waitingCurrent: 'Bước đang chờ phê duyệt',
    waitingPending: 'Bước chưa phê duyệt',
    mine: 'Bước của tôi',
    noSteps: 'Không nhận được bước phê duyệt nào',
    limitRangeNote:
      'Khoảng hạn mức chưa được hiển thị trên màn hình. Hãy xem phạm vi phê duyệt theo các bước của luồng phê duyệt.',
  },
  filters: {
    all: 'Tất cả',
    chipStatus: (value: string): string => `Trạng thái: ${value}`,
    chipPeriod: (from: string, to: string): string => `Ngày trình: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `Ngày trình: từ ${from}`,
    chipPeriodTo: (to: string): string => `Ngày trình: đến ${to}`,
    chipKeyword: (value: string): string => `Số yêu cầu: ${value}`,
    chipRemoveStatus: 'Bỏ điều kiện trạng thái',
    chipRemovePeriod: 'Bỏ điều kiện ngày trình',
    chipRemoveKeyword: 'Bỏ điều kiện số yêu cầu',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} phiếu`,
    totalOnly: (total: number): string => `Tổng ${String(total)} phiếu`,
  },
  empty: {
    noResultTitle: 'Không có yêu cầu phê duyệt nào khớp điều kiện',
    noResultDescription: 'Hãy bớt điều kiện hoặc thử tắt 「Chỉ xem phiếu chờ phê duyệt」.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noSelectionTitle: 'Chọn một yêu cầu để xem nội dung chi tiết',
    noSelectionDescription: 'Hãy bấm vào số yêu cầu ở danh sách trên.',
    notFoundTitle: 'Không tìm thấy yêu cầu đã chọn',
    notFoundDescription: 'Yêu cầu đã được xử lý hoặc đã bị xóa. Hãy chọn lại từ danh sách.',
    forbiddenTitle: 'Bạn không có quyền xem yêu cầu này',
    forbiddenDescription:
      'Chỉ người phê duyệt hoặc người trình mới xem được. Hãy hỏi người phụ trách.',
  },
  decision: {
    outcome: {
      statusOnly:
        'Phê duyệt chỉ đổi yêu cầu này sang trạng thái đã duyệt. Việc bỏ qua kiểm tra không được thực hiện bằng lần duyệt này.',
      noErpDocument:
        'Dù có duyệt thì phiếu nhập kho và việc gửi ERP cũng không xảy ra. Việc đó làm ở màn hình 「Xử lý nhập hàng đạt」 và chỉ với hàng đạt.',
      inspectionPending:
        'Kiểm tra vẫn ở trạng thái chưa xong. Chuyển Lot Status và xử lý nhập kho làm riêng ở màn hình 「Xử lý nhập hàng đạt」.',
    },
    commentLabel: 'Ý kiến phê duyệt',
    commentHelp: 'Phê duyệt thì không cần ghi ý kiến, còn trả lại thì phải có ý kiến mới gửi được.',
    commentRejectGuide:
      'Nếu trả lại, hãy ghi rõ phải sửa gì mới trình lại được. Phê duyệt không hoàn tác được và việc lật lại là một yêu cầu mới.',
    commentDisabledReason: 'Ý kiến phê duyệt: bây giờ chưa đến lượt bạn phê duyệt yêu cầu này',
    commentSendingReason: 'Ý kiến phê duyệt: đang gửi phê duyệt',
    commentRequired: 'Hãy ghi ý kiến trả lại',
    approve: 'Phê duyệt',
    reject: 'Trả lại',
    blockedNotMyTurn: (action: string): string =>
      `${action}: bây giờ chưa đến lượt bạn phê duyệt yêu cầu này`,
    blockedNoComment: (action: string): string => `${action}: phải ghi ý kiến mới gửi được`,
    deliveryUnknown:
      'Không xác nhận được đã gửi đến nơi hay chưa. Hãy tra cứu lại và kiểm tra tiến trình phê duyệt rồi thử lại.',
  },
  dialog: {
    approveTitle: 'Phê duyệt yêu cầu này chứ?',
    rejectTitle: 'Trả lại yêu cầu này chứ?',
    commentHeading: 'Ý kiến phê duyệt đã ghi',
    noComment: 'Phê duyệt mà không có ý kiến.',
    commentRecorded: 'Ý kiến này được lưu vào hồ sơ phê duyệt.',
    irreversible: 'Phê duyệt không hoàn tác được. Muốn lật lại thì phải trình một yêu cầu mới.',
  },
  toast: {
    approved: 'Đã phê duyệt',
    rejected: 'Đã trả lại',
  },
  values: {
    unknownRequester: 'Không xác nhận được người trình',
    unknownApprover: 'Không xác nhận được người phê duyệt',
    unknownTarget: 'Không xác nhận được tên đối tượng',
    emptyReason: 'Lý do đang để trống',
  },
};
