import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-06 입하 오류 등록. 고칠 수 없다는 것을 누르기 전에 묻는다. */
export const inboundVariance: Translated<typeof ko.inboundVariance> = {
  title: 'Đăng ký sai lệch nhập hàng',
  record: 'Sai lệch nhập hàng',
  receipt: {
    legend: 'Lần nhập hàng cần ghi',
    searchLabel: 'Tìm số nhập hàng',
    searchPlaceholder: 'Hãy ghi một phần số nhập hàng',
    loading: 'Đang tải lần nhập hàng',
    loadFailed: 'Không xác nhận được lần nhập hàng. Hãy kiểm tra kết nối.',
    none: 'Không tìm thấy lần nhập hàng',
    pickLabel: 'Chọn lần nhập hàng',
    pickPlaceholder: 'Hãy chọn lần nhập hàng',
    linesLoading: 'Đang tải các dòng nhập hàng',
    linesLoadFailed: 'Không xác nhận được các dòng nhập hàng',
    linesNone: 'Lần nhập hàng này không có dòng nào',
    lineLabel: (no: number, qty: string) => `Dòng ${String(no)} · Thực nhận ${qty}`,
    lineNo: (no: number) => `Dòng ${String(no)}`,
    lineQty: (qty: string) => `Thực nhận ${qty}`,
    linePicked: 'Đã chọn',
    chosen: (no: number, qty: string) => `Dòng đã chọn ${String(no)} · Thực nhận ${qty}`,
    change: 'Chọn đối tượng khác',
    itemLoadFailed: 'Không xác nhận được mặt hàng',
  },
  known: {
    legend: 'Sai lệch đã ghi',
    loading: 'Đang tải sai lệch đã ghi',
    loadFailed: 'Không xác nhận được sai lệch đã ghi',
    none: 'Dòng này chưa có sai lệch nào được ghi',
    item: (type: string, qty: string) => `${type} ${qty}`,
    pending: (count: number) => `${String(count)} sai lệch đang chờ gửi`,
  },
  form: {
    legend: 'Nội dung sai lệch',
    typeLabel: 'Loại sai lệch',
    typePlaceholder: 'Hãy chọn loại',
    typeLoadFailed: 'Không tải được loại sai lệch',
    qtyLabel: 'Số lượng liên quan',
    qtyNote: 'Thiếu hay thừa đều ghi bằng số dương',
    empty: 'Hãy ghi số lượng liên quan',
    notNumber: 'Hãy ghi số lượng liên quan bằng chữ số',
    notPositive: 'Số lượng liên quan phải lớn hơn 0',
    reasonLabel: 'Lý do',
    reasonPlaceholder: 'Hãy chọn lý do',
    reasonOptional: 'Lý do có thể để trống',
    reasonLoadFailed: 'Không tải được lý do',
    noExpectedQty: 'Không có số lượng dự kiến nên không đối chiếu được chênh lệch',
  },
  confirm: {
    title: 'Đăng ký rồi thì không sửa được',
    body: 'Sai lệch nhập hàng sau khi đăng ký không sửa hay xóa được. Vẫn tiếp tục chứ?',
    cancel: 'Quay lại',
    proceed: 'Đăng ký',
  },
  submit: 'Đăng ký sai lệch',
  sent: {
    title: 'Đã đăng ký sai lệch nhập hàng',
    description:
      'Đang chờ người phụ trách xác nhận. Trả hàng hay hủy bỏ không quyết ở màn hình này.',
  },
  queued: {
    title: 'Đã đưa sai lệch nhập hàng vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Hiện chưa gửi.',
  },
  rejected: {
    title: 'Không gửi được sai lệch nhập hàng',
    description: 'Hãy xem lý do trong bản ghi gửi thất bại. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  saveFailed: {
    title: 'Không lưu được sai lệch',
    description: 'Chưa được đăng ký. Hãy thử lại.',
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  another: 'Sai lệch tiếp theo',
};
