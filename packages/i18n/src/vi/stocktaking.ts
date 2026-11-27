import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-04 재고실사. 장부 수량·실물 수량·차이 세 낱말을 가려 쓰고, 차이는 서버가 계산한다.
 * 상태말을 화면이 짓지 않고 서버가 준 코드를 그대로 낸다.
 */
export const stocktaking: Translated<typeof ko.stocktaking> = {
  title: 'Kiểm kê tồn kho',
  breadcrumbRoot: 'Quản lý mua hàng / vật tư',
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
    selectRow: (inventoryCountNo: string): string => `Chọn ${inventoryCountNo}`,
    deselectRow: (inventoryCountNo: string): string => `Bỏ chọn ${inventoryCountNo}`,
    refresh: 'Làm mới',
    asOf: (at: string): string => `Cập nhật lần cuối ${at}`,
    open: 'Mở kiểm kê',
    confirmOpen: 'Thực hiện mở kiểm kê',
    keepEditing: 'Nhập tiếp',
    discardDraft: 'Bỏ nội dung đã nhập',
    saveLocation: 'Hoàn tất kiểm kê',
    close: 'Chốt',
    confirmClose: 'Thực hiện chốt kiểm kê',
    keepCounting: 'Không chốt',
    adjustment: 'Đăng ký điều chỉnh',
  },
  actionReasons: {
    openCodeListPending: 'Mở kiểm kê: lựa chọn loại kiểm kê chưa sẵn sàng nên chưa mở được.',
    openNeedsCountType: 'Mở kiểm kê: hãy chọn loại kiểm kê.',
    openNeedsWarehouse: 'Mở kiểm kê: hãy chọn kho.',
    openNeedsPlannedDate: 'Mở kiểm kê: hãy nhập ngày kế hoạch.',
    saveTruncated:
      'Hoàn tất kiểm kê vị trí này: chưa tải đủ toàn bộ dòng của vị trí này nên không lưu được.',
    saveNoLines: 'Hoàn tất kiểm kê vị trí này: vị trí này không có dòng nào để lưu.',
    saveIncompleteQty: (remaining: number): string =>
      `Hoàn tất kiểm kê vị trí này: còn ${String(remaining)} dòng chưa nhập số lượng thực tế. Phải điền toàn bộ dòng của vị trí này mới lưu được.`,
    saveInvalidQty: (invalid: number): string =>
      `Hoàn tất kiểm kê vị trí này: có ${String(invalid)} dòng phải nhập lại số lượng thực tế.`,
    saveReasonListPending:
      'Hoàn tất kiểm kê vị trí này: lựa chọn lý do chênh lệch chưa sẵn sàng nên vị trí có chênh lệch không lưu được.',
    saveNeedsReason: (remaining: number): string =>
      `Hoàn tất kiểm kê vị trí này: có ${String(remaining)} dòng có số lượng thực tế khác sổ sách nên cần lý do chênh lệch.`,
    saveInvalidReason: 'Hoàn tất kiểm kê vị trí này: có dòng phải chọn lại lý do chênh lệch.',
    closeAlreadyClosed: 'Chốt: đã chốt rồi.',
    closeSummaryUnavailable:
      'Chốt: không đọc được tóm tắt tiến độ kiểm kê nên không xét được điều kiện chốt. Hãy tra cứu lại rồi thử.',
    closeUncounted: (remaining: number): string =>
      `Chốt: còn ${String(remaining)} phiếu chưa kiểm kê nên không chốt được.`,
    closeVariance: (remaining: number): string =>
      `Chốt: còn ${String(remaining)} chênh lệch nên không chốt được. Hãy điều chỉnh chênh lệch rồi mới chốt được.`,
  },
  errors: {
    codeTooLong: (max: number): string => `Mã không được vượt quá ${String(max)} ký tự.`,
    plannedDateInvalid: 'Hãy nhập ngày kế hoạch là ngày có thật. Ví dụ: 2026-08-06',
    qtyNotNumber: 'Hãy nhập số lượng thực tế bằng chữ số.',
    qtyNegative: 'Số lượng thực tế không được nhỏ hơn 0.',
  },
  notes: {
    openRecheck:
      'Hãy kiểm tra ở danh sách xem kiểm kê đã được mở chưa rồi mới thử lại. Gửi lại mà không kiểm tra thì cùng một kho có thể có hai phiếu kiểm kê.',
    saveRecheck:
      'Hãy tra cứu lại để kiểm tra đã lưu chưa rồi mới thử. Gửi lại cùng một vị trí thì vị trí đó lại bị thay nguyên khối.',
    closeRecheck: 'Hãy tra cứu lại để kiểm tra kiểm kê đã được chốt chưa rồi mới thử.',
  },
  dialog: {
    openTitle: 'Mở kiểm kê với nội dung này chứ?',
    openLead: 'Phiếu kiểm kê sẽ được tạo với các giá trị dưới đây.',
    openIrreversible: 'Kiểm kê đã mở thì không xóa hay hoàn tác được.',
    discardTitle: 'Bỏ các giá trị đã nhập chứ?',
    closeTitle: 'Chốt kiểm kê này chứ?',
    closeLead: 'Kiểm kê dưới đây sẽ được chốt.',
    closeIrreversible: 'Chốt rồi thì không sửa kiểm kê này được nữa.',
  },
  result: {
    label: 'Kết quả mở kiểm kê',
    openedNo: 'Số kiểm kê',
    savedToast: 'Đã hoàn tất kiểm kê.',
    closedLabel: 'Kết quả chốt kiểm kê',
    closedNo: 'Số kiểm kê',
    closedStatus: 'Trạng thái sau khi chốt',
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
    itemCode: 'Mã mặt hàng',
    itemName: 'Tên mặt hàng',
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
  },
  filters: {
    all: 'Tất cả',
    lookupTruncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} phiếu`,
    totalOnly: (total: number): string => `Tổng ${String(total)} phiếu`,
  },
  empty: {
    noResultTitle: 'Không có kiểm kê nào khớp điều kiện',
    beyondLastTitle: 'Trang này không có kết quả',
    noSelectionTitle: 'Chọn một kiểm kê để xem tiến độ',
    notFoundTitle: 'Không tìm thấy kiểm kê đã chọn',
    notFoundDescription: 'Phiếu đã bị xóa hoặc số trên địa chỉ bị sai.',
    noLocationTitle: 'Chọn vị trí để xem các dòng kiểm kê',
    noLinesTitle: 'Vị trí này không có dòng kiểm kê nào',
    closedTitle: 'Kiểm kê đã chốt thì không sửa được nữa',
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
