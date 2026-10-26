import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-03 자재 투입. */
export const materialInputScan: Translated<typeof ko.materialInputScan> = {
  title: 'Đưa vật tư vào',
  panes: {
    input: 'Vật tư đưa vào',
    noSelection: 'Vật tư đã chọn',
  },
  pairs: {
    lotLabel: 'LOT',
    progressLabel: 'Lượng đưa vào',
    progress: (recorded: string, issued: string | null, uom: string): string =>
      `${recorded}${issued === null ? '' : ` / ${issued}`}${uom === '' ? '' : ` ${uom}`}`,
    remaining: (qty: string): string => `Còn lại ${qty}`,
    over: (qty: string): string => `Đã đưa vào nhiều hơn lượng cấp phát ${qty}.`,
    thisInput: 'Lần này',
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
    receiptTitle: 'Không có vật tư cấp phát. Quét LOT vật tư để thêm vào danh sách.',
    notQueriedTitle: 'Chưa chỉ định lệnh sản xuất.',
  },
  notes: {
    shortAllowed: 'Dù có vật tư nhận thiếu hoặc chưa nhận, vẫn có thể đưa vào theo lượng cấp phát.',
  },
  scan: {
    label: 'Quét',
    placeholder: 'LOT vật tư hoặc mã khuôn',
    outcomes: {
      material: (itemWithObject: string): string => `Đã thêm ${itemWithObject}.`,
      mold: (moldWithObject: string): string => `Đã chỉ định khuôn ${moldWithObject}.`,
      again: (item: string): string => `Đã thêm lượt đưa vào bổ sung cho ${item}.`,
      duplicate: (itemWithTopic: string): string => `${itemWithTopic} đã được thêm rồi.`,
      blockedStatus: (itemWithTopic: string, statusName: string): string =>
        `${itemWithTopic} đang ở trạng thái 「${statusName}」 nên không thêm được.`,
      blockedStatusUnknown: (item: string): string =>
        `Không xác nhận được trạng thái của ${item}. Hãy quét lại.`,
      ambiguous: (count: number): string =>
        `Tìm thấy cùng lúc ${String(count)} mục. Hãy quét toàn bộ mã trên nhãn.`,
      notFound: (code: string): string =>
        `Không có LOT vật tư hoặc khuôn ứng với ${code}. Hãy kiểm tra mã.`,
      failed: 'Không tra cứu được. Hãy quét lại.',
      offline: 'Mất kết nối nên không tra cứu được vật tư. Hãy quét lại khi có kết nối.',
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
    pendingHint: 'Sẽ gửi khi quét tiếp hoặc chuyển sang công việc sản xuất.',
    recordsTitle: 'Lịch sử đưa vào',
    pendingState: 'Chưa gửi',
    sentState: 'Đã gửi',
    cancelRecord: 'Hủy đưa vào',
    allInput: 'Đã đưa vào hết lượng cấp phát.',
    extraInput: 'Đưa thêm',
    undo: 'Hủy',
    undoMaterial: (lotNo: string): string => `Hủy đưa vào chưa gửi ${lotNo}`,
    manualReasons: {
      unknown: 'Không biết lượng cấp phát nên hãy tự nhập lượng đưa vào.',
      none: 'Đã đưa vào hết lượng cấp phát. Muốn đưa thêm hãy tự nhập lượng đưa vào.',
      unit: 'Khác đơn vị nên hãy tự nhập lượng đưa vào.',
    },
    sentReadOnly: 'Việc đưa vào đã gửi chưa sửa được. Muốn đưa thêm hãy quét lại nhãn LOT.',
    qtyLabel: (lotNo: string): string => `${lotNo} lần này`,
    qtyProblems: {
      empty: 'Hãy nhập số lượng đưa vào lần này.',
      format: 'Hãy nhập số lượng lần này bằng chữ số.',
      notPositive: 'Số lượng lần này phải lớn hơn 0.',
    },
    unlinkedIssue: 'Xuất kho chưa gán',
    keypadLabel: (lotNo: string): string => `Bàn phím số lượng ${lotNo}`,
    keypadSubmit: 'Đăng ký đưa vào',
    keypadClear: 'Xóa hết',
    keypadBackspace: 'Xóa một ký tự',
    summary: (todo: number, done: number): string =>
      `Cần đưa vào ${String(todo)}, đã xong ${String(done)}`,
    completeMark: 'Đã đưa vào xong',
    overMark: (qty: string): string => `Đưa vào quá ${qty}`,
    pendingMark: 'Đang đưa vào',
    noSelection: 'Hãy chọn vật tư trong danh sách hoặc quét nhãn LOT.',
    scanToInput: 'Quét nhãn LOT để nhập số lượng lần này.',
    heldMark: 'Cần kiểm tra tạm giữ',
    fourMChangeMark: 'Hàng thay đổi 4M',
    fourMChangeLine: (detail: string): string => `Thay đổi 4M: ${detail}`,
    unitMismatch: 'Khác đơn vị',
    shotCountExceeded: (mold: string): string =>
      `Khuôn ${mold} đã vượt số nhát dập đảm bảo. Vẫn đưa vào được, nhưng hãy xem xét thay khuôn.`,
  },
  remaining: {
    workOrderMissing:
      'Chưa chỉ định lệnh sản xuất. Hãy chọn lệnh sản xuất ở màn hình bắt đầu công việc',
    scan: 'Hãy quét LOT vật tư',
    record: (item: string): string => `Hãy đăng ký đưa vào ${item}`,
    recordMany: (count: number): string => `Hãy đăng ký đưa vào ${String(count)} vật tư đã quét`,
    done: 'Có thể chuyển sang công việc sản xuất',
    sending: (item: string, qty: string): string => `Sẽ gửi đưa vào ${item} ${qty} khi quét tiếp`,
  },
  confirm: {
    reasons: {
      unavailable: 'Không xác nhận được quyền đưa vào. Hãy nhấn kiểm tra lại quyền đưa vào',
      unidentified:
        'Chưa xác nhận được máy hoặc công đoạn của lệnh sản xuất. Hãy chọn lại lệnh sản xuất ở màn hình bắt đầu công việc rồi vào lại.',
      checking: 'Đang kiểm tra quyền đưa vào',
      qtyMissing: 'Còn vật tư chưa đăng ký. Hãy nhập lượng đưa vào rồi đăng ký, hoặc hủy quét',
      workerMissing: 'Hãy nhập mã nhân viên',
    },
    retry: 'Kiểm tra lại quyền đưa vào',
    goToProductionResult: 'Sang công việc sản xuất',
    failed: 'Không đăng ký được việc đưa vào.',
  },
};
