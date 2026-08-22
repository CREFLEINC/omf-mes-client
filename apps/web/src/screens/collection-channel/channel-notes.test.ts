import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  channelLimitNote,
  countUnmapped,
  isUnmapped,
  unmappedScopeNote,
  visibleChannels,
} from './channel-notes';
import { channelItems, makeChannel } from './fixtures';
import type { ChannelFilters } from './types';

const t = messages.collectionChannel.channels;

const filters = (overrides: Partial<ChannelFilters> = {}): ChannelFilters => ({
  includeInactive: false,
  unmappedOnly: false,
  ...overrides,
});

describe('연결 여부 판정', () => {
  it('대상 검사 항목이 null 이면 미매핑이다', () => {
    expect(isUnmapped(makeChannel(1, 'A', { inspectionItemId: null }))).toBe(true);
  });

  it('대상 검사 항목 자체가 오지 않아도 미매핑이다', () => {
    expect(isUnmapped(makeChannel(1, 'A'))).toBe(true);
  });

  it('대상 검사 항목이 있으면 미매핑이 아니다', () => {
    expect(isUnmapped(makeChannel(1, 'A', { inspectionItemId: 5001 }))).toBe(false);
  });

  /** ⭐ 0은 값이다 — 거짓 같은 값을 「없음」으로 읽으면 이어 둔 항목이 미매핑으로 뒤집힌다. */
  it('대상 검사 항목이 0 이어도 연결된 것으로 본다', () => {
    expect(isUnmapped(makeChannel(1, 'A', { inspectionItemId: 0 }))).toBe(false);
  });
});

describe('미매핑 건수', () => {
  it('이어 두지 않은 채널만 센다', () => {
    expect(countUnmapped(channelItems)).toBe(2);
  });

  it('전부 이어 두었으면 0이다', () => {
    expect(countUnmapped([makeChannel(1, 'A', { inspectionItemId: 5001 })])).toBe(0);
  });

  it('빈 목록은 0이다', () => {
    expect(countUnmapped([])).toBe(0);
  });
});

describe('표에 설 채널', () => {
  it('조건을 걸지 않으면 받은 것을 그대로 세운다', () => {
    expect(visibleChannels(channelItems, filters())).toHaveLength(channelItems.length);
  });

  it('미매핑만 보기를 켜면 이어 둔 채널이 빠진다', () => {
    const rows = visibleChannels(channelItems, filters({ unmappedOnly: true }));

    expect(rows.map((row) => row.channelKey)).toEqual(['BARREL_TEMP', 'PRESS_FORCE']);
  });

  /**
   * ⛔ **미사용 조건을 화면이 한 번 더 걸지 않는다** — 그것은 서버가 이미 걸었다.
   * 두 곳에서 걸면 서버가 규칙을 바꿨을 때 화면이 조용히 옛 규칙으로 덮어쓴다.
   */
  it('미사용 포함을 껐다고 해서 받아 온 미사용 채널을 화면이 빼지 않는다', () => {
    const rows = visibleChannels([makeChannel(1, 'A', { isActive: false })], filters());

    expect(rows).toHaveLength(1);
  });

  it('원본 배열을 제자리에서 바꾸지 않는다', () => {
    const source = [...channelItems];

    visibleChannels(source, filters({ unmappedOnly: true }));

    expect(source).toEqual(channelItems);
  });
});

describe('목록이 전부인가', () => {
  it('전체 건수를 알고 더 있으면 몇 건 중 몇 건인지 말한다', () => {
    expect(channelLimitNote(3, 10, 200)).toBe(t.listTruncated(3, 10));
  });

  it('전체 건수를 알고 다 받았으면 아무 말도 하지 않는다', () => {
    expect(channelLimitNote(10, 10, 200)).toBeNull();
  });

  /** ⛔ 꽉 찬 쪽을 「다 받았다」로 읽지 않는다 — 침묵하면 이게 전부라고 믿는다. */
  it('전체 건수를 모르는데 쪽이 꽉 찼으면 더 있을 수 있다고 말한다', () => {
    expect(channelLimitNote(200, null, 200)).toBe(t.mayHaveMore(200));
  });

  it('전체 건수를 모르고 쪽이 덜 찼으면 아무 말도 하지 않는다', () => {
    expect(channelLimitNote(3, null, 200)).toBeNull();
  });
});

describe('미매핑 조건이 반쪽만 걸린다는 경고', () => {
  it('조건을 켰고 목록이 잘렸으면 선다', () => {
    expect(unmappedScopeNote(true, t.mayHaveMore(200))).toBe(t.unmappedOnLoadedOnly);
  });

  it('조건을 켰어도 목록이 온전하면 서지 않는다', () => {
    expect(unmappedScopeNote(true, null)).toBeNull();
  });

  it('목록이 잘렸어도 조건을 걸지 않았으면 서지 않는다', () => {
    expect(unmappedScopeNote(false, t.mayHaveMore(200))).toBeNull();
  });
});
