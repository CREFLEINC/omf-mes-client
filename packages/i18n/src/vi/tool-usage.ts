import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-05-01 툴 사용실적·타발수 입력. 「툴」은 `công cụ`, 금형 QR·캐비티 자리만 `khuôn`. */
export const toolUsage: Translated<typeof ko.toolUsage> = {
  title: 'Nhập kết quả sử dụng công cụ',

  entry: {
    workOrderLabel: 'W/O',
    /* ⭐ 「설비 <이름>」으로 읽힌다 — 이름이 비면 코드(사용자 지시 2026-09-14). */
    equipmentLabel: (code: string, name: string): string =>
      `Thiết bị ${name.trim() === '' ? code : name}`,
    workerLabel: 'Mã nhân viên',
  },

  scan: {
    sectionLabel: 'Quét công cụ',
    inputLabel: 'QR khuôn',
    placeholder: 'Hãy quét QR khuôn',
    manualEntry: 'Nhập tay',
    manualHint: 'Nhập mã khuôn rồi bấm Enter.',
    cavity: 'Khoang khuôn',
    notFound: 'Không có công cụ với mã này. Hãy kiểm tra lại mã.',
    disposed: 'Công cụ đã thanh lý. Hãy quét công cụ khác.',
  },

  shot: {
    sectionLabel: 'Nhập số nhát dập',
    inputLabel: 'Số nhát dập',
    unit: 'nhát',
    keypadLabel: 'Bàn phím số nhập số nhát dập',
    clearGlyph: 'Xóa',
    backspace: 'Xóa một ký tự',
    decimalKey: 'Dấu thập phân',
    convertedLabel: 'Quy đổi từ số lượng sản xuất',
    baseQtyLabel: 'Số lượng',
    convertedExpression: (baseQty: string, ratio: string, shots: string) =>
      `Số lượng ${baseQty} × ${ratio} = ${shots} nhát`,
    roundedNote: 'Kết quả quy đổi được làm tròn đến số nguyên gần nhất rồi gửi.',
    conversionUnavailable: 'Chưa thiết lập tỷ lệ quy đổi.',
    conversionLoading: 'Đang tải tỷ lệ quy đổi.',
    conversionOff: 'Phạm vi này được thiết lập không dùng quy đổi. Hãy nhập tay.',
  },

  cumulative: {
    sectionLabel: 'Lũy kế',
    guaranteed: 'Số nhát dập đảm bảo',
    current: 'Lũy kế (máy chủ)',
    increment: 'Lần nhập này',
    projected: 'Lũy kế sau khi lưu',
    available: 'Còn dùng được',
    asOf: (time: string) => `Tính đến ${time}`,
    usageLabel: 'Tỷ lệ đã dùng so với số nhát dập đảm bảo',
    usageBarLabel: 'Đã dùng',
    guaranteedMissing: 'Chưa đăng ký số nhát dập đảm bảo — không tính được số nhát còn dùng được.',
    offlineBase: 'Chưa phản ánh phần nhập từ máy trạm khác sau thời điểm này.',
    offlineProjection: 'Xác nhận khi có kết nối',
    overSuffix: '(vượt)',
  },

  notice: {
    sectionLabel: 'Hướng dẫn',
    serverAdds: ['Lũy kế do máy chủ tính khi lưu.'],
  },

  actions: {
    save: 'Lưu kết quả',
    confirm: 'Xác nhận',
    reset: 'Nhập lại',
  },

  actionReasons: {
    saving: 'Đang lưu.',
    noShot: 'Hãy nhập số nhát dập từ 1 trở lên.',
    noEntry:
      'Cần có lệnh sản xuất và mã nhân viên mới lưu được. Hãy vào từ màn hình Bắt đầu sản xuất.',
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
