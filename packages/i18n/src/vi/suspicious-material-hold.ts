import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-03-01 의심자재 등록. 후보 LOT 을 골라 보류를 건다 — 걸면 출고·출하·피킹이 막힌다.
 *
 * ⚠ 보류(`tạm giữ`)와 해제(`gỡ`)를 한 화면에서 함께 쓴다. 같은 말이 섞이지 않게 용어집의
 * 짝(보류 `tạm giữ` · 해제 조건 `điều kiện gỡ`)을 그대로 쓴다.
 */
export const suspiciousMaterialHold: Translated<typeof ko.suspiciousMaterialHold> = {
  title: 'Tạm giữ vật tư nghi ngờ',
  /** 보류 · 불량 등록이 끝나면 오른쪽 아래 알림(사용자 2026-11-02). */
  registered: 'Đã đăng ký.',
  breadcrumbRoot: 'Quản lý chất lượng',
  candidate: {
    pane: 'Ứng viên vật tư nghi ngờ',
    fields: {
      excludeFullyHeld: 'Bỏ LOT đã tạm giữ toàn bộ',
      lotNo: 'Số LOT',
      item: 'Mặt hàng',
      warehouse: 'Kho',
      location: 'Vị trí',
      quantity: 'Số lượng đang giữ',
      status: 'Trạng thái',
      latestTransition: 'Ngày đổi trạng thái gần nhất',
      /** 상세 검색의 선택 칸 이름(사용자 2026-11-02). */
      itemSearch: 'Tìm mặt hàng',
      warehouseSearch: 'Tìm vị trí',
      /** 조회 줄 기간 두 칸(사용자 2026-11-02). */
      periodFrom: 'Chọn ngày bắt đầu đổi trạng thái',
      periodTo: 'Chọn ngày kết thúc đổi trạng thái',
      periodFromPlaceholder: 'Hãy chọn ngày bắt đầu',
      periodToPlaceholder: 'Hãy chọn ngày kết thúc',
      lotScan: 'Số LOT',
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
    emptyHint: 'Hãy thay đổi điều kiện tìm kiếm hoặc đặt lại bộ lọc.',
  },
  input: {
    pane: 'Nhập đăng ký tạm giữ',
    range: 'Phạm vi tạm giữ',
    full: 'Tạm giữ toàn bộ',
    partial: 'Tạm giữ một phần',
    quantity: 'Số lượng tạm giữ',
    quantityOverLimit: (limit: string): string =>
      `Số lượng tạm giữ phải ≤ số lượng có thể tạm giữ ${limit}.`,
    quantityPlaceholder: 'Hãy nhập số lượng',
    reason: 'Lý do tạm giữ',
    reasonPlaceholder: 'Hãy chọn lý do',
    releaseCondition: 'Điều kiện gỡ',
    releaseConditionPlaceholder: 'Hãy nhập điều kiện gỡ',
    remarks: 'Ghi chú',
    remarksPlaceholder: 'Hãy nhập ghi chú',
    reasonUnavailable:
      'Danh sách lý do tạm giữ chưa đầy đủ. Chưa xác nhận được lý do thì chưa đăng ký được.',
    factsUnavailable:
      'Chưa xác nhận được vị trí · đơn vị hoặc trạng thái đến nơi thì chưa đăng ký được.',
    impact: 'Đối tượng và hạn chế tạm giữ',
    quantityName: 'Số lượng',
    uomName: 'Đơn vị',
    locationName: 'Vị trí',
    /** 못 받은 값 이름을 「수량 · 위치 · 단위 미확인」처럼 묶는다(사용자 시안 2026-11-02). */
    /** 재고 기록이 없는 LOT — 전량 보류는 된다(사용자 2026-11-02). */
    noStock: 'Không có tồn kho',
    unknownFacts: (names: string): string => `Chưa xác định ${names}`,
    /** 제한 사항 항목 단추의 이름 — 누르면 LOT 상세 팝업(사용자 2026-11-02). */
    openDetail: (lotNo: string): string => `Xem chi tiết ${lotNo}`,
    impactRestriction: 'Hạn chế xuất kho·xuất hàng·lấy hàng',
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
    dialogTitle: 'Đăng ký tạm giữ vật tư nghi ngờ',
    cancel: 'Hủy bỏ',
    register: 'Đăng ký tạm giữ',
    reload: 'Tải nội dung mới nhất',
    fieldError: 'Hãy kiểm tra lại giá trị đã nhập.',
    impact: (count: number): string =>
      `Xuất kho·xuất hàng·lấy hàng của ${String(count)} LOT bị hạn chế.`,
    impactRelease: 'Gỡ tạm giữ phải xử lý riêng ở W-03-02.',
    impactShipped: 'Số lượng đã xuất kho sẽ không được thu hồi.',
    conflictOwner: 'Một trong các LOT đã chọn',
    conflictFallback:
      'Trạng thái của một trong các LOT đã chọn đã thay đổi. Hãy tải lại nội dung mới nhất.',
    conflictChanged: (owner: string): string =>
      `Trạng thái của ${owner} đã thay đổi. Hãy tải lại nội dung mới nhất.`,
    conflictServer: (owner: string, message: string): string => `${owner}: ${message}`,
  },
  card: {
    title: 'Đăng ký tạm giữ vật tư nghi ngờ',
  },
  defect: {
    targetLot: 'LOT đối tượng',
    saveDraft: 'Đăng ký',
    draftedCount: (count: number): string => `Đã nhập · ${String(count)}`,
    noDrafts: 'Hãy nhấn LOT để nhập lỗi trước.',
    openLot: (lotNo: string): string => `Nhập lỗi cho ${lotNo}`,
    enter: 'Nhập nội dung lỗi',
    recordedCount: (count: number): string => `Đã đăng ký · ${String(count)}`,
    confirm: {
      titleMany: (count: number): string => `Đăng ký lỗi cho ${String(count)} LOT?`,
      skipped: (count: number): string => `${String(count)} LOT chưa nhập sẽ không được đăng ký.`,
      title: 'Đăng ký lỗi?',
      lot: 'LOT',
      code: 'Mã lỗi',
      qty: 'Số lượng lỗi',
      description: 'Nội dung lỗi',
      cancel: 'Hủy',
      back: 'Sửa',
    },
    uomUnknownNote: 'Không xác định được đơn vị LOT nên không thể đăng ký lỗi.',
    heading: 'Đăng ký chi tiết lỗi',
    major: 'Loại lỗi',
    majorPlaceholder: 'Chọn loại lỗi',
    noCodesNote: 'Chưa có mã lỗi. Hãy đăng ký trước ở quản lý mã lỗi.',
    registerCode: 'Đăng ký mã lỗi',
    qtyPlaceholder: 'Hãy nhập số lượng',
    descriptionPlaceholder: 'Nhập nội dung lỗi',
    submit: 'Đăng ký lỗi',
    affectedHeading: 'LOT sản xuất liên quan',
    affectedCount: (count: number): string => `Tổng ${String(count)}`,
    columns: {
      lotNo: 'Số LOT sản xuất',
      workOrderNo: 'Số lệnh sản xuất',
      statusCode: 'Trạng thái',
    },
    estimateNote:
      'LOT được tra cứu theo lệnh sản xuất. Có thể khác với LOT thực tế đã dùng vật tư.',
  },
};
