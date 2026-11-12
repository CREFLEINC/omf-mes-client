import type { ko } from '../ko';
import type { Translated } from './translated';

export const iqcInboundLot: Translated<typeof ko.iqcInboundLot> = {
  queue: {
    closingHint: 'LOT nhập hàng chưa chốt nhập hàng (đang nhập hàng) không hiện trong hàng chờ',
    columns: {
      inboundLotNo: 'LOT nhập hàng',
      lotCount: 'LOT quản lý vật tư',
      overallJudgment: 'Đánh giá tổng hợp',
    },
    splitFrom: (tail: string) => `Tách ← ${tail}`,
    lotCount: (count: number) => `${count} LOT`,
    status: {
      REQUESTED: 'Chờ kiểm tra',
      IN_PROGRESS: 'Đang kiểm tra',
      CONFIRMED: 'Đã xác nhận đánh giá',
    },
    preview: (judgment: string) => `${judgment} (xem trước)`,
    previewTitle: 'Xem trước khi xác nhận',
    counts: (total: number, requested: number, inProgress: number, confirmed: number) =>
      `Tổng ${total} mục · chờ ${requested} · đang làm ${inProgress} · đã xác nhận ${confirmed}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
  },
  detail: {
    title: 'Chi tiết',
    lotsHeading: (count: number) => `${count} LOT quản lý vật tư`,
    lotsNote: 'Trạng thái chỉ thay đổi khi xác nhận đánh giá',
    facts: {
      item: 'Mặt hàng',
      supplier: 'Nhà cung cấp',
      request: 'Yêu cầu kiểm tra',
      inspectedQty: 'Số lượng kiểm tra',
      inspectedQtyValue: (qty: string, count: number) =>
        `${qty} (tổng ${count} LOT quản lý vật tư)`,
      received: 'Nhập hàng',
      receivedValue: (when: string, channel: string | null) =>
        channel === null ? when : `${when} (${channel})`,
      plan: 'Điều kiện kiểm tra',
      splitFrom: 'Tách từ',
    },
    status: {
      REQUESTED: 'Chờ kiểm tra',
      IN_PROGRESS: 'Đang kiểm tra',
      CONFIRMED: 'Đã xác nhận đánh giá',
    },
    preview: (judgment: string) => `${judgment} (xem trước)`,
    noPermission: 'Người có quyền xác nhận (W-01-15) mới xác nhận đánh giá · hủy xác nhận',
    columns: {
      lotNo: 'Số LOT quản lý vật tư',
      qty: 'Số lượng · đóng gói',
      status: 'Trạng thái chất lượng',
      matched: 'Kết quả liên kết',
    },
    noPackage: 'Không đóng gói',
    lotStatus: {
      INSPECTION_PENDING: 'Chờ kiểm tra',
      NORMAL: 'Bình thường',
      DEFECTIVE: 'Lỗi',
      SUSPECT_HOLD: 'Nghi ngờ · tạm giữ',
    },
    goodsReceived: 'Đã nhập kho',
    matchedChip: (seqNo: number) => `Kết quả ${seqNo}`,
    none: 'Không có',
    lockedComposition:
      'Cấu thành đã cố định do chốt nhập hàng. Để thay đổi, xóa hết kết quả IQC rồi hủy chốt trên PDA, hoặc tách LOT quản lý vật tư',
    lockedConfirmed:
      'LOT nhập hàng đã xác nhận đánh giá. Không thể gỡ · thêm · tách LOT quản lý vật tư. Nếu cần tách, hãy hủy xác nhận rồi tách, hoặc nếu không đạt thì dùng phân loại ở bước xử lý (W-03-10).',
    poHeading: 'Liên kết P/O của LOT nhập hàng (tham khảo)',
    poLine: (no: string, lineNo: number, qty: string) => `${no}/${lineNo} · ${qty}`,
    poNone: (qty: string) => `Không có P/O ${qty}`,
    poJoin: (parts: readonly string[]) => parts.join(' · '),
    poEmpty: 'Chưa chốt nhập hàng nên chưa có liên kết P/O',
    banner: {
      preview: (judgment: string, count: number) =>
        `Xem trước đánh giá tổng hợp: ${judgment} — theo ${count} kết quả (không đạt > tạm giữ > đạt). Chưa xác nhận nên trạng thái LOT quản lý vật tư vẫn là chờ kiểm tra.`,
      empty:
        'Chưa có kết quả. Hãy ghi kết quả bằng [Thêm kết quả]. Cần ít nhất 1 kết quả để xác nhận đánh giá.',
      accepted: (count: number) =>
        `Đã xác nhận · Đạt — tất cả ${count} LOT quản lý vật tư bình thường (gỡ tạm giữ chờ kiểm tra). Có thể nhập kho.`,
      rejected: (count: number) =>
        `Đã xác nhận · Không đạt — tất cả ${count} LOT quản lý vật tư lỗi.`,
      ncLabel: 'Phiếu không phù hợp',
      rejectedNcTail:
        '(chờ đánh giá) đã chứa toàn bộ LOT quản lý vật tư và đã gửi thông báo không đạt. Để dùng làm hàng tốt, hãy phân loại · chấp nhận đặc biệt ở quản lý xử lý không phù hợp (W-03-10).',
      held: 'Đã xác nhận · Tạm giữ — LOT quản lý vật tư vẫn chờ kiểm tra. Để kiểm tra lại, hãy hủy xác nhận rồi thêm kết quả.',
      by: (who: string, when: string) => `${who} · ${when}`,
    },
    pick: 'Hãy chọn yêu cầu kiểm tra.',
    loadFailed: 'Không tải được yêu cầu kiểm tra.',
    retry: 'Tải lại',
    loading: 'Đang tải yêu cầu kiểm tra',
  },
  results: {
    heading: (count: number) => `${count} kết quả kiểm tra`,
    add: 'Thêm kết quả',
    columns: {
      seq: 'STT',
      judgment: 'Đánh giá',
      inspectedQty: 'Số lượng kiểm tra',
      defects: 'Lỗi · loại',
      matched: 'LOT quản lý vật tư liên kết',
      inspector: 'Người kiểm tra',
      actions: 'Thao tác',
    },
    seq: (seqNo: number) => `Kết quả ${seqNo}`,
    noMatch: 'Không liên kết',
    edit: 'Sửa',
    remove: 'Xóa',
    lockedRow: 'Đã xác nhận',
    lockedHead: 'Đã xác nhận đánh giá — không thể sửa kết quả',
    empty: 'Chưa có kết quả nào.',
    noJudgment: 'Chưa đánh giá',
    deleteTitle: (seqNo: number) => `Xóa kết quả ${seqNo}?`,
    deleteBody:
      'Giá trị đo · lỗi · liên kết sẽ bị xóa cùng. STT đã xóa không dùng lại, và ai xóa lúc nào được lưu trong lịch sử thay đổi.',
    deleteCancel: 'Hủy',
    deleteConfirm: 'Xóa',
    deleted: (seqNo: number) => `Đã xóa kết quả ${seqNo}.`,
    deleteFailed: 'Không xóa được kết quả.',
    conflict: 'Dữ liệu đã thay đổi',
    reload: 'Tải lại',
    lockedWrite: 'Đã xác nhận đánh giá — không thể sửa kết quả',
    lotJudgments: {
      heading: 'Đánh giá theo LOT quản lý vật tư',
      help: 'Mỗi LOT quản lý vật tư được đánh giá theo kết quả cuối cùng (số thứ tự lớn nhất) đã liên kết với LOT đó; đánh giá tổng hợp là đánh giá xấu nhất trong số đó (Không đạt > Giữ lại > Đạt).',
      byResult: (seqNo: number) => `Kết quả ${seqNo}`,
      superseded: (
        lotTail: string,
        beforeSeq: number,
        before: string,
        afterSeq: number,
        after: string,
        reason: string | null,
      ) =>
        `LOT ${lotTail}: kết quả ${beforeSeq} ${before} → kết quả ${afterSeq} ${after}${reason === null ? '' : ` (${reason})`}`,
      unmatched: (count: number) =>
        `${count} LOT quản lý vật tư chưa liên kết kết quả nào không được tính vào đánh giá`,
    },
    reason: (name: string) => `Lý do kiểm tra lại: ${name}`,
  },
  drawer: {
    addTitle: (seqNo: number) => `Thêm kết quả ${seqNo}`,
    editTitle: (seqNo: number) => `Sửa kết quả ${seqNo}`,
    matchHeading: 'Liên kết LOT quản lý vật tư',
    matchHelp:
      'Hãy chọn ít nhất 1 LOT quản lý vật tư mà kết quả này đã xem khi ghi. Chỉ hiện LOT quản lý vật tư của LOT nhập hàng này.',
    matchNote:
      'Nếu đã kiểm tra mẫu trộn lẫn, hãy nhấn [Chọn tất cả]. Có thể liên kết cùng một LOT quản lý vật tư với nhiều kết quả. Mỗi LOT quản lý vật tư được đánh giá theo kết quả cuối cùng (số thứ tự lớn nhất) đã liên kết với LOT đó.',
    selectAll: 'Chọn tất cả',
    matchRequired: 'Hãy chọn ít nhất 1 LOT quản lý vật tư',
    reasonHeading: 'Lý do kiểm tra lại',
    reasonPlaceholder: 'Chọn lý do kiểm tra lại',
    reasonHelp:
      'Kết quả này thay đổi đánh giá của các LOT quản lý vật tư dưới đây. Hãy chọn lý do kiểm tra lại.',
    reasonLine: (lotTail: string, seqNo: number, before: string, after: string) =>
      `LOT ${lotTail}: kết quả ${seqNo} ${before} → kết quả này ${after}`,
    reasonRequired: 'Hãy chọn lý do kiểm tra lại',
    reasonLoadFailed: 'Không tải được danh sách lý do kiểm tra lại.',
    ruleErrors: {
      MATCHED_LOT_REQUIRED: 'Hãy chọn ít nhất 1 LOT quản lý vật tư',
      REINSPECTION_REASON_REQUIRED:
        'Kết quả này thay đổi đánh giá Không đạt hoặc Giữ lại. Hãy chọn lý do kiểm tra lại',
    },
    alsoMatched: (seqNos: string) => `Cũng liên kết với kết quả ${seqNos}`,
    inputNote: 'Giữ nguyên biểu mẫu IQC hiện tại · không có lượt',
    saveNote: 'Khi lưu, danh sách kết quả và xem trước đánh giá tổng hợp sẽ thay đổi',
    judgmentRequired: 'Hãy chọn đánh giá.',
    cancel: 'Hủy',
    save: 'Lưu',
    discardBody: 'Nội dung đã nhập sẽ mất. Đóng?',
    discardStay: 'Tiếp tục nhập',
    discardLeave: 'Đóng',
    added: (seqNo: number, judgment: string) =>
      `Đã ghi kết quả ${seqNo}. Xem trước đánh giá tổng hợp: ${judgment}`,
    updated: (seqNo: number) => `Đã sửa kết quả ${seqNo}.`,
    loading: 'Đang tải kết quả',
  },
  history: {
    open: 'Lịch sử thay đổi',
    title: (inboundLotNo: string) => `Lịch sử thay đổi · ${inboundLotNo}`,
    help: 'Lưu ai · lúc nào · làm gì khi ghi · sửa · xóa kết quả, xác nhận · hủy đánh giá, tách LOT quản lý vật tư.',
    columns: { when: 'Thời điểm', who: 'Ai', what: 'Việc gì', detail: 'Nội dung' },
    events: {
      RESULT_ADDED: 'Ghi kết quả',
      RESULT_UPDATED: 'Sửa kết quả',
      RESULT_DELETED: 'Xóa kết quả',
      CONFIRMED: 'Xác nhận đánh giá',
      CONFIRM_CANCELLED: 'Hủy xác nhận đánh giá',
      REOPENED_BY_REWORK: 'Mở lại do làm lại',
      SKIPPED: 'Bỏ qua kiểm tra',
      SKIP_VOIDED: 'Hủy bỏ qua kiểm tra (hủy chốt)',
      SPLIT_OUT: 'Tách LOT quản lý vật tư',
      SPLIT_IN: 'Tạo do tách',
      CANCELLED_BY_REOPEN: 'Hủy yêu cầu do hủy chốt',
    } as Record<string, string>,
    empty: 'Không có lịch sử.',
    loadFailed: 'Không tải được lịch sử thay đổi.',
    close: 'Đóng',
  },
  split: {
    open: 'Tách LOT quản lý vật tư',
    title: 'Tách LOT quản lý vật tư',
    intro:
      'Chuyển các LOT quản lý vật tư đã chọn sang một LOT nhập hàng mới cùng vật tư và nhà cung cấp. Hai LOT nhập hàng được xác nhận phán định riêng.',
    introFollow: 'Số và nhãn của LOT quản lý vật tư được giữ nguyên.',
    lotList: 'LOT quản lý vật tư cần tách',
    resultChip: (seqNo: number) => `Kết quả ${String(seqNo)}`,
    allSelected:
      'LOT nhập hàng gốc phải còn lại ít nhất một LOT quản lý vật tư. Nếu tất cả đều lỗi, đừng tách mà hãy xác nhận và xử lý nguyên LOT nhập hàng này.',
    noneSelected: 'Hãy chọn LOT quản lý vật tư cần tách.',
    noVersion: 'Hãy tải lại thông tin LOT nhập hàng rồi tách.',
    preview: 'Xem trước',
    previewLoading: 'Đang tải xem trước.',
    previewFailed: 'Không tải được xem trước. Hãy chọn lại hoặc đóng và mở lại cửa sổ.',
    newLot: (count: number, qty: string, inProgress: boolean) =>
      `LOT nhập hàng mới — ${String(count)} LOT quản lý vật tư, ${qty}, tạo kiểm tra IQC mới (${inProgress ? 'Đang kiểm tra' : 'Chờ kiểm tra'})`,
    remaining: (inboundLotNo: string, before: string, after: string, count: number) =>
      `${inboundLotNo} số lượng nhập ${before} → ${after} (còn ${String(count)} LOT quản lý vật tư)`,
    movedResults: 'Kết quả được chuyển',
    movedResultsNote: '(chỉ khớp với LOT được chuyển)',
    renumber: 'đánh lại số thứ tự từ 1 trong kiểm tra mới',
    unmatchedResults: 'Kết quả ở lại, chỉ bỏ khớp',
    unmatchedResultsNote: '(khớp cùng LOT khác)',
    matchRemoved: (tails: string) => `bỏ khớp ${tails}`,
    keptResults: 'Kết quả giữ nguyên',
    noMatch: '(không khớp)',
    movedAllocations: 'Khớp P/O được chuyển',
    noPo: 'Không có P/O',
    poLine: (purchaseOrderNo: string, lineNo: number) => `${purchaseOrderNo}/${String(lineNo)}`,
    toNewLot: '→ LOT nhập hàng mới',
    none: 'Không có',
    reason: 'Lý do (tùy chọn)',
    reasonPlaceholder: 'VD: 0003 móp ngoại quan, phán định riêng',
    cancel: 'Hủy',
    submit: 'Tách',
    done: (newInboundLotNo: string, count: number) =>
      `Đã tách ${String(count)} LOT quản lý vật tư sang ${newInboundLotNo}. Hãy xác nhận phán định riêng cho từng LOT nhập hàng.`,
    lockedConfirmed: 'Không thể tách sau khi đã xác nhận phán định',
    lockedSingle: 'Cần có từ 2 LOT quản lý vật tư trở lên',
    finalized: 'Không thể tách LOT nhập hàng đã chốt cuối cùng',
    conflict: 'Người khác đã thay đổi trước. Hãy đóng cửa sổ, tải lại rồi tách.',
    failed: 'Không tách được. Hãy đóng cửa sổ, tải lại rồi thử lại.',
  },
  confirm: {
    open: 'Xác nhận đánh giá',
    lockedNoResults: 'Cần ít nhất 1 kết quả',
    lockedNoJudgment: 'Có kết quả chưa đánh giá',
    title: (inboundLotNo: string) => `Xác nhận đánh giá ${inboundLotNo}`,
    counts: (total: number, accepted: number, rejected: number, held: number) =>
      `${total} kết quả — đạt ${accepted} · không đạt ${rejected} · tạm giữ ${held}`,
    applyHeading: 'Áp dụng',
    apply: {
      ACCEPTED: (count: number) =>
        `Toàn bộ ${count} LOT quản lý vật tư → bình thường (gỡ tạm giữ chờ kiểm tra, có thể nhập kho)`,
      REJECTED: (count: number) =>
        `Toàn bộ ${count} LOT quản lý vật tư → lỗi, đưa toàn bộ vào 1 phiếu không phù hợp (chờ đánh giá) và gửi thông báo không đạt.`,
      HELD: (count: number) => `${count} LOT quản lý vật tư → giữ chờ kiểm tra (tạm giữ)`,
    },
    note: 'Sau khi xác nhận không thể sửa, thêm hay xóa kết quả. Nếu xác nhận nhầm, dùng [Hủy xác nhận] (trước khi nhập kho · xử lý).',
    back: 'Quay lại',
    proceed: (judgment: string) => `Xác nhận đánh giá: ${judgment}`,
    doneRejected: (ncNo: string | null) =>
      ncNo === null
        ? 'Đã xác nhận không đạt. Đã tạo phiếu không phù hợp.'
        : `Đã xác nhận không đạt. Đã tạo phiếu không phù hợp ${ncNo}.`,
    done: (judgment: string) => `Đã xác nhận: ${judgment}.`,
    conflict: 'Dữ liệu đã thay đổi',
    reload: 'Tải lại',
    failed: 'Không xác nhận được đánh giá.',
    noPermission: 'Người có quyền xác nhận (W-01-15) mới xác nhận đánh giá · hủy xác nhận',
  },
  cancel: {
    open: 'Hủy xác nhận',
    title: (inboundLotNo: string) => `Hủy xác nhận đánh giá ${inboundLotNo}`,
    lots: (count: number) => `${count} LOT quản lý vật tư → trở về chờ kiểm tra · tạm giữ`,
    nonconformance: (ncNo: string) => `Phiếu không phù hợp ${ncNo} sẽ ở trạng thái hủy`,
    results:
      'Có thể sửa và thêm kết quả lại. Nội dung xác nhận trước được lưu trong lịch sử thay đổi',
    alerts: 'Thông báo đã gửi sẽ không thu hồi',
    reason: 'Lý do (tùy chọn)',
    back: 'Quay lại',
    proceed: 'Hủy xác nhận',
    done: 'Đã hủy xác nhận đánh giá. Có thể sửa kết quả lại.',
    blockedTitle: 'Không thể hủy xác nhận',
    blockedLead: 'Các việc dưới đây đã diễn ra nên không thể hoàn tác xác nhận đánh giá.',
    blockedTail:
      'Hãy hủy nhập kho hoặc hoàn tác thay đổi trạng thái rồi thử lại. Nếu xử lý · chấp nhận đặc biệt cho hàng không đạt đã bắt đầu, hãy xử lý ở W-03-10.',
    blockedOk: 'Xác nhận',
    blockers: {
      GOODS_RECEIVED: 'Có LOT quản lý vật tư đã nhập kho',
      LOT_STATUS_CHANGED:
        'Có LOT quản lý vật tư đổi trạng thái ngoài IQC (nghi ngờ · tạm giữ, v.v.)',
      DISPOSITION_STARTED: 'Đã bắt đầu xử lý không phù hợp',
      CONCESSION_EXISTS: 'Có yêu cầu chấp nhận đặc biệt',
      INBOUND_LOT_FINALIZED: 'LOT nhập hàng đã chốt cuối cùng (W-01-16)',
    } as Record<string, string>,
    failed: 'Không hủy được xác nhận.',
  },
};
