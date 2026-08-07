import { describe, expect, it } from 'vitest';

import { formatDateTime, formatValue } from './event-format';

describe('formatDateTime', () => {
  it('날짜와 분까지 낸다', () => {
    expect(formatDateTime('2026-08-04T09:12:00+09:00')).toBe('2026-08-04 09:12');
  });

  /*
   * 서버가 적어 보낸 벽시계 시각이 현장이 쓰는 시각이다. 실행 환경 시간대로 옮기면
   * 같은 자료가 보는 사람마다 다른 시각으로 보인다.
   */
  it('실행 환경 시간대로 옮기지 않는다 — 시간대가 다르면 결과도 다르다', () => {
    const seoul = formatDateTime('2026-08-04T09:12:00+09:00');
    const utc = formatDateTime('2026-08-04T09:12:00+00:00');

    expect(seoul).toBe('2026-08-04 09:12');
    expect(utc).toBe('2026-08-04 09:12');
    // 두 입력은 서로 다른 순간이지만 벽시계 표기는 서버가 적은 그대로다.
    expect(seoul).toBe(utc);
  });

  it('시간대가 달라도 벽시계 숫자가 다르면 결과도 다르다', () => {
    expect(formatDateTime('2026-08-04T18:12:00+00:00')).toBe('2026-08-04 18:12');
  });

  it('값이 없거나 형식이 아니면 null이다 — 호출부가 「—」로 바꾼다', () => {
    expect(formatDateTime(null)).toBeNull();
    expect(formatDateTime(undefined)).toBeNull();
    expect(formatDateTime('')).toBeNull();
    expect(formatDateTime('2026-08-04')).toBeNull();
  });
});

describe('formatValue — 자유 형식 값 하나의 표기', () => {
  it('문자열은 그대로 낸다', () => {
    expect(formatValue('SAMPLE-VALUE')).toBe('SAMPLE-VALUE');
  });

  it('숫자와 불리언은 문자로 옮긴다', () => {
    expect(formatValue(42)).toBe('42');
    expect(formatValue(3.5)).toBe('3.5');
    expect(formatValue(true)).toBe('true');
  });

  /* 거짓 같은 값을 「없음」으로 뭉개면 자료가 사라진다 — 0과 false는 값이다. */
  it('0과 false를 없음으로 뭉개지 않는다', () => {
    expect(formatValue(0)).toBe('0');
    expect(formatValue(false)).toBe('false');
  });

  it('없는 값과 빈 문자열은 null이다 — DiffRow가 빈 값 표기로 낸다', () => {
    expect(formatValue(null)).toBeNull();
    expect(formatValue(undefined)).toBeNull();
    expect(formatValue('')).toBeNull();
  });

  /*
   * 객체를 String()으로 그리면 `[object Object]`가 화면에 나온다.
   * 자유 형식이라 이 경우가 실제로 온다 — 원문 JSON은 읽기 좋지 않지만 자료를 잃지 않는다.
   */
  it('객체는 원문 JSON으로 낸다', () => {
    expect(formatValue({ sampleFieldA: 1, sampleFieldB: 'x' })).toBe(
      '{"sampleFieldA":1,"sampleFieldB":"x"}',
    );
    expect(formatValue({ sampleFieldA: 1 })).not.toContain('[object Object]');
  });

  it('배열도 원문 JSON으로 낸다', () => {
    expect(formatValue([1, 'x', null])).toBe('[1,"x",null]');
  });

  it('빈 객체는 빈 값이 아니라 원문 JSON이다 — 키가 없다는 사실도 자료다', () => {
    expect(formatValue({})).toBe('{}');
  });
});
