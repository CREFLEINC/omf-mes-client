import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * 코드 수정이 잠긴 사유. 건수를 셀 수 없으면 건수를 지어내지 않고 사유만 밝힌다 -
 * 그 성질이 문장 모양에 들어 있어, 옮길 때도 셋을 한 문장으로 합치지 않는다.
 */
export const editability: Translated<typeof ko.editability> = {
  referenced: (count: number | null): string =>
    count === null
      ? 'Dữ liệu khác đang dùng mã này nên không đổi được.'
      : `Có ${count} nơi đang dùng mã này nên không đổi được.`,
  notCountable: (_count: number | null): string =>
    'Không xác định được có bao nhiêu dữ liệu tham chiếu mã này nên mã bị khóa. Cần thay đổi thì hãy hỏi người phụ trách.',
  receivedFromErp: (_count: number | null): string =>
    'Đây là dữ liệu nhận từ hệ thống ngoài nên không sửa được ở đây. Hãy sửa ở hệ thống gốc.',
  labelIssued: (_count: number | null): string =>
    'Nhãn phát hành bằng mã này đã ra hiện trường nên không đổi được mã. Cần thay đổi thì hãy hỏi người phụ trách.',
  systemOwned: (_count: number | null): string =>
    'Nhóm mã này do hệ thống quản lý nên không sửa được. Cần thay đổi thì hãy hỏi người phụ trách.',
  locked: 'Hiện không đổi được mã. Cần thay đổi thì hãy hỏi người phụ trách.',
};
