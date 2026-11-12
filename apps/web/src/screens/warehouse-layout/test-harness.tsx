import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { SessionProvider, type Session } from '../../patterns/session';
import { DRAWING_MAX_BYTES } from './layout-draft';
import { LayoutEditorDialog } from './layout-editor-dialog';
import { WarehouseLayoutScreen } from './screen';

/**
 * W-CO-08 시험의 공용 자리 — 스텁 응답 · 렌더 · 판과 목록을 찾는 손잡이. 조회 화면 시험(`screen.test.tsx`)과 편집 창
 * 시험(`layout-editor-dialog.test.tsx`)이 같이 쓴다(피처 006 에서 한 파일을 둘로 나누며 옮겼다).
 */

export const t = messages.warehouseLayout;
export const wl = messages.warehouseLocation;

export const WAREHOUSE_ID = 12;
/** 편집 창 제목의 창고 이름 — 창고 선택지 표기(「코드 · 이름」)와 같다. */
// ui-check-ignore: C-13 시험 자료 — 화면 문구가 아니라 창고 선택지 표기를 그대로 맞춘 값
export const WAREHOUSE_LABEL = 'SYN-WH-12 · 합성 창고';
export const LAYOUT_PATH = `/mdm/warehouses/${String(WAREHOUSE_ID)}/layout`;
export const WAREHOUSES_PATH = '/mdm/warehouses';
export const LOCATIONS_PATH = '/mdm/locations';
export const UPLOAD_PATH = '/app/attachments';
export const OLD_ATTACHMENT_ID = 100;
export const NEW_ATTACHMENT_ID = 5001;
export const ROUTE = `/?warehouse=${String(WAREHOUSE_ID)}`;
export const BLOB_URL = 'blob:drawing';

/** 작은 PNG — 시그니처만 있으면 된다. 이 시험이 재는 것은 바이트가 아니라 «길»이다. */
export const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export const pathOf = (request: Request): string => new URL(request.url).pathname;

export const contentPath = (attachmentId: number): string =>
  `/app/attachments/${String(attachmentId)}/content`;

export interface MarkerSeed {
  locationId: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface LayoutSeed {
  etag: string;
  drawingAttachmentId: number | null;
  markers: MarkerSeed[];
}

export interface ReplaceBody {
  markers: MarkerSeed[];
  drawingAttachmentId?: number;
}

export interface PutRecord {
  headers: Headers;
  body: ReplaceBody;
}

export type LocationSeed = components['schemas']['Location'];

export const locationSeed = (
  locationId: number,
  locationCode: string,
  extra: Partial<LocationSeed> = {},
): LocationSeed => ({
  locationId,
  warehouseId: WAREHOUSE_ID,
  parentLocationId: null,
  locationCode,
  locationName: `${locationCode} 위치`,
  aliasName: null,
  locationLevelCode: 'ZONE',
  systemRoleCode: null,
  isActive: true,
  isLeaf: true,
  hasItemRestriction: false,
  ...extra,
});

export const LOCATION_ROWS: LocationSeed[] = [
  locationSeed(7, 'SYN-LOC-07', { locationName: '합성 위치 가' }),
  locationSeed(8, 'SYN-LOC-08', { locationName: '합성 위치 나' }),
];

export const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 20, total: items.length },
});

/** 크기 · 회전을 빼고 저장한 표식에 서버가 채우는 값(#930). 화면이 새로 찍는 기본값보다 작다. */
export const SERVER_MARKER_SHAPE = { width: 0.05, height: 0.05, rotation: 0 };

export const layoutResponse = (seed: LayoutSeed): Response =>
  jsonResponse(
    {
      warehouseId: WAREHOUSE_ID,
      ...(seed.drawingAttachmentId === null
        ? {}
        : { drawingAttachmentId: seed.drawingAttachmentId }),
      /* 서버는 크기 · 회전을 늘 싣는다 — 시드가 생략하면 서버 기본값으로 채운다(#930). */
      markers: seed.markers.map((marker) => ({ ...SERVER_MARKER_SHAPE, ...marker })),
    },
    { headers: { ETag: seed.etag } },
  );

export const attachmentBody = (attachmentId: number) => ({
  attachmentId,
  targetTypeCode: 'WAREHOUSE',
  targetId: WAREHOUSE_ID,
  fileName: 'layout.png',
  contentType: 'image/png',
  byteSize: PNG_BYTES.length,
  uploadedAt: '2026-09-15T09:00:00+09:00',
});

export const conflictResponse = (): Response =>
  jsonResponse(
    { conflictCause: 'user', message: '다른 사용자가 먼저 수정했습니다.' },
    { status: 409 },
  );

export const pngFile = (name = 'layout.png'): File =>
  new File([PNG_BYTES], name, { type: 'image/png' });

/** 크기만 부풀린다 — 10MB 를 실제로 만들면 시험이 그 할당에 시간을 다 쓴다. */
export const hugePngFile = (): File => {
  const file = pngFile('큰도면.png');

  Object.defineProperty(file, 'size', { value: DRAWING_MAX_BYTES + 1 });

  return file;
};

/** 응답 시점을 시험이 쥔다 — 「올리는 중」·「저장하는 중」을 붙들어 보려면 필요하다. */
export const deferred = (): {
  promise: Promise<Response>;
  settle: (response: Response) => void;
} => {
  let settle!: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => {
    settle = resolve;
  });

  return { promise, settle };
};

export interface Script {
  /** 배치도 조회가 차례로 돌려줄 값. 모자라면 마지막 것을 되풀이한다. */
  layouts: LayoutSeed[];
  /** 이 창고의 위치들. 주지 않으면 둘을 준다 — **0건도 실재하는 창고 상태다.** */
  locations?: LocationSeed[];
  /** 도면 내용 응답. 주지 않으면 PNG 바이트를 돌려준다. */
  content?: () => Response | Promise<Response>;
  upload?: () => Response | Promise<Response>;
  /** 저장 응답 — 부른 차례대로. 모자라면 마지막 것을 되풀이한다. */
  puts?: (() => Response | Promise<Response>)[];
}

/** 그릴 것 — 조회 화면 전체, 또는 편집 창 하나(옮긴 편집 시나리오). */
type Subject = 'screen' | 'editor';

const renderSubject = (subject: Subject, script: Script, options: RenderOptions = {}) => {
  const layoutGets: Request[] = [];
  const uploads: string[] = [];
  const puts: PutRecord[] = [];
  const contentGets: Request[] = [];
  const warehouseGets: Request[] = [];
  const putResponders = script.puts ?? [];

  const at = <T,>(list: T[], index: number): T => list[Math.min(index, list.length - 1)] as T;

  const routes: StubRoute[] = [
    {
      match: (request) => request.method === 'GET' && pathOf(request) === WAREHOUSES_PATH,
      respond: (request) => {
        warehouseGets.push(request);
        return jsonResponse(
          listBody([
            {
              warehouseId: WAREHOUSE_ID,
              warehouseCode: 'SYN-WH-12',
              warehouseName: '합성 창고',
              isActive: true,
            },
          ]),
        );
      },
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
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = renderWithProviders(
    subject === 'screen' ? (
      <SessionProvider>
        <WarehouseLayoutScreen />
      </SessionProvider>
    ) : (
      <LayoutEditorDialog
        warehouseId={WAREHOUSE_ID}
        warehouseLabel={WAREHOUSE_LABEL}
        onClose={onClose}
        onSaved={onSaved}
      />
    ),
    {
      fetch: createStubFetch(routes),
      route: ROUTE,
      session: options.session ?? SYNTHETIC_SESSION,
    },
  );

  return {
    ...view,
    user,
    layoutGets,
    uploads,
    puts,
    contentGets,
    warehouseGets,
    onClose,
    onSaved,
  };
};

interface RenderOptions {
  /** 로그인 상태. 주지 않으면 합성 세션(권한 목록 없음 — 권한을 모르면 [수정]은 선다). */
  session?: Session;
}

/** 조회 화면 전체를 그린다. */
export const renderScreen = (script: Script, options?: RenderOptions) =>
  renderSubject('screen', script, options);

/**
 * 편집 창 하나만 그린다 — 조회 화면의 [수정]을 누른 것과 같다(창고 `WAREHOUSE_ID`). 조회 화면과 같은 판 · 목록 이름이
 * 겹치지 않아, 옮긴 편집 시나리오가 손잡이를 그대로 쓴다.
 */
export const renderEditor = (script: Script) => renderSubject('editor', script);

/**
 * 배치도가 도착할 때까지 — 도착해야 판이 선다. 조회 화면 · 편집 창 모두 판은 배치도를 받은 뒤에 선다(편집 창의 저장
 * 단추는 발에 늘 서 있어 기다림의 표지가 되지 못한다).
 */
export const loaded = async (): Promise<void> => {
  await screen.findByRole('group', { name: t.map.imageLabel });
};

export const fileInput = (): HTMLElement =>
  screen.getByLabelText(t.map.upload, { selector: 'input' });

export const uploadButton = (): HTMLElement => screen.getByRole('button', { name: t.map.upload });

export const board = (): HTMLElement => screen.getByRole('group', { name: t.map.imageLabel });

/**
 * jsdom 은 배치를 계산하지 않는다 — 판의 `getBoundingClientRect` 가 늘 0이라 클릭에서 비율을
 * 낼 수 없다(`marker-overlay.test.tsx` 와 같은 사정). 판을 실제로 눌러 점이 찍히는지 재는
 * 시험에서만, 부품 시험과 같은 방식으로 칸을 손으로 세워 준다.
 *
 * ⚠ **판을 원점에 세우지 않는다.** 원점에 두면 화면 좌표에서 판의 `left`·`top` 을 빼는 계산이
 * 있으나 없으나 같은 값이 나와, 점이 통째로 어긋나는 결함을 시험이 놓친다(부품 시험과 같은 이유).
 */
export const stubBoardRect = (element: HTMLElement): void => {
  element.getBoundingClientRect = (): DOMRect =>
    ({
      left: 40,
      top: 30,
      width: 200,
      height: 100,
      right: 240,
      bottom: 130,
      x: 40,
      y: 30,
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
export const busyOverlay = (): HTMLElement => {
  const overlay = document.querySelector<HTMLElement>('.drawing-busy');

  if (overlay === null) throw new Error('가림막이 서 있지 않습니다.');

  return overlay;
};

export const hasBusyOverlay = (): boolean => document.querySelector('.drawing-busy') !== null;

/**
 * 목록 쪽의 위치 코드 버튼.
 *
 * ⚠ **판 위의 표식도 같은 이름을 쓴다** — 표식의 말이 곧 위치 코드다. 구획으로 좁히지 않으면
 * 어느 쪽을 눌렀는지 시험이 정하지 못한다.
 */
export const locationButton = (code: string): HTMLElement =>
  within(screen.getByRole('region', { name: t.panes.locations })).getByRole('button', {
    name: code,
  });

export const withDrawing = (
  markers: MarkerSeed[] = [{ locationId: 7, x: 0.1, y: 0.2 }],
): LayoutSeed => ({
  etag: '"7"',
  drawingAttachmentId: OLD_ATTACHMENT_ID,
  markers,
});

export const withoutDrawing = (
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
export const stubObjectUrls = (): void => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => BLOB_URL);
    URL.revokeObjectURL = vi.fn();
  });
};

/*
 * 위치 목록은 창고·Location 의 Location 목록과 같은 계층이다(사용자 지시 2026-10-30) — 처음엔 구역만 펼쳐 랙까지,
 * 펼치기 · 접기, 「구분」 열(서버가 만든 위치는 역할 이름), 고른 위치를 도면에 찍기.
 */
export const TREE_ROWS: LocationSeed[] = [
  locationSeed(1, 'Z01', { aliasName: 'A구역', isLeaf: false }),
  locationSeed(7, 'Z01-R001', { parentLocationId: 1, locationLevelCode: 'RACK', isLeaf: false }),
  locationSeed(9, 'Z01-R001-L01', { parentLocationId: 7, locationLevelCode: 'LEVEL' }),
  locationSeed(3, 'SYS-STAGING', { locationName: 'STAGING', systemRoleCode: 'PUTAWAY_STAGING' }),
];

export const locationTable = (): HTMLElement =>
  within(screen.getByRole('region', { name: t.panes.locations })).getByRole('table');

export const rowOf = (code: string): HTMLElement => {
  const row = locationButton(code).closest('tr');
  if (row === null) throw new Error(`${code} 줄이 없습니다.`);
  return row;
};
