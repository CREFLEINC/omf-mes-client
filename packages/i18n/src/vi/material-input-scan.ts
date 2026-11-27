import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-03 자재 투입. */
export const materialInputScan: Translated<typeof ko.materialInputScan> = {
  title: 'Đưa vật tư vào',
  band: {
    title: 'Lệnh sản xuất (W/O)',
    process: 'Công đoạn',
    item: 'Sản phẩm',
    planQty: 'SL kế hoạch',
    mold: 'Khuôn',
  },
  qty: {
    title: 'Số lượng đưa vào',
    unit: (uom: string): string => `Đơn vị ${uom}`,
  },
  pairs: {
    lotLabel: 'LOT',
    progressLabel: 'Lượng đưa vào',
    receivedAtLabel: 'Nhận lúc',
    progress: (recorded: string, issued: string | null, uom: string): string =>
      `${recorded}${issued === null ? '' : ` / ${issued}`}${uom === '' ? '' : ` ${uom}`}`,
  },
  receiptStatus: {
    matched: 'Đã nhận',
    short: 'Nhận thiếu',
    none: 'Chưa nhận',
  },
  loading: {
    receipt: 'Đang tải vật tư cấp phát',
  },
  empty: {
    receiptTitle: 'Không có vật tư cấp phát.',
    receiptHint: 'Quét LOT vật tư để thêm vào danh sách.',
    notQueriedTitle: 'Chưa chỉ định lệnh sản xuất.',
    notQueriedHint: 'Vui lòng chọn lệnh sản xuất trong danh sách lệnh sản xuất.',
  },
  scan: {
    label: 'Số LOT vật tư hoặc mã khuôn',
    outcomes: {
      material: (itemWithObject: string): string => `Đã thêm ${itemWithObject}.`,
      mold: (moldWithObject: string): string => `Đã chỉ định khuôn ${moldWithObject}.`,
      duplicate: (itemWithTopic: string): string => `${itemWithTopic} đã được thêm rồi.`,
      blockedStatus: (itemWithTopic: string, statusName: string): string =>
        `${itemWithTopic} đang ở trạng thái 「${statusName}」 nên không thêm được.`,
      blockedStatusUnknown: (item: string): string =>
        `Không xác nhận được trạng thái của ${item}. Vui lòng quét lại.`,
      waitingLot: 'LOT chưa nhập hàng',
      voidedLot: 'LOT đã hủy',
      ambiguous: (count: number): string =>
        `Tìm thấy cùng lúc ${String(count)} mục. Vui lòng quét toàn bộ mã trên nhãn.`,
      notFound: (code: string): string =>
        `Không có LOT vật tư hoặc khuôn ứng với ${code}. Vui lòng kiểm tra mã.`,
      failed: 'Không tra cứu được. Vui lòng quét lại.',
      offline: 'Mất kết nối nên không tra cứu được vật tư. Vui lòng quét lại khi có kết nối.',
      recorded: (item: string, qty: string): string => `Đưa vào ${item} ${qty}`,
      undone: (item: string): string => `Đã hủy lượt đưa vào chưa gửi của ${item}.`,
      allInput: (item: string): string => `${item} đã đưa vào hết lượng cấp phát.`,
      leftoversSent: (count: number): string =>
        `Đã gửi ${String(count)} lượt đưa vào chưa gửi đã quét trước đó.`,
    },
  },
  scanned: {
    materialsLabel: 'Danh sách vật tư',
    remove: 'Hủy quét',
    removeMaterial: (lotNo: string): string => `Hủy quét ${lotNo}`,
    removed: (item: string): string => `Đã hủy quét ${item}.`,
    pendingItem: (item: string, qty: string): string => `${item} ${qty}`,
    pendingHint: 'Đã thêm · Sẽ gửi khi quét tiếp hoặc chuyển sang công việc sản xuất.',
    recordsTitle: 'Lịch sử đưa vào',
    recordsMore: (count: number): string => `và ${String(count)} mục khác`,
    pendingState: 'Chưa gửi',
    sentState: 'Đã gửi',
    extraInput: 'Đưa thêm',
    undo: 'Hủy',
    undoMaterial: (lotNo: string): string => `Hủy đưa vào chưa gửi ${lotNo}`,
    manualReasons: {
      unknown: 'Không biết lượng cấp phát nên vui lòng tự nhập lượng đưa vào.',
      none: 'Đã đưa vào hết lượng cấp phát. Muốn đưa thêm vui lòng tự nhập lượng đưa vào.',
      unit: 'Khác đơn vị nên vui lòng tự nhập lượng đưa vào.',
    },
    manualDefault: 'Vui lòng tự nhập lượng đưa vào.',
    qtyLabel: (lotNo: string): string => `Số lượng đưa vào ${lotNo}`,
    qtyProblems: {
      empty: 'Vui lòng nhập số lượng đưa vào.',
      format: 'Vui lòng nhập số lượng đưa vào bằng chữ số.',
      notPositive: 'Số lượng đưa vào phải lớn hơn 0.',
    },
    unlinkedIssue: 'Xuất kho chưa gán',
    keypadSubmit: 'Đăng ký đưa vào',
    summary: (todo: number, done: number): string =>
      `Cần đưa vào ${String(todo)}, đã xong ${String(done)}`,
    completeMark: 'Đã đưa vào xong',
    overMark: (qty: string): string => `Đưa vào quá ${qty}`,
    pendingMark: 'Đang đưa vào',
    heldMark: 'Cần kiểm tra tạm giữ',
    fourMChangeMark: 'Hàng thay đổi 4M',
    fourMChangeLine: (detail: string): string => `Thay đổi 4M: ${detail}`,
    unitMismatch: 'Khác đơn vị',
    shotCountExceeded: (mold: string): string =>
      `Khuôn ${mold} đã vượt số nhát dập đảm bảo. Vẫn đưa vào được, nhưng vui lòng xem xét thay khuôn.`,
  },
  remaining: {
    workOrderMissing:
      'Chưa chỉ định lệnh sản xuất. Vui lòng chọn lệnh sản xuất ở màn hình danh sách lệnh sản xuất',
    scan: 'Vui lòng quét LOT vật tư',
    record: (item: string): string => `Vui lòng đăng ký đưa vào ${item}`,
    recordMany: (count: number): string =>
      `Vui lòng đăng ký đưa vào ${String(count)} vật tư đã quét`,
    done: 'Nếu đã đưa vào xong, có thể chuyển sang công việc sản xuất',
    sending: (item: string, qty: string): string => `Sẽ gửi đưa vào ${item} ${qty} khi quét tiếp`,
  },
  confirm: {
    reasons: {
      unavailable: 'Không xác nhận được quyền đưa vào. Vui lòng nhấn kiểm tra lại quyền đưa vào',
      unidentified:
        'Chưa xác nhận được máy hoặc công đoạn của lệnh sản xuất. Vui lòng chọn lại lệnh sản xuất ở màn hình danh sách lệnh sản xuất rồi vào lại.',
      checking: 'Đang kiểm tra quyền đưa vào',
      qtyMissing: 'Còn vật tư chưa đăng ký. Vui lòng nhập lượng đưa vào rồi đăng ký, hoặc hủy quét',
      workerMissing: 'Vui lòng nhập mã nhân viên',
    },
    retry: 'Kiểm tra lại quyền đưa vào',
    goToProductionResult: 'Sang công việc sản xuất',
    failed: 'Không đăng ký được việc đưa vào.',
  },
  wip: {
    chip: (operationSeq: number | null, processName: string | null): string =>
      operationSeq === null
        ? 'Bán thành phẩm'
        : `Bán thành phẩm · CĐ ${String(operationSeq)}${processName === null || processName === '' ? '' : ` ${processName}`}`,
    basis: (produced: string, consumed: string, remainingWithUnit: string): string =>
      `Kết quả ${produced} · Đã đưa vào ${consumed} · Số lượng còn lại ${remainingWithUnit}`,
    filled: (item: string, qtyWithUnit: string): string =>
      `${item} — Đã điền toàn bộ số lượng còn lại ${qtyWithUnit} của bán thành phẩm. Chỉ giảm khi đưa vào từng phần.`,
    exceeded: (remainingWithUnit: string, produced: string, consumed: string): string =>
      `Đã đưa vào nhiều hơn số lượng còn lại (${remainingWithUnit}). Trong kết quả ${produced}, đã đưa vào ${consumed}.`,
    allInput: (item: string): string => `${item} — đã đưa vào hết số lượng bán thành phẩm còn lại.`,
    unknown: 'Không biết số lượng bán thành phẩm còn lại nên vui lòng tự nhập lượng đưa vào.',
  },
};
