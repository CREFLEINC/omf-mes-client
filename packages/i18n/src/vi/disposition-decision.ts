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
  splitter: 'Kéo để điều chỉnh độ rộng danh sách·chi tiết',
  box: { title: 'Xử lý không phù hợp' },
  layout: {
    group: 'Bố cục danh sách·chi tiết',
    side: 'Bố cục trái phải',
    stack: 'Bố cục trên dưới',
  },
  listCollapse: 'Thu gọn danh sách',
  listExpand: 'Mở rộng danh sách',
  breadcrumbRoot: 'Quản lý chất lượng',
  /** 탭 줄 오른쪽 상태 칩 — 「판정 대기 3」. 건수를 아직 모르면 이름만(#223). */
  statusChip: (label: string, count: number | undefined): string =>
    count === undefined ? label : `${label} ${String(count)}`,
  panes: {
    filter: 'Điều kiện tra cứu',
    list: 'Danh sách chờ đánh giá',
    detail: 'Mục không phù hợp đã chọn',
    detailDecision: 'Chi tiết không phù hợp',
    decision: 'Đánh giá',
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
    item: 'Mặt hàng',
    itemName: 'Tên mặt hàng',
    itemCode: 'Mã mặt hàng',
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
    requestHeading: 'Yêu cầu đặc cách',
    validToPlaceholder: 'Không giới hạn',
    validFrom: 'Ngày bắt đầu áp dụng',
    validTo: 'Ngày kết thúc áp dụng (tùy chọn)',
    applied: 'Đã áp dụng đặc cách. LOT quản lý vật tư đã được giải phóng về bình thường.',
    appliedLots: (count: number): string =>
      `Đã áp dụng đặc cách. ${String(count)} LOT quản lý vật tư đã được giải phóng về bình thường.`,
    /** 요청 단추가 잠겼을 때 읽는 이유 — 칸별 안내 문구는 두지 않는다(필수 표시로 알린다). */
    blocked: {
      date: 'Hãy kiểm tra thời hạn hiệu lực.',
    },
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
      closed: 'Mục không phù hợp này đã kết thúc',
      sortNoInboundLot: 'Không phù hợp trả hàng · OQC không có phân loại (không có LOT nhập hàng)',
      sortSingleLot: 'Chỉ có thể chọn phân loại khi có từ 2 LOT quản lý vật tư trở lên.',
      sortNotFirst: 'Chỉ phân loại được ở lần quyết định đầu tiên',
      normalSorted: 'Phần lỗi tách ra do phân loại — hãy xử lý bằng hủy · đặc cách',
    },
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
    type: 'Loại xử lý',
    target: 'LOT đối tượng',
    targetLots: (count: number): string => `${String(count)} LOT quản lý vật tư`,
    qty: 'Tổng số lượng xử lý',
    sortRest: 'Xử lý bình thường',
    sortMoved: 'Tách lỗi · chờ quyết định mới',
    period: 'Thời hạn áp dụng',
    periodText: (from: string, to: string | null): string => `${from} ~ ${to ?? 'Không giới hạn'}`,
    reason: 'Lý do quyết định',
    direct: 'Khi lưu sẽ được áp dụng ngay.',
    save: 'Lưu quyết định',
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
    sortedFrom: 'Mục không phù hợp gốc',
    sortedFromButton: 'Xem mục không phù hợp gốc',
    derived: 'Mục không phù hợp mới',
    derivedButton: 'Xem mục không phù hợp mới',
    openDerived: (nonconformanceNo: string): string =>
      `Xem mục không phù hợp mới ${nonconformanceNo}`,
    sortedFromNote: (nonconformanceNo: string): string =>
      `Mục không phù hợp này được tạo cho các LOT đã phân loại từ [${nonconformanceNo}].`,
    openSortedFrom: (nonconformanceNo: string): string =>
      `Xem mục không phù hợp gốc ${nonconformanceNo}`,
    rejectedConfirmed: 'Đã xác nhận không đạt',
  },
  sort: {
    heading: 'LOT vật tư tách ra là lỗi',
    selectNote:
      'LOT đã chọn được tách ra là lỗi, các LOT còn lại được xử lý bình thường.',
    help: 'Chuyển toàn bộ LOT đã chọn sang LOT nhập hàng mới. Việc xử lý LOT đã tách được thực hiện ở mục không phù hợp mới.',
    lotsLabel: 'LOT quản lý vật tư lỗi',
    noMatch: 'Không có kết quả kiểm tra liên kết',
    allSelected:
      'LOT nhập hàng ban đầu phải còn ít nhất một LOT quản lý vật tư. Nếu tất cả đều lỗi, đừng phân loại mà hãy xử lý bằng hủy · đặc cách.',
    noneSelected: 'Hãy chọn ít nhất một LOT quản lý vật tư lỗi',
    goodQty: 'Số lượng đạt (tùy chọn)',
    defectQty: 'Số lượng lỗi (tùy chọn)',
    qtyNote: 'Số lượng nhập chỉ được ghi làm kết quả phân loại, không phản ánh vào tồn kho và số lượng LOT.',
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
  },
  loading: 'Đang tải danh sách chờ đánh giá',
  empty: {
    title: 'Không có mục không phù hợp nào khớp điều kiện',
    description: 'Hãy nới rộng khoảng thời gian hoặc tra cứu với điều kiện khác.',
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
