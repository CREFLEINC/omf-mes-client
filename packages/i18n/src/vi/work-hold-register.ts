import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-10 작업 중단 등록. */
export const workHoldRegister: Translated<typeof ko.workHoldRegister> = {
  title: 'Tạm dừng công việc',
  entry: {
    /* ⚠ 머리줄 표기는 「W/O」로 통일한다(사용자 지시 2026-09-10). */
    workOrderLabel: 'W/O',
    workerLabel: 'Mã nhân viên',
    workerUnknown: 'Chưa xác nhận mã nhân viên',
    missingWorkOrder:
      'Chưa nhận được lệnh sản xuất. Hãy chọn lệnh ở màn hình bắt đầu công việc rồi vào lại.',
  },
  session: {
    sectionLabel: 'Phiên hiện tại',
    sessionNo: (no: number) => `Phiên #${String(no)}`,
    startedLabel: 'Bắt đầu',
    elapsedLabel: 'Đã qua',
    statusLabel: 'Trạng thái',
    loading: 'Đang kiểm tra phiên.',
    loadFailed: 'Không tải được phiên hiện tại.',
    none: 'Không có phiên làm việc đang chạy nên không đăng ký tạm dừng được. Hãy bắt đầu công việc trước.',
    unknownValue: 'Không xác nhận được',
  },
  history: {
    sectionLabel: 'Lịch sử sự kiện',
    timeColumn: 'Giờ',
    typeColumn: 'Loại',
    reasonColumn: 'Lý do',
    empty: 'Chưa có sự kiện nào được ghi.',
    loadFailed: 'Không tải được lịch sử sự kiện.',
  },
  form: {
    sectionLabel: 'Đăng ký tạm dừng',
    reasonLabel: 'Lý do tạm dừng',
    reasonRequired: 'Hãy chọn lý do tạm dừng.',
    reasonUnknown: 'Không rõ lý do đã chọn. Hãy chọn lại trong danh sách.',
    reasonLoading: 'Đang tải lý do tạm dừng.',
    reasonLoadFailed: 'Không tải được danh sách lý do tạm dừng.',
    reasonEmpty: 'Không có lý do tạm dừng để chọn. Cần đăng ký lý do trong quản lý mã chung.',
    reasonTruncated:
      'Lý do quá nhiều nên chỉ hiện một phần. Nếu không thấy lý do cần tìm, hãy báo quản trị viên.',
    reasonFromCache:
      'Mất kết nối nên đang hiện danh sách lý do đã nhận trước đó. Có thể không phải mới nhất.',
    /** ⭐ 비고는 작업지시 중단 본문이 받는다 — 적은 것이 실제로 저장된다. */
    remarksLabel: 'Ghi chú',
    workerRequired:
      'Chưa xác nhận được mã nhân viên nên không đăng ký được. Hãy xác nhận mã nhân viên trước.',
    stopAction: 'Đăng ký tạm dừng',
    resumeAction: 'Tiếp tục',
    alreadyStopped: 'Phiên này đã tạm dừng. Có thể tiếp tục.',
  },
  end: {
    action: 'Kết thúc phiên',
    blocked: 'Chỉ kết thúc được phiên đang chạy. Nếu đang tạm dừng, hãy tiếp tục trước.',
    confirmTitle: 'Kết thúc phiên?',
    confirmBody: (no: number) =>
      `Kết thúc phiên #${String(no)}. Phiên đã kết thúc không mở lại được, muốn làm tiếp phải bắt đầu mới.`,
    keepWorking: 'Làm tiếp',
    confirmAction: 'Kết thúc',
  },
  outbox: {
    queued: 'Đã đăng ký.',
    offline: 'Đang ngoại tuyến. Khi có kết nối sẽ tự động gửi.',
    pending: (count: number) => `Chờ gửi ${String(count)} mục`,
    rejected: 'Máy chủ không nhận.',
    stalled: 'Máy chủ vẫn không nhận. Nội dung đã đăng ký vẫn còn nguyên.',
    retryNow: 'Gửi lại',
  },
  eventTypes: {
    START: 'Bắt đầu phiên',
    STOP: 'Tạm dừng',
    RESUME: 'Tiếp tục',
    END: 'Kết thúc phiên',
    CONTROL_OVERRIDE: 'Bỏ qua kiểm soát',
  },
  sessionStatus: {
    RUNNING: 'Đang chạy',
    STOPPED: 'Tạm dừng',
    ENDED: 'Đã kết thúc',
  },
  errors: {
    retry: 'Thử lại',
  },
};
