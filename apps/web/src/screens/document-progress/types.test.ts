import { describe, expect, it } from 'vitest';

import { documentProgress, toProgressResponse } from './fixtures';
import {
  toCancelExecutionView,
  toDocumentProgressDetailView,
  toDocumentProgressView,
  type CancelResultResponse,
  type DocumentProgressDetailResponse,
  type DocumentProgressResponse,
} from './types';

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

describe('toDocumentProgressDetailView', () => {
  const response = (): DocumentProgressDetailResponse =>
    ({
      progress: toProgressResponse(documentProgress({ statusCode: 'SYN_STATUS_DETAIL' })),
      steps: [
        {
          stepCode: 'SYN_STEP_A',
          occurredAt: '2026-08-06T09:14:00+09:00',
          actorName: '홍길동',
          inventoryTransactionNo: 'SYN-TX-0001',
          businessDate: '2026-08-06',
        },
        { stepCode: 'SYN_STEP_B', occurredAt: '2026-08-06T10:00:00+09:00' },
      ],
      successors: [
        {
          successorTypeCode: 'SYN_DOC_TYPE_B',
          successorId: 9101,
          successorNo: 'SYN-GI-2026-0101',
          qty: 400,
          screenId: 'SYN-SCREEN-02',
        },
        {
          successorTypeCode: 'SYN_DOC_TYPE_B',
          successorId: 9102,
          successorNo: 'SYN-GI-2026-0102',
          qty: 100,
        },
      ],
    }) as DocumentProgressDetailResponse;

  /**
   * ⭐ **요약의 근거는 상세 응답의 `progress`다.** 목록 행을 그대로 다시 그리면 두 조회의 시점이
   * 갈려 같은 화면의 위아래가 서로 다른 수량을 말할 수 있다.
   */
  it('요약을 상세 응답의 progress에서 옮긴다', () => {
    const view = toDocumentProgressDetailView(response());

    expect(view.progress.statusCode).toBe('SYN_STATUS_DETAIL');
    expect(view.progress.documentNo).toBe('SYN-GR-2026-0001');
  });

  /**
   * 요약은 목록 행과 **같은 옮기기**를 지난다 — 내부 번호가 요약 쪽으로만 새는 길을 두지 않는다.
   * 문서를 여는 화면 ID는 **상세 뷰가 따로** 들고 있다(목록 행에는 자리가 없다).
   */
  it('요약에는 화면 ID 자리가 없고 상세가 그 값을 든다', () => {
    const view = toDocumentProgressDetailView(response());

    expect(Object.keys(view.progress)).not.toContain('screenId');
    expect(view.screenId).toBe('SYN-SCREEN-01');
  });

  /* 계약이 선택으로 둔 자리들 — 없이 오는 단계·후속이 실재한다. 없음을 없음으로 옮긴다. */
  it('오지 않은 선택 필드를 null로 옮긴다', () => {
    const view = toDocumentProgressDetailView(response());

    expect(view.steps[1]).toEqual({
      stepCode: 'SYN_STEP_B',
      occurredAt: '2026-08-06T10:00:00+09:00',
      actorName: null,
      inventoryTransactionNo: null,
      businessDate: null,
    });
    expect(view.successors[1]?.screenId).toBeNull();
  });

  /* 차례를 바꾸지 않는다 — 처리 경과는 시간순이 곧 뜻이다(계약이 그렇게 내린다). */
  it('단계와 후속의 차례를 응답 그대로 둔다', () => {
    const view = toDocumentProgressDetailView(response());

    expect(view.steps.map((step) => step.stepCode)).toEqual(['SYN_STEP_A', 'SYN_STEP_B']);
    expect(view.successors.map((successor) => successor.successorNo)).toEqual([
      'SYN-GI-2026-0101',
      'SYN-GI-2026-0102',
    ]);
  });

  /**
   * ⭐ **취소 요청의 승인 요청 번호는 상세 뷰가 든다**(단위 ④). 목록 행에는 자리가 없다 —
   * 목록은 취소를 실행하지 않으므로 담으면 화면으로 샐 경로만 생긴다(omf-mes#44).
   */
  it('요약에는 승인 요청 번호 자리가 없고 상세가 그 값을 든다', () => {
    const view = toDocumentProgressDetailView(response());

    expect(Object.keys(view.progress)).not.toContain('cancelApprovalRequestId');
    expect(view.cancelApprovalRequestId).toBe(9501);
  });

  /**
   * ⛔ **값을 고르지 않고 그대로 나른다.** 0·음수·소수를 여기서 걸러 내면 「요청이 없다」와
   * 「값이 이상하다」가 섞이고, 그 둘은 화면이 하는 말이 다르다 — 판정은 `readSubmission`
   * 한 곳이다.
   */
  it.each([0, -1, 1.5])('조회할 수 없는 값도 그대로 나른다', (raw) => {
    const detail = response();
    const view = toDocumentProgressDetailView({
      ...detail,
      progress: { ...detail.progress, cancelApprovalRequestId: raw },
    });

    expect(view.cancelApprovalRequestId).toBe(raw);
  });

  /** 계약이 선택으로 둔 자리다 — 오지 않으면 없음이다. */
  it('승인 요청 번호가 오지 않으면 null이다', () => {
    const detail = response();
    const { cancelApprovalRequestId: _omitted, ...progress } = detail.progress;
    const view = toDocumentProgressDetailView({ ...detail, progress });

    expect(view.cancelApprovalRequestId).toBeNull();
  });
});

describe('toCancelExecutionView', () => {
  const response = (overrides: Partial<CancelResultResponse> = {}): CancelResultResponse => ({
    documentTypeCode: 'SYN_DOC_TYPE_B',
    documentId: 9001,
    statusCode: 'SYN_STATUS_CANCELLED',
    reversed: true,
    reversalTransactionNo: 'SYN-TX-9501',
    reversalBusinessDate: '2026-08-07',
    ...overrides,
  });

  /**
   * ⛔ **문서 번호와 유형 코드를 담지 않는다.** 앞은 내부 식별자라 사용자에게 뜻이 없고
   * (omf-mes#44), 뒤는 이미 위 요약이 말한다 — 담지 않으면 화면으로 샐 경로가 없다.
   */
  it('쓰는 값만 옮긴다', () => {
    expect(toCancelExecutionView(response())).toEqual({
      statusCode: 'SYN_STATUS_CANCELLED',
      reversed: true,
      reversalTransactionNo: 'SYN-TX-9501',
      reversalBusinessDate: '2026-08-07',
    });
  });

  it('내부 번호와 유형 코드에는 자리가 없다', () => {
    const keys = Object.keys(toCancelExecutionView(response()));

    expect(keys).not.toContain('documentId');
    expect(keys).not.toContain('documentTypeCode');
  });

  /* 계약이 둘 다 선택으로 두어 반쪽·없음으로 오는 갈래가 실재한다. 없음을 없음으로 옮긴다. */
  it('오지 않은 원장 값을 null로 옮긴다', () => {
    const view = toCancelExecutionView(
      response({ reversed: false, reversalTransactionNo: undefined }),
    );

    expect(view.reversalTransactionNo).toBeNull();
    expect(view.reversed).toBe(false);
  });
});
