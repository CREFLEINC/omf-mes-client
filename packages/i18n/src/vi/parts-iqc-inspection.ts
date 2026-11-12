import type { ko } from '../ko';
import type { Translated } from './translated';

/** Kiểm tra đầu vào IQC cho nhà máy linh kiện (omf-all-around#211). */
export const partsIqcInspection: Translated<typeof ko.partsIqcInspection> = {
  title: 'IQC (kiểm tra đầu vào) tra cứu · đánh giá',
  breadcrumbRoot: 'Quản lý chất lượng',
  plant: 'Nhà máy',

  /** Lịch sử kiểm tra · nhập hôm nay (2026-10-30). */
  tabs: { input: 'Tiến hành kiểm tra', history: 'Lịch sử kiểm tra' },
  history: {
    loading: 'Đang tải lịch sử kiểm tra.',
    failed: 'Không tải được lịch sử kiểm tra.',
    empty: 'Chưa có lịch sử kiểm tra.',
    emptyHint: 'Kết quả kiểm tra sẽ được ghi ở đây sau khi lưu.',
    round: 'Lần',
    roundNo: (n: number) => `Lần ${String(n)}`,
    inspectedAt: 'Thời gian kiểm tra',
    inspector: 'Người kiểm tra',
    inspectedQty: 'SL kiểm tra',
    rejectedQty: 'SL không đạt',
    judgment: 'Phán định',
    status: 'Trạng thái',
    statusOf: { DRAFT: 'Đang nhập', CONFIRMED: 'Đã xác nhận' } as Record<string, string>,
    noMeasurements: 'Không có lịch sử kiểm tra.',
    defects: 'Loại lỗi',
  },
  today: 'Nhập hôm nay',
  todayOn: 'Đang chỉ xem hàng nhập hôm nay — bấm để tắt',
  todayOff: 'Chỉ xem các lô nhập hôm nay',

  /** Xem tiêu chuẩn kiểm tra (2026-10-30). */
  plan: {
    open: 'Xem tiêu chuẩn',
    title: 'Chi tiết tiêu chuẩn kiểm tra',
    edit: 'Sửa',
    version: 'Phiên bản',
    versionNo: (no: number) => `Bản ${String(no)}`,
    facts: {
      planCode: 'Mã tiêu chuẩn',
      planName: 'Tên model',
      effectiveFrom: 'Ngày áp dụng',
    },
    dataTypeOf: { NUMERIC: 'Số', BOOLEAN: 'Lựa chọn', TEXT: 'Văn bản' } as Record<string, string>,
    sampling: 'Phương thức kiểm tra',
    full: 'Kiểm tra toàn bộ',
    ratio: (r: number) => `${String(r)}% của LOT`,
    qty: (n: number) => `${String(n)} cái`,
    no: 'STT',
    method: 'Phương pháp',
    count: 'Số mẫu',
    acceptance: 'Số lỗi cho phép',
    okNg: 'OK / NG',
    items: 'Hạng mục kiểm tra',
    itemCount: (n: number) => `(${String(n)})`,
  },

  dialog: {
    reinspectNote: 'Khi gửi, một lượt kiểm tra mới sẽ được thêm và kết quả cũ được giữ nguyên.',
    title: 'Kiểm tra đầu vào IQC',
    loading: 'Đang tải thông tin kiểm tra.',
    loadFailed: 'Không tải được thông tin kiểm tra.',
    noPlan:
      'Vật tư này chưa có tiêu chuẩn kiểm tra nên không thể nhập kết quả. Hãy xác nhận tiêu chuẩn kiểm tra trước.',
    setPlan: 'Thiết lập tiêu chuẩn kiểm tra',
    confirmed: (judgment: string) => `Kiểm tra đã được xác nhận — Phán định: ${judgment}`,
    workerMissing:
      'Tài khoản này chưa liên kết với công nhân nên không xác định được người kiểm tra. Hãy yêu cầu quản trị viên liên kết.',
    discardConfirm: 'Nội dung đã nhập chưa được lưu. Nếu đóng kiểm tra, mọi giá trị đã nhập sẽ bị mất.',
  },

  target: {
    heading: 'Đối tượng kiểm tra',
    itemCode: 'Mã vật tư',
    itemName: 'Tên vật tư',
    plan: 'Tiêu chuẩn kiểm tra',
    planName: 'Model',
    condition: 'Điều kiện kiểm tra',
    conditionAql: (aql: number) =>
      `AQL ${Number.isInteger(aql) ? aql.toFixed(1) : String(aql)} · kiểm tra bằng mắt`,
    conditionNone: 'Chưa chỉ định',
    sample: 'Số mẫu',
    sampleValue: (n: number, c: number) => `Mẫu n=${String(n)}, C=${String(c)}`,
    dimensionCount: 'Hạng mục kích thước',
    inspector: 'Người kiểm tra',
  },

  lot: {
    heading: 'Thông tin LOT',
    supplier: 'Nhà cung cấp',
    lotNo: 'Số LOT',
    qty: 'Số lượng LOT',
    receivedAt: 'Thời gian nhập kho',
    inspectedQty: 'Số lượng kiểm tra',
    invalidInspectedQty: 'Nhập số nguyên từ 1 trở lên.',
    inspectedAt: 'Thời gian kiểm tra',
    inspectedTime: 'Giờ kiểm tra',
    inspectedHour: 'Giờ kiểm tra (giờ)',
    inspectedMinute: 'Giờ kiểm tra (phút)',
    hourHead: 'Giờ',
    minuteHead: 'Phút',
    timePlaceholder: 'Chọn giờ',
  },

  dimension: {
    heading: 'Hạng mục kiểm tra',
    progress: (done: number, total: number) => `${String(done)}/${String(total)} hạng mục`,
    item: 'No.',
    content: 'Nội dung kiểm tra',
    spec: 'Quy cách',
    sample: (n: number) => `n${String(n)}`,
    judgment: 'Phán định',
    cell: (seq: number, n: number) => `Giá trị đo hạng mục ${String(seq)} n${String(n)}`,
    state: { err: 'Ngoài quy cách', empty: 'Chưa nhập', wait: 'Nhập chưa đủ', done: 'Hoàn thành' },
    none: 'Không có hạng mục kiểm tra',
  },

  drawing: {
    heading: 'Bản vẽ tiêu chuẩn',
    alt: (n: number) => `Bản vẽ tiêu chuẩn kiểm tra ${String(n)}`,
    none: 'Chưa có bản vẽ',
    prev: 'Bản vẽ trước',
    next: 'Bản vẽ sau',
  },

  visual: {
    unit: 'cái',
    checks: 'Hạng mục kiểm tra khác',
    checkNo: 'No.',
    checkItem: 'Hạng mục kiểm tra',
    checkValue: 'Kết quả đo',
    checkValueLabel: (name: string) => `Kết quả đo ${name}`,
    remarks: 'Ghi chú',
    remarksPlaceholder: 'Nhập ghi chú',
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
  skipped: {
    notice: (basis: string | null): string =>
      basis === null
        ? 'Yêu cầu này đã bỏ qua kiểm tra. Không có kết quả kiểm tra để nhập.'
        : `Yêu cầu này đã bỏ qua kiểm tra (${basis}). Không có kết quả kiểm tra để nhập.`,
    basis: { DEFAULT: 'mặc định', APPROVAL: 'đã duyệt' } as Record<string, string>,
  },
  requestStatus: {
    REQUESTED: 'Chờ kiểm tra',
    IN_PROGRESS: 'Đang kiểm tra',
    SKIPPED: 'Bỏ qua kiểm tra',
  },
  ok: 'OK',
  ng: 'NG',

  footer: {
    undo: 'Hoàn tác',
    redo: 'Làm lại',
    clear: 'Xóa trắng',
    submit: 'Gửi',
    submitting: 'Đang gửi…',
    submitted: 'Đã xác nhận kết quả kiểm tra.',
  },
  confirm: {
    title: (judgment: string): string => `Xác nhận là ${judgment}?`,
    note: 'Sau khi xác nhận, không thể thay đổi kết quả.',
    target: 'Đối tượng kiểm tra',
    lot: 'LOT',
    supplier: 'Nhà cung cấp',
    dimension: 'Kiểm tra kích thước',
    dimensionValue: (out: number, missing: number) =>
      `Ngoài quy cách ${String(out)} · Chưa nhập ${String(missing)}`,
    checksValue: (ng: number, missing: number) =>
      `NG ${String(ng)} · Chưa đánh giá ${String(missing)}`,
    ok: 'Không có vấn đề',
    check: 'Cần kiểm tra',
    back: 'Quay lại',
    action: (judgment: string) => `Xác nhận ${judgment}`,
  },
};
