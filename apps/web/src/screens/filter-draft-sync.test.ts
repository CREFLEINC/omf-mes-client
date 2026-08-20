import { describe, expect, it } from 'vitest';

const screenSources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const findViolations = (sources: Record<string, string>, pattern: RegExp): string[] =>
  Object.entries(sources).flatMap(([path, source]) => {
    const match = source.match(pattern);
    return match === null ? [] : [`${path}: ${match[1] ?? match[0]}`];
  });

const APPLIED_OBJECT_DEPENDENCY_PATTERN =
  /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*(\[[^\]]*\bapplied(?:Filters|Period)\b[^\]]*\])\s*\)/;

describe('filter draft sync guard', () => {
  it('적용 객체를 편집 상태 setter에 직접 넘기지 않는다', () => {
    const violations = findViolations(
      screenSources,
      /\bset(?:Draft|Filters|Period)\s*\(\s*applied(?:Filters|Period)\s*\)/,
    );

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('적용 객체 전체를 effect dependency로 삼지 않는다', () => {
    const violations = findViolations(screenSources, APPLIED_OBJECT_DEPENDENCY_PATTERN);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it.each([
    ['앞', '[appliedFilters, appliedQ]'],
    ['뒤', '[appliedQ, appliedFilters]'],
  ])('적용 객체가 dependency 배열 $0쪽에 섞여도 검출한다', (_, dependency) => {
    const source = `useEffect(() => { setDraft({ q: appliedQ }); }, ${dependency});`;

    expect(
      findViolations({ './synthetic-filter.tsx': source }, APPLIED_OBJECT_DEPENDENCY_PATTERN),
    ).toEqual([`./synthetic-filter.tsx: ${dependency}`]);
  });
});
