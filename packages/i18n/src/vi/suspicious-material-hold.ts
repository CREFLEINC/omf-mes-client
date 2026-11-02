import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-03-01 의심자재 등록. 후보 LOT 을 골라 보류를 건다 — 걸면 출고·출하·피킹이 막힌다.
 *
 * ⚠ 보류(`tạm giữ`)와 해제(`gỡ`)를 한 화면에서 함께 쓴다. 같은 말이 섞이지 않게 용어집의
 * 짝(보류 `tạm giữ` · 해제 조건 `điều kiện gỡ`)을 그대로 쓴다.
 */
export const suspiciousMaterialHold: Translated<typeof ko.suspiciousMaterialHold> = {
  title: 'Đăng ký vật tư nghi ngờ',
  breadcrumbRoot: 'Quản lý chất lượng',
  candidate: {
    pane: 'Ứng viên vật tư nghi ngờ',
    fields: {
      lotNo: 'Số LOT',
      item: 'Mặt hàng',
      warehouse: 'Kho',
      location: 'Vị trí',
      quantity: 'Số lượng đang giữ · Đơn vị',
      status: 'Trạng thái',
      latestTransition: 'Ngày thay đổi cuối',
      /** 상세 검색의 선택 칸 이름(사용자 2026-11-02). */
      itemSearch: 'Tìm mặt hàng',
      warehouseSearch: 'Tìm kho',
      /** 조회 줄 기간 두 칸(사용자 2026-11-02). */
      periodFrom: 'Ngày bắt đầu thay đổi cuối',
      periodTo: 'Ngày kết thúc thay đổi cuối',
    },
    values: {
      all: 'Tất cả',
      statusUnknown: 'Chưa xác định tên trạng thái',
      itemUnknown: 'Chưa xác định tên mặt hàng',
      warehouseUnknown: 'Chưa xác định tên kho',
      locationUnknown: 'Chưa xác định tên vị trí',
      quantityUnknown: 'Chưa xác định số lượng',
      uomUnknown: 'Chưa xác định tên đơn vị',
      transitionNone: 'Chưa có lần chuyển đổi nào',
      fullyHeld: (lotNo: string): string => `${lotNo} · Đã tạm giữ toàn bộ nên không chọn được.`,
      selected: (count: number): string => `Đã chọn ${String(count)} mục`,
    },
    actions: {
      /** 목록 위 따로 된 단추(사용자 2026-11-02). */
      pickAll: 'Chọn tất cả',
      clearAll: 'Bỏ chọn tất cả',
      /** 목록 머리의 전체 선택 칸 이름(사용자 2026-11-02). */
      selectAll: 'Chọn tất cả LOT trên trang này',
      select: (lotNo: string): string => `Chọn ${lotNo}`,
      search: 'Tra cứu',
      reset: 'Đặt lại',
      retry: 'Thử lại',
    },
    loading: 'Đang tải ứng viên vật tư nghi ngờ',
    failed: 'Không tải được ứng viên vật tư nghi ngờ.',
    empty: 'Không có LOT nào khớp điều kiện.',
  },
  input: {
    pane: 'Nhập đăng ký tạm giữ',
    range: 'Phạm vi tạm giữ',
    full: 'Tạm giữ toàn bộ',
    partial: 'Tạm giữ một phần',
    quantity: 'Số lượng tạm giữ',
    reason: 'Lý do tạm giữ',
    reasonPlaceholder: 'Chọn lý do',
    releaseCondition: 'Điều kiện gỡ',
    releaseConditionPlaceholder: 'Nhập điều kiện gỡ',
    remarks: 'Ghi chú',
    remarksPlaceholder: 'Nhập nội dung bổ sung (tùy chọn)',
    reasonUnavailable:
      'Danh sách lý do tạm giữ chưa đầy đủ. Chưa xác nhận được lý do thì chưa đăng ký được.',
    factsUnavailable:
      'Chưa xác nhận được vị trí · đơn vị hoặc trạng thái đến nơi thì chưa đăng ký được.',
    impact: 'Ảnh hưởng của việc tạm giữ',
    impactTarget: (count: number): string => `LOT đối tượng ${String(count)}`,
    quantityUnknown: 'Chưa xác định số lượng',
    uomUnknown: 'Chưa xác định đơn vị',
    locationUnknown: 'Chưa xác định vị trí',
    impactRestriction: 'Khi tạm giữ, xuất kho · xuất hàng · lấy hàng sẽ bị hạn chế.',
    recovery: 'Khi gỡ tạm giữ cần xử lý Release riêng.',
  },
  execution: {
    pane: 'Thực hiện tạm giữ vật tư nghi ngờ',
    selectFirst: 'Chọn LOT ứng viên thì mới nhập được thông tin tạm giữ.',
    completeInput: 'Nhập lý do tạm giữ và điều kiện gỡ thì mới đăng ký được.',
    ready: (count: number): string =>
      `Hãy kiểm tra nội dung đăng ký tạm giữ của ${String(count)} mục.`,
    confirm: 'Đăng ký tạm giữ',
    success: 'Đã đăng ký tạm giữ vật tư nghi ngờ.',
    successNext: 'Hãy xử lý tiếp ở màn hình Xử lý đánh giá · chuyển đổi Lot Status.',
    dialogTitle: 'Xác nhận đăng ký tạm giữ vật tư nghi ngờ',
    cancel: 'Hủy bỏ',
    register: 'Đăng ký tạm giữ',
    reload: 'Tải nội dung mới nhất',
    fieldError: 'Hãy kiểm tra lại giá trị đã nhập.',
    impact: 'Ảnh hưởng của đăng ký tạm giữ',
    impactDescription: (count: number): string =>
      `Chặn xuất kho · xuất hàng · lấy hàng của ${String(count)} LOT. Việc gỡ được xử lý riêng ở W-03-02 và số lượng đã xuất kho sẽ không thu hồi lại được.`,
    conflictOwner: 'Một trong các LOT đã chọn',
    conflictFallback:
      'Trạng thái của một trong các LOT đã chọn đã thay đổi. Hãy tải lại nội dung mới nhất.',
    conflictChanged: (owner: string): string =>
      `Trạng thái của ${owner} đã thay đổi. Hãy tải lại nội dung mới nhất.`,
    conflictServer: (owner: string, message: string): string => `${owner}: ${message}`,
  },
  card: {
    title: 'Đăng ký tạm giữ vật tư nghi ngờ',
    selected: (count: number): string => `LOT đã chọn ${String(count)}`,
  },
  defect: {
    major: 'Loại lỗi',
    majorPlaceholder: 'Chọn loại lỗi',
    qtyPlaceholder: 'Nhập số lượng',
    descriptionPlaceholder: 'Nhập nội dung lỗi',
    submit: 'Ghi nhận lỗi',
    affectedCount: (count: number): string => String(count),
    estimateNote:
      'Đây là LOT được ước tính theo lệnh sản xuất, có thể khác với LOT thực tế đã dùng.',
  },
};
