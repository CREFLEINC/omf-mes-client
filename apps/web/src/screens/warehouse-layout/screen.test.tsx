import { messages } from '@omf-mes/i18n';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { DRAWING_MAX_BYTES } from './layout-draft';
import { WarehouseLayoutScreen } from './screen';

/**
 * W-CO-08 화면 — **도면이 보이고, 갈리고, 갈리는 동안 화면이 말하는가.**
 *
 * ⭐ 이 화면의 실패는 조용하다. 도면 주소를 잘못 만들면 「깨진 그림」 하나만 남고, 저장 본문에서
 * 도면 id 가 빠지면 화면은 성공을 말하면서 서버는 도면을 지운다. 올리는 동안 아무 말이 없으면
 * 사용자는 같은 파일을 한 번 더 고른다 — 그러면 고아 첨부가 하나 더 생긴다. 그 셋을 여기서 본다.
 */

const t = messages.warehouseLayout;

const WAREHOUSE_ID = 12;
const LAYOUT_PATH = `/mdm/warehouses/${String(WAREHOUSE_ID)}/layout`;
const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
const UPLOAD_PATH = '/app/attachments';
const OLD_ATTACHMENT_ID = 100;
const NEW_ATTACHMENT_ID = 5001;
const ROUTE = `/?warehouse=${String(WAREHOUSE_ID)}`;
const BLOB_URL = 'blob:drawing';

/** 작은 PNG — 시그니처만 있으면 된다. 이 시험이 재는 것은 바이트가 아니라 «길»이다. */
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const pathOf = (request: Request): string => new URL(request.url).pathname;

const contentPath = (attachmentId: number): string =>
  `/app/attachments/${String(attachmentId)}/content`;

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

const LOCATION_ROWS = [
  { locationId: 7, locationCode: 'SYN-LOC-07', locationName: '합성 위치 가', isActive: true },
  { locationId: 8, locationCode: 'SYN-LOC-08', locationName: '합성 위치 나', isActive: true },
];

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 20, total: items.length },
});

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

const attachmentBody = (attachmentId: number) => ({
  attachmentId,
  targetTypeCode: 'WAREHOUSE',
  targetId: WAREHOUSE_ID,
  fileName: 'layout.png',
  contentType: 'image/png',
  byteSize: PNG_BYTES.length,
  uploadedAt: '2026-09-15T09:00:00+09:00',
});

const conflictResponse = (): Response =>
  jsonResponse(
    { conflictCause: 'user', message: '다른 사용자가 먼저 수정했습니다.' },
    { status: 409 },
  );

const pngFile = (name = 'layout.png'): File => new File([PNG_BYTES], name, { type: 'image/png' });

/** 크기만 부풀린다 — 10MB 를 실제로 만들면 시험이 그 할당에 시간을 다 쓴다. */
const hugePngFile = (): File => {
  const file = pngFile('큰도면.png');

  Object.defineProperty(file, 'size', { value: DRAWING_MAX_BYTES + 1 });

  return file;
};

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
  /** 이 창고의 위치들. 주지 않으면 둘을 준다 — **0건도 실재하는 창고 상태다.** */
  locations?: typeof LOCATION_ROWS;
  /** 도면 내용 응답. 주지 않으면 PNG 바이트를 돌려준다. */
  content?: () => Response | Promise<Response>;
  upload?: () => Response | Promise<Response>;
  /** 저장 응답 — 부른 차례대로. 모자라면 마지막 것을 되풀이한다. */
  puts?: (() => Response | Promise<Response>)[];
}

const renderScreen = (script: Script) => {
  const layoutGets: Request[] = [];
  const uploads: string[] = [];
  const puts: PutRecord[] = [];
  const contentGets: Request[] = [];
  const putResponders = script.puts ?? [];

  const at = <T,>(list: T[], index: number): T => list[Math.min(index, list.length - 1)] as T;

  const routes: StubRoute[] = [
    {
      match: (request) => request.method === 'GET' && pathOf(request) === WAREHOUSES_PATH,
      respond: () =>
        jsonResponse(
          listBody([
            {
              warehouseId: WAREHOUSE_ID,
              warehouseCode: 'SYN-WH-12',
              warehouseName: '합성 창고',
              isActive: true,
            },
          ]),
        ),
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === LOCATIONS_PATH,
      respond: () => jsonResponse(listBody(script.locations ?? LOCATION_ROWS)),
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === LAYOUT_PATH,
      respond: (request) => {
        const seed = at(script.layouts, layoutGets.length);

        layoutGets.push(request);

        return layoutResponse(seed);
      },
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request).endsWith('/content'),
      respond: (request) => {
        contentGets.push(request);

        return (
          script.content ??
          (() => new Response(PNG_BYTES, { status: 200, headers: { 'Content-Type': 'image/png' } }))
        )();
      },
    },
    {
      match: (request) => request.method === 'POST' && pathOf(request) === UPLOAD_PATH,
      respond: async (request) => {
        /*
         * ⚠ **`request.formData()` 로 되읽지 않는다** — jsdom 의 `File` 과 undici 의 `Request` 가
         * 다른 구현이라 되읽기에서 거절된다(`use-drawing-replace.test.tsx` 와 같은 사정).
         */
        uploads.push(await request.clone().text());

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

  const user = userEvent.setup();
  const view = renderWithProviders(<WarehouseLayoutScreen />, {
    fetch: createStubFetch(routes),
    route: ROUTE,
  });

  return { ...view, user, layoutGets, uploads, puts, contentGets };
};

/** 배치도가 도착할 때까지 — 도착해야 판과 액션 줄이 선다. */
const loaded = async (): Promise<void> => {
  await screen.findByRole('button', { name: t.map.save });
};

const fileInput = (): HTMLElement => screen.getByLabelText(t.map.upload, { selector: 'input' });

const uploadButton = (): HTMLElement => screen.getByRole('button', { name: t.map.upload });

const board = (): HTMLElement => screen.getByRole('group', { name: t.map.imageLabel });

/**
 * jsdom 은 배치를 계산하지 않는다 — 판의 `getBoundingClientRect` 가 늘 0이라 클릭에서 비율을
 * 낼 수 없다(`marker-overlay.test.tsx` 와 같은 사정). 판을 실제로 눌러 점이 찍히는지 재는
 * 시험에서만, 부품 시험과 같은 방식으로 칸을 손으로 세워 준다.
 */
const stubBoardRect = (element: HTMLElement): void => {
  element.getBoundingClientRect = (): DOMRect =>
    ({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
};

/**
 * 판 위의 가림막.
 *
 * ⚠ **문서 전체에서 `status` 를 찾지 않는다** — 위치가 0건인 창고에서는 목록의 빈 상태
 * 안내(`EmptyState live`)도 `status` 라, 넓게 재면 둘이 잡혀 시험이 「화면이 말하지 않는다」가
 * 아닌 이유로 깨진다. 재려는 것은 **가림막 안의 말**이니 그 안으로 좁혀 잰다.
 */
const busyOverlay = (): HTMLElement => {
  const overlay = document.querySelector<HTMLElement>('.drawing-busy');

  if (overlay === null) throw new Error('가림막이 서 있지 않습니다.');

  return overlay;
};

const hasBusyOverlay = (): boolean => document.querySelector('.drawing-busy') !== null;

/**
 * 목록 쪽의 위치 코드 버튼.
 *
 * ⚠ **판 위의 표식도 같은 이름을 쓴다** — 표식의 말이 곧 위치 코드다. 구획으로 좁히지 않으면
 * 어느 쪽을 눌렀는지 시험이 정하지 못한다.
 */
const locationButton = (code: string): HTMLElement =>
  within(screen.getByRole('region', { name: t.panes.locations })).getByRole('button', {
    name: code,
  });

const withDrawing = (markers: MarkerSeed[] = [{ locationId: 7, x: 0.1, y: 0.2 }]): LayoutSeed => ({
  etag: '"7"',
  drawingAttachmentId: OLD_ATTACHMENT_ID,
  markers,
});

const withoutDrawing = (
  markers: MarkerSeed[] = [{ locationId: 7, x: 0.1, y: 0.2 }],
): LayoutSeed => ({
  etag: '"7"',
  drawingAttachmentId: null,
  markers,
});

/*
 * jsdom 은 `createObjectURL` 을 구현하지 않는다. ⛔ **`URL` 을 통째로 갈아치우지 않는다** —
 * 그러면 생성자가 사라져 API 클라이언트의 주소 조립까지 깨진다(선례 `repack-label-issue`).
 */
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => BLOB_URL);
  URL.revokeObjectURL = vi.fn();
});

describe('W-CO-08 창고 배치도 — 도면 보이기', () => {
  it('⭐ 도면 내용을 받아 blob 주소로 그린다 — 화면을 떠나면 그 주소를 되돌려준다', async () => {
    const { contentGets, unmount } = renderScreen({ layouts: [withDrawing()] });

    await loaded();

    const image = await screen.findByRole('img', { name: t.map.imageLabel });

    expect(image).toHaveAttribute('src', BLOB_URL);
    expect(contentGets).toHaveLength(1);
    expect(pathOf(contentGets[0] as Request)).toBe(contentPath(OLD_ATTACHMENT_ID));

    unmount();

    /* ⛔ 되돌려주지 않으면 도면 수 MB 가 문서가 닫힐 때까지 남는다 — 화면에 증상이 없다. */
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(BLOB_URL);
  });

  it('⛔ 도면을 못 받으면 깨진 그림이 아니라 사유와 다시 불러오기를 낸다(404 포함)', async () => {
    renderScreen({
      layouts: [withDrawing()],
      content: () => jsonResponse({ message: '없는 첨부입니다.' }, { status: 404 }),
    });

    await loaded();

    expect(await screen.findByText(t.map.drawingLoadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.map.drawingRetry })).toBeInTheDocument();
    /* 주소가 없으면 `<img>` 자체를 그리지 않는다 — 깨진 그림은 사유를 말하지 못한다. */
    expect(screen.queryByRole('img', { name: t.map.imageLabel })).toBeNull();
  });

  /*
   * ⭐ **표식의 자리는 듣는 사람에게 글로만 전해진다.** 판 부품은 표현 전용이라 사람의 말을
   * 갖지 않고 숫자만 낸다(`"10% / 20%"`) — 그 말을 화면이 넘기지 않으면 낭독기가 듣는 것은
   * 숫자뿐이다. 여기서 재는 것은 부품의 기본값이 아니라 **이 화면이 문구를 넘겼는가**다.
   */
  it('⭐ 표식의 자리가 화면의 말로 읽힌다 — 숫자만 들리지 않는다', async () => {
    renderScreen({ layouts: [withDrawing()] });

    await loaded();

    const pin = within(board()).getByRole('button', { name: 'SYN-LOC-07' });

    expect(pin).toHaveAccessibleDescription(t.map.markerPosition(10, 20));
  });
});

describe('W-CO-08 창고 배치도 — 도면 올리기', () => {
  it('⭐ 첫 도면은 확인 없이 올리기 → 저장으로 이어진다', async () => {
    const { user, uploads, puts } = renderScreen({ layouts: [withoutDrawing()] });

    await loaded();
    expect(screen.getByText(t.map.noDrawing)).toBeInTheDocument();

    await user.upload(fileInput(), pngFile());

    /* 덮어쓸 도면이 없으므로 확인 창을 세우지 않는다. */
    expect(screen.queryByText(t.map.replaceDrawingTitle)).toBeNull();

    expect(await screen.findByText(t.map.drawingReplaced)).toBeInTheDocument();
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toContain('name="targetTypeCode"');
    expect(puts).toHaveLength(1);
    expect(puts[0]?.body.drawingAttachmentId).toBe(NEW_ATTACHMENT_ID);
  });

  it('⚠ 이미 도면이 있으면 확인을 받는다 — 취소하면 아무 요청도 나가지 않는다', async () => {
    const { user, uploads, puts } = renderScreen({
      layouts: [
        withDrawing([
          { locationId: 7, x: 0.1, y: 0.2 },
          { locationId: 8, x: 0.3, y: 0.4 },
        ]),
      ],
    });

    await loaded();
    await user.upload(fileInput(), pngFile());

    /* 점 개수를 창이 말한다 — 「무엇이 어긋날 수 있는가」가 수로 보여야 판단할 수 있다. */
    expect(await screen.findByText(t.map.replaceDrawingLead(2))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.map.cancel }));

    await waitFor(() => {
      expect(screen.queryByText(t.map.replaceDrawingTitle)).toBeNull();
    });
    expect(uploads).toHaveLength(0);
    expect(puts).toHaveLength(0);
  });

  it('⭐ 확인하면 올리기 → 저장 두 호출이 그 차례로 나간다', async () => {
    const { user, uploads, puts } = renderScreen({ layouts: [withDrawing()] });

    await loaded();
    await user.upload(fileInput(), pngFile());

    await user.click(await screen.findByRole('button', { name: t.map.confirm }));

    expect(await screen.findByText(t.map.drawingReplaced)).toBeInTheDocument();
    expect(uploads).toHaveLength(1);
    expect(puts).toHaveLength(1);
    expect(puts[0]?.headers.get('If-Match')).toBe('"7"');
    expect(puts[0]?.body.drawingAttachmentId).toBe(NEW_ATTACHMENT_ID);
  });

  it('⛔ 저장하지 않은 점 변경이 있으면 올리기를 막고 사유를 적는다', async () => {
    const { user, uploads } = renderScreen({ layouts: [withDrawing()] });

    await loaded();
    expect(uploadButton()).toBeEnabled();

    /* 지도에서 점 하나를 뺀다 — 저장하지 않은 편집이 생긴다. */
    await user.click(locationButton('SYN-LOC-07'));
    await user.click(screen.getByRole('button', { name: t.map.remove }));

    await waitFor(() => {
      expect(uploadButton()).toBeDisabled();
    });
    expect(screen.getByText(t.map.uploadNeedsCleanDraft)).toBeInTheDocument();

    /* 입력칸도 함께 잠근다 — 버튼만 막으면 자판으로 칸에 닿는 길이 남는다. */
    await user.upload(fileInput(), pngFile());
    expect(uploads).toHaveLength(0);
  });

  it('⛔ 형식·크기는 요청 전에 화면이 거른다', async () => {
    const { user, uploads } = renderScreen({ layouts: [withoutDrawing()] });

    await loaded();

    /* ⚠ `accept` 는 고르는 창을 좁힐 뿐 막지 못한다 — 브라우저와 같은 조건으로 재려고 끈다. */
    const anyFileUser = userEvent.setup({ applyAccept: false });

    await anyFileUser.upload(
      fileInput(),
      new File([PNG_BYTES], 'layout.webp', { type: 'image/webp' }),
    );

    expect(await screen.findByText(t.map.fileTypeRejected)).toBeInTheDocument();
    expect(uploads).toHaveLength(0);

    await user.upload(fileInput(), hugePngFile());

    expect(await screen.findByText(t.map.fileTooLarge)).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
  });
});

describe('W-CO-08 창고 배치도 — 올리는 동안', () => {
  it('⭐ 단계가 버튼과 판 양쪽에서 보이고, 도는 동안 조작이 잠긴다', async () => {
    const upload = deferred();
    const put = deferred();
    const { user } = renderScreen({
      layouts: [withDrawing()],
      upload: () => upload.promise,
      puts: [() => put.promise],
    });

    await loaded();
    expect(board()).toBeInTheDocument();
    stubBoardRect(board());

    /* 아직 안 찍힌 위치를 미리 골라 둔다 — 고르는 것만으로는 초안이 더러워지지 않는다. */
    await user.click(locationButton('SYN-LOC-08'));

    await user.upload(fileInput(), pngFile());
    /* 이미 도면이 있으므로(§7 확인 절차) 확인을 거쳐야 올리기가 시작된다. */
    await user.click(await screen.findByRole('button', { name: t.map.confirm }));

    /* ① 올리는 중 — 누른 자리(버튼)와 결과가 설 자리(판)가 같은 말을 한다. */
    const uploading = await screen.findByRole('button', { name: t.map.uploadingLabel });

    expect(uploading).toHaveAttribute('aria-busy', 'true');
    expect(uploading).toBeDisabled();
    expect(within(busyOverlay()).getByText(t.map.uploadingLabel)).toBeInTheDocument();
    expect(busyOverlay()).toHaveAttribute('role', 'status');
    /*
     * ⭐ 가림막 안에서는 글자 하나만 낭독되어야 한다 — 막대는 서 있되(`hidden: true` 로
     * 찾는다) 이름이 없어(`aria-hidden`) 옆 `<span>` 과 같은 말을 두 번 읽지 않는다.
     */
    const progressBar = within(busyOverlay()).getByRole('progressbar', { hidden: true });

    expect(progressBar).toHaveAttribute('aria-hidden', 'true');
    expect(progressBar).not.toHaveAttribute('aria-label');
    /*
     * ⛔ 도는 동안 판에 점을 찍을 수 없다 — 부품의 역할 유무가 아니라 **밖으로 나간 값**을
     * 잰다: 잠긴 판을 눌러도 표식 수가 늘지 않아야 한다.
     */
    expect(board()).toHaveAttribute('aria-disabled', 'true');

    const pinsWhileUploading = within(board()).getAllByRole('button').length;

    fireEvent.click(board(), { clientX: 100, clientY: 50 });
    expect(within(board()).getAllByRole('button')).toHaveLength(pinsWhileUploading);
    expect(screen.getByRole('button', { name: t.map.save })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: t.locations.includeInactive })).toBeDisabled();

    await act(async () => {
      upload.settle(jsonResponse(attachmentBody(NEW_ATTACHMENT_ID), { status: 201 }));
      await upload.promise;
    });

    /* ② 저장하는 중 — 올리기가 끝나도 도면은 아직 바뀌지 않았다. */
    await screen.findByRole('button', { name: t.map.savingDrawingLabel });
    expect(within(busyOverlay()).getByText(t.map.savingDrawingLabel)).toBeInTheDocument();
    expect(board()).toHaveAttribute('aria-disabled', 'true');

    const pinsWhileSaving = within(board()).getAllByRole('button').length;

    fireEvent.click(board(), { clientX: 100, clientY: 50 });
    expect(within(board()).getAllByRole('button')).toHaveLength(pinsWhileSaving);

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

    /* ③ 끝나면 전부 풀린다. */
    await waitFor(() => {
      expect(uploadButton()).toBeEnabled();
    });
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(hasBusyOverlay()).toBe(false);
    expect(board()).toBeInTheDocument();
    expect(board()).not.toHaveAttribute('aria-disabled');

    /*
     * ⭐ 양성 대조 — 잠금이 풀리면 «같은 절차»(위치 고르기 → 판 누르기)로 실제 점이 찍힌다.
     * 이것이 없으면 위 두 「늘지 않는다」가 스텁이 안 먹혀 우연히 통과한 것인지 가릴 수 없다.
     */
    stubBoardRect(board());
    await user.click(locationButton('SYN-LOC-08'));

    const pinsBeforeUnlocked = within(board()).getAllByRole('button').length;

    fireEvent.click(board(), { clientX: 100, clientY: 50 });
    expect(within(board()).getAllByRole('button')).toHaveLength(pinsBeforeUnlocked + 1);
  });

  /*
   * ⚠ **위치가 0건인 창고도 실재한다** — 갓 만든 창고가 그렇다. 그때 목록의 빈 상태 안내가
   * 제 `status` 를 세우므로, 가림막을 「화면에 하나뿐인 `status`」로 재던 시험은 그 창고에서
   * 깨진다. 여기서 실제로 그 상태를 렌더해 두 `status` 가 서로를 가리지 않음을 본다.
   */
  it('⭐ 위치가 0건인 창고에서도 가림막이 제 단계를 말한다', async () => {
    const upload = deferred();
    const { user } = renderScreen({
      layouts: [withoutDrawing([])],
      locations: [],
      upload: () => upload.promise,
    });

    await loaded();
    expect(screen.getByText(t.locations.empty)).toBeInTheDocument();

    await user.upload(fileInput(), pngFile());

    await screen.findByRole('button', { name: t.map.uploadingLabel });

    /* 빈 상태 안내까지 `status` 라 문서 전체로는 둘이다 — 가림막 안으로 좁혀야 정해진다. */
    expect(screen.getAllByRole('status').length).toBeGreaterThan(1);
    expect(within(busyOverlay()).getByText(t.map.uploadingLabel)).toBeInTheDocument();

    await act(async () => {
      upload.settle(jsonResponse(attachmentBody(NEW_ATTACHMENT_ID), { status: 201 }));
      await upload.promise;
    });

    await waitFor(() => {
      expect(uploadButton()).toBeEnabled();
    });
    expect(hasBusyOverlay()).toBe(false);
  });

  it('⭐ 저장이 실패해도 잠금은 풀린다 — 실패한 채로 굳지 않는다', async () => {
    const { user } = renderScreen({
      layouts: [withoutDrawing()],
      puts: [() => jsonResponse({ message: '서버에 문제가 있습니다.' }, { status: 500 })],
    });

    await loaded();
    await user.upload(fileInput(), pngFile());

    await waitFor(() => {
      expect(uploadButton()).toBeEnabled();
    });
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(board()).toBeInTheDocument();
    expect(
      within(screen.getByRole('alert')).getByText(/서버에 문제가 있습니다/),
    ).toBeInTheDocument();
  });
});

describe('W-CO-08 창고 배치도 — 실패가 서는 자리', () => {
  it('⛔ 413·400 `file` 은 올리기 자리 문구로 선다 — 배너는 서지 않는다', async () => {
    /*
     * ⚠ **계약·목 모양 그대로**(`tools/mock/seeded.mjs` §POST /app/attachments 413) — `scope:
     * 'field', field: 'file'` 봉투다. `{message}` 뿐인 옛 스텁은 `kind: 'http'` 로 접혀 배너
     * 경로를 고정했는데, 실제 모양에서는 `knownFields`(`file`)에 걸려 인라인으로 간다.
     */
    const tooLarge = renderScreen({
      layouts: [withoutDrawing()],
      upload: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'file',
                code: 'TOO_LARGE',
                message: '파일이 너무 큽니다(10MB 초과).',
              },
            ],
          },
          { status: 413 },
        ),
    });

    await loaded();
    await tooLarge.user.upload(fileInput(), pngFile());

    expect(await screen.findByText('파일이 너무 큽니다(10MB 초과).')).toBeInTheDocument();
    /* 계약 모양은 필드 오류라 배너로 겹쳐 내지 않는다. */
    expect(screen.queryByRole('alert')).toBeNull();

    tooLarge.unmount();

    const badFile = renderScreen({
      layouts: [withoutDrawing()],
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

    await loaded();
    await badFile.user.upload(fileInput(), pngFile());

    expect(await screen.findByText('PNG·JPEG만 올릴 수 있습니다.')).toBeInTheDocument();
    /* 파일 칸에 낸 것을 배너로 겹쳐 내지 않는다 — 한 오류가 두 자리에 서면 둘 다 흐려진다. */
    expect(screen.queryByRole('alert')).toBeNull();
    /*
     * ⛔ **실패한 채로 굳지 않는다.** 사용자가 할 일은 다른 파일을 고르는 것 하나인데, 잠금이
     * 풀리지 않으면 그 길이 막힌 채 화면은 사유만 적어 두게 된다.
     */
    expect(uploadButton()).toBeEnabled();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(hasBusyOverlay()).toBe(false);
  });

  /*
   * ⛔ **감지 지점.** 사전 검사에 걸린 파일은 요청까지 가지 않아 서버 오류가 저절로 풀리지
   * 않는다 — 지우지 않으면 **직전 파일의 서버 문구와 방금 고른 파일의 사유가 두 줄로 남아**,
   * 어느 쪽이 지금 이야기인지 알 수 없게 된다.
   */
  it('⛔ 새 파일을 고르면 직전 파일의 서버 오류가 남지 않는다', async () => {
    const { user } = renderScreen({
      layouts: [withoutDrawing()],
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

    await loaded();
    await user.upload(fileInput(), pngFile());

    expect(await screen.findByText('PNG·JPEG만 올릴 수 있습니다.')).toBeInTheDocument();

    /* ⚠ `accept` 는 고르는 창을 좁힐 뿐 막지 못한다 — 브라우저와 같은 조건으로 재려고 끈다. */
    const anyFileUser = userEvent.setup({ applyAccept: false });

    await anyFileUser.upload(
      fileInput(),
      new File([PNG_BYTES], 'layout.webp', { type: 'image/webp' }),
    );

    expect(await screen.findByText(t.map.fileTypeRejected)).toBeInTheDocument();
    expect(screen.queryByText('PNG·JPEG만 올릴 수 있습니다.')).toBeNull();
  });

  /*
   * ⛔ **감지 지점.** 점만 고치는 저장에는 `markers`·`drawingAttachmentId` 에 대응하는 입력칸이
   * 없다 — 그 이름을 인라인 필드로 분류하면 배너에서 빠져 **어디에도 보이지 않는 오류**가 된다.
   */
  it('⛔ 점만 고치는 저장의 400 필드 오류도 배너에 선다', async () => {
    const { user, puts } = renderScreen({
      layouts: [withDrawing()],
      puts: [
        () =>
          jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'drawingAttachmentId',
                  code: 'NOT_FOUND',
                  message: '없는 첨부입니다.',
                },
              ],
            },
            { status: 400 },
          ),
      ],
    });

    await loaded();

    await user.click(locationButton('SYN-LOC-07'));
    await user.click(screen.getByRole('button', { name: t.map.remove }));
    await user.click(screen.getByRole('button', { name: t.map.save }));

    await waitFor(() => {
      expect(puts).toHaveLength(1);
    });

    expect(
      within(await screen.findByRole('alert')).getByText('없는 첨부입니다.'),
    ).toBeInTheDocument();
  });

  /*
   * ⛔ **감지 지점.** 409 로 멈춘 시점에 화면은 **재조회가 가져온 남의 새 도면**을 보이고 있다.
   * 그 상태의 버튼을 「저장 다시 시도」로 두면 사용자는 「아까 실패한 것을 한 번 더」로 읽는데,
   * 실제로 하는 일은 **보이는 그 도면을 내 도면으로 덮는 것**이다.
   */
  it('⛔ 저장 409(그사이 도면이 바뀜)는 「덮는다」고 말하는 버튼과 사유를 낸다', async () => {
    const { user, uploads, puts } = renderScreen({
      layouts: [
        withoutDrawing(),
        /* 재조회했더니 남이 다른 도면을 붙여 두었다 — 덮지 않고 사람에게 묻는다. */
        { etag: '"9"', drawingAttachmentId: 777, markers: [{ locationId: 7, x: 0.1, y: 0.2 }] },
      ],
      puts: [
        conflictResponse,
        /* 사람이 「저장 다시 시도」를 누른 뒤 — 이번에는 그 도면 위에 적힌다. */
        () =>
          layoutResponse({
            etag: '"10"',
            drawingAttachmentId: NEW_ATTACHMENT_ID,
            markers: [{ locationId: 7, x: 0.1, y: 0.2 }],
          }),
      ],
    });

    await loaded();
    await user.upload(fileInput(), pngFile());

    const banner = await screen.findByRole('alert');

    expect(within(banner).getByText(messages.conflict.user)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.conflict.reloadAction }),
    ).toBeInTheDocument();
    /* ⭐ 첨부는 이미 올라가 있다 — 다시 올리면 고아 첨부가 하나 더 생긴다. */
    const overwrite = screen.getByRole('button', { name: t.map.overwriteDrawing });

    expect(overwrite).toBeInTheDocument();
    /* ⛔ 「방금 실패한 저장을 다시」로 읽히는 말이 이 갈래에 남아 있으면 안 된다. */
    expect(screen.queryByRole('button', { name: t.map.retrySaveDrawing })).toBeNull();
    /* 무엇을 덮는지 버튼 바로 옆에 적혀 있다. */
    expect(screen.getByText(t.map.overwriteDrawingNote)).toBeInTheDocument();
    expect(puts).toHaveLength(1);

    await user.click(overwrite);

    expect(await screen.findByText(t.map.drawingReplaced)).toBeInTheDocument();
    expect(puts).toHaveLength(2);
    /* ⛔ 두 번째 올리기가 있으면 고아 첨부가 하나 더 생긴 것이다 — 다시 올리지 않는다. */
    expect(uploads).toHaveLength(1);
  });

  /*
   * ⭐ **충돌이 아닌 저장 실패는 덮을 새 도면이 없다** — 화면이 보고 있는 것은 그대로이고
   * 할 일은 같은 저장을 한 번 더 보내는 것 하나다. 그 갈래의 말은 바뀌지 않는다.
   */
  it('⭐ 통신이 끊겨 저장만 실패했으면 「저장 다시 시도」 그대로다', async () => {
    const { user, uploads, puts } = renderScreen({
      layouts: [withoutDrawing()],
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

    await loaded();
    await user.upload(fileInput(), pngFile());

    const retry = await screen.findByRole('button', { name: t.map.retrySaveDrawing });

    expect(screen.queryByRole('button', { name: t.map.overwriteDrawing })).toBeNull();
    expect(screen.queryByText(t.map.overwriteDrawingNote)).toBeNull();

    await user.click(retry);

    expect(await screen.findByText(t.map.drawingReplaced)).toBeInTheDocument();
    expect(puts).toHaveLength(2);
    expect(uploads).toHaveLength(1);
  });
});

describe('W-CO-08 창고 배치도 — 점만 고치는 저장', () => {
  /*
   * ⛔ **돌연변이 감지 지점.** 저장은 도면과 점을 통째로 바꾸므로, 점만 고친 저장에서
   * `drawingAttachmentId` 가 빠지면 서버는 「도면을 비우라」로 읽는다 — 화면은 성공을 말한다.
   */
  it('⛔ 점만 고쳐 저장해도 본문에 기존 도면 id 가 실린다', async () => {
    const { user, puts } = renderScreen({
      layouts: [
        withDrawing([
          { locationId: 7, x: 0.1, y: 0.2 },
          { locationId: 8, x: 0.3, y: 0.4 },
        ]),
      ],
    });

    await loaded();

    await user.click(locationButton('SYN-LOC-07'));
    await user.click(screen.getByRole('button', { name: t.map.remove }));
    await user.click(screen.getByRole('button', { name: t.map.save }));

    await waitFor(() => {
      expect(puts).toHaveLength(1);
    });
    expect(puts[0]?.body.drawingAttachmentId).toBe(OLD_ATTACHMENT_ID);
    expect(puts[0]?.body.markers.map((marker) => marker.locationId)).toEqual([8]);
  });

  it('⛔ 「아직 열지 않았다」는 잠금 문구가 화면에 남아 있지 않다', async () => {
    renderScreen({ layouts: [withDrawing()] });

    await loaded();

    expect(screen.queryByText(/아직 열지 않았습니다/)).toBeNull();
    expect(uploadButton()).toBeEnabled();
  });
});
