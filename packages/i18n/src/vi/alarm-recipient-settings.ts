import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * 알람 수신자 설정 — 부서 × 이벤트마다 받을 사람을 정한다(001 재설계).
 *
 * ⚠ **화면 이름은 사이드바와 글자가 같아야 한다**(`Thiết lập người nhận cảnh báo`). 사이드바
 * 라벨은 `apps/web/src/app/nav-tree.ts` 가 들고 있어 이 파일과 갈릴 수 있다 — 메뉴에서 누른
 * 이름과 열린 화면의 제목이 다르면 사용자는 다른 자리에 왔다고 읽는다.
 *
 * ⚠ **알림(`thông báo`)과 사건(`sự kiện`)을 섞지 않는다.** 고르는 축은 이벤트(`sự kiện`)이고
 * 가는 것은 알림이다 — 용어집이 가른 두 말을 그대로 지킨다.
 */
export const alarmRecipientSettings: Translated<typeof ko.alarmRecipientSettings> = {
  title: 'Thiết lập người nhận cảnh báo',
  breadcrumbRoot: 'Quản trị hệ thống',
  description:
    'Bật hoặc tắt từng sự kiện thông báo theo phòng ban, chọn có gửi thêm qua Zalo và người nhận.',
  panes: {
    events: 'Sự kiện',
    setting: (eventName: string): string => `Thiết lập: ${eventName}`,
  },
  fields: {
    department: 'Phòng ban',
    enabled: 'Nhận thông báo',
    zalo: 'Gửi cả qua Zalo',
    recipients: (count: number): string => `Người nhận (${String(count)})`,
  },
  values: {
    on: 'Bật',
    off: 'Tắt',
    approver: 'Người phê duyệt',
    noPhone: 'Không có số điện thoại',
    inactive: 'Ngừng sử dụng',
    hasPhone: 'Có',
    alreadyAdded: 'Đã thêm',
    noDepartment: '—',
  },
  actions: {
    add: 'Thêm',
    remove: 'Bỏ',
    revert: 'Hoàn tác',
    save: 'Lưu',
    reload: 'Tải lại',
    cancel: 'Hủy',
    discard: 'Bỏ thay đổi và chuyển',
    search: 'Tìm',
    prevPage: 'Trang trước',
    nextPage: 'Trang sau',
    addSelected: (count: number): string => `Thêm (${String(count)})`,
  },
  state: {
    selectDepartment: 'Chọn phòng ban để xem thiết lập sự kiện của phòng ban đó.',
    noDepartments: 'Không có phòng ban',
    noEvents: 'Không có sự kiện để thiết lập.',
    noRecipients: 'Chưa chỉ định người nhận.',
    noRecipientsWarning: 'Không có người nhận nên thông báo sẽ không được gửi',
    noPhoneNotice: (count: number): string =>
      `${String(count)} người nhận không có số điện thoại chỉ nhận qua trung tâm thông báo`,
    zaloHelp: 'Dù gửi thất bại, trung tâm thông báo vẫn nhận',
    zaloNeedsEnabled: 'Phải bật thông báo thì mới gửi được qua Zalo',
    approverNotice:
      'Người phê duyệt đến lượt sẽ nhận. Đó là người được chỉ định trong luồng phê duyệt (W-06-15).',
    saved: 'Đã lưu',
    conflict: 'Người khác đã lưu trước. Hãy tải lại rồi lưu',
    zaloNotActive:
      'Chưa thiết lập kết nối Zalo nên hiện chỉ gửi đến trung tâm thông báo — Thiết lập kết nối thông báo (W-CO-12)',
    unsavedTitle: 'Có thay đổi chưa lưu',
    unsavedBody: 'Nếu chuyển đi, nội dung đã sửa sẽ mất. Bỏ thay đổi và chuyển?',
    candidatesEmpty: 'Không có kết quả tìm kiếm',
    pageOf: (page: number, totalPages: number): string => `${String(page)} / ${String(totalPages)}`,
  },
  picker: {
    title: 'Thêm người nhận',
    searchLabel: 'Tên hoặc tên đăng nhập',
    caption: 'Ứng viên người nhận',
  },
  errors: {
    inactiveRecipient: 'Không thể đặt người dùng ngừng sử dụng làm người nhận. Hãy bỏ rồi lưu.',
    lookupFailed: 'Không tải được danh sách. Hãy thử lại.',
  },
  columns: {
    event: 'Sự kiện',
    enabled: 'Thông báo',
    zalo: 'Zalo',
    recipients: 'Người nhận',
    userName: 'Tên',
    loginId: 'Tên đăng nhập',
    department: 'Phòng ban',
    phone: 'Số điện thoại',
  },
};
