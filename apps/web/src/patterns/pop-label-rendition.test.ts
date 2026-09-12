import type { ApiClient } from '@omf-mes/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchLabelRendition,
  labelRenditionFormat,
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

/**
 * 라벨을 무슨 형식으로 받는가(#1104).
 *
 * ⭐ **드라이버를 건너뛰기 위한 판정이다.** 그림은 Windows 드라이버를 거쳐 프린터로 가는데,
 * 실기의 라벨 프린터는 TSPL 로 설정돼 있고 드라이버가 다른 언어를 내보내 **작업을 받아들이고
 * 버렸다** — 라벨이 한 장도 나오지 않았다(2026-09-12). 명령형으로 받으면 셸이 대기열의 RAW
 * 자리로 그대로 보낸다.
 */
describe('라벨 형식 선택', () => {
  afterEach(() => {
    delete (globalThis as { pop?: unknown }).pop;
  });

  it('셸이 있으면 명령형으로 받는다 — 드라이버를 거치지 않는다', () => {
    (globalThis as { pop?: unknown }).pop = { rendition: { save: async () => '' } };

    expect(labelRenditionFormat()).toBe('tspl');
  });

  it('셸이 없으면 그림으로 받는다 — 브라우저로 여는 개발 확인에는 RAW 통로가 없다', () => {
    expect(labelRenditionFormat()).toBe('png');
  });

  it('⛔ 통로가 반쪽이면 명령형으로 받지 않는다 — 보낼 곳 없는 명령이 된다', () => {
    (globalThis as { pop?: unknown }).pop = { rendition: {} };

    expect(labelRenditionFormat()).toBe('png');
  });
});

/*
 * ⚠ **「고른 형식을 요청에 싣는가」는 이 실행에서 잴 수 없다.** `fetchLabelRendition` 은
 *   `MODE !== 'development'` 이면 **요청을 만들기 «전»에** 거부하고(#1083), 시험 실행의
 *   `MODE` 는 `test` 다 — 빌드 시점 상수로 접히므로 같은 실행 안에서 두 갈래를 함께 세울 수
 *   없다. 미리보기가 `png` 를 명시하는지는 **호출부의 리터럴과 주석이 지킨다**(리뷰 2회차).
 */
