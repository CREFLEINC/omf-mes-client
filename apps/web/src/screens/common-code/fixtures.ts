import type { CodeGroup } from './types';

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
