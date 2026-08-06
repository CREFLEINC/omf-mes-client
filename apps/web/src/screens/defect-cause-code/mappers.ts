import type { CauseCode, DefectCode, HierarchyCode } from './types';

/**
 * 계약 표현과 화면 표현 사이의 변환.
 *
 * 불량 코드와 원인 코드는 필드 이름만 다르고 구조가 같다. 그 이름 차이를 여기와
 * `adapters.ts`에서만 넘고, 화면 부품은 `HierarchyCode` 하나만 다룬다.
 */

/**
 * 자기 자신을 상위로 가리키는 행을 대분류로 접는다.
 *
 * 계약 문서가 밝히듯 데이터베이스에 자기참조 방지 제약이 없고 목 서버도 그런 행을 내려준다.
 * 접지 않으면 「하위가 있는데 그 하위가 자기 자신인」 그룹이 생겨 어느 쪽으로도 열 수 없다.
 * 접기는 이 한 곳에서만 하고 뒤의 모든 판정은 접힌 값을 쓴다.
 */
const foldSelfReference = (id: number, parentId: number | null | undefined): number | null =>
  parentId === null || parentId === undefined || parentId === id ? null : parentId;

export const defectToHierarchyCode = (raw: DefectCode): HierarchyCode => ({
  id: raw.defectCodeId,
  code: raw.defectCode,
  name: raw.defectName,
  parentId: foldSelfReference(raw.defectCodeId, raw.parentDefectCodeId),
  isActive: raw.isActive,
});

export const causeToHierarchyCode = (raw: CauseCode): HierarchyCode => ({
  id: raw.causeCodeId,
  code: raw.causeCode,
  name: raw.causeName,
  parentId: foldSelfReference(raw.causeCodeId, raw.parentCauseCodeId),
  isActive: raw.isActive,
});
