import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-04-01 Lấy hàng thành phẩm — quét LOT là lấy nguyên LOT, không hỏi số lượng (tính năng 010). */
export const productPicking: Translated<typeof ko.productPicking> = {
  title: 'Lấy hàng thành phẩm',
  offline: {
    title: 'Đang ngoại tuyến nên không lấy hàng được',
    description: 'Không xác nhận được trạng thái LOT và kết quả kiểm tra',
    retry: 'Thử lại',
  },
  requests: {
    legend: 'Phiếu xuất hàng hôm nay',
    loading: 'Đang tải phiếu xuất hàng hôm nay',
    loadFailed: 'Không xác nhận được phiếu xuất hàng hôm nay',
    dropped: 'Phiếu đang chọn đã rời khỏi danh sách phiếu xuất hàng hôm nay',
    none: 'Hôm nay không có phiếu xuất hàng nào cần lấy hàng',
    completedHidden: 'Phiếu đã hoàn tất xuất hàng sẽ không hiện trong danh sách',
    noSalesOrder: 'Không có đơn hàng',
    salesOrder: (salesOrderNo: string) => `Đơn hàng ${salesOrderNo}`,
    shipDate: (date: string) => `Dự kiến xuất ${date}`,
    lineSummary: (lineNo: number, item: string, picked: string, target: string) =>
      `${String(lineNo)}. ${item} đã lấy ${picked} / mục tiêu ${target}`,
    pickingLots: (count: number) => `Đang lấy hàng, ${String(count)} LOT`,
    notStarted: 'Chưa lấy hàng',
  },
  request: {
    customer: 'Khách hàng',
    shipTo: 'Nơi giao',
    salesOrder: 'Đơn hàng',
    shipDate: 'Dự kiến xuất',
    change: 'Chọn phiếu khác',
    showCode: 'Xem mã phiếu xuất hàng',
  },
  line: {
    title: (lineNo: number, itemCode: string) => `Dòng ${String(lineNo)}, ${itemCode}`,
    inspection: 'Thuộc diện kiểm tra xuất hàng',
    noInspection: 'Không kiểm tra xuất hàng',
    reached: 'Đã đủ mục tiêu',
    target: 'Mục tiêu',
    picked: 'Đã lấy',
    remaining: 'Còn lại',
    over: 'Vượt',
    noLots: 'Chưa lấy LOT nào. Hãy quét nhãn LOT',
    itemFailed: 'Không xác nhận được mặt hàng',
    customerRequirement: 'Yêu cầu của khách hàng về LOT',
    minimumShelfLife: (days: number) => `Yêu cầu hạn dùng còn lại từ ${String(days)} ngày trở lên`,
  },
  lot: {
    qty: (qty: string, uom: string) => `${qty} ${uom}`,
    portion: (warehouse: string, location: string | null) =>
      location === null ? warehouse : `${warehouse}, ${location}`,
    staging: 'Chờ xếp kệ',
    oqcResult: (round: number, at: string) => `Kết quả OQC ${String(round)}, ${at}`,
    replace: 'Thay thế',
    replaced: 'Đã thay thế',
    replacedDetail: (nonconformanceNo: string | null, worker: string, at: string) =>
      nonconformanceNo === null
        ? `Lỗi, ${worker} ${at}`
        : `Lỗi, phiếu không phù hợp ${nonconformanceNo}, ${worker} ${at}`,
  },
  oqc: {
    NOT_INSPECTED: 'Chưa kiểm tra',
    ACCEPTED: 'Đạt',
    REJECTED: 'Không đạt',
    HELD: 'Tạm giữ',
    NOT_REQUIRED: 'Không cần kiểm tra',
    SKIPPED: 'Bỏ qua kiểm tra',
  },
  scan: {
    label: 'Quét LOT thành phẩm',
    hint: 'Quét nhãn LOT là lấy hàng ngay',
    placeholder: 'Hãy quét mã QR của LOT thành phẩm',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Lấy hàng',
    paused: 'Đang nhập mã, tạm dừng quét LOT',
    pending: (lotNo: string) => `Đang lấy ${lotNo}`,
  },
  picked: {
    title: (lotNo: string, qty: string, uom: string) => `Đã lấy ${lotNo} ${qty} ${uom}`,
    reached: (lineNo: number, target: string) => `Dòng ${String(lineNo)} đã đủ mục tiêu ${target}`,
    reachedOver: (lineNo: number, target: string, over: string) =>
      `Dòng ${String(lineNo)} đã đủ mục tiêu ${target}, vượt ${over}`,
    remaining: (lineNo: number, left: string) => `Dòng ${String(lineNo)} còn lại ${left}`,
  },
  rejected: {
    notPicked: 'Chưa ghi nhận lấy hàng',
    LOT_TARGET_REACHED: 'Đã đạt số lượng mục tiêu',
    targetReachedDetail: (lineNo: number, target: string, picked: string) =>
      `Dòng ${String(lineNo)}: mục tiêu ${target}, đã lấy ${picked}. Không nhận thêm LOT`,
    LOT_ALREADY_RESERVED: 'LOT đang được giữ cho công việc khác',
    reservedDetail:
      'Có phần đã được đặt trước cho phiếu xuất hàng hoặc lệnh xuất kho khác nên không lấy nguyên LOT được',
    LOT_ALREADY_PICKED: 'LOT này đã được lấy cho phiếu này',
    NO_LINE_FOR_ITEM: 'Phiếu này không có dòng cho mặt hàng này',
    notFound: 'Không phải LOT của nhà máy này',
    notFoundDetail: 'Hãy kiểm tra số và quét lại',
    failed: 'Không ghi nhận được việc lấy hàng',
    failedDetail: 'Hãy kiểm tra kết nối rồi quét lại cùng LOT đó. Sẽ không bị ghi hai lần',
    retry: 'Thử lại',
  },
  replace: {
    confirmTitle: (lotNo: string) => `Thay thế ${lotNo}?`,
    effectPicked: (qty: string, uom: string, lineNo: number, before: string, after: string) =>
      `Bớt ${qty} ${uom} khỏi phần đã lấy (dòng ${String(lineNo)}: ${before} → ${after})`,
    effectDefect: 'LOT chuyển sang trạng thái lỗi và phát sinh 1 phiếu không phù hợp',
    effectReceive: (lineNo: number, qty: string, uom: string) =>
      `Dòng ${String(lineNo)} sẽ nhận lại ${qty} ${uom}`,
    irreversible: 'Không thể hoàn tác',
    cancel: 'Hủy',
    proceed: 'Thay thế',
    rejectedNotice: 'Có LOT không đạt. Hãy thay thế',
    done: (lotNo: string) => `Đã thay thế ${lotNo}`,
    nonconformance: (no: string) => `Đã phát sinh phiếu không phù hợp ${no}`,
    receiveMore: (lineNo: number, qty: string, uom: string) =>
      `Dòng ${String(lineNo)} nhận thêm ${qty} ${uom}. Hãy quét LOT khác`,
    notRejected: 'Chưa thay thế',
    notRejectedDetail:
      'Trước khi thay thế đã có kết quả kiểm tra lại đạt cho LOT này nên không cần thay thế. LOT vẫn ở trạng thái đã lấy',
    failed: 'Không thay thế được. Hãy kiểm tra kết nối rồi bấm lại',
  },
  code: {
    label: 'Mã quản lý xuất hàng (không bắt buộc)',
    labelLimit: 'Mã quản lý xuất hàng (không bắt buộc), tối đa 100 ký tự',
    empty: 'Quét hoặc nhập',
    waiting: 'Hãy quét mã',
    waitingHint: 'Chạm vào ô này thì lần quét tiếp theo sẽ là mã của LOT này',
    edit: (lotNo: string) => `Sửa mã quản lý xuất hàng của ${lotNo}`,
    keyboard: (lotNo: string) => `Nhập tay mã quản lý xuất hàng của ${lotNo}`,
    stopWaiting: 'Dừng quét mã',
    noCheck: 'Không kiểm tra trùng lặp và định dạng',
    count: (length: number) => `${String(length)}/100`,
    tooLong: 'Chỉ nhập được tối đa 100 ký tự',
    cancel: 'Hủy',
    save: 'Lưu',
    failed: 'Không lưu được mã. Hãy quét hoặc nhập lại',
  },
  qr: {
    title: 'Mã phiếu xuất hàng',
    label: (no: string) => `QR phiếu xuất hàng ${no}`,
    guide: 'Hãy đưa vào máy quét ở màn hình POP 「Hoàn tất xuất hàng」',
    guideDetail: 'Chỉ hoàn tất xuất hàng trên POP',
    blockedTitle: 'Chưa thể hoàn tất',
    close: 'Đóng',
  },
  blocker: {
    PICKING_SHORT: (lineNo: number) => `Dòng ${String(lineNo)} lấy hàng chưa đủ số lượng mục tiêu`,
    NOT_INSPECTED: (lotNo: string) => `LOT chưa kiểm tra ${lotNo}`,
    REJECTED: (lotNo: string) => `LOT không đạt ${lotNo}`,
    HELD: (lotNo: string) => `LOT tạm giữ ${lotNo}`,
    SALES_ORDER_LINE_CANCELLED: (lineNo: number) =>
      `Dòng đơn hàng của dòng ${String(lineNo)} đã bị hủy. Hãy liên hệ người phụ trách`,
    ALREADY_COMPLETED: 'Phiếu này đã hoàn tất xuất hàng',
  },
};
