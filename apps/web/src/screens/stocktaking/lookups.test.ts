import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  describeReference,
  lookupNote,
  toReference,
  type LookupResult,
  type ReferenceSource,
} from './lookups';

const t = messages.stocktaking;

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9101', label: 'SAMPLE-WH-01 · 합성 창고 가', isActive: true }],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const lookup = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  ...source(),
  entries: [...source().entries],
  refetch: () => {
    /* 이 테스트는 다시 부르기를 검사하지 않는다 — 그 검사는 화면 수준에 있다. */
  },
  ...overrides,
});

describe('toReference', () => {
  it('목록에 있으면 이름을 준다', () => {
    expect(toReference(source(), 9101)).toEqual({
      kind: 'named',
      label: 'SAMPLE-WH-01 · 합성 창고 가',
    });
  });

  /*
   * **#47** — 본 자료가 참조 목록보다 먼저 오는 순간이 실제로 있다. 그때 「알 수 없음」을 내면
   * *값이 잘못됐다*는 뜻이 되어 사용자에게 반대로 읽힌다. 미도착은 미도착으로 낸다.
   */
  it('아직 오지 않았으면 목록에 없음과 갈라 낸다', () => {
    expect(toReference(source({ isLoading: true, entries: [] }), 9101)).toEqual({ kind: 'loading' });
  });

  /* 순서가 뜻을 정한다 — **실패·미도착이 「목록에 없음」보다 앞선다.** */
  it('실패는 미도착·목록에 없음보다 앞선다', () => {
    expect(toReference(source({ isError: true, isLoading: true, entries: [] }), 9101)).toEqual({
      kind: 'failed',
    });
  });

  it('목록은 왔는데 그 안에 없으면 목록에 없음으로 본다', () => {
    expect(toReference(source(), 9102)).toEqual({ kind: 'unknown' });
  });

  it('가리키는 번호가 없으면 목록에 없음으로 본다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
    expect(toReference(source(), undefined)).toEqual({ kind: 'unknown' });
  });

  /*
   * **#44** — 어느 갈래에도 번호가 담기지 않는다. 담을 자리가 없으면 화면으로 샐 경로도 없다.
   * 맞춰 보기 위한 `String(id)`는 결과에 남지 않는다.
   */
  it('어느 갈래에도 내부 번호를 담지 않는다', () => {
    const states = [
      toReference(source(), 9101),
      toReference(source(), 9102),
      toReference(source({ isLoading: true, entries: [] }), 9102),
      toReference(source({ isError: true, entries: [] }), 9102),
    ];

    for (const state of states) {
      expect(JSON.stringify(state)).not.toContain('9102');
    }
    /* 짝 방향 — 이름은 실제로 담긴다. 담기지 않으면 위 단언은 아무것도 안 해도 통과한다. */
    expect(JSON.stringify(states[0])).toContain('합성 창고 가');
  });
});

describe('describeReference', () => {
  /** 네 갈래의 문구가 서로 달라야 뜻이 구분된다. */
  it('네 갈래를 서로 다른 문구로 낸다', () => {
    const labels = [
      describeReference({ kind: 'named', label: '이름' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(labels).toEqual(['이름', t.values.unknown, t.values.referenceLoading, t.values.referenceFailed]);
    expect(new Set(labels).size).toBe(4);
  });
});

describe('lookupNote', () => {
  /*
   * **M12** — 목록이 앞쪽만 오면 **고를 수 없는 값이 생기는데**, 밝히지 않으면 사용자가
   * 「그런 창고가 없다」로 결론짓는다(조용한 잘림 방지 — W-01-03이 세운 규칙).
   */
  it('잘리면 그 사실을 밝힌다', () => {
    expect(lookupNote(lookup({ truncated: true }))).toBe(t.filters.lookupTruncated);
  });

  /*
   * **실패가 잘림보다 앞선다.** 둘이 겹치는 자리가 실제로 있다 — 첫 조회가 잘린 목록을 주고
   * 다시 부르기가 실패하면 낡은 자료와 실패가 함께 참이 된다.
   */
  it('실패가 잘림보다 앞선다', () => {
    expect(lookupNote(lookup({ truncated: true, isError: true }))).toBe(t.filters.lookupFailed);
  });

  it('정상이면 안내를 붙이지 않는다', () => {
    expect(lookupNote(lookup())).toBeUndefined();
  });
});
