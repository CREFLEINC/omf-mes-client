import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-05-02 설비 고장 보고. 못 간 보고는 사람이 기다리므로 그 사실을 이름으로 적는다. */
export const equipmentFailureReport: Translated<typeof ko.equipmentFailureReport> = {
  title: 'Báo hỏng thiết bị',
  equipment: {
    legend: 'Thiết bị',
    scanLabel: 'Quét thiết bị',
    scanPlaceholder: 'Hãy quét mã QR thiết bị',
    pickLabel: 'Chọn từ danh sách',
    pickPlaceholder: 'Hãy chọn thiết bị',
    loading: 'Đang tải danh sách thiết bị',
    loadFailed: 'Không tải được danh sách thiết bị',
    notFound: (code: string) => `Không tìm thấy thiết bị ${code}`,
    openBreakdowns: (count: number) =>
      `Thiết bị này đang có ${String(count)} sự cố chưa xử lý xong`,
    location: (name: string) => `Vị trí ${name}`,
    locationUnknown: 'Không xác nhận được vị trí',
  },
  symptom: {
    legend: 'Hiện tượng',
    label: 'Hiện tượng',
    placeholder: 'Rò dầu thủy lực · Phía dưới xy lanh',
    hint: 'Hãy ghi một dòng cho biết cái gì bị làm sao.',
    required: 'Hãy ghi hiện tượng',
    recentLegend: 'Hiện tượng đã ghi lần trước cho thiết bị này',
  },
  photo: {
    legend: 'Ảnh',
    take: (count: number, max: number) => `Chụp (${String(count)}/${String(max)})`,
    thumbnail: 'Ảnh đã chụp',
    full: 'Kèm được tối đa ba ảnh.',
    tooHeavy: 'Còn nhiều ảnh chưa gửi nên hiện chưa chụp thêm được.',
    failed: 'Không lấy được ảnh',
    waiting: (count: number) => `Sẽ gửi kèm ${String(count)} ảnh.`,
  },
  state: {
    legend: 'Tình trạng khi xảy ra',
    label: 'Tình trạng khi xảy ra',
    stopped: 'Thiết bị đã dừng',
    abnormal: 'Vẫn chạy nhưng bất thường',
    downtimeNotice: 'Sản lượng ngừng máy được nhập riêng ở POP.',
    stoppedAtLabel: 'Giờ dừng',
    stoppedAtHint: 'Không rõ thì để trống.',
  },
  notify: {
    legend: 'Thông báo',
    label: 'Báo cho người phụ trách thiết bị',
    offline: 'Sẽ báo khi có kết nối. Nếu gấp, hãy liên hệ trực tiếp.',
  },
  unsent: (count: number) =>
    `${String(count)} báo hỏng chưa gửi — chưa gọi được người phụ trách thiết bị`,
  unsentHint: 'Nếu gấp, hãy liên hệ trực tiếp.',
  record: {
    report: 'Báo hỏng thiết bị',
    photo: 'Ảnh sự cố',
  },
  submit: 'Báo hỏng',
  saveFailed: {
    title: 'Không lưu được báo hỏng',
    description: 'Chưa được báo. Hãy thử lại.',
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  queued: {
    title: 'Đã đưa báo hỏng vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Chưa đến tay người phụ trách thiết bị.',
  },
  sent: {
    title: 'Đã báo hỏng',
  },
  rejected: {
    title: 'Không gửi được báo hỏng',
    description: 'Đã gửi nhưng không được đăng ký. Chưa đến tay người phụ trách thiết bị.',
    action: 'Xem bản ghi gửi thất bại',
  },
  another: 'Báo hỏng khác',
};
