import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-02-02 수리 왕복 스캔. 반출까지가 이 화면의 몫이라는 것을 끝에 적는다. */
export const repairRoundtrip: Translated<typeof ko.repairRoundtrip> = {
  title: 'Quét đưa vào và lấy ra sửa chữa',
  tabs: {
    dispatch: 'Đưa vào sửa chữa',
    return: 'Lấy ra khỏi sửa chữa',
  },
  offline: {
    title: 'Phải có kết nối mới làm được',
    description: 'Đưa vào và lấy ra sửa chữa chỉ ghi được khi có kết nối. Hãy kiểm tra kết nối.',
    duringWork: 'Đã mất kết nối. Phần đã quét vẫn còn, hãy làm tiếp khi có kết nối.',
  },
  scan: {
    label: 'Quét LOT lỗi',
    placeholder: 'Hãy quét nhãn LOT lỗi',
    loading: 'Đang tìm LOT',
    loadFailed: 'Không xác nhận được LOT. Hãy kiểm tra kết nối rồi quét lại.',
    notFound: (code: string) => `Không tìm thấy LOT ${code}`,
    manualLabel: 'Nhập tay',
    manualSubmit: 'Tìm theo giá trị đã nhập',
  },
  defect: {
    legend: 'Thông tin lỗi',
    loading: 'Đang tải bản ghi lỗi',
    loadFailed: 'Không xác nhận được bản ghi lỗi. Hãy kiểm tra kết nối rồi quét lại.',
    none: (lotNo: string) => `Đây không phải LOT bị đánh giá là lỗi — đã đọc ${lotNo}`,
    window: (days: number) => `Đã tìm trong ${String(days)} ngày gần đây`,
    pick: 'Hãy chọn lỗi cần sửa',
    qty: (qty: string, uom: string) => `Lỗi ${qty} ${uom}`,
    picked: 'Đã chọn',
    code: (code: string, name: string) => `${code} ${name}`,
    unknownCode: 'Không xác nhận được mã lỗi',
    detectedAt: (at: string) => `Phát hiện ${at}`,
  },
  qty: {
    label: 'Số lượng sửa chữa',
    empty: 'Hãy ghi số lượng sửa chữa',
    notNumber: 'Hãy ghi số lượng sửa chữa bằng chữ số',
    notPositive: 'Số lượng sửa chữa phải lớn hơn 0',
    overDefect: (limit: string) => `Số lượng sửa chữa không được vượt số lượng lỗi ${limit}`,
  },
  dispatch: {
    submit: 'Đăng ký đưa vào',
    already: 'Đã được đưa vào sửa chữa rồi',
    alreadyAt: (at: string) => `Đưa vào ${at}`,
    done: 'Đã ghi nhận việc đưa vào sửa chữa',
    failed: 'Không ghi nhận được việc đưa vào sửa chữa. Hãy thử lại.',
  },
  return: {
    legend: 'Kết quả sửa chữa',
    submit: 'Đăng ký lấy ra',
    succeeded: 'Sửa được',
    failed: 'Không sửa được',
    noOpen: 'Không có bản ghi đưa vào sửa chữa',
    needScan: 'Hãy quét LOT lỗi trước',
    done: 'Đã ghi nhận việc lấy ra khỏi sửa chữa',
    afterNote: 'Việc đưa hàng đã sửa vào lại không làm ở màn hình này',
    error: 'Không ghi nhận được việc lấy ra khỏi sửa chữa. Hãy thử lại.',
  },
  open: {
    legend: (count: number) => `Đang sửa ${String(count)} lượt`,
    caption: 'Các lượt sửa chữa chưa lấy ra',
    none: 'Không có lượt sửa chữa nào đang mở',
    loadFailed: 'Không xác nhận được các lượt đang sửa',
    picked: 'Đã chọn',
    columns: {
      qty: 'Số lượng',
      startedAt: 'Đưa vào',
    },
  },
  noWorker: 'Xác nhận mã nhân viên rồi mới ghi được',
};
