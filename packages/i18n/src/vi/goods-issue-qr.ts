import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-01-02 출고 QR 발행. */
export const goodsIssueQr: Translated<typeof ko.goodsIssueQr> = {
  title: 'Phát hành QR xuất kho vật tư',

  entry: {
    issueLabel: 'Phiếu xuất kho vật tư',
    workerLabel: 'Mã nhân viên',
    missingIssue: 'Hãy nhập số phiếu xuất kho để tải phiếu.',
    lookup: {
      label: 'Số phiếu xuất kho vật tư',
      placeholder: 'Quét hoặc nhập số phiếu xuất kho',
      action: 'Tải phiếu',
      searching: 'Đang tìm phiếu',
      notFound: 'Không tìm thấy phiếu có số đó. Hãy kiểm tra lại số.',
      failed: 'Không tra được phiếu. Hãy kiểm tra kết nối rồi thử lại.',
    },
  },

  pending: {
    sectionLabel: 'Chờ phát hành QR',
    back: 'Về danh sách chờ',
    refresh: 'Làm mới',
    filter: {
      label: 'Tình trạng phát hành',
      unissued: 'Chưa phát hành',
      issued: 'Đã phát hành',
    },
    statusIssued: (count: number) => `Đã phát hành ${String(count)} lần`,
    issuedEmpty: 'Không có dòng nào đã phát hành trong khoảng này.',
    pick: 'Chọn',
    columnIssueNo: 'Số phiếu xuất kho vật tư',
    columnLine: 'Dòng',
    columnItem: 'Hàng hóa',
    columnLot: 'LOT',
    columnQty: 'Số lượng',
    columnStatus: 'Trạng thái',
    statusNotIssued: 'Chưa phát hành',
    statusPrintFailed: (issueCount: number): string => `In lỗi · lần ${String(issueCount)}`,
    columnAction: '',
    window: (days: number, limit: number): string =>
      `Tra cứu QR trong ${String(days)} ngày gần đây · tối đa ${String(limit)} phiếu`,
    loading: 'Đang tìm các dòng chờ phát hành',
    failed: 'Không tải được danh sách chờ. Hãy kiểm tra kết nối rồi làm mới.',
    empty: 'Không có phiếu xuất kho vật tư nào đang chờ phát hành.',
    allIssued: (count: number): string => `${String(count)} dòng trong kỳ này đã được phát hành.`,
    truncated: 'Kỳ này còn nhiều phiếu hơn. Hãy tải phiếu chưa thấy bằng số phiếu.',
  },

  device: {
    terminalLabel: 'Máy trạm',
    terminalUnknown: 'Chưa xác nhận',
  },

  printer: {
    label: 'Máy in',
    empty: 'Chưa có máy in nào được đăng ký. Bản ghi phát hành vẫn lưu, chỉ không in.',
    loading: 'Đang kiểm tra trạng thái máy in.',
    failed: 'Không tải được trạng thái máy in.',
    noShell: 'Nơi mở màn hình này không có đường in. Chỉ lưu bản ghi phát hành, không in.',
  },

  lines: {
    sectionLabel: 'Dòng xuất kho',
    columnItem: 'Mặt hàng',
    columnLot: 'LOT',
    columnQty: 'Số lượng',
    columnStatus: 'Phát hành',
    selectAll: 'Chọn tất cả',
    pick: 'Chọn',
    picked: 'Đã chọn',
    showAll: 'Xem tất cả dòng của phiếu',
    showPickedOnly: 'Chỉ xem dòng đã chọn',
    clearSelection: 'Bỏ chọn',
    empty: 'Phiếu này không có dòng xuất kho.',
    loading: 'Đang tải dòng xuất kho.',
    failed: 'Không tải được dòng xuất kho.',
    statusNotIssued: 'Chưa phát hành',
    statusIssued: (count: number) => `Đã phát hành ${String(count)} lần`,
    statusUnknown: 'Không kiểm tra được tình trạng phát hành',
  },

  target: {
    sectionLabel: 'Đối tượng phát hành',
    unitLabel: 'Loại',
    unitLine: 'Theo dòng',
    unitPallet: 'Theo pallet',
    palletLabel: 'Đối tượng',
    palletPlaceholder: 'Hãy chọn pallet',
    palletNeedsOneLine: 'Chỉ chọn được pallet sau khi chọn đúng một dòng.',
    palletLoading: 'Đang tải pallet.',
    palletFailed: 'Không tải được pallet. Lát nữa hãy thử lại.',
    palletUnavailable: 'Máy chủ chưa hỗ trợ phát hành theo pallet. Hãy phát hành theo dòng.',
    palletEmpty: 'Không có pallet nào chứa LOT của dòng này. Hãy phát hành theo dòng.',
    palletContents: (lineCount: number, quantityText: string) =>
      `${String(lineCount)} dòng · ${quantityText}`,
    palletContentsUnknown: 'Đang kiểm tra hàng trên pallet.',
    palletTruncated: (shown: number, total: number) =>
      `Chỉ hiện ${String(shown)} trên ${String(total)} pallet. Nếu không thấy pallet cần tìm, hãy phát hành theo dòng.`,
    selectedCount: (count: number) => `${String(count)} dòng`,
    none: '—',
    seqLabel: 'Lượt',
    lineLabel: (lineNo: number): string => `Dòng ${String(lineNo)}`,
    seqUnknown: '—',
    previewLabel: 'Xem trước',
    previewEmpty: 'Hãy chọn dòng',
    previewFailed: 'Không tải được bản xem trước. Vẫn in được bình thường.',
    previewAlt: 'Xem trước QR xuất kho',
    destinationMissing:
      'Không đọc được vị trí đến nên đã để trống nơi đến trên nhãn. Vẫn có thể phát hành.',
  },

  reissue: {
    label: 'Lý do phát hành lại',
    placeholder: 'Hãy chọn lý do',
    required: 'Có dòng đã phát hành nên cần lý do phát hành lại.',
    unknownStatus:
      'Có dòng chưa kiểm tra được tình trạng phát hành. Nếu dòng đó đã phát hành thì phải chọn lý do mới phát hành được.',
    serverAsked: 'Máy chủ coi lần này là phát hành lại. Hãy chọn lý do rồi phát hành lại.',
    loading: 'Đang tải danh sách lý do.',
    failed: 'Không tải được danh sách lý do. Lát nữa hãy thử lại.',
    empty: 'Không có lý do phát hành lại nào để chọn.',
  },

  action: {
    issue: 'Phát hành · In',
  },

  result: {
    issued: (count: number) => `Đã phát hành ${String(count)} mục.`,
    printing: 'Đang gửi đến máy in.',
    printFailed: 'In thất bại. Bản ghi phát hành vẫn còn, hãy in lại bằng phát hành lại.',
    reportFailed:
      'In thất bại và cũng không lưu được kết quả lên máy chủ. Bản ghi phát hành vẫn còn.',
    printedUnreported:
      'Đã in xong nhưng không lưu được kết quả lên máy chủ. Hãy kiểm tra nhãn đã in, chỉ in lại khi cần.',
  },

  errors: {
    forbidden: 'Máy trạm này không phát hành được. Hãy thử lại ở máy trạm khác.',
  },

  alwaysIssueNote: 'Xuất kho toàn bộ cũng vẫn phát hành QR xuất kho.',
};
