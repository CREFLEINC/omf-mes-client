import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-06 단말기-공정 매핑 설정.
 *
 * ⚠ **단말(`máy quét`)과 설비(`thiết bị`)를 섞지 않는다.** 이 화면은 한 표 안에 둘을 나란히
 * 세운다 — 단말에 어떤 설비가 붙어 있는가가 곧 한 열이다. 용어집이 가른 두 말을 지킨다.
 *
 * ⭐ **여덟 플래그는 보안이 아니라 오조작 방지다.** `quyền`(권한)으로 옮기지 않는다 — 그 말은
 * 사용자·역할 화면이 쓰는 보안 경계이고, 여기서 여는 것은 단말에 띄울 기능일 뿐이다.
 *
 * ⭐ **중지는 지우는 것이 아니다.** `xóa` 를 쓰지 않는다 — 그 단말이 남긴 기록이 참조로 남는다.
 */
export const terminalProcessMap: Translated<typeof ko.terminalProcessMap> = {
  title: 'Quản lý thiết bị đầu cuối',
  menuPath: 'Quản trị hệ thống › Quản lý thiết bị đầu cuối',

  panes: {
    list: 'Danh sách máy quét',
    terminal: 'Thông tin máy quét',
    grid: 'Cấu hình chức năng theo công đoạn',
    search: 'Điều kiện tra cứu máy quét',
    settings: 'Thiết lập máy quét',
  },

  filters: {
    search: 'Tìm mã máy quét',
    searchPlaceholder: 'Nhập mã máy quét',
    includeInactive: 'Gồm cả không sử dụng',
    apply: 'Tra cứu',
    clear: 'Đặt lại',
    type: 'Loại thiết bị',
    equipment: 'Thiết bị lắp đặt',
    all: 'Tất cả',
  },

  list: {
    code: 'Mã máy quét',
    type: 'Loại máy quét',
    status: 'Trạng thái vận hành',
    registration: 'Trạng thái đăng ký',
    registrationPending: 'Chưa đăng ký',
    registrationComplete: 'Đã đăng ký',
    registrationUnknown: 'Chưa xác nhận',
    equipment: 'Thiết bị lắp đặt',
    warehouse: 'Kho',
    warehouseAll: 'Toàn nhà máy',
    active: 'Dùng',
    activeHeader: 'Trạng thái sử dụng',
    inactive: 'Không sử dụng',
    notAvailable: '—',
    emptyTitle: 'Không có máy quét',
    empty: 'Không có máy quét khớp điều kiện. Hãy nới điều kiện hoặc đăng ký máy quét mới.',
    select: 'Chọn',
    selected: 'Máy quét đã chọn',
    loadFailed: 'Không tải được danh sách máy quét.',
  },

  chips: {
    label: 'Trạng thái đăng ký',
    filterOn: (label: string): string => `Chỉ xem ${label}`,
    filterOff: (label: string): string => `Bỏ lọc ${label}`,
  },

  terminal: {
    create: 'Thêm máy quét',
    edit: 'Sửa máy quét',
    code: 'Mã máy quét',
    /** ⛔ 등록 뒤에는 못 바꾼다 — 키다. */
    codeLocked: 'Không thể thay đổi sau khi đăng ký.',
    /** 수정 팝업의 단말 코드 옆(사용자 지시 2026-11-20 · #333). */
    codeReadOnly: 'Không thể thay đổi',
    plant: 'Nhà máy',
    type: 'Loại máy quét',
    status: 'Trạng thái vận hành',
    registration: 'Trạng thái đăng ký',
    /** 단말 정보 카드 — 설비 · 창고를 정하지 않았을 때(사용자 지시 2026-11-20 · #333). */
    unassigned: 'Chưa chỉ định',
    registeredAt: 'Thời điểm đăng ký',
    equipment: 'Thiết bị lắp đặt',
    equipmentNone: 'Chưa chỉ định',
    plantPlaceholder: 'Chọn nhà máy',
    typePlaceholder: 'Chọn loại',
    warehouse: 'Kho',
    warehouseAll: 'Toàn nhà máy',
    register: 'Đăng ký',
    /** 창고 칸 이름 오른쪽 안내 라벨(사용자 시안 2026-11-20 · #333). */
    warehouseScope: 'Danh sách công việc và số việc còn lại được hiển thị theo kho đã chọn.',
    optionalMark: '(tùy chọn)',
    save: 'Lưu',
    saving: 'Đang lưu.',
    saved: 'Đã lưu thông tin máy quét.',
    registered: 'Đã đăng ký.',
    cancel: 'Hủy',
    deactivate: 'Ngừng sử dụng',
    deactivated: 'Đã ngừng máy quét. Bản ghi vẫn còn.',
    activate: 'Dùng lại',
    activated: 'Đã dùng lại thiết bị đầu cuối.',
    deactivateTitle: 'Ngừng sử dụng máy quét',
    deactivateCaption: 'Đối tượng ngừng sử dụng',
    deactivateMeta: (type: string): string => `Loại máy quét: ${type}`,
    deactivateQuestion: 'Bạn có muốn ngừng sử dụng máy quét này không?',
    /** ⭐ `xóa` 를 쓰지 않는다 — 끄는 것이지 지우는 것이 아니다. */
    deactivateLead: 'Bản ghi máy quét để lại vẫn được giữ để tham chiếu.',
    deactivateConfirm: 'Ngừng sử dụng',
    requiredCode: 'Hãy nhập mã máy quét.',
    requiredPlant: 'Hãy chọn nhà máy.',
    requiredType: 'Hãy nhập mã loại.',
    requiredStatus: 'Hãy nhập mã trạng thái vận hành.',
    plantLookupFailed: 'Không tải được danh sách nhà máy nên hiện chưa chọn được.',
    lookupTruncated:
      'Chỉ hiển thị một phần danh sách. Không thấy cái cần tìm thì hãy hỏi người phụ trách.',
    selectPlaceholder: 'Hãy chọn',
  },

  token: {
    issue: 'Phát hành token đăng ký',
    title: 'Đăng ký thiết bị',
    lead: 'Quét mã QR trên thiết bị cần đăng ký.',
    imageLabel: 'Hình mã dùng để đăng ký máy quét',
    copy: 'Sao chép mã đăng ký',
    copied: 'Đã sao chép',
    copyFailed: 'Không sao chép được. Hãy kiểm tra quyền bảng nhớ tạm của trình duyệt.',
    copyUnavailable:
      'Trình duyệt chặn sao chép trên địa chỉ này nên không thể sao chép mã đăng ký. Hãy quét mã QR trên máy để đăng ký.',
    copyError: 'Không sao chép được. Hãy thử lại hoặc quét mã QR trên máy để đăng ký.',
    issuedAt: 'Thời điểm phát hành',
    expiresAt: 'Thời điểm hết hạn',
    noExpiry: 'Không hết hạn',
    close: 'Đóng',
    failed: 'Không phát hành được token đăng ký. Hãy thử lại.',
    textOmitted: 'Dán mã đã sao chép vào màn hình đăng ký của thiết bị.',
  },

  grid: {
    process: 'Công đoạn',
    openAll: 'Tất cả chức năng',
    add: 'Thêm công đoạn',
    addPlaceholder: 'Chọn công đoạn',
    nothingToAdd: 'Không còn công đoạn để thêm.',
    manage: 'Loại trừ công đoạn',
    remove: 'Loại trừ',
    emptyTitle: 'Chưa có công đoạn nào được thiết lập.',
    save: 'Lưu',
    saved: 'Đã lưu cấu hình chức năng.',
    saving: 'Đang lưu.',
    reset: 'Hủy',
    duplicate: 'Công đoạn này đã được thêm.',
    noFlag: 'Hãy bật ít nhất một chức năng ngoài đóng lệnh sản xuất',
    selectTerminalTitle: 'Vui lòng chọn máy quét.',
    selectTerminal: 'Có thể xem thông tin và chức năng theo công đoạn của máy quét đã chọn.',
    noTerminalTitle: 'Không có máy quét.',
    loadFailed: 'Không tải được cấu hình chức năng.',
    processLookupFailed: 'Không tải được danh sách công đoạn nên hiện chưa thể thêm công đoạn.',
    lockLoading: 'Đang tải cấu hình máy quét. Lát nữa hãy lưu.',
    lockFailed: 'Không tải được cấu hình máy quét nên không lưu được. Hãy thử lại.',
  },

  /** 여덟 플래그. ⚠ 이름만 보면 창고 작업 같지만 실재하는 여덟은 전부 생산 축이다. */
  flags: {
    canStartWork: 'Bắt đầu công việc',
    canCompleteWork: 'Hoàn tất công việc',
    canCloseWorkOrder: 'Đóng lệnh sản xuất',
    canInputMaterial: 'Đưa vật tư vào',
    canInputResult: 'Nhập kết quả',
    canInputInspection: 'Nhập kiểm tra',
    canPrintLabel: 'Phát hành nhãn',
    canCancelInput: 'Hủy đưa vào',
    canReturnMaterial: 'Trả lại vật tư',
  },

  discard: {
    title: 'Thay đổi chưa được lưu',
    body: 'Nếu rời đi mà không lưu, các thay đổi sẽ bị mất.',
  },
};
