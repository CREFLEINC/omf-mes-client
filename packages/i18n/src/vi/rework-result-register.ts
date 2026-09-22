import type { ko } from '../ko';
import type { Translated } from './translated';

export const reworkResultRegister: Translated<typeof ko.reworkResultRegister> = {
  title: 'Đăng ký kết quả làm lại',
  workOrders: 'W/O làm lại',
  empty: 'Không có W/O làm lại cần tiến hành.',
  loadError: 'Không tải được thông tin làm lại.',
  selectWorkOrder: 'Hãy chọn W/O làm lại.',

  headerContext: (workOrderNo: string, itemCode: string): string => `${workOrderNo} · ${itemCode}`,
  workOrderUnknown: 'W/O —',

  workerLabel: (workerNo: string): string => `Mã nhân viên ${workerNo}`,
  workerUnknown: 'Mã nhân viên —',
  changeWorkOrder: 'Đổi',
  workOrderCaption: 'Lệnh sản xuất làm lại có thể tiến hành',
  pageNav: 'Chuyển trang danh sách lệnh sản xuất làm lại',
  columns: {
    workOrder: 'Lệnh sản xuất',
    item: 'Mặt hàng',
    quantity: 'Số lượng',
  },
  /** 배포 전 표식 — 있다는 사실만 알린다(omf-all-around#47). */
  notReleased: 'Hãy phát đi trước',
  selectRow: (workOrderNo: string): string => `Chọn ${workOrderNo}`,
  target: 'Đối tượng làm lại',
  sourceLot: 'LOT gốc',
  nonconformance: 'Căn cứ',
  disposition: 'Quyết định xử lý',

  sourceLotValue: (lotNo: string, qty: string, uom: string): string =>
    uom === '' ? `${lotNo} ${qty}` : `${lotNo} ${qty} ${uom}`,
  nonconformanceValue: (no: string, description: string): string =>
    `Không phù hợp ${no} · ${description}`,
  dispositionValue: (qty: string, uom: string, decidedOn: string): string =>
    `Làm lại ${uom === '' ? qty : `${qty} ${uom}`} (${decidedOn})`,
  unknown: 'Đang kiểm tra',
  quantities: {
    title: 'Nhập kết quả',
    keypadLabel: 'Bàn phím số lượng',
    /**
     * ⭐ 키패드를 «상시» 두지 않는 것은 스펙 §3 ②가 그 자리를 그리지 않았기 때문이다.
     * 도면은 구획 전체 폭을 입력 칸이 쓰고 280px 로 검산돼 있다 — 키패드를 옆에 붙이면
     * 그 예산이 성립하지 않는다(사용자 결정 2026-09-07).
     */
    keypadDone: 'Xác nhận',
    keypadCancel: 'Hủy',
    backspace: 'Xóa một ký tự',
    clearGlyph: 'Xóa',
    decimalKey: 'Dấu thập phân',
    goodQty: 'Hàng đạt',
    defectQty: 'Lỗi',
    holdQty: 'Tạm giữ',
    scrapQty: 'Hủy',
  },
  total: 'Tổng',
  remaining: 'Chưa xử lý',

  resultLot: {
    title: 'LOT kết quả',
    good: (qty: string): string => `Hàng đạt ${qty} → giữ LOT gốc`,
    keep: 'Không tạo LOT mới.',
    rest: (defect: string, hold: string): string =>
      `Lỗi ${defect} · tạm giữ ${hold} → vẫn ở LOT gốc, chỉ đổi trạng thái`,
  },

  progress: {
    title: 'Tiến độ',
    line: (done: string, target: string): string => `Làm lại W/O này ${done} / ${target}`,
  },
  emptyQuantity: 'Hãy nhập ít nhất một số lượng.',
  exceeded: (target: number) => `Không được vượt số lượng xử lý ${target}.`,
  partial: (remaining: number) => `Đây là kết quả một phần. Còn ${remaining} chưa xử lý.`,
  reworkHint: 'Làm lại xong mà vẫn lỗi thì nhập vào lỗi, không phải số lượng làm lại.',
  lotHint: 'Kết quả vẫn ở LOT gốc, không tạo LOT mới.',
  defectCode: 'Mã lỗi',
  defectCodePlaceholder: 'Không chọn được',
  defectCodeReason: 'Nếu có lỗi, hãy nhập mã lỗi.',
  defectCodeLoadFailed: 'Không tải được mã lỗi. Vẫn có thể lưu mà không cần mã.',
  defectCodeEmpty: 'Chưa có mã lỗi nào được đăng ký. Vẫn có thể lưu mà không cần mã.',
  defectCodeRetry: 'Tải lại',
  reset: 'Nhập lại',
  save: 'Lưu kết quả',
  queued: 'Đã lưu kết quả.',
  queueError: 'Không lưu được kết quả vào máy trạm. Hãy thử lại.',
  rejected: 'Máy chủ không nhận kết quả. Hãy kiểm tra nội dung đã nhập.',
  gateUnidentified: 'Chưa xác nhận máy trạm và công đoạn nên không lưu được.',
  gateChecking: 'Đang kiểm tra chức năng máy trạm.',
  gateDenied: 'Máy trạm này không nhập kết quả được.',
  gateUnavailable: 'Không kiểm tra được chức năng máy trạm nên không lưu được.',
  pending: (count: number) => `Chờ gửi ${count} mục`,
};
