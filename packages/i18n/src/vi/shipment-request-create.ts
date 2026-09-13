import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-01 출하지시서 Import·작업지시 생성. 지시서 경유와 단독 생성이 한 폼을 나눠 쓴다. */
export const shipmentRequestCreate: Translated<typeof ko.shipmentRequestCreate> = {
  title: 'Nhập phiếu chỉ thị xuất hàng và tạo lệnh xuất hàng',
  breadcrumbRoot: 'Xuất hàng',
  panes: {
    source: 'Danh sách phiếu chỉ thị xuất hàng',
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
    salesOrderNo: 'Số phiếu chỉ thị',
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
    startStandalone: 'Tạo độc lập không cần phiếu chỉ thị',
    importOrderFile: 'Nhập phiếu chỉ thị',
    addLine: 'Thêm dòng',
    removeLine: (rowIndex: number): string => `Xóa dòng ${String(rowIndex)}`,
    submit: 'Lập lệnh xuất hàng',
  },
  fields: {
    customer: 'Khách hàng',
    shipToPartner: 'Nơi giao hàng',
    requestedShipDate: 'Ngày yêu cầu xuất hàng',
  },
  lineTable: {
    item: 'Mặt hàng',
    itemLabel: (rowIndex: number): string => `Mặt hàng dòng ${String(rowIndex)}`,
    requestedQty: 'Số lượng yêu cầu',
    requestedQtyLabel: (rowIndex: number): string => `Số lượng yêu cầu dòng ${String(rowIndex)}`,
    availableQty: 'Số lượng khả dụng',
    allocatedQty: 'Số lượng phân bổ',
    allocatedQtyLabel: (rowIndex: number): string => `Số lượng phân bổ dòng ${String(rowIndex)}`,
    inspection: 'Kiểm tra',
    inspectionLabel: (rowIndex: number): string =>
      `Thuộc diện kiểm tra xuất hàng dòng ${String(rowIndex)}`,
    customerLotRequirement: 'Yêu cầu LOT của khách hàng',
    customerLotRequirementLabel: (rowIndex: number): string =>
      `Yêu cầu LOT của khách hàng dòng ${String(rowIndex)}`,
    minimumRemainingShelfLifeDays: 'Hạn sử dụng còn lại (ngày)',
    minimumRemainingShelfLifeDaysLabel: (rowIndex: number): string =>
      `Hạn sử dụng còn lại dòng ${String(rowIndex)}`,
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
    customerRequired: 'Hãy chọn khách hàng.',
    shipToPartnerRequired: 'Hãy chọn nơi giao hàng.',
    requestedShipDateRequired: 'Hãy nhập ngày yêu cầu xuất hàng.',
    itemRequired: 'Hãy chọn mặt hàng.',
    uomRequired: 'Hãy chọn đơn vị.',
    requestedQtyRequired: 'Hãy nhập số lượng yêu cầu.',
    requestedQtyNotPositive: 'Số lượng yêu cầu phải lớn hơn 0.',
    qtyNotNumber: 'Hãy nhập bằng số.',
    allocatedQtyNegative: 'Số lượng phân bổ phải từ 0 trở lên.',
    allocatedQtyOverRequested: (requestedQty: number): string =>
      `Số lượng phân bổ không được vượt quá số lượng yêu cầu (${String(requestedQty)}).`,
    customerLotRequirementTooLong: (maxLength: number): string =>
      `Yêu cầu LOT của khách hàng không được vượt quá ${String(maxLength)} ký tự.`,
    shelfLifeNegative: 'Hạn sử dụng còn lại phải từ 0 ngày trở lên.',
  },
  actionReasons: {
    saving: 'Đang gửi.',
    alreadySubmitted: 'Đã lập lệnh rồi.',
    noTarget: 'Hãy chọn phiếu chỉ thị trước hoặc bắt đầu tạo độc lập.',
    noAllocatedLine: 'Không có dòng nào có số lượng phân bổ từ 1 trở lên.',
    lineInvalid: 'Hãy kiểm tra phần nhập của các dòng.',
    headerIncomplete: 'Hãy nhập các mục bắt buộc.',
    importFileNotSupported:
      'Chưa dùng được chức năng nhập phiếu chỉ thị vì định dạng tệp chưa được chốt. Khi định dạng được quyết định thì nút này sẽ dùng được.',
  },
  notes: {
    fromOrderLocked:
      'Đây là lệnh lập qua phiếu chỉ thị nên không sửa được khách hàng, nơi giao hàng và mặt hàng, số lượng của các dòng.',
    requestedQtyFixed:
      'Số lượng yêu cầu được tự động điền bằng số lượng còn lại của phiếu chỉ thị và không sửa được.',
    lineNoAssignedByServer: 'Số dòng do máy chủ cấp.',
    erpUnmatched: 'Phần tạo độc lập không có số phiếu chỉ thị ERP.',
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
    sourceList: 'Đang tải danh sách phiếu chỉ thị xuất hàng',
    sourceDetail: 'Đang tải chi tiết phiếu chỉ thị xuất hàng',
  },
  empty: {
    noResultTitle: 'Không có phiếu chỉ thị xuất hàng nào khớp điều kiện',
    noResultDescription: 'Hãy đổi điều kiện hoặc đặt lại rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noTargetTitle: 'Hãy chọn phiếu chỉ thị hoặc bắt đầu tạo độc lập',
    noTargetDescription:
      'Chọn phiếu chỉ thị xuất hàng ở danh sách bên trái thì sẽ lập lệnh theo phiếu đó; muốn tạo mà không có phiếu chỉ thị thì hãy bấm nút bên dưới.',
  },
};
