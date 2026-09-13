import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-03 알림센터.
 *
 * ⚠ **읽음·안 읽음은 `Đã xem`·`Chưa xem` 이다.** #1113 이 대시보드의 같은 상태를 그렇게 옮겼고
 * (`vi/dashboard.ts` 의 `alerts.read`·`alerts.unread`), 두 화면이 같은 알림을 가리키므로 낱말이
 * 갈리면 사용자는 서로 다른 두 상태로 읽는다.
 *
 * ⛔ **알림 문장을 이 슬라이스가 짓지 않는다.** 카드 본문은 서버가 준 말 그대로다 — 그 말이
 * 발송 시점의 언어로 저장돼 있다는 사실도 화면에 적지 않는다(늘 참인데 할 조치가 없다).
 *
 * ⚠ **기간은 풀 수 없는 조건이라 「지우세요」로 읽히면 안 된다.** 사유 문구는 전부 **고쳐서
 * 다시 고르는** 길만 말한다.
 */
export const notificationCenter: Translated<typeof ko.notificationCenter> = {
  title: 'Trung tâm thông báo',
  breadcrumbRoot: 'Thông báo',
  panes: {
    list: 'Danh sách thông báo',
  },
  loading: {
    list: 'Đang tải thông báo',
  },
  fields: {
    period: 'Khoảng tra cứu',
    unreadOnly: 'Chỉ chưa xem',
    eventCode: 'Loại thông báo',
  },
  filters: {
    all: 'Tất cả',
    eventsFailed: 'Không tải được danh sách loại thông báo. Không thể lọc theo loại.',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    markAllRead: 'Đánh dấu tất cả đã xem',
    /**
     * ⚠ **보이는 글자(`openTargetShort`)를 그대로 품는다.** 담지 않으면 음성 조작이 보이는
     * 글자로 이 링크를 부를 수 없다 — 줄마다 글자가 같아 가르는 짐을 이 이름이 진다.
     */
    openTarget: (targetTitle: string): string => `Đi đến đối tượng ${targetTitle}`,
    openTargetShort: 'Đi đến',
  },
  /** 비활성 사유는 **그 컨트롤의 이름으로 시작한다**(공유계약 G-3). 옮긴 말에서도 앞머리를 지킨다. */
  actionReasons: {
    nothingUnread: 'Đánh dấu tất cả đã xem chỉ dùng được khi có thông báo chưa xem.',
    markingAllRead: 'Đánh dấu tất cả đã xem đang chờ phản hồi. Có phản hồi rồi thì dùng lại được.',
  },
  toast: {
    allRead: (count: number): string => `Đã chuyển ${String(count)} mục sang đã xem`,
  },
  writeError: {
    readTitle: 'Không chuyển được sang đã xem',
    allReadTitle: 'Không chuyển được tất cả sang đã xem',
    /**
     * ⭐ **쓰기는 됐다.** 「못 바꿨다」로 옮기면 거짓이 된다 — 서버는 이미 바꿨고 다시 눌러도
     * 아무 일도 일어나지 않는다. 할 수 있는 일(다시 조회)만 말한다.
     */
    readFeedbackTitle: 'Đã chuyển sang đã xem nhưng chưa phản ánh lên màn hình',
    allReadFeedbackTitle: 'Đã chuyển tất cả sang đã xem nhưng chưa phản ánh lên màn hình',
    feedbackDescription: 'Tra cứu lại khoảng thời gian thì sẽ thấy trạng thái mới nhất.',
    notFound: 'Không tìm thấy thông báo đó. Hãy tra cứu lại khoảng thời gian.',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
  },
  asOf: (at: string): string => `Cơ sở ${at}`,
  reasons: {
    /** ⛔ 「날짜가 틀렸다」로 뭉개지 않는다 — **비어 있는 쪽만** 가리킨다. */
    periodIncomplete:
      'Khoảng thời gian phải có cả ngày bắt đầu và ngày kết thúc. Hãy chọn bên đang trống.',
    periodInvalid:
      'Khoảng thời gian không phải ngày hợp lệ. Hãy chọn lại ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Ngày kết thúc không được đứng trước ngày bắt đầu.',
  },
  empty: {
    blockedTitle: 'Không tra cứu được với khoảng thời gian này',
    noneTitle: 'Chưa nhận thông báo nào',
    noneDescription:
      'Hãy nới khoảng thời gian hoặc bỏ điều kiện «Chỉ chưa xem» · loại rồi tìm lại.',
    beyondLastTitle: 'Trang này không có thông báo',
    beyondLastDescription: 'Kết quả nằm ở trang trước. Hãy về trang đầu.',
  },
  card: {
    read: 'Đã xem',
    unread: 'Chưa xem',
    emptyMessage: 'Thông báo không có nội dung.',
  },
};
