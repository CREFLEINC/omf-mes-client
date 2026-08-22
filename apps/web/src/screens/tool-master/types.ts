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

/**
 * 폼이 들고 있는 값. **수는 문자열로 든다** — 빈 칸과 `0` 을 가르고, 지우는 도중의
 * 「`1.`」 같은 중간 상태를 숫자로 억지로 바꾸지 않기 위해서다.
 *
 * ⛔ **누계 타발수·마지막 예방보전일이 여기 없다.** 계약이 수정 본문에 받지 않으며, 더하는 것은
 * 툴 사용실적 입력이고 되돌리는 것은 툴 예방보전 실적 등록이다(스펙 §6 · 공유계약 B-13).
 * 폼 값에 두면 언젠가 입력칸이 붙고, 그 순간 실적과 마스터가 조용히 어긋난다.
 */
export interface ToolFormValues {
  moldCode: string;
  moldName: string;
  toolTypeCode: string;
  /** 등록에서만 고른다. 계약이 수정 본문에 받지 않는다 */
  plantId: string;
  cavityCount: string;
  guaranteedShotCount: string;
  pmTriggerTypeCode: string;
  pmCycleInterval: string;
  pmCycleUnitCode: string;
}
