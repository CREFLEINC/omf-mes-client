import { describe, expect, it } from 'vitest';

import type { DashboardAlertView } from './types';
import { alertPathOf, alertTimeOf, alertTitleOf, describeMessage } from './alert-panel';

describe('alertPathOf', () => {
  it('알림센터를 그 유형으로 좁혀 연다', () => {
    expect(alertPathOf('SAMPLE_EVENT')).toBe('/notification/center?ev=SAMPLE_EVENT');
  });

  it('유형이 없으면 좁히지 않고 연다 — 빈 조건을 주소에 남기지 않는다', () => {
    expect(alertPathOf('')).toBe('/notification/center');
  });
});

describe('describeMessage', () => {
  /** 서버가 빈 문구를 주는 일이 실제로 있다. 그대로 그리면 제목만 남은 카드가 선다. */
  it('공백만 친 문구도 빈 것으로 판정한다', () => {
    expect(describeMessage('   ')).toBe('내용이 비어 있습니다.');
    expect(describeMessage('')).toBe('내용이 비어 있습니다.');
  });

  it('내용이 있으면 원문 그대로 낸다 — 다듬으면 보낸 것과 보이는 것이 갈린다', () => {
    expect(describeMessage(' 합성 알람 문구 ')).toBe(' 합성 알람 문구 ');
  });
});

describe('alertTitleOf', () => {
  const entries = [{ value: 'SAMPLE_EVENT', label: '합성 알림 이름' }];

  it('알림센터와 같은 유형 목록으로 이름을 푼다 — 코드 원문을 보이지 않는다', () => {
    expect(alertTitleOf('SAMPLE_EVENT', entries)).toBe('합성 알림 이름');
  });

  it('목록에 없거나 아직 안 왔으면 「알림」', () => {
    expect(alertTitleOf('UNKNOWN_EVENT', entries)).toBe('알림');
    expect(alertTitleOf('SAMPLE_EVENT', [])).toBe('알림');
  });
});

describe('alertTimeOf', () => {
  const view = (occurredAt: string): DashboardAlertView => ({
    notificationId: 1,
    eventCode: 'SAMPLE_EVENT',
    message: '',
    occurredAt,
    occurredAtText: '원문 표기',
    read: false,
    locationPath: null,
  });

  it('오늘(공장 날짜)이면 시:분, 다른 날이면 월-일 시:분 — 공장 시각(UTC+7)으로', () => {
    expect(alertTimeOf(view('2026-10-16T02:05:00Z'), '2026-10-16')).toBe('09:05');
    expect(alertTimeOf(view('2026-10-15T02:05:00Z'), '2026-10-16')).toBe('10-15 09:05');
    /* 올해가 아니면 연도까지. */
    expect(alertTimeOf(view('2025-12-15T03:00:00Z'), '2026-10-16')).toBe('2025-12-15 10:00');
  });

  it('읽을 수 없으면 받은 표기 그대로', () => {
    expect(alertTimeOf(view('잘못된 값'), '2026-10-16')).toBe('원문 표기');
  });
});
