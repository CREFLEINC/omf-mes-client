import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-04 공지·전달.
 *
 * ⚠ **공지는 `thông cáo`, 알림은 `thông báo`.** 두 말이 한 섹션 안에 나란히 서고(알림센터는
 * 받는 자리, 이쪽은 보내는 자리) 베트남어에서 둘 다 `thông báo` 로 뭉갤 수 있는 말이라
 * 여기서 갈라 둔다 — 사이드바도 `Thông cáo · truyền đạt` 로 그렇게 섰다.
 *
 * ⚠ **확인(`xác nhận`)은 「읽었다」는 기록이다.** 알림센터의 읽음(`Đã xem`)과 다른 일이다 —
 * 저쪽은 화면이 읽은 표시를 켜는 것이고 이쪽은 사람이 버튼을 눌러 이력을 남기는 것이다.
 *
 * ⭐ **종료는 지우는 것이 아니라 종료일을 당기는 것이다.** 옮긴 말도 「삭제」로 읽히면 안 된다
 * — 확인 이력이 남아야 한다는 것이 이 화면의 근거다.
 */
export const notice: Translated<typeof ko.notice> = {
  title: 'Thông cáo · truyền đạt',
  breadcrumbRoot: 'Thông báo',

  panes: {
    list: 'Danh sách thông cáo',
    detail: 'Thông cáo',
    ack: 'Tình hình xác nhận',
  },

  filters: {
    search: 'Tìm tiêu đề',
    searchPlaceholder: 'Hãy nhập một phần tiêu đề',
    status: 'Trạng thái',
    statusAll: 'Tất cả trạng thái',
    scope: 'Phạm vi đối tượng',
    scopeAll: 'Tất cả phạm vi',
    activeOnly: 'Chỉ đang đăng',
    unacknowledgedByMe: 'Chỉ những cái tôi chưa xác nhận',
    from: 'Bắt đầu khoảng',
    to: 'Kết thúc khoảng',
    /** ⭐ 시작일이 아니라 **겹침**이다 — 「trong khoảng」 으로 옮기면 긴 공지가 빠진다. */
    periodNote: 'Tìm thông cáo có kỳ đăng giao với khoảng này. Không lấy ngày bắt đầu làm chuẩn.',
    periodOptional: 'Khoảng thời gian để trống cũng được.',
    clear: 'Xóa điều kiện',
    invalidPeriod: 'Kết thúc khoảng đứng trước lúc bắt đầu.',
  },

  status: {
    DRAFT: 'Đang soạn',
    SCHEDULED: 'Sẽ đăng',
    PUBLISHED: 'Đang đăng',
    CLOSED: 'Đã kết thúc',
    derived: 'Trạng thái do việc đã đăng hay chưa và ngày hôm nay quyết định. Không đổi tay được.',
  },

  scope: {
    COMPANY: 'Toàn công ty',
    WORK_ORDER: 'Lệnh sản xuất',
    BUSINESS_UNIT: 'Đơn vị kinh doanh',
    EQUIPMENT_GROUP: 'Nhóm thiết bị',
    WORK_SHIFT: 'Ca làm việc',
    unsupported: 'Đợt 1 chỉ dùng được toàn công ty và lệnh sản xuất. Còn lại máy chủ sẽ từ chối.',
    /** ⚠ 선택칸 이름 **뒤**에 붙는 꼬리다 — 앞 공백까지가 이 값이다. */
    unsupportedSuffix: ' (đợt 1 chưa hỗ trợ)',
    companyNote: 'Tài khoản mới tạo cũng tự động vào diện đối tượng.',
  },

  list: {
    title: 'Tiêu đề',
    status: 'Trạng thái',
    scope: 'Đối tượng',
    period: 'Kỳ',
    ack: 'Xác nhận',
    notAvailable: '—',
    ackOf: (done: number, total: number): string => `${String(done)} / ${String(total)} người`,
    ackDoneOnly: (done: number): string => `${String(done)} người`,
    ackNotRequired: 'Không yêu cầu xác nhận',
    emptyTitle: 'Không có thông cáo',
    empty: 'Không có thông cáo khớp điều kiện. Hãy nới điều kiện hoặc viết thông cáo mới.',
    loadFailed: 'Không tải được danh sách thông cáo.',
    selectTitle: 'Hãy chọn một thông cáo',
    select: 'Chọn thông cáo ở bên trái thì sẽ thấy nội dung và tình hình xác nhận.',
  },

  form: {
    create: 'Viết thông cáo mới',
    edit: 'Sửa thông cáo',
    title: 'Tiêu đề',
    body: 'Nội dung',
    startDate: 'Ngày bắt đầu',
    endDate: 'Ngày kết thúc',
    endDateNote: 'Đây là ngày bắt buộc để tính trạng thái đăng.',
    acknowledgeRequired: 'Bắt người đọc bấm xác nhận',
    scope: 'Phạm vi đối tượng',
    workOrder: 'Lệnh sản xuất đối tượng',
    workOrderNote: 'Chỉ chọn khi phạm vi đối tượng là lệnh sản xuất.',
    save: 'Lưu',
    saving: 'Đang lưu.',
    saved: 'Đã lưu thông cáo.',
    cancel: 'Hủy',
    requiredTitle: 'Hãy nhập tiêu đề.',
    requiredBody: 'Hãy nhập nội dung.',
    requiredStartDate: 'Hãy chọn ngày bắt đầu.',
    requiredEndDate: 'Hãy chọn ngày kết thúc.',
    requiredScope: 'Hãy chọn phạm vi đối tượng.',
    requiredWorkOrder: 'Hãy chọn lệnh sản xuất đối tượng.',
    workOrderNotAllowed: 'Phạm vi đối tượng không phải lệnh sản xuất thì để trống lệnh sản xuất.',
    unsupportedScope: 'Đợt 1 chỉ dùng được toàn công ty và lệnh sản xuất.',
    invalidDate: 'Ngày này không có trên lịch. Hãy chọn lại ngày.',
    invalidEndDate: 'Ngày kết thúc đứng trước ngày bắt đầu. Hãy chọn lại hai ngày.',
    workOrderLookupFailed: 'Không tải được danh sách lệnh sản xuất nên hiện chưa chọn được.',
    lookupTruncated:
      'Chỉ hiển thị một phần danh sách. Không thấy cái cần tìm thì hãy hỏi người phụ trách.',
    selectPlaceholder: 'Hãy chọn',
    attachmentLocked: 'Đính kèm chưa mở. Khi nào định được đính kèm vào đâu thì sẽ mở.',
  },

  detail: {
    /** ⛔⛔ 게시 뒤 본문 잠금. **이유까지 옮긴다** — 이유가 빠지면 서버가 심술부리는 것으로 읽힌다. */
    lockedAfterPublish:
      'Thông cáo đã đăng thì không sửa được nội dung. Vì như vậy người đã xác nhận hóa ra đã xem một bản khác. Cần sửa thì hãy kết thúc rồi viết mới.',
    publish: 'Đăng',
    publishTitle: 'Đăng thông cáo này chứ?',
    publishLead: 'Đăng rồi thì nội dung bị khóa. Chỉ sửa được trước khi đăng.',
    published: 'Đã đăng thông cáo.',
    close: 'Kết thúc',
    closeTitle: 'Gỡ thông cáo này xuống chứ?',
    /** ⭐ `xóa`(지우다)를 쓰지 않는다 — 종료는 종료일을 당기는 일이다. */
    closeLead: 'Không xóa mà kéo ngày kết thúc về hôm nay — lịch sử xác nhận phải còn lại.',
    closed: 'Đã kết thúc thông cáo.',
    confirm: 'Tiến hành',
    cancel: 'Hủy',
    acknowledge: 'Tôi đã xác nhận',
    acknowledged: 'Đã ghi lại là đã xác nhận.',
    dismiss: 'Đóng mà không xác nhận',
    dismissed: 'Đã ghi lại là đóng mà không xác nhận.',
    dismissLocked: 'Thông cáo này yêu cầu xác nhận nên không đóng suông được. Hãy bấm xác nhận.',
    createdBy: 'Người viết',
    publishedAt: 'Thời điểm đăng',
    period: 'Kỳ đăng',
    noEndDate: 'Không có ngày kết thúc',
    loadFailed: 'Không tải được thông cáo.',
  },

  ack: {
    title: 'Tình hình xác nhận',
    notRequired: 'Thông cáo này không yêu cầu xác nhận nên không có tình hình xác nhận.',
    pendingOnly: 'Chỉ người chưa xác nhận',
    who: 'Người',
    state: 'Trạng thái',
    at: 'Thời điểm',
    /** ⭐ 세 갈래를 같은 모양으로 그리지 않는다 — 열람과 확인은 다른 일이다. */
    done: 'Đã xác nhận',
    opened: 'Đã mở (chưa xác nhận)',
    pending: 'Chưa xác nhận',
    notAvailable: '—',
    workerNote:
      'Người xác nhận từ máy quét tại hiện trường hiện theo mã nhân viên — họ không có tài khoản.',
    emptyTitle: 'Không có đối tượng',
    empty: 'Thông cáo này chưa có đối tượng xác nhận nào.',
    loadFailed: 'Không tải được tình hình xác nhận.',
    noDenominator:
      'Phạm vi lệnh sản xuất không đếm được số người đối tượng nên chỉ hiện số đã xác nhận.',
  },

  guard: {
    detailNeedsSelection: 'Không tra cứu chi tiết khi chưa chọn thông cáo.',
    ackNeedsSelection: 'Không tra cứu tình hình xác nhận khi chưa chọn thông cáo.',
  },

  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
    prev: 'Trước',
    next: 'Sau',
  },
};
