import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-12 ERP 송신 — 송신 항목 다섯과 고른 항목의 송신 예정 목록.
 * 송신은 `gửi`, 송신 예정은 `chờ gửi`, 연계 메시지는 `bản tin liên kết`(연동 현황·이력과 같다)로 맞춘다.
 */
export const erpOutbound: Translated<typeof ko.erpOutbound> = {
  title: 'Gửi ERP',
  panes: {
    items: 'Hạng mục gửi',
    pending: 'Chờ gửi',
  },
  splitter: 'Kéo để điều chỉnh độ rộng hạng mục gửi·chờ gửi',
  listCollapse: 'Thu gọn hạng mục gửi',
  listExpand: 'Mở hạng mục gửi',
  table: {
    item: 'Hạng mục gửi',
    send: 'Gửi',
    pending: 'Chờ',
    failed: 'Lỗi',
    messageKey: 'Số',
    createdAt: 'Tạo',
    availableAt: 'Thời điểm gửi',
    retryCount: 'Lần thử',
    lastErrorMessage: 'Lỗi gần nhất',
  },
  send: {
    on: 'Bật',
    off: 'Tắt',
    required: 'Bắt buộc',
  },
  pickRow: (name: string): string => `Chọn ${name}`,
  pendingTitle: (name: string, count: number): string => `${name} · chờ gửi ${String(count)}`,
  openMessage: (messageKey: string): string => `Mở chi tiết ${messageKey}`,
  empty: {
    pickItem: 'Hãy chọn hạng mục gửi',
    noInterface: 'Hạng mục này chưa gửi sang ERP',
    noPending: 'Không có bản tin chờ gửi',
    beyondLast: 'Trang này không có bản tin chờ gửi',
  },
  created: {
    label: 'Ngày tạo',
    presets: 'Chọn nhanh khoảng ngày tạo',
    all: 'Tất cả',
    week: '1 tuần gần nhất',
    month: '1 tháng gần nhất',
    from: 'Từ ngày',
    to: 'Đến ngày',
  },
  chips: {
    label: 'Tình trạng gửi ERP',
    pending: (count: number): string => `Chờ gửi ${String(count)}`,
    failed: (count: number): string => `Gửi lỗi ${String(count)}`,
  },
  loading: {
    items: 'Đang tải hạng mục gửi',
    pending: 'Đang tải danh sách chờ gửi',
  },
  values: {
    empty: '—',
  },
};
