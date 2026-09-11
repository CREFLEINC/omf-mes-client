import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-10 재고 이동. 반출과 도착 사이에 남은 이동을 먼저 보인다. */
export const stockTransfer: Translated<typeof ko.stockTransfer> = {
  title: 'Chuyển tồn kho',
  record: {
    shipped: 'Chuyển tồn kho - xuất đi',
    arrived: 'Chuyển tồn kho - đã đến',
  },
  unfinished: {
    legend: 'Lượt chuyển còn chờ đến nơi',
    loading: 'Đang tìm lượt chuyển còn chờ đến nơi',
    loadFailed: 'Không xác nhận được lượt chuyển còn chờ đến nơi. Hãy kiểm tra kết nối.',
    none: 'Không có lượt chuyển nào còn chờ đến nơi',
    item: (no: string, count: number) => `${no} · ${String(count)} dòng`,
    resume: 'Làm tiếp',
    offline: 'Không có kết nối nên không thấy lượt chuyển do máy khác xuất đi.',
  },
  type: {
    legend: 'Loại chuyển',
    normal: 'Chuyển thường',
    defect: 'Xuất hàng lỗi',
  },
  from: {
    legend: 'Quét xuất đi',
    scanLabel: 'Quét LOT xuất đi',
    scanPlaceholder: 'Hãy quét mã QR của LOT',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Đưa vào',
    loading: 'Đang tải LOT',
    notFound: (code: string) => `Không tìm thấy LOT ${code}`,
    loadFailed: 'Không xác nhận được LOT. Hãy kiểm tra kết nối.',
    already: 'LOT này đã được thêm',
    noStock: 'LOT này không còn tồn kho để chuyển',
    unknownBusinessUnit: 'Không xác nhận được đơn vị kinh doanh của chỗ này',
    unknownBusinessUnitWhy:
      'Vẫn còn tồn kho. Phải có thông tin kho mới chuyển được, hãy báo quản trị viên.',
    mixedWarehouse: 'Không chuyển cùng lúc LOT của các kho khác nhau. Hãy tách theo từng kho.',
    name: (item: string, lotNo: string) => (item === '' ? lotNo : `${item} · ${lotNo}`),
    onHand: (qty: string) => `Tồn kho ${qty}`,
    qtyLabel: (name: string) => `Số lượng xuất đi của ${name}`,
    remove: 'Bỏ ra',
    problem: {
      notNumber: 'Hãy ghi số lượng bằng chữ số',
      notPositive: 'Số lượng phải lớn hơn 0',
      overStock: (limit: string) => `Không được vượt tồn kho ${limit}`,
    },
  },
  hold: {
    title: (numbers: string) => `${numbers} là LOT đang bị tạm giữ`,
    description: 'Vẫn chuyển được. Lý do tạm giữ do bộ phận chất lượng gỡ.',
  },
  to: {
    legend: 'Quét nơi đến',
    warehouseLabel: 'Kho đến',
    warehousePlaceholder: 'Hãy chọn kho',
    scanLabel: 'Quét vị trí đến',
    scanPlaceholder: 'Hãy quét mã QR của vị trí',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Đưa vào',
    loading: 'Đang tải vị trí',
    notFound: (code: string) => `Không tìm thấy vị trí ${code}`,
    picked: (code: string) => `Vị trí đến ${code}`,
    sameWarehouse: 'Chuyển vị trí trong cùng một kho hiện chưa làm được ở màn hình này.',
  },
  submitShip: 'Ghi nhận xuất đi',
  submitArrive: 'Xong chuyển kho',
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  noLine: 'Hãy quét LOT cần xuất đi và ghi số lượng',
  noDestination: 'Hãy quét vị trí đến',
  saveFailed: {
    title: 'Không lưu được lượt chuyển',
    description: 'Chưa được ghi nhận. Hãy thử lại.',
  },
  shipped: {
    title: 'Đã ghi nhận xuất đi',
    description: 'Đặt hàng vào vị trí đến rồi quét nơi đến để kết thúc lượt chuyển.',
  },
  sent: {
    title: 'Đã xong lượt chuyển',
  },
  held: {
    title: 'Đã đưa lượt chuyển vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Xuất đi và đến nơi sẽ gửi theo đúng thứ tự.',
  },
  rejected: {
    title: 'Không gửi được lượt chuyển',
    description: 'Hãy xem lý do trong bản ghi gửi thất bại. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  another: 'Lượt chuyển tiếp theo',
};
