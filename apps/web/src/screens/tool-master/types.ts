import type { components, paths } from '@omf-mes/api-client';

/**
 * W-05-13 화면 슬라이스의 계약.
 *
 * ⭐ **자원 이름은 금형(`Mold`)이지만 담는 것은 모든 도구다** — 금형·지그·그 밖의 도구를
 * `toolTypeCode` 가 가른다(스펙 §3). 타입 이름만 계약을 따르고 화면의 말은 「툴」이다.
 */
export type Mold = components['schemas']['Mold'];

/** 목록 정렬. **계약이 정한 세 값이다** — 화면이 늘리지 않는다. */
export type ToolSort = NonNullable<
  NonNullable<paths['/mdm/molds']['get']['parameters']['query']>['sort']
>;

export interface ToolFilters {
  q: string;
  plantId: string;
  /** 도구 유형. ⚠ 값 목록이 아직 없다(추적 `omf-mes#145`) */
  toolTypeCode: string;
  /**
   * 적정타수가 비어 있는 것만 본다.
   * ⭐ **서버가 거른다** — 화면이 받아 온 것만 거르는 조건이 아니라서 잘림과 무관하다.
   */
  guaranteedShotCountMissing: boolean;
  /** 예방보전이 도래한 것만 본다. **도래 판정도 서버가 한다**(`pmDue`) */
  pmDueOnly: boolean;
  sort: ToolSort;
  includeInactive: boolean;
}
