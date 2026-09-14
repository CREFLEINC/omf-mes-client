import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-01-02 출고 QR 발행. */
export const goodsIssueQr: Translated<typeof ko.goodsIssueQr> = {
  title: 'Phát hành QR xuất kho',

  entry: {
    issueLabel: 'Phiếu xuất kho',
    workerLabel: 'Mã nhân viên',
    missingIssue: 'Hãy chọn phiếu xuất kho rồi vào màn hình này.',
    missingWorker:
      'Chưa xác nhận mã nhân viên nên không phát hành được. Hãy xác nhận mã nhân viên trước.',
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
    seqUnknown: '—',
    previewLabel: 'Xem trước',
    previewEmpty: 'Xem trước được khi phát hành.',
    previewFailed: 'Không tải được bản xem trước. Vẫn in được bình thường.',
    previewAlt: 'Xem trước QR xuất kho',
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
    disabledNoSelection: 'Hãy chọn dòng cần phát hành trước.',
    disabledPalletNeedsOneLine: 'Muốn phát hành theo pallet thì chỉ chọn một dòng.',
    disabledNoPallet: 'Hãy chọn pallet cần phát hành.',
    disabledPalletUnsupported: 'Hãy phát hành theo dòng.',
    disabledPalletContentsPending: 'Đang kiểm tra hàng trên pallet. Lát nữa mới phát hành được.',
    disabledEmptyPallet: 'Pallet đã chọn không có hàng. Hãy chọn pallet khác.',
    disabledNoReason: 'Hãy chọn lý do phát hành lại.',
    disabledNoWorker: 'Chưa xác nhận mã nhân viên.',
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
