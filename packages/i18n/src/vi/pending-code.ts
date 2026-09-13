import type { ko } from '../ko';
import type { Translated } from './translated';

/** 값 목록이 확정되지 않은 선택지에 붙인다. 값을 지어내지 않는다. */
export const pendingCode: Translated<typeof ko.pendingCode> = {
  note: 'Đang chuẩn bị lựa chọn. Khi danh sách mã được chốt thì mục này sẽ chọn được.',
  placeholder: 'Đang chuẩn bị lựa chọn',
};
