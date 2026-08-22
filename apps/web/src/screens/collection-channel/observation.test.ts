import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { makeObservation, observationItems } from './fixtures';
import {
  failedLine,
  formatObservedAt,
  isAlreadyMapped,
  isSelectable,
  orNotRecorded,
  retainSelectable,
  summarize,
  toggleSelected,
} from './observation';

const t = messages.collectionChannel.importLog;

describe('이미 이어 둔 신호', () => {
  it('참으로 오면 이미 등록된 것이다', () => {
    expect(isAlreadyMapped(makeObservation('A', { alreadyMapped: true }))).toBe(true);
  });

  it('거짓으로 오면 아직 아니다', () => {
    expect(isAlreadyMapped(makeObservation('A', { alreadyMapped: false }))).toBe(false);
  });

  /** 값이 오지 않으면 아직 아닌 것으로 본다 — 고를 수 있어야 이 창이 쓸모가 있다. */
  it('값이 오지 않으면 아직 아닌 것으로 본다', () => {
    expect(isAlreadyMapped(makeObservation('A'))).toBe(false);
  });

  /** ⛔ 감추지 않는다 — 보이되 고르지 못하게 한다(공유계약 G-2). */
  it('이미 등록된 것은 고를 수 없다', () => {
    expect(isSelectable(makeObservation('A', { alreadyMapped: true }))).toBe(false);
    expect(isSelectable(makeObservation('A'))).toBe(true);
  });
});

describe('고르기', () => {
  it('안 골랐으면 고른 것이 된다', () => {
    expect(toggleSelected([], makeObservation('A'))).toEqual(['A']);
  });

  it('골랐으면 풀린다', () => {
    expect(toggleSelected(['A', 'B'], makeObservation('A'))).toEqual(['B']);
  });

  /** ⛔ 고를 수 없는 것을 고르지 않는다 — 눌러도 아무 일도 없는 것이 옳다. */
  it('이미 등록된 것은 골라지지 않는다', () => {
    expect(toggleSelected([], makeObservation('A', { alreadyMapped: true }))).toEqual([]);
  });

  it('원본 배열을 제자리에서 바꾸지 않는다', () => {
    const source = ['A'];

    toggleSelected(source, makeObservation('B'));

    expect(source).toEqual(['A']);
  });
});

/**
 * ⛔ **화면에 보이지 않는 것이 저장 대상에 남지 않는다.** 조건을 껐다 켜는 사이에 사라진
 * 신호를 그대로 들고 있으면 사용자는 무엇이 만들어질지 알 수 없다.
 */
describe('목록이 바뀌었을 때 고른 것', () => {
  it('아직 고를 수 있는 것만 남는다', () => {
    expect(retainSelectable(['SCREW_RPM', 'GONE'], observationItems)).toEqual(['SCREW_RPM']);
  });

  it('이미 등록된 것으로 바뀌었으면 거둔다', () => {
    expect(retainSelectable(['CYCLE_TIME'], observationItems)).toEqual([]);
  });

  it('목록이 비면 고른 것도 비운다', () => {
    expect(retainSelectable(['SCREW_RPM'], [])).toEqual([]);
  });
});

/**
 * ⛔ **성공 건수만 말하지 않는다.** 계약에 일괄 등록이 없어 한 건씩 나가고,
 * **일부만 되는 것이 정상**이다. 실패한 줄을 이름과 사유째로 남겨야 다음 행동을 정할 수 있다.
 */
describe('보낸 결과 요약', () => {
  it('전부 되면 실패가 없다', () => {
    const summary = summarize([
      { channelKey: 'A', reason: null },
      { channelKey: 'B', reason: null },
    ]);

    expect(summary).toEqual({ createdCount: 2, failed: [] });
  });

  it('일부만 되면 된 수와 못 된 줄을 함께 낸다', () => {
    const summary = summarize([
      { channelKey: 'A', reason: null },
      { channelKey: 'B', reason: '이미 있습니다.' },
    ]);

    expect(summary.createdCount).toBe(1);
    expect(summary.failed).toEqual([{ channelKey: 'B', reason: '이미 있습니다.' }]);
  });

  it('전부 실패하면 된 것이 0이다', () => {
    expect(summarize([{ channelKey: 'A', reason: '거부' }]).createdCount).toBe(0);
  });
});

describe('실패한 줄 그리기', () => {
  it('이름과 사유를 함께 낸다', () => {
    expect(failedLine({ channelKey: 'A', reason: '이미 있습니다.' })).toBe(
      t.failedRow('A', '이미 있습니다.'),
    );
  });

  /** ⛔ 사유를 지어내지 않는다 — 얻지 못했으면 그 사실을 밝힌다. */
  it('사유를 얻지 못했으면 그렇게 말한다', () => {
    expect(failedLine({ channelKey: 'A', reason: null })).toBe(t.failedRow('A', t.unknownReason));
  });
});

describe('값이 없는 칸', () => {
  it('오지 않으면 기록 없음이다', () => {
    expect(orNotRecorded(undefined)).toBe(t.notRecorded);
  });

  it('빈 문자열도 기록 없음이다', () => {
    expect(orNotRecorded('')).toBe(t.notRecorded);
  });

  it('값이 있으면 그대로 세운다', () => {
    expect(orNotRecorded('182.4')).toBe('182.4');
  });
});

/**
 * ⛔ **보는 사람의 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 **그 설비가 있는 곳**의
 * 시각이고, 옮기면 같은 신호가 사람마다 다른 시각으로 보인다.
 */
describe('받은 시각 표기', () => {
  it('날짜와 시·분만 남긴다', () => {
    expect(formatObservedAt('2026-08-22T09:40:12+07:00')).toBe('2026-08-22 09:40');
  });

  it('offset이 달라도 옮기지 않는다', () => {
    expect(formatObservedAt('2026-08-22T09:40:12+09:00')).toBe('2026-08-22 09:40');
    expect(formatObservedAt('2026-08-22T09:40:12Z')).toBe('2026-08-22 09:40');
  });

  /** ⛔ 못 알아본 값을 「—」로 바꾸지 않는다 — 없는 것과 구분되지 않는다(G-9). */
  it('형식이 아니면 원문을 그대로 낸다', () => {
    expect(formatObservedAt('알 수 없는 값')).toBe('알 수 없는 값');
    expect(formatObservedAt('')).toBe('');
  });
});
