import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-06 생산 실적 등록. */
export const productionResult: Translated<typeof ko.productionResult> = {
  title: 'Đăng ký kết quả sản xuất',
  flow: {
    header: {
      /* ⚠ ERP 쪽 번호와 나란히 서는 자리라 어느 쪽 번호인지 밝힌다(사용자 지시 2026-09-10). */
      erpWorkOrder: 'ERP W/O',
      workOrder: 'MES W/O',
      item: 'Mặt hàng',
      emergency: 'Khẩn',
    },
    currentLot: {
      title: 'Tiến độ LOT',
      current: 'LOT hiện tại',
      sequence: (current: number | null, total: number | null) =>
        `${current === null ? '—' : String(current)} / ${total === null ? '—' : String(total)}`,
      completed: 'Xem danh sách LOT đã đóng',
      completedTitle: 'LOT đã đóng',
      completedEmpty: 'Không có LOT đã đóng.',
      pageNav: 'Chuyển trang LOT đã đóng',
      pageUp: 'Trang trên',
      pageDown: 'Trang dưới',
      pagePosition: (page: number, totalPages: number) =>
        `Trang ${String(page)}/${String(totalPages)}`,
      none: 'Không có LOT để sản xuất. Hãy đóng W/O trên Web quản trị.',
      loadFailed: 'Không tải được LOT hiện tại.',
      ambiguous:
        'Lệnh sản xuất này có từ hai LOT đang chạy trở lên nên không xác định được LOT hiện tại. Hãy đóng LOT trên Web quản trị trước.',
    },
    quantity: {
      title: 'Số lượng sản xuất',
      target: 'Số lượng mục tiêu',
      actual: 'Số lượng sản xuất thực tế',
      invalid: 'Hãy nhập số lượng lớn hơn 0.',
    },
    tag: {
      title: 'Thẻ nhận diện',
      issued: 'Thẻ nhận diện đã in',
      count: (count: number) => `${String(count)} cái`,
      issueMissing: (count: number) => `In ${String(count)} thẻ nhận diện còn thiếu`,
      matched: 'Số lượng sản xuất thực tế khớp với số thẻ nhận diện.',
      tooMany: 'Không thể hạ số lượng sản xuất thực tế xuống dưới số thẻ nhận diện đã tạo.',
      summaryFailed:
        'Không xác nhận được lịch sử phát hành thẻ nhận diện nên chưa mở in nhãn sản xuất.',
      restoreDocuments: (count: number) =>
        `Khôi phục ${String(count)} thẻ nhận diện chưa có bản ghi phát hành`,
      printIncomplete: (count: number) =>
        `Có ${String(count)} thẻ nhận diện đang chờ in hoặc in thất bại. Hãy kiểm tra và in lại.`,
      printOutcome: {
        PENDING: 'Chờ in',
        SUCCEEDED: 'In thành công',
        FAILED: 'In thất bại',
      },
      reissue: 'In lại thẻ nhận diện đã chọn',
      reissueReason: 'Lý do in lại thẻ nhận diện',
      reissueReasonPlaceholder: 'Hãy chọn lý do',
      reasonLoadFailed: 'Không tải được lý do in lại.',
      reasonEmpty: 'Không có lý do in lại để chọn nên không in lại được.',
      issuing: 'Đang phát hành thẻ nhận diện.',
      printFailed: 'Đã ghi phát hành thẻ nhận diện nhưng in ra giấy thất bại.',
      reportFailed:
        'Thẻ nhận diện đã in nhưng chưa báo được kết quả. Đừng in lại, chỉ gửi lại báo cáo.',
      loadFailed: 'Không xác nhận được thẻ nhận diện nên chưa mở in nhãn sản xuất.',
      targetUnknown: 'Không xác nhận được có cần thẻ nhận diện hay không nên chưa mở in.',
      printerUnavailable: 'Không có máy in hỗ trợ thẻ nhận diện.',
    },
    output: {
      title: 'Nhãn LOT',
      template: 'Nhãn LOT sản xuất',
      printer: 'Máy in',
      printerUnknown: 'Không xác nhận được',
      issue: 'In nhãn sản xuất',
      retryIssue: 'Thử phát hành nhãn lại',
      retryPrint: 'In lại nhãn đã phát hành',
      retryReport: 'Gửi lại kết quả',
      queued:
        'Đã lưu kết quả sản xuất vào hàng chờ gửi. Sau khi máy chủ nhận sẽ tiếp tục phát hành nhãn.',
      saving: 'Đang gửi kết quả sản xuất lên máy chủ.',
      issuing: 'Đã lưu kết quả sản xuất · đang phát hành nhãn',
      printing: 'Đã lưu kết quả sản xuất · đang in nhãn',
      printed: 'Đã in nhãn LOT sản xuất · hãy quét nhãn đã dán.',
      issueFailed: 'Đã lưu kết quả sản xuất nhưng phát hành nhãn thất bại.',
      renditionFailed: 'Đã phát hành nhãn nhưng không nhận được dữ liệu in.',
      printFailed: 'Đã phát hành nhãn nhưng chưa in ra.',
      reportFailed: 'Đã in nhãn. Hãy gửi lại kết quả.',
      legacyMismatch: 'Có lịch sử nhãn cũ được tạo không kèm kết quả sản xuất. Chưa mở đóng LOT.',
      mismatchBlocked: 'Cần kiểm tra trạng thái kết quả · nhãn',
      shellUnavailable: 'Không xác nhận được đường in của shell Electron POP.',
      printerUnavailable: 'Không có máy in nhãn dùng được.',
    },
    scan: {
      title: 'Chờ quét',
      label: 'Quét số LOT đã dán',
      /* ⚠ 한 줄로 합친 문구다(사용자 지시 2026-09-10). */
      mismatch:
        'Không tìm thấy nhãn khớp với LOT đã nhập. Hãy kiểm tra lại LOT rồi quét lại đúng nhãn đó.',
      completing: 'Đang đóng đăng ký sản xuất LOT.',
      completed: 'Đã đóng LOT · chuyển sang LOT kế tiếp.',
      failed: 'Không đóng được LOT. Hãy quét lại cùng nhãn.',
      alreadyCompleted: 'LOT này đã đóng. Đang tải lại trạng thái LOT hiện tại.',
    },
    session: {
      failed: 'Không kết thúc được phiên làm việc. Hãy thử lại.',
      unrecoverable:
        'Không thể kết thúc phiên làm việc. Hãy kiểm tra trạng thái phiên ở màn hình [Dừng công việc].',
      retry: 'Thử lại kết thúc phiên',
      denied:
        'Máy trạm này không có quyền hoàn tất công việc của công đoạn này. Phiên làm việc được giữ mở.',
      offline: 'Mất kết nối nên chưa kết thúc được phiên làm việc. Hãy thử lại sau khi có kết nối.',
    },
    gate: {
      input: 'Máy trạm này không dùng được nhập kết quả sản xuất.',
      print: 'Máy trạm này không dùng được in nhãn.',
      complete: 'Máy trạm này không dùng được đóng LOT.',
      unknown: 'Không xác nhận được cấu hình chức năng của máy trạm.',
    },
    retry: 'Thử lại',
    close: 'Đóng',
  },
  entry: {
    workOrderLabel: 'Lệnh sản xuất',
    itemLabel: 'Mặt hàng',
    workerLabel: 'Mã nhân viên',
    missingWorkOrder:
      'Chưa nhận được lệnh sản xuất nên không đăng ký được kết quả. Hãy chọn lệnh sản xuất ở màn hình bắt đầu công việc rồi vào lại.',
    missingWorker:
      'Chưa xác nhận được mã nhân viên nên không lưu được. Hãy xác nhận mã nhân viên trước.',
    loadFailed: 'Không tải được lệnh sản xuất.',
  },
  gate: {
    checking: 'Đang kiểm tra quyền nhập kết quả.',
    denied:
      'Máy trạm này không có quyền nhập kết quả ở công đoạn này. Hãy liên hệ người phụ trách.',
    unavailable: 'Không xác nhận được quyền nhập kết quả. Hãy thử lại sau.',
    unidentified: 'Chưa xác nhận được máy trạm nên không đăng ký được kết quả.',
    retry: 'Thử lại',
  },
  sync: {
    pending: (count: number) => `Chờ gửi ${String(count)} mục`,
  },
  pqc: {
    blockedTitle: 'Còn kiểm tra PQC chưa xong',
    blockedBody: 'Phải hoàn tất kiểm tra sản phẩm của lệnh sản xuất này mới đăng ký được kết quả.',
    goInspect: 'Đến màn hình kiểm tra',
    loadFailed: 'Không xác nhận được yêu cầu kiểm tra nên chưa mở nhập kết quả.',
  },
  lot: {
    sectionLabel: 'LOT đối tượng',
    lotLabel: 'LOT đối tượng',
    itemLabel: 'Thành phẩm',
    change: 'Đổi',
    select: 'Chọn',
    empty: 'Lệnh sản xuất này không có LOT đối tượng.',
    loadFailed: 'Không tải được LOT đối tượng.',
  },
  quantity: {
    sectionLabel: 'Nhập kết quả',
    goodQtyLabel: 'Số lượng đạt',
    remarksLabel: 'Ghi chú',
    keypadLabel: 'Bàn phím số lượng',
    backspace: 'Xóa một ký tự',
    clearGlyph: 'Xóa hết',
    decimalKey: 'Dấu thập phân',
    quickAdd: (step: number) => `＋${String(step)}`,
    remaining: 'Số lượng còn lại',
    orderedSuffix: (ordered: string, uom: string | null) =>
      uom === null ? `/ ${ordered}` : `/ ${ordered} ${uom}`,
    remainingUnknown: 'Không xác nhận được số lượng còn lại.',
    remainingNoWorkOrder: 'Chưa nhận được lệnh sản xuất nên không tính được số lượng còn lại.',
    remainingNotAsked: 'Chưa tra cứu.',
    remainingLoadFailed: 'Không tải được số lượng còn lại. Hãy kiểm tra kết nối rồi thử lại.',
  },
  overrun: {
    notice: (over: string, remaining: string) =>
      `Vượt mức — nhiều hơn số còn lại ${remaining} là ${over}.`,
    noticeNoRemaining: 'Vượt mức — lệnh sản xuất này không còn số lượng còn lại.',
  },
  actions: {
    save: 'Lưu',
    cancel: 'Nhập lại',
  },
  save: {
    successTitle: 'Đã lưu kết quả',
    queuedBody: 'Khi có kết nối sẽ tự động gửi.',
    failTitle: 'Không lưu được kết quả',
    continueBody: 'Vẫn còn số lượng còn lại. Hãy nhập tiếp.',
    lotDoneTitle: 'LOT này không còn số lượng còn lại',
    lotDoneBody: 'Hãy chuyển sang xử lý hoàn thành LOT sản xuất.',
  },
};
