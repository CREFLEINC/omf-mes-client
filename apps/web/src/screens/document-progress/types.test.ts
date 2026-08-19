import { describe, expect, it } from 'vitest';

import { documentProgress, toProgressResponse } from './fixtures';
import { toDocumentProgressView, type DocumentProgressResponse } from './types';

describe('toDocumentProgressView', () => {
  it('쓰는 값만 옮긴다 — 승인 요청 번호·화면 ID는 자리가 없다', () => {
    const response = toProgressResponse(documentProgress()) as DocumentProgressResponse;

    const view = toDocumentProgressView(response);

    expect(view).toEqual({
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
    });
  });

  /*
   * 응답에 실려 온 내부 번호가 화면 타입으로 넘어오면 그 값이 화면에 샐 경로가 생긴다.
   * **자리가 없다**는 것을 값으로 확인한다 — 타입만으로는 런타임의 여분 키를 잡지 못한다.
   */
  it('응답에 실려 온 승인 요청 번호와 화면 ID를 담지 않는다', () => {
    const response = toProgressResponse(documentProgress()) as DocumentProgressResponse;

    const view = toDocumentProgressView(response);

    expect(Object.keys(view)).not.toContain('cancelApprovalRequestId');
    expect(Object.keys(view)).not.toContain('screenId');
  });

  /* 계약이 선택으로 둔 두 자리 — 없이 오는 문서가 실재한다. 없음을 없음으로 옮긴다. */
  it('세부구분과 취소 불가 사유가 오지 않으면 null이다', () => {
    const view = toDocumentProgressView({
      documentTypeCode: 'SYN_DOC_TYPE_A',
      documentId: 9004,
      documentNo: 'SYN-GR-2026-0004',
      documentDate: '2026-08-08',
      statusCode: 'SYN_STATUS_A',
      plannedQty: 10,
      processedQty: 0,
      remainingQty: 10,
      successorCount: 0,
      cancellable: false,
    });

    expect(view.documentSubTypeCode).toBeNull();
    expect(view.cancelBlockedReasonCode).toBeNull();
  });

  /* `?? null`이 빈 문자열을 통과시키는지 본다 — 빈 코드는 「없음」이 아니라 빈 코드다. */
  it('빈 문자열로 온 세부구분을 null로 바꾸지 않는다', () => {
    const view = toDocumentProgressView(
      toProgressResponse(documentProgress({ documentSubTypeCode: '' })) as DocumentProgressResponse,
    );

    expect(view.documentSubTypeCode).toBe('');
  });
});
