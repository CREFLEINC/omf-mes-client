import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-11 러닝체인지 부품 교체 등록. */
export const runningChange: Translated<typeof ko.runningChange> = {
  title: 'Running change - Thay linh kiện',

  header: {
    workOrderMissing: 'Không nhận được lệnh sản xuất nên không tải được vật tư đang đưa vào.',
    unsynced: (count: number) => `Chờ gửi ${count} mục`,
  },

  band: {
    title: 'Lệnh sản xuất (W/O)',
    process: 'Công đoạn',
    item: 'Sản phẩm',
    currentLot: 'LOT sản xuất hiện tại',
    progress: 'Tiến độ',
    progressValue: (goodQty: number, targetQty: number) => `${goodQty}/${targetQty}`,
  },

  panes: {
    current: 'Đang đưa vào',
    replace: 'Thay linh kiện',
  },

  current: {
    loading: 'Đang tải vật tư đang đưa vào.',
    empty: 'Lệnh sản xuất này chưa có vật tư đưa vào. Không có gì để thay.',
    noWorkOrderTitle: 'Chưa nhận được lệnh sản xuất.',
    noWorkOrder: 'Khi có lệnh sản xuất sẽ hiện vật tư đang đưa vào.',
    /*
     * ⭐ **칸마다 이름을 붙인다**(사용자 제안 시안 2026-09-11). 값만 늘어놓으면 「ABC-123」이
     *    품목인지 LOT 인지, 「100 EA」가 계획인지 투입인지 화면만 보고는 알 수 없다.
     */
    fourMChangeMark: 'Hàng thay đổi 4M',
    moldSectionLabel: 'Thông tin khuôn',
    moldNoLabel: 'Số khuôn',
    moldNameLabel: 'Tên khuôn',
    shotCountLabel: 'Số nhát dập',
    shotRemainingLabel: 'Số nhát dập còn lại',
    moldUnknown: 'Không kiểm tra được khuôn',
    moldNone: 'Phiên này không lắp khuôn nào',
    moldNoSession: 'Không có phiên nên không biết khuôn đang lắp',
    moldShotCount: (current: number) => current.toLocaleString('ko-KR'),
    moldShotRemaining: (remaining: number) => remaining.toLocaleString('ko-KR'),
    moldShotRemainingUnknown: 'Không tính được phần còn lại',
    moldShotExceeded: 'Đã vượt số nhát dập đảm bảo. Hãy hỏi người phụ trách.',
  },

  currentLot: {
    failed: 'Không tải được LOT sản xuất hiện tại. Vẫn đăng ký thay thế được.',
    progressUnknown: (targetQty: number) => `Mục tiêu ${targetQty} · không kiểm tra được tiến độ`,
  },

  scan: {
    label: 'Quét LOT linh kiện mới',
    placeholder: 'Quét LOT linh kiện mới',
    manualEntry: 'Nhập tay',
    outcomes: {
      partResolved: (code: string, lotNo: string) => `Đã thêm ${code} → ${lotNo}.`,
      ambiguous: (count: number) => `Tìm thấy nhiều kết quả (${count} mục). Hãy quét đúng số LOT.`,
      notFound: 'Không có LOT số này. Hãy kiểm tra lại số.',
      failed: 'Tra cứu thất bại. Hãy quét lại.',
      offline: 'Mất kết nối nên không tra cứu được. Khi có kết nối hãy quét lại.',
    },
  },

  replace: {
    partLabel: 'Linh kiện mới',
    statusLoading: 'Đang kiểm tra trạng thái',
    statusEmpty: '—',
    statusFailed: 'Không kiểm tra được trạng thái',
    statusUnknown: (code: string) => `${code} (không có tên hiển thị)`,
    clearPart: 'Xóa',
    targetLabel: 'Đối tượng thay thế',
    targetPlaceholder: 'Chọn đối tượng thay thế',
    targetOption: (itemCode: string, lotNo: string) => `${itemCode} (${lotNo})`,
    qtyLabel: 'Số lượng đưa vào',
    qtyProblems: {
      empty: 'Hãy nhập số lượng đưa vào.',
      format: 'Chỉ nhập số.',
      notPositive: 'Số lượng đưa vào phải lớn hơn 0.',
    },
    reasonLabel: 'Lý do thay thế',
    optional: '(tùy chọn)',
    reasonPlaceholder: 'Hãy chọn lý do',
    /**
     * 고를 사유가 없을 때 **칸 «안»에서 말한다**(사용자 지시 2026-09-11).
     */
    /* ⚠ 마침표를 찍지 않는다 — 칸 «안»의 자리 표시 글이지 문장이 아니다(사용자 지시). */
    reasonEmpty: 'Không có lý do thay thế để chọn nên sẽ đăng ký không kèm lý do',
    reasonFailed: 'Không tải được lý do thay thế. Sẽ đăng ký không kèm lý do.',
    reasonLoading: 'Đang tải lý do thay thế.',
    submit: 'Đăng ký thay thế',
    reset: 'Xóa nhập',
    done: 'Đã đăng ký thay linh kiện.',
    rejected: 'Máy chủ không nhận lần thay thế này.',
  },

  pad: {
    title: 'Số lượng',
    unit: (uom: string) => `Đơn vị ${uom}`,
  },

  disabled: {
    checking: 'Đang kiểm tra quyền thay thế.',
    unavailable: 'Không kiểm tra được quyền thay thế. Lát nữa hãy thử lại.',
    unidentified:
      'Chưa xác nhận được máy hoặc công đoạn của lệnh sản xuất này nên chưa đăng ký thay thế được. Hãy chọn lại lệnh sản xuất ở màn hình danh sách lệnh sản xuất rồi vào lại.',
  },

  retry: 'Thử lại',
};
