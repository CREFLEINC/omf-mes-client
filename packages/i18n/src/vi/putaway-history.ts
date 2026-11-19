import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-14 lịch sử cất hàng. Chỉ hiện bản ghi đã lên máy chủ; dòng chỉ để xem. */
export const putawayHistory: Translated<typeof ko.putawayHistory> = {
  title: 'Lịch sử cất hàng',
  tabsLabel: 'Tiêu chí xem',
  tabs: {
    mine: 'Của tôi',
    terminal: 'Thiết bị này',
  },
  weekdays: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  dateLabel: (date: string, weekday: string, today: boolean) =>
    today ? `Hôm nay, ${date} (${weekday})` : `${date} (${weekday})`,
  prevDay: 'Ngày trước',
  nextDay: 'Ngày sau',
  basis: {
    mine: (workerNo: string, workerName: string, count: number | null) =>
      `${workerNo} ${workerName}, mọi thiết bị${count === null ? '' : `, ${String(count)} bản ghi`}`,
    terminal: (terminalCode: string | null, count: number | null) =>
      `${terminalCode === null ? 'Thiết bị này' : `Thiết bị ${terminalCode}`}, mọi công nhân${count === null ? '' : `, ${String(count)} bản ghi`}`,
  },
  listLabel: 'Danh sách lịch sử cất hàng',
  loading: 'Đang tải lịch sử cất hàng',
  loadFailed: 'Không tải được lịch sử cất hàng. Hãy kiểm tra kết nối.',
  more: (loaded: number, total: number) => `Xem thêm (${String(loaded)} / ${String(total)})`,
  empty: {
    title: 'Không có bản ghi cất hàng trong ngày này',
    mine: 'Hãy đổi ngày hoặc xem «Thiết bị này».',
    terminal: 'Hãy đổi ngày.',
  },
  queued: {
    title: (count: number) =>
      `Đang chờ gửi ${String(count)} bản ghi — sẽ hiện ở đây sau khi gửi xong`,
    action: 'Xem bản ghi chờ gửi',
  },
  offline: {
    title: 'Mất kết nối',
    loadedAt: (time: string) => `Danh sách tải lúc ${time}. Sẽ tải lại khi có kết nối.`,
    none: 'Sẽ tải khi có kết nối.',
  },
  meta: (documentNo: string, time: string, worker: string) => `${documentNo}, ${time}, ${worker}`,
  mode: {
    DESIGNATED: 'Vị trí chỉ định',
    UNDESIGNATED: 'Vị trí không chỉ định',
    TEMPORARY: 'Cất tạm',
    TASK: (source: string) => `Theo lệnh (${source})`,
    TASK_TEMPORARY: (source: string) => `Theo lệnh, hoàn tất tạm (${source})`,
  },
  source: {
    PURCHASE: 'Mua hàng',
    PRODUCT: 'Thành phẩm',
    REPLENISHMENT: 'Bổ sung',
  },
  defective: 'Lỗi',
  cancelled: 'Đã hủy nhập kho',
  cancelRequested: 'Đang yêu cầu hủy',
  back: (screen: string) => `Về ${screen}`,
};
