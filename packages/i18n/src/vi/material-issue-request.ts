import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-02-10 추가 자재 출고 요청(수동). 발행은 되돌릴 수 없다 — 취소 경로가 이 화면에 없다.
 *
 * ⭐ **`policyNotice` 는 규범 선언이다.** 앞 문장이 금지를 그대로 말하고 뒤 문장이 대신 할 일을
 * 말한다. 결과 설명으로 무르게 옮기면 이 화면의 존재 이유가 사라진다.
 */
export const materialIssueRequest: Translated<typeof ko.materialIssueRequest> = {
  title: 'Yêu cầu xuất kho vật tư bổ sung',
  breadcrumbRoot: 'Sản xuất',
  policyNotice: {
    title: 'Cấm mang vật tư ra khỏi kho mà không theo quy trình',
    description:
      'Không được lấy vật tư trong kho khi chưa có yêu cầu. Vật tư thiếu cũng phải yêu cầu ở màn hình này và nhận qua xuất kho chính thức.',
  },
  panes: {
    target: 'W/O đích',
    lines: 'Mặt hàng yêu cầu',
    reason: 'Lý do',
    result: 'Phát hành yêu cầu',
  },
  formFields: {
    workOrderSearch: 'Tìm W/O',
    workOrder: 'W/O',
    warehouse: 'Kho',
    destinationLocation: 'Vị trí đến',
    requiredDate: 'Ngày cần',
    requiredTime: 'Giờ cần',
    reason: 'Lý do yêu cầu',
    remarks: 'Ghi chú',
  },
  placeholders: {
    workOrderSearch: 'Tìm theo số W/O rồi nhấn Enter',
    select: 'Hãy chọn',
  },
  lineTable: {
    item: 'Mặt hàng',
    itemLabel: (rowIndex: number) => `Mặt hàng dòng ${String(rowIndex)}`,
    requiredQty: 'BOM cần',
    issuedQty: 'Đã xuất',
    shortageQty: 'Thiếu',
    requestedQty: 'Số lượng yêu cầu',
    requestedQtyLabel: (rowIndex: number) => `Số lượng yêu cầu dòng ${String(rowIndex)}`,
    uom: 'Đơn vị',
    uomLabel: (rowIndex: number) => `Đơn vị dòng ${String(rowIndex)}`,
    rowActions: 'Thao tác dòng',
  },
  actions: {
    loadShortage: 'Tải lượng cần theo BOM',
    addLine: '+ Thêm mặt hàng',
    removeLine: (rowIndex: number) => `Xóa dòng ${String(rowIndex)}`,
    publish: 'Phát hành yêu cầu',
    retry: 'Thử lại',
  },
  /** 비활성 사유는 그 컨트롤이 막힌 까닭과 푸는 법을 함께 적는다 — 원문의 성질을 지킨다. */
  actionReasons: {
    noWorkOrder: 'Hãy chọn W/O đích trước.',
    noDestination: 'Hãy chọn vị trí đến. Chọn kho trước thì các vị trí của kho đó sẽ hiện ra.',
    noRequestableLine: 'Không có mặt hàng nào có số lượng yêu cầu lớn hơn 0.',
    noReasonOrRemarks: 'Hãy chọn lý do hoặc ghi chú.',
    lineInvalid: 'Hãy kiểm tra phần nhập của mặt hàng yêu cầu.',
    requiredAtIncomplete: 'Hãy nhập cả ngày cần và giờ cần, hoặc để trống cả hai.',
    saving: 'Đang gửi.',
    alreadyPublished: 'Đã phát hành cho W/O này rồi.',
  },
  errors: {
    destinationRequired: 'Hãy chọn vị trí đến.',
    requiredDateMissing: 'Hãy nhập kèm ngày cần.',
    requiredTimeMissing: 'Hãy nhập kèm giờ cần.',
    itemRequired: 'Hãy chọn mặt hàng.',
    uomRequired: 'Hãy chọn đơn vị.',
    requestedQtyNotNumber: 'Hãy nhập bằng số.',
    requestedQtyNotPositive: 'Số lượng yêu cầu phải từ 0 trở lên.',
  },
  /** ⚠ 경고는 **막지 않는다.** 「막지 않습니다」를 옮길 때도 그 말을 빼지 않는다. */
  warnings: {
    outsideBom: 'Ngoài BOM',
    outsideBomTitle: 'Có mặt hàng không nằm trong BOM',
    outsideBomCount: (count: number) =>
      `Có ${String(count)} mặt hàng không nằm trong BOM. Khi đưa vào có thể bị chặn ở bước kiểm tra sai vật tư. Yêu cầu vẫn không bị chặn.`,
    existingRequestsTitle: 'Đã có yêu cầu được phát hành cho W/O này',
    existingRequests: (count: number) =>
      `Đã có ${String(count)} yêu cầu được phát hành cho W/O này. Yêu cầu trùng không bị chặn — hãy xem danh sách bên dưới rồi tiến hành.`,
    existingRequestRow: (issueRequestNo: string, statusCode: string, requiredAt: string) =>
      `${issueRequestNo} · ${statusCode} · ${requiredAt}`,
    existingRequestsTruncated:
      'Chỉ thấy một phần đầu. Toàn bộ xem ở danh sách yêu cầu xuất kho vật tư.',
  },
  values: {
    empty: '—',
    workOrderType: (code: string) => `Loại ${code}`,
    workOrderOption: (workOrderNo: string, operation: string, itemCode: string) =>
      `${workOrderNo} · ${operation} · ${itemCode}`,
    orderQty: (qty: string, uom: string) => `Số lượng lệnh ${qty} ${uom}`,
  },
  codes: {
    reasonEmpty: 'Không có lý do nào để chọn.',
    reasonFailed: 'Không tải được danh sách lý do.',
  },
  filters: {
    lookupFailed: 'Không tải được các lựa chọn.',
    lookupTruncated: 'Chỉ thấy một phần đầu của các lựa chọn. Hãy thu hẹp bằng từ khóa.',
    workOrderTruncated: 'Chỉ thấy một phần đầu của kết quả tìm. Hãy thu hẹp bằng từ khóa.',
  },
  loading: {
    shortage: 'Đang tải lượng cần theo BOM',
  },
  empty: {
    noWorkOrderTitle: 'Hãy chọn W/O đích trước',
    noWorkOrderDescription: 'Chọn W/O rồi mới ghi được mặt hàng yêu cầu và lý do.',
    noWorkOrderOption: 'Không có kết quả tìm kiếm.',
    noLinesTitle: 'Không có mặt hàng để yêu cầu',
    noLinesDescription: 'Hãy tải lượng cần theo BOM hoặc tự thêm mặt hàng.',
  },
  notes: {
    lineNoAssignedByServer: 'Số dòng do máy chủ cấp.',
    shortageColumnsReadOnly:
      'BOM cần · đã xuất · thiếu là giá trị hệ thống đưa ra nên không sửa được.',
    warehouseAutoFilled: 'Đã điền theo vị trí bán thành phẩm mặc định của W/O. Cần thì đổi được.',
  },
  result: {
    title: 'Đã phát hành yêu cầu xuất kho vật tư bổ sung',
    issueRequestNo: (no: string) => `Số yêu cầu: ${no}`,
    statusCode: (code: string) => `Trạng thái: ${code}`,
    lineCount: (count: number) => `${String(count)} mặt hàng`,
  },
};
