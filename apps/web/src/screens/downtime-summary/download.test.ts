import { describe, expect, it } from 'vitest';

import { escapeCsvField, toCsv, type CsvColumn } from './download';
import type { DistributionRow } from './types';

const row = (overrides: Partial<DistributionRow> = {}): DistributionRow => ({
  key: 'SAMPLE_A',
  label: '합성 사유 가',
  count: 3,
  totalMinutes: 120,
  averageMinutes: 40,
  sharePercent: 25,
  ...overrides,
});

const columns: CsvColumn[] = [
  { header: '사유', value: (source) => source.label },
  { header: '건수', value: (source) => String(source.count) },
];

describe('escapeCsvField', () => {
  it('평범한 값은 그대로 둔다 — 감싸면 읽는 쪽이 따옴표를 값으로 본다', () => {
    expect(escapeCsvField('합성 사유 가')).toBe('합성 사유 가');
  });

  it('쉼표가 들면 감싼다', () => {
    expect(escapeCsvField('합성, 사유')).toBe('"합성, 사유"');
  });

  /**
   * ⭐ 이 화면의 「틀려도 조용한」 자리 — 감싸지 않으면 그 줄부터 칸이 통째로 밀린다.
   * 파일은 멀쩡히 열리고 숫자만 엉뚱한 열에 앉으므로 아무도 눈치채지 못한다.
   */
  it('큰따옴표가 들면 감싸고 안쪽 따옴표를 두 번 적는다', () => {
    expect(escapeCsvField('합성 "가" 사유')).toBe('"합성 ""가"" 사유"');
  });

  it('줄바꿈이 들면 감싼다 — 감싸지 않으면 한 줄이 두 줄로 갈린다', () => {
    expect(escapeCsvField('합성\n사유')).toBe('"합성\n사유"');
    expect(escapeCsvField('합성\r\n사유')).toBe('"합성\r\n사유"');
  });

  it('빈 값은 빈 칸이다', () => {
    expect(escapeCsvField('')).toBe('');
  });
});

describe('toCsv', () => {
  it('머리줄과 자료 줄을 만든다', () => {
    expect(toCsv([row()], columns)).toBe('사유,건수\r\n합성 사유 가,3');
  });

  it('줄 끝이 CRLF다 — LF만 쓰면 한 줄로 붙어 열리는 환경이 있다', () => {
    expect(toCsv([row(), row({ key: 'SAMPLE_B' })], columns).split('\r\n')).toHaveLength(3);
  });

  it('줄이 없으면 머리줄만 남는다 — 빈 파일을 내려 주면 실패로 읽힌다', () => {
    expect(toCsv([], columns)).toBe('사유,건수');
  });

  it('머리줄도 같은 규칙으로 감싼다', () => {
    expect(toCsv([], [{ header: '사유, 이름', value: () => '' }])).toBe('"사유, 이름"');
  });
});
