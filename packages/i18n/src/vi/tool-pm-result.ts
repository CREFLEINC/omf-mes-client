import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-03 툴 PM 실적 등록. 누계 리셋은 서버가 하고 화면은 뜻과 시작값만 보낸다 - 「되돌리기」는
 * `đặt lại` 로 옮기되, 더하기(사용실적)와 바꾸기(되돌리기)가 다른 축이라는 말을 지우지 않는다.
 */
export const toolPmResult: Translated<typeof ko.toolPmResult> = {
  title: 'Đăng ký kết quả PM công cụ',
  breadcrumbRoot: 'Thiết bị / Công cụ',

  panes: {
    tool: 'Công cụ đối tượng',
    form: 'Đăng ký kết quả',
    list: 'Danh sách kết quả',
  },

  tool: {
    select: 'Công cụ',
    selectPlaceholder: 'Hãy chọn công cụ',
    lookupFailed: 'Không tải được danh sách công cụ nên hiện chưa chọn được. Hãy thử lại.',
    lookupTruncated:
      'Chỉ hiển thị một phần danh sách. Không thấy công cụ cần tìm thì hãy hỏi người phụ trách.',
    currentShot: 'Số nhát dập lũy kế',
    guaranteed: 'Số nhát dập đảm bảo',
    notComputable: 'Không tính được',
    loadingLock: 'Đang tải thông tin công cụ. Hãy lưu sau giây lát.',
    lockFailed:
      'Không tải được thông tin công cụ nên chưa lưu được việc đặt lại lũy kế. Hãy thử lại.',
  },

  form: {
    order: 'Lệnh bảo trì',
    orderNone: 'Xử lý không có lệnh',
    orderNote: 'Không có lệnh vẫn ghi được — có việc hiện trường đã xử lý sẵn.',
    startedAt: 'Ngày bắt đầu',
    finishedAt: 'Ngày kết thúc',
    finishedAtNote: 'Chưa xong thì hãy để trống.',
    resultNote: 'Nội dung kết quả',
    performer: 'Người thực hiện',
    outsourced: 'Bảo trì thuê ngoài',
    vendorName: 'Nhà thầu ngoài',
    vendorNote: 'Không chọn từ dữ liệu gốc đối tác mà nhập tay.',

    resetCounter: 'Đặt lại số nhát dập lũy kế',
    resetNote:
      'Bật đặt lại thì máy chủ đổi lũy kế thành giá trị bắt đầu bên dưới. Màn hình không sửa trực tiếp dữ liệu gốc công cụ.',
    resetLockNote:
      'Đặt lại là thay thế chứ không phải cộng thêm, nên nếu lũy kế đổi trong lúc lưu thì việc lưu bị từ chối. Nhập kết quả sử dụng không có bảo vệ này — vì nhiều máy quét cùng cộng thêm.',
    shotAfterReset: 'Giá trị bắt đầu sau khi đặt lại',
    shotAfterResetNote: 'Thường là 0. Nếu đại tu thì có thể khác.',
    beforeResetNote:
      'Lũy kế ngay trước khi đặt lại do máy chủ giữ lại. «Đã dùng bao nhiêu tới lần bảo trì phòng ngừa này» là dữ liệu để phân tích tuổi thọ.',

    closed: 'Đóng lệnh',
    closedNoOrder: 'Phải chọn lệnh mới đóng được.',

    parts: 'Bộ phận bảo trì',
    partsLocked:
      'Danh sách giá trị của kết quả theo bộ phận chưa được đăng ký nên chưa ghi được bộ phận. Đăng ký giá trị xong sẽ mở.',
    partsMechanism: 'Bộ phận không lưu riêng mà lưu cùng kết quả trong một lần.',

    submit: 'Lưu kết quả',
    reset: 'Xóa nội dung nhập',
    saving: 'Đang lưu.',
    saved: 'Đã đăng ký kết quả. Hãy xem ở danh sách bên dưới.',
    savedWithReset:
      'Đã đăng ký kết quả và đặt lại số nhát dập lũy kế. Hãy xem ở lũy kế phía trên và danh sách bên dưới.',
    requiredTool: 'Hãy chọn công cụ.',
    requiredStartedAt: 'Hãy chọn ngày bắt đầu.',
    requiredResultNote: 'Hãy ghi nội dung kết quả.',
    requiredPerformer: 'Hãy chọn người thực hiện.',
    requiredVendor: 'Hãy ghi nhà thầu ngoài.',
    outsourcedPerformer:
      'Bảo trì thuê ngoài thì để trống người thực hiện. Hãy ghi nhà thầu và người phụ trách vào nội dung kết quả.',
    invalidFinishedAt: 'Ngày kết thúc sớm hơn ngày bắt đầu. Hãy chọn lại hai ngày.',
    invalidDate: 'Ngày không có trên lịch. Hãy chọn lại ngày.',
    requiredShotAfterReset: 'Hãy ghi giá trị bắt đầu sau khi đặt lại. 0 cũng là một giá trị.',
    invalidShotAfterReset: 'Giá trị bắt đầu sau khi đặt lại phải là số từ 0 trở lên.',
    userLookupFailed: 'Không tải được danh sách người dùng nên hiện chưa chọn được. Hãy thử lại.',
    selectPlaceholder: 'Hãy chọn',
  },

  table: {
    startedAt: 'Bắt đầu',
    finishedAt: 'Kết thúc',
    resultNote: 'Nội dung kết quả',
    reset: 'Đã đặt lại',
    shotBefore: 'Lũy kế ngay trước khi đặt lại',
    shotAfter: 'Giá trị bắt đầu',
    closed: 'Đóng',
    notAvailable: '—',
    ongoing: 'Đang diễn ra',
    emptyTitle: 'Không có kết quả',
    empty: 'Công cụ này chưa có kết quả nào được đăng ký.',
    selectToolTitle: 'Hãy chọn công cụ',
    selectTool: 'Chọn công cụ ở trên thì sẽ thấy kết quả của công cụ đó.',
  },

  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
    prev: 'Trước',
    next: 'Sau',
  },

  confirm: {
    title: 'Đặt lại lũy kế?',
    lead: 'Đặt lại thì số nhát dập lũy kế sẽ đổi. Giá trị trước khi đặt lại do máy chủ giữ lại.',
    summary: (before: string, after: string): string => `${before} → ${after}`,
    submit: 'Lưu',
    cancel: 'Hủy',
  },
};
