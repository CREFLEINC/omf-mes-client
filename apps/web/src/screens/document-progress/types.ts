import type { components } from '@omf-mes/api-client';

/**
 * W-01-13 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 화면은 **여러 유형의 물류 문서를 한 목록으로 가로질러 보고, 그중 셋을 승인을 경유해
 * 되돌린다.** 이 회차(작업 단위 ①)는 그중 **목록까지**다 — 상세·취소 요청·승인 진행·취소 실행의
 * 타입은 그 조작이 실제로 생기는 회차에서 이 파일에 더한다. 미리 두면 아무도 지나지 않는
 * 변환기가 남는다.
 *
 * ⭐ **후속 판정을 화면이 하지 않는다.** 「이 문서를 취소할 수 있는가」·「후속이 몇 건인가」는
 * 서버가 판정해 내려주고 화면은 그 결과만 쓴다. 원천 참조가 다형이라 화면이 유형↔후속 관계표를
 * 만들면 유형이 늘 때마다 판정이 조용히 틀린다(공유계약 A-10 보강 · 계약 본문이 같은 말을 적었다).
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

export type DocumentProgressResponse = components['schemas']['DocumentProgress'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 선택칸의 항목 하나.
 *
 * **`disabled`를 담는다** — 외주 2문서처럼 목록에 두되 고를 수 없는 유형이 있기 때문이다
 * (omf-mes#82). 목록에서 아예 빼면 「왜 그 유형이 없는지」를 화면 어디에서도 읽을 수 없다.
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * 화면이 다루는 진행현황 한 건.
 *
 * **계약 응답을 통째로 넓히지 않고 이 회차가 쓰는 값만 옮긴다.** 응답에는 취소 요청의 승인 요청
 * 번호(`cancelApprovalRequestId`)와 문서를 여는 화면 ID(`screenId`)도 함께 오는데, 이 회차의
 * 목록은 그 둘을 그리지도 보내지도 않는다 — 타입에 자리를 두지 않으면 그 값이 화면으로 샐
 * 경로도 없다(omf-mes#44). 둘은 각각 단위 ④·②에서 자리를 얻는다.
 *
 * **수량 셋을 함께 담는다.** 계획·처리·잔여가 한 줄에서 함께 읽혀야 「어디까지 갔는가」가 보이고,
 * 그것이 이 화면의 이름(진행현황)이 뜻하는 것이다.
 *
 * **`cancellable`과 `cancelBlockedReasonCode`를 짝으로 담는다** — 거짓인데 사유를 담지 않으면
 * 화면이 「왜 안 되는지」를 말할 수단이 없어 사용자가 상세를 열어 확인할 수밖에 없다. 목록 열에서
 * 대상을 고르게 하는 것이 이 화면의 요점이다(착수 이슈 §6).
 */
export interface DocumentProgressView {
  documentTypeCode: string;
  documentId: number;
  documentNo: string;
  /** `YYYY-MM-DD`. 계약이 date로 두어 시각이 없다 — 시간대 옮김이 필요 없다. */
  documentDate: string;
  /**
   * 유형 안의 구분. 계약이 선택으로 두어 **없이 오는 문서가 실재한다** —
   * 없음을 없음으로 옮긴다. 빈 문자열로 메우면 「구분이 없다」와 「빈 구분」이 섞인다.
   */
  documentSubTypeCode: string | null;
  statusCode: string;
  plannedQty: number;
  processedQty: number;
  remainingQty: number;
  /** 이 문서를 원천으로 삼는 하류 문서 수. **서버가 센 값을 그대로 쓴다.** */
  successorCount: number;
  /** 지금 취소 **요청**을 낼 수 있는가. 「지금 취소를 실행할 수 있는가」가 아니다(계약 설명). */
  cancellable: boolean;
  /** `cancellable`이 거짓인 이유. 계약이 선택으로 두어 **오지 않는 갈래가 따로 있다.** */
  cancelBlockedReasonCode: string | null;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toDocumentProgressView = (data: DocumentProgressResponse): DocumentProgressView => ({
  documentTypeCode: data.documentTypeCode,
  documentId: data.documentId,
  documentNo: data.documentNo,
  documentDate: data.documentDate,
  documentSubTypeCode: data.documentSubTypeCode ?? null,
  statusCode: data.statusCode,
  plannedQty: data.plannedQty,
  processedQty: data.processedQty,
  remainingQty: data.remainingQty,
  successorCount: data.successorCount,
  cancellable: data.cancellable,
  cancelBlockedReasonCode: data.cancelBlockedReasonCode ?? null,
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface DocumentProgressListResult {
  items: DocumentProgressView[];
  page: PageMeta;
}
