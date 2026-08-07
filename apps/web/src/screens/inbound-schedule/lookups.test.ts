import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { describeReference, toReference, type ReferenceSource } from './lookups';

const t = messages.inboundSchedule;

/**
 * 참조 값 표기의 **세 갈래 판정**. 이 판정이 하나로 뭉개지면 #47이 그대로 되살아난다 —
 * 본 자료가 참조 목록보다 먼저 도착하는 순간 정상 값이 「알 수 없음」으로 보이고,
 * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자에게 반대로 읽힌다.
 */

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '8101', label: '합성 공급사 가', isActive: true }],
  isError: false,
  isLoading: false,
  ...overrides,
});

describe('toReference', () => {
  it('목록에 있으면 이름으로 푼다', () => {
    expect(toReference(source(), 8101)).toEqual({ kind: 'named', label: '합성 공급사 가' });
  });

  /* 목록은 왔는데 그 안에 없다 — **값이 잘못됐다**는 신호다. */
  it('목록에 없으면 알 수 없음이다', () => {
    expect(toReference(source(), 8102)).toEqual({ kind: 'unknown' });
  });

  /* 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다(#47). */
  it('목록이 아직 오지 않았으면 로딩이다 — 알 수 없음이 아니다', () => {
    expect(toReference(source({ entries: [], isLoading: true }), 8101)).toEqual({
      kind: 'loading',
    });
  });

  /* 실패는 「값이 없다」와 다르다 — 사용자가 할 조치(다시 시도)가 갈린다. */
  it('목록 조회가 실패했으면 실패다', () => {
    expect(toReference(source({ entries: [], isError: true }), 8101)).toEqual({ kind: 'failed' });
  });

  /* 실패한 채로 재조회 중일 수 있다. 그때도 실패가 앞선다 — 사유를 감추면 안 된다. */
  it('실패와 로딩이 겹치면 실패가 앞선다', () => {
    expect(toReference(source({ isError: true, isLoading: true }), 8101)).toEqual({
      kind: 'failed',
    });
  });

  it('가리키는 번호가 없으면 알 수 없음이다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
    expect(toReference(source(), undefined)).toEqual({ kind: 'unknown' });
  });

  /*
   * **갈래의 순서를 고정한다.** 지금 도달 가능한 호출부에서는 이 조합이 생기지 않는다 —
   * 표가 쓰는 참조 FK 넷이 계약에서 전부 필수이고, 조건 칩은 값이 없으면 칩 자체를 만들지 않는다.
   *
   * 그래도 고정하는 이유는 이 순서가 **주석이 불변식으로 서술한 것**이기 때문이다.
   * 계약이 FK 하나를 nullable로 바꾸는 순간 「목록에 없음」 판정이 실패·미도착을 덮어
   * #47이 조용히 되살아나고, 그때 이 순서를 지키는 것이 아무것도 없게 된다.
   */
  it('가리키는 번호가 없어도 실패가 앞선다', () => {
    expect(toReference(source({ entries: [], isError: true }), null)).toEqual({ kind: 'failed' });
  });

  it('가리키는 번호가 없어도 미도착이 앞선다', () => {
    expect(toReference(source({ entries: [], isLoading: true }), null)).toEqual({
      kind: 'loading',
    });
  });

  /*
   * **어느 갈래에서도 번호를 결과에 담지 않는다**(#44). 이름으로 풀 수 없을 때
   * 낼 것이 번호밖에 없다는 이유로 번호를 내면, 사용자가 쓸 수 없는 값이 자료로 읽힌다.
   */
  it.each([
    ['목록에 없음', source(), 8102],
    ['미도착', source({ entries: [], isLoading: true }), 8102],
    ['실패', source({ entries: [], isError: true }), 8102],
  ] as const)('%s일 때도 번호를 결과에 담지 않는다', (_name, given, id) => {
    expect(JSON.stringify(toReference(given, id))).not.toContain('8102');
  });
});

describe('describeReference', () => {
  it('갈래마다 서로 다른 문구를 낸다', () => {
    const texts = [
      describeReference({ kind: 'named', label: '합성 공급사 가' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(texts).toEqual([
      '합성 공급사 가',
      t.values.unknown,
      t.values.referenceLoading,
      t.values.referenceFailed,
    ]);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
