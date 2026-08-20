import { describe, expect, it } from 'vitest';

const screenSources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const findViolations = (pattern: RegExp): string[] =>
  Object.entries(screenSources).flatMap(([path, source]) => {
    const match = source.match(pattern);
    return match === null ? [] : [`${path}: ${match[0]}`];
  });

describe('filter draft sync guard', () => {
  it('적용 객체를 편집 상태 setter에 직접 넘기지 않는다', () => {
    const violations = findViolations(
      /\bset(?:Draft|Filters|Period)\s*\(\s*applied(?:Filters|Period)\s*\)/,
    );

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('적용 객체 전체를 effect dependency로 삼지 않는다', () => {
    const violations = findViolations(/\[\s*applied(?:Filters|Period)\s*\]/);

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
