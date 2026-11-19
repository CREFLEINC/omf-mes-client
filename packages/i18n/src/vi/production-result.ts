import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-04 생산 작업. */
export const productionResult: Translated<typeof ko.productionResult> = {
  title: 'Công việc sản xuất',
  flow: {
    work: {
      /** 라벨을 낸 뒤 왼쪽에 보이는 이 LOT 실적(사용자 지시 2026-11-16). */
      enteredResult: 'Kết quả đã nhập',
      enteredGood: (qty: string, uom: string): string => `Đạt ${qty}${uom === '' ? '' : ` ${uom}`}`,
      enteredDefect: (qty: string, uom: string): string =>
        `Lỗi ${qty}${uom === '' ? '' : ` ${uom}`}`,
      workOrderProgress: 'Tiến độ toàn lệnh',
      workOrderProgressText: (good: string, target: string, uom: string): string =>
        `Đạt ${good} / Số lượng lệnh ${target}${uom === '' ? '' : ` ${uom}`}`,
      stepsLabel: 'Các bước làm LOT',
      steps: { input: 'Nhập kết quả', defect: 'Đăng ký lỗi', scan: 'Quét nhãn' },
      toGood: 'Quay lại',
      remaining: (qty: string): string => `Còn lại ${qty}`,
      noLot: 'Không có LOT có thể sản xuất nên chỉ có thể đăng ký lỗi.',
      planReachedNoLot:
        'Đã đạt số lượng lệnh và không còn LOT có thể sản xuất. Chỉ có thể đóng lệnh sản xuất hoặc đăng ký lỗi.',
      noWorkOrder: 'Chưa chỉ định lệnh sản xuất.',
      noWorkOrderHint: 'Vui lòng chọn lệnh ở danh sách lệnh sản xuất.',
      planReached: 'Đã đạt số lượng lệnh. Có thể đóng lệnh sản xuất.',
      printerNone: 'Chưa kết nối máy in',
      printerUnknown: 'Không xác định máy in',
      closed: 'Đã hoàn tất đóng lệnh sản xuất.',
      completedLots: 'LOT đã đóng',
    },
    actions: {
    },
    next: {
      noWorkOrder:
        'Chưa chỉ định lệnh sản xuất. Vui lòng chọn lệnh sản xuất ở danh sách lệnh sản xuất',
      noWorker: 'Vui lòng nhập mã nhân viên',
      queued: 'Đã lưu kết quả trên máy trạm. Khi có kết nối sẽ gửi và phát hành nhãn LOT',
      saving: 'Đang lưu kết quả',
      issuing: 'Đang phát hành nhãn LOT',
      completing: 'Đang đóng LOT',
      completed: 'Đang tải LOT kế tiếp',
      shell: 'Không xác nhận được đường in của chương trình POP. Vui lòng báo quản trị viên',
      tagUnknown:
        'Không xác nhận được có cần thẻ nhận diện hay không. Vui lòng kiểm tra kết nối rồi mở lại màn hình',
      tag: 'Phải in đủ thẻ nhận diện mới in được nhãn LOT. Vui lòng báo quản trị viên',
      defectDuplicate: 'Cùng một loại lỗi nằm ở hai dòng. Vui lòng xóa một dòng',
    },
    currentLot: {
      current: 'LOT hiện tại',
      completed: 'LOT đã đóng',
      /** 이 화면에서 방금 마감한 LOT 표시(사용자 지시 2026-11-16). */
      justCompleted: 'Đã đóng',
      completedEmpty: 'Không có LOT đã đóng.',
      pageNav: 'Chuyển trang LOT đã đóng',
      unreliable: (lotNos: string): string =>
        `Máy chủ không xác định được một LOT hiện tại (LOT ${lotNos}). Đã chặn nhập để kết quả không gắn vào LOT khác. Vui lòng nhờ quản trị viên kiểm tra máy chủ đã là bản mới nhất chưa.`,
      loadFailed: 'Không tải được LOT hiện tại. Vui lòng kiểm tra kết nối rồi bấm «Thử lại».',
    },
    quantity: {
      actual: 'Đạt',
      invalid: 'Vui lòng nhập số lượng lớn hơn 0.',
    },
    defects: {
      title: 'Lỗi',
      add: 'Thêm lỗi',
      row: (index: number): string => `Lỗi ${String(index)}`,
      type: 'Loại lỗi',
      choose: 'Chọn loại',
      qty: 'Lỗi',
      remove: (label: string): string => `Xóa ${label}`,
      duplicate: 'Loại lỗi này đã có.',
      noProcess: 'W/O không có công đoạn nên không chọn được loại lỗi.',
      emptyRows: 'Chưa có dòng lỗi',
      emptyHint: 'Nhập dòng bằng [Thêm lỗi].',
      pageNav: 'Chuyển trang dòng lỗi',
      cancel: 'Hủy',
      loading: 'Đang tải loại lỗi.',
      loadFailed: 'Không tải được loại lỗi.',
      empty: 'Công đoạn này chưa có loại lỗi.',
      saveOnly: 'Đăng ký lỗi',
      /** [불량 등록] 확인 창(사용자 지시 2026-11-16). */
      confirmTitle: 'Đăng ký lỗi',
      confirmLead: 'Đăng ký các lỗi sau?',
      confirmNote: 'Khi đăng ký lỗi, nhãn LOT sẽ không được in.',
      confirmSave: 'Đăng ký',
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
      summaryFailed: 'Không xác nhận được lịch sử phát hành thẻ nhận diện nên chưa mở in nhãn LOT.',
      restoreDocuments: (count: number) =>
        `Khôi phục ${String(count)} thẻ nhận diện chưa có bản ghi phát hành`,
      printIncomplete: (count: number) =>
        `Có ${String(count)} thẻ nhận diện đang chờ in hoặc in thất bại. Vui lòng kiểm tra và in lại.`,
      printOutcome: {
        PENDING: 'Chờ in',
        SUCCEEDED: 'In thành công',
        FAILED: 'In thất bại',
      },
      reissue: 'In lại thẻ nhận diện đã chọn',
      reissueReason: 'Lý do in lại thẻ nhận diện',
      reissueReasonPlaceholder: 'Vui lòng chọn lý do',
      reasonLoadFailed: 'Không tải được lý do in lại.',
      reasonEmpty: 'Không có lý do in lại để chọn nên không in lại được.',
      issuing: 'Đang phát hành thẻ nhận diện.',
      printFailed: 'Đã ghi phát hành thẻ nhận diện nhưng in ra giấy thất bại.',
      reportFailed:
        'Thẻ nhận diện đã in nhưng chưa báo được kết quả. Đừng in lại, chỉ gửi lại báo cáo.',
      loadFailed: 'Không xác nhận được thẻ nhận diện nên chưa mở in nhãn LOT.',
      targetUnknown: 'Không xác nhận được có cần thẻ nhận diện hay không nên chưa mở in.',
      printerUnavailable: 'Không có máy in hỗ trợ thẻ nhận diện.',
    },
    output: {
      template: 'Nhãn LOT sản xuất',
      issue: 'In nhãn LOT',
      /** 라벨 스캔을 기다리는 동안 하단 버튼(사용자 지시 2026-11-16). */
      reprint: 'In lại nhãn LOT',
      retryIssue: 'Thử phát hành nhãn lại',
      retryPrint: 'In lại nhãn',
      retryReport: 'Gửi lại kết quả',
      printed: 'Đã in nhãn LOT. Dán nhãn rồi vui lòng quét.',
      issueFailed: 'Đã lưu kết quả nhưng không phát hành được nhãn LOT.',
      renditionFailed: 'Đã phát hành nhãn LOT nhưng không nhận được dữ liệu in.',
      printFailed: 'Đã phát hành nhãn LOT nhưng chưa in ra.',
      reportFailed: 'Đã in nhãn LOT nhưng chưa gửi được kết quả. Đừng in lại, chỉ gửi lại kết quả.',
      legacyMismatch: 'Có lịch sử nhãn cũ tạo không kèm kết quả.',
      shellUnavailable: 'Không xác nhận được đường in của chương trình POP.',
    },
    scan: {
      title: 'Quét nhãn',
      label: 'Số LOT',
      /* ⚠ 한 줄로 합친 문구다(사용자 지시 2026-09-10). */
      mismatch: (lotNo: string): string =>
        `Không phải nhãn LOT vừa in. Hãy tìm nhãn ${lotNo} rồi quét.`,
      completed: 'Đã đóng LOT.',
      failed: 'Không đóng được LOT. Vui lòng quét lại cùng nhãn.',
      alreadyCompleted: 'LOT này đã đóng. Đang tải lại trạng thái LOT hiện tại.',
      noAllocation:
        'LOT này chưa có kết quả đã lưu nên không đóng được. Vui lòng lưu kết quả trước.',
      workOrderClosed: (menuPath: string, correction: string): string =>
        `Lệnh sản xuất này đã đóng nên không đóng LOT thiếu được. Lệnh đã đóng không mở lại được, nếu cần sửa số lượng vui lòng nhờ quản trị viên dùng «${correction}» ở ${menuPath} trên web quản lý.`,
    },
    woClose: {
      button: 'Đóng lệnh sản xuất',
      title: (workOrderNo: string): string => `Đóng lệnh sản xuất ${workOrderNo}`,
      titleLead: 'Đóng lệnh sản xuất',
      required: 'Bắt buộc',
      loading: 'Đang kiểm tra lệnh sản xuất cần đóng.',
      loadFailed: 'Không tải được lệnh sản xuất. Vui lòng kiểm tra kết nối rồi bấm «Thử lại».',
      fields: {
        orderQty: 'Số lượng lệnh',
        goodQty: 'Lũy kế đạt',
        judgment: 'Đánh giá',
        shortfallQty: 'Lượng thiếu',
        overageQty: 'Lượng vượt',
        remainder: 'Xử lý lượng còn lại',
        reason: 'Lý do đóng',
        remarks: 'Lý do xóa bỏ (ghi chú, tùy chọn)',
      },
      judgments: { UNDER: 'Thiếu', NORMAL: 'Bình thường', OVER: 'Vượt' },
      remainder: { CARRY_OVER: 'Chuyển sang kỳ sau', WRITE_OFF: 'Xóa bỏ' },
      /** 마감 사유 선택 칸의 회색 글(시안). */
      reasonPlaceholder: 'Chọn lý do',
      reasonsLoading: 'Đang tải lý do.',
      reasonsFailed: 'Không tải được lý do. Vui lòng kiểm tra kết nối rồi mở lại cửa sổ.',
      reasonsEmpty: 'Không có lý do nào để chọn. Vui lòng nhờ quản trị viên đăng ký lý do.',
      voidedTitle: 'LOT sẽ bị hủy số',
      openTitle: 'LOT chưa đóng',
      lotCount: (count: number): string => `${String(count)} mục`,
      irreversible: 'Sau khi đóng không thể hủy. Kết quả ERP sẽ được đưa vào hàng đợi gửi.',
      needRemainder:
        'Vì thiếu nên phải chọn xử lý lượng còn lại (chuyển sang kỳ sau hoặc xóa bỏ) mới đóng được.',
      needReason: 'Vì thiếu hoặc vượt nên phải chọn lý do mới đóng được.',
      judgmentMissing:
        'Không tải được đánh giá nên chưa đóng được. Vui lòng kiểm tra kết nối rồi bấm «Thử lại».',
      openLotsChecking: 'Đang kiểm tra LOT đang thực hiện. Kiểm tra xong mới đóng được.',
      openLotsUnknown:
        'Chưa kiểm tra được LOT đang thực hiện. Dù đóng, LOT đang thực hiện vẫn giữ nguyên trạng thái.',
      uncheckedLots: (count: number): string =>
        `Còn ${String(count)} LOT chưa hoàn thành chưa kiểm tra được. Dù đóng, các LOT đó vẫn giữ nguyên trạng thái.`,
      sessions: {
        checking: 'Đang kiểm tra phiên làm việc của lệnh sản xuất này.',
        loadFailed:
          'Không kiểm tra được phiên làm việc. Vui lòng kiểm tra kết nối rồi bấm «Thử lại».',
        blocked:
          'Các phiên làm việc dưới đây đang mở nên chưa đóng được. Vui lòng kết thúc phiên ở nơi kết thúc rồi bấm lại.',
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
        'Máy này không có quyền kết thúc phiên làm việc nên chưa đóng. Vui lòng nhờ quản trị viên buộc kết thúc phiên trên web quản lý.',
      endNotFound:
        'Không tìm thấy phiên làm việc của máy này nên chưa đóng. Có thể đã kết thúc rồi, vui lòng đóng cửa sổ và mở lại.',
      endedButNotClosed:
        'Phiên làm việc của máy này đã kết thúc nhưng lệnh sản xuất chưa được đóng. Vui lòng xem lý do bên dưới rồi bấm lại.',
      cancel: 'Hủy',
      confirm: 'Đóng',
      done: (workOrderNo: string): string =>
        `Đã đóng ${workOrderNo}. Quay lại màn hình danh sách lệnh sản xuất.`,
      blocked: {
        denied: (webMenu: string, terminalMenu: string): string =>
          `Máy này không được phép đóng lệnh sản xuất. Vui lòng đóng ở ${webMenu} trên web quản lý, hoặc nhờ quản trị viên bật «Đóng lệnh sản xuất» ở ${terminalMenu}.`,
        checking: 'Đang kiểm tra quyền đóng của máy này.',
        unavailable:
          'Chưa kiểm tra được quyền đóng của máy này. Vui lòng kiểm tra kết nối rồi mở lại màn hình.',
        offline: 'Mất kết nối nên không đóng được. Vui lòng kiểm tra kết nối rồi bấm lại.',
        pending: (count: number): string =>
          `Còn ${String(count)} kết quả chưa gửi. Vui lòng đóng sau khi đã gửi hết kết quả.`,
        status:
          'Lệnh sản xuất này chưa bắt đầu làm nên chưa đóng được. Chỉ đóng được lệnh đã bắt đầu làm.',
        unidentified:
          'Chưa xác định được máy hoặc công đoạn nên chưa đóng được. Vui lòng nhờ quản trị viên kiểm tra đăng ký máy và ánh xạ công đoạn.',
        cancelled: 'Lệnh sản xuất đã hủy thì không đóng được.',
      },
      endFailed:
        'Không kết thúc được phiên làm việc của máy này nên chưa đóng. Vui lòng kiểm tra kết nối rồi bấm lại.',
    },
    underReason: {
      title: 'Lý do thiếu',
      lotQty: 'Số lượng LOT',
      actualQty: 'Sản lượng thực tế',
      cancel: 'Hủy',
      loading: 'Đang tải lý do thiếu.',
      loadFailed: 'Không tải được lý do thiếu.',
      empty: 'Không có lý do thiếu để chọn.',
    },
    session: {
      failed: 'Không kết thúc được phiên làm việc. Vui lòng thử lại.',
      unrecoverable:
        'Không thể kết thúc phiên làm việc. Vui lòng kiểm tra trạng thái phiên ở màn hình [Dừng công việc].',
      retry: 'Thử lại kết thúc phiên',
      denied:
        'Máy trạm này không có quyền hoàn tất công việc của công đoạn này. Phiên làm việc được giữ mở.',
      offline:
        'Mất kết nối nên chưa kết thúc được phiên làm việc. Vui lòng thử lại sau khi có kết nối.',
    },
    gate: {
      input: 'Máy trạm này không dùng được nhập kết quả sản xuất.',
      print: 'Máy trạm này không dùng được in nhãn.',
      complete: 'Máy trạm này không dùng được đóng LOT.',
      unknown: 'Không xác nhận được cấu hình chức năng của máy trạm.',
    },
    retry: 'Thử lại',
    close: 'Đóng',
    keypad: {
      title: 'Nhập',
      unit: (uom: string): string => `Đơn vị ${uom}`,
    },
  },
  entry: {
    workOrderLabel: 'Lệnh sản xuất',
    itemLabel: 'Mặt hàng',
    workerLabel: 'Mã nhân viên',
    missingWorkOrder:
      'Chưa nhận được lệnh sản xuất nên không đăng ký được kết quả. Vui lòng chọn lệnh sản xuất ở màn hình danh sách lệnh sản xuất rồi vào lại.',
    loadFailed: 'Không tải được lệnh sản xuất.',
  },
  gate: {
    checking: 'Đang kiểm tra quyền nhập kết quả.',
    denied:
      'Máy trạm này không có quyền nhập kết quả ở công đoạn này. Vui lòng liên hệ người phụ trách.',
    unavailable: 'Không xác nhận được quyền nhập kết quả. Vui lòng thử lại sau.',
    unidentified: 'Chưa xác nhận được máy trạm nên không đăng ký được kết quả.',
    retry: 'Thử lại',
  },
  sync: {
    pending: (count: number) => `Chờ gửi ${String(count)} mục`,
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
    quickAdd: (step: number) => `＋${String(step)}`,
  },
  overrun: {
    notice: (over: string, remaining: string) =>
      `Nhiều hơn số còn lại ${remaining} là ${over}. Vẫn có thể đăng ký sản xuất vượt.`,
    noticeNoRemaining:
      'Lệnh sản xuất này không còn số lượng còn lại. Vẫn có thể đăng ký sản xuất vượt.',
    achieved: 'Đã đạt số lượng lệnh',
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
    continueBody: 'Vẫn còn số lượng còn lại. Vui lòng nhập tiếp.',
    lotDoneTitle: 'LOT này không còn số lượng còn lại',
    lotDoneBody: 'Vui lòng chuyển sang xử lý hoàn thành LOT sản xuất.',
  },
};
