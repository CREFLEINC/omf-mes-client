import type { ko } from '../ko';
import { common } from './common';
import type { Translated } from './translated';

/** P-02-03 자재 투입 스캔·오투입 검증. */
export const materialInputScan: Translated<typeof ko.materialInputScan> = {
  title: 'Đưa vật tư vào',
  panes: {
    receipt: 'Đã nhận so với kế hoạch',
    scan: 'Quét',
  },
  header: {
    workOrderMissing: 'Chưa chỉ định lệnh sản xuất. Hãy chọn lệnh sản xuất rồi vào lại.',
    /* ⚠ 머리줄의 작업지시 표기는 화면마다 「W/O」로 통일한다(사용자 지시 2026-09-10). */
    workOrder: (workOrderId: number): string => `W/O #${String(workOrderId)}`,
    emergency: 'Khẩn',
    session: (sessionId: number): string => `Phiên #${String(sessionId)}`,
    sessionNone: 'Phiên —',
    terminal: (terminalId: number): string => `Máy trạm #${String(terminalId)}`,
    terminalUnknown: 'Máy trạm —',
    unsynced: (count: number): string => `Chờ gửi ${String(count)} mục`,
    synced: 'Đã gửi xong',
    offline: common.connection.offline,
  },
  table: {
    item: 'Mặt hàng',
    lot: 'LOT',
    issuedQty: 'Xuất kho',
    receivedQty: 'Đã nhận',
    varianceQty: 'Chênh lệch',
    status: 'Trạng thái',
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
    receiptTitle: 'Không có lịch sử nhận.',
    notQueriedTitle: 'Chưa tra cứu',
  },
  notes: {
    shortAllowed: 'Dù nhận thiếu hoặc chưa nhận, vẫn có thể đưa vào số lượng đã nhận.',
    manualEntry: 'Nếu không quét được, hãy nhập tay mã rồi nhấn Enter.',
  },
  receiptSummary: {
    label: 'Thiếu · chưa nhận',
    short: (item: string, varianceQty: number): string => `${item} thiếu ${String(varianceQty)}`,
    none: (item: string): string => `${item} chưa nhận`,
  },
  scan: {
    label: 'LOT vật tư / mã khuôn',
    manualEntry: 'Nhập tay',
    outcomes: {
      material: (lotNo: string): string => `Đã thêm ${lotNo}.`,
      mold: (moldCode: string): string => `Đã chỉ định khuôn ${moldCode}.`,
      duplicate: (lotNo: string): string => `${lotNo} đã được thêm rồi.`,
      ambiguous: (count: number): string =>
        `Tìm thấy cùng lúc ${String(count)} mục. Hãy đọc mã chính xác hơn.`,
      notFound: (code: string): string => `Không tìm thấy ${code}.`,
      failed: 'Không tra cứu được. Hãy đọc lại.',
      offline: 'Mất kết nối nên không tra cứu được vật tư. Hãy đọc lại khi có kết nối.',
    },
  },
  scanned: {
    materialsLabel: 'Vật tư đã thêm',
    moldLabel: 'Khuôn đã chỉ định',
    remove: 'Bỏ',
    qtyLabel: (lotNo: string): string => `Số lượng đưa vào ${lotNo}`,
    itemAndQty: (item: string, qty: string, uom: string): string =>
      uom === '' ? `${item} · ${qty}` : `${item} · ${qty} ${uom}`,
    qtyProblems: {
      empty: 'Hãy nhập số lượng đưa vào.',
      format: 'Hãy nhập số lượng đưa vào bằng chữ số.',
      notPositive: 'Số lượng đưa vào phải lớn hơn 0.',
    },
    unlinkedIssue: 'Xuất kho chưa gán',
    crossProcess: 'Đưa vào chéo',
    removeMaterial: (lotNo: string): string => `Bỏ ${lotNo}`,
    saveHint: 'Nhập số lượng rồi nhấn 「Ghi」.',
    keypadLabel: (lotNo: string): string => `Bàn phím số lượng ${lotNo}`,
    keypadSubmit: 'Ghi',
    keypadClear: 'Xóa hết',
    keypadBackspace: 'Xóa một ký tự',
    recordedMark: 'Đã ghi',
    recordFailed: 'Không ghi được',
    empty: 'Chưa thêm vật tư nào.',
    moldEmpty: 'Chưa chỉ định khuôn nào.',
    statusLabel: 'Trạng thái',
    heldMark: 'Đang tạm giữ',
    statusLabelUnavailable: 'Không tải được tên trạng thái nên hiển thị bằng mã.',
    shotCount: (current: number, guaranteed: number): string =>
      `Nhát dập ${current.toLocaleString('ko-KR')} / ${guaranteed.toLocaleString('ko-KR')}`,
    shotCountUnknown: (current: number): string =>
      `Nhát dập ${current.toLocaleString('ko-KR')} · chưa có số nhát dập đảm bảo`,
    shotCountExceeded:
      'Đã vượt số nhát dập đảm bảo. Không chặn đưa vào, nhưng hãy xem xét thay khuôn.',
  },
  confirm: {
    action: 'Xác nhận đưa vào',
    reasons: {
      nothingScanned: 'Xác nhận đưa vào: phải ghi ít nhất một vật tư mới nhấn được.',
      denied:
        'Máy trạm này không có quyền đưa vật tư vào ở công đoạn này. Hãy liên hệ quản trị viên.',
      unavailable: 'Không xác nhận được quyền đưa vào. Hãy thử lại.',
      unidentified: 'Chưa xác nhận được máy trạm. Hãy chọn lệnh sản xuất rồi vào lại.',
      checking: 'Đang kiểm tra quyền đưa vào.',
      qtyMissing: 'Còn vật tư chưa ghi. Hãy nhập số lượng để ghi, hoặc bỏ vật tư đó.',
      workerMissing: 'Chưa xác nhận được công nhân. Hãy xác nhận mã nhân viên rồi vào lại.',
    },
    retry: 'Kiểm tra lại quyền đưa vào',
    closed: (count: number): string => `Đã hoàn tất đưa vào với ${String(count)} mục.`,
    failed: 'Không ghi được việc đưa vào.',
  },
};
