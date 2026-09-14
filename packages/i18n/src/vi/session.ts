import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * 로그인 상태를 지키는 겹의 문구.
 *
 * ⛔ **「로그인하세요」로 옮기지 않는다.** 이 파일이 말하는 상대는 **판정을 못 한 사람**이지
 * 미인증으로 판정된 사람이 아니다 - 자격을 다시 넣으라고 하면 서버가 흔들릴 때마다 맞는
 * 자격을 다시 치게 된다.
 */
export const session: Translated<typeof ko.session> = {
  restoring: 'Đang kiểm tra trạng thái đăng nhập.',
  unknown: {
    title: 'Không kiểm tra được trạng thái đăng nhập',
    body: 'Không kết nối được máy chủ nên chưa rõ hiện có đang đăng nhập hay không. Hãy thử lại sau.',
    retry: 'Thử lại',
  },
  actions: {
    signOut: 'Đăng xuất',
  },
  signOutFailure: {
    title: 'Chưa đăng xuất được',
    body: 'Vẫn đang ở trạng thái đăng nhập. Hãy thử lại.',
  },
};
