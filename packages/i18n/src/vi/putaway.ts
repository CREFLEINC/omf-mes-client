import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-05 적치·입고 완료. 권장 위치가 아닌 자리는 확인을 받고 통과시킨다. */
export const putaway: Translated<typeof ko.putaway> = {
  title: 'Cất hàng và hoàn tất nhập kho',
  record: 'Xong cất hàng',
  worker: {
    loading: 'Đang xác nhận mã nhân viên',
    loadFailed: 'Không xác nhận được mã nhân viên. Hãy kiểm tra kết nối.',
    notFound: (workerNo: string) => `Không tìm thấy người có mã nhân viên ${workerNo}`,
  },
  tasks: {
    legend: 'Lệnh cất hàng của tôi',
    loading: 'Đang tải lệnh cất hàng',
    loadFailed: 'Không xác nhận được lệnh cất hàng. Hãy kiểm tra kết nối.',
    none: 'Chưa nhận lệnh cất hàng nào',
    count: (count: string) => `${count} lệnh chờ cất hàng`,
    from: (code: string) => `Hiện tại ${code}`,
    recommended: (code: string) => `Vị trí gợi ý ${code}`,
    item: (itemCode: string, taskNo: string, qty: string) => `${itemCode} · ${taskNo} · ${qty}`,
    hasRule: 'Có vị trí gợi ý',
    noRule: 'Không có vị trí gợi ý',
    rule: (priority: string) => `Ưu tiên quy tắc cất hàng ${priority}`,
    change: 'Chọn lệnh khác',
  },
  location: {
    legend: '① Vị trí cất hàng',
    scanLabel: 'Quét mã vị trí',
    scanPlaceholder: 'Hãy quét nhãn vị trí',
    pickLabel: 'Vị trí cất hàng',
    pickPlaceholder: 'Hãy chọn vị trí',
    loading: 'Đang tải vị trí',
    loadFailed: 'Không xác nhận được vị trí. Hãy kiểm tra kết nối.',
    none: 'Kho này chưa đăng ký vị trí nào',
    notFound: (code: string) => `Không tìm thấy vị trí ${code} trong kho này`,
    chosen: (code: string, name: string) => `${code} ${name}`,
    manual: 'Nhập tay',
    manualSubmit: 'Dùng vị trí đã nhập',
  },
  lot: {
    legend: '② Quét LOT vật tư',
    scanLabel: 'Quét nhãn LOT',
    scanPlaceholder: 'Hãy quét nhãn vật tư',
    manual: 'Nhập tay',
    manualSubmit: 'Dùng LOT đã nhập',
    loading: 'Đang tải số LOT',
    loadFailed: 'Không xác nhận được số LOT. Hãy kiểm tra kết nối.',
    expected: (lotNo: string) => `LOT của lệnh ${lotNo}`,
    matched: (lotNo: string) => `Đã quét ${lotNo}`,
    mismatch: 'Đây không phải LOT của lệnh này',
  },
  verdict: {
    matched: 'Đúng vị trí gợi ý',
    notRecommended: (code: string) => `Không phải vị trí gợi ý ${code}`,
    temporary: 'Nếu phải để tạm, hãy sang màn hình cất hàng vào vị trí tạm',
    noRule: 'Mặt hàng này không có vị trí quản lý. Cất hàng ở đây chứ?',
    noRuleConfirm: 'Cất hàng ở đây',
  },
  mix: {
    item: 'Vị trí này chỉ chứa một mặt hàng',
    lot: 'Vị trí này chỉ chứa một LOT',
    temporary: 'Nếu phải để tạm, hãy sang màn hình cất hàng vào vị trí tạm',
  },
  overCapacity: (capacity: string, held: string, adding: string) =>
    `Sức chứa ${capacity} · Hiện có ${held} + ${adding}`,
  storageMismatch: (itemCondition: string, locationCondition: string) =>
    `Mặt hàng cần bảo quản ${itemCondition} nhưng chỗ này là ${locationCondition}`,
  record1: 'Cất hàng theo lệnh này',
  done: {
    count: (count: string) => `Đã cất ${count} lượt`,
    row: (lotNo: string, code: string, qty: string) => `${lotNo} → ${code} ${qty}`,
    submit: 'Xong cất hàng',
  },
  sent: {
    title: 'Đã ghi nhận cất hàng',
  },
  queued: {
    title: 'Đã đưa cất hàng vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Hiện chưa gửi.',
  },
  rejected: {
    title: 'Không gửi được cất hàng',
    description: 'Hãy xem lý do trong bản ghi gửi thất bại. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  saveFailed: {
    title: 'Không lưu được cất hàng',
    description: 'Chưa được ghi nhận. Hãy thử lại.',
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
};
