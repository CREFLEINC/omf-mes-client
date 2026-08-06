import type { CodeValue } from './code-value-types';
import type { CodeGroup, Department } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-` 계열). 실제 그룹코드·코드·부서코드·사번·
 * 사람 이름·인증번호를 넣지 않는다(공개 저장소 경계).
 */

/**
 * 코드그룹 3건.
 *
 * 3003은 **설명이 널**이고 **미사용**이다 — 「—」 표기와 「(미사용)」 접미를
 * 한 픽스처에서 함께 볼 수 있다.
 */
export const codeGroupFixtures: CodeGroup[] = [
  {
    codeGroupId: 1001,
    groupCode: 'SYN-GRP-01',
    groupName: '합성 코드그룹 A',
    description: '합성 설명 A',
    isActive: true,
  },
  {
    codeGroupId: 1002,
    groupCode: 'SYN-GRP-02',
    groupName: '합성 코드그룹 B',
    description: null,
    isActive: true,
  },
  {
    codeGroupId: 1003,
    groupCode: 'SYN-GRP-03',
    groupName: '합성 코드그룹 C',
    description: '합성 설명 C',
    isActive: false,
  },
];

/**
 * 코드그룹 1001의 코드값 3건.
 *
 * **정렬 순서를 일부러 뒤섞어 둔다**(30·10·20). 화면이 서버가 준 배열 순서를 그대로 쓰지 않고
 * 다시 세우는지 확인하는 것이 이 픽스처의 목적이다.
 * 2003은 **유효기간이 한쪽만 있고 미사용**이다 — 「—」 표기와 「(미사용)」 접미를 함께 볼 수 있다.
 */
export const codeValueFixtures: CodeValue[] = [
  {
    codeValueId: 2001,
    codeGroupId: 1001,
    code: 'SYN-CV-01',
    codeName: '합성 코드값 A',
    displayOrder: 30,
    effectiveFrom: '2026-07-01',
    effectiveTo: '2026-12-31',
    isActive: true,
  },
  {
    codeValueId: 2002,
    codeGroupId: 1001,
    code: 'SYN-CV-02',
    codeName: '합성 코드값 B',
    displayOrder: 10,
    effectiveFrom: null,
    effectiveTo: null,
    isActive: true,
  },
  {
    codeValueId: 2003,
    codeGroupId: 1001,
    code: 'SYN-CV-03',
    codeName: '합성 코드값 C',
    displayOrder: 20,
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    isActive: false,
  },
];

/**
 * 부서 4건 — **계약 표현 그대로**(화면이 접기 전).
 *
 * 3001은 **자기 자신을 상위로 가리킨다.** 목 서버가 실제로 주는 형태이며,
 * 화면이 이것을 뿌리로 접는지 보는 것이 이 픽스처의 목적이다.
 * 3004는 **미사용**이고 3003은 **사업부가 없다** — 「(미사용)」 접미와 「—」 표기를 함께 볼 수 있다.
 */
export const departmentFixtures: Department[] = [
  {
    departmentId: 3001,
    departmentCode: 'SYN-DEPT-01',
    departmentName: '합성 부서 A',
    parentDepartmentId: 3001,
    businessUnitId: 4001,
    isActive: true,
  },
  {
    departmentId: 3002,
    departmentCode: 'SYN-DEPT-02',
    departmentName: '합성 부서 B',
    parentDepartmentId: 3001,
    businessUnitId: 4001,
    isActive: true,
  },
  {
    departmentId: 3003,
    departmentCode: 'SYN-DEPT-03',
    departmentName: '합성 부서 C',
    parentDepartmentId: null,
    businessUnitId: null,
    isActive: true,
  },
  {
    departmentId: 3004,
    departmentCode: 'SYN-DEPT-04',
    departmentName: '합성 부서 D',
    parentDepartmentId: 3001,
    businessUnitId: 4001,
    isActive: false,
  },
];
