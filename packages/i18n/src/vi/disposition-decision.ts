import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-03-10 처분 판정 처리. 부적합 하나를 골라 재작업·폐기·정상 중 무엇을 할지 정한다.
 *
 * ⚠ 「판정」(`đánh giá`)과 「처분」(`quyết định xử lý`)은 다른 일이다 — 판정은 가르는 일이고
 * 처분은 가른 뒤 무엇을 할지다. 용어집의 짝을 그대로 두고 한 화면 안에서 섞지 않는다.
 */
export const dispositionDecision: Translated<typeof ko.dispositionDecision> = {
  title: 'Ra quyết định xử lý',
  breadcrumbRoot: 'Quản lý chất lượng',
  /** 탭 줄 오른쪽 상태 칩 — 「판정 대기 3」. 건수를 아직 모르면 이름만(#223). */
  statusChip: (label: string, count: number | undefined): string =>
    count === undefined ? label : `${label} ${String(count)}`,
  /** 조회 조건의 상세 펼치기 — 심각도 · 원천(사용자 지시 · #223). */
  filterDetail: { open: 'Mở rộng điều kiện', close: 'Thu gọn điều kiện' },
  tabs: {
    label: 'Xem đánh giá quyết định xử lý',
    pending: 'Chờ đánh giá',
    history: 'Lịch sử xử lý',
    pendingCount: (count: number | undefined): string =>
      count === undefined ? 'Chờ đánh giá' : `Chờ đánh giá ${String(count)}`,
    historyCount: (count: number | undefined): string =>
      count === undefined ? 'Lịch sử xử lý' : `Lịch sử xử lý ${String(count)}`,
  },
  panes: {
    filter: 'Điều kiện tra cứu',
    list: 'Danh sách chờ đánh giá',
    detail: 'Mục không phù hợp đã chọn',
    detailDecision: 'Chi tiết và quyết định',
    historyDetail: 'Chi tiết không phù hợp',
    decision: 'Đánh giá',
    history: 'Lịch sử đánh giá quyết định xử lý',
    lots: 'LOT liên quan',
    decisions: 'Lịch sử đánh giá',
  },
  fields: {
    /** 조회 조건 선택칸 이름 — 「…선택」(사용자 지시 · #223). */
    severityPick: 'Chọn mức độ',
    sourcePick: 'Chọn nguồn',
    period: 'Ngày tiếp nhận',
    openedFrom: 'Ngày tiếp nhận từ',
    openedTo: 'Ngày tiếp nhận đến',
    decidedPeriod: 'Ngày đánh giá',
    decidedFrom: 'Ngày đánh giá từ',
    decidedTo: 'Ngày đánh giá đến',
    historyType: 'Loại xử lý',
    historyQty: 'Số lượng xử lý',
    historyReason: 'Lý do đánh giá',
    item: 'Mặt hàng',
    severityCode: 'Mức nghiêm trọng',
    statusCode: 'Trạng thái xử lý',
    sourceCode: 'Nguồn',
    nonconformanceNo: 'Số không phù hợp',
    openedAt: 'Ngày tiếp nhận',
    qty: 'Số lượng',
    description: 'Mô tả',
    lotNo: 'LOT',
    uom: 'Đơn vị',
    qualityStatus: 'Trạng thái chất lượng',
    dispositionTypeCode: 'Quyết định xử lý',
    decisionQty: 'Số lượng',
    reason: 'Lý do',
    decidedAt: 'Thời điểm đánh giá',
    decidedBy: 'Người đánh giá',
    remainingQty: 'Số lượng còn lại',
    dispositionProgressCode: 'Tình trạng đánh giá',
  },
  all: 'Tất cả',
  codePending: 'Giá trị gốc để chọn vẫn chưa sẵn sàng',
  codePlaceholder: 'Đang chuẩn bị giá trị gốc',
  codeLock: {
    loading: 'Đang tải giá trị gốc',
    failed: 'Không tải được giá trị gốc. Hãy tra cứu lại',
    empty: 'Chưa có giá trị gốc nào được đăng ký. Phải có giá trị trong mã chung thì mới chọn được',
  },
  codeTruncated:
    'Chỉ nhận được một phần giá trị gốc. Giá trị không có trong danh sách thì không chọn được',
  dispositionPending: 'Lựa chọn quyết định xử lý chưa sẵn sàng nên chưa lưu được đánh giá',
  actions: {
    save: 'Lưu đánh giá',
    cancel: 'Hủy bỏ',
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
  },
  detail: {
    select: 'Hãy chọn mục không phù hợp cần đánh giá trong danh sách.',
    selectHistory: 'Hãy chọn lịch sử xử lý cần xem trong danh sách.',
    loading: 'Đang tải chi tiết không phù hợp',
    notFound: 'Không tìm thấy mục không phù hợp',
    notFoundDescription: 'Hãy tra cứu lại danh sách rồi chọn mục không phù hợp khác.',
    emptyDescription: 'Chưa có mô tả nào được đăng ký',
    noLots: 'Không có LOT liên quan',
    affectedQty: 'Số lượng đối tượng',
  },
  decisions: {
    /** 접는 머리의 건수 — 「판정 이력 0건」(사용자 시안 · #223). */
    count: (count: number): string => `${String(count)}`,
    loading: 'Đang tải lịch sử đánh giá',
    empty: 'Chưa có lịch sử quyết định.',
    unavailable: 'Không hiển thị được lịch sử đánh giá',
  },
  concession: {
    /** 접는 머리 — 「특채 요청 및 이력 0건」(사용자 시안 · #223). */
    foldTitle: 'Yêu cầu · lịch sử nhân nhượng',
    count: (count: number): string => `${String(count)}`,
    heading: 'Đặc cách',
    help: 'Sử dụng có điều kiện LOT không đạt sau khi quản lý phê duyệt. Thứ tự: yêu cầu → phê duyệt tại «Xử lý phê duyệt đặc cách · hạn mức» → áp dụng tại đây.',
    none: 'Chưa có lịch sử yêu cầu nhân nhượng.',
    loading: 'Đang tải đặc cách.',
    loadFailed: 'Không tải được đặc cách.',
    request: 'Yêu cầu đặc cách',
    requesting: 'Đang yêu cầu…',
    apply: 'Áp dụng đặc cách',
    applying: 'Đang áp dụng…',
    lot: 'LOT',
    qty: 'Số lượng được dùng',
    validFrom: 'Ngày bắt đầu hiệu lực',
    validTo: 'Ngày kết thúc hiệu lực (để trống là không giới hạn)',
    reason: 'Lý do đặc cách',
    closedNote: 'Không thể yêu cầu đặc cách cho mục không phù hợp đã kết thúc.',
    requested: 'Đã yêu cầu đặc cách. Hãy áp dụng sau khi phê duyệt xong.',
    applied: 'Đã áp dụng đặc cách. LOT đã được giải phóng về bình thường.',
    rejected: 'Phê duyệt bị từ chối nên đã đóng đặc cách.',
    blocked: {
      lot: 'Hãy chọn LOT.',
      qty: 'Số lượng được dùng phải lớn hơn 0.',
      date: 'Hãy kiểm tra thời hạn hiệu lực.',
      reason: 'Hãy nhập lý do đặc cách.',
    },
    status: { PENDING: 'Chờ phê duyệt', APPROVED: 'Đã áp dụng', REJECTED: 'Bị từ chối' },
    columns: {
      concessionNo: 'Số đặc cách',
      lotNo: 'LOT',
      qty: 'Số lượng',
      period: 'Thời hạn',
      status: 'Trạng thái',
    },
    caption: 'Danh sách đặc cách',
  },
  form: {
    heading: 'Quyết định xử lý',
    /** 처분 수량 오른쪽 — 「입력 10 / 미입력 40 EA」(#223). */
    qtyEntered: 'Đã nhập',
    qtyRest: 'Chưa nhập',
    qtyProgress: (entered: number, rest: number, unit: string): string =>
      `Đã nhập ${String(entered)} / Chưa nhập ${String(rest)}${unit === '' ? '' : ` ${unit}`}`,
    qtyPlaceholder: 'Nhập số lượng',
    reasonPlaceholder: 'Nhập lý do quyết định',
    dispositionLabel: 'Loại xử lý',
    qtyLabel: 'Số lượng',
    reasonLabel: 'Lý do',
    qtyRequired: 'Hãy nhập số lượng',
    qtyNotNumber: 'Hãy nhập số lượng bằng chữ số',
    qtyTooLong: 'Số lượng quá dài. Hãy nhập tối đa 12 chữ số phần nguyên · 6 chữ số phần thập phân',
    qtyTooSmall: 'Số lượng phải lớn hơn 0',
    qtyOverRemaining: (remaining: string): string =>
      `Vượt quá số lượng còn lại (${remaining}). Số lượng thực tế sẽ được kiểm tra khi lưu.`,
    qtySettledNotice: 'Không còn số lượng. Số lượng thực tế sẽ được kiểm tra khi lưu.',
    qtyExceededByServer: (remaining: string): string =>
      `Tổng số lượng quyết định xử lý vượt số lượng còn lại (${remaining}) nên chưa được lưu. Hãy nhập lại không quá số lượng còn lại`,
    alreadyClosed: 'Mục không phù hợp này đã kết thúc. Không lưu được đánh giá',
    reasonRequired: 'Hãy nhập lý do',
    dispositionRequired: 'Hãy chọn quyết định xử lý',
    savingReason: 'Đang lưu đánh giá',
    uncertainReason: 'Phải kiểm tra kết quả xử lý của đánh giá đã gửi trước đó',
    uncertainOtherTarget: (nonconformanceNo: string): string =>
      `Phải kiểm tra kết quả xử lý của đánh giá đã gửi cho mục không phù hợp ${nonconformanceNo}`,
    forbiddenReason: 'Không có quyền đánh giá. Cần quyền thì hãy hỏi người phụ trách',
    unitUnknownReason:
      'Không xác định được một đơn vị chung cho LOT liên quan nên không đánh giá được. Hãy hỏi người phụ trách',
    checkOutcome: 'Kiểm tra kết quả xử lý',
    selectFirstReason: 'Hãy chọn mục không phù hợp cần đánh giá trước',
    reloadDetail: 'Kiểm tra lại trạng thái không phù hợp',
    success: 'Đã lưu đánh giá',
    acceptedQtyLabel: 'Số lượng đạt',
    rejectedQtyLabel: 'Số lượng lỗi',
    sortHelp:
      'Phần đạt được giải phóng về bình thường; số lượng lỗi được tách thành LOT mới ở trạng thái lỗi và chuyển sang mục không phù hợp mới để quyết định hủy · làm lại riêng.',
    sortSumMismatch: 'Tổng số lượng đạt và lỗi phải bằng số lượng xử lý',
    sortWholeRemaining: (remaining: string): string =>
      `Phân loại chỉ được quyết định với toàn bộ số lượng còn lại (${remaining})`,
    sortSuccess: (lotNo: string, nonconformanceNo: string): string =>
      `Đã lưu phân loại. Phần lỗi đã chuyển sang LOT ${lotNo} · không phù hợp ${nonconformanceNo}`,
  },
  loading: 'Đang tải danh sách chờ đánh giá',
  historyLoading: 'Đang tải lịch sử xử lý',
  empty: {
    title: 'Không có mục không phù hợp nào khớp điều kiện',
    description: 'Hãy nới rộng khoảng thời gian hoặc tra cứu với điều kiện khác.',
    historyTitle: 'Không có nội dung đánh giá nào khớp điều kiện',
    historyDescription: 'Hãy nới rộng khoảng ngày đánh giá rồi tra cứu lại.',
    beyondTitle: 'Không có nội dung nào để hiển thị ở trang này',
    beyondDescription: 'Hãy quay về trang đầu để xem.',
  },
  page: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    total: (total: number): string => `Tổng ${String(total)} mục`,
  },
  values: {
    /** 대상 LOT 의 품질 상태 표시명(#223) — 모르는 값은 코드 그대로. */
    qualityStatus: {
      NORMAL: 'Bình thường',
      DEFECTIVE: 'Lỗi',
      INSPECTION_PENDING: 'Chờ kiểm tra',
      HOLD: 'Giữ lại',
      SCRAPPED: 'Hủy bỏ',
    } as Record<string, string | undefined>,
    unknownQty: '—',
    periodRequired: 'Phải chọn khoảng thời gian thì mới tra cứu được',
    periodInvalid: 'Ngày này không có trên lịch. Hãy sửa thành ngày có thật',
    periodReversed: 'Ngày bắt đầu sau ngày kết thúc. Hãy đổi chỗ hai ngày',
    sourceCode: {
      PRODUCT: 'Thành phẩm',
      RETURN: 'Trả hàng',
    },
    dispositionType: {
      REWORK: 'Làm lại',
      SCRAP: 'Hủy',
      NORMAL: 'Bình thường',
      SORT: 'Phân loại',
      CONCESSION: 'Đặc cách',
    },
    dispositionProgress: {
      NOT_STARTED: 'Chưa đánh giá',
      PARTIAL: 'Đánh giá một phần',
      COMPLETED: 'Hoàn tất',
    },
  },
};
