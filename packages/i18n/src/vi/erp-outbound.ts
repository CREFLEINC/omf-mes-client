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
    list: 'Danh sách gửi ERP',
    pending: 'Chờ gửi',
    detail: 'Chi tiết hạng mục gửi',
  },
  filters: {
    label: 'Điều kiện tra cứu',
    search: 'Tìm hạng mục gửi',
    searchPlaceholder: 'Nhập tên hạng mục gửi',
    state: 'Chọn trạng thái gửi',
    all: 'Tất cả',
    sendOff: 'Tắt gửi',
  },
  splitter: 'Kéo để điều chỉnh độ rộng hạng mục gửi·chờ gửi',
  listCollapse: 'Thu gọn hạng mục gửi',
  listExpand: 'Mở hạng mục gửi',
  table: {
    item: 'Hạng mục gửi',
    send: 'Bật gửi',
    pending: 'Chờ gửi',
    failed: 'Gửi lỗi',
    messageKey: 'Số chứng từ',
    createdAt: 'Thời điểm tạo',
    availableAt: 'Thời điểm gửi dự kiến',
    retryCount: 'Số lần thử lại',
    lastErrorMessage: 'Nội dung lỗi',
    sendTiming: 'Thời điểm gửi',
    lockReason: 'Lý do không thể tắt',
  },
  counts: (count: number): string => `${count.toLocaleString()} mục`,
  times: (count: number): string => `${String(count)} lần`,
  send: {
    on: 'Bật',
    off: 'Tắt',
    required: 'Bắt buộc',
  },
  pickRow: (name: string): string => `Chọn ${name}`,
  pendingTitle: (name: string, count: number): string => `${name} · chờ gửi ${String(count)}`,
  openMessage: (title: string): string => `Mở chi tiết ${title}`,
  empty: {
    pickItem: 'Hãy chọn hạng mục gửi.',
    pickItemDescription: 'Có thể xem các bản tin chờ gửi của hạng mục đã chọn.',
    noMatch: 'Không có hạng mục gửi phù hợp điều kiện',
    noInterface: 'Hạng mục này chưa gửi sang ERP',
    noPending: 'Không có bản tin chờ gửi',
    beyondLast: 'Trang này không có bản tin chờ gửi',
  },
  chips: {
    sendOn: 'Gửi: bật',
    sendOff: 'Gửi: tắt',
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
