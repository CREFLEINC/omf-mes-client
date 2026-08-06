import { describe, expect, it } from 'vitest';

import { messageRow } from './fixtures';
import { KNOWN_STATUS, formatDateTime, formatTime, toStatusView } from './message-status';

/** availableAt이 과거인지 미래인지는 이 기준 시각으로만 판정한다. */
const NOW = new Date('2026-08-06T12:00:00+09:00');

describe('toStatusView — 상태 칩', () => {
  it('확인된 실패 코드는 오류 색과 화면 문구로 낸다', () => {
    const view = toStatusView(messageRow({ statusCode: KNOWN_STATUS.failed }), NOW);

    expect(view.tone).toBe('error');
    expect(view.label).toBe('실패');
  });

  it('모르는 코드는 코드 문자열을 그대로 내고 색을 정하지 않는다', () => {
    // 실서버의 상태 어휘가 확정되지 않았다. 이름을 지어내면 화면이 사실이 아닌 말을 한다.
    const view = toStatusView(messageRow({ statusCode: 'ERROR' }), NOW);

    expect(view.label).toBe('ERROR');
    expect(view.tone).toBe('idle');
  });

  it('상태 코드가 빈 문자열이어도 칩이 깨지지 않는다', () => {
    expect(toStatusView(messageRow({ statusCode: '' }), NOW).label).toBe('');
  });
});

describe('toStatusView — 보조 한 줄', () => {
  it('워커가 잡고 있으면 시작 시각과 함께 처리 중을 알린다', () => {
    const view = toStatusView(
      messageRow({ lockedBy: 'sync-worker-01', lockedAt: '2026-08-06T11:20:00+09:00' }),
      NOW,
    );

    expect(view.note).toBe('11:20부터 처리 중');
  });

  it('잡고 있으나 시각이 없으면 시각 없이 알린다 — 시각을 지어내지 않는다', () => {
    const view = toStatusView(messageRow({ lockedBy: 'sync-worker-01', lockedAt: null }), NOW);

    expect(view.note).toBe('처리 중');
  });

  it('lockedBy가 빈 문자열이면 처리 중이 아니다', () => {
    // 계약은 「값이 있으면 워커가 처리 중」이다. 빈 문자열은 값이 아니다.
    const view = toStatusView(
      messageRow({ lockedBy: '', lockedAt: '2026-08-06T11:20:00+09:00' }),
      NOW,
    );

    expect(view.note).toBeNull();
  });

  it('다음 시도 시각이 미래면 자동 재시도를 알린다', () => {
    const view = toStatusView(messageRow({ availableAt: '2026-08-06T12:30:00+09:00' }), NOW);

    expect(view.note).toBe('12:30 자동 재시도');
  });

  it('다음 시도 시각이 과거면 알리지 않는다 — 이미 지난 예정은 안내가 아니다', () => {
    const view = toStatusView(messageRow({ availableAt: '2026-08-06T09:00:00+09:00' }), NOW);

    expect(view.note).toBeNull();
  });

  it('처리 중과 자동 재시도가 겹치면 지금 벌어지는 일을 낸다', () => {
    const view = toStatusView(
      messageRow({
        lockedBy: 'sync-worker-01',
        lockedAt: '2026-08-06T11:20:00+09:00',
        availableAt: '2026-08-06T12:30:00+09:00',
      }),
      NOW,
    );

    expect(view.note).toBe('11:20부터 처리 중');
  });

  it('시각이 형식에 맞지 않으면 자동 재시도를 알리지 않는다', () => {
    expect(toStatusView(messageRow({ availableAt: '알 수 없음' }), NOW).note).toBeNull();
  });
});

describe('formatDateTime · formatTime', () => {
  it('서버가 적어 보낸 벽시계 시각을 그대로 낸다', () => {
    // 실행 환경 시간대로 옮기면 같은 자료가 보는 사람마다 다른 시각으로 보인다.
    expect(formatDateTime('2026-08-04T09:12:00+09:00')).toBe('2026-08-04 09:12');
    expect(formatDateTime('2026-08-04T09:12:00Z')).toBe('2026-08-04 09:12');
    expect(formatTime('2026-08-04T09:12:33+09:00')).toBe('09:12');
  });

  it('값이 없거나 형식이 아니면 null을 낸다 — 화면이 「—」로 바꾼다', () => {
    expect(formatDateTime(null)).toBeNull();
    expect(formatDateTime(undefined)).toBeNull();
    expect(formatDateTime('')).toBeNull();
    expect(formatDateTime('2026-08-04')).toBeNull();
    expect(formatTime(null)).toBeNull();
  });
});
