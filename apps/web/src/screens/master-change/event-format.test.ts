import { describe, expect, it } from 'vitest';

import { formatDateTime, formatValue } from './event-format';

describe('formatDateTime', () => {
  it('날짜와 분까지 공장 시각(UTC+7)으로 낸다', () => {
    expect(formatDateTime('2026-08-04T09:12:00+09:00')).toBe('2026-08-04 07:12');
  });

  /*
   * 현장이 쓰는 시각은 공장 시각(베트남, UTC+7)이다(omf-all-around#20). 보는 사람(실행 환경)의
   * 시간대로 옮기면 같은 자료가 사람마다 다른 시각으로 보이고, 글자만 자르면 서버가 보낸 offset 에
   * 따라 같은 순간이 다르게 찍힌다.
   */
  it('같은 순간이면 offset 이 달라도 같은 공장 시각이다 — 보는 사람의 시간대와 상관없다', () => {
    const seoul = formatDateTime('2026-08-04T09:12:00+09:00');
    const utc = formatDateTime('2026-08-04T00:12:00Z');
    const plant = formatDateTime('2026-08-04T07:12:00+07:00');

    expect(seoul).toBe('2026-08-04 07:12');
    expect(utc).toBe(seoul);
    expect(plant).toBe(seoul);
  });

  it('글자가 같아도 다른 순간이면 결과도 다르다', () => {
    // 09:12+09:00 과 09:12+00:00 은 9시간 떨어진 서로 다른 순간이다.
    expect(formatDateTime('2026-08-04T09:12:00+00:00')).toBe('2026-08-04 16:12');
    expect(formatDateTime('2026-08-04T09:12:00+00:00')).not.toBe(
      formatDateTime('2026-08-04T09:12:00+09:00'),
    );
  });

  it('공장 시각으로 자정을 넘기면 날짜도 바뀐다', () => {
    expect(formatDateTime('2026-08-04T18:12:00+00:00')).toBe('2026-08-05 01:12');
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
