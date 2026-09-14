import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * 알람 수신자 설정 — 알림 유형마다 받을 사람을 정한다.
 *
 * ⚠ **화면 이름은 사이드바와 글자가 같아야 한다**(`Thiết lập người nhận cảnh báo`). 사이드바
 * 라벨은 `apps/web/src/app/nav-tree.ts` 가 들고 있어 이 파일과 갈릴 수 있다 — 메뉴에서 누른
 * 이름과 열린 화면의 제목이 다르면 사용자는 다른 자리에 왔다고 읽는다.
 *
 * ⚠ **알림(`thông báo`)과 알람(`cảnh báo`)을 섞지 않는다.** 이 화면은 **알람** 수신자를
 * 정하지만 고르는 축은 **알림 유형**이다 — 용어집이 가른 두 말을 그대로 지킨다.
 */
export const alarmRecipientSettings: Translated<typeof ko.alarmRecipientSettings> = {
  title: 'Thiết lập người nhận cảnh báo',
  breadcrumbRoot: 'Thông báo',
  description: 'Chỉ định tổ chức · vai trò hoặc người dùng sẽ nhận theo từng loại thông báo.',
  panes: {
    events: 'Loại thông báo',
    recipients: 'Quy tắc nhận',
    preview: 'Xem trước người nhận thực tế',
  },
  fields: {
    recipientType: 'Cách chỉ định',
    businessUnit: 'Đơn vị kinh doanh',
    role: 'Vai trò',
    user: 'Người dùng',
    zalo: 'Thông báo Zalo',
  },
  values: {
    role: 'Tổ chức · vai trò',
    user: 'Cá nhân',
    inactive: ' (ngừng dùng)',
    statusActive: 'Đang dùng',
    statusInactive: 'Ngừng dùng',
  },
  actions: {
    add: 'Thêm quy tắc nhận',
    remove: 'Bỏ quy tắc nhận',
    preview: 'Xem trước',
    save: 'Lưu',
  },
  state: {
    loading: 'Đang tải thiết lập',
    noEvents: 'Không có loại thông báo nào để thiết lập.',
    noRecipients: 'Chưa đăng ký quy tắc nhận nào.',
    /** ⚠ 막는 말이 아니다 — 받을 사람이 없다는 사실과 **저장은 된다**는 사실을 함께 말한다. */
    noRecipientsWarning: 'Không có quy tắc nhận nên không ai nhận thông báo này. Vẫn lưu lại được.',
    saved: 'Đã lưu thiết lập người nhận.',
    clean: 'Không có nội dung nào thay đổi nên không cần lưu.',
    previewEmpty: 'Với quy tắc hiện tại chưa xác định được người nhận nào.',
    lookupLoading: 'Đang tải danh sách lựa chọn.',
    previewReady: (count: number, resolvedAt: string): string =>
      `Cơ sở ${resolvedAt} · ${String(count)} người sau khi bỏ trùng`,
    /** ⚠ Zalo 가 꺼져도 알림센터 수신은 산다 — 그 사실을 빼면 전부 끊긴 것으로 읽힌다. */
    zaloDisabled:
      'Thông báo Zalo chưa đăng ký nơi nhận nên chưa bật được. Việc nhận ở trung tâm thông báo không bị ảnh hưởng.',
  },
  errors: {
    requiredBusinessUnit: 'Hãy chọn đơn vị kinh doanh.',
    requiredRole: 'Hãy chọn vai trò.',
    requiredUser: 'Hãy chọn người dùng.',
    duplicate: 'Quy tắc nhận giống hệt đã có rồi.',
    lookupFailed: 'Không tải được danh sách lựa chọn. Hãy thử lại.',
    lookupIncomplete: 'Không tải được toàn bộ danh sách lựa chọn.',
  },
  columns: {
    event: 'Loại thông báo',
    count: 'Số thiết lập',
    user: 'Người dùng',
    department: 'Phòng ban',
    status: 'Trạng thái',
  },
};
