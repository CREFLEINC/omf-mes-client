import { describe, expect, it } from 'vitest';

import { alertPathOf, describeLocation, describeMessage } from './alert-panel';

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

describe('describeLocation', () => {
  it('계층 텍스트를 그대로 낸다', () => {
    expect(describeLocation('합성공장 > 가라인 > 합성설비 1호')).toBe(
      '합성공장 > 가라인 > 합성설비 1호',
    );
  });

  it('오지 않으면 없다고 적는다 — 빈 줄로 두면 카드가 덜 그려진 것으로 읽힌다', () => {
    expect(describeLocation(null)).toBe('위치 정보 없음');
    expect(describeLocation('  ')).toBe('위치 정보 없음');
  });
});
