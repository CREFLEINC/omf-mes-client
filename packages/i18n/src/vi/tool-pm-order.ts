import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-02 툴 보전오더 생성(예방보전 도래 조회). 도래 판정은 서버가 하고 화면은 받은 값을 옮긴다 -
 * 「산출 불가」·「기준 없음」이 0과 갈리는 성질을 옮긴 말에서도 지킨다.
 */
export const toolPmOrder: Translated<typeof ko.toolPmOrder> = {
  title: 'Tạo lệnh bảo trì công cụ',
  breadcrumbRoot: 'Thiết bị / Công cụ',

  panes: {
    filters: 'Điều kiện tra cứu',
    list: 'Bảo trì phòng ngừa đến hạn',
    form: 'Tạo lệnh',
  },

  filters: {
    plant: 'Nhà máy',
    dueOnly: 'Chỉ công cụ đã đến hạn',
    withoutOpenOrder: 'Chỉ công cụ không có lệnh đang mở',
    guaranteedMissing: 'Chỉ công cụ không có số nhát dập đảm bảo',
    sort: 'Sắp xếp',
    sortShotUsage: 'Tỷ lệ vượt cao trước',
    sortNextPm: 'Ngày dự kiến kế tiếp sớm trước',
    sortCode: 'Theo mã',
    all: 'Tất cả',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    defaultNote:
      'Mặc định hiển thị công cụ đã đến hạn và không có lệnh đang mở, sắp theo tỷ lệ vượt cao trước — tỷ lệ vượt mới là mức độ rủi ro, không phải số ngày đã trôi qua.',
    plantLookupFailed: 'Không tải được danh sách nhà máy nên hiện chưa chọn được. Hãy thử lại.',
    lookupTruncated:
      'Chỉ hiển thị một phần danh sách. Không thấy giá trị cần tìm thì hãy hỏi người phụ trách.',
  },

  table: {
    mold: 'Công cụ',
    shotUsage: 'Tỷ lệ vượt',
    currentShot: 'Số nhát dập lũy kế',
    guaranteed: 'Số nhát dập đảm bảo',
    available: 'Còn dùng được',
    nextPm: 'Ngày dự kiến kế tiếp',
    dueAxis: 'Lý do đến hạn',
    notComputable: 'Không tính được',
    /** 기준일·주기가 없는 경우다 — 계측 기준(`Không có chuẩn`)과 가르려고 `mốc` 을 붙인다. */
    noBaseline: 'Không có mốc chuẩn',
    notDue: 'Chưa đến hạn',
    axisShot: 'Đạt số nhát dập',
    axisDate: 'Đến ngày',
    notAvailable: '—',
    overLimit: 'Vượt',
    emptyTitle: 'Không có công cụ đến hạn',
    empty: 'Không có công cụ nào khớp điều kiện. Hãy bớt điều kiện.',
    beyondLastTitle: 'Trang này không có công cụ',
    beyondLast: 'Có công cụ khớp điều kiện nhưng không nằm ở trang này. Hãy về trang đầu.',
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
    selected: (count: number): string => `Đã chọn ${String(count)} công cụ`,
    oneOrderPerTool: (count: number): string =>
      `Mỗi công cụ đã chọn sẽ tạo một lệnh — sẽ thành ${String(count)} lệnh.`,
    plannedDate: 'Ngày dự kiến',
    assignee: 'Người phụ trách',
    baseDate: 'Ngày cơ sở chu kỳ',
    baseDateNote: 'Chu kỳ kế tiếp bắt đầu từ ngày này. Để trống thì máy chủ tự định.',
    orderNote: 'Nội dung lệnh',
    items: 'Hạng mục lệnh',
    itemsFreeInput:
      'Bảo trì phòng ngừa công cụ không có dữ liệu gốc hạng mục nên phải nhập tay tên. Hãy ghi mỗi dòng một hạng mục.',
    itemName: 'Tên hạng mục',
    addItem: 'Thêm hạng mục',
    removeItem: 'Bỏ',
    submit: 'Tạo lệnh',
    reset: 'Xóa nội dung nhập',

    requiredSelection: 'Hãy chọn ít nhất một công cụ.',
    requiredPlannedDate: 'Hãy chọn ngày dự kiến.',
    invalidPlannedDate: 'Ngày không có trên lịch. Hãy chọn lại ngày dự kiến.',
    requiredAssignee: 'Hãy chọn người phụ trách.',
    requiredItem: 'Hãy ghi ít nhất một hạng mục lệnh.',
    emptyItemName: 'Có hạng mục trống. Hãy ghi tên hoặc bỏ dòng đó.',
    userLookupFailed: 'Không tải được danh sách người dùng nên hiện chưa chọn được. Hãy thử lại.',
    selectPlaceholder: 'Hãy chọn',
  },

  result: {
    heading: 'Kết quả tạo lệnh',
    succeeded: (count: number): string => `Đã tạo ${String(count)} mục.`,
    failed: (count: number): string => `${String(count)} mục thất bại.`,
    retryFailed: 'Thử lại chỉ cái thất bại',
    failedKept:
      'Công cụ thất bại vẫn được giữ ở trạng thái đã chọn. Hãy sửa nguyên nhân rồi thử lại.',
    ok: 'Đã tạo',
    error: 'Thất bại',
  },
};
