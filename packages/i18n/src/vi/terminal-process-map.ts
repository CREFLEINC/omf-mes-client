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
    grid: 'Cấu hình chức năng',
  },

  filters: {
    search: 'Tìm mã máy quét',
    searchPlaceholder: 'Hãy nhập một phần mã',
    includeInactive: 'Xem cả máy quét đã ngừng',
    apply: 'Tra cứu',
    clear: 'Xóa điều kiện',
  },

  list: {
    code: 'Mã máy quét',
    type: 'Loại',
    status: 'Trạng thái',
    equipment: 'Thiết bị',
    active: 'Dùng',
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
    status: 'Trạng thái',
    equipment: 'Thiết bị lắp đặt',
    equipmentNone: 'Không gắn vào thiết bị nào',
    equipmentNote: 'Màn hình POP dùng giá trị này ở chỗ lấy «thiết bị này» làm tiền đề.',
    codeListPending:
      'Danh sách giá trị chưa chốt nên phải nhập mã trực tiếp. Chốt rồi thì sẽ thành ô chọn.',
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
    requiredStatus: 'Hãy nhập mã trạng thái.',
    plantLookupFailed: 'Không tải được danh sách nhà máy nên hiện chưa chọn được.',
    equipmentLookupFailed: 'Không tải được danh sách thiết bị nên hiện chưa chọn được.',
    lookupTruncated:
      'Chỉ hiển thị một phần danh sách. Không thấy cái cần tìm thì hãy hỏi người phụ trách.',
    selectPlaceholder: 'Hãy chọn',
  },

  token: {
    issue: 'Phát hành token đăng ký',
    title: 'Token đăng ký máy quét',
    /** ⭐ 기기는 서버를 부르지 않는다 — 이 그림이 유일한 전달 경로다. */
    lead: 'Dùng camera của máy đọc hình này để đăng ký. Máy không gọi máy chủ riêng nên hình này là đường truyền duy nhất.',
    reissueWarning:
      'Phát hành lại thì mọi máy đã đăng ký trước đó đều bị ngắt. Những máy đó phải đăng ký lại.',
    imageLabel: 'Hình mã dùng để đăng ký máy quét',
    issuedAt: 'Thời điểm phát hành',
    expiresAt: 'Hết hạn',
    noExpiry: 'Không hết hạn',
    close: 'Đóng',
    failed: 'Không phát hành được token đăng ký. Hãy thử lại.',
    /** ⛔ 토큰 글자를 화면에 적지 않는다 — 옮긴 말에서도 글자를 보여 준다고 읽히면 안 된다. */
    textOmitted: 'Chuỗi token không hiện trên màn hình. Chỉ truyền qua hình.',
  },

  grid: {
    process: 'Công đoạn',
    openAll: 'Mở tất cả',
    add: 'Thêm công đoạn',
    addPlaceholder: 'Hãy chọn công đoạn cần thêm',
    remove: 'Bỏ',
    /** ⭐ 빠진 공정은 지워진다 — 이 사실을 흐리면 사용자가 한 줄씩 저장되는 줄 안다. */
    replaceNote:
      'Lưu thì bảng này thành đúng cấu hình của máy quét đó — công đoạn bỏ khỏi bảng sẽ bị xóa. Không phải lưu từng công đoạn một.',
    emptyTitle: 'Không có dòng công đoạn',
    empty:
      'Máy quét này không mở công đoạn nào. Máy quét chỉ dùng cho kho thì 0 dòng là bình thường — không phải lỗi.',
    /** ⭐ `quyền` 을 쓰지 않는다 — 보안 경계가 아니라 오조작을 막는 기능 구성이다. */
    purpose:
      'Cái mở ở đây là cấu hình chức năng để chặn thao tác nhầm. Ranh giới bảo mật chỉ có mỗi token máy quét.',
    save: 'Lưu cấu hình',
    saved: 'Đã lưu cấu hình chức năng.',
    saving: 'Đang lưu.',
    reset: 'Khôi phục',
    duplicate: 'Công đoạn này đã có trong bảng.',
    selectTerminalTitle: 'Hãy chọn một máy quét',
    selectTerminal: 'Chọn máy quét ở bên trái thì sẽ thấy cấu hình chức năng của máy quét đó.',
    loadFailed: 'Không tải được cấu hình chức năng.',
    processLookupFailed: 'Không tải được danh sách công đoạn nên hiện chưa thêm được.',
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
