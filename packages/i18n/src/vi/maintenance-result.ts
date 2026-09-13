import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-06 보전 실적·예비품 출고. 이 화면이 「하지 않는 일」(출고 생성·재고 차감·상태 변경)을
 * 원문이 먼저 말한다 - 옮긴 말에서도 그 부정을 흐리지 않는다.
 */
export const maintenanceResult: Translated<typeof ko.maintenanceResult> = {
  title: 'Kết quả bảo trì · phụ tùng',
  breadcrumbRoot: 'Thiết bị / Công cụ',

  panes: {
    filters: 'Điều kiện tra cứu',
    list: 'Danh sách kết quả',
    form: 'Đăng ký kết quả',
  },

  filters: {
    order: 'Lệnh bảo trì',
    period: 'Kỳ bắt đầu',
    all: 'Tất cả',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    periodInvalid: 'Ngày không có trên lịch. Hãy chọn lại ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Ngày kết thúc trước ngày bắt đầu. Hãy đổi chỗ hai ngày.',
  },

  table: {
    startedAt: 'Bắt đầu',
    finishedAt: 'Kết thúc',
    target: 'Đối tượng',
    order: 'Lệnh',
    performer: 'Thực hiện',
    closed: 'Đóng',
    parts: 'Phụ tùng',
    notAvailable: '—',
    ongoing: 'Đang diễn ra',
    partCount: (count: number): string => `${String(count)} mục`,
    emptyTitle: 'Không có kết quả',
    empty: 'Không có kết quả nào khớp điều kiện. Hãy bớt điều kiện hoặc mở rộng kỳ.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLast: 'Có kết quả khớp điều kiện nhưng không nằm ở trang này. Hãy về trang đầu.',
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
    scopeLead:
      'Màn hình này là nơi ghi lại đã bảo trì thế nào. Không tạo phiếu xuất kho phụ tùng, không trừ tồn kho và cũng không đổi trạng thái thiết bị.',
    target: 'Thiết bị đối tượng',
    order: 'Lệnh bảo trì',
    orderNone: 'Xử lý không có lệnh',
    orderNote: 'Không có lệnh vẫn ghi được — có việc hiện trường đã xử lý sẵn.',
    startedAt: 'Thời điểm bắt đầu',
    finishedAt: 'Thời điểm kết thúc',
    finishedAtNote: 'Chưa xong thì hãy để trống.',
    resultNote: 'Nội dung kết quả',
    performer: 'Người thực hiện',
    outsourced: 'Bảo trì thuê ngoài',
    vendorName: 'Nhà thầu ngoài',
    vendorNote:
      'Không chọn từ dữ liệu gốc đối tác mà nhập tay. Nhà thầu bảo trì có thể chưa được đăng ký là nhà cung cấp mua hàng.',
    closed: 'Đóng lệnh',
    closedNote: 'Đóng lệnh thì lệnh sẽ được đóng lại bằng kết quả này.',
    linesLocked:
      'Danh sách giá trị của kết quả theo hạng mục · bộ phận chưa được đăng ký nên chưa ghi được hạng mục. Đăng ký giá trị xong sẽ mở.',

    parts: 'Phụ tùng đã dùng',
    partsLead:
      'Chọn phiếu xuất kho do logistics tạo để liên kết. Ở đây không tạo phiếu xuất kho và cũng không trừ tồn kho.',
    partsNoLot: 'Phụ tùng không có số LOT. Chỉ ghi mã, tên và số lượng.',
    partsMasterNote:
      'Dữ liệu gốc phụ tùng chưa có quy cách · định mức tồn kho nên chỉ hiển thị mã và tên.',
    part: 'Phụ tùng',
    usedQty: 'Số lượng sử dụng',
    goodsIssue: 'Phiếu xuất kho liên kết',
    goodsIssueNone: 'Không liên kết',
    addPart: 'Thêm phụ tùng',
    removePart: 'Bỏ',

    submit: 'Lưu kết quả',
    reset: 'Xóa nội dung nhập',
    requiredTarget: 'Hãy chọn thiết bị đối tượng.',
    requiredStartedAt: 'Hãy chọn thời điểm bắt đầu.',
    requiredResultNote: 'Hãy ghi nội dung kết quả.',
    requiredPerformer: 'Hãy chọn người thực hiện.',
    requiredVendor: 'Hãy ghi nhà thầu ngoài.',
    outsourcedPerformer:
      'Bảo trì thuê ngoài thì để trống người thực hiện. Hãy ghi nhà thầu và người phụ trách vào nội dung kết quả.',
    invalidFinishedAt: 'Thời điểm kết thúc sớm hơn thời điểm bắt đầu. Hãy chọn lại hai thời điểm.',
    requiredPartQty: 'Số lượng sử dụng phải lớn hơn 0.',
    duplicatePart: 'Đã ghi cùng một phụ tùng hai lần. Hãy gộp thành một dòng.',

    lookupFailed: (name: string): string =>
      `Không tải được danh sách ${name} nên hiện chưa chọn được. Hãy thử lại.`,
    lookupTruncated:
      'Chỉ hiển thị một phần danh sách. Không thấy giá trị cần tìm thì hãy hỏi người phụ trách.',
    selectPlaceholder: 'Hãy chọn',
  },
};
