import type { components } from '@omf-mes/api-client';

/**
 * **코드값 편집 한 벌**의 계약. 이 한 벌은 파일 여덟으로 이루어지고,
 * 다른 화면이 `codeGroupId` 하나만 고정해 그대로 다시 쓰게 되어 있다(omf-mes#13 §5).
 *
 * 경계 규칙 셋 — 이것이 지켜지면 여덟 파일만 옮기면 된다.
 * 1. 한 벌의 어떤 파일도 이 화면의 **다른 자원**(코드그룹·부서·작업자·자격)과 **탭 정의**를
 *    참조하지 않는다. 그래서 이 파일이 `types.ts`와 별개로 존재한다 —
 *    타입을 공유하면 그 파일이 딸려 오고, 그 파일이 다른 자원을 끌고 온다.
 * 2. **주소를 읽지 않는다.** 조회 조건·선택·쪽은 전부 `code-value-section.tsx`의 props로 들어온다.
 * 3. 문구는 `messages.commonCode.codeValue` 한 묶음에 모은다. **바깥 묶음을 빌려 쓰지 않는다** —
 *    빌리면 옮길 때 그 열쇠가 딸려 가지 않아 문구가 비는 자리가 생긴다. 자원 이름이 없는
 *    저장소 전역 묶음(`common`·`httpError`)만 예외다.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 */

export type CodeValue = components['schemas']['CodeValue'];
export type CodeValuePageMeta = components['schemas']['PageMeta'];

/**
 * 코드값 폼 값. 전부 문자열인 이유는 DS 입력이 문자열을 다루기 때문이다.
 * 계약 표현(숫자·널)으로의 변환은 `code-value-mappers.ts`가 맡는다.
 */
export interface CodeValueFormValues {
  code: string;
  codeName: string;
  /** 계약이 정수를 받는다. 하한이 없어 음수도 허용값이다. */
  displayOrder: string;
  /** 계약이 널을 허용한다 — 비우는 것이 정상 값이다. */
  effectiveFrom: string;
  effectiveTo: string;
}
