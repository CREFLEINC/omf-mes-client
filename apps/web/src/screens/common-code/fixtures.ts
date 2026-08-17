import type { CodeValue } from './code-value-types';
import type { PartnerRoleRow } from './partner-role-draft';
import { PARTNER_ROLE_CODES } from './partner-role-vocab';
import type { CodeGroup, Department, Partner, Worker } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-`·`SAMPLE-` 계열). 실제 그룹코드·코드·부서코드·
 * 사번·사람 이름·인증번호·거래처를 넣지 않는다(공개 저장소 경계). **계약의 `@example` 값도
 * 쓰지 않는다** — 예시로 실린 회사명·코드는 우리가 지어낸 값이 아니다.
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

/**
 * 거래처 3건.
 *
 * 9002는 **국가와 ERP 코드가 널**이고, 9003은 **미사용**이다 —
 * 「—」 표기와 「(미사용)」 접미를 한 픽스처에서 함께 볼 수 있다.
 */
export const partnerFixtures: Partner[] = [
  {
    partnerId: 9001,
    partnerCode: 'SAMPLE-PTNR-A',
    partnerName: '샘플 거래처 가',
    countryCode: 'SAMPLE-CTRY',
    erpPartnerCode: 'SAMPLE-ERP-A',
    isActive: true,
  },
  {
    partnerId: 9002,
    partnerCode: 'SAMPLE-PTNR-B',
    partnerName: '샘플 거래처 나',
    countryCode: null,
    erpPartnerCode: null,
    isActive: true,
  },
  {
    partnerId: 9003,
    partnerCode: 'SAMPLE-PTNR-C',
    partnerName: '샘플 거래처 다',
    countryCode: 'SAMPLE-CTRY',
    erpPartnerCode: 'SAMPLE-ERP-C',
    isActive: false,
  },
];

/**
 * 거래처 9001의 역할 3건.
 *
 * **차례를 일부러 뒤섞고 어휘 밖 코드를 하나 섞어 둔다** — 화면이 서버가 준 배열 순서를
 * 그대로 쓰지 않고 자기 차례로 세우는지, 모르는 코드를 감추지 않고 표식과 함께 내는지
 * 확인하는 것이 이 픽스처의 목적이다.
 */
export const partnerRoleFixtures: PartnerRoleRow[] = [
  /* 어휘 밖 코드는 어휘 표에 없으므로 여기서 짓는다 — 화면이 모르는 값이 이 픽스처의 요점이다. */
  { roleTypeCode: 'SAMPLE-ROLE-X', roleTypeName: '샘플 역할 엑스' },
  /* 어휘 안 코드는 **표에서 꺼내 쓴다**(결정 2) — 리터럴은 고정 감지기 한 자리에만 둔다. */
  { roleTypeCode: PARTNER_ROLE_CODES.disposal, roleTypeName: '폐기처리' },
  { roleTypeCode: PARTNER_ROLE_CODES.customer, roleTypeName: null },
];

/**
 * 작업자 3건.
 *
 * **사번과 성명은 한눈에 지어낸 값으로 보이게 둔다** — 이 화면은 이 저장소에서 처음으로
 * 사람 이름과 사번을 다룬다. 실제 사람 이름·사번 형태를 쓰지 않는다(공개 저장소 경계).
 *
 * 5002는 **계정 연결이 없고 부서가 없으며 상태 코드가 화면이 모르는 값**이다 —
 * 「연결 안 됨」·「알 수 없음」·원본 문자열 표기를 한 픽스처에서 함께 볼 수 있다.
 * 5003은 **미사용**이고 **부서 번호가 조회 목록에 없다**.
 */
export const workerFixtures: Worker[] = [
  {
    workerId: 5001,
    workerNo: 'SYN-W-0001',
    workerName: '합성 작업자 A',
    businessUnitId: 4001,
    plantId: 6001,
    departmentId: 3001,
    appUserId: 7001,
    statusCode: 'ACTIVE',
    isActive: true,
  },
  {
    workerId: 5002,
    workerNo: 'SYN-W-0002',
    workerName: '합성 작업자 B',
    businessUnitId: 4001,
    plantId: 6001,
    departmentId: null,
    appUserId: null,
    statusCode: 'SYN-UNKNOWN-STATUS',
    isActive: true,
  },
  {
    workerId: 5003,
    workerNo: 'SYN-W-0003',
    workerName: '합성 작업자 C',
    businessUnitId: 4001,
    plantId: 6001,
    departmentId: 9999,
    appUserId: 7003,
    statusCode: '',
    isActive: false,
  },
];
