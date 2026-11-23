/**
 * 이 화면의 감지기 전용 발판 — 자재 관리 LOT 라벨 화면(005)의 시험 흉내 서버. 런타임 코드는 이 모듈을 참조하지
 * 않는다 — 참조하면 예시 값이 배포 번들에 들어간다. 값은 **전부 지어낸 것이다**(공개 저장소 경계).
 *
 * 목록 시험(`screen.test.tsx`) · 발행 시험(`issue-flow.test.tsx`) · 만들기 시험(`supplier-issue.test.tsx`)이 **한 스텁을
 * 함께 쓴다.** 스텁이 갈리면 세 파일이 다른 서버를 상대로 같은 화면을 검사하게 된다.
 *
 * ⭐ 서버처럼 기억한다 — LOT 마다의 발행 회차, 폐기, 새로 만든 묶음. 그래서 발행·폐기·만들기 뒤 목록을 다시 받으면
 *    바뀐 대로 선다(실서버와 같은 순서).
 */
import type {
  MaterialLotPair,
  MaterialLotSummary,
  MaterialLotSupplier,
  MaterialLotTab,
  MaterialLotTabRow,
  MaterialPackage,
  SupplierItemDefault,
  WaitingMaterialLotGroup,
} from '@omf-mes/api-client';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import { PuToastHost } from '../../patterns/pop-uniform';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PopMaterialLotLabelScreen } from './screen';

export const WORKER_NO = '900028';
export const PLANT_ID = 8301;
export const ISSUE_LOG_BASE = 44000;

/** 시험의 「지금」 — 공장 2026-11-11(수) 12:00. 최근 2주 다시 인쇄 창이 이 날을 기준으로 선다. */
export const HARNESS_NOW = new Date('2026-11-11T05:00:00Z');

/** 시험의 단위 — EA(기본, 정수), 봉지 · 롤(패키징), TON(소수). */
export const UOMS = [
  { uomId: 8401, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true },
  { uomId: 8402, uomCode: '봉지', uomName: '봉지', decimalScale: 0, isActive: true },
  { uomId: 8403, uomCode: '롤', uomName: '롤', decimalScale: 0, isActive: true },
  { uomId: 8404, uomCode: 'TON', uomName: '톤', decimalScale: 3, isActive: true },
];

const BAG = { uomId: 8402, uomCode: '봉지', uomName: '봉지', count: 10, qtyPerPackage: 100 };

/** 자재 관리 LOT 한 개 — 기본은 대기 · 봉지 10 × 100 · 미출력. */
export const lot = (lotId: number, over: Partial<MaterialLotSummary> = {}): MaterialLotSummary => ({
  lotId,
  lotNo: `SYN-ITEM-01|1000|261111|SYN-P-01|${String(lotId % 1000).padStart(4, '0')}`,
  lotQty: 1000,
  package: BAG,
  supplierLotNo: null,
  lifecycleStatusCode: 'WAITING',
  statusCode: 'INSPECTION_PENDING',
  inboundLotId: null,
  inboundLotNo: null,
  lastLabelIssue: null,
  createdChannelCode: 'POP',
  createdAt: '2026-11-11T01:00:00Z',
  ...over,
});

/** 공급사·품목 하나 — 품목 가(8601, EA) · 공급사 가(8201)가 기본이다. */
export const group = (
  lots: MaterialLotSummary[],
  over: Partial<WaitingMaterialLotGroup> = {},
): WaitingMaterialLotGroup => ({
  supplierId: 8201,
  supplierCode: 'SYN-P-01',
  supplierName: '합성 공급사 가',
  itemId: 8601,
  itemCode: 'SYN-ITEM-01',
  itemName: '합성 품목 가',
  uomId: 8401,
  uomCode: 'EA',
  inspectionRequired: false,
  waitingCount: 0,
  waitingQty: 0,
  unprintedCount: 0,
  lastIssuedAt: null,
  batches: [],
  lots,
  ...over,
});

/** 공급사·품목 기본 정보 — 품목 가 · 공급사 가에 봉지 10 × 100 = 1,000 EA. */
export const defaultInfo = (over: Partial<SupplierItemDefault> = {}): SupplierItemDefault => ({
  supplierItemDefaultId: 7701,
  plantId: PLANT_ID,
  supplierId: 8201,
  supplierCode: 'SYN-P-01',
  supplierName: '합성 공급사 가',
  itemId: 8601,
  itemCode: 'SYN-ITEM-01',
  itemName: '합성 품목 가',
  uomId: 8401,
  uomCode: 'EA',
  lotQty: 1000,
  package: BAG,
  remarks: null,
  versionNo: 1,
  updatedAt: '2026-11-10T00:00:00Z',
  updatedByName: '합성 관리자',
  ...over,
});

/** 기본 화면 — 품목 가는 대기 3개(하나는 출력함) · 폐기 1 · 최근 입하 1, 품목 나는 대기 없음. */
export const STANDARD_GROUPS = (): WaitingMaterialLotGroup[] => [
  group([
    lot(9001, { supplierLotNo: 'SYN-SL-77' }),
    lot(9002, { supplierLotNo: 'SYN-SL-77' }),
    lot(9003, {
      supplierLotNo: 'SYN-SL-77',
      lastLabelIssue: { issueSeq: 1, issuedAt: '2026-11-11T01:12:00Z' },
    }),
    lot(9004, { lifecycleStatusCode: 'VOIDED' }),
    lot(9005, {
      lifecycleStatusCode: 'ACTIVE',
      statusCode: 'NORMAL',
      inboundLotId: 6001,
      inboundLotNo: 'SYN-IL-0011',
      lastLabelIssue: { issueSeq: 1, issuedAt: '2026-11-08T07:40:00Z' },
    }),
  ]),
  group([], {
    supplierId: 8202,
    supplierCode: 'SYN-P-02',
    supplierName: '합성 공급사 나',
    itemId: 8602,
    itemCode: 'SYN-ITEM-02',
    itemName: '합성 품목 나',
    uomId: 8404,
    uomCode: 'TON',
  }),
];

export interface Sent {
  method: string;
  path: string;
  search: URLSearchParams;
  headers: Headers;
  body: unknown;
}

/** 품목 마스터(만들기 창의 품목 기본 보관 단위). */
export interface ItemFixture {
  itemId: number;
  baseUomId: number;
  defaultLotStorageUomId?: number | null;
  /** 보관 단위 → 기본 단위 환산(있으면 패키징당 수량). */
  storageRate?: number;
  /** 피처 014 — 자재 LOT 기본크기 · 패키징 기본값(있으면 [만들기] 창이 품목 기본값으로 채운다). */
  defaultProductionLotSize?: number | null;
  defaultPackageUomId?: number | null;
  defaultPackageCount?: number | null;
}

/**
 * 피처 014 — 공급사·품목 하나의 P/O 몫 흉내. 서버처럼 미출력 탭 조회가 이 쪽까지 모자란 만큼만 만들고
 * (`page × size − 이미 있는 미출력`), 만든 만큼 `creatable` 이 준다. 없으면 기본값 있음 · 만들 몫 0.
 */
export interface PairShare {
  /** 아직 만들 수 있는 LOT 수. */
  creatable: number;
  lotQty: number;
  package: MaterialPackage | null;
  /** 품목 기본값 상태 — `NO_DEFAULT` · `NO_CONVERSION` 이면 만들지 않는다. */
  status?: 'OK' | 'NO_DEFAULT' | 'NO_CONVERSION';
  /** 만든 LOT 이 채우는 P/O 라인. */
  po?: { purchaseOrderLineId: number; purchaseOrderNo: string; lineNo: number };
}

/** 흉내 서버가 LOT 마다 들고 있는 014 칸. */
interface LotMeta {
  creationModeCode: 'AUTO' | 'MANUAL';
  purchaseOrderLine: MaterialLotTabRow['purchaseOrderLine'];
  receivedAt: string | null;
  voidedAt: string | null;
}

export interface HarnessOptions {
  groups?: WaitingMaterialLotGroup[];
  /** 피처 014 — 공급사·품목(`supplierId:itemId`)마다의 P/O 몫. */
  shares?: Record<string, PairShare>;
  /** 미출력 탭 조회를 이 상태로 실패시킨다(409 LOT_NO_CONFLICT 등). */
  lotsFail?: { status: number; body?: unknown };
  /** 출력 전 수정을 이 상태 · 코드로 거절한다(409 ALREADY_PRINTED 등). */
  reviseFail?: { status: number; code: string };
  /** 탭 목록 응답을 이 약속이 풀릴 때까지 붙잡는다 — 「조회 · 생성 중」을 잰다. */
  lotsGate?: Promise<void>;
  /** 단위 목록 — 없으면 `UOMS`(G2 L17: 코드와 이름이 다른 단위를 흉내 낸다). */
  uoms?: readonly (typeof UOMS)[number][];
  defaults?: SupplierItemDefault[];
  items?: ItemFixture[];
  identity?: Partial<PopIdentity>;
  /** 발행 기록을 이 상태로 실패시킨다(모든 LOT). */
  issueFail?: { status: number; body?: unknown };
  /** 발행 기록을 끝나지 않게 붙잡는다 — 「보내는 중」을 잰다. */
  issueHangs?: boolean;
  reportFails?: boolean;
  reissueReasons?: { code: string; codeName: string }[];
  /** 목록 조회(공급사·품목)를 실패시킨다. */
  waitingFail?: boolean;
  /** 이 LOT 은 폐기에서 건별 실패로 돌려준다. */
  voidRejects?: number[];
  /** 만들기를 이 상태로 실패시킨다. */
  batchFail?: { status: number; body?: unknown };
  printers?: unknown[];
  printersFail?: boolean;
}

const page = (total: number) => ({ page: 1, size: 200, total });

export const renderLabelScreen = (options: HarnessOptions = {}) => {
  const groups = structuredClone(options.groups ?? STANDARD_GROUPS());
  const defaults = options.defaults ?? [defaultInfo()];
  const items = options.items ?? [
    { itemId: 8601, baseUomId: 8401, defaultLotStorageUomId: 8402, storageRate: 100 },
    { itemId: 8602, baseUomId: 8404, defaultLotStorageUomId: null },
  ];
  const sent: Sent[] = [];
  const issueCounts = new Map<string, number>();
  const issueByLog = new Map<number, number>();
  let logSeq = 0;
  let nextLotId = 9100;

  for (const each of groups) {
    for (const item of each.lots) {
      if (item.lastLabelIssue !== null) {
        issueCounts.set(`MATERIAL_LOT_LABEL|${String(item.lotId)}`, item.lastLabelIssue.issueSeq);
      }
    }
  }

  /** 묶음의 대기 수 · 미출력 수는 서버가 센다 — 흉내도 LOT 에서 다시 센다. */
  const counted = (): WaitingMaterialLotGroup[] =>
    groups.map((each) => {
      const waiting = each.lots.filter((item) => item.lifecycleStatusCode === 'WAITING');

      return {
        ...each,
        waitingCount: waiting.length,
        waitingQty: waiting.reduce((sum, item) => sum + item.lotQty, 0),
        unprintedCount: waiting.filter((item) => item.lastLabelIssue === null).length,
      };
    });

  const findLot = (lotId: number): MaterialLotSummary | undefined =>
    groups.flatMap((each) => each.lots).find((item) => item.lotId === lotId);

  /* ── 피처 014 흉내 — 탭 넷 · P/O 몫 생성 · 번호 찾기 ── */
  const shares = structuredClone(options.shares ?? {});
  const metas = new Map<number, LotMeta>();
  const metaOf = (item: MaterialLotSummary): LotMeta => {
    const found = metas.get(item.lotId);

    if (found !== undefined) return found;

    const fresh: LotMeta = {
      creationModeCode: 'MANUAL',
      purchaseOrderLine: null,
      receivedAt: item.inboundLotId === null ? null : item.createdAt,
      voidedAt: item.lifecycleStatusCode === 'VOIDED' ? item.createdAt : null,
    };
    metas.set(item.lotId, fresh);

    return fresh;
  };
  const keyOf = (each: WaitingMaterialLotGroup): string =>
    `${String(each.supplierId)}:${String(each.itemId)}`;
  const shareOf = (each: WaitingMaterialLotGroup): PairShare =>
    shares[keyOf(each)] ?? { creatable: 0, lotQty: 1000, package: BAG };
  const tabOf = (item: MaterialLotSummary): MaterialLotTab => {
    if (item.lifecycleStatusCode === 'VOIDED') return 'VOIDED';
    if (item.lifecycleStatusCode === 'ACTIVE') return 'RECEIVED';

    return item.lastLabelIssue === null ? 'UNPRINTED' : 'PRINTED';
  };
  const unprintedOf = (each: WaitingMaterialLotGroup): MaterialLotSummary[] =>
    each.lots.filter((item) => tabOf(item) === 'UNPRINTED');
  const toRow = (
    each: WaitingMaterialLotGroup,
    item: MaterialLotSummary,
    seq: number,
  ): MaterialLotTabRow => ({
    ...item,
    seq,
    uomCode: each.uomCode,
    ...metaOf(item),
  });
  const pairOf = (each: WaitingMaterialLotGroup): MaterialLotPair => {
    const share = shareOf(each);
    const status = share.status ?? 'OK';

    return {
      supplier: { supplierId: each.supplierId, code: each.supplierCode, name: each.supplierName },
      item: {
        itemId: each.itemId,
        code: each.itemCode,
        name: each.itemName,
        baseUomCode: each.uomCode,
      },
      unprintedCount: unprintedOf(each).length,
      creatableCount: status === 'OK' ? share.creatable : 0,
      defaultsStatus: status,
      lotDefaults:
        status === 'OK'
          ? {
              lotQty: share.lotQty,
              packageUomId: share.package?.uomId ?? null,
              packageUomCode: share.package?.uomCode ?? null,
              packageCount: share.package?.count ?? null,
            }
          : null,
      printedCount: each.lots.filter((item) => tabOf(item) === 'PRINTED').length,
      inspectionRequired: each.inspectionRequired,
      lastIssuedAt:
        each.lots
          .map((item) => item.lastLabelIssue?.issuedAt ?? '')
          .filter((value) => value !== '')
          .sort()
          .at(-1) ?? null,
    };
  };
  /** 찾기 `q` — 공급사·품목 코드·이름(서버와 같은 조합 거르기). */
  const matchesQ = (pair: MaterialLotPair, q: string): boolean =>
    q === '' ||
    [pair.supplier.code, pair.supplier.name, pair.item.code, pair.item.name].some((value) =>
      value.toLocaleLowerCase('en-US').includes(q),
    );
  const busy = (unprinted: number, creatable: number): number =>
    unprinted + creatable > 0 ? 0 : 1;
  let autoSerial = 0;
  /** 서버 `ensureMaterialLotsWithin` 흉내 — `upTo` 개까지 만든다. */
  const createShare = (each: WaitingMaterialLotGroup, upTo: number): number => {
    const share = shareOf(each);

    if ((share.status ?? 'OK') !== 'OK' || upTo <= 0) return 0;

    const count = Math.min(upTo, share.creatable);

    for (let index = 0; index < count; index += 1) {
      nextLotId += 1;
      autoSerial += 1;
      const made = lot(nextLotId, {
        lotNo: `${each.itemCode}|${String(share.lotQty)}|261111|${each.supplierCode}|${String(
          9000 + autoSerial,
        )}`,
        lotQty: share.lotQty,
        package: share.package,
        createdAt: '2026-11-11T04:00:00Z',
      });
      each.lots.push(made);
      metas.set(made.lotId, {
        creationModeCode: 'AUTO',
        purchaseOrderLine: share.po ?? {
          purchaseOrderLineId: 7101,
          purchaseOrderNo: 'SYN-PO-01',
          lineNo: 1,
        },
        receivedAt: null,
        voidedAt: null,
      });
    }
    share.creatable -= count;
    shares[keyOf(each)] = share;

    return count;
  };
  const tabRows = (each: WaitingMaterialLotGroup, tab: MaterialLotTab): MaterialLotSummary[] => {
    const rows = each.lots.filter((item) => tabOf(item) === tab);
    const stamp = (item: MaterialLotSummary): string =>
      tab === 'PRINTED'
        ? (item.lastLabelIssue?.issuedAt ?? '')
        : tab === 'RECEIVED'
          ? (metaOf(item).receivedAt ?? '')
          : (metaOf(item).voidedAt ?? '');

    return tab === 'UNPRINTED'
      ? rows.sort((left, right) => left.lotId - right.lotId)
      : rows.sort(
          (left, right) => stamp(right).localeCompare(stamp(left)) || right.lotId - left.lotId,
        );
  };

  const record = async (request: Request): Promise<Sent> => {
    const url = new URL(request.url);
    const entry: Sent = {
      method: request.method,
      path: url.pathname,
      search: url.searchParams,
      headers: request.headers,
      body: null,
    };

    sent.push(entry);
    if (request.method !== 'GET' && request.body !== null)
      entry.body = await request.clone().json();

    return entry;
  };

  const path = (request: Request): string => new URL(request.url).pathname;

  const fetch = createStubFetch([
    {
      match: (request) => path(request) === '/logistics/material-lot-pairs',
      respond: (request) => {
        void record(request);
        if (options.waitingFail === true) return jsonResponse({ message: '실패' }, { status: 500 });
        const url = new URL(request.url);
        const q = (url.searchParams.get('q') ?? '').toLocaleLowerCase('en-US');
        const supplierId = url.searchParams.get('supplierId');
        const pageNo = Number(url.searchParams.get('page') ?? '1');
        const size = Number(url.searchParams.get('size') ?? '50');
        const all = groups
          .map(pairOf)
          .filter(
            (pair) =>
              matchesQ(pair, q) &&
              (supplierId === null || String(pair.supplier.supplierId) === supplierId),
          );
        const sorted = [...all].sort(
          (left, right) =>
            busy(left.unprintedCount, left.creatableCount) -
            busy(right.unprintedCount, right.creatableCount),
        );

        return jsonResponse({
          items: sorted.slice((pageNo - 1) * size, pageNo * size),
          page: { page: pageNo, size, total: sorted.length },
          summary: {
            unprintedCount: groups.reduce((sum, each) => sum + unprintedOf(each).length, 0),
          },
        });
      },
    },
    {
      match: (request) => path(request) === '/logistics/material-lot-suppliers',
      respond: (request) => {
        void record(request);
        if (options.waitingFail === true) return jsonResponse({ message: '실패' }, { status: 500 });
        const url = new URL(request.url);
        const q = (url.searchParams.get('q') ?? '').toLocaleLowerCase('en-US');
        const pageNo = Number(url.searchParams.get('page') ?? '1');
        const size = Number(url.searchParams.get('size') ?? '50');
        const bySupplier = new Map<number, MaterialLotSupplier>();

        for (const pair of groups.map(pairOf).filter((each) => matchesQ(each, q))) {
          const row = bySupplier.get(pair.supplier.supplierId) ?? {
            supplier: pair.supplier,
            pairCount: 0,
            unprintedCount: 0,
            creatableCount: 0,
          };

          row.pairCount += 1;
          row.unprintedCount += pair.unprintedCount;
          row.creatableCount += pair.creatableCount;
          bySupplier.set(pair.supplier.supplierId, row);
        }

        const sorted = [...bySupplier.values()].sort(
          (left, right) =>
            busy(left.unprintedCount, left.creatableCount) -
              busy(right.unprintedCount, right.creatableCount) ||
            left.supplier.code.localeCompare(right.supplier.code),
        );

        return jsonResponse({
          items: sorted.slice((pageNo - 1) * size, pageNo * size),
          page: { page: pageNo, size, total: sorted.length },
        });
      },
    },
    {
      match: (request) => path(request) === '/logistics/material-lots/lookup',
      respond: (request) => {
        void record(request);
        const lotNo = new URL(request.url).searchParams.get('lotNo') ?? '';

        for (const each of groups) {
          const found = each.lots.find((item) => item.lotNo === lotNo);

          if (found !== undefined) {
            const tab = tabOf(found);
            const seq = tabRows(each, tab).findIndex((item) => item.lotId === found.lotId) + 1;
            const pair = pairOf(each);

            return jsonResponse({
              lot: toRow(each, found, seq),
              supplier: pair.supplier,
              item: pair.item,
              tab,
            });
          }
        }

        return jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'NOT_FOUND',
                message: '이 공장에 없는 자재 관리 LOT 번호입니다',
              },
            ],
          },
          { status: 404 },
        );
      },
    },
    {
      match: (request) => path(request) === '/logistics/material-lots' && request.method === 'GET',
      respond: async (request) => {
        void record(request);
        if (options.lotsGate !== undefined) await options.lotsGate;
        const url = new URL(request.url);
        const tab = (url.searchParams.get('tab') ?? 'UNPRINTED') as MaterialLotTab;

        if (options.lotsFail !== undefined && tab === 'UNPRINTED') {
          return jsonResponse(options.lotsFail.body ?? { message: '실패' }, {
            status: options.lotsFail.status,
          });
        }

        const supplierId = Number(url.searchParams.get('supplierId'));
        const itemId = Number(url.searchParams.get('itemId'));
        const pageNo = Number(url.searchParams.get('page') ?? '1');
        const size = Number(url.searchParams.get('size') ?? '20');
        const each = groups.find(
          (candidate) => candidate.supplierId === supplierId && candidate.itemId === itemId,
        );

        if (each === undefined) {
          return jsonResponse({
            items: [],
            page: { page: pageNo, size, total: 0 },
            generation:
              tab === 'UNPRINTED'
                ? { status: 'NO_OPEN_PO', createdNow: 0, creatableRemaining: 0 }
                : null,
          });
        }

        let generation = null;

        if (tab === 'UNPRINTED') {
          const existing = unprintedOf(each).length;
          const createdNow = createShare(each, pageNo * size - existing);
          const share = shareOf(each);
          const status = share.status ?? 'OK';
          const remaining = status === 'OK' ? share.creatable : 0;

          generation = {
            status:
              status !== 'OK'
                ? status
                : unprintedOf(each).length + remaining === 0
                  ? 'NO_OPEN_PO'
                  : 'OK',
            createdNow,
            creatableRemaining: remaining,
          };
        }

        const rows = tabRows(each, tab);
        const remaining = generation?.creatableRemaining ?? 0;

        return jsonResponse({
          items: rows
            .slice((pageNo - 1) * size, pageNo * size)
            .map((item, index) => toRow(each, item, (pageNo - 1) * size + index + 1)),
          page: { page: pageNo, size, total: rows.length + remaining },
          generation,
        });
      },
    },
    {
      match: (request) =>
        /^\/logistics\/material-lots\/\d+:revise$/u.test(path(request)) &&
        request.method === 'POST',
      respond: async (request) => {
        const entry = await record(request);
        const lotId = Number(/material-lots\/(\d+):revise$/u.exec(path(request))?.[1]);
        const body = entry.body as {
          qty: number;
          package: { uomId: number; count: number; qtyPerPackage: number } | null;
        };
        const fail = (status: number, code: string) =>
          jsonResponse({ errors: [{ scope: 'screen', code, message: code }] }, { status });

        if (options.reviseFail !== undefined) {
          return fail(options.reviseFail.status, options.reviseFail.code);
        }

        const each = groups.find((candidate) =>
          candidate.lots.some((item) => item.lotId === lotId),
        );
        const found = findLot(lotId);

        if (each === undefined || found === undefined) return fail(404, 'NOT_FOUND');
        if (found.lastLabelIssue !== null) return fail(409, 'ALREADY_PRINTED');
        if (found.lifecycleStatusCode !== 'WAITING') return fail(409, 'STATE_LOCKED');

        const uomCode = (id: number) => UOMS.find((uom) => uom.uomId === id)?.uomCode ?? '';
        if (found.lotQty !== body.qty) {
          const parts = found.lotNo.split('|');
          found.lotNo = [parts[0], String(body.qty), parts[2], parts[3], '0001'].join('|');
        }
        found.lotQty = body.qty;
        found.package =
          body.package === null
            ? null
            : {
                ...body.package,
                uomCode: uomCode(body.package.uomId),
                uomName: uomCode(body.package.uomId),
              };

        return jsonResponse(toRow(each, found, 0));
      },
    },
    {
      match: (request) => path(request) === '/logistics/waiting-material-lots',
      respond: (request) => {
        void record(request);

        return options.waitingFail === true
          ? jsonResponse({ message: '실패' }, { status: 500 })
          : jsonResponse({ items: counted() });
      },
    },
    {
      match: (request) =>
        path(request) === '/mdm/supplier-item-defaults' && request.method === 'GET',
      respond: (request) => {
        void record(request);
        const url = new URL(request.url);
        const supplierId = url.searchParams.get('supplierId');
        const itemId = url.searchParams.get('itemId');
        const rows = defaults.filter(
          (row) =>
            (supplierId === null || String(row.supplierId) === supplierId) &&
            (itemId === null || String(row.itemId) === itemId),
        );

        return jsonResponse({ items: rows, page: page(rows.length) });
      },
    },
    {
      match: (request) => /^\/mdm\/items\/\d+$/u.test(path(request)),
      respond: (request) => {
        const itemId = Number(/\/mdm\/items\/(\d+)$/u.exec(path(request))?.[1]);
        const item = items.find((each) => each.itemId === itemId);

        return item === undefined
          ? jsonResponse({ message: '없음' }, { status: 404 })
          : jsonResponse({
              item: {
                itemId,
                itemCode: `SYN-ITEM-${String(itemId)}`,
                itemName: '합성 품목',
                baseUomId: item.baseUomId,
                defaultLotStorageUomId: item.defaultLotStorageUomId ?? null,
                defaultProductionLotSize: item.defaultProductionLotSize ?? null,
                defaultPackageUomId: item.defaultPackageUomId ?? null,
                defaultPackageCount: item.defaultPackageCount ?? null,
              },
              editability: {},
            });
      },
    },
    {
      match: (request) => /^\/mdm\/items\/\d+\/uom-conversions$/u.test(path(request)),
      respond: (request) => {
        const itemId = Number(/\/mdm\/items\/(\d+)\//u.exec(path(request))?.[1]);
        const item = items.find((each) => each.itemId === itemId);
        const rows =
          item?.storageRate === undefined || item.defaultLotStorageUomId == null
            ? []
            : [
                {
                  itemUomConversionId: 1,
                  itemId,
                  fromUomId: item.defaultLotStorageUomId,
                  toUomId: item.baseUomId,
                  conversionRate: item.storageRate,
                  effectiveFrom: '2026-01-01',
                  effectiveTo: null,
                },
              ];

        return jsonResponse({ items: rows });
      },
    },
    {
      match: (request) => path(request) === '/mdm/uoms',
      respond: () => {
        const uoms = options.uoms ?? UOMS;

        return jsonResponse({ items: uoms, page: page(uoms.length) });
      },
    },
    {
      match: (request) =>
        path(request) === '/logistics/material-lot-batches' && request.method === 'POST',
      respond: async (request) => {
        const entry = await record(request);

        if (options.batchFail !== undefined) {
          return jsonResponse(options.batchFail.body ?? { message: '실패' }, {
            status: options.batchFail.status,
          });
        }

        const body = entry.body as {
          supplierId: number;
          itemId: number;
          lotQty: number;
          package?: { uomId: number; count: number; qtyPerPackage: number } | null;
          supplierLotNo?: string | null;
          lotCount: number;
        };
        const target = groups.find(
          (each) => each.supplierId === body.supplierId && each.itemId === body.itemId,
        );
        const uomCode = (id: number) => UOMS.find((uom) => uom.uomId === id)?.uomCode ?? '';
        const created = Array.from({ length: body.lotCount }, () => {
          nextLotId += 1;

          return lot(nextLotId, {
            lotQty: body.lotQty,
            package:
              body.package == null
                ? null
                : {
                    ...body.package,
                    uomCode: uomCode(body.package.uomId),
                    uomName: uomCode(body.package.uomId),
                  },
            supplierLotNo: body.supplierLotNo ?? null,
          });
        });

        target?.lots.push(...created);

        return jsonResponse({ batchId: 5001, lots: created }, { status: 201 });
      },
    },
    {
      match: (request) => path(request) === '/trace/lots:void' && request.method === 'POST',
      respond: async (request) => {
        const entry = await record(request);
        const { lotIds } = entry.body as { lotIds: number[] };
        const rejects = new Set(options.voidRejects ?? []);

        return jsonResponse({
          items: lotIds.map((lotId) => {
            const found = findLot(lotId);
            const ok = found?.lifecycleStatusCode === 'WAITING' && !rejects.has(lotId);

            if (ok && found !== undefined) {
              found.lifecycleStatusCode = 'VOIDED';
              metaOf(found).voidedAt = '2026-11-11T04:40:00Z';
            }

            return {
              lotId,
              lotNo: found?.lotNo ?? '',
              voided: ok,
              errorCode: ok ? null : 'STATE_LOCKED',
            };
          }),
        });
      },
    },
    {
      match: (request) => path(request) === '/app/printers',
      respond: () =>
        options.printersFail === true
          ? jsonResponse({ message: '실패' }, { status: 500 })
          : jsonResponse({
              items: options.printers ?? [
                {
                  printerName: 'syn-label-printer',
                  displayName: '합성 라벨 프린터 가',
                  status: 'READY',
                  statusMessage: '대기 중',
                  isDefault: true,
                  supportedDocumentTypeCodes: ['LABEL'],
                },
              ],
            }),
    },
    {
      match: (request) => path(request) === '/mdm/code-values',
      respond: () => {
        const reasons = options.reissueReasons ?? [
          { code: 'PRINT_FAILURE', codeName: '인쇄 실패' },
          { code: 'DAMAGED', codeName: '훼손' },
        ];

        return jsonResponse({
          items: reasons.map((reason, index) => ({
            codeValueId: 7001 + index,
            codeGroupId: 7000,
            code: reason.code,
            codeName: reason.codeName,
            displayOrder: index,
            isActive: true,
          })),
          page: page(reasons.length),
        });
      },
    },
    {
      match: (request) => /^\/trace\/lots\/\d+$/u.test(path(request)),
      respond: (request) => {
        const lotId = Number(/\/trace\/lots\/(\d+)$/u.exec(path(request))?.[1]);
        const found = findLot(lotId);

        return jsonResponse({
          lot: {
            lotId,
            lotNo: found?.lotNo ?? '',
            statusCode: found?.statusCode ?? 'INSPECTION_PENDING',
          },
          externalIdentifiers: [],
          holds: [],
        });
      },
    },
    {
      match: (request) => path(request) === '/app/document-issues' && request.method === 'POST',
      respond: async (request) => {
        const entry = await record(request);
        const body = entry.body as {
          documentTypeCode: string;
          targets: { lotId: number }[];
          reissueReasonCode?: string | null;
        };

        if (options.issueHangs === true) {
          return new Response(new ReadableStream({ start: () => undefined }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (options.issueFail !== undefined) {
          return jsonResponse(options.issueFail.body ?? { message: '실패' }, {
            status: options.issueFail.status,
          });
        }

        const lotId = body.targets[0]?.lotId ?? 0;
        const key = `${body.documentTypeCode}|${String(lotId)}`;
        const seq = (issueCounts.get(key) ?? 0) + 1;
        const needsReason = seq > 1 && (body.reissueReasonCode ?? null) === null;

        if (needsReason) {
          return jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'reissueReasonCode',
                  code: 'REQUIRED',
                  message: '재발행 사유가 필요합니다.',
                },
              ],
            },
            { status: 422 },
          );
        }

        issueCounts.set(key, seq);
        logSeq += 1;
        const logId = ISSUE_LOG_BASE + logSeq;
        issueByLog.set(logId, lotId);
        const found = findLot(lotId);

        if (body.documentTypeCode === 'MATERIAL_LOT_LABEL' && found !== undefined) {
          found.lastLabelIssue = { issueSeq: seq, issuedAt: '2026-11-11T04:30:00Z' };
        }

        return jsonResponse(
          {
            items: [
              {
                documentIssueLogId: logId,
                documentTypeCode: body.documentTypeCode,
                target: { targetTypeCode: 'LOT', targetId: lotId, displayName: found?.lotNo ?? '' },
                lotId,
                lotNo: found?.lotNo ?? '',
                issueSeq: seq,
                issuedBy: 1,
                issuedByName: '합성 작업자',
                issuedAt: '2026-11-11T04:30:00Z',
                printOutcome: 'PENDING',
              },
            ],
            issuedCount: 1,
          },
          { status: 201 },
        );
      },
    },
    {
      match: (request) => /\/app\/document-issues\/\d+:report-print$/u.test(path(request)),
      respond: async (request) => {
        await record(request);

        return options.reportFails === true
          ? jsonResponse({ message: '보고 실패' }, { status: 500 })
          : jsonResponse({ documentIssueLogId: 1, printOutcome: 'SUCCEEDED' });
      },
    },
  ]);

  const identity: PopIdentity = {
    terminalId: null,
    processes: null,
    equipment: null,
    workerNo: WORKER_NO,
    plantId: PLANT_ID,
    ...options.identity,
  };

  const result = renderWithProviders(
    <PopIdentityProvider value={identity}>
      <PopMaterialLotLabelScreen />
      {/* 결과 알림 자리 — 실제로는 POP 셸(`pop-main`)이 둔다. */}
      <PuToastHost />
    </PopIdentityProvider>,
    { fetch },
  );

  return { ...result, sent, groups, findLot, shares };
};

/** 보낸 요청 가운데 이 경로의 것. */
export const sentTo = (sent: readonly Sent[], path: string): Sent[] =>
  sent.filter((entry) => entry.path === path);
