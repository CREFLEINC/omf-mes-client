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
    openedAt: 'Ngày tiếp nhận',
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
    selectHint: 'Thông tin chi tiết của mục không phù hợp đã chọn sẽ hiển thị.',
    loading: 'Đang tải chi tiết không phù hợp',
    notFound: 'Không tìm thấy mục không phù hợp',
    notFoundDescription: 'Hãy tra cứu lại danh sách rồi chọn mục không phù hợp khác.',
    emptyDescription: 'Chưa có mô tả nào được đăng ký',
    noLots: 'Không có LOT quản lý vật tư liên quan',
    affectedQty: 'Số lượng đối tượng',
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
    requestNote:
      'Yêu cầu phê duyệt sử dụng có điều kiện cho LOT nhập hàng không đạt — phê duyệt hạn mức cũng theo đường này',
    target: 'Đối tượng',
    targetAll: (inboundLotNo: string | null, count: number): string =>
      `Toàn bộ ${String(count)} LOT quản lý vật tư${inboundLotNo === null ? '' : ` · LOT nhập hàng ${inboundLotNo}`}`,
    qtyLocked: 'Toàn bộ số lượng còn lại — không đổi được',
    wholeHint:
      'Đặc cách chỉ yêu cầu cho toàn bộ số lượng còn lại (không có đặc cách một phần). Nếu chỉ muốn dùng một phần, hãy dùng [Phân loại] để tách LOT quản lý vật tư lỗi trước, rồi đặc cách toàn bộ LOT nhập hàng đó.',
    pendingBanner: (concessionNo: string, count: number): string =>
      `Đặc cách ${concessionNo} đang chờ phê duyệt (W-03-09). Khi được duyệt, [Áp dụng đặc cách] sẽ giải phóng toàn bộ ${String(count)} LOT quản lý vật tư về bình thường.`,
    approvedBanner: (concessionNo: string, count: number): string =>
      `Đặc cách ${concessionNo} đã được duyệt — chờ áp dụng. [Áp dụng đặc cách] sẽ giải phóng toàn bộ ${String(count)} LOT quản lý vật tư về bình thường.`,
    rejectedBanner: (concessionNo: string): string =>
      `Phê duyệt đặc cách ${concessionNo} đã bị từ chối. Hãy đóng đặc cách này bằng [Đóng đặc cách].`,
    close: 'Đóng đặc cách',
    targetGroup: (count: number): string => `Toàn bộ ${String(count)} LOT quản lý vật tư`,
    historyHeading: 'Lịch sử yêu cầu đặc cách',
    reasonPlaceholder: 'Nhập lý do đặc cách',
    validToPlaceholder: 'Không giới hạn',
    none: 'Chưa có lịch sử yêu cầu nhân nhượng.',
    loading: 'Đang tải đặc cách.',
    loadFailed: 'Không tải được đặc cách.',
    request: 'Yêu cầu đặc cách',
    requesting: 'Đang yêu cầu…',
    apply: 'Áp dụng đặc cách',
    applyWaiting: 'Phải phê duyệt xong (W-03-09) mới áp dụng được',
    applying: 'Đang áp dụng…',
    qty: 'Số lượng được dùng',
    validFrom: 'Ngày bắt đầu',
    validTo: 'Ngày kết thúc (tùy chọn)',
    reason: 'Lý do đặc cách',
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
    requestBlocked: 'Có thể yêu cầu khi đủ số lượng còn lại, thời hạn hiệu lực và lý do đặc cách.',
    blocked: {
      qty: 'Đang xác nhận số lượng còn lại.',
      date: 'Hãy kiểm tra thời hạn hiệu lực.',
      reason: 'Hãy nhập lý do đặc cách.',
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
    qtyLocked: 'Toàn bộ số lượng còn lại — không đổi được',
    wholeEffect: (count: number, effect: string): string =>
      `= Toàn bộ số lượng còn lại. Một quyết định áp dụng cho ${String(count)} LOT quản lý vật tư: ${effect}`,
    effect: {
      NORMAL: 'tất cả bình thường',
      SCRAP: 'tất cả hủy',
      REWORK: 'tất cả chờ kiểm tra + kiểm tra lại',
    },
    reworkInboundEffect: (inboundLotNo: string): string =>
      `tất cả chờ kiểm tra + mở lại IQC của LOT nhập hàng ${inboundLotNo} (thêm kết quả rồi xác nhận lại)`,
    remainingUnknown: 'Đang xác nhận số lượng còn lại. Hãy lưu lại sau giây lát',
    typeHint: {
      NORMAL: 'Toàn bộ LOT quản lý vật tư về bình thường',
      SCRAP: 'Hủy toàn bộ LOT quản lý vật tư',
      REWORK: 'Tất cả chờ kiểm tra + mở lại IQC của cùng LOT nhập hàng',
      SORT: 'Chỉ tách LOT quản lý vật tư lỗi sang LOT nhập hàng mới',
      CONCESSION: 'Dùng có điều kiện toàn bộ — phê duyệt (W-03-09)',
    } as Record<string, string | undefined>,
    typeLock: {
      closed: 'Mục không phù hợp đã kết thúc',
      concessionPending: 'Đặc cách đang chờ phê duyệt',
      concessionApproved: 'Đặc cách đã duyệt — chờ áp dụng',
      sortNoInboundLot: 'Không phù hợp trả hàng · OQC không có phân loại (không có LOT nhập hàng)',
      sortSingleLot: 'Chỉ có 1 LOT quản lý vật tư nên không phân loại được',
      sortNotFirst: 'Chỉ phân loại được ở lần quyết định đầu tiên',
      normalSorted: 'Phần lỗi tách ra do phân loại — hãy xử lý bằng hủy · làm lại · đặc cách',
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
      `Kiểm tra ${inboundLotNo} đã được mở lại ở W-01-01 với trạng thái 「Đang kiểm tra」.`,
    qtyExceededByServer: (remaining: string): string =>
      `Tổng số lượng quyết định xử lý vượt số lượng còn lại (${remaining}) nên chưa được lưu. Hãy tải lại mục không phù hợp rồi lưu`,
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
  },
  inboundLot: {
    inboundLotNo: 'LOT nhập hàng',
    inspectionRequestNo: 'Kiểm tra IQC',
    supplier: 'Nhà cung cấp',
    listLine: (inboundLotNo: string): string => `LOT nhập hàng ${inboundLotNo}`,
    sourceColumn: 'Nguồn',
    source: { IQC: 'IQC · nhập hàng vật tư', RETURN: 'Trả hàng', PRODUCT: 'OQC · thành phẩm' }, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    sortedFromTail: (tail: string): string => ` · phân loại ← ${tail}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    bannerTitle: 'Xử lý theo đơn vị LOT nhập hàng.',
    bannerBody: (count: number): string =>
      `Một quyết định áp dụng chung cho toàn bộ ${String(count)} LOT quản lý vật tư. Không xử lý riêng từng LOT quản lý vật tư.`,
    matching: 'Khớp kết quả IQC',
    matchingNote: 'Khớp kết quả IQC — tham khảo',
    noMatch: 'Không khớp',
    resultChip: (seqNo: number, judgment: string, defect: string | null): string =>
      `Kết quả ${String(seqNo)} ${judgment}${defect === null ? '' : ` · ${defect}`}`,
    rejectedCount: (count: number): string => `${String(count)} kết quả không đạt`,
    unmatched: (results: string): string => `Kết quả không khớp: ${results}`,
    judgment: { ACCEPTED: 'Đạt', REJECTED: 'Không đạt', HELD: 'Giữ lại' } as Record<
      string,
      string | undefined
    >,
    sortedFrom: 'Sinh ra do phân loại ←',
    rejectedConfirmed: 'Đã xác nhận không đạt',
  },
  sort: {
    heading: 'Phân loại — chọn LOT quản lý vật tư lỗi',
    help: 'LOT quản lý vật tư được chọn sẽ chuyển sang LOT nhập hàng mới, giữ nguyên lỗi và xử lý ở mục không phù hợp mới. LOT quản lý vật tư không chọn sẽ về bình thường. Không chia LOT theo số lượng.',
    lotsLabel: 'LOT quản lý vật tư lỗi',
    noMatch: 'Không có kết quả khớp',
    allSelected:
      'LOT nhập hàng ban đầu phải còn ít nhất một LOT quản lý vật tư. Nếu tất cả đều lỗi, đừng phân loại mà hãy xử lý bằng hủy · làm lại · đặc cách.',
    noneSelected: 'Hãy chọn ít nhất một LOT quản lý vật tư lỗi',
    goodQty: 'Số lượng đạt (thông tin · tùy chọn)',
    defectQty: 'Số lượng lỗi (thông tin · tùy chọn)',
    qtyNote: 'Chỉ để ghi kết quả phân loại. Số lượng tồn kho · LOT không thay đổi.',
    qtyInvalid: 'Hãy nhập số từ 0 trở lên',
    previewTitle: 'Khi lưu',
    previewRest: (lots: string, qty: string): string =>
      `${lots} (${qty}) → bình thường, mục không phù hợp này kết thúc bằng 「Phân loại」`,
    previewMoved: (lots: string, qty: string): string =>
      `${lots} (${qty}) → LOT nhập hàng mới, giữ nguyên lỗi · 1 mục không phù hợp mới (chờ quyết định, liên kết với mục này)`,
    previewIqc: (inspectionRequestNo: string | null): string =>
      `Bản ghi IQC đã xác nhận không đạt ở LOT nhập hàng mới (liên kết với ${inspectionRequestNo === null ? 'IQC ban đầu' : inspectionRequestNo}, sao chép kết quả chỉ khớp với LOT đã chuyển)`,
    save: 'Lưu phân loại',
    resultTitle: 'Đã lưu phân loại — mục không phù hợp này kết thúc bằng 「Phân loại」',
    resultRest: (lots: string): string => `${lots} → bình thường (có thể nhập kho)`,
    resultMoved: (lots: string, inboundLotNo: string): string =>
      `${lots} → LOT nhập hàng mới ${inboundLotNo} (giữ nguyên lỗi)`,
    resultIqc: (inspectionRequestNo: string, original: string | null): string =>
      `IQC ${inspectionRequestNo} xác nhận không đạt${original === null ? '' : ` (liên kết với ${original})`}`,
    resultNewNonconformance: 'Mục không phù hợp mới',
    resultNewNonconformanceAfter: 'chờ quyết định — hãy xử lý bằng hủy · làm lại · đặc cách',
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
  },
  /** 「지금(바뀌기 전)」 띠(005 · screens/W-03-10.md). */
  nowBand: {
    title: 'Trước đây (trước khi thay đổi)',
    summary:
      'Chia số lượng xử lý để đánh giá nhiều lần · Phân loại = tách LOT theo số lượng đạt/lỗi (LOT con) · Đặc cách = chọn 1 LOT, có thể một phần số lượng', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    expand: 'Mở rộng',
    collapse: 'Thu gọn',
    items: [
      {
        label: 'Số lượng xử lý',
        tag: 'Đã bỏ',
        note: 'Trước đây có thể chia số lượng xử lý và chỉ đánh giá một phần (đã nhập / chưa nhập).',
      },
      {
        label: 'Số lượng đạt · lỗi (phân loại)', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
        tag: 'Đã thay đổi',
        note: 'Số lượng lỗi được tách thành LOT mới (LOT con) và trở thành sự không phù hợp mới.',
      },
      {
        label: 'Yêu cầu đặc cách',
        tag: 'Bỏ đặc cách một phần',
        note: 'Trước đây có thể chọn một LOT và chỉ duyệt một phần số lượng; phần còn lại được tách thành LOT mới và sự không phù hợp mới.',
      },
    ],
  },
};
