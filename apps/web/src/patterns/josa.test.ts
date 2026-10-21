import { describe, expect, it } from 'vitest';

import { josa } from './josa';

describe('josa(C-5)', () => {
  it('받침에 맞춰 조사를 고른다', () => {
    expect(josa('기본 WIP 위치', '을/를')).toBe('기본 WIP 위치를');
    expect(josa('생산 라인', '을/를')).toBe('생산 라인을');
    expect(josa('BOM', '이/가')).toBe('BOM이');
    expect(josa('Routing', '을/를')).toBe('Routing을');
    expect(josa('W/O', '을/를')).toBe('W/O를');
    expect(josa('4M 배정', '으로/로')).toBe('4M 배정으로');
    expect(josa('배포 확인', '으로/로')).toBe('배포 확인으로');
    expect(josa('파일', '으로/로')).toBe('파일로');
    expect(josa('계획', '은/는')).toBe('계획은');
  });

  it('닫는 낫표, 괄호, 따옴표 뒤에서는 그 앞 글자로 고른다', () => {
    expect(josa('「생산 라인」', '을/를')).toBe('「생산 라인」을');
    expect(josa('「배포 확인」', '으로/로')).toBe('「배포 확인」으로');
    expect(josa('「파일」', '으로/로')).toBe('「파일」로');
    expect(josa('품목(BOM)', '이/가')).toBe('품목(BOM)이');
    expect(josa('[W/O]', '을/를')).toBe('[W/O]를');
    expect(josa('『계획』', '은/는')).toBe('『계획』은');
    expect(josa('"라인"', '이/가')).toBe('"라인"이');
  });
});
