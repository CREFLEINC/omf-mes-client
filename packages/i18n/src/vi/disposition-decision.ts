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
  listCollapse: 'Thu gọn danh sách',
  listExpand: 'Mở rộng danh sách',
  breadcrumbRoot: 'Quản lý chất lượng',
  /** 탭 줄 오른쪽 상태 칩 — 「판정 대기 3」. 건수를 아직 모르면 이름만(#223). */
  statusChip: (label: string, count: number | undefined): string =>
    count === undefined ? label : `${label} ${String(count)}`,
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
    detailDecision: 'Chi tiết không phù hợp',
    historyDetail: 'Chi tiết không phù hợp',
    decision: 'Đánh giá',
    history: 'Lịch sử đánh giá quyết định xử lý',
    lots: 'LOT quản lý vật tư liên quan',
    decisions: 'Lịch sử xử lý',
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
    openedAt: 'Thời gian tiếp nhận',
    qty: 'Số lượng',
    description: 'Mô tả',
    lotNo: 'Số LOT',
    uom: 'Đơn vị',
    qualityStatus: 'Trạng thái chất lượng',
    dispositionTypeCode: 'Quyết định xử lý',
    decisionQty: 'Số lượng',
    reason: 'Lý do',
    decidedAt: 'Thời điểm đánh giá',
    decidedBy: 'Người đánh giá',
    remainingQty: 'Số lượng chưa xử lý',
    reasonText: 'Lý do không phù hợp',
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
    selectHint: 'Thông tin chi tiết của mục không phù hợp đã chọn sẽ hiển thị.',
    loading: 'Đang tải chi tiết không phù hợp',
    notFound: 'Không tìm thấy mục không phù hợp',
    notFoundDescription: 'Hãy tra cứu lại danh sách rồi chọn mục không phù hợp khác.',
    emptyDescription: 'Chưa có mô tả nào được đăng ký',
    noLots: 'Không có LOT quản lý vật tư liên quan',
    affectedQty: 'Số lượng không phù hợp',
  },
  decisions: {
    /** 접는 머리의 건수 — 「판정 이력 0건」(사용자 시안 · #223). */
    count: (count: number): string => `${String(count)}`,
    loading: 'Đang tải lịch sử đánh giá',
    empty: 'Chưa có lịch sử xử lý.',
    unavailable: 'Không hiển thị được lịch sử đánh giá',
  },
  concession: {
    /** 접는 머리 — 「특채 요청 및 이력 0건」(사용자 시안 · #223). */
    foldTitle: 'Lịch sử yêu cầu đặc cách',
    count: (count: number): string => `${String(count)}`,
    requestHeading: 'Yêu cầu đặc cách',
    targetAll: (count: number): string => `${String(count)} LOT quản lý vật tư`,
    pendingBanner: (concessionNo: string): string => `Đặc cách ${concessionNo} đang chờ phê duyệt.`,
    approvedBanner: (concessionNo: string): string => `Đặc cách ${concessionNo} đã được duyệt.`,
    rejectedBanner: (concessionNo: string): string =>
      `Phê duyệt đặc cách ${concessionNo} đã bị từ chối.`,
    close: 'Xác nhận từ chối',
    targetGroup: (count: number): string => `Toàn bộ ${String(count)} LOT quản lý vật tư`,
    historyHeading: 'Lịch sử yêu cầu đặc cách',
    validToPlaceholder: 'Không giới hạn',
    none: 'Chưa có lịch sử yêu cầu nhân nhượng.',
    loading: 'Đang tải đặc cách.',
    loadFailed: 'Không tải được đặc cách.',
    apply: 'Áp dụng đặc cách',
    applyWaiting: 'Phải phê duyệt xong mới áp dụng được',
    applying: 'Đang áp dụng…',
    validFrom: 'Ngày bắt đầu áp dụng',
    validTo: 'Ngày kết thúc áp dụng (tùy chọn)',
    requested: 'Đã yêu cầu đặc cách. Hãy áp dụng sau khi phê duyệt xong.',
    requestedLots: (count: number): string =>
      `Đã yêu cầu đặc cách cho toàn bộ ${String(count)} LOT quản lý vật tư. Hãy áp dụng sau khi phê duyệt xong.`,
    applied: 'Đã áp dụng đặc cách. LOT quản lý vật tư đã được giải phóng về bình thường.',
    appliedLots: (count: number): string =>
      `Đã áp dụng đặc cách. ${String(count)} LOT quản lý vật tư đã được giải phóng về bình thường.`,
    appliedSplit: (lotNo: string, nonconformanceNo: string): string =>
      `Đã áp dụng đặc cách. Chỉ số lượng được duyệt trở về bình thường. Số lượng còn lỗi được tách sang LOT mới ${lotNo} và xử lý ở phiếu không phù hợp ${nonconformanceNo}. Hãy dán nhãn mới cho LOT còn lỗi.`,
    rejected: 'Phê duyệt bị từ chối nên đã đóng đặc cách.',
    /** 요청 단추가 잠겼을 때 읽는 이유 — 칸별 안내 문구는 두지 않는다(필수 표시로 알린다). */
    blocked: {
      date: 'Hãy kiểm tra thời hạn hiệu lực.',
    },
    status: {
      PENDING: 'Chờ phê duyệt',
      APPROVED: 'Đã áp dụng',
      APPLIED: 'Đã áp dụng',
      REJECTED: 'Bị từ chối',
    },
    columns: {
      concessionNo: 'Số đặc cách',
      target: 'Đối tượng',
      qty: 'Số lượng được dùng',
      period: 'Thời hạn',
      status: 'Trạng thái',
    },
    caption: 'Danh sách đặc cách',
  },
  form: {
    heading: 'Quyết định xử lý',
    reasonPlaceholder: 'Nhập lý do quyết định',
    dispositionLabel: 'Loại xử lý',
    qtyLabel: 'Số lượng',
    reasonLabel: 'Lý do',
    wholeEffect: (count: number, typeLabel: string): string =>
      `Khi lưu, phán định ‘${typeLabel}’ sẽ được áp dụng cho tất cả ${String(count)} LOT quản lý vật tư.`,
    effect: {
      NORMAL: 'đều chuyển sang bình thường.',
      SCRAP: 'đều chuyển sang hủy.',
      REWORK: 'đều chuyển sang chờ kiểm tra và cần kiểm tra lại.',
    },
    reworkInboundEffect: (inboundLotNo: string): string =>
      `đều chuyển sang chờ kiểm tra, IQC của LOT nhập hàng ${inboundLotNo} được mở lại để kiểm tra lại.`,
    remainingUnknown: 'Đang xác nhận số lượng còn lại. Hãy lưu lại sau giây lát',
    typeLock: {
      closed: 'Mục không phù hợp đã kết thúc',
      concessionPending: 'Đặc cách đang chờ phê duyệt',
      concessionApproved: 'Đặc cách đã duyệt — chờ áp dụng',
      concessionRejected: 'Đặc cách bị từ chối — chờ xác nhận',
      sortNoInboundLot: 'Không phù hợp trả hàng · OQC không có phân loại (không có LOT nhập hàng)',
      sortSingleLot: 'Chỉ có thể chọn phân loại khi có từ 2 LOT quản lý vật tư trở lên.',
      sortNotFirst: 'Chỉ phân loại được ở lần quyết định đầu tiên',
      normalSorted: 'Phần lỗi tách ra do phân loại — hãy xử lý bằng hủy · đặc cách',
    },
    resultClosed: (typeLabel: string): string => `Đã kết thúc bằng quyết định ${typeLabel}`,
    resultLots: (count: number, what: string): string =>
      `Toàn bộ ${String(count)} LOT quản lý vật tư → ${what}`,
    resultWhat: {
      NORMAL: 'Bình thường',
      SCRAP: 'Hủy',
      REWORK: 'Chờ kiểm tra (làm lại) — mở lại IQC',
    } as Record<string, string | undefined>,
    reworkReopened: (inboundLotNo: string): string =>
      `Kiểm tra ${inboundLotNo} đã được mở lại ở Tra cứu · đánh giá kiểm tra với trạng thái 「Đang kiểm tra」.`,
    qtyExceededByServer: (remaining: string): string =>
      `Tổng số lượng quyết định xử lý vượt số lượng còn lại (${remaining}) nên chưa được lưu. Hãy tải lại mục không phù hợp rồi lưu`,
    alreadyClosed: 'Mục không phù hợp này đã kết thúc. Không lưu được đánh giá',
    reasonRequired: 'Bắt buộc nhập lý do quyết định.',
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
  },
  confirm: {
    title: 'Xác nhận quyết định xử lý',
    routedTitle: 'Yêu cầu phê duyệt quyết định xử lý',
    type: 'Loại xử lý',
    target: 'LOT đối tượng',
    targetLots: (count: number): string => `${String(count)} LOT quản lý vật tư`,
    qty: 'Tổng số lượng xử lý',
    sortRest: 'Xử lý bình thường',
    sortMoved: 'Tách lỗi · chờ quyết định mới',
    period: 'Thời hạn áp dụng',
    periodText: (from: string, to: string | null): string => `${from} ~ ${to ?? 'Không giới hạn'}`,
    reason: 'Lý do quyết định',
    approvers: 'Người phê duyệt',
    approverStep: (stepNo: number, name: string): string => `${name} (Bước ${String(stepNo)})`,
    routed: (applyLabel: string, subject: string): string =>
      `Sau khi được duyệt, phải nhấn [${applyLabel}] thì ${subject} mới được áp dụng.`,
    subjectDisposition: 'xử lý',
    subjectConcession: 'chấp nhận đặc biệt',
    direct: 'Mục này không có tuyến phê duyệt nên khi lưu sẽ được áp dụng ngay.',
    loading: 'Đang kiểm tra tuyến phê duyệt.',
    loadFailed: 'Không kiểm tra được tuyến phê duyệt. Hãy thử lại.',
    request: 'Yêu cầu phê duyệt',
    save: 'Lưu quyết định',
  },
  approval: {
    requested:
      'Đã gửi yêu cầu phê duyệt. Khi được duyệt, hãy nhấn Áp dụng xử lý trên màn hình này.',
    pendingBanner: (typeLabel: string): string => `Xử lý ${typeLabel} đang chờ phê duyệt.`,
    approvedBanner: (typeLabel: string): string => `Xử lý ${typeLabel} đã được duyệt.`,
    rejectedBanner: (typeLabel: string): string => `Phê duyệt xử lý ${typeLabel} bị từ chối.`,
    apply: 'Áp dụng xử lý',
    close: 'Xác nhận từ chối',
    applied: 'Đã áp dụng xử lý',
    rejected: 'Phê duyệt bị từ chối nên đã đóng yêu cầu xử lý. Có thể đánh giá lại.',
  },
  approvalSummary: {
    title: 'Thông tin không phù hợp',
    nonconformanceNo: 'Số không phù hợp',
    item: 'Mặt hàng',
    lots: 'LOT đối tượng',
    affectedQty: 'Số lượng không phù hợp',
    remainingQty: 'Số lượng còn lại',
    defect: 'Nội dung lỗi',
    requestedDisposition: 'Xử lý yêu cầu',
    sortLots: 'LOT tách ra là lỗi',
    goodQty: 'Số lượng đạt',
    defectQty: 'Số lượng lỗi',
    reason: 'Lý do xử lý',
    loading: 'Đang tải thông tin không phù hợp',
    loadError: 'Không tải được thông tin không phù hợp. Hãy thử lại.',
  },
  inboundLot: {
    inboundLotNo: 'LOT nhập hàng',
    inspectionRequestNo: 'Kiểm tra IQC',
    supplier: 'Nhà cung cấp',
    sourceColumn: 'Nguồn',
    source: { IQC: 'IQC · nhập hàng vật tư', RETURN: 'Trả hàng', PRODUCT: 'OQC · thành phẩm' }, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    sortedFromTail: (tail: string): string => ` · phân loại ← ${tail}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    matching: 'Kết quả kiểm tra',
    noMatch: 'Không có kết quả kiểm tra liên kết',
    resultChip: (seqNo: number, judgment: string, defect: string | null): string =>
      `${judgment}${defect === null ? '' : `: ${defect}`} (kết quả kiểm tra ${String(seqNo)})`,
    rejectedCount: (count: number): string => `${String(count)} kết quả không đạt`,
    unmatched: (results: string): string => `Kết quả kiểm tra chưa liên kết với LOT: ${results}`,
    judgment: { ACCEPTED: 'Đạt', REJECTED: 'Không đạt', HELD: 'Giữ lại' } as Record<
      string,
      string | undefined
    >,
    sortedFrom: 'Sinh ra do phân loại ←',
    rejectedConfirmed: 'Đã xác nhận không đạt',
  },
  sort: {
    heading: 'LOT vật tư tách ra là lỗi',
    selectNote:
      'Khi lưu, LOT đã chọn sẽ được tách ra là lỗi, các LOT còn lại được xử lý bình thường.',
    help: 'LOT quản lý vật tư được chọn sẽ chuyển sang LOT nhập hàng mới, giữ nguyên lỗi và xử lý ở mục không phù hợp mới. LOT quản lý vật tư không chọn sẽ về bình thường. Không chia LOT theo số lượng.',
    lotsLabel: 'LOT quản lý vật tư lỗi',
    noMatch: 'Không có kết quả kiểm tra liên kết',
    allSelected:
      'LOT nhập hàng ban đầu phải còn ít nhất một LOT quản lý vật tư. Nếu tất cả đều lỗi, đừng phân loại mà hãy xử lý bằng hủy · đặc cách.',
    noneSelected: 'Hãy chọn ít nhất một LOT quản lý vật tư lỗi',
    goodQty: 'Số lượng đạt (tùy chọn)',
    defectQty: 'Số lượng lỗi (tùy chọn)',
    qtyNote: 'Chỉ để ghi kết quả phân loại. Số lượng tồn kho · LOT không thay đổi.',
    qtyInvalid: 'Hãy nhập số từ 0 trở lên',
    previewTitle: 'Xử lý sau khi lưu',
    previewRestLabel: 'Xử lý bình thường',
    previewMovedLabel: 'Tách lỗi · chờ quyết định mới',
    previewTarget: (lots: string, qty: string): string => `${lots} · ${qty}`,
    previewNotes: [
      'Mục không phù hợp hiện tại kết thúc bằng ‘Phân loại’.',
      'LOT lỗi được tách sang LOT nhập hàng mới và một mục không phù hợp mới được đăng ký ở trạng thái chờ quyết định.',
      'Chỉ kết quả IQC không đạt của LOT đã tách được sao chép sang LOT nhập hàng mới.',
    ],
    previewIqc: (inspectionRequestNo: string): string =>
      `Yêu cầu kiểm tra ban đầu ${inspectionRequestNo}`,
    resultTitle: 'Đã lưu phân loại — mục không phù hợp này kết thúc bằng 「Phân loại」',
    resultRest: (lots: string): string => `${lots} → bình thường (có thể nhập kho)`,
    resultMoved: (lots: string, inboundLotNo: string): string =>
      `${lots} → LOT nhập hàng mới ${inboundLotNo} (giữ nguyên lỗi)`,
    resultIqc: (inspectionRequestNo: string, original: string | null): string =>
      `IQC ${inspectionRequestNo} xác nhận không đạt${original === null ? '' : ` (liên kết với ${original})`}`,
    resultNewNonconformance: 'Mục không phù hợp mới',
    resultNewNonconformanceAfter: 'chờ quyết định — hãy xử lý bằng hủy · đặc cách',
    resultInfo: (good: string, defect: string): string =>
      `Số lượng thông tin: đạt ${good} · lỗi ${defect}`,
    toast: (lots: string, inboundLotNo: string, nonconformanceNo: string): string =>
      `Đã lưu phân loại. ${lots} đã chuyển sang LOT nhập hàng mới ${inboundLotNo} · mục không phù hợp ${nonconformanceNo}.`,
    newInboundLot: 'LOT nhập hàng mới',
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
    statusWithProgress: (status: string, progress: string): string => `${status} (${progress})`,
  },
};
