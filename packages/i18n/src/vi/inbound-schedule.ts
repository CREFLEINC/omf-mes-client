import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-01-09 입하 예정 조회. 조회 전용이고, 참조 이름의 세 갈래(미도착·목록에 없음·실패)를 가른다. */
export const inboundSchedule: Translated<typeof ko.inboundSchedule> = {
  title: 'Tra cứu kế hoạch nhập hàng',
  breadcrumbRoot: 'Kho vật tư',
  panes: {
    list: 'Danh sách kế hoạch nhập hàng',
    lines: 'Các dòng của phiếu đã chọn',
  },
  fields: {
    periodFrom: 'Ngày dự kiến đến bắt đầu',
    periodTo: 'Ngày dự kiến đến kết thúc',
    supplier: 'Nhà cung cấp',
    status: 'Trạng thái',
    item: 'Mặt hàng',
    q: 'Tìm số chứng từ',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    selectRow: (asnNo: string): string => `Chọn ${asnNo}`,
    deselectRow: (asnNo: string): string => `Bỏ chọn ${asnNo}`,
  },
  reasons: {
    periodInvalid:
      'Ngày dự kiến đến phải là ngày có thật. Hãy chọn lại ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Ngày dự kiến đến kết thúc không được sớm hơn ngày bắt đầu.',
    referencesFailed: 'Không tải được tên nhà cung cấp. Lý do sẽ hiện ở chỗ của tên.',
    lineReferencesFailed:
      'Không tải được tên mặt hàng, đơn vị và nhà máy. Lý do sẽ hiện ở chỗ của tên.',
  },
  loading: {
    asns: 'Đang tải danh sách kế hoạch nhập hàng',
    lines: 'Đang tải các dòng',
  },
  table: {
    asnNo: 'Số kế hoạch nhập hàng',
    supplier: 'Nhà cung cấp',
    expectedArrivalDate: 'Ngày dự kiến đến',
    status: 'Trạng thái',
    select: 'Chọn',
  },
  lineTable: {
    lineNo: 'Số dòng',
    item: 'Mặt hàng',
    expectedQty: 'Số lượng dự kiến',
    uom: 'Đơn vị',
    supplierLotNo: 'LOT nhà cung cấp',
  },
  summary: {
    label: 'Kế hoạch nhập hàng đã chọn',
    asnNo: 'Số kế hoạch nhập hàng',
    supplier: 'Nhà cung cấp',
    plant: 'Nhà máy',
    expectedArrivalDate: 'Ngày dự kiến đến',
    deliveryNoteNo: 'Số phiếu giao hàng',
    remarks: 'Ghi chú',
  },
  filters: {
    all: 'Tất cả',
    statusNote:
      'Trạng thái là danh sách tạm, chưa được chốt. Danh sách được dựng từ các giá trị có trong lần tra cứu này, nên giá trị không có trong kết quả thì không có trong danh sách.',
    periodNote: 'Khoảng ngày dự kiến đến có thể để trống vẫn tra cứu được.',
    lookupTruncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
    chipSupplier: (value: string): string => `Nhà cung cấp: ${value}`,
    chipStatus: (value: string): string => `Trạng thái: ${value}`,
    chipItem: (value: string): string => `Mặt hàng: ${value}`,
    chipQ: (value: string): string => `Số chứng từ: ${value}`,
    chipRemoveSupplier: 'Bỏ điều kiện nhà cung cấp',
    chipRemoveStatus: 'Bỏ điều kiện trạng thái',
    chipRemoveItem: 'Bỏ điều kiện mặt hàng',
    chipRemoveQ: 'Bỏ điều kiện số chứng từ',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} phiếu`,
    totalOnly: (total: number): string => `Tổng ${String(total)} phiếu`,
  },
  empty: {
    noResultTitle: 'Không có kế hoạch nhập hàng nào khớp điều kiện',
    noResultDescription: 'Hãy nới rộng khoảng ngày hoặc bớt điều kiện rồi tra cứu lại.',
    notQueriedTitle: 'Chưa tra cứu',
    notQueriedDescription: 'Hãy sửa ngày dự kiến đến theo hướng dẫn ở dòng điều kiện rồi tra cứu.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noSelectionTitle: 'Chọn một kế hoạch nhập hàng để xem các dòng',
    noSelectionDescription: 'Hãy chọn một phiếu ở danh sách trên rồi bấm 「Chọn」.',
    noLinesTitle: 'Phiếu này không có dòng nào',
    noLinesDescription: 'Kế hoạch nhập hàng này không chứa dòng mặt hàng nào.',
  },
  values: {
    empty: '—',
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    overdue: 'Đã quá ngày dự kiến đến',
    inactiveSuffix: ' (không dùng)',
  },
  notes: {
    sortScope:
      'Sắp xếp chỉ áp dụng trong trang đang xem. Các phiếu ở trang khác không được sắp xếp cùng.',
  },
};
