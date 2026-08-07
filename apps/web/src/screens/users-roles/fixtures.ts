import type { components } from '@omf-mes/api-client';

import type { AppUser, Role, UserDataScope, UserRole } from './types';

type Department = components['schemas']['Department'];
type BusinessUnit = components['schemas']['BusinessUnit'];
type Plant = components['schemas']['Plant'];

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-` 계열). **이 화면은 사람의 계정과 이름을 다룬다** —
 * 실제 로그인 ID·사람 이름·부서명·전자우편 도메인을 넣지 않는다(공개 저장소 경계).
 * 전자우편은 예약 도메인(`.invalid`)을 써 실제로 보낼 수 없는 값임을 드러낸다.
 */

/** 모든 칸이 채워진 사용자. 정상 경로의 기준이다. */
export const filledUserFixture: AppUser = {
  appUserId: 1001,
  loginId: 'SYN-LOGIN-01',
  userName: '합성 사용자 A',
  departmentId: 3001,
  email: 'syn.user.a@example.invalid',
  statusCode: 'SYN-STATUS-A',
  isActive: true,
};

/**
 * **부서와 전자우편이 널**인 사용자. 계약이 널을 허용하고 목 서버가 실제로 그런 행을 준다 —
 * 「—」 표기가 나오는지 보는 것이 이 픽스처의 목적이다.
 */
export const nullFieldUserFixture: AppUser = {
  appUserId: 1002,
  loginId: 'SYN-LOGIN-02',
  userName: '합성 사용자 B',
  departmentId: null,
  email: null,
  statusCode: 'SYN-STATUS-B',
  isActive: true,
};

/**
 * **미사용**이고 **부서 번호가 선택 목록에 없으며 상태 코드가 빈 문자열**인 사용자.
 * 「(미사용)」 접미·「알 수 없음」·빈 상태 코드를 한 픽스처에서 함께 볼 수 있다.
 */
export const inactiveUserFixture: AppUser = {
  appUserId: 1003,
  loginId: 'SYN-LOGIN-03',
  userName: '합성 사용자 C',
  departmentId: 9999,
  email: 'syn.user.c@example.invalid',
  statusCode: '',
  isActive: false,
};

export const appUserFixtures: AppUser[] = [
  filledUserFixture,
  nullFieldUserFixture,
  inactiveUserFixture,
];

/**
 * 부서 선택지 2건. 3002는 **미사용**이라 「(미사용)」 표식과
 * 「고른 값이 아니면 선택지에서 빠진다」를 함께 볼 수 있다.
 */
export const departmentFixtures: Department[] = [
  {
    departmentId: 3001,
    departmentCode: 'SYN-DEPT-01',
    departmentName: '합성 부서 A',
    parentDepartmentId: null,
    businessUnitId: null,
    isActive: true,
  },
  {
    departmentId: 3002,
    departmentCode: 'SYN-DEPT-02',
    departmentName: '합성 부서 B',
    parentDepartmentId: null,
    businessUnitId: null,
    isActive: false,
  },
];

/**
 * 역할 선택지 3건.
 *
 * - `5001` 사용 중 · **이미 부여됨** — 회수가 막히지 않는지 보는 자리다
 * - `5002` 사용 중 · 부여되지 않음 — 새로 고를 수 있는지 보는 자리다
 * - `5003` **미사용** · 이미 부여됨 — 목록에 남고 잠기는지 보는 자리다
 *
 * 이름에 어떤 직책·권한 등급도 담지 않는다 — 화면은 「어떤 역할이 특별한가」를 판정하지 않으며,
 * 픽스처가 그런 이름을 가지면 그 판정을 넣고 싶어지는 자리를 만든다(계획 결정 4).
 */
export const roleFixtures: Role[] = [
  {
    roleId: 5001,
    roleCode: 'SYN-ROLE-01',
    roleName: '합성 역할 A',
    description: '합성 역할 A 설명',
    isActive: true,
  },
  {
    roleId: 5002,
    roleCode: 'SYN-ROLE-02',
    roleName: '합성 역할 B',
    description: null,
    isActive: true,
  },
  {
    roleId: 5003,
    roleCode: 'SYN-ROLE-03',
    roleName: '합성 역할 C',
    description: null,
    isActive: false,
  },
];

/** 사용자 `1001`의 부여분 — 사용 중 하나와 미사용 하나를 함께 담는다. */
export const userRoleFixtures: UserRole[] = [
  { userRoleId: 7001, appUserId: 1001, roleId: 5001 },
  { userRoleId: 7002, appUserId: 1001, roleId: 5003 },
];

export const businessUnitFixtures: BusinessUnit[] = [
  {
    businessUnitId: 2001,
    legalEntityId: 1,
    businessUnitCode: 'SYN-BU-01',
    businessUnitName: '합성 사업부 A',
    isActive: true,
  },
  {
    businessUnitId: 2002,
    legalEntityId: 1,
    businessUnitCode: 'SYN-BU-02',
    businessUnitName: '합성 사업부 B',
    isActive: true,
  },
];

export const plantFixtures: Plant[] = [
  {
    plantId: 4001,
    legalEntityId: 1,
    businessUnitId: 2001,
    plantCode: 'SYN-PLT-01',
    plantName: '합성 공장 A',
    timezoneCode: 'SYN-TZ-01',
    isActive: true,
  },
  {
    plantId: 4002,
    legalEntityId: 1,
    businessUnitId: 2002,
    plantCode: 'SYN-PLT-02',
    plantName: '합성 공장 B',
    timezoneCode: 'SYN-TZ-01',
    isActive: true,
  },
];

/**
 * 사용자 `1001`의 접근범위 2건.
 *
 * - `9001` 두 축을 다 고른 줄
 * - `9002` **공장을 비운 줄** — 표에 「(전체)」가 나오는지, 저장 본문에 널이 명시되는지 보는 자리다
 */
export const userDataScopeFixtures: UserDataScope[] = [
  { userDataScopeId: 9001, appUserId: 1001, businessUnitId: 2001, plantId: 4001 },
  { userDataScopeId: 9002, appUserId: 1001, businessUnitId: 2002, plantId: null },
];
