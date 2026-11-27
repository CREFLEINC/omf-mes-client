import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-02-06 P/O 변경 관리자 확인.
 *
 * ⚠ **「확인」은 승인이 아니다.** 결재선이 없는 단일 행위라 `phê duyệt`(승인)을 쓰지 않고
 * `xác nhận`(확인)으로 옮긴다 — 사이드바 이름(`Quản trị xác nhận thay đổi P/O`)과 맞춘다.
 *
 * ⚠ **`판정` 은 검사 판정이 아니다.** 여기서는 「반영이냐 강행이냐」를 고르는 일이라
 * 용어집의 `đánh giá`(검사·상태 판정)가 아니라 `quyết định` 으로 옮긴다.
 */
export const poChangeReview: Translated<typeof ko.poChangeReview> = {
  title: 'Quản trị xác nhận thay đổi P/O',
  breadcrumbRoot: 'Quản lý sản xuất',
  panes: {
    list: 'Danh sách thông báo thay đổi',
    diff: 'Nội dung thay đổi',
    workOrders: 'Lệnh sản xuất bị ảnh hưởng',
    workOrdersCount: (count: number) => `Lệnh sản xuất bị ảnh hưởng: ${String(count)}`,
    decision: 'Cách xử lý',
  },
  header: {
    unacknowledged: (count: number) => `${String(count)} mục chưa xác nhận`,
  },
  list: {
    loading: 'Đang tải thông báo thay đổi',
    loadFailed: 'Không tải được thông báo thay đổi',
    empty: 'Không có thay đổi P/O nào cần xác nhận',
    emptyDescription: 'Khi ERP gửi thay đổi, chúng sẽ hiện ở đây.',
    selectRow: (productionOrderNo: string) => `Chọn ${productionOrderNo}`,
    fields: {
      receivedAt: 'Thời điểm nhận',
      productionOrderNo: 'P/O',
      changedFields: 'Mục thay đổi',
      acknowledged: 'Xác nhận',
    },
    /** 지어내지 않고 모른다고 적는다 — 원문이 그렇게 돼 있다. */
    changedFieldsUnknown: 'Không có nội dung thay đổi',
    changedFieldsOutOfScope: 'Chưa rõ mục',
    unacknowledgedChip: 'Chưa xác nhận',
    acknowledgedChip: 'Đã xác nhận',
  },
  diff: {
    columns: {
      field: 'Mục',
      before: 'Hiện tại (MES)',
      after: 'Thay đổi (ERP)',
      note: 'Ghi chú',
    },
    receivedAt: (at: string) => `Thời điểm nhận ${at}`,
    decrease: (qty: string) => `▼ Giảm ${qty}`,
    increase: (qty: string) => `▲ Tăng ${qty}`,
    same: '(Giống nhau)',
    selectFirst: 'Hãy chọn một thông báo trong danh sách thông báo thay đổi',
    noLastChange: 'Chưa nhận được nội dung thay đổi.',
    viewSource: 'Xem bản gốc',
    outOfScope: 'Không thể hiện mục của thay đổi này — bản gốc xem ở tình trạng đồng bộ liên kết.',
  },
  workOrders: {
    loading: 'Đang tải W/O bị ảnh hưởng',
    loadFailed: 'Không tải được W/O bị ảnh hưởng',
    empty: 'Chưa có W/O nào được triển khai từ P/O này',
    fields: {
      workOrderNo: 'W/O',
      qty: 'Số lượng',
      status: 'Trạng thái',
      produced: 'Kết quả',
      mismatch: 'Không khớp',
      adjustQty: 'Số lượng điều chỉnh',
    },
    alreadyProduced: 'Đã sản xuất',
    mismatchChip: 'Không khớp với P/O',
    producedOverWarning: (produced: string, changed: string) =>
      `Đã sản xuất ${produced}. Nếu áp dụng thì kế hoạch (${changed}) sẽ nhỏ hơn kết quả.`,
    adjustHelp: 'Chỉ ghi số lượng lệnh mới cho W/O muốn áp dụng. Để trống thì W/O đó giữ nguyên.',
    adjustLabel: (workOrderNo: string) => `Số lượng điều chỉnh ${workOrderNo}`,
    adjustLocked: 'W/O này không có số phiên bản nên không điều chỉnh được',
    adjustNotNumber: 'Hãy nhập bằng số',
    adjustNegative: 'Hãy nhập từ 0 trở lên',
  },
  decision: {
    label: 'Cách xử lý',
    apply: 'Áp dụng thay đổi',
    applyHint: 'Áp dụng số lượng đã thay đổi vào lệnh sản xuất.',
    proceed: 'Giữ nguyên lệnh sản xuất',
    proceedHint: 'Giữ số lượng hiện tại và ghi lại chỗ không khớp.',
    reasonLabel: 'Lý do',
    reasonRequired: 'Hãy nhập lý do tiếp tục',
    reasonTooLong: 'Lý do quá dài. Hãy nhập tối đa 500 ký tự',
    proceedNote: 'Nếu tiếp tục, dấu không khớp với P/O sẽ lưu lại trên các W/O bị ảnh hưởng.',
    applyWithoutAdjustment:
      'Lệnh sản xuất không ghi số lượng điều chỉnh sẽ giữ nguyên, và W/O đó sẽ mang dấu không khớp với P/O. Nếu không có số lượng nào để điều chỉnh — như khi áp dụng việc dừng hoặc hủy — thì cứ tiến hành.',
    submit: 'Xử lý',
    submitted: 'Đã lưu xử lý.',
  },
  lock: {
    selectNone: 'Hãy chọn một thông báo thay đổi',
    noChange: 'Không thể xử lý ở trạng thái hiện tại.',
    decisionNone: 'Hãy chọn áp dụng hoặc tiếp tục',
    reason: 'Hãy nhập lý do tiếp tục',
    adjustment: 'Hãy sửa lỗi số lượng điều chỉnh',
    saving: 'Đang lưu xử lý xác nhận',
  },
  /**
   * ⚠ **부딪치는 상대가 사람이 아니라 ERP 배치다.** 공용 저장 충돌 문구(`người khác`)를 쓰면
   * 동료를 찾으러 간다 — 주어를 ERP 로 못박는다.
   */
  conflict: {
    title: 'ERP đã thay đổi lần nữa',
    description:
      'Trong lúc bạn quyết định, ERP lại gửi thay đổi cho P/O này. Hãy tải lại và quyết định theo phần thay đổi mới.',
    reload: 'Tải lại',
  },
  withdrawn: {
    cancelFollowUp:
      'Việc hủy lệnh sản xuất sau khi áp dụng dừng hoặc hủy không đặt ở màn hình này. Hủy sẽ bỏ luôn cả suất LOT sản xuất đã phát trước nên phải kiểm tra và tiến hành theo từng trường hợp.',
  },
};
