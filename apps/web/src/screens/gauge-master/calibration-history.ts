import { messages } from '@omf-mes/i18n';

/**
 * 이력 목록이 전부인지 아닌지 한 줄. **모르면 모른다고 말한다**(공유계약 G-9).
 *
 * 계약이 전체 건수를 **선택**으로 두었다. 그래서 세 갈래가 있다:
 *
 * | 사태 | 무엇을 말하나 |
 * | --- | --- |
 * | 전체 건수를 알고 더 있다 | 몇 건 중 몇 건인지 |
 * | 전체 건수를 모르는데 **한 쪽이 꽉 찼다** | 더 있을 수 있다 |
 * | 그 밖 | 아무 말도 하지 않는다 — 다 보이고 있다 |
 *
 * ⛔ **꽉 찬 쪽을 「다 받았다」로 읽지 않는다.** 받은 수가 요청한 수와 같으면 그다음이
 * 있는지 없는지 이 응답만으로는 알 수 없고, 침묵하면 사용자는 **이력이 이게 전부라고 믿는다.**
 */
export const historyLimitNote = (
  shown: number,
  totalCount: number | null,
  pageSize: number,
): string | null => {
  if (totalCount !== null) {
    return totalCount > shown ? messages.gaugeMaster.history.truncated(shown, totalCount) : null;
  }

  return shown >= pageSize ? messages.gaugeMaster.history.mayHaveMore(shown) : null;
};
