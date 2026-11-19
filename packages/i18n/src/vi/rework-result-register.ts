import type { ko } from '../ko';
import type { Translated } from './translated';

export const reworkResultRegister: Translated<typeof ko.reworkResultRegister> = {
  title: 'Đăng ký kết quả làm lại',
  workOrders: 'Lệnh sản xuất làm lại',
  empty: 'Không có lệnh sản xuất làm lại cần tiến hành.',
  loadError: 'Không tải được thông tin làm lại.',
  selectWorkOrder: 'Hãy chọn W/O làm lại.',
  pickTitle: 'Hãy chọn lệnh sản xuất làm lại',
  pickHint: 'Chọn ở danh sách bên trái để nhập kết quả.',

  workOrderUnknown: 'W/O —',

  workerLabel: (workerNo: string): string => `Mã nhân viên ${workerNo}`,
  workerUnknown: 'Mã nhân viên —',
  pageNav: 'Chuyển trang danh sách lệnh sản xuất làm lại',
  list: {
    item: 'Mặt hàng',
    qty: 'Số lượng',
    status: 'Trạng thái',
    disposition: 'Xử lý',
    sourceLot: 'LOT gốc',
    nonconformance: 'Không phù hợp',
    progress: 'Làm lại',
    reworkChip: 'Làm lại',
    plannedChip: 'Chưa phát',
  },
  /** 배포 전 표식 — 있다는 사실만 알린다(omf-all-around#47). */
  notReleased: 'Hãy phát lệnh trước',
  sourceLot: 'LOT gốc',
  nonconformance: 'Căn cứ',
  disposition: 'Xử lý',

  sourceLotValue: (lotNo: string, qty: string, uom: string): string =>
    uom === '' ? `${lotNo} ${qty}` : `${lotNo} ${qty} ${uom}`,
  nonconformanceValue: (no: string, description: string): string =>
    `Không phù hợp ${no} · ${description}`,
  dispositionValue: (qty: string, uom: string, decidedOn: string): string =>
    `Làm lại ${uom === '' ? qty : `${qty} ${uom}`} (${decidedOn})`,
  qtyWithUom: (qty: string, uom: string): string => (uom === '' ? qty : `${qty} ${uom}`),
  progressValue: (done: string, target: string, uom: string): string =>
    uom === '' ? `${done} / ${target}` : `${done} / ${target} ${uom}`,
  unknown: 'Đang kiểm tra',
  steps: {
    label: 'Các bước làm lại',
    input: 'Nhập kết quả',
    defect: 'Ghi lỗi',
  },
  quantities: {
    goodQty: 'Hàng đạt',
    defectQty: 'Số lượng lỗi',
    holdQty: 'Tạm giữ',
    scrapQty: 'Hủy bỏ',
  },
  keypad: {
    title: 'Nhập',
    unit: (uom: string): string => `Đơn vị ${uom}`,
  },
  total: 'Tổng',
  emptyQuantity: 'Hãy nhập kết quả.',
  exceeded: (target: number, uom: string) =>
    uom === ''
      ? `Không được vượt số lượng xử lý ${target}.`
      : `Không được vượt số lượng xử lý ${target} ${uom}.`,
  partial: (remaining: number, uom: string) =>
    uom === ''
      ? `Kết quả một phần. Còn ${remaining} chưa xử lý.`
      : `Kết quả một phần. Còn ${remaining} ${uom} chưa xử lý.`,
  helpTitle: 'Hướng dẫn nhập kết quả làm lại',
  reworkHint: 'Chỉ nhập số lượng vẫn còn lỗi sau khi làm lại.',
  lotHint: 'Kết quả làm lại được ghi vào LOT hiện có, không tạo LOT mới.',
  helpConfirm: 'Xác nhận',
  defectCode: 'Mã lỗi',
  defectCodePlaceholder: 'Hãy chọn mã lỗi',
  defectCodeLoadFailed: 'Không tải được mã lỗi. Vẫn có thể lưu mà không cần mã.',
  defectCodeEmpty: 'Chưa có mã lỗi · lưu được không cần mã',
  defectCodeRetry: 'Tải lại',
  reset: 'Xóa nhập',
  toDefect: 'Ghi lỗi',
  toDefectWithQty: (qty: string): string => `Ghi lỗi (${qty})`,
  prev: 'Trước',
  save: 'Lưu kết quả',
  queued: 'Đã lưu kết quả.',
  queueError: 'Không lưu được kết quả vào máy trạm. Hãy thử lại.',
  rejected: 'Máy chủ không nhận kết quả.',
  rejectedHint:
    'Hãy kiểm tra số lượng đã nhập và lệnh sản xuất đã chọn rồi lưu lại. Nếu lặp lại, hãy báo quản trị viên.',
  gateUnidentified:
    'Chưa xác nhận được máy hoặc công đoạn của lệnh sản xuất đã chọn nên không lưu được. Hãy mở lại màn hình rồi chọn lại lệnh sản xuất.',
  gateChecking: 'Đang kiểm tra chức năng máy trạm.',
  gateUnavailable: 'Không kiểm tra được chức năng máy trạm nên không lưu được.',
  pending: (count: number) => `Chờ gửi ${count} mục`,
};
