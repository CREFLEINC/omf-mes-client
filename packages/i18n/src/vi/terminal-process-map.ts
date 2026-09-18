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
  title: 'Thiết lập ánh xạ máy quét - công đoạn',
  breadcrumbRoot: 'Quản trị hệ thống',

  panes: {
    list: 'Danh sách máy quét',
    terminal: 'Thông tin máy quét',
    grid: 'Cấu hình chức năng theo công đoạn',
  },

  filters: {
    search: 'Tìm mã máy quét',
    searchPlaceholder: 'Nhập mã máy quét',
    includeInactive: 'Gồm máy quét đã ngừng',
    apply: 'Tra cứu',
    clear: 'Đặt lại',
  },

  list: {
    code: 'Mã máy quét',
    type: 'Loại',
    status: 'Trạng thái vận hành',
    registration: 'Trạng thái đăng ký',
    registrationPending: 'Chưa đăng ký',
    registrationComplete: 'Đã đăng ký',
    registrationUnknown: 'Chưa xác nhận',
    equipment: 'Thiết bị',
    active: 'Dùng',
    activeHeader: 'Sử dụng',
    inactive: 'Ngừng',
    notAvailable: '—',
    emptyTitle: 'Không có máy quét',
    empty: 'Không có máy quét khớp điều kiện. Hãy nới điều kiện hoặc đăng ký máy quét mới.',
    select: 'Chọn',
    selected: 'Máy quét đã chọn',
    loadFailed: 'Không tải được danh sách máy quét.',
  },

  terminal: {
    create: 'Đăng ký máy quét mới',
    edit: 'Sửa máy quét',
    code: 'Mã máy quét',
    /** ⛔ 등록 뒤에는 못 바꾼다 — 키다. */
    codeLocked: 'Đăng ký xong thì không đổi được. Đây là khóa.',
    plant: 'Nhà máy',
    type: 'Loại',
    status: 'Trạng thái vận hành',
    registration: 'Trạng thái đăng ký',
    equipment: 'Thiết bị lắp đặt',
    equipmentNone: 'Không gắn vào thiết bị nào',
    equipmentNote: 'Màn hình POP dùng giá trị này ở chỗ lấy «thiết bị này» làm tiền đề.',
    codeListPending: 'Nhập mã loại máy quét.',
    statusHelp: 'Nhập RUNNING hoặc STOPPED.',
    locationOmitted:
      'Vị trí lắp đặt phải chọn kho trước mới tra cứu được nên màn hình này không xử lý.',
    save: 'Lưu',
    saving: 'Đang lưu.',
    saved: 'Đã lưu thông tin máy quét.',
    cancel: 'Hủy',
    deactivate: 'Ngừng sử dụng',
    deactivated: 'Đã ngừng máy quét. Bản ghi vẫn còn.',
    deactivateTitle: 'Ngừng máy quét này chứ?',
    /** ⭐ `xóa` 를 쓰지 않는다 — 끄는 것이지 지우는 것이 아니다. */
    deactivateLead: 'Không xóa mà tắt đi — bản ghi máy quét đó để lại vẫn còn được tham chiếu.',
    deactivateConfirm: 'Ngừng',
    requiredCode: 'Hãy nhập mã máy quét.',
    requiredPlant: 'Hãy chọn nhà máy.',
    requiredType: 'Hãy nhập mã loại.',
    requiredStatus: 'Hãy nhập mã trạng thái vận hành.',
    plantLookupFailed: 'Không tải được danh sách nhà máy nên hiện chưa chọn được.',
    equipmentLookupFailed: 'Không tải được danh sách thiết bị nên hiện chưa chọn được.',
    lookupTruncated:
      'Chỉ hiển thị một phần danh sách. Không thấy cái cần tìm thì hãy hỏi người phụ trách.',
    selectPlaceholder: 'Hãy chọn',
  },

  token: {
    issue: 'Phát hành token đăng ký',
    title: 'Token đăng ký máy quét',
    lead: 'Quét mã QR hoặc dán mã đăng ký trên máy. Trạng thái sẽ hoàn tất sau khi máy xác nhận với máy chủ và nhận danh sách nhân viên.',
    reissueWarning:
      'Khi phát hành lại, kết nối của mọi máy đã đăng ký sẽ bị hủy. Sau đó phải đăng ký lại các máy.',
    imageLabel: 'Hình mã dùng để đăng ký máy quét',
    copy: 'Sao chép mã đăng ký',
    copied: 'Đã sao chép mã đăng ký.',
    copyFailed: 'Không sao chép được. Hãy kiểm tra quyền bảng nhớ tạm của trình duyệt.',
    copyUnavailable:
      'Trình duyệt chặn sao chép trên địa chỉ này nên không thể sao chép mã đăng ký. Hãy quét mã QR trên máy để đăng ký.',
    copyError: 'Không sao chép được. Hãy thử lại hoặc quét mã QR trên máy để đăng ký.',
    issuedAt: 'Thời điểm phát hành',
    expiresAt: 'Hết hạn',
    noExpiry: 'Không hết hạn',
    close: 'Đóng',
    failed: 'Không phát hành được token đăng ký. Hãy thử lại.',
    textOmitted: 'Mã đăng ký không hiện trên màn hình. Hãy quét QR hoặc sao chép và dán vào máy.',
  },

  grid: {
    process: 'Công đoạn',
    openAll: 'Chọn tất cả',
    add: 'Thêm công đoạn',
    addPlaceholder: 'Chọn công đoạn cần thêm',
    manage: 'Quản lý',
    remove: 'Loại trừ',
    /** ⭐ 빠진 공정은 지워진다 — 이 사실을 흐리면 사용자가 한 줄씩 저장되는 줄 안다. */
    replaceNote:
      'Khi lưu, cấu hình công đoạn sẽ được thay đổi theo danh sách hiện tại. Công đoạn đã loại trừ khỏi danh sách cũng sẽ bị loại khỏi máy quét này.',
    emptyTitle: 'Chưa có công đoạn nào được thiết lập',
    empty: 'Để dùng máy quét này cho công việc sản xuất, hãy thêm công đoạn ở phía trên.',
    /** ⭐ `quyền` 을 쓰지 않는다 — 보안 경계가 아니라 오조작을 막는 기능 구성이다. */
    purpose: 'Thiết lập theo từng công đoạn các chức năng được dùng trên máy quét này.',
    save: 'Lưu cấu hình',
    saved: 'Đã lưu cấu hình chức năng.',
    saving: 'Đang lưu.',
    reset: 'Hủy thay đổi',
    duplicate: 'Công đoạn này đã được thêm.',
    selectTerminalTitle: 'Vui lòng chọn máy quét',
    selectTerminal:
      'Chọn máy quét trong danh sách bên trái để xem thông tin chi tiết và chức năng theo công đoạn.',
    unselectedNote: 'Chọn máy quét để thiết lập chức năng theo công đoạn.',
    loadFailed: 'Không tải được cấu hình chức năng.',
    processLookupFailed: 'Không tải được danh sách công đoạn nên hiện chưa thể thêm công đoạn.',
    lockLoading: 'Đang tải cấu hình máy quét. Lát nữa hãy lưu.',
    lockFailed: 'Không tải được cấu hình máy quét nên không lưu được. Hãy thử lại.',
  },

  /** 여덟 플래그. ⚠ 이름만 보면 창고 작업 같지만 실재하는 여덟은 전부 생산 축이다. */
  flags: {
    canStartWork: 'Bắt đầu công việc',
    canCompleteWork: 'Hoàn tất công việc',
    canInputMaterial: 'Đưa vật tư vào',
    canInputResult: 'Nhập kết quả',
    canInputInspection: 'Nhập kiểm tra',
    canPrintLabel: 'Phát hành nhãn',
    canCancelInput: 'Hủy đưa vào',
    canReturnMaterial: 'Trả lại vật tư',
  },

  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
    prev: 'Trước',
    next: 'Sau',
  },
};
