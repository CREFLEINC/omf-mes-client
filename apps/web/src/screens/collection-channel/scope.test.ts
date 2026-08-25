import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { asScopeId, hasScope, scopeLines, scopeText } from './scope';
import type { CollectionChannel } from './types';

const t = messages.collectionChannel.scope;

const channel = (overrides: Partial<CollectionChannel> = {}): CollectionChannel => ({
  collectionChannelId: 8001,
  equipmentId: 3001,
  channelKey: 'BARREL_TEMP',
  isActive: true,
  ...overrides,
});

describe('조건이 걸렸는가', () => {
  it('아무 축도 없으면 걸리지 않았다', () => {
    expect(hasScope(channel())).toBe(false);
  });

  it('품목만 있어도 걸린 것이다', () => {
    expect(hasScope(channel({ itemId: 21 }))).toBe(true);
  });

  it('공정만 있어도 걸린 것이다', () => {
    expect(hasScope(channel({ processId: 31 }))).toBe(true);
  });

  /** ⭐ 계약이 `null` 로도 안 옴으로도 「없음」을 말한다 — 둘을 같게 읽는다. */
  it('명시적 null은 없는 것과 같다', () => {
    expect(hasScope(channel({ itemId: null, processId: null }))).toBe(false);
  });
});

describe('조건을 한 줄로', () => {
  /**
   * ⛔ **빈 칸이 아니라 「전체」다.** 비워 두면 설정을 빠뜨린 것으로 읽히지만
   * 실제로는 **언제나 적용된다**는 뜻이다.
   */
  it('아무 축도 없으면 「전체」다', () => {
    expect(scopeText(channel())).toBe(t.all);
  });

  it('품목은 축 이름과 함께 적는다', () => {
    expect(scopeText(channel({ itemId: 21, itemCode: 'ITM-201' }))).toBe(
      t.entry(t.item, 'ITM-201'),
    );
  });

  it('공정도 축 이름과 함께 적는다', () => {
    expect(scopeText(channel({ processId: 31, processCode: 'PRC-301' }))).toBe(
      t.entry(t.process, 'PRC-301'),
    );
  });

  it('둘 다 있으면 이어 붙인다', () => {
    const text = scopeText(
      channel({ itemId: 21, itemCode: 'ITM-201', processId: 31, processCode: 'PRC-301' }),
    );

    expect(text).toBe(`${t.entry(t.item, 'ITM-201')}${t.join}${t.entry(t.process, 'PRC-301')}`);
  });

  /**
   * ⛔ **표시용 코드가 없으면 지어내지 않는다**(공유계약 G-9) — 상태만 남기고
   * 「지정돼 있다」는 사실은 지키되, 「전체」로 뭉개지 않는다.
   */
  it('코드가 오지 않으면 알 수 없음으로 적고 「전체」로 뭉개지 않는다', () => {
    const text = scopeText(channel({ itemId: 21 }));

    expect(text).toBe(t.entry(t.item, messages.common.reference.unknown));
    expect(text).not.toContain('21');
    expect(text).not.toBe(t.all);
  });

  /**
   * ⛔ **축 이음쇠가 값 이름 «안»의 것과 갈려야 한다** — 코드가 「ABC · 이름」 꼴로 와도
   * 축 경계가 사라지지 않아야 한다.
   */
  it('축 이음쇠는 값 이름 안의 쇠와 다르다', () => {
    expect(t.join.trim()).not.toBe('·');
  });
});

/**
 * ⛔ **좁은 칸에서 코드가 제 안에서 접히면 다른 코드로 읽힌다** — 브라우저는 하이픈 뒤에서
 * 기꺼이 접어 「ITM-」 / 「201」 로 갈라 놓는다. 축마다 한 줄이면 접힐 자리가 축 사이다.
 */
describe('조건을 줄 단위로', () => {
  it('조건이 없으면 「전체」 한 줄이다', () => {
    expect(scopeLines(channel())).toEqual([t.all]);
  });

  it('축마다 한 줄이다', () => {
    expect(
      scopeLines(
        channel({ itemId: 21, itemCode: 'ITM-201', processId: 31, processCode: 'PRC-301' }),
      ),
    ).toEqual([t.entry(t.item, 'ITM-201'), t.entry(t.process, 'PRC-301')]);
  });

  /** 두 형태가 같은 것을 말해야 한다 — 한쪽만 고치면 표와 보조기술이 갈린다. */
  it('한 줄 형태와 같은 것을 말한다', () => {
    const scoped = channel({ itemId: 21, itemCode: 'ITM-201' });

    expect(scopeLines(scoped).join(t.join)).toBe(scopeText(scoped));
  });
});

describe('고른 조건을 식별자로', () => {
  it('고른 값을 그대로 읽는다', () => {
    expect(asScopeId('21')).toBe(21);
  });

  /**
   * ⛔ **`Number('')` 는 `0` 이다.** 「전체」로 되돌린 순간 있지도 않은 0번으로 좁혀진
   * 매핑이 나가고 유일 범위가 조용히 달라진다.
   */
  it('빈 값은 0이 아니라 「전체」다', () => {
    expect(asScopeId('')).toBeNull();
  });

  /** ⛔ 유일 범위를 이루는 값이다 — 읽을 수 없는 것을 내보내면 서버가 견줄 수 없다. */
  it('읽을 수 없는 값은 내보내지 않는다', () => {
    expect(asScopeId('알 수 없음')).toBeNull();
  });

  it('소수·음수·0은 식별자가 아니다', () => {
    expect(asScopeId('2.5')).toBeNull();
    expect(asScopeId('-3')).toBeNull();
    expect(asScopeId('0')).toBeNull();
  });
});
