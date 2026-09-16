import type { ApiClient } from '@omf-mes/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchLabelRendition,
  labelRenditionFormat,
  LabelRenditionNotReadyError,
  LABEL_RENDITION_NOT_READY_REASON,
  READY_RENDITION_DOCUMENT_TYPES,
} from './pop-label-rendition';

/**
 * 준비된 문서 종류만 배포 호출을 허용한다. 자재·생산 LOT 라벨은 TSPL·PNG 둘 다 받을 수 있고,
 * 미지정 문서 종류는 기존처럼 네트워크 전에 거부한다.
 */
const clientSpy = () => {
  const get = vi.fn();

  return { get, client: { GET: get } as unknown as ApiClient['client'] };
};

describe('fetchLabelRendition — 준비된 문서 종류만 배포 호출', () => {
  it('준비된 종류의 PNG를 조회한다', async () => {
    const { get, client } = clientSpy();
    const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
    get.mockResolvedValue({ data: bytes, response: new Response(bytes) });
    await expect(fetchLabelRendition(client, 44101, 'png', 'MATERIAL_LOT_LABEL')).resolves.toEqual(bytes);
    expect(get).toHaveBeenCalledWith('/app/document-issues/{documentIssueLogId}/rendition',
      expect.objectContaining({ params: { path: { documentIssueLogId: 44101 }, query: { format: 'png' } } }));
  });

  /*
   * ⛔ **납품 라벨은 준비 목록에 없다 — 서버가 그리지 않는다**(전달본 v4 · 422). 종전에는
   *    배분의 `delivery_label_no` 로 서버가 그렸는데 주인이 출하 단위로 옮겨가며 그 코드가
   *    걷혔다. 적어 두면 배포본에서 요청이 나가고 422 가 돌아와, 사용자는 「발행이 실패했다」로
   *    읽는다 — 기록은 멀쩡히 남았는데도.
   *
   * ⚠ 형이 이미 막고 있어(`ReadyRenditionDocumentType`) 부르는 자리는 컴파일에서 걸린다.
   *   이 시험은 **목록 자체**를 붙든다 — 형은 목록에서 나오므로 목록이 정본이다.
   */
  it('납품 라벨을 준비 목록에 두지 않는다', () => {
    expect([...READY_RENDITION_DOCUMENT_TYPES]).not.toContain('DELIVERY_LABEL');
  });
  it('배포본 자재 LOT 라벨의 TSPL rendition을 조회한다', async () => {
    const { get, client } = clientSpy();
    const bytes = new TextEncoder().encode('SIZE 60 mm,40 mm').buffer;
    get.mockResolvedValue({ data: bytes, response: new Response(bytes) });
    await expect(fetchLabelRendition(client, 44102, 'tspl', 'MATERIAL_LOT_LABEL')).resolves.toEqual(bytes);
    expect(get).toHaveBeenCalledWith('/app/document-issues/{documentIssueLogId}/rendition',
      expect.objectContaining({ params: { path: { documentIssueLogId: 44102 }, query: { format: 'tspl' } } }));
  });
  /*
   * 서버가 생산 LOT 라벨의 그림을 그려 준다(실측 2026-09-15). 없던 시절의 가정을 남겨 두어
   * 배포본에서 이 요청이 만들어지지 않았고, 인쇄가 서지 못해 LOT 마감이 통째로 막혔다
   * (WIP-CHAIN-01 D1). 배포 모드에서 요청이 나가는 것을 여기서 고정한다.
   */
  it('배포본 생산 LOT 라벨의 rendition을 조회한다', async () => {
    const { get, client } = clientSpy();
    const bytes = new TextEncoder().encode('SIZE 40 mm,30 mm').buffer;
    get.mockResolvedValue({ data: bytes, response: new Response(bytes) });

    await expect(
      fetchLabelRendition(client, 44103, 'tspl', 'PRODUCTION_LOT_LABEL'),
    ).resolves.toEqual(bytes);
    expect(get).toHaveBeenCalledWith(
      '/app/document-issues/{documentIssueLogId}/rendition',
      expect.objectContaining({
        params: { path: { documentIssueLogId: 44103 }, query: { format: 'tspl' } },
      }),
    );
  });

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
