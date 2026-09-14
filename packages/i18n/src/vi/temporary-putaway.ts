import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-07 임시 위치 적재. 정위치로 옮기는 일이 남는다는 것을 계속 말한다. */
export const temporaryPutaway: Translated<typeof ko.temporaryPutaway> = {
  title: 'Cất hàng vào vị trí tạm',
  banner: {
    title: 'Đây là cất hàng tạm',
    description: 'Vẫn còn việc chuyển về đúng vị trí. Màn hình này không làm việc đó.',
  },
  record: 'Cất hàng tạm',
  noTask: {
    title: 'Hãy mang theo lệnh cất hàng',
    description: 'Hãy chọn lệnh ở màn hình cất hàng và hoàn tất nhập kho rồi quay lại.',
    action: 'Đến cất hàng và hoàn tất nhập kho',
  },
  task: {
    legend: 'Lệnh cần làm',
    qty: (qty: string) => `Số lượng ${qty}`,
    item: (itemCode: string, taskNo: string, qty: string) => `${itemCode} · ${taskNo} · ${qty}`,
    origin: (code: string) => `Lệnh gốc ${code}`,
    recommended: (code: string) => `Vị trí đề xuất ${code}`,
    noRule: 'Không có vị trí đề xuất',
    already: 'Đã cất hàng tạm rồi',
    alreadyAt: (code: string) => `Vị trí hiện tại ${code}`,
    queued: 'Lệnh này đã có bản ghi cất hàng tạm đang chờ gửi',
    queuedWhy: 'Sẽ gửi khi có kết nối. Ghi thêm lần nữa sẽ thành hai bản ghi.',
  },
  location: {
    legend: 'Vị trí tạm',
    scanLabel: 'Quét mã vị trí tạm',
    scanPlaceholder: 'Hãy quét nhãn vị trí',
    pickLabel: 'Chọn từ danh sách',
    pickPlaceholder: 'Hãy chọn vị trí',
    loading: 'Đang tải vị trí',
    loadFailed: 'Không xác nhận được vị trí. Hãy kiểm tra kết nối.',
    none: 'Kho này chưa đăng ký vị trí nào',
    notFound: (code: string) => `Không tìm thấy vị trí ${code} trong kho này`,
    chosen: (code: string, name: string) => `${code} ${name}`,
    unfiltered: 'Không có chỗ nào đăng ký là vị trí tạm nên hiện toàn bộ vị trí',
    pickAction: 'Chọn từ danh sách',
    manual: 'Nhập tay',
    manualSubmit: 'Dùng vị trí đã nhập',
    capacity: (qty: string) => `Sức chứa ${qty} — là vị trí tạm nên không chặn`,
  },
  reason: {
    legend: 'Lý do cất hàng',
    label: 'Lý do',
    loading: 'Đang tải lý do',
    loadFailed: 'Không tải được lý do',
    empty: 'Chưa có lý do nào để chọn. Hãy ghi vào ghi chú.',
    remarksLabel: 'Ghi chú',
    needsOne: 'Hãy chọn lý do hoặc ghi chú',
  },
  submit: 'Đăng ký cất hàng tạm',
  sent: {
    title: 'Đã ghi nhận cất hàng tạm',
    description: 'Màn hình này không làm việc chuyển về đúng vị trí.',
  },
  queued: {
    title: 'Đã đưa cất hàng tạm vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Hiện chưa gửi.',
  },
  rejected: {
    title: 'Không gửi được cất hàng tạm',
    description: 'Hãy xem lý do trong bản ghi gửi thất bại. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  saveFailed: {
    title: 'Không lưu được cất hàng tạm',
    description: 'Chưa được ghi nhận. Hãy thử lại.',
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  done: 'Đến màn hình cất hàng',
};
