import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-10 계측기 검교정 이력 등록. 이력은 고칠 수 없으니, 옮긴 말도
 * 「저장하면 끝이다」와 「잘못 적었으면 새 이력을 덧붙인다」를 함께 말한다.
 */
export const gaugeCalibration: Translated<typeof ko.gaugeCalibration> = {
  title: 'Lịch sử hiệu chuẩn thiết bị đo',
  breadcrumbRoot: 'Thiết bị / Công cụ',

  panes: {
    filters: 'Điều kiện tra cứu',
    list: 'Danh sách lịch sử',
    form: 'Đăng ký lịch sử',
  },

  filters: {
    equipment: 'Thiết bị đo',
    historyType: 'Loại lịch sử',
    period: 'Khoảng thời gian thực hiện',
    all: 'Tất cả',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    periodInvalid: 'Ngày không có trên lịch. Hãy chọn lại ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Ngày kết thúc trước ngày bắt đầu. Hãy đổi chỗ hai ngày.',
    equipmentLookupFailed:
      'Không tải được danh sách thiết bị đo nên hiện chưa chọn được. Hãy thử lại.',
    equipmentLookupTruncated:
      'Chỉ hiển thị một phần danh sách thiết bị đo. Không thấy thiết bị đo cần tìm thì hãy hỏi người phụ trách.',
  },

  table: {
    performedOn: 'Ngày thực hiện',
    historyType: 'Loại',
    result: 'Kết quả',
    equipment: 'Thiết bị đo',
    nextDueOn: 'Hạn kế tiếp',
    certificateNo: 'Số giấy chứng nhận',
    agency: 'Tổ chức hiệu chuẩn',
    performer: 'Người thực hiện',
    tolerance: 'Ghi chú sai số cho phép',
    remarks: 'Ghi chú',
    notAvailable: '—',
    emptyTitle: 'Không có lịch sử',
    empty: 'Không có lịch sử nào khớp điều kiện. Hãy bớt điều kiện hoặc mở rộng khoảng thời gian.',
    beyondLastTitle: 'Trang này không có lịch sử',
    beyondLast: 'Có lịch sử khớp điều kiện nhưng không nằm ở trang này. Hãy về trang đầu.',
    firstPage: 'Về trang đầu',
  },

  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
    prev: 'Trước',
    next: 'Sau',
  },

  form: {
    equipment: 'Thiết bị đo',
    historyType: 'Loại lịch sử',
    performedOn: 'Ngày thực hiện',
    result: 'Kết quả',
    certificateNo: 'Số giấy chứng nhận',
    agencyType: 'Phân loại tổ chức hiệu chuẩn',
    agencyName: 'Tên tổ chức hiệu chuẩn',
    nextDueOn: 'Hạn hiệu lực (ngày hiệu chuẩn kế tiếp dự kiến)',
    tolerance: 'Ghi chú sai số cho phép',
    remarks: 'Ghi chú',
    blocksUse: 'Chặn sử dụng bằng lịch sử này',
    blocksUseNote: 'Bật thì cho tới khi được gỡ, thiết bị đo này bị đánh giá là không dùng được.',
    selectPlaceholder: 'Hãy chọn',
    submit: 'Đăng ký lịch sử',
    reset: 'Xóa nội dung nhập',

    immutableLead:
      'Lưu rồi thì lịch sử này không sửa hay xóa được. Ghi sai thì thêm một lịch sử mới để đính chính.',
    masterEffect:
      'Nếu là loại hiệu chuẩn và kết quả Đạt thì ngày hiệu chuẩn gần nhất và ngày dự kiến kế tiếp của thiết bị đo cũng được cập nhật.',
    calibrationOnly: 'Chỉ ghi cho lịch sử hiệu chuẩn.',
    nextDueManual:
      'Màn hình không biết độ dài chu kỳ hiệu chuẩn nên không đề xuất được ngày dự kiến. Hãy tự chọn ngày ghi trên giấy chứng nhận.',

    requiredEquipment: 'Hãy chọn thiết bị đo.',
    requiredHistoryType: 'Hãy chọn loại lịch sử.',
    requiredPerformedOn: 'Hãy chọn ngày thực hiện.',
    requiredResult: 'Hãy chọn kết quả.',
    invalidPerformedOn: 'Ngày không có trên lịch. Hãy chọn lại ngày thực hiện.',
    invalidNextDueOn: 'Ngày không có trên lịch. Hãy chọn lại hạn hiệu lực.',
    nextDueBeforePerformed: 'Hạn hiệu lực trước ngày thực hiện. Hãy chọn lại hai ngày.',
  },

  confirm: {
    title: 'Lưu lịch sử này?',
    lead: 'Lưu rồi thì không sửa hay xóa được. Hãy kiểm tra nội dung bên dưới có đúng không.',
    submit: 'Lưu',
    cancel: 'Hủy',
    masterEffect:
      'Lịch sử này cập nhật ngày hiệu chuẩn gần nhất và ngày dự kiến kế tiếp của thiết bị đo.',
    noMasterEffect: 'Lịch sử này không cập nhật ngày hiệu chuẩn của thiết bị đo.',
    /** 요약 한 줄에 끼는 조각이라 짧게 둔다 — 「Hiệu chuẩn · 2026-08-11 · Đạt · Hiệu lực ~2027-08-10」. */
    validUntil: (date: string): string => `Hiệu lực ~${date}`,
  },

  codes: {
    provisional:
      'Danh sách giá trị chưa được chốt nên chỉ hiển thị một phần. Giá trị không có thì hãy hỏi người phụ trách.',
    empty: (name: string): string =>
      `Chưa có danh sách giá trị ${name} nên không chọn được. Đăng ký giá trị xong thì sẽ mở.`,
    resultBlocked:
      'Không có danh sách giá trị kết quả nên không lưu được lịch sử. Đăng ký giá trị xong thì sẽ mở.',

    /** 계약이 이름을 못 박은 값만 담는다 — 나머지는 공통코드가 정할 때까지 이름이 없다. */
    historyType: {
      calibration: 'Hiệu chuẩn',
      check: 'Kiểm tra định kỳ',
    },
    result: {
      pass: 'Đạt',
      fail: 'Không đạt',
    },
  },

  save: {
    success: 'Đã lưu lịch sử.',
  },
};
