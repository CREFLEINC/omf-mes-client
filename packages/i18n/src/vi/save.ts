import type { ko } from '../ko';
import type { Translated } from './translated';

/** 저장을 서버로 보내기 전에 멈춘 경우. 사용자가 다시 시도하면 풀린다. */
export const save: Translated<typeof ko.save> = {
  staleToken: 'Đang tải thông tin mới nhất. Lát nữa hãy lưu lại.',
};
