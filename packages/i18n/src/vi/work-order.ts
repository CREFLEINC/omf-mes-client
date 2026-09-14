import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-02-03 4M 자원배정·유효성 점검.
 *
 * ⚠ **4M 카드 이름(Machine · Man · Tool/Mold · Material)은 옮기지 않는다** — 현장에서 그대로
 * 쓰는 이름이고, 원문도 영문 그대로다. 카드 «안»의 칸 이름은 옮긴다.
 *
 * ⚠ **검증 등급 둘을 가른다** — `차단`(`chặn`)은 못 가게 막는 것, `경고`(`cảnh báo`)는 알리되
 * 보내 주는 것이다. 같은 말로 옮기면 사용자가 막힌 줄 알고 멈춘다.
 */
export const workOrder: Translated<typeof ko.workOrder> = {
  editor: {
    loading: 'Đang tải thông tin phân bổ lệnh sản xuất.',
    failed: 'Không tải được thông tin phân bổ lệnh sản xuất.',
    ownerMismatch: 'Đã nhận về chi tiết khác với lệnh sản xuất đã yêu cầu.',
    staleTitle: 'Không xác nhận được lệnh sản xuất mới nhất.',
    staleDescription: 'Phần nhập chưa lưu vẫn được giữ. Hãy tra cứu lại rồi lưu.',
    staleBlocked: 'Chưa xác nhận được lệnh sản xuất mới nhất thì chưa sửa được.',
    changedTitle: 'Lệnh sản xuất đã bị thay đổi từ bên ngoài.',
    changedDescription:
      'Phần nhập chưa lưu vẫn được giữ. Hãy áp dụng nội dung mới nhất rồi sửa tiếp.',
    changedBlocked: 'Chưa áp dụng lệnh sản xuất mới nhất thì chưa sửa được.',
    writeOwnerMismatch:
      'Lệnh sản xuất trong phản hồi lưu không khớp nên kết quả chưa được áp dụng.',
    validationFailed: 'Không tải được kết quả kiểm tra lệnh sản xuất.',
    validationBlocked: 'Chưa xem lại được kết quả kiểm tra lệnh sản xuất thì chưa sửa được.',
    lookup: {
      loading: 'Đang tải danh sách lựa chọn.',
      failed: 'Không tải được danh sách lựa chọn.',
      truncated: 'Chỉ hiển thị trang đầu của danh sách lựa chọn.',
      noPlant: 'P/O không có nhà máy nên không tải được danh sách lựa chọn.',
    },
  },
  screen: {
    view: {
      title: 'Phân bổ nguồn lực 4M · kiểm tra hợp lệ',
      breadcrumbRoot: 'Sản xuất',
      selectPlan: 'Hãy chọn kế hoạch sản xuất trước.',
      selectPlanLink: 'Đến triển khai · lập W/O',
      openAssignment: 'Đến phân bổ nguồn lực 4M · kiểm tra hợp lệ',
      contextPane: 'Kế hoạch sản xuất đã chọn',
      editorPane: 'Soạn phân bổ lệnh sản xuất',
      context: (productionOrderNo: string, total: number) =>
        `P/O ${productionOrderNo} · ${String(total)} W/O`,
      selectWorkOrder: 'Hãy chọn lệnh sản xuất để phân bổ.',
      selectDescription:
        'Chọn một số W/O trong danh sách để xem phân bổ nguồn lực và kết quả kiểm tra.',
      failed: 'Không tải được màn hình phân bổ lệnh sản xuất.',
      ownerMismatch: 'Đã nhận về thông tin phân bổ khác với phạm vi đã yêu cầu.',
      stale: 'Không xác nhận được thông tin phân bổ lệnh sản xuất mới nhất.',
      staleDescription: 'Phần nhập chưa lưu vẫn được giữ. Hãy tra cứu lại rồi sửa.',
      staleBlocked: 'Chưa xác nhận được thông tin phân bổ mới nhất thì chưa sửa được.',
      retry: 'Thử lại màn hình phân bổ',
    },
    assignmentCount: (assigned: number, total: number) => `${String(assigned)}/${String(total)}`,
    validation: {
      notChecked: 'Chọn rồi xem',
      failed: 'Tra cứu kiểm tra thất bại',
      blocked: 'Kiểm tra chặn',
      warning: 'Kiểm tra cảnh báo',
      passed: 'Kiểm tra đạt',
    },
    errors: {
      REQUIRED: 'Đây là mục bắt buộc.',
      INVALID_SELECTION: 'Hãy kiểm tra giá trị đã chọn.',
      INVALID_INTEGER: 'Hãy nhập số nguyên.',
      INVALID_DATE_TIME: 'Hãy kiểm tra ngày và giờ.',
      END_BEFORE_START: 'Kết thúc kế hoạch không được sớm hơn lúc bắt đầu.',
    },
  },
  panes: { list: 'Danh sách lệnh sản xuất' },
  fields: {
    workOrderNo: 'Số W/O',
    operation: 'Công đoạn',
    quantity: 'Số lượng',
    priority: 'Độ ưu tiên',
    assignment: 'Phân bổ',
    validation: 'Kiểm tra',
  },
  actions: {
    select: (workOrderNo: string) => `Chọn ${workOrderNo}`,
    priorityLabel: (workOrderNo: string) => `Độ ưu tiên ${workOrderNo}`,
  },
  values: { missingOperation: 'Không có tên hiển thị công đoạn' },
  loading: 'Đang tải danh sách lệnh sản xuất.',
  empty: {
    title: 'Không có lệnh sản xuất để hiển thị',
    description: 'Hãy chọn kế hoạch sản xuất hoặc đổi điều kiện tra cứu rồi xem lại.',
    beyondTitle: 'Trang hiện tại không có lệnh sản xuất để hiển thị',
    beyondDescription: 'Hãy về trang đầu hoặc trang trước rồi xem lại.',
  },
  page: {
    range: (start: number, end: number, total: number) =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    total: (total: number) => `Tổng ${String(total)} mục`,
  },
  pageNav: {
    label: 'Chuyển trang lệnh sản xuất',
    first: 'Trang đầu',
    previous: 'Trang trước',
    next: 'Trang sau',
    /** 비활성 사유는 컨트롤 이름으로 시작한다 — 잘려도 어느 단추의 말인지 남는다. */
    disabled: {
      first: 'Trang đầu: Đang ở trang đầu rồi. Chỉ chuyển được khi không ở trang đầu.',
      previous: 'Trang trước: Đang ở trang đầu rồi. Chỉ chuyển được khi ở sau trang đầu.',
      next: 'Trang sau: Không có trang sau. Chỉ chuyển được khi có trang sau.',
    },
  },
  validationPane: {
    panes: { validation: 'Kiểm tra lệnh sản xuất' },
    fields: { severity: 'Mức', message: 'Nội dung' },
    loading: 'Đang tải kết quả kiểm tra lệnh sản xuất.',
    refreshing: 'Đang làm mới kết quả kiểm tra lệnh sản xuất.',
    severity: { block: 'Chặn', warning: 'Cảnh báo' },
    summary: { blocked: 'Kiểm tra chặn', warning: 'Kiểm tra cảnh báo', passed: 'Kiểm tra đạt' },
    empty: {
      notSelectedTitle: 'Hãy chọn lệnh sản xuất để kiểm tra.',
      notSelectedDescription: 'Chọn một lệnh sản xuất trong danh sách để xem kết quả kiểm tra.',
      missingTitle: 'Không tải được kết quả kiểm tra.',
      missingDescription: 'Hãy chọn lại hoặc làm mới trang để xem.',
      noFindingsTitle: 'Không có mục kiểm tra nào.',
      noFindingsDescription: 'Lệnh sản xuất hiện tại không có kết quả kiểm tra nào để xem.',
    },
  },
  resourcePane: {
    pane: 'Phân bổ nguồn lực lệnh sản xuất',
    heading: (workOrderNo: string) => `W/O đã chọn — ${workOrderNo}`,
    warning: 'Mỗi loại nguồn lực chỉ phân bổ được một. Cần thêm thì hãy tách W/O.',
    placeholder: 'Hãy chọn',
    clearOption: 'Không phân bổ',
    cards: { machine: 'Machine', man: 'Man', tool: 'Tool/Mold', material: 'Material' },
    fields: {
      productionLine: 'Dòng sản xuất',
      equipment: 'Thiết bị',
      worker: 'Người phụ trách',
      mold: 'Khuôn',
      shift: 'Ca theo kế hoạch',
      defaultWipLocation: 'Vị trí WIP mặc định',
      defaultFgLocation: 'Vị trí thành phẩm mặc định',
      defaultScrapLocation: 'Vị trí phế liệu mặc định',
    },
    materialInfo: 'Phân bổ vật tư không thay đổi ở màn hình này.',
    empty: {
      notSelectedTitle: 'Hãy chọn lệnh sản xuất để phân bổ nguồn lực.',
      notSelectedDescription:
        'Chọn một lệnh sản xuất trong danh sách để xem nội dung phân bổ nguồn lực.',
    },
  },
  planFieldsPane: {
    pane: 'Trường kế hoạch của lệnh sản xuất',
    heading: (workOrderNo: string) => `W/O đã chọn — ${workOrderNo}`,
    card: 'Kế hoạch',
    fields: {
      plannedStartAtLocal: 'Bắt đầu theo kế hoạch',
      plannedEndAtLocal: 'Kết thúc theo kế hoạch',
      priorityNo: 'Độ ưu tiên',
    },
    warning: 'Phải có cả bắt đầu và kết thúc theo kế hoạch mới kiểm được nguồn lực bị trùng.',
    empty: {
      notSelectedTitle: 'Hãy chọn lệnh sản xuất để xem kế hoạch.',
      notSelectedDescription: 'Chọn một lệnh sản xuất trong danh sách để xem thông tin kế hoạch.',
    },
  },
  assignmentActions: {
    actions: { validate: 'Chạy lại Validation', reset: 'Bỏ thay đổi', save: 'Lưu' },
    reasons: {
      saving: 'Trong lúc lưu thì không chạy được thao tác.',
      noChanges: 'Không có nội dung nào thay đổi.',
      invalidDraft: 'Hãy kiểm tra thông tin phân bổ.',
    },
  },
};
