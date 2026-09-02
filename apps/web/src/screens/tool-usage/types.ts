import type { components } from '@omf-mes/api-client';

/**
 * P-05-01 화면 슬라이스의 계약.
 *
 * ⭐ **자원 이름은 금형(`Mold`)이지만 담는 것은 모든 도구다** — 금형·지그를 `toolTypeCode` 가
 * 가른다. 타입 이름만 계약을 따르고 화면의 말은 「툴」이다(전례 W-05-13).
 */
export type Mold = components['schemas']['Mold'];
export type ToolUsage = components['schemas']['ToolUsage'];
export type ToolUsageCreate = components['schemas']['ToolUsageCreate'];
export type OperationPolicyEffective = components['schemas']['OperationPolicyEffective'];

/**
 * 자산이 끝났음을 뜻하는 코드값. **선택지가 아니라 판정에 쓰는 값**이라 이름을 갖는다.
 *
 * ⭐ 설계가 확정해 알려 준 값이다(`omf-mes#185`) — 화면이 지어낸 값이 아니다. 계약도
 * 「운용 또는 폐기 두 값」이라고 못박았다. 전례 W-05-13 이 같은 이름으로 같은 값을 든다.
 */
export const DISPOSED_STATUS_CODE = 'DISPOSED';

/**
 * 타발수를 어떻게 얻었는가. **계약이 두 값과 뜻을 함께 못박았다** — 화면이 지어낸 값이 아니다.
 *
 * 닫힌 집합이라 통째로 든다 — 하나만 적어 두면 나머지가 어디서 왔는지 알 수 없는 문자열이 된다.
 */
export const COLLECTION_METHOD = {
  direct: 'DIRECT',
  converted: 'CONVERTED',
} as const;

export type CollectionMethod = (typeof COLLECTION_METHOD)[keyof typeof COLLECTION_METHOD];

/**
 * 화면이 들고 있는 값. **수는 문자열로 든다** — 빈 칸과 `0` 을 가르고, 지우는 도중의
 * 「`1.`」 같은 중간 상태를 숫자로 억지로 바꾸지 않기 위해서다(전례 W-05-13 `ToolFormValues`).
 *
 * ⛔ **누계가 여기 없다.** 화면은 증분만 보내고 누계는 서버가 더한다(스펙 §5-2 · 공유계약 B-13).
 * 초안에 두면 언젠가 그 값이 본문에 실리고, 그 순간 오프라인 큐가 앞의 입력을 지운다.
 */
export interface UsageDraft {
  method: CollectionMethod;
  /** 직접 입력일 때 사람이 친 타발수 */
  shotCount: string;
  /** 환산일 때 사람이 친 생산 수량 */
  baseQty: string;
}

export const emptyUsageDraft: UsageDraft = {
  method: COLLECTION_METHOD.direct,
  shotCount: '',
  baseQty: '',
};
