import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-04 설비고장 상세처리. 사건 기록이라 되돌리는 길이 없다 —
 * 「무엇을 고칠 수 없는가」와 「누르면 되돌릴 수 없다」를 옮긴 말에서도 지킨다.
 */
export const equipmentFailure: Translated<typeof ko.equipmentFailure> = {
  title: 'Xử lý chi tiết sự cố thiết bị',
  breadcrumbRoot: 'Thiết bị / Công cụ',

  panes: {
    filters: 'Điều kiện tra cứu',
    list: 'Danh sách sự cố',
    detail: 'Xử lý chi tiết',
  },

  filters: {
    equipment: 'Thiết bị',
    status: 'Trạng thái',
    period: 'Khoảng thời gian báo',
    openOnly: 'Chỉ mục chưa xử lý',
    withoutOrder: 'Chỉ mục chưa có lệnh bảo trì',
    all: 'Tất cả',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    periodInvalid: 'Ngày không có trên lịch. Hãy chọn lại ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Ngày kết thúc trước ngày bắt đầu. Hãy đổi chỗ hai ngày.',
    equipmentLookupFailed:
      'Không tải được danh sách thiết bị nên hiện chưa chọn được. Hãy thử lại.',
    equipmentLookupTruncated:
      'Chỉ hiển thị một phần danh sách thiết bị. Không thấy thiết bị cần tìm thì hãy hỏi người phụ trách.',
    defaultNote:
      'Mặc định là toàn bộ mục chưa xử lý, sắp theo số ngày trôi qua từ dài đến ngắn — xem cái tồn đọng trước.',
  },

  table: {
    breakdownNo: 'Số sự cố',
    equipment: 'Thiết bị',
    symptom: 'Hiện tượng',
    occurrenceState: 'Tình trạng khi xảy ra',
    reportedAt: 'Thời điểm báo',
    status: 'Trạng thái',
    reporter: 'Người báo',
    notAvailable: '—',
    emptyTitle: 'Không có sự cố',
    empty: 'Không có sự cố nào khớp điều kiện. Hãy bớt điều kiện hoặc mở rộng khoảng thời gian.',
    beyondLastTitle: 'Trang này không có sự cố',
    beyondLast: 'Có sự cố khớp điều kiện nhưng không nằm ở trang này. Hãy về trang đầu.',
    firstPage: 'Về trang đầu',
    open: 'Mở',
  },

  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
    prev: 'Trước',
    next: 'Sau',
  },

  detail: {
    emptyTitle: 'Hãy chọn sự cố',
    empty: 'Chọn một mục trong danh sách sự cố thì chi tiết sẽ mở ở đây.',

    reportHeading: 'Nội dung hiện trường đã ghi',
    /** 「처리 내역」은 diễn giải xử lý, 「처리 내용」은 nội dung xử lý 로 갈라 둔다. */
    reportReadOnly:
      'Hiện tượng · tình trạng khi xảy ra · giờ dừng · ảnh là do hiện trường ghi nên không sửa được ở đây. Có gì cần đính chính thì ghi thêm vào diễn giải xử lý.',
    symptom: 'Hiện tượng',
    occurrenceState: 'Tình trạng khi xảy ra',
    stoppedAt: 'Giờ dừng',
    stoppedAtUnknown: 'Không rõ — hiện trường không ghi',
    reportedAt: 'Thời điểm báo',
    reporter: 'Người báo',
    photos: 'Ảnh',
    photoCount: (count: number): string => `${String(count)} ảnh`,
    photosNotViewable: 'Chưa có đường mở ảnh nên chỉ hiển thị số lượng.',
    noPhotos: 'Không có ảnh.',

    downtimeHeading: 'Dừng máy đã liên kết',
    downtimeCountLabel: 'Số mục',
    downtimeMinutesLabel: 'Tổng thời gian',
    downtimeCount: (count: number): string => `${String(count)} mục`,
    downtimeMinutes: (minutes: number): string => `${String(minutes)} phút`,
    downtimeMinutesUnknown: 'Không tính được tổng — có khoảng chưa kết thúc.',
    openDowntimeWarning: (count: number): string =>
      `Còn ${String(count)} mục dừng máy chưa kết thúc. Hoàn thành sự cố cũng không đóng dừng máy — phải kết thúc riêng trên máy quét ở hiện trường.`,

    handlingHeading: 'Nội dung xử lý',
    causeCode: 'Mã nguyên nhân',
    handlingNote: 'Diễn giải xử lý',
    maintenanceOrder: 'Lệnh bảo trì đã liên kết',
    noMaintenanceOrder:
      'Không có lệnh bảo trì liên kết. Việc phát hành làm ở màn hình Phát hành lệnh bảo trì.',
    handledAt: 'Thời điểm xử lý',
    save: 'Lưu nội dung xử lý',
    saved: 'Đã lưu nội dung xử lý.',
  },

  status: {
    received: 'Đã tiếp nhận',
    handling: 'Đang xử lý',
    done: 'Hoàn thành',
  },

  occurrence: {
    stopped: 'Đã dừng',
    abnormal: 'Vẫn chạy nhưng bất thường',
  },

  actions: {
    startHandling: 'Chuyển sang đang xử lý',
    complete: 'Hoàn thành',
    startHandlingConfirmTitle: 'Chuyển sự cố này sang đang xử lý?',
    startHandlingConfirm:
      'Chuyển sang đang xử lý rồi thì không quay lại trạng thái đã tiếp nhận được. Đây là bản ghi sự việc nên không có đường lùi trạng thái.',
    completeConfirmTitle: 'Hoàn thành sự cố này?',
    completeConfirm:
      'Hoàn thành thì mục này bị khóa và không lùi được. Nếu sai thì phải đăng ký thành một sự cố mới.',
    confirm: 'Tiến hành',
    cancel: 'Hủy',

    startHandlingLocked: 'Chỉ chuyển sang đang xử lý được khi ở trạng thái đã tiếp nhận.',
    completeLockedDone: 'Sự cố này đã hoàn thành.',
    completeLockedCause: 'Muốn hoàn thành thì hãy chọn mã nguyên nhân.',
    completeLockedNote: 'Muốn hoàn thành thì hãy ghi diễn giải xử lý.',
    completeLockedNoCauseCodes:
      'Danh sách mã nguyên nhân chưa được đăng ký nên không hoàn thành được. Đăng ký giá trị xong thì sẽ mở.',
    saveLockedDone: 'Sự cố đã hoàn thành thì không sửa được nội dung xử lý.',
  },

  codes: {
    causeEmpty: 'Danh sách mã nguyên nhân chưa được đăng ký. Đăng ký giá trị xong thì chọn được.',
    provisional:
      'Danh sách giá trị chưa được chốt nên chỉ hiển thị một phần. Giá trị không có thì hãy hỏi người phụ trách.',
    selectPlaceholder: 'Hãy chọn',
  },
};
