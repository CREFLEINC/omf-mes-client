import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-09 결재함.
 *
 * ⛔ **화면이 판정을 지어내지 않는 규율을 옮긴 말에서도 지킨다.** 「내 차례가 아니다」에 이유를
 * 붙이지 않는 것이 원문의 규율이다 — 베트남어로 풀면서 「앞 단계가 안 끝났다」 같은 사유를
 * 덧붙이면 서버와 갈리는 순간 거짓 확신이 된다.
 *
 * ⚠ **「승인」과 「결재」는 둘 다 `phê duyệt` 이다.** 원문에서도 같은 일을 가리키는 두 말이라
 * 나누지 않는다. 가르는 것은 **반려(`Từ chối`)** 쪽이다.
 *
 * ⚠ **「상신」은 `trình`.** 결재에 올리는 일이고, 승인하는 쪽(`người phê duyệt`)과 올리는
 * 쪽(`người trình`)이 같은 화면에 나란히 서므로 두 말을 섞지 않는다.
 */
export const approvalInbox: Translated<typeof ko.approvalInbox> = {
  title: 'Hộp phê duyệt',
  breadcrumbRoot: 'Phê duyệt',
  panes: {
    list: 'Danh sách yêu cầu phê duyệt',
    detail: 'Yêu cầu đã chọn',
    request: 'Thông tin yêu cầu',
    target: 'Đối tượng',
    progress: 'Tiến trình phê duyệt',
    reason: 'Toàn văn lý do',
    decision: 'Phê duyệt',
  },
  tabs: {
    label: 'Xem hộp phê duyệt',
    pending: 'Chờ tôi duyệt',
    requested: 'Tôi đã trình',
    all: 'Tất cả',
    pendingBadge: (count: number): string => `Chờ ${String(count)} mục`,
  },
  fields: {
    approvalRequestNo: 'Số yêu cầu',
    reason: 'Lý do',
    requestedByName: 'Người trình',
    requestedAt: 'Thời điểm trình',
    status: 'Trạng thái',
    approvalTypeCode: 'Loại phê duyệt',
    /** 열 이름과 낱말이 다른 것이 맞다 — 조건은 **날짜 단위**라 시각을 뜻하는 말을 쓰지 않는다. */
    period: 'Ngày trình',
    q: 'Tìm số yêu cầu',
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
    blockedNotOpenable: 'Mở: Đối tượng này không có màn hình để mở',
    blockedNoScreenId: 'Mở: Chưa định màn hình để mở đối tượng này',
    blockedUnmapped: 'Mở: Màn hình này chưa có trên web quản trị',
    note: 'Nội dung xem ở màn hình gốc',
  },
  progress: {
    position: (current: number, total: number): string =>
      `Bước ${String(current)} / ${String(total)}`,
    finished: (total: number): string => `Đã kết thúc phê duyệt · tổng ${String(total)} bước`,
    myTurn: 'Đang đến lượt bạn phê duyệt yêu cầu này',
    notMyTurn: 'Hiện chưa đến lượt bạn phê duyệt yêu cầu này',
    waitingCurrent: 'Đây là bước đang chờ phê duyệt',
    waitingPending: 'Đây là bước chưa phê duyệt',
    mine: 'Bước của tôi',
    noSteps: 'Không nhận được bước phê duyệt nào',
  },
  filters: {
    all: 'Tất cả',
    chipApprovalType: (value: string): string => `Loại phê duyệt: ${value}`,
    chipStatus: (value: string): string => `Trạng thái: ${value}`,
    chipPeriod: (from: string, to: string): string => `Ngày trình: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `Ngày trình: từ ${from}`,
    chipPeriodTo: (to: string): string => `Ngày trình: đến ${to}`,
    chipKeyword: (value: string): string => `Số yêu cầu: ${value}`,
    chipRemoveApprovalType: 'Bỏ điều kiện loại phê duyệt',
    chipRemoveStatus: 'Bỏ điều kiện trạng thái',
    chipRemovePeriod: 'Bỏ điều kiện ngày trình',
    chipRemoveKeyword: 'Bỏ điều kiện số yêu cầu',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
  },
  empty: {
    noResultTitle: 'Không có yêu cầu phê duyệt khớp điều kiện',
    noResultDescription: 'Hãy bớt điều kiện hoặc tra cứu lại ở tab khác.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noSelectionTitle: 'Chọn một yêu cầu thì sẽ thấy nội dung chi tiết',
    noSelectionDescription: 'Hãy bấm số yêu cầu ở danh sách trên.',
    notFoundTitle: 'Không tìm thấy yêu cầu đã chọn',
    notFoundDescription: 'Yêu cầu đã được xử lý hoặc đã bị xóa. Hãy chọn lại từ danh sách.',
    forbiddenTitle: 'Bạn không có quyền xem yêu cầu này',
    forbiddenDescription:
      'Chỉ người phê duyệt hoặc người trình mới xem được. Hãy hỏi người phụ trách.',
  },
  decision: {
    /**
     * ⚠ **자물쇠 비유를 그대로 든다.** 「승인은 실행이 아니다」가 이 문장의 요지고, 계약
     * 문면이 그렇게 적혀 있다 — 풀어 쓰면 승인이 전기·출고까지 한다고 읽힐 여지가 생긴다.
     */
    lockNote:
      'Phê duyệt chỉ mở khóa chứ không thực hiện. Ghi sổ và xuất kho làm riêng ở màn hình đối tượng.',
    commentLabel: 'Ý kiến phê duyệt',
    commentHelp: 'Phê duyệt thì không cần ghi ý kiến, từ chối thì phải có ý kiến mới gửi được.',
    /** 비활성 사유는 **컨트롤 이름으로 시작한다**(배치 규범 4). 옮긴 말에서도 앞머리를 지킨다. */
    commentDisabledReason: 'Ý kiến phê duyệt: Hiện chưa đến lượt bạn phê duyệt yêu cầu này',
    commentSendingReason: 'Ý kiến phê duyệt: Đang gửi phê duyệt',
    commentRequired: 'Hãy ghi ý kiến từ chối',
    approve: 'Phê duyệt',
    reject: 'Từ chối',
    blockedNotMyTurn: (action: string): string =>
      `${action}: Hiện chưa đến lượt bạn phê duyệt yêu cầu này`,
    /** 앞머리가 이미 어느 컨트롤인지 말하므로 뒤는 **무엇이 모자란지만** 말한다. */
    blockedNoComment: (action: string): string => `${action}: Phải ghi ý kiến mới gửi được`,
    deliveryUnknown:
      'Không xác nhận được là đã gửi tới nơi hay chưa. Hãy tra cứu lại để xem tiến trình phê duyệt rồi thử lại.',
  },
  dialog: {
    approveTitle: 'Phê duyệt yêu cầu này chứ?',
    rejectTitle: 'Từ chối yêu cầu này chứ?',
    subject: (approvalRequestNo: string): string => `Số yêu cầu ${approvalRequestNo}`,
    commentHeading: 'Ý kiến phê duyệt đã ghi',
    noComment: 'Phê duyệt mà không có ý kiến.',
    commentRecorded: 'Ý kiến này sẽ lưu lại trong hồ sơ phê duyệt.',
    irreversible: 'Phê duyệt không thể hoàn tác. Muốn đảo lại thì phải trình yêu cầu mới.',
  },
  toast: {
    approved: 'Đã phê duyệt',
    rejected: 'Đã từ chối',
  },
  values: {
    unknownRequester: 'Không xác nhận được người trình',
    emptyReason: 'Lý do đang trống',
    unknownApprover: 'Không xác nhận được người phê duyệt',
    unknownTarget: 'Không xác nhận được tên đối tượng',
  },
};
