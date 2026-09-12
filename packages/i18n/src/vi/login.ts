import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-01 계정 로그인.
 *
 * ⛔ **어느 칸이 틀렸는지 지목하지 않는다.** 원문이 세 갈래(아이디만·비밀번호만·둘 다)에 같은
 * 문장을 쓰는 것은 「그 아이디는 있다」를 흘리지 않으려는 규율이다 - 옮기면서 한쪽 칸을
 * 지목하는 말로 풀면 그 규율이 베트남어 화면에서만 사라진다.
 */
export const login: Translated<typeof ko.login> = {
  title: 'Đăng nhập',
  fields: {
    loginId: 'Tên đăng nhập',
    password: 'Mật khẩu',
  },
  actions: {
    submit: 'Đăng nhập',
  },
  actionReasons: {
    incomplete: 'Nhập đủ tên đăng nhập và mật khẩu thì mới dùng được nút Đăng nhập.',
    submitting: 'Đăng nhập đang chờ phản hồi. Có phản hồi rồi thì dùng lại được.',
  },
  banner: {
    credentialsTitle: 'Sai thông tin đăng nhập',
    credentials: 'Tên đăng nhập hoặc mật khẩu không đúng. Hãy kiểm tra lại.',
    lockedTitle: 'Tài khoản bị khóa',
    locked: 'Tài khoản đã bị khóa. Hãy yêu cầu quản trị viên đặt lại mật khẩu.',
    serverTitle: 'Lỗi máy chủ',
    server:
      'Máy chủ không xử lý được đăng nhập. Hãy thử lại sau, nếu vẫn vậy thì báo cho quản trị viên.',
  },
};
