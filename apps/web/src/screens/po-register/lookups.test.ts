import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  describeReference,
  lookupNote,
  toReference,
  type LookupResult,
  type ReferenceSource,
} from './lookups';

const t = messages.poRegister;

/**
 * 참조 표기와 선택지 안내 — **순수 함수 층**이다.
 *
 * 화면 시험은 정상·실패 갈래만 스친다. 나머지 갈래(미도착·목록에 없음·잘림)와 **갈래 사이의
 * 우선순위**는 여기서 잰다 — 우선순위가 뒤집히면 화면에는 그럴듯한 문구가 서고 아무 감지기도
 * 울지 않는다.
 */

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9501', label: 'SAMPLE-ITEM-01 · 합성 품목 가', isActive: true }],
  isError: false,
  isLoading: false,
  ...overrides,
});

const result = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  ...source(),
  entries: [...source().entries],
  truncated: false,
  refetch: () => undefined,
  ...overrides,
});

describe('toReference — 참조 하나를 표기 상태로 옮긴다', () => {
  it('목록에 있으면 이름으로 푼다', () => {
    expect(toReference(source(), 9501)).toEqual({
      kind: 'named',
      label: 'SAMPLE-ITEM-01 · 합성 품목 가',
    });
  });

  /*
   * 본 자료가 참조 목록보다 먼저 오는 순간이 실제로 있다(`omf-mes#47`).
   * 그때 「목록에 없다」로 판정하면 정상 값에 *값이 잘못됐다*는 표를 붙이는 셈이다.
   */
  it('아직 오지 않은 것을 「목록에 없음」으로 판정하지 않는다', () => {
    expect(toReference(source({ isLoading: true, entries: [] }), 9501)).toEqual({
      kind: 'loading',
    });
  });

  it('불러오기에 실패한 것도 「목록에 없음」과 갈린다', () => {
    expect(toReference(source({ isError: true, entries: [] }), 9501)).toEqual({ kind: 'failed' });
  });

  /* 실패와 미도착이 「목록에 없음」보다 앞선다 — 순서가 뜻을 정한다. */
  it('실패가 미도착보다 앞선다', () => {
    expect(toReference(source({ isError: true, isLoading: true }), 9501)).toEqual({
      kind: 'failed',
    });
  });

  /**
   * **픽스처가 일부러 만든 갈래를 재는 자리다.** 참조 목록에서 품목 9502를 빼 둔 이유가
   * 이 판정이고, 재지 않으면 그 픽스처가 무엇을 위한 것인지 코드에 남지 않는다.
   */
  it('목록은 왔는데 그 안에 없으면 알 수 없는 값이다', () => {
    expect(toReference(source(), 9502)).toEqual({ kind: 'unknown' });
  });

  it('가리키는 번호가 없어도 알 수 없는 값이다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
    expect(toReference(source(), undefined)).toEqual({ kind: 'unknown' });
  });

  /*
   * **어느 갈래에도 번호를 담지 않는다**(`omf-mes#44`).
   * 담을 자리가 없으면 그 값이 화면으로 샐 경로도 없다.
   */
  it('어느 갈래에도 내부 번호를 담지 않는다', () => {
    const states = [
      toReference(source(), 9501),
      toReference(source(), 9502),
      toReference(source({ isLoading: true }), 9502),
      toReference(source({ isError: true }), 9502),
    ];

    for (const state of states) {
      expect(JSON.stringify(state)).not.toContain('9502');
    }

    // 짝 방향 — 풀리는 갈래는 실제로 이름을 담는다(아무것도 안 담아도 통과하지 않게 한다).
    expect(states[0]).toEqual({ kind: 'named', label: 'SAMPLE-ITEM-01 · 합성 품목 가' });
  });
});

describe('describeReference — 네 갈래의 문구가 서로 다르다', () => {
  it('갈래마다 다른 문구를 낸다', () => {
    const texts = [
      describeReference({ kind: 'named', label: '합성 품목 가' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(texts).toEqual([
      '합성 품목 가',
      t.values.unknown,
      t.values.referenceLoading,
      t.values.referenceFailed,
    ]);
    expect(new Set(texts).size).toBe(4);
  });
});

describe('lookupNote — 선택지의 한계를 밝힌다', () => {
  it('정상이면 붙일 안내가 없다', () => {
    expect(lookupNote(result())).toBeUndefined();
  });

  it('잘렸으면 일부만 보인다고 밝힌다', () => {
    expect(lookupNote(result({ truncated: true }))).toBe(t.lookups.truncated);
  });

  it('불러오지 못했으면 그 사실을 밝힌다', () => {
    expect(lookupNote(result({ isError: true }))).toBe(t.lookups.failed);
  });

  /**
   * **실패가 잘림보다 앞선다.** 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면 둘이 함께
   * 참이 된다. 그때 「일부만 보인다」고만 말하면 지금 목록이 **낡았다는 사실**이 가려지고,
   * 사용자는 찾는 값이 없는 이유를 「목록이 길어서」로 읽는다.
   */
  it('실패와 잘림이 겹치면 실패를 밝힌다', () => {
    expect(lookupNote(result({ truncated: true, isError: true }))).toBe(t.lookups.failed);
  });
});
