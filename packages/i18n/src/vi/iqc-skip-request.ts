import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-13 긴급 IQC 생략 요청. 요청만 한다는 것을 먼저 말한다. */
export const iqcSkipRequest: Translated<typeof ko.iqcSkipRequest> = {
  title: 'Yêu cầu bỏ kiểm tra đầu vào khẩn',
  record: 'Yêu cầu bỏ kiểm tra đầu vào khẩn',
  lot: {
    legend: 'Vật tư nào',
    scanLabel: 'Quét LOT nhập hàng',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Đưa vào',
    scanPlaceholder: 'Hãy quét nhãn LOT',
    loading: 'Đang tìm LOT',
    loadFailed: 'Không xác nhận được LOT',
    notFound: (code: string) => `Không tìm thấy LOT ${code}`,
    pending: 'Đang chờ kiểm tra đầu vào',
    notPending: 'Vật tư đã kiểm tra xong',
    quantity: (qty: string, uom: string) => `${qty} ${uom}`,
    alreadyRequested: (at: string) => `Đã có yêu cầu được gửi (${at})`,
  },
  reason: {
    legend: 'Vì sao khẩn',
    label: 'Lý do',
    placeholder: 'Sắp dừng chuyền · Không có vật tư thay thế',
    hint: 'Người duyệt chỉ nhìn lý do này để quyết định.',
    required: 'Hãy ghi lý do',
  },
  expectation: 'Phải được duyệt mới dùng được. Không đưa vào sản xuất ngay.',
  submit: 'Gửi yêu cầu',
  saveFailed: {
    title: 'Không lưu được yêu cầu',
    description: 'Chưa được yêu cầu. Hãy thử lại.',
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  sent: {
    title: 'Đã gửi yêu cầu',
    description: 'Hãy xem kết quả duyệt ở danh sách bên dưới.',
  },
  queued: {
    title: 'Đã đưa yêu cầu vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Hiện chưa đến tay ai.',
    urgent: 'Nếu gấp, hãy báo thêm qua điện thoại.',
    waiting: (count: number) => `${String(count)} yêu cầu đang chờ — sẽ gửi khi có kết nối`,
  },
  rejected: {
    title: 'Không gửi được yêu cầu',
    description: 'Đã gửi nhưng không được đăng ký. Hiện chưa đến tay ai.',
    action: 'Xem bản ghi gửi thất bại',
  },
  noRoute: 'Không có luồng duyệt nên không gửi yêu cầu được. Hãy hỏi bộ phận tin học.',
  another: 'Yêu cầu cho vật tư khác',
  mine: {
    legend: 'Yêu cầu tôi đã gửi',
    loading: 'Đang tải',
    loadFailed: 'Hiện chưa làm mới được. Sẽ làm mới khi có kết nối.',
    empty: 'Chưa gửi yêu cầu nào.',
    noWorker: 'Xác nhận mã nhân viên sẽ thấy',
    requestedAt: (at: string) => `Gửi lúc ${at}`,
  },
};
