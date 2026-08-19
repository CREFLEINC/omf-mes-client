import type { DocumentTypeEntry } from './document-types';
import type { DocumentProgressView } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 문서번호처럼 **실제로 보일 법한 값**을
 * 그리는 자리라, 한눈에 예시임이 보이는 접두(`SYN-`)와 지어낸 번호 대역만 쓴다.
 * 실 운영 문서번호·품목코드·LOT 번호·거래처 코드·고객사명을 넣지 않는다(공개 저장소 경계).
 *
 * **계약의 `@example` 값을 쓰지 않는다.** 예시를 픽스처에 쓰면 나중에 「확정 값」으로 읽힌다.
 * 유형·상태 코드도 `SYN_` 접두를 붙여, 값 목록이 확정되면 이 값들이 **확정 값이 아님**이
 * 한눈에 보이게 한다.
 *
 * **내부 번호는 9000번대**로 둔다. 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때
 * 수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다.
 */

const BASE_PROGRESS: DocumentProgressView = {
  documentTypeCode: 'SYN_DOC_TYPE_A',
  documentId: 9001,
  documentNo: 'SYN-GR-2026-0001',
  documentDate: '2026-08-06',
  documentSubTypeCode: 'SYN_SUB_A',
  statusCode: 'SYN_STATUS_A',
  plannedQty: 1200,
  processedQty: 1200,
  remainingQty: 0,
  successorCount: 0,
  cancellable: true,
  cancelBlockedReasonCode: null,
};

/** 한 항목만 다른 건을 만든다. 무엇이 다른지 그 인자만 보고 읽히게 한다. */
export const documentProgress = (
  overrides: Partial<DocumentProgressView> = {},
): DocumentProgressView => ({ ...BASE_PROGRESS, ...overrides });

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 네 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — 취소할 수 있는 문서. 후속 0건
 * - 9002 — **후속이 있어 막혔다.** 계약이 열거한 코드라 우리말 문면이 나온다
 * - 9003 — **계약에 없는 코드로 막혔다.** 그 코드 문자열이 그대로 보여야 한다
 * - 9004 — **막혔는데 사유 코드가 없다.** 계약이 선택으로 둔 자리라 실재하는 갈래다.
 *   세부구분도 없어 「값 없음」 표식 갈래를 함께 만든다
 */
export const documentProgressFixtures: DocumentProgressView[] = [
  documentProgress(),
  documentProgress({
    documentId: 9002,
    documentNo: 'SYN-GR-2026-0002',
    documentSubTypeCode: 'SYN_SUB_B',
    statusCode: 'SYN_STATUS_B',
    processedQty: 800,
    remainingQty: 400,
    successorCount: 2,
    cancellable: false,
    cancelBlockedReasonCode: 'SUCCESSOR_EXISTS',
  }),
  documentProgress({
    documentId: 9003,
    documentNo: 'SYN-GR-2026-0003',
    documentDate: '2026-08-07',
    successorCount: 1,
    cancellable: false,
    cancelBlockedReasonCode: 'SYN_UNKNOWN_BLOCK_REASON',
  }),
  documentProgress({
    documentId: 9004,
    documentNo: 'SYN-GR-2026-0004',
    documentDate: '2026-08-08',
    documentSubTypeCode: null,
    cancellable: false,
    cancelBlockedReasonCode: null,
  }),
];

/**
 * 목록 응답에 실리는 모양. **화면이 버리는 값이 응답에 있어야** 옮기기가 실제로 고르는지 보인다.
 *
 * 이 회차의 목록은 취소 요청의 승인 요청 번호와 화면 ID를 그리지 않는다 — 응답에는 담아 두고
 * 화면 타입에는 자리가 없다는 사실을 감지기가 잰다.
 */
interface ProgressResponseShape extends DocumentProgressView {
  cancelApprovalRequestId: number | null;
  screenId: string | null;
}

export const toProgressResponse = (view: DocumentProgressView): ProgressResponseShape => ({
  ...view,
  cancelApprovalRequestId: 9501,
  screenId: 'SYN-SCREEN-01',
});

/**
 * 값이 **채워진** 유형 표. 자리표시가 비어 있는 지금 화면이 어떻게 되는지와,
 * 값이 오면 무엇이 살아나는지를 **같은 감지기 짝**으로 재기 위한 것이다.
 *
 * 셋째 줄은 **고를 수 없는 유형**이다(외주 문서 자리 — omf-mes#82). 사유를 문면으로 담아 두어
 * 「비활성 + 사유 표시」가 실제로 그려지는지 잴 수 있게 한다.
 */
export const documentTypeFixtures: readonly DocumentTypeEntry[] = [
  { code: 'SYN_DOC_TYPE_A', label: '합성 유형 가', disabledReason: null },
  { code: 'SYN_DOC_TYPE_B', label: '합성 유형 나', disabledReason: null },
  {
    code: 'SYN_DOC_TYPE_C',
    label: '합성 유형 다',
    disabledReason: '이 유형에는 상태 컬럼이 없어 진행현황을 볼 수 없습니다',
  },
];
