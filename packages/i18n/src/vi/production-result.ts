import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-04 생산 작업. */
export const productionResult: Translated<typeof ko.productionResult> = {
  title: 'Công việc sản xuất',
  flow: {
    work: {
      lot: 'LOT',
      lotProgress: 'Kết quả LOT',
      workOrderProgress: 'Kết quả W/O',
      progressText: (good: string, target: string, uom: string): string =>
        uom === '' ? `${good} / ${target}` : `${good} / ${target} ${uom}`,
      pqc: 'PQC',
      pqcNotInspected: 'Không kiểm tra',
      pqcSkipped: 'Bỏ qua',
      printerNone: 'Không có',
      stepsLabel: 'Các bước làm LOT',
      steps: { input: 'Nhập kết quả', scan: 'Quét nhãn' },
      remaining: (qty: string): string => `Còn lại ${qty}`,
      noLot: 'Không còn LOT để sản xuất.',
      noWorkOrder: 'Chưa chỉ định lệnh sản xuất.',
    },
    next: {
      noWorkOrder: 'Chưa chỉ định lệnh sản xuất. Hãy chọn lệnh sản xuất ở danh sách lệnh sản xuất',
      noWorker: 'Hãy nhập mã nhân viên',
      noLot:
        'W/O này không còn LOT để sản xuất. Nếu đã sản xuất xong hãy đóng lệnh sản xuất, nếu cần làm thêm hãy báo quản trị viên',
      queued: 'Đã lưu kết quả trên máy trạm. Khi có kết nối sẽ gửi và phát hành nhãn LOT',
      saving: 'Đang lưu kết quả',
      issuing: 'Đang phát hành nhãn LOT',
      printing: 'Đang in nhãn LOT',
      scan: 'Hãy quét nhãn LOT đã dán',
      retry: (buttonWithObject: string): string => `Hãy bấm ${buttonWithObject}`,
      legacyMismatch:
        'Có lịch sử nhãn cũ tạo không kèm kết quả nên không đóng được LOT. Hãy báo quản trị viên',
      completing: 'Đang đóng LOT',
      completed: 'Đang tải LOT kế tiếp',
      printer: 'Không có máy in nhãn LOT dùng được. Hãy nhờ quản trị viên kết nối máy in',
      shell: 'Không xác nhận được đường in của chương trình POP. Hãy báo quản trị viên',
      tagUnknown:
        'Không xác nhận được có cần thẻ nhận diện hay không. Hãy kiểm tra kết nối rồi mở lại màn hình',
      tag: 'Phải in đủ thẻ nhận diện mới in được nhãn sản xuất. Hãy báo quản trị viên',
      qty: 'Hãy nhập số lượng đạt',
      defectOnly: 'Để chỉ đăng ký lỗi hãy bấm Đăng ký lỗi',
      defectType: 'Hãy chọn loại lỗi',
      defectQty: 'Hãy nhập số lượng lỗi',
      defectDuplicate: 'Cùng một loại lỗi nằm ở hai dòng. Hãy xóa một dòng',
      ready: 'Có thể chuyển sang Quét nhãn',
    },
    currentLot: {
      current: 'LOT hiện tại',
      completed: 'LOT đã đóng',
      completedTitle: 'LOT đã đóng',
      completedEmpty: 'Không có LOT đã đóng.',
      pageNav: 'Chuyển trang LOT đã đóng',
      pageUp: 'Trang trên',
      pageDown: 'Trang dưới',
      pagePosition: (page: number, totalPages: number) =>
        `Trang ${String(page)}/${String(totalPages)}`,
      unreliable: (lotNos: string): string =>
        `Máy chủ không xác định được một LOT hiện tại (LOT ${lotNos}). Đã chặn nhập để kết quả không gắn vào LOT khác. Hãy nhờ quản trị viên kiểm tra máy chủ đã là bản mới nhất chưa.`,
      loadFailed: 'Không tải được LOT hiện tại. Hãy kiểm tra kết nối rồi bấm «Thử lại».',
    },
    quantity: {
      actual: 'Số lượng đạt',
      invalid: 'Hãy nhập số lượng lớn hơn 0.',
    },
    defects: {
      title: 'Lỗi',
      add: 'Thêm lỗi',
      row: (index: number): string => `Lỗi ${String(index)}`,
      type: 'Loại lỗi',
      choose: 'Chọn loại',
      qty: 'Số lượng lỗi',
      remove: (label: string): string => `Xóa ${label}`,
      duplicate: 'Loại lỗi này đã có.',
      typeMissing: 'Hãy chọn loại',
      qtyMissing: 'Hãy nhập số lượng',
      noProcess: 'W/O không có công đoạn nên không chọn được loại lỗi.',
      keypadGood: 'Bàn phím số lượng đạt',
      keypadFor: (target: string): string => `Bàn phím số lượng lỗi ${target}`,
      pickerTitle: 'Loại lỗi',
      pickerTitleFor: (major: string): string => `Loại lỗi ${major}`,
      back: '← Nhóm lớn',
      cancel: 'Hủy',
      loading: 'Đang tải loại lỗi.',
      loadFailed: 'Không tải được loại lỗi.',
      empty: 'Công đoạn này chưa có loại lỗi.',
      saveOnly: 'Đăng ký lỗi',
      saved: 'Đã đăng ký lỗi.',
      queued: 'Đã lưu lỗi trên máy trạm. Sẽ gửi khi có kết nối.',
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
      template: 'Nhãn LOT sản xuất',
      printer: 'Máy in',
      issue: 'In nhãn sản xuất',
      retryIssue: 'Thử phát hành nhãn lại',
      retryPrint: 'In lại nhãn',
      retryReport: 'Gửi lại kết quả',
      printed: 'Đã in nhãn LOT.',
      issueFailed: 'Đã lưu kết quả nhưng không phát hành được nhãn LOT.',
      renditionFailed: 'Đã phát hành nhãn LOT nhưng không nhận được dữ liệu in.',
      printFailed: 'Đã phát hành nhãn LOT nhưng chưa in ra.',
      reportFailed: 'Đã in nhãn LOT nhưng chưa gửi được kết quả. Đừng in lại, chỉ gửi lại kết quả.',
      legacyMismatch: 'Có lịch sử nhãn cũ tạo không kèm kết quả.',
      shellUnavailable: 'Không xác nhận được đường in của chương trình POP.',
    },
    scan: {
      title: 'Quét nhãn',
      label: 'Quét',
      placeholder: 'Nhãn LOT đã dán',
      /* ⚠ 한 줄로 합친 문구다(사용자 지시 2026-09-10). */
      mismatch:
        'Không tìm thấy nhãn khớp với LOT đã nhập. Hãy kiểm tra lại LOT rồi quét lại đúng nhãn đó.',
      completed: 'Đã đóng LOT.',
      failed: 'Không đóng được LOT. Hãy quét lại cùng nhãn.',
      alreadyCompleted: 'LOT này đã đóng. Đang tải lại trạng thái LOT hiện tại.',
      noAllocation: 'LOT này chưa có kết quả đã lưu nên không đóng được. Hãy lưu kết quả trước.',
      workOrderClosed: (menuPath: string, correction: string): string =>
        `Lệnh sản xuất này đã đóng nên không đóng LOT thiếu được. Lệnh đã đóng không mở lại được, nếu cần sửa số lượng hãy nhờ quản trị viên dùng «${correction}» ở ${menuPath} trên web quản lý.`,
    },
    woClose: {
      button: 'Đóng lệnh sản xuất',
      title: (workOrderNo: string): string => `Đóng lệnh sản xuất ${workOrderNo}`,
      loading: 'Đang kiểm tra lệnh sản xuất cần đóng.',
      loadFailed: 'Không tải được lệnh sản xuất. Hãy kiểm tra kết nối rồi bấm «Thử lại».',
      fields: {
        orderQty: 'Số lượng lệnh',
        goodQty: 'Lũy kế đạt',
        judgment: 'Đánh giá',
        shortfallQty: 'Số lượng thiếu',
        overageQty: 'Số lượng vượt',
        remainder: 'Xử lý lượng còn lại',
        reason: 'Lý do',
        remarks: 'Lý do xóa bỏ (ghi chú, tùy chọn)',
      },
      judgments: { UNDER: 'Thiếu', NORMAL: 'Bình thường', OVER: 'Vượt' },
      remainder: { CARRY_OVER: 'Chuyển sang kỳ sau', WRITE_OFF: 'Xóa bỏ' },
      carryOverNote: (menuPath: string): string =>
        `W/O chuyển sang kỳ sau không được tạo tự động. Sẽ lập mới ở ${menuPath} trên web quản lý.`,
      prefilled: 'Đây là lý do đã chọn khi đóng LOT. Có thể đổi.',
      reasonsLoading: 'Đang tải lý do.',
      reasonsFailed: 'Không tải được lý do. Hãy kiểm tra kết nối rồi mở lại cửa sổ.',
      reasonsEmpty: 'Không có lý do nào để chọn. Hãy nhờ quản trị viên đăng ký lý do.',
      voidedSlots: (count: number): string =>
        `${String(count)} LOT chưa có kết quả sẽ bị hủy số cùng lúc đóng.`,
      openLots: (count: number, lotNos: string): string =>
        `${String(count)} LOT chưa đóng (${lotNos}) sẽ giữ nguyên trạng thái.`,
      irreversible:
        'Đã đóng thì không hoàn tác được. Kết quả sản xuất sẽ vào hàng đợi gửi sang ERP cùng lúc đóng.',
      needRemainder:
        'Vì thiếu nên phải chọn xử lý lượng còn lại (chuyển sang kỳ sau hoặc xóa bỏ) mới đóng được.',
      needReason: 'Vì thiếu hoặc vượt nên phải chọn lý do mới đóng được.',
      judgmentMissing:
        'Không tải được đánh giá nên chưa đóng được. Hãy kiểm tra kết nối rồi bấm «Thử lại».',
      openLotsChecking: 'Đang kiểm tra LOT đang thực hiện. Kiểm tra xong mới đóng được.',
      openLotsUnknown:
        'Chưa kiểm tra được LOT đang thực hiện. Dù đóng, LOT đang thực hiện vẫn giữ nguyên trạng thái.',
      uncheckedLots: (count: number): string =>
        `Còn ${String(count)} LOT chưa hoàn thành chưa kiểm tra được. Dù đóng, các LOT đó vẫn giữ nguyên trạng thái.`,
      sessions: {
        checking: 'Đang kiểm tra phiên làm việc của lệnh sản xuất này.',
        loadFailed: 'Không kiểm tra được phiên làm việc. Hãy kiểm tra kết nối rồi bấm «Thử lại».',
        blocked:
          'Các phiên làm việc dưới đây đang mở nên chưa đóng được. Hãy kết thúc phiên ở nơi kết thúc rồi bấm lại.',
        listLabel: 'Phiên làm việc đang mở',
        terminal: 'Máy',
        worker: 'Công nhân',
        state: 'Trạng thái',
        where: 'Nơi kết thúc',
        RUNNING: 'Đang làm',
        STOPPED: 'Tạm dừng',
        unknown: 'Không xác định được',
        workerValue: (name: string, workerNo: string): string => `${name} (${workerNo})`,
        here: (holdScreen: string): string => `Màn hình «${holdScreen}» của máy này`,
        other: (webMenu: string): string =>
          `Máy đó, hoặc buộc kết thúc ở ${webMenu} trên web quản lý`,
      },
      endForbidden:
        'Máy này không có quyền kết thúc phiên làm việc nên chưa đóng. Hãy nhờ quản trị viên buộc kết thúc phiên trên web quản lý.',
      endNotFound:
        'Không tìm thấy phiên làm việc của máy này nên chưa đóng. Có thể đã kết thúc rồi, hãy đóng cửa sổ và mở lại.',
      endedButNotClosed:
        'Phiên làm việc của máy này đã kết thúc nhưng lệnh sản xuất chưa được đóng. Hãy xem lý do bên dưới rồi bấm lại.',
      cancel: 'Hủy',
      confirm: 'Đóng',
      done: (workOrderNo: string): string =>
        `Đã đóng ${workOrderNo}. Quay lại màn hình danh sách lệnh sản xuất.`,
      blocked: {
        denied: (webMenu: string, terminalMenu: string): string =>
          `Máy này không được phép đóng lệnh sản xuất. Hãy đóng ở ${webMenu} trên web quản lý, hoặc nhờ quản trị viên bật «Đóng lệnh sản xuất» ở ${terminalMenu}.`,
        checking: 'Đang kiểm tra quyền đóng của máy này.',
        unavailable:
          'Chưa kiểm tra được quyền đóng của máy này. Hãy kiểm tra kết nối rồi mở lại màn hình.',
        offline: 'Mất kết nối nên không đóng được. Hãy kiểm tra kết nối rồi bấm lại.',
        pending: (count: number): string =>
          `Còn ${String(count)} kết quả chưa gửi. Hãy đóng sau khi đã gửi hết kết quả.`,
        status:
          'Lệnh sản xuất này chưa bắt đầu làm nên chưa đóng được. Chỉ đóng được lệnh đã bắt đầu làm.',
        unidentified:
          'Chưa xác định được máy hoặc công đoạn nên chưa đóng được. Hãy nhờ quản trị viên kiểm tra đăng ký máy và ánh xạ công đoạn.',
        cancelled: 'Lệnh sản xuất đã hủy thì không đóng được.',
      },
      endFailed:
        'Không kết thúc được phiên làm việc của máy này nên chưa đóng. Hãy kiểm tra kết nối rồi bấm lại.',
    },
    underReason: {
      title: 'Lý do thiếu',
      summary: (target: string, actual: string): string =>
        `Số lượng LOT ${target}, thực tế ${actual}`,
      cancel: 'Hủy',
      loading: 'Đang tải lý do thiếu.',
      loadFailed: 'Không tải được lý do thiếu.',
      empty: 'Không có lý do thiếu để chọn.',
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
      'Chưa nhận được lệnh sản xuất nên không đăng ký được kết quả. Hãy chọn lệnh sản xuất ở màn hình danh sách lệnh sản xuất rồi vào lại.',
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
    goInspect: 'Đến màn hình kiểm tra',
    splitTitle: 'Kiểm tra sản phẩm PQC',
    splitNote: 'Số lượng kiểm tra, đánh giá, xác nhận kết quả',
    loadFailed: 'Không tải được thông tin PQC. Hãy thử lại.',
  },
  zone: {
    title: 'Kết quả sản xuất',
    note: 'Nhập kết quả, quét nhãn',
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
  },
  overrun: {
    notice: (over: string, remaining: string) =>
      `Nhiều hơn số còn lại ${remaining} là ${over}. Vẫn có thể đăng ký sản xuất vượt.`,
    noticeNoRemaining:
      'Lệnh sản xuất này không còn số lượng còn lại. Vẫn có thể đăng ký sản xuất vượt.',
    achieved: 'Đã đạt số lượng kế hoạch',
    achievedOver: (over: string): string => `Vượt mức ${over}`,
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
