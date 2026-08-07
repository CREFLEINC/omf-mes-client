import type { components } from '@omf-mes/api-client';

type BomComponent = components['schemas']['BomComponent'];
type BomComponentUpdate = components['schemas']['BomComponentUpdate'];

/**
 * 구성품 계약 표현과 폼 표현 사이의 변환. **이 화면에서 두 번째로 조심할 파일이다.**
 *
 * 계약의 `BomComponent`는 원본 열 여섯과 확장 열 넷을 한 객체에 담고, `BomComponentUpdate`는
 * 확장 열 넷만 받는다. 그런데 **서버가 그 경계를 막지 않는다** — 원본 열(`requiredQty` 등)을
 * 섞어 보내도 200이 돌아온다(계약 실측 P). 그래서 경계를 지키는 곳이 여기뿐이다.
 */

/**
 * 확장 열 넷의 폼 값. **여기에 원본 열이 없다.**
 * 폼에 담지 않으면 실수로도 요청 본문에 실을 수 없다 — 형태로 경계를 지킨다.
 */
export interface BomComponentFormValues {
  /** 계약이 널을 허용한다 — 비우는 것이 정상 값이다 */
  routingOperationId: string;
  /** 계약이 널을 허용한다 */
  actualUseProcessId: string;
  lotTraceRequired: boolean;
  backflushAllowed: boolean;
}

/** 화면이 소유한 입력칸 이름 — 서버 필드 오류를 인라인으로 낼지 고르는 기준이다. */
export const BOM_COMPONENT_FORM_FIELDS: readonly string[] = [
  'routingOperationId',
  'actualUseProcessId',
  'lotTraceRequired',
  'backflushAllowed',
];

const optionalNumberText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

/** 계약 표현을 폼 표현으로. 널·없음을 빈 문자열로 모은다 — 「지정하지 않음」이 하나의 값이어야 한다. */
export const componentToFormValues = (component: BomComponent): BomComponentFormValues => ({
  routingOperationId: optionalNumberText(component.routingOperationId),
  actualUseProcessId: optionalNumberText(component.actualUseProcessId),
  lotTraceRequired: component.lotTraceRequired,
  backflushAllowed: component.backflushAllowed,
});

/**
 * 구성품 확장 열 수정 요청 본문.
 *
 * **키를 하나씩 열거해 만든다. 폼 값을 스프레드하지 않는다** — 스프레드를 쓰면 폼에 무엇이
 * 더해지든 그대로 서버로 나가고, 원본 열이 섞여도 서버가 막지 않는다(실측 P).
 *
 * **비운 공정은 키를 빼지 않고 널을 명시한다.** 키를 빼면 서버가 이전 값을 남길 수 있어
 * 한 번 넣은 공정을 지울 방법이 사라진다.
 */
export const toBomComponentUpdate = (values: BomComponentFormValues): BomComponentUpdate => ({
  routingOperationId: values.routingOperationId === '' ? null : Number(values.routingOperationId),
  actualUseProcessId: values.actualUseProcessId === '' ? null : Number(values.actualUseProcessId),
  lotTraceRequired: values.lotTraceRequired,
  backflushAllowed: values.backflushAllowed,
});

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameBomComponentValues = (
  a: BomComponentFormValues,
  b: BomComponentFormValues,
): boolean =>
  a.routingOperationId === b.routingOperationId &&
  a.actualUseProcessId === b.actualUseProcessId &&
  a.lotTraceRequired === b.lotTraceRequired &&
  a.backflushAllowed === b.backflushAllowed;
