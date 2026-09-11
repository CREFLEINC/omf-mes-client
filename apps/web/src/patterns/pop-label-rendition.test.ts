import type { ApiClient } from '@omf-mes/api-client';
import { describe, expect, it, vi } from 'vitest';

import {
  fetchLabelRendition,
  LabelRenditionNotReadyError,
  LABEL_RENDITION_NOT_READY_REASON,
} from './pop-label-rendition';

/**
 * `GET /app/document-issues/{documentIssueLogId}/rendition` 은 **실서버에 경로가 없다.**
 * 그래서 호출 여부를 모드가 가른다(#1083) — 개발 모드만 부르고, 그 밖(배포본·이 시험 실행)은
 * **요청을 만들지 않고 거부한다.**
 *
 * ⭐ 이 시험이 도는 `MODE` 는 `test` 다 — 그래서 여기서 확인하는 것은 **부르지 않는 쪽**이다.
 * 개발 모드 갈래는 빌드 시점 상수로 접히므로 같은 실행 안에서 두 갈래를 함께 세울 수 없다.
 */
const clientSpy = () => {
  const get = vi.fn();

  return { get, client: { GET: get } as unknown as ApiClient['client'] };
};

describe('fetchLabelRendition — 배포본에서는 부르지 않는다', () => {
  it('거부한다 — 성공으로 빠지는 길이 없다', async () => {
    const { client } = clientSpy();

    await expect(fetchLabelRendition(client, 44101)).rejects.toBeInstanceOf(
      LabelRenditionNotReadyError,
    );
  });

  /** ⛔ 없는 경로를 두드리지 않는다 — 거부는 네트워크 «앞»에서 난다. */
  it('요청을 만들지 않는다', async () => {
    const { get, client } = clientSpy();

    await expect(fetchLabelRendition(client, 44101)).rejects.toBeInstanceOf(
      LabelRenditionNotReadyError,
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('거부 사유가 「준비 중」임을 사람이 읽을 수 있게 담는다', async () => {
    const { client } = clientSpy();

    await expect(fetchLabelRendition(client, 44101)).rejects.toThrow(
      LABEL_RENDITION_NOT_READY_REASON,
    );
  });

  /*
   * ⛔ **다른 실패와 섞이지 않는다.** 호출부가 `instanceof` 로 이 실패를 가려 «발행 실패»나
   * 네트워크 오류와 다르게 다루므로(예: `shipping-packing-label/mutations.ts` 의
   * `stepFailureOf`), 이름이 일반 `Error` 로 뭉개지지 않아야 한다.
   */
  it('이름이 일반 Error 와 구분된다', async () => {
    const { client } = clientSpy();

    try {
      await fetchLabelRendition(client, 44101);
      expect.unreachable('반드시 거부해야 한다');
    } catch (error) {
      expect(error).toBeInstanceOf(LabelRenditionNotReadyError);
      expect((error as Error).name).toBe('LabelRenditionNotReadyError');
    }
  });
});
