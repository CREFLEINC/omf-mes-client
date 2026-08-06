import type { CauseCode, DefectCode, HierarchyCode } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 실제 사번·품목코드·LOT 번호·거래처 코드·
 * 고객사명·공장 위치를 넣지 않는다(공개 저장소 경계).
 *
 * 목록은 화면이 다뤄야 하는 까다로운 입력을 일부러 함께 담는다.
 * - 자기참조 행(DF-20) — 목 서버가 실제로 내려주는 모양이다
 * - 고아 행(DF-91) — 상위 번호는 있는데 그 상위가 목록에 없다
 * - 미사용 대분류(DF-90) — 「미사용 포함」이 꺼져 있어도 선택지 판정에 쓰인다
 */

export const defectCodeFixtures: DefectCode[] = [
  {
    defectCodeId: 1001,
    defectCode: 'DF-10',
    defectName: '외관',
    parentDefectCodeId: null,
    processId: 3001,
    isActive: true,
  },
  {
    defectCodeId: 1002,
    defectCode: 'DF-11',
    defectName: '스크래치',
    parentDefectCodeId: 1001,
    processId: null,
    isActive: true,
  },
  {
    defectCodeId: 1003,
    defectCode: 'DF-12',
    defectName: '찍힘',
    parentDefectCodeId: 1001,
    processId: null,
    isActive: true,
  },
  // 자기 자신을 상위로 가리킨다 — 화면은 이것을 대분류로 접는다.
  {
    defectCodeId: 1004,
    defectCode: 'DF-20',
    defectName: '치수',
    parentDefectCodeId: 1004,
    processId: null,
    isActive: true,
  },
  {
    defectCodeId: 1005,
    defectCode: 'DF-21',
    defectName: '길이 초과',
    parentDefectCodeId: 1004,
    processId: null,
    isActive: true,
  },
  {
    defectCodeId: 1006,
    defectCode: 'DF-90',
    defectName: '사용하지 않는 축',
    parentDefectCodeId: null,
    processId: null,
    isActive: false,
  },
  // 상위 1900이 목록에 없다 — 고아 그룹으로 나와야 한다.
  {
    defectCodeId: 1007,
    defectCode: 'DF-91',
    defectName: '분류 미정',
    parentDefectCodeId: 1900,
    processId: null,
    isActive: true,
  },
];

export const causeCodeFixtures: CauseCode[] = [
  {
    causeCodeId: 2001,
    causeCode: 'CS-10',
    causeName: '설비',
    parentCauseCodeId: null,
    processId: null,
    isActive: true,
  },
  {
    causeCodeId: 2002,
    causeCode: 'CS-11',
    causeName: '금형 마모',
    parentCauseCodeId: 2001,
    processId: null,
    isActive: true,
  },
  {
    causeCodeId: 2003,
    causeCode: 'CS-20',
    causeName: '작업 방법',
    parentCauseCodeId: null,
    processId: null,
    isActive: true,
  },
];

/** 계층 판정 단위 테스트가 쓰는 화면 표현. 계약 변환을 거치지 않고 바로 넣는다. */
export const hierarchyFixtures: HierarchyCode[] = [
  { id: 1001, code: 'DF-10', name: '외관', parentId: null, isActive: true },
  { id: 1002, code: 'DF-11', name: '스크래치', parentId: 1001, isActive: true },
  { id: 1003, code: 'DF-12', name: '찍힘', parentId: 1001, isActive: true },
  { id: 1004, code: 'DF-20', name: '치수', parentId: null, isActive: true },
  { id: 1005, code: 'DF-21', name: '길이 초과', parentId: 1004, isActive: true },
  { id: 1006, code: 'DF-90', name: '사용하지 않는 축', parentId: null, isActive: false },
  { id: 1007, code: 'DF-91', name: '분류 미정', parentId: 1900, isActive: true },
];
