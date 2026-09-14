import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-04 재고실사. 장부 수량·실물 수량·차이 세 낱말을 가려 쓰고, 차이는 서버가 계산한다.
 * 상태말을 화면이 짓지 않고 서버가 준 코드를 그대로 낸다.
 */
export const stocktaking: Translated<typeof ko.stocktaking> = {
  title: 'Kiểm kê tồn kho',
  breadcrumbRoot: 'Kho vật tư',
  panes: {
    list: 'Danh sách kiểm kê',
    open: 'Mở kiểm kê',
    detail: 'Kiểm kê đã chọn',
  },
  fields: {
    warehouse: 'Kho',
    plannedDateFrom: 'Ngày kế hoạch bắt đầu',
    plannedDateTo: 'Ngày kế hoạch kết thúc',
    countType: 'Loại kiểm kê',
    status: 'Trạng thái',
    inProgressOnly: 'Chỉ phiếu đang làm',
    plannedDate: 'Ngày kế hoạch',
    blindCount: 'Kiểm kê mù',
    location: 'Vị trí',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    selectRow: (inventoryCountNo: string): string => `Chọn ${inventoryCountNo}`,
    deselectRow: (inventoryCountNo: string): string => `Bỏ chọn ${inventoryCountNo}`,
    refresh: 'Tra cứu lại',
    open: 'Mở kiểm kê',
    confirmOpen: 'Thực hiện mở kiểm kê',
    keepEditing: 'Nhập tiếp',
    discardDraft: 'Bỏ nội dung đã nhập',
    saveLocation: 'Hoàn tất kiểm kê vị trí này',
    close: 'Chốt',
    confirmClose: 'Thực hiện chốt kiểm kê',
    keepCounting: 'Không chốt',
    adjustment: 'Đăng ký điều chỉnh',
  },
  actionReasons: {
    openCodeListPending:
      'Mở kiểm kê: danh sách mã của loại kiểm kê chưa được chốt nên hiện chưa mở kiểm kê được. Khi danh sách mã sẵn sàng thì chọn được ở màn hình này.',
    openNeedsCountType: 'Mở kiểm kê: hãy chọn loại kiểm kê.',
    openNeedsWarehouse: 'Mở kiểm kê: hãy chọn kho.',
    openNeedsPlannedDate: 'Mở kiểm kê: hãy nhập ngày kế hoạch.',
    saveTruncated:
      'Hoàn tất kiểm kê vị trí này: chưa nhận đủ toàn bộ dòng của vị trí này nên không lưu được. Các dòng chưa nhận sẽ quay về trạng thái chưa kiểm kê nên việc lưu bị chặn.',
    saveNoLines: 'Hoàn tất kiểm kê vị trí này: vị trí này không có dòng nào để lưu.',
    saveIncompleteQty: (remaining: number): string =>
      `Hoàn tất kiểm kê vị trí này: còn ${String(remaining)} dòng chưa nhập số lượng thực tế. Phải điền toàn bộ dòng của vị trí này mới lưu được.`,
    saveInvalidQty: (invalid: number): string =>
      `Hoàn tất kiểm kê vị trí này: có ${String(invalid)} dòng phải nhập lại số lượng thực tế.`,
    saveReasonListPending:
      'Hoàn tất kiểm kê vị trí này: có dòng bị chênh lệch nhưng danh sách mã lý do chênh lệch chưa được chốt nên không lưu được. Vị trí không có chênh lệch thì hiện vẫn lưu được.',
    saveNeedsReason: (remaining: number): string =>
      `Hoàn tất kiểm kê vị trí này: có ${String(remaining)} dòng có số lượng thực tế khác sổ sách nên cần lý do chênh lệch.`,
    saveInvalidReason: 'Hoàn tất kiểm kê vị trí này: có dòng phải chọn lại lý do chênh lệch.',
    closeAlreadyClosed:
      'Chốt: đã chốt rồi. Hợp đồng không có thao tác nào để mở lại kiểm kê đã chốt.',
    closeSummaryUnavailable:
      'Chốt: không đọc được tóm tắt tiến độ kiểm kê nên không xét được điều kiện chốt. Hãy tra cứu lại rồi thử.',
    closeUncounted: (remaining: number): string =>
      `Chốt: còn ${String(remaining)} phiếu chưa kiểm kê nên không chốt được.`,
    closeVariance: (remaining: number): string =>
      `Chốt: còn ${String(remaining)} chênh lệch nên không chốt được. Hãy điều chỉnh chênh lệch rồi mới chốt được.`,
    historyPending:
      'Lịch sử sửa số lượng thực tế: quy ước hiển thị lịch sử chưa được chốt nên hiện chưa xem được. Khi quy ước được chốt thì xem được ở chỗ này.',
  },
  errors: {
    codeTooLong: (max: number): string => `Mã không được vượt quá ${String(max)} ký tự.`,
    plannedDateInvalid: 'Hãy nhập ngày kế hoạch là ngày có thật. Ví dụ: 2026-08-06',
    qtyNotNumber: 'Hãy nhập số lượng thực tế bằng chữ số.',
    qtyNegative: 'Số lượng thực tế không được nhỏ hơn 0.',
  },
  notes: {
    openLead: 'Mở một kiểm kê mới cho một kho. Các dòng kiểm kê do máy chủ dựng từ sổ sách.',
    blindOnlyAtOpen:
      'Trong kiểm kê mù thì không thấy số lượng sổ sách. Mở rồi thì không đổi được nên hãy quyết định bây giờ.',
    openRecheck:
      'Hãy kiểm tra ở danh sách xem kiểm kê đã được mở chưa rồi mới thử lại. Gửi lại mà không kiểm tra thì cùng một kho có thể có hai phiếu kiểm kê.',
    replaceSemantics:
      'Toàn bộ dòng của vị trí này bị thay nguyên khối. Dòng không có trên bảng sẽ quay về trạng thái chưa kiểm kê nên không đặt điều kiện thu hẹp vị trí.',
    countedQtyEmptyStart:
      'Số lượng thực tế luôn bắt đầu bằng ô trống. Điền sẵn số lượng do máy chủ trả về thì dòng chưa đếm có thể bị lưu thành 「đã đếm được 0」.',
    saveRecheck:
      'Hãy tra cứu lại để kiểm tra đã lưu chưa rồi mới thử. Gửi lại cùng một vị trí thì vị trí đó lại bị thay nguyên khối.',
    closeRecheck:
      'Hãy tra cứu lại để kiểm tra kiểm kê đã được chốt chưa rồi mới thử. Hợp đồng không có thao tác nào để mở lại kiểm kê đã chốt.',
  },
  dialog: {
    openTitle: 'Mở kiểm kê với nội dung này chứ?',
    openLead:
      'Phiếu kiểm kê sẽ được tạo với các giá trị dưới đây. Hãy kiểm tra một lần nữa trước khi gửi.',
    openIrreversible:
      'Kiểm kê đã mở thì màn hình này không xóa hay hoàn tác được. Hãy kiểm tra lại kho và ngày kế hoạch.',
    discardTitle: 'Bỏ các giá trị đã nhập chứ?',
    closeTitle: 'Chốt kiểm kê này chứ?',
    closeLead:
      'Kiểm kê dưới đây sẽ được chốt. Hãy xem lại tóm tắt tiến độ tại thời điểm chốt một lần nữa.',
    closeIrreversible:
      'Chốt rồi thì không sửa kiểm kê này được nữa. Hợp đồng không có thao tác nào để mở lại kiểm kê đã chốt.',
  },
  result: {
    label: 'Kết quả mở kiểm kê',
    openedNo: 'Số kiểm kê',
    openedNote:
      'Kiểm kê vừa mở đã được đặt ở trạng thái đã chọn bên dưới. Hãy xem tóm tắt tiến độ ở khu vực dưới.',
    savedLabel: 'Kết quả lưu vị trí',
    savedLocation: 'Vị trí',
    savedLineCount: 'Số dòng đã thay',
    savedCount: (lineCount: number): string => `${String(lineCount)} dòng`,
    savedNote:
      'Đã thay nguyên khối các dòng của vị trí này. Tóm tắt tiến độ là giá trị tra cứu lại ở khu vực trên.',
    closedLabel: 'Kết quả chốt kiểm kê',
    closedNo: 'Số kiểm kê',
    closedStatus: 'Trạng thái sau khi chốt',
    closedNote:
      'Hiện nguyên mã trạng thái và tóm tắt tiến độ do máy chủ trả về. Màn hình không tự kết luận là 「đã chốt」.',
    adjustmentNote: (varianceCount: number): string =>
      `Còn ${String(varianceCount)} chênh lệch. Hãy xử lý tiếp ở điều chỉnh tồn kho.`,
  },
  loading: {
    counts: 'Đang tải danh sách kiểm kê',
    detail: 'Đang tải kiểm kê đã chọn',
    lines: 'Đang tải các dòng của vị trí đã chọn',
  },
  table: {
    inventoryCountNo: 'Số kiểm kê',
    warehouse: 'Kho',
    countType: 'Loại kiểm kê',
    plannedDate: 'Ngày kế hoạch',
    blindCount: 'Kiểm kê mù',
    status: 'Trạng thái',
    select: 'Chọn',
  },
  lineTable: {
    lineNo: 'Số dòng',
    item: 'Mặt hàng',
    lot: 'LOT vật tư',
    systemQty: 'Số lượng sổ sách',
    countedQty: 'Số lượng thực tế',
    variance: 'Chênh lệch',
    reason: 'Lý do chênh lệch',
    countedQtyLabel: (lineNo: number): string => `Số lượng thực tế của dòng ${String(lineNo)}`,
    reasonLabel: (lineNo: number): string => `Lý do chênh lệch của dòng ${String(lineNo)}`,
    qtyWithUom: (qty: string, uom: string): string => `${qty} ${uom}`,
    varianceStale: 'Lưu xong sẽ được tính lại',
  },
  detail: {
    label: 'Kiểm kê đã chọn',
    inventoryCountNo: 'Số kiểm kê',
    countType: 'Loại kiểm kê',
    warehouse: 'Kho',
    plannedDate: 'Ngày kế hoạch',
    blindCount: 'Kiểm kê mù',
    status: 'Trạng thái',
    summaryLabel: 'Tóm tắt tiến độ kiểm kê',
    planned: 'Dòng kế hoạch',
    counted: 'Đã đếm',
    uncounted: 'Chưa kiểm kê',
    variance: 'Chênh lệch',
    countUnit: 'dòng',
    countValue: (value: number): string => `${String(value)} dòng`,
    summaryNote:
      'Số liệu tóm tắt là giá trị do máy chủ tính và gửi kèm. Màn hình không tự đếm các dòng.',
    blindNote:
      'Trong kiểm kê mù thì số lượng sổ sách không được gửi về nên không thấy số lượng sổ sách và chênh lệch. Mở rồi thì không đổi được.',
  },
  history: {
    label: 'Lịch sử sửa số lượng thực tế',
    action: 'Xem lịch sử',
  },
  filters: {
    all: 'Tất cả',
    lookupTruncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
    periodNote: 'Để trống ngày kế hoạch thì xem toàn bộ, không thu hẹp khoảng thời gian.',
    chipWarehouse: (value: string): string => `Kho: ${value}`,
    chipPeriodBoth: (from: string, to: string): string => `Ngày kế hoạch: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `Ngày kế hoạch: từ ${from}`,
    chipPeriodTo: (to: string): string => `Ngày kế hoạch: đến ${to}`,
    chipCountType: (value: string): string => `Loại kiểm kê: ${value}`,
    chipStatus: (value: string): string => `Trạng thái: ${value}`,
    chipInProgress: 'Chỉ phiếu đang làm',
    chipRemoveWarehouse: 'Bỏ điều kiện kho',
    chipRemovePeriod: 'Bỏ điều kiện ngày kế hoạch',
    chipRemoveCountType: 'Bỏ điều kiện loại kiểm kê',
    chipRemoveStatus: 'Bỏ điều kiện trạng thái',
    chipRemoveInProgress: 'Bỏ điều kiện chỉ phiếu đang làm',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} phiếu`,
    totalOnly: (total: number): string => `Tổng ${String(total)} phiếu`,
  },
  empty: {
    noResultTitle: 'Không có kiểm kê nào khớp điều kiện',
    noResultDescription: 'Hãy bớt điều kiện hoặc nới rộng khoảng ngày kế hoạch rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noSelectionTitle: 'Chọn một kiểm kê để xem tiến độ',
    noSelectionDescription: 'Hãy chọn một kiểm kê ở danh sách trên rồi bấm 「Chọn」.',
    notFoundTitle: 'Không tìm thấy kiểm kê đã chọn',
    notFoundDescription:
      'Phiếu đã bị xóa hoặc số trên địa chỉ bị sai. Hãy chọn lại từ danh sách trên.',
    noLocationTitle: 'Chọn vị trí để xem các dòng kiểm kê',
    noLocationDescription:
      'Việc thay thế tính theo từng vị trí nên mỗi lần chỉ làm các dòng của một vị trí.',
    noLinesTitle: 'Vị trí này không có dòng kiểm kê nào',
    noLinesDescription: 'Hãy chọn vị trí khác hoặc kiểm tra lại kế hoạch kiểm kê.',
    closedTitle: 'Kiểm kê đã chốt thì không sửa được nữa',
    closedDescription:
      'Phần chọn vị trí và đăng ký kết quả đã đóng. Chọn kiểm kê khác thì làm tiếp được.',
  },
  reasons: {
    warehouseReferenceFailed: 'Không tải được tên kho. Lý do sẽ hiện ở chỗ của tên.',
    locationReferenceFailed:
      'Không tải được danh sách vị trí. Không chọn được vị trí nên không mở được các dòng.',
    lineReferencesFailed:
      'Không tải được tên mặt hàng, đơn vị và LOT vật tư. Lý do sẽ hiện ở chỗ của tên.',
    linesTruncated:
      'Chưa nhận đủ toàn bộ dòng của vị trí này. Vì có dòng chưa nhận nên việc lưu bị chặn.',
  },
  values: {
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    inactiveSuffix: ' (không dùng)',
    blindYes: 'Có',
    blindNo: 'Không',
    locationNotChosen: 'Chưa chọn',
    empty: '—',
    qtyNotProvided: 'Không được gửi về',
  },
};
