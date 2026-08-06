import type {
  CauseCode,
  CodeFormValues,
  DefectCode,
  HierarchyCode,
  ServerFieldNames,
} from './types';

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

/** 상세 응답을 폼 값으로 옮긴다. 대분류는 「고르지 않음」인 빈 문자열이 된다. */
export const codeToFormValues = (code: HierarchyCode): CodeFormValues => ({
  code: code.code,
  name: code.name,
  parentId: code.parentId === null ? '' : String(code.parentId),
});

/** 신규 등록 폼의 초기값. 「상세 추가」로 열면 고른 대분류가 상위로 채워진 채 시작한다. */
export const emptyCodeFormValues = (parentId = ''): CodeFormValues => ({
  code: '',
  name: '',
  parentId,
});

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameCodeValues = (a: CodeFormValues, b: CodeFormValues): boolean =>
  a.code === b.code && a.name === b.name && a.parentId === b.parentId;

/** 쓰기 요청의 화면 쪽 표현. 계약 필드 이름으로 옮기는 것은 어댑터가 한다. */
export interface CodeWritePayload {
  code: string;
  name: string;
  parentId: number | null;
  /** 화면에 입력칸이 없는 값. 수정에서만 채워 보낸다. */
  processId: number | null;
}

/**
 * 폼 값을 쓰기 요청의 화면 표현으로 옮긴다.
 *
 * 앞뒤 공백이 붙은 코드는 눈으로 구분되지 않는 다른 코드가 되므로 여기서 떼어 낸다.
 * `preservedProcessId`는 상세 응답에서 받은 값을 그대로 되돌려 보내기 위한 것이다 —
 * 수정이 전체 치환이라 빠뜨리면 서버에 저장돼 있던 값이 조용히 지워진다.
 */
export const toWritePayload = (
  values: CodeFormValues,
  preservedProcessId: number | null,
): CodeWritePayload => ({
  code: values.code.trim(),
  name: values.name.trim(),
  parentId: values.parentId === '' ? null : Number(values.parentId),
  processId: preservedProcessId,
});

/**
 * 서버가 보낸 필드 이름 키를 폼 입력칸 이름 키로 옮긴다.
 * 공용 폼은 리소스 필드 이름을 모르므로 어댑터가 그 대응을 들고 있다.
 *
 * 화면이 모르는 이름은 여기서 버리지 않고 그냥 옮기지 않는다 —
 * 그런 오류는 `useMasterWrite`가 이미 배너로 올린다.
 */
export const toFormFieldErrors = (
  serverErrors: Record<string, string>,
  serverFields: ServerFieldNames,
): Partial<Record<keyof CodeFormValues, string>> => {
  const errors: Partial<Record<keyof CodeFormValues, string>> = {};

  for (const [field, message] of Object.entries(serverErrors)) {
    if (field === serverFields.code) errors.code = message;
    else if (field === serverFields.name) errors.name = message;
    else if (field === serverFields.parentId) errors.parentId = message;
  }

  return errors;
};

/** 폼 입력칸을 고쳤을 때 지울 서버 오류의 키를 되돌린다. */
export const toServerFieldName = (
  field: keyof CodeFormValues,
  serverFields: ServerFieldNames,
): string => {
  switch (field) {
    case 'code':
      return serverFields.code;
    case 'name':
      return serverFields.name;
    case 'parentId':
      return serverFields.parentId;
  }
};
