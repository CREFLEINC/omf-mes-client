/**
 * 위치를 글로 보이는 규칙 두 가지(피처 007 · omf-all-around#267 · plan R-6 · R-9). 화면은 이 둘만 부른다.
 *
 * - 표식(창고 배치도): 별칭이 있으면 **별칭만**, 없으면 코드.
 * - 목록 · 선택 칸: 별칭이 있으면 `코드 · 별칭`, 없으면 이름이 코드와 다를 때 `코드 · 이름`, 같으면 코드만.
 *
 * 빈 글 · 공백뿐인 별칭은 없는 것으로 본다.
 *
 * ⚠ `locationShownName`(`location-tree.ts`)과 뜻이 다르다 — 그것은 코드 칸이 따로 있는 표(창고·Location, 배치도 목록)의
 * 「별칭」 칸 값(별칭 → 이름)이다. 입고 화면의 옛 「이름 (별칭)」 표기는 K4 에서 이 함수로 옮겼다.
 */
export interface LocationLabelSource {
  locationCode: string;
  locationName?: string | null;
  aliasName?: string | null;
}

const trimmed = (text: string | null | undefined): string => text?.trim() ?? '';

/** 배치도 표식의 이름 — 별칭(공백 뺌) 또는 코드. */
export const locationMarkerLabel = (location: LocationLabelSource): string =>
  trimmed(location.aliasName) || location.locationCode;

/** 목록 · 선택 칸의 이름 — `코드 · 별칭`, `코드 · 이름`, 또는 코드. */
export const locationOptionLabel = (location: LocationLabelSource): string => {
  const code = location.locationCode;
  const alias = trimmed(location.aliasName);
  if (alias !== '') return `${code} · ${alias}`; // ui-check-ignore: C-13 승인 계약 §1 표기(#267)
  const name = trimmed(location.locationName);
  return name === '' || name === code ? code : `${code} · ${name}`; // ui-check-ignore: C-13 승인 계약 §1 표기(#267)
};
