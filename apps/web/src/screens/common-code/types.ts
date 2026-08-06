import type { components } from '@omf-mes/api-client';

/**
 * W-06-06 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다 —
 * 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 *
 * **코드값 편집 한 벌은 이 파일을 쓰지 않는다.** 그쪽은 `code-value-types.ts`에 자기 타입을 갖는다 —
 * 그래야 여덟 파일을 통째로 옮길 수 있다(omf-mes#13 §5).
 */

export type CodeGroup = components['schemas']['CodeGroup'];
export type PageMeta = components['schemas']['PageMeta'];

/**
 * 좌 페인의 조회 조건. URL이 소유하며 화면 상태로 복제하지 않는다.
 *
 * `includeInactive`는 **켜졌을 때만** 서버로 보낸다. 계약의 기본값이 false라
 * 끈 상태를 값으로 실어 보내면 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
 */
export interface CodeGroupFilters {
  q: string;
  includeInactive: boolean;
}

/**
 * 코드그룹 폼 값. 전부 문자열인 이유는 DS 입력이 문자열을 다루기 때문이다.
 * 계약 표현(널)으로의 변환은 `code-group-mappers.ts`가 맡는다.
 */
export interface CodeGroupFormValues {
  groupCode: string;
  groupName: string;
  /** 계약이 널을 허용한다 — 비우는 것이 정상 값이다. */
  description: string;
}
