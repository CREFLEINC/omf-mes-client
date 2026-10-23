import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-03 자재 투입. */
export const materialInputScan: Translated<typeof ko.materialInputScan> = {
  title: 'Đưa vật tư vào',
  panes: {
    input: 'Vật tư đưa vào',
    qty: 'Số lượng đưa vào',
  },
  pairs: {
    item: 'Mặt hàng',
    issuedQty: 'Xuất kho',
    receivedQty: 'Đã nhận',
    varianceQty: 'Chênh lệch',
    receiptStatus: 'Trạng thái nhận',
    recordedQty: 'Đã đưa vào',
    lotStatus: 'Trạng thái LOT',
  },
  receiptStatus: {
    matched: 'Đã nhận đủ',
    short: 'Nhận thiếu',
    none: 'Chưa nhận',
  },
  loading: {
    receipt: 'Đang tải lịch sử nhận tại dòng',
  },
  empty: {
    receiptTitle: 'Không có lịch sử nhận. Quét LOT vật tư để thêm vào danh sách.',
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
      material: (lotNo: string): string => `Đã thêm ${lotNo}.`,
      mold: (moldCode: string): string => `Đã chỉ định khuôn ${moldCode}.`,
      duplicate: (lotNo: string): string => `LOT ${lotNo} đã được thêm rồi.`,
      blockedStatus: (lotNo: string, statusName: string): string =>
        `LOT ${lotNo} đang ở trạng thái 「${statusName}」 nên không thêm được. Chỉ vật tư ở trạng thái bình thường mới đưa vào được.`,
      blockedStatusUnknown: (lotNo: string): string =>
        `Không xác nhận được trạng thái của LOT ${lotNo} nên không thêm được. Hãy quét lại.`,
      ambiguous: (count: number): string =>
        `Tìm thấy cùng lúc ${String(count)} mục. Hãy quét toàn bộ mã trên nhãn.`,
      notFound: (code: string): string =>
        `Không có LOT vật tư hoặc khuôn ứng với ${code}. Hãy kiểm tra mã.`,
      failed: 'Không tra cứu được. Hãy quét lại.',
      offline: 'Mất kết nối nên không tra cứu được vật tư. Hãy quét lại khi có kết nối.',
    },
  },
  scanned: {
    materialsLabel: 'Danh sách vật tư',
    moldLabel: 'Khuôn',
    remove: 'Bỏ',
    removeMaterial: (lotNo: string): string => `Bỏ ${lotNo}`,
    qtyField: 'Số lượng đưa vào',
    qtyLabel: (lotNo: string): string => `Số lượng đưa vào ${lotNo}`,
    qtyProblems: {
      empty: 'Hãy nhập số lượng đưa vào.',
      format: 'Hãy nhập số lượng đưa vào bằng chữ số.',
      notPositive: 'Số lượng đưa vào phải lớn hơn 0.',
    },
    unlinkedIssue: 'Xuất kho chưa gán',
    keypadLabel: (lotNo: string): string => `Bàn phím số lượng ${lotNo}`,
    keypadSubmit: 'Ghi đưa vào',
    keypadClear: 'Xóa hết',
    keypadBackspace: 'Xóa một ký tự',
    recordedMark: 'Đã ghi',
    pendingMark: 'Chưa ghi',
    notScannedMark: 'Chưa quét',
    noSelection: 'Hãy chọn vật tư trong danh sách hoặc quét nhãn LOT.',
    scanToInput: 'Quét nhãn LOT để nhập số lượng đưa vào.',
    moldEmpty: 'Chưa chỉ định khuôn nào.',
    receivedNone: 'Không có lịch sử nhận',
    heldMark: 'Đang tạm giữ',
    fourMChangeMark: 'Hàng thay đổi 4M',
    statusLabelUnavailable: 'Không tải được tên trạng thái nên hiển thị bằng mã.',
    shotCount: (current: number, guaranteed: number): string =>
      `Nhát dập ${current.toLocaleString('ko-KR')} / ${guaranteed.toLocaleString('ko-KR')}`,
    shotCountUnknown: (current: number): string =>
      `Nhát dập ${current.toLocaleString('ko-KR')}, chưa đăng ký số nhát dập đảm bảo`,
    shotCountExceeded:
      'Đã vượt số nhát dập đảm bảo. Vẫn đưa vào được, nhưng hãy xem xét thay khuôn.',
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
      workerMissing: 'Chưa xác nhận được công nhân. Hãy xác nhận mã nhân viên rồi vào lại',
    },
    retry: 'Kiểm tra lại quyền đưa vào',
    goToProductionResult: 'Sang công việc sản xuất',
    failed: 'Không ghi được việc đưa vào.',
  },
};
