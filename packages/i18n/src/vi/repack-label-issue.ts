import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-04-04 재구성 신규 라벨 발행. */
export const repackLabelIssue: Translated<typeof ko.repackLabelIssue> = {
  title: 'Phát hành nhãn mới sau sắp xếp lại',

  entry: {
    handlingUnitLabel: 'Kiện',
    workerLabel: 'Mã nhân viên',
    missingHandlingUnit: 'Hãy chọn kiện trong danh sách chờ phát hành.',
    missingWorker:
      'Chưa xác nhận mã nhân viên nên không phát hành nhãn được. Hãy xác nhận mã nhân viên trước.',
  },

  pending: {
    sectionLabel: 'Chờ phát hành',
    caption: 'Kiện mới chưa phát hành nhãn',
    sourceColumn: 'Kiện gốc',
    typeColumn: 'Loại',
    newColumn: 'Kiện mới',
    remainderColumn: 'Lượng còn lại',
    occurredColumn: 'Thời điểm xác nhận',
    sourceJoin: '+',
    newCount: (count: number): string => `${count} mục`,
    repackType: (code: string): string =>
      code === 'SPLIT'
        ? 'Tách'
        : code === 'MERGE'
          ? 'Gộp'
          : code === 'RECONFIGURE'
            ? 'Sắp xếp lại'
            : code,
    noRemainder: '—',
    unknown: '—',
    noEvent: (handlingUnitNo: string): string => `${handlingUnitNo} · Không có lịch sử sắp xếp lại`,
    unknownEvent: (handlingUnitNo: string): string =>
      `${handlingUnitNo} · Không xác nhận được lịch sử sắp xếp lại`,
    selectRow: (sourceText: string, handlingUnitNo: string): string =>
      `${sourceText} · Chọn kiện mới ${handlingUnitNo}`,
    selected: 'Đã chọn',
    loading: 'Đang tải kiện chờ phát hành.',
    empty: 'Hiện không có kiện nào chờ phát hành.',
    loadFailed: 'Không tải được danh sách chờ phát hành.',
    unsupported:
      'Máy chủ chưa hỗ trợ danh sách chờ phát hành. Khi máy chủ sẵn sàng, có thể chọn đối tượng ở màn hình này.',
  },

  gate: {
    checking: 'Đang kiểm tra quyền in.',
    denied: 'Máy trạm này không in nhãn được. Hãy hỏi người phụ trách.',
    unavailable: 'Không kiểm tra được quyền in. Hãy thử lại sau.',
    unidentified: 'Chưa xác nhận được máy trạm nên không phát hành nhãn được.',
    offline:
      'Mất kết nối nên không phát hành nhãn được. Nhãn do máy chủ tạo — hãy làm lại khi có kết nối.',
  },

  device: {
    printerLabel: 'Máy in',
    printerUnknown: 'Không xác nhận được máy in',
    printerNone: 'Không có máy in dùng được',
    terminalLabel: 'Máy trạm',
    terminalUnknown: 'Chưa xác nhận',
    online: 'Trực tuyến',
    offline: 'Ngoại tuyến',
  },

  handlingUnit: {
    sectionLabel: 'Kiện đối tượng',
    noLabel: 'Số kiện',
    typeLabel: 'Loại',
    contentsLabel: 'Hàng bên trong',
    lotColumn: 'LOT',
    itemColumn: 'Mặt hàng',
    qtyColumn: 'Số lượng',
    unknownValue: '—',
    typeLoading: 'Đang xác nhận loại',
    typeFailed: 'Không xác nhận được loại',
    typeUnknown: (code: string): string => `${code} (không có tên hiển thị)`,
    empty: 'Kiện này không có hàng bên trong.',
    loading: 'Đang tải kiện đối tượng.',
    loadFailed: 'Không tải được kiện.',
    namesFailed: 'Không tải được tên LOT·mặt hàng nên một số ô để trống.',
    mixedLot: (lotCount: number): string => `${String(lotCount)} LOT`,
  },

  issue: {
    sectionLabel: 'Phát hành nhãn',
    targetsLabel: 'Đối tượng in',
    newLabelWaiting: 'Chọn kiện mới thì nhãn mới sẽ được chọn sẵn.',
    newLabel: (handlingUnitNo: string): string => `Nhãn kiện mới · ${handlingUnitNo}`,
    remainderLabel: (handlingUnitNo: string, issueCount: number): string =>
      `In lại nhãn phần còn lại · ${handlingUnitNo} (đã ${String(issueCount)} lần)`,
    /*
     * 잔량 줄의 안내 — **한 줄이 둘을 다 말한다**(사용자 지시 2026-09-11). 번호를 새로
     * 매기지 않는다는 것과, 다시 뽑을 까닭이 수량 변경뿐이라는 것이다.
     */
    remainderNumberNote: 'Giữ nguyên số cũ, chỉ in lại khi số lượng đã thay đổi.',
    remainderFailed: 'Không xác nhận được đối tượng in lại nhãn phần còn lại.',
    targetRequired: 'Hãy chọn ít nhất một nhãn để in.',
    reissue: (issueCount: number): string =>
      `Đã phát hành ${String(issueCount)} lần. Phát hành nữa sẽ ghi là phát hành lại và cần lý do.`,
    summaryLoading: 'Đang xác nhận tình trạng phát hành.',
    summaryFailed: 'Không tải được tình trạng phát hành. Không biết có cần nhập lý do hay không.',
    lastIssuedAt: 'Phát hành gần nhất',
    lastPrintFailed: 'Lần in gần nhất ghi là thất bại. Nếu nhãn chưa ra, hãy phát hành lại.',

    reasonLabel: 'Lý do phát hành lại',
    reasonPlaceholder: 'Chọn lý do',
    reasonRequired: 'Đây là phát hành lại nên cần lý do.',
    reasonsFailed: 'Không tải được danh sách lý do phát hành lại.',
    reasonsEmpty: 'Không có lý do phát hành lại nào để chọn.',

    printerLabel: 'Máy in',
    printerPlaceholder: 'Chọn máy in',
    printersFailed: 'Không tải được danh sách máy in.',
    printersEmpty: 'Máy trạm này chưa đăng ký máy in. Hãy hỏi người phụ trách.',

    submit: 'Cấp số · In',
    preview: 'Xem trước',
    previewBeforeIssue: 'Phát hành rồi mới xem được.',
    gateRetry: 'Kiểm tra lại',
  },

  preview: {
    title: 'Xem trước nhãn',
    alt: 'Hình ảnh nhãn đã phát hành',
    loading: 'Đang nhận nhãn.',
    failed: 'Không nhận được hình ảnh nhãn.',
    notDrawable: 'Không hiện được nhãn đã nhận lên màn hình. Vẫn in được bình thường.',
    print: 'In',
    close: 'Đóng',
    closeNote: 'Đóng lại thì bản ghi phát hành vẫn còn. Có thể in lại sau.',
  },

  history: {
    sectionLabel: 'Lịch sử phát hành',
    empty: 'Không có lịch sử phát hành.',
    failed: 'Không tải được lịch sử phát hành.',
    seq: (issueSeq: number): string => `Lượt ${String(issueSeq)}`,
    unknownAt: '—',
    outcome: {
      PENDING: 'Chưa báo kết quả in',
      SUCCEEDED: 'In thành công',
      FAILED: 'In thất bại',
    },
  },

  print: {
    issued: 'Đã phát hành',
    succeeded: 'Đã in nhãn.',
    failedTitle: 'Không in được',
    failedBody:
      'Bản ghi phát hành vẫn còn. Hãy kiểm tra máy in và phát hành lại với lý do in thất bại.',
    retry: 'Phát hành lại rồi in',
    reportFailedTitle: 'Đã in nhưng không lưu được kết quả lên máy chủ',
    reportFailedBody: 'Nhãn đã ra. Đừng in lại — chỉ gửi lại báo cáo kết quả.',
    reportRetry: 'Gửi lại báo cáo',
    shellUnavailable: 'Màn hình này không gửi ra máy in được. Hãy in trên máy trạm POP.',
  },

  error: {
    issueTitle: 'Không phát hành được nhãn',
    forbidden: 'Máy trạm này không có quyền in. Hãy hỏi người phụ trách.',
    rejected: 'Máy chủ không chấp nhận yêu cầu. Hãy kiểm tra nội dung đã nhập.',
  },
};
