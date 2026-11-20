import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-01 출하작업지시 생성. ERP S/O 경유와 ERP S/O 없이 생성이 한 폼을 나눠 쓴다. */
export const shipmentRequestCreate: Translated<typeof ko.shipmentRequestCreate> = {
  title: 'Tạo lệnh xuất hàng',
  breadcrumbRoot: 'Quản lý bán hàng / xuất hàng',
  panes: {
    source: 'Danh sách ERP S/O',
    header: 'Thông tin lệnh xuất hàng',
    lines: 'Dòng của lệnh xuất hàng',
  },
  filters: {
    customer: 'Khách hàng',
    period: 'Ngày đặt hàng',
    unassignedOnly: 'Chỉ chưa lập lệnh',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    all: 'Tất cả',
    lookupFailed: 'Không tải được các lựa chọn.',
    lookupTruncated:
      'Chỉ hiện một phần đầu của các lựa chọn. Nếu không có giá trị cần tìm, hãy báo người phụ trách.',
    chipCustomer: (value: string): string => `Khách hàng: ${value}`,
    chipPeriod: (from: string, to: string): string => `Ngày đặt hàng: ${from} ~ ${to}`,
    chipUnassignedOnly: 'Chỉ chưa lập lệnh',
    chipRemoveCustomer: 'Bỏ điều kiện khách hàng',
    chipRemovePeriod: 'Bỏ điều kiện ngày đặt hàng',
    chipRemoveUnassignedOnly: 'Bỏ điều kiện chỉ chưa lập lệnh',
  },
  table: {
    salesOrderNo: 'ERP S/O',
    customer: 'Khách hàng',
    orderDate: 'Ngày đặt hàng',
    status: 'Trạng thái',
    selectRow: (label: string): string => `Chọn ${label}`,
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    startStandalone: 'Tạo không cần ERP S/O',
    addLine: 'Thêm dòng',
    removeLine: (rowIndex: number): string => `Xóa dòng ${String(rowIndex)}`,
    submit: 'Lập lệnh xuất hàng',
  },
  fields: {
    fulfillmentPlant: 'Nhà máy phụ trách xuất hàng',
    customer: 'Khách hàng',
    shipToPartner: 'Nơi giao hàng',
    requestedShipDate: 'Ngày yêu cầu xuất hàng',
  },
  lineTable: {
    item: 'Mặt hàng',
    itemLabel: (rowIndex: number): string => `Mặt hàng dòng ${String(rowIndex)}`,
    itemUnpicked: 'Chọn mặt hàng',
    uom: 'Đơn vị',
    uomLabel: (rowIndex: number): string => `Đơn vị dòng ${String(rowIndex)}`,
    requestedQty: 'Số lượng yêu cầu',
    requestedQtyLabel: (rowIndex: number): string => `Số lượng yêu cầu dòng ${String(rowIndex)}`,
    availableQty: 'Số lượng khả dụng',
    allocatedQty: 'Số lượng phân bổ',
    allocatedQtyLabel: (rowIndex: number): string => `Số lượng phân bổ dòng ${String(rowIndex)}`,
    inspection: 'Kiểm tra',
    inspectionLabel: (rowIndex: number): string =>
      `Thuộc diện kiểm tra xuất hàng dòng ${String(rowIndex)}`,
    rowActions: 'Thao tác dòng',
  },
  values: {
    empty: '—',
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    availableQtyLoading: 'Đang tra cứu',
    availableQtyFailed: 'Tra cứu thất bại',
    erpNotMatched: '—',
  },
  errors: {
    fulfillmentPlantRequired: 'Hãy chọn nhà máy phụ trách xuất hàng.',
    customerRequired: 'Hãy chọn khách hàng.',
    shipToPartnerRequired: 'Hãy chọn nơi giao hàng.',
    requestedShipDateRequired: 'Hãy nhập ngày yêu cầu xuất hàng.',
    requestedQtyNotPositive: 'Số lượng yêu cầu phải lớn hơn 0.',
    qtyNotNumber: 'Hãy nhập bằng số.',
    allocatedQtyNegative: 'Số lượng phân bổ phải từ 0 trở lên.',
    allocatedQtyOverRequested: (requestedQty: number): string =>
      `Số lượng phân bổ không được vượt quá số lượng yêu cầu (${String(requestedQty)}).`,
  },
  actionReasons: {
    saving: 'Đang gửi.',
    alreadySubmitted: 'Đã lập lệnh rồi.',
    noTarget: 'Hãy chọn ERP S/O trước hoặc bấm [Tạo không cần ERP S/O].',
    noAllocatedLine: 'Không có dòng nào có số lượng phân bổ từ 1 trở lên.',
    lineInvalid: 'Hãy kiểm tra phần nhập của các dòng.',
    lineIncomplete: 'Hãy điền mặt hàng, đơn vị và số lượng yêu cầu của dòng.',
    headerIncomplete: 'Hãy nhập các mục bắt buộc.',
  },
  notes: {
    fromOrderLocked:
      'Đây là lệnh lập theo ERP S/O nên không sửa được khách hàng, nơi giao hàng và mặt hàng, số lượng của các dòng.',
    requestedQtyFixed:
      'Số lượng yêu cầu được tự động điền bằng số lượng còn lại của ERP S/O và không sửa được.',
    lineNoAssignedByServer: 'Số dòng do máy chủ cấp.',
    erpUnmatched: 'Lệnh tạo không cần ERP S/O thì không có số ERP S/O.',
    networkUnconfirmed:
      'Chưa nhận được phản hồi. Hãy kiểm tra lại xem máy chủ đã ghi nhận thật chưa rồi thử lại.',
  },
  shortage: {
    title: 'Có dòng thiếu tồn kho khả dụng',
    description: (count: number): string =>
      `Có ${String(count)} dòng có số lượng phân bổ vượt quá số lượng khả dụng. Việc lập lệnh không bị chặn — bạn có thể hạ số lượng phân bổ hoặc cứ tiếp tục.`,
  },
  result: {
    title: 'Đã lập lệnh xuất hàng',
    shipmentRequestNo: (no: string): string => `Số lệnh xuất hàng: ${no}`,
    lineCount: (count: number): string => `${String(count)} dòng`,
  },
  loading: {
    sourceList: 'Đang tải danh sách ERP S/O',
    sourceDetail: 'Đang tải chi tiết ERP S/O',
  },
  empty: {
    noResultTitle: 'Không có ERP S/O nào khớp điều kiện',
    noResultDescription: 'Hãy đổi điều kiện hoặc đặt lại rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noTargetTitle: 'Hãy chọn ERP S/O hoặc bấm [Tạo không cần ERP S/O]',
    noTargetDescription:
      'Chọn ERP S/O ở danh sách bên trái thì sẽ lập lệnh theo S/O đó; muốn tạo mà không có ERP S/O thì hãy bấm nút bên dưới.',
  },
};
