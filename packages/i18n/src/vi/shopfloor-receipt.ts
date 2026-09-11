import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-09 생산창고 입고. 한 출고 전표를 두 번 받지 않게 그 사실을 먼저 말한다. */
export const shopfloorReceipt: Translated<typeof ko.shopfloorReceipt> = {
  title: 'Nhập kho sản xuất',
  degraded: {
    title: 'Đang ngoại tuyến',
    description: 'Phần xuất kho cũng xử lý trên máy này. Sẽ gửi một lượt khi có kết nối.',
  },
  record: {
    received: 'Nhập kho sản xuất',
    hopper: 'Đo lượng còn lại trong phễu',
  },
  issue: {
    legend: 'Quét phiếu xuất kho',
    scanLabel: 'Quét mã QR xuất kho',
    scanPlaceholder: 'Hãy quét mã QR của phiếu xuất kho',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Đưa vào',
    loading: 'Đang tải phiếu xuất kho',
    notFound: (code: string) => `Không tìm thấy phiếu xuất kho ${code}`,
    loadFailed: 'Không mở được phiếu xuất kho. Hãy kiểm tra kết nối.',
    summary: (no: string, count: number) => `${no} · ${String(count)} dòng`,
    destination: (code: string) => `Nơi đến ${code}`,
    destinationOffline: 'Không xác nhận được vị trí đến. Hãy kiểm tra kết nối.',
    destinationUnknown:
      'Không xác nhận được vị trí đến. Không phải do kết nối, hãy báo người phụ trách.',
    empty: 'Phiếu xuất kho này không có dòng nào',
  },
  already: {
    title: 'Phiếu xuất kho này đã được nhập kho',
    description: 'Mỗi phiếu xuất kho chỉ nhận một lần. Không nhận lại được.',
  },
  unverified: {
    title: 'Chưa xác nhận được phiếu này đã nhận hay chưa',
    description: 'Hãy kiểm tra lại khi có kết nối. Nếu đã nhận rồi thì gửi nhập kho sẽ thất bại.',
  },
  queued: {
    title: 'Việc nhập kho của phiếu xuất kho này đang chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Từ giờ đến lúc đó không nhận lại.',
  },
  lines: {
    legend: 'Nhận theo dòng',
    issued: (qty: string) => `Xuất kho ${qty}`,
    receivedLabel: (item: string) => `Số lượng nhận của ${item}`,
    name: (item: string, lotNo: string) => (item === '' ? lotNo : `${item} · ${lotNo}`),
    short: (qty: string) => `Thiếu ${qty}`,
    problem: {
      notNumber: 'Hãy ghi số lượng bằng chữ số',
      negative: 'Số lượng không được nhỏ hơn 0',
      overIssued: (limit: string) => `Không nhận được nhiều hơn ${limit} đã xuất kho`,
    },
    reasonLabel: (item: string) => `Lý do chênh lệch của ${item}`,
    reasonPlaceholder: 'Hãy chọn lý do',
    reasonRequired: 'Mặt hàng bị thiếu thì phải chọn lý do',
  },
  hopper: {
    legend: 'Lượng còn lại trong phễu',
    equipmentLabel: 'Thiết bị',
    equipmentPlaceholder: 'Hãy chọn thiết bị',
    loading: 'Đang tải thiết bị',
    loadFailed: 'Không xác nhận được thiết bị. Hãy kiểm tra kết nối.',
    noHopper: 'Thiết bị này chưa được chỉ định vị trí phễu',
    at: (code: string) => `Phễu ${code}`,
    stockLoading: 'Đang tải thứ đang có trong phễu',
    stockFailed: 'Không xác nhận được lượng còn lại trong phễu. Hãy kiểm tra kết nối.',
    empty: 'Trên sổ sách phễu này không còn gì',
    onHand: (qty: string) => `Sổ sách ${qty}`,
    measuredLabel: (name: string) => `Lượng còn lại đo được của ${name}`,
    difference: (qty: string) => `Chênh lệch ${qty}`,
    problem: {
      notNumber: 'Chỉ nhập được chữ số',
      negative: 'Không được nhỏ hơn 0',
    },
    noReason: 'Chưa đăng ký lý do đo phễu nên không ghi được. Hãy hỏi quản trị viên.',
    submit: 'Ghi lượng còn lại trong phễu',
    sent: 'Đã ghi lượng còn lại trong phễu',
    queued: 'Đã đưa lượng còn lại trong phễu vào hàng chờ gửi',
    rejected: 'Không gửi được lượng còn lại trong phễu',
    saveFailed: 'Không lưu được lượng còn lại trong phễu. Chưa được ghi nhận.',
  },
  submit: 'Xác nhận nhập kho',
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  noLine: 'Hãy ghi số lượng của mặt hàng đã nhận',
  saveFailed: {
    title: 'Không lưu được việc nhập kho',
    description: 'Chưa được ghi nhận. Hãy thử lại.',
  },
  sent: {
    title: 'Đã ghi nhận nhập kho',
  },
  held: {
    title: 'Đã đưa việc nhập kho vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối.',
  },
  rejected: {
    title: 'Không gửi được việc nhập kho',
    description: 'Hãy xem lý do trong bản ghi gửi thất bại. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  another: 'Lần nhập kho tiếp theo',
};
