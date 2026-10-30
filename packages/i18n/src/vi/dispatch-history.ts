import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-CO-13 알림 발송 이력. 사이드바 라벨(`nav-tree.ts`)과 제목 글자가 같아야 한다. */
export const dispatchHistory: Translated<typeof ko.dispatchHistory> = {
  title: 'Lịch sử gửi thông báo',
  breadcrumbRoot: 'Quản trị hệ thống',
  description:
    'Xem từng sự kiện đã gửi thông báo chưa, nếu không thì vì sao, và kết quả Zalo theo người nhận.',
  panes: { dispatches: 'Kết quả xử lý sự kiện', deliveries: 'Chi tiết gửi Zalo' },
  filters: {
    from: 'Từ ngày',
    to: 'Đến ngày',
    event: 'Sự kiện',
    department: 'Phòng ban',
    result: 'Kết quả',
    deliveryStatus: 'Trạng thái',
    all: 'Tất cả',
    search: 'Tra cứu',
    eventGroup: 'Sự kiện',
    handoverGroup: 'Công việc bàn giao',
  },
  results: { NOTIFIED: 'Đã thông báo', SKIPPED: 'Bỏ qua' },
  skipReasons: {
    DEPARTMENT_UNRESOLVED: 'Không xác định phòng ban',
    EVENT_DISABLED: 'Sự kiện đang tắt',
    NO_RECIPIENTS: 'Không có người nhận',
    REPORTER_OPTED_OUT: 'Người báo cáo tắt thông báo',
    APPROVER_INACTIVE: 'Người phê duyệt ngừng sử dụng',
  },
  skipped: (reason: string): string => `Bỏ qua: ${reason}`,
  deliveryStatus: {
    PENDING: 'Đang chờ',
    SENT: 'Thành công',
    FAILED: 'Thất bại',
    EXPIRED: 'Hết hạn',
  },
  zaloSummary: (
    sent: number,
    failed: number,
    pending: number,
    expired: number,
    noPhone: number,
  ): string =>
    `Thành công ${String(sent)} · Thất bại ${String(failed)} · Chờ ${String(pending)} · Hết hạn ${String(expired)} · Không số ${String(noPhone)}`,
  columns: {
    occurredAt: 'Thời điểm phát sinh',
    event: 'Sự kiện',
    department: 'Phòng ban',
    target: 'Đối tượng',
    result: 'Kết quả',
    notificationCount: 'Số thông báo',
    zalo: 'Zalo',
    recipient: 'Người nhận',
    phone: 'Số điện thoại',
    status: 'Trạng thái',
    attempts: 'Lần thử',
    error: 'Lỗi',
    sentAt: 'Thời điểm gửi',
    trackingId: 'tracking id',
  },
  actions: { prevPage: 'Trang trước', nextPage: 'Trang sau' },
  state: {
    empty: 'Không có thông báo khớp điều kiện',
    deliveriesEmpty: 'Không có lượt gửi Zalo',
    pageOf: (page: number, totalPages: number): string => `${String(page)} / ${String(totalPages)}`,
  },
  errors: {
    periodRequired: 'Hãy nhập khoảng thời gian.',
    periodReversed: 'Ngày kết thúc không được trước ngày bắt đầu.',
    periodTooLong: 'Chỉ tra cứu được khoảng thời gian tối đa 31 ngày',
  },
};
