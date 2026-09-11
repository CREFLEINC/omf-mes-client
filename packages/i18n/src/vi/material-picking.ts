import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-08 자재 출고·피킹. 담긴 것을 끝난 것으로 말하지 않는다. */
export const materialPicking: Translated<typeof ko.materialPicking> = {
  title: 'Xuất kho và lấy hàng vật tư',
  record: {
    picked: 'Lấy hàng vật tư',
    issued: 'Xuất kho vật tư',
  },
  worker: {
    loading: 'Đang xác nhận mã nhân viên',
    loadFailed: 'Không xác nhận được mã nhân viên. Hãy kiểm tra kết nối.',
    notFound: (workerNo: string) => `Không tìm thấy người có mã nhân viên ${workerNo}`,
  },
  orders: {
    legend: 'Lệnh lấy hàng của tôi',
    loading: 'Đang tải lệnh lấy hàng',
    loadFailed: 'Không xác nhận được lệnh lấy hàng. Hãy kiểm tra kết nối.',
    none: 'Chưa nhận lệnh lấy hàng nào',
    closed: 'Lệnh này đã xuất kho xong. Không xuất lại được.',
    change: 'Chọn lệnh khác',
    type: (name: string) => `Loại ${name}`,
    destination: (code: string) => `Nơi đến ${code}`,
    destinationLoading: 'Đang tải vị trí đến',
    destinationOffline: 'Không xác nhận được vị trí đến. Hãy kiểm tra kết nối.',
    destinationUnknown:
      'Không xác nhận được vị trí đến. Không phải do kết nối, hãy báo người phụ trách.',
  },
  lines: {
    legend: 'Dòng lấy hàng',
    progress: (done: number, total: number) => `${String(done)} / ${String(total)}`,
    heldCount: (count: string) => `Tạm giữ ${count}`,
    loading: 'Đang tải các dòng',
    loadFailed: 'Không xác nhận được các dòng. Hãy kiểm tra kết nối.',
    none: 'Lệnh này không có dòng nào',
    planned: (planned: string, picked: string) => `Yêu cầu ${planned} / Đã lấy ${picked}`,
    queued: (qty: string) => `${qty} đang chờ gửi — chưa được phản ánh`,
    at: (locationCode: string) => `Vị trí ${locationCode}`,
    expiry: (date: string) => `Hạn dùng ${date}`,
    manufactured: (date: string) => `Ngày sản xuất ${date}`,
    rank: (rank: number) => `Thứ tự xuất trước ${String(rank)}`,
    held: 'Đang tạm giữ',
    heldReason: (reason: string) => `Lý do tạm giữ ${reason}`,
    heldReasonUnknown: (code: string) => `Lý do tạm giữ ${code} (không có tên hiển thị)`,
    heldReasonLoading: 'Đang xác nhận lý do tạm giữ',
    heldReasonFailed: 'Không xác nhận được lý do tạm giữ',
    done: 'Đã lấy đủ',
  },
  scan: {
    legend: 'Quét LOT',
    label: 'Số LOT',
    placeholder: 'Hãy quét nhãn LOT',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Đưa vào',
    mismatch: (expected: string) => `Đây không phải LOT của dòng này. Hãy lấy ${expected}.`,
    matched: 'Đúng LOT của dòng này',
  },
  qty: {
    label: 'Số lượng xuất kho',
    problem: {
      notNumber: 'Hãy ghi số lượng bằng chữ số',
      notPositive: 'Số lượng phải lớn hơn 0',
      overPlanned: (limit: string) => `Không được vượt phần yêu cầu còn lại ${limit}`,
    },
  },
  outOfSequence: 'Còn LOT có thứ tự xuất trước sớm hơn. Vẫn lấy được.',
  pick: 'Lấy hàng dòng này',
  picked: (qty: string) => `Đã lấy ${qty}`,
  submit: 'Xác nhận xuất kho',
  partialNote:
    'Lấy ít hơn yêu cầu thì phần thiếu vẫn còn. Vật tư thay thế không xử lý ở màn hình này.',
  issueTypeLabel: 'Loại xuất kho',
  issueTypePlaceholder: 'Hãy chọn loại xuất kho',
  issueTypeNote: 'Không có loại đưa vào sản xuất nên người phụ trách tự chọn.',
  issueTypeLoadFailed: 'Không tải được loại xuất kho',
  noIssueType: 'Không có loại xuất kho nào để chọn. Hãy hỏi quản trị viên.',
  pickOutcome: {
    sent: { title: 'Đã lấy', description: '' },
    queued: {
      title: 'Đã đưa việc lấy hàng vào hàng chờ gửi',
      description: 'Sẽ gửi khi có kết nối. Hiện chưa gửi.',
    },
    rejected: {
      title: 'Không gửi được việc lấy hàng',
      description: 'Đã gửi nhưng không được đăng ký.',
    },
  },
  saveFailed: 'Không lưu được trên máy này. Hãy kiểm tra dung lượng rồi thử lại.',
  allIssued: 'Lệnh này không còn gì để xuất kho.',
  issueQueued: 'Việc xuất kho của lệnh này đã đang chờ gửi. Sẽ gửi khi có kết nối.',
  returned: {
    title: (count: string) => `Số bản ghi gửi thất bại của lệnh này ${count}`,
    description: 'Đã gửi nhưng không được đăng ký. Hãy xem lý do. ',
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  sent: {
    title: 'Đã xác nhận xuất kho',
  },
  queued: {
    title: 'Đã đưa việc xuất kho vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Chưa phải là đã xác nhận, gửi xong vẫn có thể bị trả lại.',
  },
  rejected: {
    title: 'Không gửi được việc xuất kho',
    description:
      'Nếu hàng đã ra khỏi kho thì phải thu hồi. Hãy xem lý do trong bản ghi gửi thất bại. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  another: 'Lệnh tiếp theo',
};
