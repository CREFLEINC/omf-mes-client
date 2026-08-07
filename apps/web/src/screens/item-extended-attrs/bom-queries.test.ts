import { describe, expect, it } from 'vitest';

import { bomComponentDetailPath, bomKeys } from './bom-queries';

/**
 * 캐시 키의 **모양**이 곧 무효화 범위다. react-query가 키의 앞부분으로 맞추므로,
 * 어느 키가 어느 키를 덮는지는 값으로 확인해야 한다 — 화면 테스트로는 드러나지 않는다.
 */
const isPrefixOf = (prefix: readonly unknown[], key: readonly unknown[]): boolean =>
  prefix.every((part, index) => key[index] === part);

describe('bomKeys', () => {
  /**
   * 구성품 저장 뒤에 **목록과 행 상세가 함께 무효화돼야 한다**(작업 8 완료 조건 ⑥).
   * 행 상세가 낡은 채 남으면 다음 저장이 옛 잠금 토큰을 쓴다.
   */
  it('구성품 목록 키가 행 상세 키를 덮는다', () => {
    expect(isPrefixOf(bomKeys.components(2001), bomKeys.component(2001, 7001))).toBe(true);
  });

  /* 다른 자재 명세서의 구성품까지 덮으면 보고 있지도 않은 표가 다시 그려진다. */
  it('구성품 목록 키가 다른 자재 명세서를 덮지 않는다', () => {
    expect(isPrefixOf(bomKeys.components(2001), bomKeys.component(2002, 7001))).toBe(false);
  });

  /**
   * 기본 지정은 **헤더 목록만** 무효화한다 — 구성품은 달라지지 않는데 함께 받으면
   * 표가 이유 없이 다시 그려진다.
   */
  it('헤더 목록 키가 구성품을 덮지 않는다', () => {
    expect(isPrefixOf(bomKeys.list(1001), bomKeys.components(2001))).toBe(false);
    expect(isPrefixOf(bomKeys.list(1001), bomKeys.component(2001, 7001))).toBe(false);
  });

  /* 품목이 다르면 헤더 목록도 다른 자료다. */
  it('헤더 목록 키가 품목마다 갈린다', () => {
    expect(bomKeys.list(1001)).not.toEqual(bomKeys.list(1002));
  });
});

/**
 * 보관소가 **요청 경로**를 키로 쓴다 — 이 문자열이 실제 요청 경로와 한 글자라도 다르면
 * 토큰을 찾지 못해 저장이 조용히 멈춘다(§5.3 6행).
 */
describe('bomComponentDetailPath', () => {
  it('행 상세 요청 경로와 같은 문자열을 만든다', () => {
    expect(bomComponentDetailPath(2001, 7001)).toBe('/planning/boms/2001/components/7001');
  });
});
