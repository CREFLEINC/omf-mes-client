import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-11 러닝체인지 부품 교체 등록. */
export const runningChange: Translated<typeof ko.runningChange> = {
  title: 'Running change - Thay linh kiện',

  header: {
    workOrder: (workOrderId: number) => `W/O ${workOrderId}`,
    workOrderMissing: 'Không nhận được lệnh sản xuất nên không tải được vật tư đang đưa vào.',
    session: (workSessionId: number) => `Phiên ${workSessionId}`,
    sessionNone: 'Không có phiên',
    terminal: (terminalId: number) => `Máy trạm ${terminalId}`,
    terminalUnknown: 'Chưa xác nhận máy trạm',
    unsynced: (count: number) => `Chờ gửi ${count} mục`,
    synced: 'Đã gửi xong',
    offline: 'Ngoại tuyến',
  },

  panes: {
    current: 'Đang đưa vào',
    currentLot: 'LOT sản xuất hiện tại',
    replace: 'Thay linh kiện',
  },

  current: {
    loading: 'Đang tải vật tư đang đưa vào.',
    empty: 'Lệnh sản xuất này chưa có vật tư đưa vào. Không có gì để thay.',
    noWorkOrder: 'Khi có lệnh sản xuất sẽ hiện vật tư đang đưa vào.',
    /*
     * ⭐ **칸마다 이름을 붙인다**(사용자 제안 시안 2026-09-11). 값만 늘어놓으면 「ABC-123」이
     *    품목인지 LOT 인지, 「100 EA」가 계획인지 투입인지 화면만 보고는 알 수 없다.
     */
    itemCodeLabel: 'Mã thành phẩm',
    inputQtyLabel: 'Số lượng đưa vào',
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
    loading: 'Đang tải LOT sản xuất hiện tại.',
    missing: 'Không nhận được LOT sản xuất hiện tại. Hãy vào lại từ màn hình công việc.',
    failed: 'Không tải được LOT sản xuất hiện tại. Vẫn đăng ký thay thế được.',
    progress: (goodQty: number, targetQty: number) => `Tiến độ ${goodQty}/${targetQty}`,
    progressUnknown: (targetQty: number) => `Mục tiêu ${targetQty} · không kiểm tra được tiến độ`,
  },

  notices: {
    equipmentKeepsRunning: 'Không dừng thiết bị.',
    noWorkOrderSplit: 'W/O không bị tách. Chỉ LOT sản xuất được tách theo từng bản chụp BOM.',
  },

  scan: {
    label: 'Quét LOT linh kiện mới',
    manualEntry: 'Nhập tay',
    outcomes: {
      partResolved: (code: string, lotNo: string) => `Đã thêm ${code} → ${lotNo}.`,
      part: (lotNo: string) => `Đã thêm ${lotNo}.`,
      ambiguous: (count: number) => `Tìm thấy nhiều kết quả (${count} mục). Hãy quét đúng số LOT.`,
      notFound: (code: string) => `Không tìm thấy LOT ứng với ${code}.`,
      failed: 'Tra cứu thất bại. Hãy quét lại.',
      offline: 'Mất kết nối nên không tra cứu được. Khi có kết nối hãy quét lại.',
    },
  },

  replace: {
    partLabel: 'Linh kiện mới',
    partNone: 'Hãy quét LOT linh kiện mới trước.',
    statusLoading: 'Đang kiểm tra trạng thái',
    statusEmpty: '—',
    statusFailed: 'Không kiểm tra được trạng thái',
    statusUnknown: (code: string) => `${code} (không có tên hiển thị)`,
    clearPart: 'Xóa',
    targetLabel: 'Đối tượng thay thế',
    targetPlaceholder: 'Hãy chọn đối tượng thay thế',
    targetOption: (itemCode: string, lotNo: string) => `${itemCode} (${lotNo})`,
    qtyLabel: 'Số lượng đưa vào',
    qtyProblems: {
      empty: 'Hãy nhập số lượng đưa vào.',
      format: 'Chỉ nhập số.',
      notPositive: 'Số lượng đưa vào phải lớn hơn 0.',
    },
    reasonLabel: 'Lý do thay thế',
    reasonPlaceholder: 'Hãy chọn lý do',
    /**
     * 고를 사유가 없을 때 **칸 «안»에서 말한다**(사용자 지시 2026-09-11).
     */
    /* ⚠ 마침표를 찍지 않는다 — 칸 «안»의 자리 표시 글이지 문장이 아니다(사용자 지시). */
    reasonEmpty: 'Không có lý do thay thế để chọn nên sẽ đăng ký không kèm lý do',
    reasonFailed: 'Không tải được lý do thay thế. Sẽ đăng ký không kèm lý do.',
    reasonLoading: 'Đang tải lý do thay thế.',
    submit: 'Đăng ký thay thế',
    recorded: 'Đã ghi nhận thay thế. Khi gửi lên máy chủ, số chờ gửi sẽ giảm.',
    rejected: 'Máy chủ không nhận lần thay thế này.',
  },

  pad: {
    title: 'Số lượng đưa vào',
    keypadLabel: 'Bàn phím số lượng',
    backspace: 'Xóa một ký tự',
    clear: 'Xóa',
    decimal: 'Dấu thập phân',
    confirm: 'Xác nhận',
    cancel: 'Hủy',
    empty: '—',
  },

  disabled: {
    checking: 'Đang kiểm tra quyền thay thế.',
    denied: 'Máy trạm này không đưa vật tư vào được. Hãy hỏi người phụ trách.',
    unavailable: 'Không kiểm tra được quyền thay thế. Lát nữa hãy thử lại.',
    unidentified: 'Chưa xác nhận máy trạm nên không đăng ký thay thế được.',
    workerMissing:
      'Chưa xác nhận mã nhân viên nên không đăng ký thay thế được. Hãy xác nhận mã nhân viên trước.',
    workOrderMissing: 'Không có lệnh sản xuất nên không đăng ký thay thế được.',
    partMissing: 'Phải quét LOT linh kiện mới rồi mới đăng ký được.',
    targetMissing: 'Phải chọn đối tượng thay thế rồi mới đăng ký được.',
  },

  retry: 'Thử lại',
};
