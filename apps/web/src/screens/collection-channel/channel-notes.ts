import { messages } from '@omf-mes/i18n';

import type { ChannelFilters, CollectionChannel } from './types';

/**
 * 채널 목록을 읽을 때 화면이 스스로 도출하는 것들.
 *
 * ⭐ **서버가 세어 주지 않는다** — 미매핑 건수도, 미매핑만 보기도 계약에 없다. 그래서 여기서
 * 세고 여기서 거른다. 그 대가로 **잘리면 반쪽이 된다**는 사실을 함께 말해야 한다.
 */

/**
 * 대상 검사 항목이 없는 채널인가.
 *
 * ⚠ **계약이 이 필드를 「선택이면서 널 허용」으로 두었다** — 값이 오지 않는 것과 `null` 이
 * 오는 것 둘 다 가능하다. 여기서는 **둘을 같은 것으로 본다.**
 *
 * 공유계약 G-9(모르는 값과 없는 값을 다르게)를 어기는 것처럼 보이지만 그렇지 않다. 「모른다」로
 * 갈라 두려면 그 상태를 «해소할 길»이 있어야 하는데, 계약에는 이 값을 되찾을 단건 조회가 없다.
 * 해소할 수 없는 셋째 상태를 만들면 화면은 「모릅니다」를 영원히 띄우게 되고, 사용자는 무엇을
 * 해야 할지 알 수 없다. **연결되지 않았다면 값은 버려진다** — 그 결과는 두 경우에 같다.
 */
export const isUnmapped = (channel: CollectionChannel): boolean =>
  channel.inspectionItemId === undefined || channel.inspectionItemId === null;

/** 대상 검사 항목이 없는 채널의 수. 0이면 요약을 세우지 않는다. */
export const countUnmapped = (channels: readonly CollectionChannel[]): number =>
  channels.filter(isUnmapped).length;

/**
 * 조건을 적용한 뒤 표에 설 채널.
 *
 * ⛔ **미사용 조건을 여기서 한 번 더 걸지 않는다** — 그것은 서버가 이미 걸었다. 두 곳에서
 * 걸면 서버가 규칙을 바꿨을 때 화면이 조용히 옛 규칙을 덮어써 어긋난 결과를 보인다.
 */
export const visibleChannels = (
  channels: readonly CollectionChannel[],
  filters: ChannelFilters,
): CollectionChannel[] => (filters.unmappedOnly ? channels.filter(isUnmapped) : [...channels]);

/**
 * 목록이 전부인지 아닌지 한 줄. **모르면 모른다고 말한다**(공유계약 G-9).
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
 * 있는지 없는지 이 응답만으로는 알 수 없고, 침묵하면 사용자는 이게 전부라고 믿는다.
 */
export const channelLimitNote = (
  shown: number,
  totalCount: number | null,
  pageSize: number,
): string | null => {
  if (totalCount !== null) {
    return totalCount > shown
      ? messages.collectionChannel.channels.listTruncated(shown, totalCount)
      : null;
  }

  return shown >= pageSize ? messages.collectionChannel.channels.mayHaveMore(shown) : null;
};

/**
 * 미매핑 조건이 반쪽만 걸린다는 경고.
 *
 * ⭐ **조건을 켰고 목록이 잘렸을 때만** 선다. 조건을 걸지 않았으면 반쪽이 될 것이 없고,
 * 잘리지 않았으면 화면이 가진 것이 전부라 조건이 온전히 걸린다.
 */
export const unmappedScopeNote = (
  unmappedOnly: boolean,
  limitNote: string | null,
): string | null =>
  unmappedOnly && limitNote !== null
    ? messages.collectionChannel.channels.unmappedOnLoadedOnly
    : null;
