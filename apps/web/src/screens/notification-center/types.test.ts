import { describe, expect, it } from 'vitest';

import { notificationFixture } from './fixtures';
import { formatOccurredAt, toNotificationView } from './types';

describe('formatOccurredAt', () => {
  it('월·일과 시·분만 남긴다', () => {
    expect(formatOccurredAt('2026-08-13T09:12:00+09:00')).toBe('08-13 09:12');
  });

  it('실행 환경 시간대로 옮기지 않는다 — 온 문자열의 벽시계를 그대로 자른다', () => {
    /*
     * ⭐ 이 값을 `new Date(...)`로 파싱해 다시 그리면 한국 자리에서 「08-14 08:30」이 된다.
     * 같은 알림이 보는 사람의 시간대마다 다른 시각으로 보이면 안 된다.
     */
    expect(formatOccurredAt('2026-08-13T23:30:00+00:00')).toBe('08-13 23:30');
  });

  it('초와 밀리초가 붙어 있어도 분까지만 낸다', () => {
    expect(formatOccurredAt('2026-08-13T09:12:34.567+09:00')).toBe('08-13 09:12');
  });

  it('시간대 표기가 Z여도 벽시계를 그대로 낸다', () => {
    expect(formatOccurredAt('2026-08-13T23:30:00Z')).toBe('08-13 23:30');
  });

  it('형식이 아니면 원문을 그대로 낸다 — 서버가 보낸 값을 화면이 삼키지 않는다', () => {
    expect(formatOccurredAt('2026-08-13')).toBe('2026-08-13');
    expect(formatOccurredAt('')).toBe('');
    expect(formatOccurredAt('어제')).toBe('어제');
  });
});

describe('toNotificationView', () => {
  it('계약의 필수 다섯 칸을 그대로 나른다', () => {
    const view = toNotificationView(notificationFixture());

    expect(view.notificationId).toBe(7101);
    expect(view.eventCode).toBe('SYN-EVENT-01');
    expect(view.message).toBe('합성 알림 문구 가입니다.');
    expect(view.occurredAt).toBe('2026-08-17T14:05:00+09:00');
    expect(view.read).toBe(false);
  });

  it('표기와 원문을 함께 든다 — 원문이 필요한 자리가 따로 있다', () => {
    const view = toNotificationView(notificationFixture());

    expect(view.occurredAtText).toBe('08-17 14:05');
  });

  it('빈 본문도 다듬지 않고 그대로 나른다 — 낙하 판정은 그리는 쪽이 한다', () => {
    expect(toNotificationView(notificationFixture({ message: '   ' })).message).toBe('   ');
  });

  it('대상 두 칸이 없으면 null로 눕힌다 — 갈래 판정을 한 모양으로 한다', () => {
    const view = toNotificationView(notificationFixture());

    expect(view.targetTypeCode).toBeNull();
    expect(view.targetId).toBeNull();
  });

  it('대상 두 칸이 오면 그대로 나른다', () => {
    const view = toNotificationView(
      notificationFixture({ targetTypeCode: 'SYN-TARGET-TYPE', targetId: 7201 }),
    );

    expect(view.targetTypeCode).toBe('SYN-TARGET-TYPE');
    expect(view.targetId).toBe(7201);
  });

  it('한쪽만 온 대상도 그대로 나른다 — 여기서 짝을 판정하지 않는다', () => {
    const onlyType = toNotificationView(notificationFixture({ targetTypeCode: 'SYN-TARGET-TYPE' }));

    expect(onlyType.targetTypeCode).toBe('SYN-TARGET-TYPE');
    expect(onlyType.targetId).toBeNull();
  });
});
