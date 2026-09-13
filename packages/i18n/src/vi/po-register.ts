import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-11 신규 P/O 등록. **일반 구매 발주를 만드는 곳이 아니다**가 첫 문장이고,
 * 등록과 승인 요청이 별개 동작이라는 사실을 문면이 거듭 말한다.
 */
export const poRegister: Translated<typeof ko.poRegister> = {
  title: 'Đăng ký P/O mới',
  breadcrumbRoot: 'Kho vật tư',
  panes: {
    source: 'Phần vượt liên quan',
    header: 'Thông tin đơn đặt hàng',
    lines: 'Dòng đơn đặt hàng',
  },
  scope: {
    title: 'Màn hình đăng ký sau cho phần nhập vượt',
    description:
      'Tạo P/O để quyết toán phần vượt chuyển sang từ màn hình tách phần nhập vượt. Đơn mua hàng thông thường không được tạo ở màn hình này.',
  },
  fields: {
    supplier: 'Nhà cung cấp',
    businessUnit: 'Bộ phận kinh doanh',
    plant: 'Nhà máy',
    orderDate: 'Ngày đặt hàng',
    expectedReceiptDate: 'Ngày dự kiến nhập kho',
  },
  source: {
    label: 'Phần vượt liên quan',
    inboundReceiptNo: 'Số nhập hàng',
    supplier: 'Nhà cung cấp',
    plant: 'Nhà máy',
    status: 'Trạng thái',
    lineNo: 'Số dòng',
    item: 'Mặt hàng',
    receivedQty: 'Số lượng nhập hàng',
    uom: 'Đơn vị',
    choose: 'Chọn đối tượng',
    chosen: 'Đối tượng',
    chooseRow: (lineNo: number): string => `Chọn đối tượng là dòng ${String(lineNo)}`,
    inheritNote:
      'Dòng đã chọn được kế thừa thành 1 dòng đơn đặt hàng. Số lượng đặt hàng mặc định là số lượng nhập hàng và không đặt được ít hơn thế.',
    singleLineNote: 'Chỉ có một dòng nhập hàng nên dòng đó được chốt làm đối tượng.',
  },
  lineTable: {
    lineNo: 'Số dòng',
    item: 'Mặt hàng',
    orderedQty: 'Số lượng đặt hàng',
    uom: 'Đơn vị',
    toleranceOver: 'Dung sai vượt',
    toleranceUnder: 'Dung sai thiếu',
    rowActions: 'Thao tác dòng',
    inherited: 'Kế thừa',
    itemLabel: (lineNo: number): string => `Mặt hàng của dòng ${String(lineNo)}`,
    orderedQtyLabel: (lineNo: number): string => `Số lượng đặt hàng của dòng ${String(lineNo)}`,
    uomLabel: (lineNo: number): string => `Đơn vị của dòng ${String(lineNo)}`,
    toleranceOverLabel: (lineNo: number): string => `Dung sai vượt của dòng ${String(lineNo)}`,
    toleranceUnderLabel: (lineNo: number): string => `Dung sai thiếu của dòng ${String(lineNo)}`,
    minNote: (sourceQty: number): string => `Từ phần vượt ${String(sourceQty)} trở lên`,
  },
  actions: {
    addLine: 'Thêm dòng',
    removeLine: (lineNo: number): string => `Xóa dòng ${String(lineNo)}`,
    register: 'Đăng ký',
    cancel: 'Hủy bỏ',
    confirmRegister: 'Thực hiện đăng ký',
    keepEditing: 'Nhập tiếp',
    discardDraft: 'Bỏ nội dung đã nhập',
    requestApproval: 'Yêu cầu phê duyệt',
    confirmSubmit: 'Thực hiện yêu cầu phê duyệt',
  },
  submit: {
    reason: 'Lý do yêu cầu',
    reasonPlaceholder: 'Hãy ghi tóm tắt ở dòng đầu, từ dòng sau ghi căn cứ.',
    reasonHelper: 'Dòng đầu sẽ thành phần tóm tắt trong danh sách hộp phê duyệt.',
  },
  actionReasons: {
    noContext:
      'Đăng ký cần có phần vượt được chuyển sang. Hãy đăng ký phần vượt ở màn hình tách phần nhập vượt rồi đi tiếp từ kết quả đó.',
    sourceNotLoaded: 'Đăng ký chỉ thực hiện được sau khi tải xong phần vượt liên quan.',
    sourceLineNotChosen:
      'Đăng ký chỉ thực hiện được sau khi chọn phần vượt liên quan. Hãy chọn một dòng ở khu vực trên.',
    noSourceLines:
      'Đăng ký cần có dòng để kế thừa. Phiếu nhập hàng này không có dòng nào, hãy kiểm tra lại phiếu liên quan.',
    headerIncomplete:
      'Đăng ký chỉ thực hiện được sau khi điền đủ các mục bắt buộc của thông tin đơn đặt hàng.',
    lineInvalid: 'Đăng ký chỉ thực hiện được sau khi sửa lỗi ở các dòng đơn đặt hàng.',
    saving: 'Đang gửi đăng ký. Khi có phản hồi thì nhập tiếp được.',
    alreadyRegistered:
      'Đã đăng ký rồi. Muốn đăng ký phần vượt khác thì hãy bắt đầu lại từ màn hình tách phần nhập vượt.',
    nothingToDiscard:
      'Không có nội dung nhập nào để hủy bỏ. Nếu có giá trị đã gõ thì sẽ trả về giá trị kế thừa.',
    reasonRequired:
      'Yêu cầu phê duyệt chỉ thực hiện được sau khi ghi lý do. Chỉ toàn khoảng trắng thì không gửi được.',
    submitting: 'Đang gửi yêu cầu phê duyệt. Khi có phản hồi thì nhập tiếp được.',
  },
  errors: {
    supplierRequired: 'Hãy chọn nhà cung cấp.',
    businessUnitRequired: 'Hãy chọn bộ phận kinh doanh.',
    plantRequired: 'Hãy chọn nhà máy.',
    orderDateRequired: 'Hãy chọn ngày đặt hàng.',
    itemRequired: 'Hãy chọn mặt hàng.',
    uomRequired: 'Hãy chọn đơn vị.',
    qtyRequired: 'Hãy nhập số lượng đặt hàng.',
    qtyNotNumber: 'Hãy nhập số lượng đặt hàng bằng chữ số.',
    qtyNotPositive: 'Số lượng đặt hàng phải lớn hơn 0.',
    qtyBelowSource: (sourceQty: number): string =>
      `Không đặt được ít hơn phần vượt ${String(sourceQty)}.`,
    toleranceNotNumber: 'Hãy nhập dung sai bằng chữ số.',
    toleranceNegative: 'Dung sai không được nhỏ hơn 0.',
  },
  warnings: {
    toleranceOverPositive:
      'Đặt dung sai vượt lớn thì lần nhập vượt sau cũng sẽ cần xử lý như thế này.',
    supplierChanged:
      'Bạn đã chọn nhà cung cấp khác với nhà cung cấp được kế thừa. Nơi gửi phần vượt và nơi nhận đơn đặt hàng sẽ khác nhau.',
  },
  dialog: {
    registerTitle: 'Đăng ký P/O với nội dung này chứ?',
    registerLead: 'Một phiếu đặt hàng sẽ được tạo với nội dung dưới đây.',
    lineCount: (count: number): string => `${String(count)} dòng đơn đặt hàng`,
    totalOrderedQty: 'Tổng số lượng đặt hàng',
    totalUnreadable: 'Không tính được tổng',
    mixedUom: 'Đơn vị khác nhau theo từng dòng nên tổng không phải số lượng của một đơn vị.',
    registerNoUndo:
      'Sau khi đăng ký thì màn hình này không hoàn tác được. Việc hủy phải đi qua phê duyệt.',
    registerIsNotApproval: 'Chỉ đăng ký thôi. Trình phê duyệt là một thao tác riêng.',
    discardTitle: 'Bỏ nội dung đã gõ chứ?',
    discardLead:
      'Nội dung đã gõ ở thông tin đơn đặt hàng và các dòng sẽ mất, quay về giá trị kế thừa từ phần vượt chuyển sang.',
    submitTitle: 'Trình phê duyệt với lý do này chứ?',
    submitLead: 'Yêu cầu phê duyệt đơn đặt hàng này với lý do dưới đây.',
    reasonFull: 'Toàn văn lý do',
    reasonFirstLine: 'Dòng đầu sẽ hiện làm tóm tắt trong hộp phê duyệt',
    reasonSummaryNote: 'Trong danh sách hộp phê duyệt chỉ thấy dòng đầu này.',
    submitApprover:
      'Người phê duyệt và luồng phê duyệt không do màn hình này quyết định. Sẽ triển khai theo định nghĩa luồng phê duyệt.',
    submitNoUndo:
      'Sau khi trình thì màn hình này không hoàn tác được. Trình lại sau khi bị trả lại là một yêu cầu mới.',
  },
  result: {
    label: 'Kết quả đăng ký',
    createdTitle: (purchaseOrderNo: string): string => `Đã tạo phiếu đặt hàng ${purchaseOrderNo}`,
    createdDescription: 'Đơn đặt hàng để quyết toán phần nhập vượt đã được đăng ký.',
    purchaseOrderNo: 'Số phiếu',
    createdStatusCode: 'Trạng thái tại thời điểm đăng ký',
    erpPurchaseOrderNo: 'Số đơn đặt hàng ERP',
    erpUnmatched: 'Chưa khớp ERP',
    erpUnmatchedNote: 'Sẽ được điền sau khi liên kết.',
    lineCount: (count: number): string => `Đã lưu ${String(count)} dòng đơn đặt hàng.`,
    submitting: 'Đang trình phê duyệt.',
    submittedTitle: (purchaseOrderNo: string): string =>
      `Đã trình phê duyệt phiếu đặt hàng ${purchaseOrderNo}`,
    submittedDescription: 'Hãy xem tiến độ ở hộp phê duyệt.',
    submittedNoRequestNo:
      'Màn hình này không có giá trị số yêu cầu phê duyệt để hiện. Số đó xem được ở hộp phê duyệt.',
    submitFailedTitle: (purchaseOrderNo: string): string =>
      `Phiếu đặt hàng ${purchaseOrderNo} đã được tạo nhưng chưa trình phê duyệt`,
    submitFailedDescription:
      'Phiếu vẫn còn nguyên. Bạn có thể trình lại ở dưới, đừng đăng ký lại cùng nội dung.',
  },
  values: {
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Tải tên thất bại',
    inactiveSuffix: ' (không dùng)',
  },
  lookups: {
    truncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    failed: 'Không tải được danh sách chọn.',
  },
  loading: {
    sourceReceipt: 'Đang tải phần vượt liên quan',
  },
  empty: {
    noContextTitle: 'Không có phần vượt nào được chuyển sang',
    noContextDescription:
      'Hãy đăng ký phần vượt ở màn hình tách phần nhập vượt thì từ kết quả đó sẽ sang được màn hình này.',
    noSourceLinesTitle: 'Phiếu nhập hàng này không có dòng nào',
    noSourceLinesDescription:
      'Không có dòng để kế thừa nên không tạo được đơn đặt hàng. Hãy kiểm tra lại phiếu liên quan.',
    noTargetTitle: 'Chưa chọn phần vượt liên quan',
    noTargetDescription:
      'Chọn một dòng ở khu vực trên thì dòng đó được kế thừa thành 1 dòng đơn đặt hàng.',
  },
  reasons: {
    referencesFailed:
      'Không tải được tên nhà cung cấp, bộ phận kinh doanh, nhà máy, mặt hàng và đơn vị. Lý do sẽ hiện ở chỗ của tên.',
  },
  notes: {
    lineNoAssignedByServer: 'Số dòng được đánh theo thứ tự mảng khi đăng ký.',
    networkUnconfirmed:
      'Không nhận được phản hồi nên màn hình này không xác nhận được đã đăng ký hay chưa. Đơn đặt hàng có thể đã được tạo, đừng đăng ký lại ngay cùng nội dung.',
  },
};
