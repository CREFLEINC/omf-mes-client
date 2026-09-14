import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-10 비밀번호 변경 — **로그인과 반대 규율이 걸리는 자리다.**
 *
 * 로그인(`vi/login.ts`)은 어느 칸이 틀렸는지 지목하지 않는다. 여기서는 **지목한다** — 이미
 * 인증된 본인만 보는 화면이라 흘릴 것이 없고, 어디를 고쳐야 하는지 말하지 않으면 못 고친다.
 *
 * ⛔ **없는 규칙을 옮기다 만들지 않는다.** 글자 종류 규칙이 없다는 사실을 적되 **그 종류를
 * 이름으로 부르지 않는다** — 부정문이어도 그 낱말들이 화면에 서면 빨리 읽는 사람에게는
 * 규칙 목록으로 보인다.
 *
 * ⭐ **응답이 오지 않은 갈래에 「못 바꿨다」고 단언하지 않는다.** 되돌릴 수 없는 쓰기라
 * 「응답을 못 받았다」와 「적용되지 않았다」가 같지 않다.
 */
export const passwordChange: Translated<typeof ko.passwordChange> = {
  title: 'Đổi mật khẩu',
  breadcrumbRoot: 'Quản trị hệ thống',
  fields: {
    currentPassword: 'Mật khẩu hiện tại',
    newPassword: 'Mật khẩu mới',
    confirmPassword: 'Xác nhận mật khẩu mới',
  },
  /** ⚠ 최소 길이는 **주입받는다** — 숫자를 문장에 손으로 적으면 상수만 바뀌고 문구가 남는다. */
  notice: (minLength: number): string =>
    `Phải dài từ ${String(minLength)} ký tự trở lên và phải khác mật khẩu hiện tại. Không có quy tắc bắt buộc trộn nhiều loại ký tự.`,
  actions: {
    submit: 'Đổi',
  },
  /** 이동도 재로그인도 없으므로 이 한 줄이 **유일한 성공 신호**다 — 공용 「저장했습니다」를 쓰지 않는다. */
  toast: {
    changed: 'Đã đổi mật khẩu. Từ lần đăng nhập sau hãy dùng mật khẩu mới.',
  },
  banner: {
    failureTitle: 'Không đổi được mật khẩu',
    /** ⭐ 제목이 먼저 읽힌다 — 여기서 실패를 단언하면 본문의 「이미 바뀌었을 수 있다」가 진다. */
    unconfirmedTitle: 'Chưa xác nhận được mật khẩu đã đổi hay chưa',
    networkUnconfirmed:
      'Không có phản hồi nên chưa xác nhận được là đã đổi hay chưa. Có thể đã đổi rồi — thử lại cũng là cùng một yêu cầu nên không áp dụng hai lần.',
  },
  actionReasons: {
    incomplete:
      'Đổi chỉ dùng được khi đã nhập đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới.',
    submitting: 'Đổi đang chờ phản hồi. Có phản hồi rồi thì dùng lại được.',
    /** 무엇이 깨졌는지 되풀이하지 않는다 — 그것은 이미 그 칸 옆에 서 있다. */
    invalid: 'Đổi dùng được khi đã sửa các lỗi hiện ở từng ô.',
  },
  validation: {
    tooShort: (minLength: number): string =>
      `Mật khẩu mới phải dài từ ${String(minLength)} ký tự trở lên.`,
    sameAsCurrent: 'Mật khẩu mới trùng với mật khẩu hiện tại. Hãy nhập giá trị khác.',
    /** ⚠ 두 칸에 함께 선다 — 어느 한쪽이 틀렸다고 말하지 않고 **두 값이 다르다**고만 말한다. */
    confirmMismatch: 'Mật khẩu mới và giá trị xác nhận khác nhau.',
    /** ⛔ 몇 번 틀렸는지도 몇 번 더 되는지도 말하지 않는다 — 이 화면은 계정을 잠그지 않는다. */
    currentMismatch: 'Mật khẩu hiện tại không đúng.',
  },
};
