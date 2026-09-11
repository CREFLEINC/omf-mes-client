import { describe, expect, it } from 'vitest';

import {
  fetchLabelRendition,
  LabelRenditionNotReadyError,
  LABEL_RENDITION_NOT_READY_REASON,
} from './pop-label-rendition';

/**
 * `GET /app/document-issues/{documentIssueLogId}/rendition` 은 서버에 경로 자체가 없다
 * (대응표 P1 「미구현 5건」). 이 파일 머리말이 설명하듯 화면 일곱 곳이 실제 `client.GET(...)`
 * 대신 `fetchLabelRendition` 을 부른다 — 그 유일한 계약은 **네트워크 요청을 만들지 않고
 * 항상 거부한다**는 것이다.
 */
describe('fetchLabelRendition — 미구현 오퍼레이션을 대신 막는 대역', () => {
  it('언제나 거부한다 — 성공으로 빠지는 길이 없다', async () => {
    await expect(fetchLabelRendition()).rejects.toBeInstanceOf(LabelRenditionNotReadyError);
  });

  it('거부 사유가 「준비 중」임을 사람이 읽을 수 있게 담는다', async () => {
    await expect(fetchLabelRendition()).rejects.toThrow(LABEL_RENDITION_NOT_READY_REASON);
  });

  /*
   * ⛔ **다른 실패와 섞이지 않는다.** 호출부가 `instanceof` 로 이 실패를 가려 «발행 실패»나
   * 네트워크 오류와 다르게 다루므로(예: `shipping-packing-label/mutations.ts` 의
   * `stepFailureOf`), 이름이 일반 `Error` 로 뭉개지지 않아야 한다.
   */
  it('이름이 일반 Error 와 구분된다', async () => {
    try {
      await fetchLabelRendition();
      expect.unreachable('반드시 거부해야 한다');
    } catch (error) {
      expect(error).toBeInstanceOf(LabelRenditionNotReadyError);
      expect((error as Error).name).toBe('LabelRenditionNotReadyError');
    }
  });
});
