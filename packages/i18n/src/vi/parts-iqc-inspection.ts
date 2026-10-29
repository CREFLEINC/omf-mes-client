import type { ko } from '../ko';
import type { Translated } from './translated';

/** Kiểm tra đầu vào IQC cho nhà máy linh kiện (omf-all-around#211). */
export const partsIqcInspection: Translated<typeof ko.partsIqcInspection> = {
  title: 'IQC (kiểm tra đầu vào) tra cứu · đánh giá',
  breadcrumbRoot: 'Quản lý chất lượng',
  plant: 'Nhà máy',

  dialog: {
    title: 'Kiểm tra đầu vào IQC',
    loading: 'Đang tải thông tin kiểm tra.',
    loadFailed: 'Không tải được thông tin kiểm tra.',
    noPlan:
      'Vật tư này chưa có tiêu chuẩn kiểm tra nên không thể nhập kết quả. Hãy xác nhận tiêu chuẩn kiểm tra trước.',
    confirmed: (judgment: string) => `Kiểm tra đã được xác nhận — Phán định: ${judgment}`,
    workerMissing:
      'Tài khoản này chưa liên kết với công nhân nên không xác định được người kiểm tra. Hãy yêu cầu quản trị viên liên kết.',
    discardConfirm: 'Nội dung đã nhập sẽ không được lưu. Đóng kiểm tra này?',
  },

  target: {
    heading: 'Đối tượng kiểm tra',
    change: 'Đổi',
    itemCode: 'Mã vật tư',
    itemName: 'Tên vật tư',
    plan: 'Tiêu chuẩn kiểm tra',
    planName: 'Model',
    condition: 'Điều kiện kiểm tra',
    conditionAql: (aql: number) => `AQL ${String(aql)} · kiểm tra bằng mắt`,
    sample: 'Số mẫu',
    sampleValue: (n: number, c: number) => `Mẫu n=${String(n)}, C=${String(c)}`,
    dimensionCount: 'Hạng mục kích thước',
    xrf: 'XRF',
    xrfRequired: 'Cần',
    xrfNone: 'Không áp dụng',
    inspector: 'Người kiểm tra',
  },

  lot: {
    heading: 'Thông tin LOT',
    supplier: 'Nhà cung cấp',
    lotNo: 'Số LOT',
    qty: 'Số lượng LOT',
    receivedAt: 'Thời gian nhập kho',
    inspectedAt: 'Thời gian kiểm tra',
    inspectedTime: 'Giờ kiểm tra',
    inspectedHour: 'Giờ kiểm tra (giờ)',
    inspectedMinute: 'Giờ kiểm tra (phút)',
    hourHead: 'Giờ',
    minuteHead: 'Phút',
    timePlaceholder: 'Chọn giờ',
  },

  dimension: {
    heading: 'Đo kích thước',
    progress: (done: number, total: number) => `${String(done)}/${String(total)} hạng mục`,
    item: 'Hạng mục',
    spec: 'Quy cách',
    sample: (n: number) => `n${String(n)}`,
    judgment: 'Phán định',
    cell: (seq: number, n: number) => `Giá trị đo hạng mục ${String(seq)} n${String(n)}`,
    state: { err: 'Ngoài quy cách', empty: 'Chưa nhập', wait: 'Nhập chưa đủ', done: 'Hoàn thành' },
    none: 'Không có hạng mục đo',
  },

  drawing: {
    heading: 'Bản vẽ tiêu chuẩn',
    alt: (n: number) => `Bản vẽ tiêu chuẩn kiểm tra ${String(n)}`,
    none: 'Chưa có bản vẽ',
  },

  visual: {
    heading: 'Kiểm tra ngoại quan · XRF',
    inspectedQty: 'Số lượng kiểm tra ngoại quan',
    defectQty: 'Số lượng lỗi ngoại quan',
    unit: 'cái',
    xrfResult: 'Kết quả XRF',
    xrf: { NOT_DONE: 'Chưa thực hiện', OK: 'OK', NG: 'NG' },
    xrfReport: 'Báo cáo XRF',
    pickFile: 'Đính kèm tệp',
    clearFile: 'Bỏ tệp',
    defectType: 'Loại lỗi ngoại quan',
    defectPick: 'Nên chọn',
    defectPicked: (n: number) => `${String(n)} loại`,
    defectQtyRequired: 'Nhập số lượng lỗi cho từng loại.',
    defectSumMismatch: (n: number) => `Tổng số lượng theo loại phải bằng ${String(n)}.`,
    noFile: 'Chưa có tệp đính kèm',
    defectTypeHint: 'Chọn ít nhất một loại lỗi.',
    defectCodesEmpty: 'Chưa có loại lỗi nào. Hãy đăng ký trong Mã lỗi · nguyên nhân trước.',
    defectCodesFailed: 'Không tải được loại lỗi.',
    checks: 'Hạng mục kiểm tra khác',
    checkCount: (n: number) => `${String(n)} hạng mục`,
    checkNo: 'No.',
    checkItem: 'Hạng mục kiểm tra',
    remarks: 'Ghi chú',
    remarksPlaceholder: 'Nhập ghi chú',
    xrfChoice: { NOT_DONE: 'Chưa thực hiện', OK: 'Đạt', NG: 'Không đạt' },
    xrfState: { NOT_DONE: 'XRF chưa thực hiện', OK: 'XRF đạt', NG: 'XRF không đạt' },
    invalidQty: 'Nhập số nguyên từ 0 trở lên.',
    overQty: 'Không được lớn hơn số lượng kiểm tra ngoại quan.',
  },

  verdict: {
    heading: 'Phán định',
    suggested: 'Kết quả phán định tự động',
    pending: 'Nhập các hạng mục kiểm tra rồi xem kết quả phán định.',
    waiting: 'Chờ phán định',
    overall: 'Phán định tổng',
    rejectedQty: (qty: number) => `(Số lượng lỗi ${String(qty)})`,
    reason: 'Lý do thay đổi phán định',
    reasonHint: 'Nhập lý do nếu xác nhận khác với phán định tự động.',
  },

  judgment: { ACCEPTED: 'Đạt', REJECTED: 'Không đạt', HELD: 'Giữ lại' },
  requestStatus: { REQUESTED: 'Chờ kiểm tra', IN_PROGRESS: 'Đang kiểm tra' },
  ok: 'OK',
  ng: 'NG',

  footer: {
    undo: 'Hoàn tác',
    redo: 'Làm lại',
    clear: 'Xóa trắng',
    review: 'Xem lại',
    summaryDimension: (all: number, out: number, missing: number) =>
      `Kích thước ${String(all)} hạng mục: ngoài quy cách ${String(out)} · chưa nhập ${String(missing)}`,
    summaryVisual: (defects: number, xrf: string) =>
      `Lỗi ngoại quan ${String(defects)} · XRF ${xrf}`,
    submit: 'Gửi',
    submitting: 'Đang gửi…',
    submitted: 'Đã xác nhận kết quả kiểm tra.',
    confirmSubmit: (judgment: string) => `Xác nhận là ${judgment} — không thể hoàn tác`,
  },
};
