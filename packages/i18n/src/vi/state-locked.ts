import type { ko } from '../ko';
import type { Translated } from './translated';

/** 다시 불러와도 풀리지 않는 상태 - 「다시 시도」를 권하는 말로 옮기지 않는다. */
export const stateLocked: Translated<typeof ko.stateLocked> = {
  title: 'Trạng thái hiện tại không cho phép lưu',
  description:
    'Trạng thái hiện tại của mục này không cho phép thay đổi. Hãy kiểm tra trạng thái trước.',
};
