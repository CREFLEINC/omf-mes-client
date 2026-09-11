import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-11 실물 카운트. 0 과 빈칸이 다르다는 것이 이 화면의 핵심이다. */
export const physicalCount: Translated<typeof ko.physicalCount> = {
  title: 'Đếm thực tế',
  record: {
    counted: 'Đếm thực tế',
  },
  plan: {
    legend: 'Chọn đợt kiểm kê',
    loading: 'Đang tìm đợt kiểm kê đang chạy',
    loadFailed: 'Không tải được danh sách kiểm kê. Hãy kiểm tra kết nối.',
    none: 'Không có đợt kiểm kê nào đang chạy',
    pick: 'Đợt kiểm kê',
    pickPlaceholder: 'Hãy chọn đợt kiểm kê',
    item: (no: string, date: string) => `${no} · ${date}`,
    blind: 'Đợt kiểm kê này ẩn số lượng sổ sách. Hãy đếm thực tế rồi ghi.',
  },
  location: {
    legend: 'Quét vị trí',
    scanLabel: 'Quét vị trí',
    scanPlaceholder: 'Hãy quét mã QR vị trí',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Đưa vào',
    loading: 'Đang tải các dòng của vị trí này',
    loadFailed: 'Không tải được các dòng. Hãy kiểm tra kết nối.',
    notFound: (code: string) => `Không tìm thấy vị trí ${code}`,
    picked: (code: string) => `Vị trí ${code}`,
    empty:
      'Vị trí này không có dòng kiểm kê nào. Hàng không có trong sổ sách được thêm ở Web quản trị.',
  },
  lines: {
    legend: 'Số lượng thực tế',
    name: (item: string, lotNo: string) => [item, lotNo].filter((part) => part !== '').join(' · '),
    qtyLabel: (name: string) => `Số lượng thực tế của ${name}`,
    systemQty: (qty: string) => `Sổ sách ${qty}`,
    already: (qty: string) => `Giá trị trước ${qty}`,
    uncounted: 'Chưa đếm',
    problem: {
      notNumber: 'Hãy ghi số lượng bằng chữ số',
      negative: 'Số lượng không được nhỏ hơn 0',
    },
    zeroHint: 'Nếu không có hàng thực tế thì ghi 0. Để trống nghĩa là chưa đếm.',
  },
  submit: 'Xong vị trí này',
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  saveFailed: {
    title: 'Không lưu được số đã đếm',
    description: 'Chưa được ghi nhận. Hãy thử lại.',
  },
  sent: {
    title: 'Đã xong vị trí này',
  },
  held: {
    title: 'Đã đưa số đã đếm vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối.',
  },
  rejected: {
    title: 'Không gửi được số đã đếm',
    description: 'Hãy xem lý do trong bản ghi gửi thất bại. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  another: 'Vị trí tiếp theo',
};
