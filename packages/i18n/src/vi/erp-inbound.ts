import type { ko } from '../ko';
import type { Translated } from './translated';

/** ERP 수신 — 받기는 `nhận`, 지금 읽기는 `Đọc ngay` 로 한 벌로 맞춘다. */
export const erpInbound: Translated<typeof ko.erpInbound> = {
  title: 'Nhận ERP',
  disabledReason: 'Không thể dùng Đọc ngay vì liên kết ERP đang tắt trên máy chủ này.',
  chips: {
    label: 'Trạng thái nhận ERP',
    receiveOn: 'Nhận: bật',
    receiveOff: 'Nhận: tắt',
  },
  filters: {
    label: 'Điều kiện tra cứu',
    search: 'Tìm hạng mục nhận',
    searchPlaceholder: 'Nhập tên hạng mục nhận',
    lane: 'Chọn nhóm',
    state: 'Chọn trạng thái',
    all: 'Tất cả',
  },
  panes: {
    list: 'Danh sách bảng nhận',
    detail: 'Chi tiết bảng nhận',
  },
  detail: {
    pick: 'Hãy chọn một bảng nhận.',
    pickDescription: 'Có thể xem kết quả đọc lần cuối của bảng đã chọn và yêu cầu Đọc ngay.',
    pickRow: (name: string): string => `Chọn ${name}`,
  },
  noMatch: 'Không có bảng phù hợp điều kiện',
  table: {
    label: 'Bảng nhận ERP',
    name: 'Hạng mục nhận',
    state: 'Trạng thái',
    lastFinishedAt: 'Thời điểm nhận gần nhất',
    read: 'Đã đọc',
    applied: 'Đã áp dụng',
    failed: 'Lỗi',
    held: 'Tạm giữ',
    nextRunAt: 'Thời điểm nhận dự kiến tiếp theo',
    lane: 'Nhóm',
    lastErrorMessage: 'Nội dung lỗi',
    action: 'Đọc ngay',
  },
  actions: {
    runNow: 'Đọc ngay',
    runNowRow: (name: string): string => `Đọc ngay ${name}`,
  },
  state: {
    running: 'Đang đọc',
    requested: 'Đang chờ',
    never: 'Chưa có bản ghi',
    succeeded: 'Thành công',
    failed: 'Thất bại',
  },
  requestedAt: (time: string): string => `Yêu cầu lúc ${time}`,
  runErrorTitle: 'Không gửi được yêu cầu đọc',
  finished: {
    succeeded: (name: string, applied: number): string =>
      `Đã đọc xong ${name}. Đã áp dụng ${String(applied)} mục.`,
    withFailures: (name: string, applied: number, failed: number): string =>
      `Đã đọc xong ${name}. Đã áp dụng ${String(applied)} mục, ${String(failed)} mục không áp dụng được.`,
    failed: (name: string): string => `Đọc ${name} thất bại. Hãy xem lý do ở cột trạng thái.`,
  },
  loading: 'Đang tải trạng thái nhận ERP',
  empty: 'Không có bảng nhận dữ liệu',
  values: {
    empty: '—',
  },
};
