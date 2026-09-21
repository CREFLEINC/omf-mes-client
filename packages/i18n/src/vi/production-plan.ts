import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-04-03 W/O 전개·편성. 마스터 점검 → 계획 편집 → 전개 확정의 세 단계가 한 화면에 선다.
 *
 * ⚠ **`확정` 은 `chốt` 이다.** 사이드바 이름(`Chốt · phát hành W/O`)이 그렇게 정했다 —
 * 셸의 일반 「확정」(`xác nhận`)과 달리, 되돌릴 수 없게 굳히는 일을 가리킨다.
 */
export const productionPlan: Translated<typeof ko.productionPlan> = {
  title: 'Triển khai · lập W/O',
  breadcrumbRoot: 'Sản xuất',
  breadcrumbGroup: 'Kế hoạch · lệnh',

  order: {
    pane: 'ERP W/O đã chọn',
    heading: 'ERP W/O đã chọn',
    fields: { item: 'Mặt hàng', quantity: 'Số lượng', dueDate: 'Ngày giao' },
    dueUnset: 'Không có ngày giao',
  },

  /** ① 없는 것과 못 받은 것을 가른다 — 사용자가 갈 곳이 다르다(다시 시도 · 기준정보 등록). */
  masterCheck: {
    pane: 'Kiểm tra dữ liệu gốc',
    heading: 'Kiểm tra dữ liệu gốc',
    bomCard: 'BOM (bản chính ERP)',
    routingCard: 'Routing (bản chính MES)',
    selected: 'Đã chọn',
    revisionLabel: (kind: string) => `${kind} Rev`,
    revisionPlaceholder: 'Hãy chọn bản sửa đổi sẽ dùng',
    effectivePeriod: (period: string) => `Hiệu lực ${period}`,
    periodFrom: 'Chưa rõ ngày bắt đầu',
    periodTo: 'Không có ngày kết thúc',
    loadFailed: (kind: string) => `Không tải được bản sửa đổi ${kind}.`,
    retry: (kind: string) => `Thử lại ${kind}`,
    bomMissing: 'Không có BOM nên không triển khai được.',
    routingMissing: 'Không có Routing nên không triển khai được.',
    openRouting: 'Đến đăng ký Routing',
    bomAutoSelected: 'Đã tự chọn BOM Rev mặc định.',
    bomAmbiguous: 'Không xác định được một BOM Rev mặc định duy nhất.',
    routingNoDefault: 'Routing không có cờ Rev mặc định. Hãy tự chọn bản sửa đổi sẽ dùng.',
  },

  lines: {
    loading: 'Đang tải dòng sản xuất',
    loadFailed: 'Không tải được dòng sản xuất.',
    retry: 'Thử lại dòng sản xuất',
    plantMissing: 'ERP W/O không có nhà máy nên dòng sản xuất sẽ lưu là chưa chỉ định.',
    parentUnknown: 'Dòng cấp trên',
    inactiveSuffix: ' · Ngừng dùng',
  },

  /** ② 줄 하나가 계획 하나다. 줄마다 따로 저장한다. */
  editor: {
    pane: 'Soạn kế hoạch sản xuất',
    heading: 'Kế hoạch sản xuất',
    add: '+ Thêm kế hoạch',
    tableCaption: 'Bảng soạn kế hoạch sản xuất của ERP W/O',
    empty: 'Chưa có kế hoạch nào được đăng ký.',
    loading: 'Đang tải kế hoạch sản xuất',
    loadFailed: 'Không tải được kế hoạch sản xuất.',
    staleTitle: 'Không xác nhận được kế hoạch sản xuất mới nhất.',
    staleDescription: 'Nội dung đang soạn vẫn được giữ. Hãy tra cứu lại rồi thêm kế hoạch mới.',
    retry: 'Thử lại',
    newRow: (displayNo: number) => `Kế hoạch mới ${String(displayNo)}`,
    newStatus: 'Mới',
    columns: {
      planNo: 'Số kế hoạch',
      planDate: 'Ngày kế hoạch',
      plannedQty: 'Số lượng',
      bomId: 'BOM Rev',
      routingId: 'Routing Rev',
      plannedLineId: 'Dòng',
      status: 'Trạng thái',
      remarks: 'Ghi chú',
      actions: 'Thao tác',
    },
    fieldLabel: (rowName: string, field: string) => `${rowName} ${field}`,
    quantityField: 'Số lượng kế hoạch',
    lineUnset: 'Chưa chỉ định',
    selectPlaceholder: 'Chọn',
    confirmedLock: 'Kế hoạch đã chốt thì không sửa được.',
    confirmedChip: 'Đã chốt',
    savingChip: 'Đang lưu',
    remove: 'Xóa',
    remarksEdit: (rowName: string) => `Nhập ghi chú ${rowName}`,
    remarksEmpty: 'Nhập',
    remarksWritten: 'Sửa',
    remarksView: 'Xem',
    remarksViewLabel: (rowName: string) => `Xem ghi chú ${rowName}`,
    remarksDialog: 'Ghi chú',
    confirmedNotice: 'Sau khi chốt kế hoạch thì không sửa hoặc xóa được.',
    totalLabel: 'Tổng',
    totalUnknown: 'Không tính được tổng',
    total: (planned: string, ordered: string, uomLabel: string) =>
      `${planned} / ${ordered} ${uomLabel}`,
  },

  /** 네 갈래가 서로 다른 일을 하라고 말한다 — 고쳐라 · 더해라 · 정책을 봐라 · 계속해라. */
  quantitySummary: {
    invalid: 'Hãy sửa lỗi số lượng kế hoạch trước.',
    empty: 'Phải thêm ít nhất 1 kế hoạch mới triển khai được.',
    over: () => 'Số lượng kế hoạch đã vượt.',
    overFacts: (ordered: string, planned: string, uomLabel: string) =>
      `Số lượng W/O ${ordered} ${uomLabel} · Tổng kế hoạch ${planned} ${uomLabel}`,
    under: (amount: string, uomLabel: string) =>
      `Thiếu so với số lượng ERP W/O ${amount} ${uomLabel}.`,
    underDescription: 'Nếu đang chia nhỏ kế hoạch thì cứ soạn tiếp.',
    matched: 'Tổng số lượng kế hoạch khớp với số lượng ERP W/O.',
  },

  rowActions: {
    save: 'Lưu',
    remove: 'Xóa',
    confirm: 'Chốt triển khai',
    showResults: 'Kết quả triển khai',
    lockLoadFailed: 'Không tải được thông tin khóa lưu.',
    retry: 'Thử lại',
    fallbackPlanNo: (productionPlanId: number) => `Kế hoạch ${String(productionPlanId)}`,
  },

  /** ③ 무엇이 함께 생기고 무엇을 잃는지 둘 다 적는다. */
  confirmDialog: {
    planLabel: 'Kế hoạch sản xuất',
    cancel: 'Hủy',
    confirm: 'Chốt triển khai',
    effect:
      'Khi chốt triển khai, W/O theo từng công đoạn Routing và quan hệ phụ thuộc giữa các công đoạn sẽ được tạo.',
    irreversible: 'Sau khi chốt thì không sửa hoặc xóa được kế hoạch này.',
  },

  resultPageNav: {
    label: 'Chuyển trang W/O đã triển khai',
    first: 'Trang đầu',
    prev: 'Trước',
    next: 'Sau',
  },
  result: {
    pane: 'Lệnh sản xuất đã triển khai',
    heading: (planName: string) => `Kết quả triển khai ${planName}`,
    fallbackPlanName: (productionPlanId: number) => `Kế hoạch sản xuất ${String(productionPlanId)}`,
    loading: 'Đang tải kết quả triển khai',
    loadFailed: 'Không tải được kết quả triển khai.',
    ownerMismatch: 'Đã nhận về kết quả triển khai của kế hoạch khác.',
    retry: 'Thử lại',
    empty: 'Chưa có lệnh sản xuất nào được tạo.',
    columns: {
      workOrderNo: 'Số W/O',
      operation: 'Công đoạn',
      orderQty: 'Số lượng',
      workOrderType: 'Loại W/O',
      status: 'Trạng thái',
    },
    operationUnknown: 'Chưa rõ tên công đoạn',
    quantity: (amount: string, uomLabel: string) => `${amount} ${uomLabel}`,
  },

  /** 무엇이 틀렸는지를 말하고 고칠 방향을 함께 준다. */
  draftErrors: {
    REQUIRED: 'Đây là giá trị bắt buộc.',
    INVALID_DATE: 'Hãy chọn ngày hợp lệ.',
    INVALID_QUANTITY: 'Hãy nhập số lượng lớn hơn 0.',
    INVALID_SELECTION: 'Hãy chọn mục hợp lệ.',
  },

  screen: {
    unselected: 'Hãy chọn ERP W/O trước.',
    openProductionOrders: 'Đến nhận · tra cứu ERP W/O',
    loading: 'Đang tải ERP W/O',
    ownerMismatch: 'Đã nhận về chi tiết khác với ERP W/O đã yêu cầu.',
    loadFailed: 'Không tải được ERP W/O.',
    stale: 'Không xác nhận được ERP W/O mới nhất.',
    retry: 'Thử lại',
    keepsEdits: 'Nội dung đang soạn vẫn được giữ.',
    lotNotice: 'Cỡ LOT sản xuất và phát trước sẽ nhập ở bước chốt · phát hành W/O.',
  },
};
