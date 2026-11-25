import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * 알람 수신자 설정 — 부서 × 이벤트마다 받을 사람을 정한다(001 재설계).
 *
 * ⚠ **화면 이름은 사이드바와 글자가 같아야 한다**(`Thiết lập người nhận thông báo`). 사이드바
 * 라벨은 `apps/web/src/app/nav-tree.ts` 가 들고 있어 이 파일과 갈릴 수 있다 — 메뉴에서 누른
 * 이름과 열린 화면의 제목이 다르면 사용자는 다른 자리에 왔다고 읽는다.
 *
 * ⚠ **알림(`thông báo`)과 사건(`sự kiện`)을 섞지 않는다.** 고르는 축은 이벤트(`sự kiện`)이고
 * 가는 것은 알림이다 — 용어집이 가른 두 말을 그대로 지킨다.
 */
export const alarmRecipientSettings: Translated<typeof ko.alarmRecipientSettings> = {
  panes: {
    events: 'Sự kiện',
    setting: (eventName: string): string => `Thiết lập thông báo: ${eventName}`,
  },
  fields: {
    department: 'Chọn phòng ban',
    departmentPlaceholder: 'Chọn phòng ban',
    enabled: 'Dùng thông báo',
    zalo: 'Gửi Zalo',
    recipients: (count: number): string => `Người nhận ${String(count)} người`,
  },
  values: {
    on: 'ON',
    off: 'OFF',
    /** Zalo 연결이 ACTIVE 가 아닐 때 Zalo 발송 옆 노란 칩. */
    notConnected: 'Chưa kết nối',
    approver: 'Người phê duyệt',
    noPhone: 'Không có số điện thoại',
    inactive: 'Ngừng sử dụng',
    hasPhone: 'Đã đăng ký',
    phoneMissing: 'Chưa đăng ký · Không gửi được Zalo',
    alreadyAdded: 'Đã thêm',
    selectRow: (userName: string): string => `Chọn ${userName}`,
    noDepartment: '—',
    recipientCount: (count: number): string => `${String(count)} người`,
  },
  actions: {
    add: 'Thêm người nhận',
    remove: 'Xóa',
    revert: 'Hủy',
    save: 'Lưu',
    reload: 'Tải lại',
    openConnection: 'Thiết lập kết nối Zalo',
    cancel: 'Hủy',
    search: 'Tìm',
    addPick: 'Thêm',
    addSelected: (count: number): string => `Thêm ${String(count)} người`,
  },
  state: {
    selectDepartment: 'Chọn phòng ban để xem thiết lập sự kiện của phòng ban đó.',
    noDepartments: 'Không có phòng ban',
    departmentsTruncated:
      'Danh sách phòng ban chỉ hiển thị một phần. Nếu không thấy phòng ban cần tìm, hãy báo cho người phụ trách.',
    noEvents: 'Không có sự kiện để thiết lập.',
    noRecipients: 'Chưa chỉ định người nhận.',
    noPhoneNotice: (count: number): string =>
      `${String(count)} người nhận không có số điện thoại chỉ nhận qua trung tâm thông báo`,
    zaloNeedsEnabled: 'Phải bật dùng thông báo thì mới gửi được qua Zalo',
    zaloQuota:
      'Phí gửi được trừ vào số dư ZBS. Thông báo vượt hạn mức gửi hằng ngày sẽ được gửi lúc 7 giờ sáng hôm sau (giờ nhà máy).',
    unsaved: 'Có thay đổi chưa lưu',
    approverNotice:
      'Người phê duyệt đến lượt sẽ nhận. Đó là người được chỉ định trong luồng phê duyệt.',
    saved: 'Đã lưu',
    conflict: 'Người khác đã lưu trước. Hãy tải lại rồi lưu',
    zaloNotActive:
      'Zalo chưa được kết nối nên sẽ không gửi Zalo. Trung tâm thông báo vẫn nhận ngay.',
    candidatesEmpty: 'Không có kết quả tìm kiếm',
  },
  picker: {
    title: 'Thêm người nhận',
    departmentAll: 'Tất cả',
    searchLabel: 'Tìm người nhận',
    searchPlaceholder: 'Nhập tên hoặc tên đăng nhập',
    caption: 'Ứng viên người nhận',
    addable: (count: number): string => `Có thể thêm tối đa ${String(count)} người`,
    truncated:
      'Có quá nhiều ứng viên nên chỉ hiển thị một phần. Hãy tìm theo tên hoặc tên đăng nhập.',
  },
  errors: {
    inactiveRecipient: 'Không thể đặt người dùng ngừng sử dụng làm người nhận. Hãy xóa rồi lưu.',
    lookupFailed: 'Không tải được danh sách. Hãy thử lại.',
  },
  /** 지정한 수신자 표(두 알림 설정 화면이 함께 쓴다 · 사용자 지시 2026-11-25). */
  recipientTable: {
    name: 'Tên',
    department: 'Bộ phận',
    phone: 'Số điện thoại',
    manage: 'Quản lý',
  },
  columns: {
    event: 'Sự kiện',
    enabled: 'Thông báo',
    zalo: 'Zalo',
    recipients: 'Người nhận',
    userName: 'Tên',
    loginId: 'Tên đăng nhập',
    department: 'Phòng ban',
    phone: 'Đăng ký số điện thoại',
  },
  workspace: {
    list: 'Danh sách sự kiện',
    apply: 'Tra cứu',
    clear: 'Đặt lại',
    selectEventTitle: 'Hãy chọn sự kiện.',
    selectEvent:
      'Chọn phòng ban rồi bấm vào sự kiện để thiết lập dùng thông báo, gửi Zalo và người nhận.',
  },
};
