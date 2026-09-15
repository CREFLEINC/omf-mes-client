import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useLayout } from './queries';
import { useDrawingReplace } from './use-drawing-replace';

/**
 * 도면 교체 — **두 호출 사이에서 무엇이 일어나는가**를 잰다.
 *
 * ⭐ 이 흐름의 실패는 전부 «조용하다». 저장 본문에서 도면 id 가 빠지면 화면은 성공을 말하고
 * 서버는 도면을 지운다. 409 뒤에 그대로 다시 보내면 남이 방금 올린 도면을 덮는다. 올리기가
 * 끝난 뒤 저장만 실패했는데 다시 올리면 고아 첨부가 하나 더 생긴다. 셋 다 화면에서는 보이지
 * 않으므로 여기서 본다.
 */

const WAREHOUSE_ID = 12;
const LAYOUT_PATH = `/mdm/warehouses/${String(WAREHOUSE_ID)}/layout`;
const UPLOAD_PATH = '/app/attachments';
const NEW_ATTACHMENT_ID = 5001;

const pathOf = (request: Request): string => new URL(request.url).pathname;

interface MarkerSeed {
  locationId: number;
  x: number;
  y: number;
}

interface LayoutSeed {
  etag: string;
  drawingAttachmentId: number | null;
  markers: MarkerSeed[];
}

interface ReplaceBody {
  markers: MarkerSeed[];
  drawingAttachmentId?: number;
}

interface PutRecord {
  headers: Headers;
  body: ReplaceBody;
}

interface UploadRecord {
  headers: Headers;
  /**
   * 보낸 멀티파트 원문.
   *
   * ⚠ **`request.formData()` 로 되읽지 않는다** — 시험 환경의 `File`(jsdom)과 `Request`(undici)가
   * 다른 구현이라 되읽기에서 거절된다. 실제로 나간 바이트를 그대로 보는 편이 더 정확하다.
   */
  text: string;
}

/** 멀티파트 한 칸의 값. 파일 칸은 `filename` 을 본다. */
const formField = (text: string, name: string): string | null =>
  new RegExp(`name="${name}"\\r?\\n\\r?\\n([^\\r\\n]*)`).exec(text)?.[1] ?? null;

const formFileName = (text: string): string | null =>
  /name="file"; filename="([^"]*)"/.exec(text)?.[1] ?? null;

const attachmentBody = (attachmentId: number) => ({
  attachmentId,
  targetTypeCode: 'WAREHOUSE',
  targetId: WAREHOUSE_ID,
  fileName: 'layout.png',
  contentType: 'image/png',
  byteSize: 4,
  uploadedAt: '2026-09-15T09:00:00+09:00',
});

const drawingFile = (name = 'layout.png'): File =>
  new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

const layoutResponse = (seed: LayoutSeed): Response =>
  jsonResponse(
    {
      warehouseId: WAREHOUSE_ID,
      ...(seed.drawingAttachmentId === null
        ? {}
        : { drawingAttachmentId: seed.drawingAttachmentId }),
      markers: seed.markers,
    },
    { headers: { ETag: seed.etag } },
  );

const conflictResponse = (): Response =>
  jsonResponse(
    { conflictCause: 'user', message: '다른 사용자가 먼저 수정했습니다.' },
    { status: 409 },
  );

/** 응답 시점을 시험이 쥔다 — 「올리는 중」·「저장하는 중」을 붙들어 보려면 필요하다. */
const deferred = (): { promise: Promise<Response>; settle: (response: Response) => void } => {
  let settle!: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => {
    settle = resolve;
  });

  return { promise, settle };
};

interface Script {
  /** 배치도 조회가 차례로 돌려줄 값. 모자라면 마지막 것을 되풀이한다. */
  layouts: LayoutSeed[];
  /** ⚠ 이 차례(0부터)의 배치도 조회는 500 으로 깨진다 — 409 뒤 재조회 실패를 재는 자리다. */
  layoutFailsAt?: number;
  /** 올리기 응답. 주지 않으면 첨부 하나를 만들어 준다. */
  upload?: () => Response | Promise<Response>;
  /** 저장 응답 — 부른 차례대로. 모자라면 마지막 것을 되풀이한다. */
  puts?: (() => Response | Promise<Response>)[];
}

const renderReplace = (script: Script) => {
  const layoutGets: Request[] = [];
  const uploads: UploadRecord[] = [];
  const puts: PutRecord[] = [];
  const putResponders = script.puts ?? [];

  const at = <T,>(list: T[], index: number): T => list[Math.min(index, list.length - 1)] as T;

  const routes: StubRoute[] = [
    {
      match: (request) => request.method === 'GET' && pathOf(request) === LAYOUT_PATH,
      respond: (request) => {
        const index = layoutGets.length;

        layoutGets.push(request);

        return script.layoutFailsAt === index
          ? jsonResponse({ message: '서버에 문제가 있습니다.' }, { status: 500 })
          : layoutResponse(at(script.layouts, index));
      },
    },
    {
      match: (request) => request.method === 'POST' && pathOf(request) === UPLOAD_PATH,
      respond: async (request) => {
        uploads.push({
          headers: new Headers(request.headers),
          text: await request.clone().text(),
        });

        return (
          script.upload ?? (() => jsonResponse(attachmentBody(NEW_ATTACHMENT_ID), { status: 201 }))
        )();
      },
    },
    {
      match: (request) => request.method === 'PUT' && pathOf(request) === LAYOUT_PATH,
      respond: async (request) => {
        const index = puts.length;

        puts.push({
          headers: new Headers(request.headers),
          body: (await request.clone().json()) as ReplaceBody,
        });

        return putResponders.length === 0
          ? layoutResponse({ ...at(script.layouts, 99), etag: '"99"' })
          : at(putResponders, index)();
      },
    },
  ];

  const onReplaced = vi.fn();
  const rendered = renderHookWithProviders(
    () => {
      const layout = useLayout(WAREHOUSE_ID);
      const replace = useDrawingReplace({
        warehouseId: WAREHOUSE_ID,
        currentDrawingAttachmentId: layout.data?.drawingAttachmentId ?? null,
        refetchLayout: layout.refetch,
        onReplaced,
      });

      return { layout, replace };
    },
    { fetch: createStubFetch(routes) },
  );

  return { ...rendered, layoutGets, uploads, puts, onReplaced };
};

/** 배치도가 도착할 때까지 — 잠금 토큰이 그 응답에 실려 온다. */
const loaded = async (result: { current: { layout: { isSuccess: boolean } } }): Promise<void> => {
  await waitFor(() => {
    expect(result.current.layout.isSuccess).toBe(true);
  });
};

const KEY_HEADER = 'Idempotency-Key';

describe('useDrawingReplace — 올리기와 저장을 잇는다', () => {
  it('⭐ 올리기 → 저장 순서로 부르고 단계가 uploading → saving → idle 로 지난다', async () => {
    const upload = deferred();
    const put = deferred();
    const { result, uploads, puts, onReplaced } = renderReplace({
      layouts: [
        { etag: '"7"', drawingAttachmentId: null, markers: [{ locationId: 7, x: 0.1, y: 0.2 }] },
      ],
      upload: () => upload.promise,
      puts: [() => put.promise],
    });

    await loaded(result);
    expect(result.current.replace.phase).toBe('idle');

    act(() => {
      result.current.replace.start(drawingFile());
    });

    await waitFor(() => {
      expect(result.current.replace.phase).toBe('uploading');
    });
    expect(puts).toHaveLength(0);

    await act(async () => {
      upload.settle(jsonResponse(attachmentBody(NEW_ATTACHMENT_ID), { status: 201 }));
      await upload.promise;
    });

    await waitFor(() => {
      expect(result.current.replace.phase).toBe('saving');
    });
    expect(result.current.replace.pendingAttachmentId).toBe(NEW_ATTACHMENT_ID);

    /* 올리기 — 다형 참조 두 칸과 파일, 그리고 전 쓰기 필수인 멱등 키. */
    const sent = uploads[0];

    expect(uploads).toHaveLength(1);
    expect(formField(sent?.text ?? '', 'targetTypeCode')).toBe('WAREHOUSE');
    expect(formField(sent?.text ?? '', 'targetId')).toBe(String(WAREHOUSE_ID));
    /*
     * ⚠ 파일 이름은 시험 환경에서 `blob` 이 된다 — jsdom 의 `File` 을 undici 가 제 `File` 로
     * 알아보지 못해 이름 없는 덩어리로 싣는다. 브라우저에서는 고른 파일 이름이 그대로 간다.
     * 여기서 재는 것은 **파일 칸이 파일로 실렸는가**이고, 그것은 형식에 남는다.
     */
    expect(formFileName(sent?.text ?? '')).not.toBeNull();
    expect(sent?.text).toContain('Content-Type: image/png');
    expect(sent?.headers.get(KEY_HEADER)).not.toBeNull();
    expect(sent?.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/);

    await act(async () => {
      put.settle(
        layoutResponse({
          etag: '"8"',
          drawingAttachmentId: NEW_ATTACHMENT_ID,
          markers: [{ locationId: 7, x: 0.1, y: 0.2 }],
        }),
      );
      await put.promise;
    });

    await waitFor(() => {
      expect(result.current.replace.phase).toBe('idle');
    });

    /* 저장 — 조회가 준 잠금 토큰과, 새 첨부 id, 그리고 **서버가 준 점 그대로**. */
    expect(puts).toHaveLength(1);
    expect(puts[0]?.headers.get('If-Match')).toBe('"7"');
    expect(puts[0]?.headers.get(KEY_HEADER)).not.toBeNull();
    expect(puts[0]?.body.drawingAttachmentId).toBe(NEW_ATTACHMENT_ID);
    expect(puts[0]?.body.markers).toEqual([{ locationId: 7, x: 0.1, y: 0.2 }]);

    expect(onReplaced).toHaveBeenCalledTimes(1);
    expect(result.current.replace.pendingAttachmentId).toBeNull();
    expect(result.current.replace.error).toBeNull();
    expect(result.current.replace.errorStep).toBeNull();
  });

  /*
   * ⛔ **돌연변이 감지 지점.** 저장은 도면과 점을 통째로 바꾸므로 본문에서 `drawingAttachmentId`
   * 를 빼면 서버는 「도면을 비우라」로 읽는다 — 방금 올린 도면이 그대로 사라진다.
   */
  it('⛔ 점이 이미 있는 배치에도 새 도면 id 를 싣는다 — 빠지면 서버가 도면을 지운다', async () => {
    const { result, puts } = renderReplace({
      layouts: [
        {
          etag: '"7"',
          drawingAttachmentId: 100,
          markers: [
            { locationId: 7, x: 0.1, y: 0.2 },
            { locationId: 8, x: 0.3, y: 0.4 },
          ],
        },
      ],
    });

    await loaded(result);

    act(() => {
      result.current.replace.start(drawingFile());
    });

    await waitFor(() => {
      expect(puts).toHaveLength(1);
    });

    expect(puts[0]?.body.drawingAttachmentId).toBe(NEW_ATTACHMENT_ID);
    expect(Object.keys(puts[0]?.body ?? {}).sort()).toEqual(['drawingAttachmentId', 'markers']);
    expect(puts[0]?.body.markers.map((marker) => marker.locationId)).toEqual([7, 8]);
  });

  it('⭐ 409 인데 도면이 그대로면 새 점·새 토큰으로 딱 한 번 다시 보낸다', async () => {
    const { result, puts, onReplaced } = renderReplace({
      layouts: [
        { etag: '"7"', drawingAttachmentId: 100, markers: [{ locationId: 7, x: 0.1, y: 0.2 }] },
        {
          etag: '"9"',
          drawingAttachmentId: 100,
          markers: [
            { locationId: 7, x: 0.1, y: 0.2 },
            /* 그사이 남이 점 하나를 더 찍었다 — 이 점을 덮지 않아야 한다. */
            { locationId: 9, x: 0.5, y: 0.6 },
          ],
        },
      ],
      puts: [
        conflictResponse,
        () =>
          layoutResponse({
            etag: '"10"',
            drawingAttachmentId: NEW_ATTACHMENT_ID,
            markers: [{ locationId: 7, x: 0.1, y: 0.2 }],
          }),
      ],
    });

    await loaded(result);

    act(() => {
      result.current.replace.start(drawingFile());
    });

    await waitFor(() => {
      expect(onReplaced).toHaveBeenCalledTimes(1);
    });

    expect(puts).toHaveLength(2);
    expect(puts[0]?.headers.get('If-Match')).toBe('"7"');
    expect(puts[1]?.headers.get('If-Match')).toBe('"9"');
    /* 다시 읽은 점을 그대로 싣는다 — 남이 찍은 점이 이 저장에서 지워지지 않는다. */
    expect(puts[1]?.body.markers.map((marker) => marker.locationId)).toEqual([7, 9]);
    expect(puts[1]?.body.drawingAttachmentId).toBe(NEW_ATTACHMENT_ID);
    /* 보낼 값이 달라졌으니 새 키다 — 서버가 앞 시도의 중복으로 흡수하면 안 된다. */
    expect(puts[1]?.headers.get(KEY_HEADER)).not.toBe(puts[0]?.headers.get(KEY_HEADER));

    expect(result.current.replace.phase).toBe('idle');
    expect(result.current.replace.pendingAttachmentId).toBeNull();
    expect(result.current.replace.error).toBeNull();
  });

  /*
   * ⛔ **감지 지점.** `refetch` 는 실패해도 직전 데이터를 그대로 돌려준다 — 그 값을 성공으로
   * 읽으면 옛 도면 id 가 「바뀌지 않았다」로 통과해, **낡은 잠금 토큰으로 두 번째 저장이 나간다.**
   */
  it('⛔ 409 뒤 재조회가 실패하면 다시 보내지 않는다 — 옛 토큰으로는 나가지 않는다', async () => {
    const { result, puts, layoutGets, onReplaced } = renderReplace({
      layouts: [
        { etag: '"7"', drawingAttachmentId: 100, markers: [{ locationId: 7, x: 0.1, y: 0.2 }] },
      ],
      /* 409 뒤의 재조회(두 번째 GET)가 깨진다. */
      layoutFailsAt: 1,
      puts: [conflictResponse],
    });

    await loaded(result);

    act(() => {
      result.current.replace.start(drawingFile());
    });

    await waitFor(() => {
      expect(result.current.replace.error?.kind).toBe('conflict');
    });

    /* 재조회는 실제로 나갔고(그리고 깨졌고), 저장은 그 한 번으로 끝났다. */
    expect(layoutGets).toHaveLength(2);
    expect(puts).toHaveLength(1);
    expect(result.current.replace.errorStep).toBe('save');
    expect(result.current.replace.pendingAttachmentId).toBe(NEW_ATTACHMENT_ID);
    expect(result.current.replace.phase).toBe('idle');
    expect(onReplaced).not.toHaveBeenCalled();
  });

  /*
   * ⛔ **감지 지점.** 멱등 키는 보낼 값의 지문으로 정해지므로, 재조회한 점이 앞 시도와 같으면
   * **같은 키가 다시 나간다** — 서버는 앞 요청의 중복으로 보고 그 409 를 되돌려 주고, 자동
   * 재시도는 무엇을 해도 실패한다. 409 는 실행 전 거부라 키를 붙들 이유가 없다.
   */
  it('⛔ 409 재시도는 점이 그대로여도 새 멱등 키로 나간다', async () => {
    const sameMarkers = [{ locationId: 7, x: 0.1, y: 0.2 }];
    const { result, puts, onReplaced } = renderReplace({
      layouts: [
        { etag: '"7"', drawingAttachmentId: 100, markers: sameMarkers },
        /* 남이 도면이 아닌 무언가를 건드려 판 번호만 올랐다 — 점은 그대로다. */
        { etag: '"9"', drawingAttachmentId: 100, markers: sameMarkers },
      ],
      puts: [
        conflictResponse,
        () =>
          layoutResponse({
            etag: '"10"',
            drawingAttachmentId: NEW_ATTACHMENT_ID,
            markers: sameMarkers,
          }),
      ],
    });

    await loaded(result);

    act(() => {
      result.current.replace.start(drawingFile());
    });

    await waitFor(() => {
      expect(onReplaced).toHaveBeenCalledTimes(1);
    });

    expect(puts).toHaveLength(2);
    /* 보낸 값은 같다 — 그런데도 키는 달라야 한다. */
    expect(puts[1]?.body).toEqual(puts[0]?.body);
    expect(puts[1]?.headers.get(KEY_HEADER)).not.toBe(puts[0]?.headers.get(KEY_HEADER));
    expect(puts[1]?.headers.get('If-Match')).toBe('"9"');
  });

  it('⛔ 409 인데 도면이 바뀌었으면 멈춘다 — 남이 올린 도면을 덮지 않는다', async () => {
    const { result, puts, onReplaced } = renderReplace({
      layouts: [
        { etag: '"7"', drawingAttachmentId: 100, markers: [{ locationId: 7, x: 0.1, y: 0.2 }] },
        /* 그사이 누군가 다른 도면을 붙였다. */
        { etag: '"9"', drawingAttachmentId: 777, markers: [{ locationId: 7, x: 0.1, y: 0.2 }] },
      ],
      puts: [conflictResponse],
    });

    await loaded(result);

    act(() => {
      result.current.replace.start(drawingFile());
    });

    await waitFor(() => {
      expect(result.current.replace.error?.kind).toBe('conflict');
    });

    expect(puts).toHaveLength(1);
    expect(result.current.replace.errorStep).toBe('save');
    /* 첨부는 이미 올라가 있다 — 화면이 「저장 다시 시도」를 낼 수 있어야 한다. */
    expect(result.current.replace.pendingAttachmentId).toBe(NEW_ATTACHMENT_ID);
    expect(result.current.replace.phase).toBe('idle');
    expect(onReplaced).not.toHaveBeenCalled();
  });

  it('⭐ 저장만 실패하면 다시 올리지 않고 저장만 다시 보낸다', async () => {
    const { result, uploads, puts } = renderReplace({
      layouts: [
        { etag: '"7"', drawingAttachmentId: null, markers: [{ locationId: 7, x: 0.1, y: 0.2 }] },
      ],
      puts: [
        () => {
          throw new Error('연결이 끊겼습니다');
        },
        () =>
          layoutResponse({
            etag: '"8"',
            drawingAttachmentId: NEW_ATTACHMENT_ID,
            markers: [{ locationId: 7, x: 0.1, y: 0.2 }],
          }),
      ],
    });

    await loaded(result);

    act(() => {
      result.current.replace.start(drawingFile());
    });

    await waitFor(() => {
      expect(result.current.replace.error?.kind).toBe('network');
    });
    expect(result.current.replace.errorStep).toBe('save');
    expect(result.current.replace.pendingAttachmentId).toBe(NEW_ATTACHMENT_ID);

    act(() => {
      result.current.replace.retrySave();
    });

    await waitFor(() => {
      expect(result.current.replace.pendingAttachmentId).toBeNull();
    });

    /* ⛔ 두 번째 올리기가 있으면 고아 첨부가 하나 더 생긴 것이다. */
    expect(uploads).toHaveLength(1);
    expect(puts).toHaveLength(2);
    /*
     * ⭐ 같은 값을 다시 보내는 것이므로 **같은 멱등 키**다 — 앞 요청이 서버에 닿았는지 모르는
     * 채로 새 키를 쓰면 통째 치환이 두 번 적용될 수 있다.
     */
    expect(puts[1]?.headers.get(KEY_HEADER)).toBe(puts[0]?.headers.get(KEY_HEADER));
    expect(result.current.replace.error).toBeNull();
  });

  it('올리기 실패는 저장으로 넘어가지 않는다 — 413·400 file·403 이 각자 자리로 나뉜다', async () => {
    const tooLarge = renderReplace({
      layouts: [{ etag: '"7"', drawingAttachmentId: null, markers: [] }],
      upload: () => jsonResponse({ message: '파일이 너무 큽니다.' }, { status: 413 }),
    });

    await loaded(tooLarge.result);

    act(() => {
      tooLarge.result.current.replace.start(drawingFile());
    });

    await waitFor(() => {
      expect(tooLarge.result.current.replace.error?.kind).toBe('http');
    });
    expect(tooLarge.result.current.replace.error).toEqual({
      kind: 'http',
      status: 413,
      message: '파일이 너무 큽니다.',
    });
    expect(tooLarge.result.current.replace.errorStep).toBe('upload');
    expect(tooLarge.result.current.replace.fileError).toBeNull();
    /* 올리기가 실패했으면 붙일 첨부가 없다 — 저장으로 넘어가지 않는다. */
    expect(tooLarge.result.current.replace.pendingAttachmentId).toBeNull();
    expect(tooLarge.puts).toHaveLength(0);
    expect(tooLarge.result.current.replace.phase).toBe('idle');

    const badFile = renderReplace({
      layouts: [{ etag: '"7"', drawingAttachmentId: null, markers: [] }],
      upload: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'file',
                code: 'INVALID_IMAGE',
                message: 'PNG·JPEG만 올릴 수 있습니다.',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await loaded(badFile.result);

    act(() => {
      badFile.result.current.replace.start(drawingFile('문서.png'));
    });

    await waitFor(() => {
      expect(badFile.result.current.replace.fileError).toBe('PNG·JPEG만 올릴 수 있습니다.');
    });
    /* 파일 칸에 낸 것은 배너로 겹쳐 내지 않는다. */
    expect(badFile.result.current.replace.error).toBeNull();
    expect(badFile.result.current.replace.errorStep).toBe('upload');
    expect(badFile.puts).toHaveLength(0);
    /* ⛔ 실패한 채로 굳지 않는다 — 단계가 남으면 화면의 버튼과 가림막이 영영 풀리지 않는다. */
    expect(badFile.result.current.replace.phase).toBe('idle');

    const forbidden = renderReplace({
      layouts: [{ etag: '"7"', drawingAttachmentId: null, markers: [] }],
      upload: () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'FORBIDDEN', message: '권한이 없습니다.' }] },
          { status: 403 },
        ),
    });

    await loaded(forbidden.result);

    act(() => {
      forbidden.result.current.replace.start(drawingFile());
    });

    await waitFor(() => {
      expect(forbidden.result.current.replace.error?.kind).toBe('validation');
    });
    /* 403 은 고칠 입력이 없는 거부다 — 상태가 남아야 화면이 「권한」으로 안내할 수 있다. */
    expect(forbidden.result.current.replace.error).toEqual({
      kind: 'validation',
      status: 403,
      errors: [{ scope: 'screen', code: 'FORBIDDEN', message: '권한이 없습니다.' }],
    });
    expect(forbidden.result.current.replace.fileError).toBeNull();
    expect(forbidden.puts).toHaveLength(0);
  });

  it('reset 은 남은 첨부와 오류를 버린다 — 창고가 바뀌면 그 첨부는 남의 것이다', async () => {
    const { result } = renderReplace({
      layouts: [{ etag: '"7"', drawingAttachmentId: null, markers: [] }],
      puts: [conflictResponse],
      /* 재조회가 같은 도면을 주면 한 번 더 보내고 또 409 — 그대로 멈춘다. */
    });

    await loaded(result);

    act(() => {
      result.current.replace.start(drawingFile());
    });

    await waitFor(() => {
      expect(result.current.replace.error?.kind).toBe('conflict');
    });
    expect(result.current.replace.pendingAttachmentId).toBe(NEW_ATTACHMENT_ID);

    act(() => {
      result.current.replace.reset();
    });

    expect(result.current.replace.pendingAttachmentId).toBeNull();
    expect(result.current.replace.error).toBeNull();
    expect(result.current.replace.errorStep).toBeNull();
    expect(result.current.replace.phase).toBe('idle');
  });
});
