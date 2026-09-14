import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-02-05 W/O 마감·ERP 실적 송신.
 *
 * ⚠ **마감은 되돌릴 수 없다.** `confirm.irreversible` 이 그것을 마감 «전»에 말한다 — 무르게
 * 옮기면 확인 창이 형식이 된다.
 *
 * ⚠ **정정은 덮어쓰기가 아니라 덧쓰기다.** `immutable` 의 「원본을 지우거나 덮어쓰지 않는다」를
 * 빼면 정정이 원본을 없애는 일로 읽힌다.
 *
 * ⚠ **`상신`(`trình duyệt`)과 `승인`(`phê duyệt`)을 가른다** — 올리는 일과 판단하는 일이다.
 */
export const workOrderClose: Translated<typeof ko.workOrderClose> = {
  title: 'Đóng W/O · gửi kết quả sang ERP',
  breadcrumbRoot: 'Thực thi sản xuất',
  detailSummary: {
    pane: 'Tóm tắt chi tiết đóng lệnh sản xuất',
    heading: 'Chi tiết đóng lệnh sản xuất',
    loading: 'Đang tải chi tiết đóng lệnh sản xuất.',
    selection: {
      title: 'Hãy chọn W/O để đóng.',
      description: 'Chọn một W/O trong danh sách ứng viên để xem tổng hợp chi tiết.',
    },
    groups: {
      order: 'Thông tin cơ bản của lệnh sản xuất',
      progress: 'Tóm tắt kết quả sản xuất',
      preIssuedLots: 'Tóm tắt LOT đã phát trước',
    },
    fields: {
      workOrderNo: 'Số W/O',
      orderQty: 'Số lượng lệnh',
      goodQty: 'Số lượng đạt',
      defectQty: 'Số lượng lỗi',
      holdQty: 'Số lượng tạm giữ',
      scrapQty: 'Số lượng phế liệu',
      reworkQty: 'Số lượng làm lại',
      achievementRate: 'Tỷ lệ đạt',
      varianceQty: 'Số lượng chênh lệch',
      judgment: 'Đánh giá khi đóng',
      slotCount: 'Tất cả LOT phát trước',
      withResultCount: 'Có kết quả',
      withoutResultCount: 'Không có kết quả',
    },
    judgments: { UNDER: 'Thiếu', NORMAL: 'Bình thường', OVER: 'Vượt' },
    values: { notConfirmed: 'Chưa chốt', unitNotConfirmed: 'Chưa rõ đơn vị' },
    units: { percent: '%', count: 'mục' },
    empty: {
      progressTitle: 'Tổng hợp kết quả sản xuất chưa được chốt.',
      progressDescription: 'Khi tổng hợp được xác nhận sẽ hiện số lượng và đánh giá khi đóng.',
      preIssuedLotsTitle: 'Tổng hợp LOT phát trước chưa được chốt.',
      preIssuedLotsDescription: 'Khi tổng hợp được xác nhận sẽ hiện số suất.',
    },
  },
  candidateList: {
    pane: 'Danh sách lệnh sản xuất ứng viên đóng',
    fields: { workOrderNo: 'Số W/O', item: 'Mặt hàng', quantity: 'Số lượng lệnh' },
    actions: { select: (workOrderNo: string) => `Chọn ${workOrderNo}` },
    values: { missingItem: 'Không có tên hiển thị mặt hàng' },
    loading: 'Đang tải danh sách lệnh sản xuất ứng viên đóng.',
    empty: {
      title: 'Không có lệnh sản xuất ứng viên đóng.',
      description: 'Hãy đổi điều kiện tra cứu rồi xem lại.',
      beyondTitle: 'Trang hiện tại không có lệnh sản xuất ứng viên đóng.',
      beyondDescription: 'Hãy về trang đầu hoặc trang trước rồi xem lại.',
    },
  },
  closedCandidateList: {
    pane: 'Danh sách lệnh sản xuất đã đóng',
    loading: 'Đang tải danh sách lệnh sản xuất đã đóng.',
    empty: {
      title: 'Không có lệnh sản xuất nào đã đóng.',
      description: 'Hãy đổi điều kiện tra cứu rồi xem lại.',
      beyondTitle: 'Trang hiện tại không có lệnh sản xuất đã đóng.',
      beyondDescription: 'Hãy về trang đầu hoặc trang trước rồi xem lại.',
    },
  },
  candidateReferences: {
    item: {
      loading: 'Đang xác nhận tên hiển thị mặt hàng.',
      unknown: 'Không xác nhận được tên hiển thị mặt hàng.',
      failed: 'Không tải được tên hiển thị mặt hàng.',
    },
    uom: {
      loading: 'Đang xác nhận đơn vị.',
      unknown: 'Không xác nhận được đơn vị.',
      failed: 'Không tải được đơn vị.',
      truncated: 'Chỉ tải được một phần danh sách đơn vị nên không xác nhận được đơn vị.',
    },
  },
  filter: {
    pane: 'Điều kiện tra cứu ứng viên đóng',
    productionOrder: 'P/O',
    plannedStartFrom: 'Ngày bắt đầu kế hoạch (từ)',
    plannedStartTo: 'Ngày bắt đầu kế hoạch (đến)',
    status: 'Trạng thái đóng',
    all: 'Tất cả',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    statusRequired: 'Hãy chọn trạng thái đóng.',
    dateRange: 'Ngày bắt đầu kế hoạch không được muộn hơn ngày kết thúc.',
    statusEmpty: 'Không có trạng thái đóng nào để chọn.',
    statusLookupLoading: 'Đang tải danh sách trạng thái đóng.',
    statusLookupFailed: 'Không tải được danh sách trạng thái đóng.',
    statusLookupEmpty: 'Không có trạng thái đóng nào dùng được.',
    statusLookupTruncated:
      'Chỉ tải được một phần danh sách trạng thái đóng nên chưa bắt đầu tra cứu lần đầu được.',
    completedStatusMissing:
      'Không xác nhận được trạng thái đã đóng nên chưa bắt đầu tra cứu lần đầu được.',
  },
  confirm: {
    title: (workOrderNo: string) => `Đóng lệnh sản xuất — ${workOrderNo}`,
    target: (workOrderNo: string) => `Lệnh sản xuất đích: ${workOrderNo}`,
    irreversible:
      'Đóng lệnh sản xuất không hoàn tác được. Nếu cần sửa thì hãy xử lý bù trừ kết quả sản xuất.',
    erp: 'Việc gửi sang ERP được tiến hành riêng, và xác nhận này không có nghĩa là đã gửi xong sang ERP.',
    cancel: 'Hủy',
    confirm: 'Đóng lệnh sản xuất',
  },
  closeSuccess: 'Đã đóng lệnh sản xuất. Việc gửi sang ERP được tiến hành riêng.',
  readState: {
    progressUnavailable: 'Không xác nhận được đánh giá kết quả sản xuất.',
    openSessionFailed: 'Không xác nhận được có phiên làm việc đang mở hay không.',
    reasonFailed: 'Không tải được lý do chênh lệch.',
    reasonTruncated: 'Chỉ tải được một phần danh sách lý do chênh lệch nên chưa bắt đầu nhập được.',
  },
  status: {
    pane: 'Trạng thái nhập khi đóng lệnh sản xuất',
    heading: 'Trạng thái nhập hiện tại',
    loading: 'Đang xác nhận điều kiện nhập hiện tại.',
    complete: 'Các điều kiện nhập hiện tại đã đủ.',
    blockers: {
      OPEN_SESSION: 'Hãy đóng phiên làm việc đang mở.',
      REMAINDER_DISPOSITION_REQUIRED: 'Hãy chọn cách xử lý lượng còn lại.',
      VARIANCE_REASON_REQUIRED: 'Hãy chọn lý do chênh lệch.',
    },
  },
  input: {
    pane: 'Nhập khi đóng lệnh sản xuất',
    heading: 'Nhập khi đóng',
    classification: {
      label: 'Đánh giá số lượng',
      SHORTFALL: 'Thiếu',
      EXACT: 'Bình thường',
      OVERAGE: 'Vượt',
    },
    exactNote: 'Số lượng khớp nên không cần nhập thêm lý do.',
    remainder: {
      legend: 'Xử lý lượng còn lại',
      CARRY_OVER: 'Chuyển sang kỳ sau',
      WRITE_OFF: 'Xóa bỏ',
    },
    reason: {
      label: 'Lý do chênh lệch',
      placeholder: 'Hãy chọn lý do.',
      empty: 'Không có lý do nào để chọn.',
    },
    /** 소멸은 다른 전표를 만들지 않아 이유가 이 비고에만 남는다 — 그 사실을 그대로 옮긴다. */
    remarks: {
      label: 'Lý do xóa bỏ (ghi chú)',
      placeholder: 'Lý do xóa bỏ lượng còn lại',
      help: 'Xóa bỏ không tạo ra phiếu nào khác. Ghi lý do thì sẽ lưu làm ghi chú khi đóng.',
    },
  },
  outboundItems: {
    pane: 'Mục gửi sang ERP khi đóng lệnh sản xuất',
    heading: 'Mục gửi sang ERP',
    group: 'Tình trạng mục gửi sang ERP',
    /** 전역 설정이다 — 마감 한 건이 바꾸지 않는다는 사실과 어디서 바꾸는지를 함께 적는다. */
    lead: 'Đây là thiết lập gửi toàn hệ thống. Không kèm vào yêu cầu đóng, và muốn đổi thì đổi ở màn hình thiết lập liên kết.',
    appendixPending:
      'Việc chọn các mục phụ của kết quả sản xuất (vật tư đưa vào · giờ công · giờ thiết bị · dừng máy) sẽ mở khi mã mục được chốt.',
    state: {
      on: 'Gửi',
      off: 'Không gửi',
    },
    loading: 'Đang tải thiết lập mục gửi sang ERP.',
    empty: {
      title: 'Không có mục gửi sang ERP nào được thiết lập.',
      description: 'Hãy tải lại thiết lập để xem.',
    },
    lockedFallback: 'Mục gửi này không thay đổi được.',
    sendTiming: (note: string) => `Thời điểm gửi: ${note}`,
  },
  correction: {
    pane: 'Sửa kết quả sản xuất',
    heading: (workOrderNo: string) => `Danh sách kết quả — ${workOrderNo}`,
    selection: {
      title: 'Hãy chọn W/O đã đóng.',
      description: 'Chọn một lệnh sản xuất đã đóng để xem kết quả sản xuất đã đăng ký.',
    },
    loading: 'Đang tải kết quả sản xuất.',
    loadFailed: 'Không tải được kết quả sản xuất.',
    truncated: 'Chỉ tải được một phần danh sách kết quả nên chưa bắt đầu sửa được.',
    workersUnavailable:
      'Không xác nhận được tên hiển thị người đăng ký nên một số dòng hiện là chưa rõ.',
    reasonUnavailable: 'Không xác nhận được danh sách lý do sửa nên không lưu được.',
    empty: {
      title: 'Không có kết quả sản xuất nào được đăng ký.',
      description: 'Không có kết quả gốc nào để sửa.',
    },
    fields: {
      sequence: 'Số thứ tự',
      occurredAt: 'Thời điểm phát sinh',
      goodQty: 'Đạt',
      defectQty: 'Lỗi',
      holdQty: 'Tạm giữ',
      scrapQty: 'Phế liệu',
      reworkQty: 'Làm lại',
      worker: 'Người đăng ký',
      relation: 'Quan hệ sửa',
      reason: 'Lý do sửa',
      note: 'Ghi chú',
    },
    values: {
      original: 'Bản gốc',
      correctionOf: (sequence: number | null) =>
        sequence === null ? 'Kết quả sửa' : `Sửa số thứ tự ${String(sequence)}`,
      unknownWorker: 'Chưa rõ người đăng ký',
    },
    actions: {
      select: (sequence: number) => `Chọn kết quả số thứ tự ${String(sequence)}`,
      correct: 'Sửa',
      cancel: 'Hủy',
      save: 'Lưu bản sửa',
      requestApproval: 'Trình duyệt',
    },
    immutable:
      'Kết quả sửa cũng được thêm vào cùng danh sách. Kết quả gốc không bị xóa hay ghi đè.',
    errors: {
      quantity: 'Hãy nhập số lượng từ 0 trở lên.',
      reasonRequired: 'Hãy chọn lý do sửa.',
    },
    dialog: {
      title: (workOrderNo: string, sequence: number) =>
        `Nhập bản sửa — ${workOrderNo} số thứ tự ${String(sequence)}`,
      serverGrade: 'Mức của bản sửa do máy chủ đánh giá dựa trên nội dung đã nhập.',
    },
    saved: 'Đã thêm kết quả sửa.',
    approval: {
      title: 'Trình duyệt phê duyệt sửa kết quả sản xuất',
      required:
        'Bản sửa này cần được phê duyệt. Hãy ghi lý do thay đổi để người phê duyệt có thể phán đoán.',
      reason: 'Lý do trình duyệt',
      reasonHint: 'Hãy ghi cụ thể sửa cái gì và sửa bao nhiêu.',
      reasonRequired: 'Hãy nhập lý do trình duyệt.',
      submitted:
        'Đã trình yêu cầu phê duyệt. Sau khi được duyệt, hãy nhập lại nội dung sửa rồi lưu.',
    },
  },
};
