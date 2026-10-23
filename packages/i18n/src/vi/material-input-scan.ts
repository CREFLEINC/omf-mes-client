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
    receivedQty: 'Đã nhận',
    recordedQty: 'Đã đưa vào',
    remainingQty: 'Còn lại',
    thisInput: 'Lần này',
  },
  receiptStatus: {
    matched: 'Đã nhận',
    short: 'Nhận thiếu',
    none: 'Chưa nhận',
  },
  loading: {
    receipt: 'Đang tải vật tư đã nhận',
  },
  empty: {
    receiptTitle: 'Không có vật tư đã nhận. Quét LOT vật tư để thêm vào danh sách.',
    notQueriedTitle: 'Chưa chỉ định lệnh sản xuất.',
  },
  notes: {
    shortAllowed:
      'Dù có vật tư nhận thiếu hoặc chưa nhận, vẫn có thể đưa vào theo số lượng đã nhận.',
  },
  scan: {
    label: 'Quét',
    placeholder: 'LOT vật tư hoặc mã khuôn',
    outcomes: {
      material: (itemWithObject: string): string => `Đã thêm ${itemWithObject}.`,
      mold: (moldWithObject: string): string => `Đã chỉ định khuôn ${moldWithObject}.`,
      again: (item: string): string => `Có thể nhập thêm việc đưa vào ${item}.`,
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
      recorded: (item: string, qty: string): string => `Đã ghi đưa vào ${item} ${qty}.`,
    },
  },
  scanned: {
    materialsLabel: 'Danh sách vật tư',
    remove: 'Hủy quét',
    removeMaterial: (lotNo: string): string => `Hủy quét ${lotNo}`,
    removed: (item: string): string => `Đã hủy quét ${item}.`,
    qtyLabel: (lotNo: string): string => `${lotNo} lần này`,
    qtyProblems: {
      empty: 'Hãy nhập số lượng đưa vào lần này.',
      format: 'Hãy nhập số lượng lần này bằng chữ số.',
      notPositive: 'Số lượng lần này phải lớn hơn 0.',
    },
    unlinkedIssue: 'Xuất kho chưa gán',
    keypadLabel: (lotNo: string): string => `Bàn phím số lượng ${lotNo}`,
    keypadSubmit: 'Ghi đưa vào',
    keypadClear: 'Xóa hết',
    keypadBackspace: 'Xóa một ký tự',
    pendingMark: 'Đang nhập lần này',
    notScannedMark: 'Chưa đưa vào',
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
    record: (item: string): string => `Hãy ghi việc đưa vào ${item}`,
    recordMany: (count: number): string => `Hãy ghi việc đưa vào ${String(count)} vật tư đã quét`,
    done: 'Có thể chuyển sang công việc sản xuất',
  },
  confirm: {
    reasons: {
      unavailable: 'Không xác nhận được quyền đưa vào. Hãy nhấn kiểm tra lại quyền đưa vào',
      unidentified:
        'Chưa xác nhận được máy hoặc công đoạn của lệnh sản xuất. Hãy chọn lại lệnh sản xuất ở màn hình bắt đầu công việc rồi vào lại.',
      checking: 'Đang kiểm tra quyền đưa vào',
      qtyMissing: 'Còn vật tư chưa ghi. Hãy nhập số lượng rồi ghi, hoặc bỏ vật tư đó',
      workerMissing: 'Hãy nhập mã nhân viên',
    },
    retry: 'Kiểm tra lại quyền đưa vào',
    goToProductionResult: 'Sang công việc sản xuất',
    failed: 'Không ghi được việc đưa vào.',
  },
};
