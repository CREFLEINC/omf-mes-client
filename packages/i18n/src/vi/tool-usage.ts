import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-05-01 툴 사용실적·타발수 입력. 「툴」은 `công cụ`, 금형 QR·캐비티 자리만 `khuôn`. */
export const toolUsage: Translated<typeof ko.toolUsage> = {
  title: 'Nhập kết quả sử dụng công cụ',

  band: {
    title: 'Lệnh sản xuất (W/O)',
    process: 'Công đoạn',
    item: 'Sản phẩm',
    planQty: 'SL kế hoạch',
  },

  pad: {
    title: 'Nhập',
    unit: (uom: string) => `Đơn vị ${uom}`,
  },

  scan: {
    sectionLabel: 'Quét công cụ',
    inputLabel: 'QR khuôn',
    placeholder: 'Quét QR khuôn',
    cavity: 'Khoang khuôn',
    mold: 'Khuôn',
    moldName: 'Tên khuôn',
    empty: 'Quét QR khuôn',
    nextHint: 'Lần ghi kế tiếp hãy quét QR khuôn trước.',
    notFound: 'Không có công cụ mã này. Hãy kiểm tra lại mã.',
    disposed: 'Công cụ đã thanh lý. Hãy quét công cụ khác.',
  },

  shot: {
    sectionLabel: 'Nhập số nhát dập',
    inputLabel: 'Số nhát dập',
    unit: 'nhát',
    convertedLabel: 'Tính số nhát dập từ số lượng sản xuất',
    baseQtyLabel: 'Số lượng',
    convertedExpression: (baseQty: string, ratio: string, shots: string) =>
      `SL ${baseQty} × ${ratio} = ${shots} nhát · làm tròn đến số nguyên gần nhất`,
    conversionUnavailable: 'Chưa thiết lập tỷ lệ quy đổi.',
    conversionLoading: 'Đang tải tỷ lệ quy đổi.',
    conversionOff: 'Phạm vi này được thiết lập không dùng quy đổi. Hãy nhập tay.',
  },

  cumulative: {
    sectionLabel: 'Lũy kế',
    guaranteed: 'Số nhát dập đảm bảo',
    current: 'Lũy kế hiện tại',
    increment: 'Lần nhập này',
    projected: 'Lũy kế dự kiến sau khi lưu',
    available: 'Còn dùng được',
    asOf: (time: string) => `Tính đến ${time}`,
    usageLabel: 'Tỷ lệ đã dùng so với số nhát dập đảm bảo',
    usageBarLabel: 'Đã dùng',
    guaranteedMissing: 'Chưa đăng ký số nhát dập đảm bảo — không tính được số nhát còn dùng được.',
    offlineBase: 'Chưa phản ánh phần nhập từ máy trạm khác sau thời điểm này.',
    offlineProjection: 'Xác nhận khi có kết nối',
    overSuffix: '(vượt)',
  },

  actions: {
    save: 'Lưu kết quả',
    confirm: 'Xác nhận',
    reset: 'Xóa nhập',
  },

  actionReasons: {
    saving: 'Đang lưu.',
    noShot: 'Hãy nhập số nhát dập từ 1 trở lên.',
    noEntry:
      'Cần có lệnh sản xuất và mã nhân viên mới lưu được. Hãy vào từ màn hình Danh sách lệnh sản xuất.',
    offline: 'Mất kết nối nên không lưu được. Khi có kết nối lại, hãy lưu lại.',
  },

  save: {
    successTitle: 'Đã lưu kết quả.',
    failTitle: 'Không lưu được kết quả',
    rejected:
      'Không lưu được do giá trị gửi đi hoặc quy tắc nghiệp vụ. Hãy kiểm tra giá trị rồi lưu lại.',
    forbidden: 'Máy trạm này không nhập được kết quả sử dụng công cụ. Hãy liên hệ người phụ trách.',
  },
};
