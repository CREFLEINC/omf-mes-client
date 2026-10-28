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
  table: {
    label: 'Bảng nhận ERP',
    name: 'Bảng',
    state: 'Trạng thái',
    lastFinishedAt: 'Đọc lần cuối',
    read: 'Đã đọc',
    applied: 'Đã áp dụng',
    failed: 'Lỗi',
    held: 'Tạm giữ',
    nextRunAt: 'Lần kế tiếp',
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
