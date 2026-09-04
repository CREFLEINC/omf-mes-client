import { messages } from '@omf-mes/i18n';
import type { QueryClient } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { pickDate, pickRange } from '../../test/date-picker';
import {
  approvalRequestDetailFixture,
  balanceResponseFixturesByItem,
  contradictoryApprovalDetailFixture,
  createdIssueLineResponseFixtures,
  createdIssueResponseFixture,
  goodsIssueLineResponseFixtures,
  goodsIssueResponseFixtures,
  goodsReceiptResponseFixtures,
  INTERNAL_IDS,
  itemFixtures,
  locationFixtures,
  lotFixturesByItem,
  PARTNER_LABEL,
  partnerFixtures,
  receiptLineResponseFixtures,
  SAMPLE_PARTNER_ROLE,
  SAMPLE_APPROVED_STATUS,
  SAMPLE_FORM_CODES,
  SAMPLE_DEFECT_WAREHOUSE_TYPE,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import type { DisposalPartnerRoleCode } from './code-options';
import { balanceKeys } from './queries';
import { DisposalIssueScreen } from './screen';

const t = messages.disposalIssue;

/**
 * **자리표시 상수만 갈아 끼운다.**
 *
 * 값 목록은 지금 **비어 있고**(`code-options.test.ts`가 그 사실을 고정한다) 비어 있는 동안
 * 화면은 조건 코드를 고를 수 없고 창고를 좁히지 못한다. 그런데 자리표시의 값어치는
 * **채워진 뒤에 무엇이 달라지는가**에 있다 — 그것을 재지 않으면 자리표시는 죽은 가지다.
 *
 * 판정·선택지 만들기·좁힘은 실물 그대로이고 바뀌는 것은 「값 목록이 왔다」는 사실 하나다.
 * 매 테스트 앞에서 빈 배열로 되돌려, 아무것도 채우지 않은 테스트는 **지금의 화면**을 본다.
 */
const { codeValues, defectTypeCodes, approvedStatusCodes, partnerRole } = vi.hoisted(() => {
  /**
   * 폐기 거래처를 좁히는 역할 코드. **비어 있는 것이 지금의 사실이고**, 채웠을 때 선택지 조회가
   * 나가고 칸이 열리는 것을 재는 자리다(변경 통지 #128 §3 · 완료 조건 C23·C24).
   *
   * 타입이 실물과 같다 — 계약이 값을 다섯으로 좁혔으므로(#173) 이 그릇도 그 다섯과 빈 글자만
   * 받는다. `string`으로 두면 화면이 실제로는 만들 수 없는 상태를 재게 된다.
   */
  const partnerRole: { code: DisposalPartnerRoleCode } = { code: '' };

  return {
    codeValues: {
      issueType: [] as string[],
      sourceDocumentType: [] as string[],
      reason: [] as string[],
      receiptType: [] as string[],
      status: [] as string[],
      issueStatus: [] as string[],
    },
    defectTypeCodes: [] as string[],
    /**
     * 승인 완료를 뜻하는 상태 코드. **비어 있는 것이 지금의 사실이고**, 채웠을 때 결재 진행
     * 구획의 안내가 달라지는 것을 재는 자리다(전환 감지기).
     */
    approvedStatusCodes: [] as string[],
    partnerRole,
  };
});

vi.mock('./code-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./code-options')>();

  return {
    ...actual,
    PLACEHOLDER_DISPOSAL_ISSUE_CODES: codeValues,
    DEFECT_WAREHOUSE_TYPE_CODES: defectTypeCodes,
    /**
     * 역할 코드는 **글자 하나**라 배열처럼 내용만 바꿀 그릇이 없다 — 접근자로 낸다.
     * 바뀌는 것은 「값이 왔다」는 사실 하나이고, 판정·조회·좁힘은 실물 그대로다.
     *
     * 타입이 실물과 같다 — 계약이 역할 코드를 다섯으로 좁힌 뒤(#173) 이 목만 `string`으로
     * 두면 자리표시를 「계약 밖 값」으로도 채울 수 있게 되어, 화면이 실제로는 만들 수 없는
     * 상태를 재게 된다.
     */
    get DISPOSAL_PARTNER_ROLE_CODE(): DisposalPartnerRoleCode {
      return partnerRole.code;
    },
  };
});

/**
 * 승인 축의 자리표시도 같은 방식으로 갈아 끼운다 — **판정은 실물 그대로**이고 바뀌는 것은
 * 「값 목록이 왔다」는 사실 하나다. 채웠을 때 결재 진행 구획이 달라지지 않으면 그 자리표시는
 * 죽은 가지다.
 */
vi.mock('./approval-progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./approval-progress')>();

  return { ...actual, APPROVED_APPROVAL_STATUS_CODES: approvedStatusCodes };
});

/** 지어낸 합성 코드. **계약의 `@example` 값을 쓰지 않는다** — 예시가 확정 값으로 읽히면 안 된다. */
const SAMPLE_RECEIPT_TYPE = 'SAMPLE_GR_TYPE_A';
const SAMPLE_RECEIPT_STATUS = 'SAMPLE_GR_STATUS_A';

beforeEach(() => {
  codeValues.receiptType = [];
  codeValues.status = [];
  codeValues.issueType = [];
  codeValues.reason = [];
  codeValues.issueStatus = [];
  defectTypeCodes.length = 0;
  approvedStatusCodes.length = 0;
  partnerRole.code = '';
});

const fillCodeLists = (): void => {
  codeValues.receiptType = [SAMPLE_RECEIPT_TYPE];
  codeValues.status = [SAMPLE_RECEIPT_STATUS];
};

const fillDefectWarehouseTypes = (): void => {
  defectTypeCodes.push(SAMPLE_DEFECT_WAREHOUSE_TYPE);
};

const fillApprovedStatusCodes = (): void => {
  approvedStatusCodes.push(SAMPLE_APPROVED_STATUS);
};

/**
 * 폐기 거래처 역할 코드를 채운다 — **한 줄이 선택칸을 살린다**(변경 통지 #128 §3).
 *
 * 아무것도 채우지 않은 시험은 **지금의 화면**(선택칸이 잠긴 상태)을 본다.
 */
const fillPartnerRole = (): void => {
  partnerRole.code = SAMPLE_PARTNER_ROLE;
};

const ROUTE = '/logistics/disposal-issue';
const LIST_PATH = '/logistics/goods-receipts';
const WAREHOUSES_PATH = '/mdm/warehouses';

/** 이 회차가 고른 전표(9001)에 대해 부르는 경로들. */
const DETAIL_PATH = '/logistics/goods-receipts/9001';
const MISSING_DETAIL_PATH = '/logistics/goods-receipts/9002';
const BALANCES_PATH = '/inventory/balances';
const ITEMS_PATH = '/mdm/items';
/**
 * 거래처 — **한 경로를 두 가지로 부른다**(변경 통지 #128). 선택지는 역할 코드로 좁혀 받고,
 * 이름 풀이는 좁히지 않는다. 어느 쪽인지는 **질의로만** 갈린다.
 */
const PARTNERS_PATH = '/mdm/partners';
const UOMS_PATH = '/mdm/uoms';
const LOTS_PATH = '/trace/lots';
const LOCATIONS_PATH = '/mdm/locations';

/** 「처리 이력」 탭이 부르는 경로들. 고른 품의는 9501이고 그 승인 요청은 9521이다. */
const ISSUES_PATH = '/logistics/goods-issues';
const ISSUE_DETAIL_PATH = '/logistics/goods-issues/9501';
/** 「승인 요청」이 만드는 전표(9504)와 그 요청 경로. **토큰은 상세 경로에서만 온다.** */
const CREATED_DETAIL_PATH = '/logistics/goods-issues/9504';
const CREATED_APPROVAL_PATH = '/logistics/goods-issues/9504:request-approval';
/** 이력 탭에서 이어서 상신하는 자리(미상신 전표 9502). */
const RESUBMIT_APPROVAL_PATH = '/logistics/goods-issues/9502:request-approval';
/** 기타출고 처리 — **재고가 움직이는 자리**. 고른 품의(9501)의 전기 경로다. */
const POST_PATH = '/logistics/goods-issues/9501:post';
/** 미상신 전표의 전기 경로. **부를 수 있게 두고 「부르지 않았다」를 증명한다.** */
const MISSING_POST_PATH = '/logistics/goods-issues/9502:post';
const MISSING_ISSUE_DETAIL_PATH = '/logistics/goods-issues/9502';
const APPROVAL_DETAIL_PATH = '/app/approval-requests/9521';

/**
 * 이 회차가 **부르지 않아야 하는** 경로. 뒤 회차에서 쓰이거나 계약에 있으나 이 화면이 쓰지
 * 않는 자리다. **부를 수 있게 스텁을 두는 것이 요점이다** — 부르지 않음을 증명하려면 부를 수
 * 있어야 한다.
 */
const LINES_PATH = '/logistics/goods-receipts/9001/lines';
const ISSUE_LINES_PATH = '/logistics/goods-issues/9501/lines';
/** 승인 요청 **목록**. 이슈 §4가 지시한 경로이나 대상 유형 값이 없어 성립하지 않는다(결정 10). */
const APPROVAL_LIST_PATH = '/app/approval-requests';

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 폐기창고 가';
const OTHER_WAREHOUSE_LABEL = 'SAMPLE-WH-02 · 합성 자재창고 나';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 자재 가';
const UOM_LABEL = 'SAMPLE-UOM-EA · 합성 낱개';
const LOCATION_LABEL = 'SAMPLE-LOC-01 · 합성 적치 가';

/** 라인 전용 경로의 응답에만 있는 수량. 화면이 그 경로를 쓰지 않음을 **두 방향으로** 굳힌다. */
const LINES_ONLY_QTY = 7777;

interface RecordedRequest {
  method: string;
  url: URL;
  /**
   * 실제로 나간 헤더.
   *
   * **쓰기의 규약이 헤더에 있다** — 멱등 키와 잠금 토큰은 본문에 없으므로, 기록하지 않으면
   * 「어느 경로에서 꺼낸 토큰을 실었는가」를 잴 길이 없다(감지기 M58).
   */
  headers: Headers;
  /**
   * 쓰기 요청의 본문. 읽기에는 `null`이다.
   *
   * **실제로 나간 요청을 본다** — 화면이 만들었다고 믿는 것이 아니라 서버가 받을 것을 잰다.
   */
  body: unknown;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * `hold`에 든 경로는 **기록한 뒤에** 붙잡아 둔다 — 「보내는 동안 무엇이 잠기는가」를 판정하려면
 * 응답이 오기 전에 이미 기록돼 있어야 한다.
 */
const createRecordingFetch = (
  routes: StubRoute[],
  hold: string[] = [],
): { fetch: StubFetch; requests: RecordedRequest[]; release: () => void } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);
  let release = (): void => {
    /* 아래 Promise 생성자가 곧바로 채운다. */
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const fetch: StubFetch = async (request) => {
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
    const body: unknown = request.method === 'GET' ? null : await request.clone().json();

    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body,
    });

    if (hold.includes(new URL(request.url).pathname)) await gate;

    return stub(request);
  };

  return {
    fetch,
    requests,
    release: () => {
      release();
    },
  };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 50, total: items.length, ...page } });

const listRoute = (
  items: unknown[] = goodsReceiptResponseFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingListRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(body, { status }),
});

/**
 * 부를 때마다 **내용이 달라지는** 목록.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「목록 응답이 도착하면 치던 값이 되돌아간다」는 결함이 드러나지 않는다.
 */
const changingListRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LIST_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(
        listBody(goodsReceiptResponseFixtures, {
          total: goodsReceiptResponseFixtures.length + call,
        }),
      );
    },
  };
};

const warehousesRoute = (
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, WAREHOUSES_PATH),
  respond: () => jsonResponse(listBody(warehouseFixtures, page)),
});

const failingWarehousesRoute = (): StubRoute => ({
  match: (request) => isGet(request, WAREHOUSES_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

const detailBody = (lines: unknown[] = receiptLineResponseFixtures) => ({
  goodsReceipt: goodsReceiptResponseFixtures[0],
  lines,
});

const detailRoute = (lines?: unknown[]): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () => jsonResponse(detailBody(lines)),
});

const failingDetailRoute = (status: number, pathname = DETAIL_PATH): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 부를 때마다 **내용이 달라지는** 상세.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「상세 응답이 도착하면 치던 값이 되돌아간다」는 결함이 드러나지 않는다(감지기 M30).
 *
 * **헤더만 바꾸는 것으로는 모자란다.** 구조 공유는 **부분마다** 견주므로, 라인 내용이 같으면
 * `lines` 배열은 앞의 참조를 그대로 유지한다 — 정리 effect의 의존성에 그 배열을 넣는 결함이
 * 그대로 통과한다(뮤테이션 실측). 그래서 **라인도 함께 달라지게** 한다: 초안이 매인 줄 번호는
 * 그대로 두고, 초안 판정에 쓰이지 않는 **셋째 줄의 입고 수량**만 회차마다 바꾼다.
 */
const changingDetailRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, DETAIL_PATH),
    respond: () => {
      call += 1;

      return jsonResponse({
        goodsReceipt: {
          ...goodsReceiptResponseFixtures[0],
          receiptDatetime: `2026-08-06T09:${String(10 + call).padStart(2, '0')}:00+09:00`,
        },
        lines: receiptLineResponseFixtures.map((line, index) =>
          index === 2 ? { ...line, receiptQty: line.receiptQty + call } : line,
        ),
      });
    },
  };
};

const balancesRoute = (): StubRoute => ({
  match: (request) => isGet(request, BALANCES_PATH),
  respond: (request) => {
    const itemId = Number(new URL(request.url).searchParams.get('itemId'));

    return jsonResponse(listBody(balanceResponseFixturesByItem[itemId] ?? []));
  },
});

/** 참조 다섯 중 **하나만** 실패시킨다 — 넷을 접는 판정의 범위를 재는 자리다. */
const failingReferenceRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

const lineReferenceRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, ITEMS_PATH),
    respond: () => jsonResponse(listBody(itemFixtures)),
  },
  {
    match: (request) => isGet(request, UOMS_PATH),
    respond: () => jsonResponse(listBody(uomFixtures)),
  },
  {
    match: (request) => isGet(request, LOTS_PATH),
    respond: (request) => {
      const itemId = Number(new URL(request.url).searchParams.get('itemId'));

      return jsonResponse(listBody(lotFixturesByItem[itemId] ?? []));
    },
  },
  {
    match: (request) => isGet(request, LOCATIONS_PATH),
    respond: () => jsonResponse(listBody(locationFixtures)),
  },
  partnersRoute(),
];

/**
 * 거래처 — **질의에 따라 내용이 달라진다.**
 *
 * 좁힌 선택지 조회와 좁히지 않은 이름 풀이가 **같은 경로**라, 늘 같은 목록을 돌려주면
 * 「선택지가 좁혀 받은 목록인가 이름 풀이 목록인가」를 어떤 감지기도 가를 수 없다 — 두 조회를
 * 한 캐시로 합치는 결함이 그대로 통과한다.
 *
 * 좁힌 쪽은 **첫 건만** 낸다(9561). 이름 풀이는 미사용(9562)까지 전부 낸다.
 */
const partnersRoute = (): StubRoute => ({
  match: (request) => isGet(request, PARTNERS_PATH),
  respond: (request) =>
    jsonResponse(
      listBody(
        new URL(request.url).searchParams.has('roleTypeCode')
          ? partnerFixtures.slice(0, 1)
          : partnerFixtures,
      ),
    ),
});

/** 선택지 조회만 실패시킨다 — 이름 풀이는 멀쩡해야 「그 칸의 사정」이 갈린다. */
const failingPartnersRoute = (): StubRoute => ({
  match: (request) => isGet(request, PARTNERS_PATH),
  respond: (request) =>
    new URL(request.url).searchParams.has('roleTypeCode')
      ? jsonResponse({ message: '' }, { status: 500 })
      : jsonResponse(listBody(partnerFixtures)),
});

/** 서버가 **전체 건수를 더 크게** 준다 — 앞쪽 일부만 받았다는 사실이 표식으로 나와야 한다. */
const truncatedPartnersRoute = (): StubRoute => ({
  match: (request) => isGet(request, PARTNERS_PATH),
  respond: (request) =>
    jsonResponse(
      new URL(request.url).searchParams.has('roleTypeCode')
        ? listBody(partnerFixtures.slice(0, 1), { total: 120 })
        : listBody(partnerFixtures),
    ),
});

/** 목록은 **왔는데 0건**이다 — 「아직 오지 않았다」와 다른 사실이다. */
const emptyPartnersRoute = (): StubRoute => ({
  match: (request) => isGet(request, PARTNERS_PATH),
  respond: (request) =>
    jsonResponse(
      new URL(request.url).searchParams.has('roleTypeCode')
        ? listBody([])
        : listBody(partnerFixtures),
    ),
});

const issueListRoute = (
  items: unknown[] = goodsIssueResponseFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, ISSUES_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingIssueListRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, ISSUES_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const issueDetailBody = (
  lines: unknown[] = goodsIssueLineResponseFixtures,
  issue: unknown = goodsIssueResponseFixtures[0],
) => ({ goodsIssue: issue, lines });

const issueDetailRoute = (
  lines?: unknown[],
  issue?: unknown,
  pathname = ISSUE_DETAIL_PATH,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(issueDetailBody(lines, issue)),
});

const failingIssueDetailRoute = (status: number, pathname = ISSUE_DETAIL_PATH): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const disconnectedIssueDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, ISSUE_DETAIL_PATH),
  respond: () => {
    throw new TypeError('Failed to fetch');
  },
});

/**
 * 부를 때마다 **내용이 달라지는** 이력 목록·상세·승인 요청.
 *
 * 같은 본문을 돌려주면 캐시가 구조 공유로 같은 참조를 유지해 「다시 불렀는가」가 화면에
 * 드러나지 않는다 — 새로고침이 세 경로를 함께 부르는지 재려면 각자 달라져야 한다.
 */
const changingApprovalRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, APPROVAL_DETAIL_PATH),
    respond: () => {
      call += 1;

      return jsonResponse({
        ...approvalRequestDetailFixture,
        request: {
          ...approvalRequestDetailFixture.request,
          statusCode: `SAMPLE_AP_STATUS_${String(call)}`,
        },
      });
    },
  };
};

const approvalRoute = (detail: unknown = approvalRequestDetailFixture): StubRoute => ({
  match: (request) => isGet(request, APPROVAL_DETAIL_PATH),
  respond: () => jsonResponse(detail),
});

const failingApprovalRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, APPROVAL_DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 잠금 토큰. **상세 200과 등록 201이 서로 다른 값을 준다** — 상신이 어느 경로에서 꺼낸
 * 토큰을 실었는지 가르려면 두 값이 달라야 한다(감지기 M58).
 */
const CREATED_DETAIL_ETAG = '"token-created-detail"';
const COLLECTION_ETAG = '"token-collection"';

const isPost = (request: Request, pathname: string): boolean =>
  request.method === 'POST' && new URL(request.url).pathname === pathname;

const createdDetailBody = (lines: unknown[] = createdIssueLineResponseFixtures) => ({
  goodsIssue: createdIssueResponseFixture,
  lines,
});

/**
 * 전표 생성. **응답에 `ETag`가 실린다** — 그 토큰은 **컬렉션 경로**에 앉으므로 상신이 쓰면 안
 * 된다(계획 결정 13). 실측한 목의 모양을 그대로 흉내 낸다.
 */
const createRoute = (): StubRoute => ({
  match: (request) => isPost(request, ISSUES_PATH),
  respond: () =>
    jsonResponse(createdDetailBody(), { status: 201, headers: { ETag: COLLECTION_ETAG } }),
});

const failingCreateRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isPost(request, ISSUES_PATH),
  respond: () => jsonResponse(body, { status }),
});

/** 만들어진 전표의 상세 — **상신의 토큰이 여기서 온다.** */
const createdDetailRoute = (etag = CREATED_DETAIL_ETAG): StubRoute => ({
  match: (request) => isGet(request, CREATED_DETAIL_PATH),
  respond: () => jsonResponse(createdDetailBody(), { headers: { ETag: etag } }),
});

/** 부를 때마다 **다른 토큰**을 준다 — 409 뒤 다시 읽으면 토큰이 새것이 되는지 재는 자리다. */
const rotatingCreatedDetailRoute = (): StubRoute => {
  let served = 0;

  return {
    match: (request) => isGet(request, CREATED_DETAIL_PATH),
    respond: () => {
      served += 1;

      return jsonResponse(createdDetailBody(), { headers: { ETag: `"token-${String(served)}"` } });
    },
  };
};

/** 상신 202. **응답에 `ETag`가 없다**(실측) — 성공 뒤 뿌리를 무효화해야 하는 근거다. */
const approvalSubmitRoute = (pathname = CREATED_APPROVAL_PATH): StubRoute => ({
  match: (request) => isPost(request, pathname),
  respond: () => jsonResponse({ approvalRequestId: 9523 }, { status: 202 }),
});

const failingApprovalSubmitRoute = (
  status: number,
  body: unknown = { message: '' },
  pathname = CREATED_APPROVAL_PATH,
): StubRoute => ({
  match: (request) => isPost(request, pathname),
  respond: () => jsonResponse(body, { status }),
});

/** 연쇄가 통째로 성공하는 한 벌. 세 요청이 이 차례로 나간다. */
const chainRoutes = (): StubRoute[] => [createRoute(), createdDetailRoute(), approvalSubmitRoute()];

/**
 * 이 회차가 부르지 않아야 하는 경로들. **부를 수 있게 둔다** — 스텁이 없으면 하네스가 던져
 * 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
const laterPhaseRoutes = (): StubRoute[] => [
  /* 라인 전용 경로는 상세가 이미 라인을 주므로 부를 이유가 없다 — 응답에 표식을 심어 둔다. */
  {
    match: (request) => isGet(request, LINES_PATH),
    respond: () =>
      jsonResponse(listBody([{ ...receiptLineResponseFixtures[0], receiptQty: LINES_ONLY_QTY }])),
  },
  {
    match: (request) => isGet(request, ISSUE_LINES_PATH),
    respond: () => jsonResponse(listBody(goodsIssueLineResponseFixtures)),
  },
  /* 이슈 §4가 지시한 승인 요청 **목록** 경로. 화면은 이것을 쓰지 않는다(계획 결정 10). */
  {
    match: (request) => isGet(request, APPROVAL_LIST_PATH),
    respond: () => jsonResponse(listBody([])),
  },
  {
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === ISSUES_PATH,
    respond: () => jsonResponse({}, { status: 201 }),
  },
  /*
   * **미상신 전표의 전기 경로.** 화면은 이 전표에서 처리를 잠그므로 부르지 않는다 — 부를 수
   * 있게 두어야 「잠갔다」와 「스텁이 없어 던졌다」가 구분된다.
   */
  {
    match: (request) => isPost(request, MISSING_POST_PATH),
    respond: () => jsonResponse(goodsIssueResponseFixtures[1]),
  },
];

/** 이 화면이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌. */
const allRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
  listRoute(),
  warehousesRoute(),
  detailRoute(),
  balancesRoute(),
  issueListRoute(),
  issueDetailRoute(),
  approvalRoute(),
  ...lineReferenceRoutes(),
  ...laterPhaseRoutes(),
];

/** 주소가 실제로 어떻게 바뀌는지 본다 — 수명 표를 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/**
 * **화면 바깥에서** 주소를 갈아 끼운다. 뒤로가기·앞으로가기·주소 직접 편집이 이 경로다.
 */
const SearchProbe = ({ to }: { to: string }) => {
  const [, setSearchParams] = useSearchParams();

  return (
    <button
      type="button"
      onClick={() => {
        setSearchParams(new URLSearchParams(to));
      }}
    >
      주소 이동
    </button>
  );
};

/**
 * 한 칸 뒤로 간다. **히스토리가 몇 칸 늘었는지를 판정하는 유일한 수단**이다 —
 * 기억 라우터는 브라우저 히스토리를 쓰지 않아 `window.history.back()`이 닿지 않는다.
 */
const BackProbe = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(-1);
      }}
    >
      뒤로
    </button>
  );
};

/**
 * 앱과 같은 **엄격 모드**로 그릴지. 기본은 아니다.
 *
 * `app/main.tsx`가 `<StrictMode>`를 쓰므로 개발 모드에서는 effect가 **두 번** 발화한다 —
 * 되돌릴 수 없는 요청을 보내는 effect가 그 이중 발화에 한 번 더 나가지 않는지는 **그 조건으로
 * 그려야만** 잴 수 있다. 모든 잣대를 그렇게 그리지 않는 이유는 이중 발화가 요청 수를 두 배로
 * 만들어 다른 계수 단언을 흐리기 때문이다.
 */
const renderScreen = (
  routes: StubRoute[],
  search = '',
  navigateTo = '',
  hold: string[] = [],
  strict = false,
): {
  requests: RecordedRequest[];
  queryClient: QueryClient;
  user: ReturnType<typeof userEvent.setup>;
  release: () => void;
} => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  const tree = (
    <>
      <DisposalIssueScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>
  );

  const { queryClient } = renderWithProviders(strict ? <StrictMode>{tree}</StrictMode> : tree, {
    fetch,
    route: `${ROUTE}${search}`,
  });

  return { requests, queryClient, user: userEvent.setup(), release };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

/**
 * 이 회차에 이 화면이 부를 수 있는 경로 **전부**.
 *
 * **여기 없는 경로로 나간 요청은 그 자체가 결함이다** — 경로마다 세는 단언은 **예상 경로 집합
 * 밖으로** 나간 요청을 하나도 보지 못한다. 「고르지 않았는데 상세를 부른다」가 `…/0`처럼
 * 대체값을 단 경로로 나가면 어느 계수에도 걸리지 않는다.
 */
const KNOWN_PATHS = [
  LIST_PATH,
  WAREHOUSES_PATH,
  DETAIL_PATH,
  BALANCES_PATH,
  ITEMS_PATH,
  UOMS_PATH,
  LOTS_PATH,
  LOCATIONS_PATH,
  PARTNERS_PATH,
  ISSUES_PATH,
  ISSUE_DETAIL_PATH,
  MISSING_ISSUE_DETAIL_PATH,
  APPROVAL_DETAIL_PATH,
  CREATED_DETAIL_PATH,
  CREATED_APPROVAL_PATH,
  RESUBMIT_APPROVAL_PATH,
  POST_PATH,
  MISSING_POST_PATH,
];

const expectNoUnknownPath = (requests: RecordedRequest[]): void => {
  expect(
    requests
      .filter((request) => !KNOWN_PATHS.includes(request.url.pathname))
      .map((request) => `${request.method} ${request.url.pathname}`),
  ).toEqual([]);
};

/**
 * **고른 전표에 매인 조회들.** 「고르기 전에는 부르지 않는다」와 「고르면 한 번 부른다」를
 * 이 목록으로 함께 잰다 — 하나만 세면 나머지가 규칙 밖으로 샌다.
 */
const SELECTION_PATHS = [
  DETAIL_PATH,
  BALANCES_PATH,
  ITEMS_PATH,
  UOMS_PATH,
  LOTS_PATH,
  LOCATIONS_PATH,
];

/**
 * 화면이 **쓸모없는 실패를 만들지 않았는가.**
 *
 * 성립하지 않는 조회를 불러 두면 요청이 나가지 않아도 그 쿼리는 실패로 앉는다 —
 * 요청 수만 세는 단언은 이 자리를 보지 못한다.
 */
const expectNoFailedQuery = (queryClient: QueryClient): void => {
  expect(
    queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.status === 'error')
      .map((query) => JSON.stringify(query.queryKey)),
  ).toEqual([]);
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const listTable = (): HTMLElement => {
  const table = screen.getAllByRole('table')[0];

  if (table === undefined) throw new Error('입고 전표 목록 표가 없다');

  return table;
};

/**
 * 목록의 첫 행이 그려질 때까지 기다린다.
 *
 * **문서 전체가 아니라 목록 표 안에서 본다** — 전표를 고르면 아래 구획의 제목줄에도 같은
 * 입고번호가 서므로, 문서 전체에서 단수로 찾으면 둘이 함께 있는 순간 던진다.
 */
const waitForList = async (): Promise<void> => {
  await waitFor(() => {
    expect(within(listTable()).getByText('GR-2026-900001')).toBeInTheDocument();
  });
};

const selectReceipt = async (
  user: ReturnType<typeof userEvent.setup>,
  goodsReceiptNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectRow(goodsReceiptNo) }));
};

const search = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: messages.common.search }));
};

const refresh = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.refresh }));
};

/**
 * 선택칸을 열고 그 선택지 목록을 돌려준다.
 *
 * **목록 안에서만 본다** — 창고 이름은 표의 창고 칸에도 나오므로 문서 전체에서 찾으면 무엇을
 * 집었는지 알 수 없다. 선택지 문구는 **접근 이름**으로 잰다: 항목마다 장식용 아이콘이 함께
 * 들어 있어 글자를 그대로 이으면 그 아이콘의 이름까지 딸려 온다.
 */
const openOptions = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<HTMLElement> => {
  await user.click(screen.getByLabelText(label));

  return screen.getByRole('listbox');
};

/** 목록 구획에 내부 번호가 새지 않았는지 본다. 짝이 되는 「이름은 보인다」와 함께 쓴다. */
const expectNoInternalIds = (): void => {
  const pane = screen.getByRole('region', { name: t.panes.list });

  for (const id of INTERNAL_IDS) {
    expect(pane.textContent ?? '').not.toContain(id);
  }
};

describe('DisposalIssueScreen — 첫 진입 조회', () => {
  /*
   * 기본 기간이나 기본 창고를 심으면 첫 요청에 조건이 실리고, 사용자는 왜 그것만 보이는지
   * 화면 어디에서도 읽을 수 없다. 창고를 심는 것은 「이 창고가 폐기 대상 창고다」를 화면이
   * 지어내는 것이기도 하다.
   */
  it('목록 요청이 1회 나가고 조건이 하나도 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.has('warehouseId')).toBe(false);
    expect(list[0]?.url.searchParams.has('receiptDateFrom')).toBe(false);
    /* 짝 방향 — 조건 자체가 하나도 실리지 않는다. */
    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  it('조건을 심지 않고 주소를 그대로 둔다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(within(listTable()).getAllByRole('row')).toHaveLength(
      goodsReceiptResponseFixtures.length + 1,
    );
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /** 창고는 첫 진입에 받는다 — 조건 줄과 목록 표가 첫 화면부터 이 이름을 쓴다. */
  it('창고 이름을 첫 진입에 1회 받는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);
    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);
  });

  /**
   * **고르기 전에 부르는 경로는 둘뿐이다.** 상세·잔액·라인 참조 넷은 **고른 뒤에** 온다 —
   * 미리 부르면 쓰지 않는 자료를 받는다. **경로 전체를 세어** 예상 밖으로 나간 요청까지 잡는다.
   */
  it('고르기 전에는 목록과 창고 말고 어느 경로도 부르지 않는다', async () => {
    const { requests, queryClient } = renderScreen(allRoutes());

    await waitForList();

    expect(
      requests
        .filter((request) => request.url.pathname !== LIST_PATH)
        .filter((request) => request.url.pathname !== WAREHOUSES_PATH)
        .map((request) => `${request.method} ${request.url.pathname}`),
    ).toEqual([]);
    expectNoUnknownPath(requests);
    expectNoFailedQuery(queryClient);
  });

  /**
   * 이 회차는 대상을 보는 데까지다. 되돌릴 수 없는 쓰기는 확인 창·결과 구획과 함께 와야 하므로
   * 여기서는 어떤 쓰기도 나가지 않는다.
   */
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await selectReceipt(user, 'GR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(1);
    });

    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    /* 본문이 실린 요청도 없다 — method만 세면 다른 경로의 쓰기를 놓친다. */
    expect(requests.map((request) => request.body)).toEqual(requests.map(() => null));
    /* 짝 방향 — 읽기는 실제로 나갔다(아무 요청도 없어서 통과한 것이 아니다). */
    expect(requests.length).toBeGreaterThan(0);
  });

  /** 목록 어느 칸에도 내부 번호가 없다. 짝으로 이름이 실제로 보이는 것을 함께 잰다. */
  it('목록에 내부 번호가 없고 이름은 보인다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);
    expectNoInternalIds();
  });
});

describe('DisposalIssueScreen — 주소가 조건을 소유한다', () => {
  /** 컴포넌트 상태로만 들고 있으면 새로고침·뒤로가기·공유가 같은 결과를 내지 못한다. */
  it('조회를 누르면 조건이 주소에 실린다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR-2026`);
    });
  });

  it('기간을 고르면 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await pickRange(user, screen.getByLabelText(t.fields.period), '2026-08-01', '2026-08-05');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toContain('from=2026-08-01');
    });

    const list = requestsTo(requests, LIST_PATH);
    const last = list[list.length - 1];

    expect(last?.url.searchParams.get('receiptDateFrom')).toBe('2026-08-01');
    expect(last?.url.searchParams.get('receiptDateTo')).toBe('2026-08-05');
  });

  /** 조건 여섯이 **전부** 주소에서 오고 요청으로 간다 — 하나만 재면 나머지의 배선이 비어도 지나간다. */
  it('그 주소로 다시 들어가면 같은 조건으로 조회한다', async () => {
    const { requests } = renderScreen(
      allRoutes(),
      '?wh=9701&from=2026-08-01&to=2026-08-05&ty=SAMPLE_TY_A&st=SAMPLE_ST_A&q=GR-2026&page=2',
    );

    await waitForList();

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(Object.fromEntries(list[0]?.url.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      receiptDateFrom: '2026-08-01',
      receiptDateTo: '2026-08-05',
      receiptTypeCode: 'SAMPLE_TY_A',
      statusCode: 'SAMPLE_ST_A',
      q: 'GR-2026',
      page: '2',
    });
  });

  /* 주소는 손으로 고쳐지는 자리다 — 이상한 값을 그대로 보내면 조회 전체가 실패한다. */
  it('정수가 아닌 조건과 없는 날짜는 요청에 실리지 않는다', async () => {
    const { requests } = renderScreen(
      allRoutes(),
      '?wh=abc&page=0&gr=xyz&q=%20%20&from=2026-02-31&to=2026-13-01',
    );

    await waitForList();

    const list = requestsTo(requests, LIST_PATH);

    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
    /* 짝 방향 — 실존하는 날짜는 실린다(전부 버려서 통과한 것이 아니다). */
    expect(list).toHaveLength(1);
  });

  it('실존하는 날짜는 요청에 실린다', async () => {
    const { requests } = renderScreen(allRoutes(), '?from=2026-02-28');

    await waitForList();

    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.get('receiptDateFrom')).toBe(
      '2026-02-28',
    );
  });

  /**
   * 입력마다 주소를 갱신하면 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과 입력을
   * 같은 통로로 다루게 된다.
   */
  it('조건을 치는 동안에는 주소가 바뀌지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');

    expect(currentLocation()).toBe(ROUTE);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  /**
   * 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어 사용자가 뒤로 눌렀는데 같은 자리로
   * 돌아온 것처럼 보인다.
   */
  it('조작 한 번에 주소 갱신도 한 번이다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });
});

describe('DisposalIssueScreen — 수명 표', () => {
  /** `page`·`gr`를 남기면 좁아진 결과에 없는 전표를 가리킨 채 주소만 남는다(1행). */
  it('조건을 바꾸면 첫 쪽으로 돌아가고 고른 전표가 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2&gr=9001');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });
  });

  it('초기화가 조건·쪽·고른 전표를 함께 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=GR&page=2&gr=9001');

    await waitForList();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /** 쪽을 옮기면 보이는 행이 통째로 바뀐다. 고른 전표가 남으면 화면과 어긋난다(3행). */
  it('쪽을 옮기면 고른 전표가 풀린다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(goodsReceiptResponseFixtures, { total: 120 })]),
      '?gr=9001',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /**
   * **조건이 걸린 상태의 쪽 이동**(3행의 「쪽만 옮긴다」 쪽 방향 · PR ① 검증 관찰 O2).
   *
   * 앞 감지기는 조건이 **없는** 주소에서 쪽 이동을 재므로 「쪽을 옮길 때 조건까지 비운다」는
   * 어긋남을 보지 못한다 — 결과 주소가 어느 쪽이든 `?page=2`로 같기 때문이다. 조건을 걸어
   * 두면 그 어긋남이 주소에서 곧바로 드러나고, **요청에도 그 조건이 그대로 실렸는지**를
   * 함께 잰다(주소만 남고 조회는 안 걸린 상태가 아님을 굳히는 짝).
   */
  it('조건이 걸린 상태에서 쪽을 옮기면 조건은 남고 선택만 풀린다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([listRoute(goodsReceiptResponseFixtures, { total: 120 })]),
      '?wh=9701&q=GR&gr=9001',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?wh=9701&q=GR&page=2`);
    });

    const last = requestsTo(requests, LIST_PATH).at(-1);

    expect(Object.fromEntries(last?.url.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      q: 'GR',
      page: '2',
    });
  });

  /** 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(4행) — 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다. */
  it('전표를 골라도 조건과 쪽은 그대로다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(goodsReceiptResponseFixtures, { page: 2, total: 120 })]),
      '?q=GR&page=2',
    );

    await waitForList();
    await selectReceipt(user, 'GR-2026-900001');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR&page=2&gr=9001`);
    });
  });

  it('고른 전표를 다시 누르면 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.deselectRow('GR-2026-900001') }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /**
   * 되돌림이 목록 응답에 반응하면 사용자가 조건을 치는 도중에 값이 사라진다(`omf-mes#43`).
   * 목록을 **실제로 다시 받은 뒤**에도 치던 값이 남아 있어야 한다(13·14행).
   */
  it('목록이 다시 도착해도 치던 조건이 사라지지 않는다', async () => {
    const { user } = renderScreen(allRoutes([changingListRoute()]));

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');

    await refresh(user);

    await waitFor(() => {
      expect(screen.getByText(t.pageNav.range(1, 3, 5))).toBeInTheDocument();
    });

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('GR-2026');
  });

  /**
   * 「다시 조회」는 **화면이 보고 있는 조회**를 다시 한다 — 고르기 전에 그것은 목록 하나다.
   *
   * **참조(창고 이름)는 함께 부르지 않는다.** 기준정보는 이 조작으로 달라지지 않고, 다시
   * 부르면 표의 창고 칸이 잠깐 「불러오는 중」으로 되돌아간다. 못 받았을 때의 복구는 목록
   * 구획의 「다시 시도」가 따로 갖는다 — 그 둘을 한 버튼에 묶으면 문구가 적은 대상과 실제로
   * 다시 부르는 대상이 어긋난다.
   */
  it('고르기 전 다시 조회는 목록만 다시 부르고 참조는 건드리지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]));

    await waitForList();

    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);

    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);
    /* 고르지 않았으면 상세·잔액은 **가드가 막는 것이 아니라 조회 자체가 없다.** */
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
  });

  /** 「다시 조회」는 조건·쪽·선택을 하나도 바꾸지 않는다(14행). */
  it('다시 조회가 조건과 선택을 그대로 둔다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]), '?q=GR&gr=9001');

    await waitForList();
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBe(2);
    });

    expect(currentLocation()).toBe(`${ROUTE}?q=GR&gr=9001`);
  });
});

describe('DisposalIssueScreen — 빈 상태 세 갈래', () => {
  /** 바깥에서 0건을 갈라 내면 `Table.empty`가 닿을 수 없는 가지가 된다. */
  it('결과가 없으면 표의 빈 상태가 맡는다', async () => {
    renderScreen(allRoutes([listRoute([])]));

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('쪽 밖이면 다른 안내를 낸다', async () => {
    renderScreen(allRoutes([listRoute([], { page: 9, total: 120 })]), '?page=9');

    expect(await screen.findByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  /** 셋째 갈래 — 아직 전표를 고르지 않았다. 표가 아니라 아래 구획이 맡는다. */
  it('전표를 고르기 전에는 고르라는 안내가 선다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();

    /* 짝 방향 — 고르면 그 안내가 사라진다. */
    await selectReceipt(user, 'GR-2026-900001');

    await waitFor(() => {
      expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
    });
  });
});

describe('DisposalIssueScreen — 조회 실패', () => {
  /** **실패를 빈 상태로 보이지 않는다** — 「없습니다」로 내면 자료가 없는 줄 알고 조건을 넓힌다. */
  it('조회 실패는 배너로 내고 빈 상태 문구를 함께 내지 않는다', async () => {
    renderScreen(allRoutes([failingListRoute(500)]));

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /** 권한 없음에는 다시 시도를 내지 않는다 — 같은 권한으로 다시 불러도 같은 답이 온다. */
  it('권한 없음에는 다시 시도가 붙지 않는다', async () => {
    renderScreen(allRoutes([failingListRoute(403)]));

    expect(await screen.findByText(messages.httpError.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /** 「버튼이 있다」만 보면 눌러도 아무 일이 없는 버튼을 통과시킨다 — **요청 수가 늘어야 한다.** */
  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingListRoute(500)]));

    await screen.findByText(messages.httpError.loadTitle);

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });
  });

  /** 창고 이름을 못 받아도 **목록은 그대로 산다** — 이름 자리에 사유가 표시된다. */
  it('창고 이름 조회가 실패해도 목록이 산다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingWarehousesRoute()]));

    await waitForList();

    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();
    expect(screen.getAllByText(t.values.referenceFailed).length).toBe(
      goodsReceiptResponseFixtures.length,
    );

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, WAREHOUSES_PATH).length).toBe(2);
    });
  });

  /** 잘림은 실패와 다르다 — 다시 불러도 같은 쪽이 오므로 사실만 밝힌다. */
  it('창고 목록이 잘리면 그 사실을 밝힌다', async () => {
    renderScreen(allRoutes([warehousesRoute({ total: 120 })]));

    await waitForList();

    /* **조건 줄의 창고 칸은 조건 줄 문구를 쓴다** — 거기에는 「다시 시도」가 실재한다. */
    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
    /* 못 불러온 것이 먼저다 — 잘림이 좁힘 안내를 덮는다. */
    expect(screen.queryByText(t.filters.warehouseTypePending)).not.toBeInTheDocument();
  });
});

/**
 * **자리표시의 두 방향.**
 *
 * 값 목록이 비어 있는 지금 무엇이 보이는지와, 채워졌을 때 무엇이 달라지는지를 함께 잰다 —
 * 뒤엣것을 재지 않으면 자리표시는 채워도 살아나지 않는 죽은 가지다.
 */
describe('DisposalIssueScreen — 조건 코드 자리표시', () => {
  it('값 목록이 비면 선택지가 비고 왜 비었는지 밝힌다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByLabelText(t.fields.receiptType)).toHaveTextContent(
      messages.pendingCode.placeholder,
    );
    expect(screen.getAllByText(messages.pendingCode.note).length).toBe(2);
  });

  /**
   * **비어 있는 조회 조건 코드는 아무것도 막지 않는다.** 등록 필수 코드와 갈리는 자리다 —
   * 조건은 없어도 조회가 되고, 막으면 화면 전체가 값 확정을 기다리는 상태가 된다.
   */
  it('값 목록이 비어도 조회를 막지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByRole('button', { name: messages.common.search })).not.toBeDisabled();

    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });
  });

  it('값 목록이 채워지면 선택지가 서고 안내가 사라진다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes());

    await waitForList();

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();

    const listbox = await openOptions(user, t.fields.receiptType);

    expect(within(listbox).getAllByRole('option')).toHaveLength(2);
    expect(within(listbox).getByRole('option', { name: t.filters.all })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: SAMPLE_RECEIPT_TYPE })).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 폐기 대상 창고 좁힘', () => {
  /**
   * 지금은 **좁히지 못한다.** 창고 유형의 값 목록이 없어 「이 창고가 폐기 대상 창고인가」를
   * 화면이 물을 수 없다 — 전체를 보이고 그 사실을 밝힌다.
   */
  it('자리표시가 비면 전체 창고를 보이고 그 사실을 밝힌다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByText(t.filters.warehouseTypePending)).toBeInTheDocument();

    const listbox = await openOptions(user, t.fields.warehouse);

    expect(within(listbox).getAllByRole('option')).toHaveLength(3);
    expect(within(listbox).getByRole('option', { name: WAREHOUSE_LABEL })).toBeInTheDocument();
    /* 미사용 창고도 선택지에 남는다 — 빼면 그 창고로 들어온 과거 입고를 찾을 길이 사라진다. */
    expect(
      within(listbox).getByRole('option', {
        name: `${OTHER_WAREHOUSE_LABEL}${t.values.inactiveSuffix}`,
      }),
    ).toBeInTheDocument();
  });

  /** **전환** — 배열이 채워지면 그 유형만 남고 안내가 사라진다. */
  it('자리표시를 채우면 그 유형만 남고 안내가 사라진다', async () => {
    fillDefectWarehouseTypes();

    const { user } = renderScreen(allRoutes());

    await waitForList();

    expect(screen.queryByText(t.filters.warehouseTypePending)).not.toBeInTheDocument();

    const listbox = await openOptions(user, t.fields.warehouse);

    expect(within(listbox).getAllByRole('option')).toHaveLength(2);
    expect(within(listbox).getByRole('option', { name: WAREHOUSE_LABEL })).toBeInTheDocument();
    expect(
      within(listbox).queryByRole('option', {
        name: `${OTHER_WAREHOUSE_LABEL}${t.values.inactiveSuffix}`,
      }),
    ).not.toBeInTheDocument();
  });

  /**
   * **좁힌 뒤에도 목록 표의 이름은 전부 풀린다.** 조건 없이 조회하면 다른 창고의 입고가 함께
   * 오는데, 좁힌 목록으로 이름을 풀면 그 전표의 창고가 **「목록에 없음」으로 찍힌다**
   * (`omf-mes#47`이 금지한 표기).
   */
  it('좁힌 뒤에도 다른 창고의 입고 이름이 풀린다', async () => {
    fillDefectWarehouseTypes();

    renderScreen(allRoutes());

    await waitForList();

    expect(within(listTable()).getByText(OTHER_WAREHOUSE_LABEL)).toBeInTheDocument();
  });

  /** 좁힘은 **선택지 하나**에서만 일어난다 — 요청에 창고 유형 조건을 실어 좁히지 않는다. */
  it('좁힘을 요청 조건으로 만들지 않는다', async () => {
    fillDefectWarehouseTypes();

    const { requests } = renderScreen(allRoutes());

    await waitForList();

    expect(
      requestsTo(requests, WAREHOUSES_PATH)[0]?.url.searchParams.has('warehouseTypeCode'),
    ).toBe(false);
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.has('warehouseId')).toBe(false);
  });

  /**
   * **좁힘 밖 창고를 주소로 걸었을 때 — 표 쪽과 대칭인 칩 쪽 규칙.**
   *
   * 좁힘이 살아난 뒤에도 주소는 사람이 직접 고칠 수 있고, 그렇게 걸린 창고는 **선택지에 없다.**
   * 그때 화면이 그 조건을 말할 수 있는 자리는 **조건 칩 하나뿐**이므로, 칩의 이름 풀이가
   * **좁히지 않은 참조**를 써야 한다. 좁힌 목록으로 풀면 칩이 「창고: 알 수 없음」으로 서는데,
   * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다(`omf-mes#47`이 금지한 표기).
   *
   * 「선택칸에는 서지 않지만 조건은 걸려 있고 칩이 그것을 이름으로 말한다」가 이 화면이
   * 그 상황을 받아들일 만하다고 판정한 근거다 — 그 문장을 이 감지기가 잰다.
   */
  it('좁힘 밖 창고를 주소로 걸어도 칩이 이름으로 말한다', async () => {
    fillDefectWarehouseTypes();

    const { requests, user } = renderScreen(allRoutes(), '?wh=9702');

    await waitForList();

    /* ① 칩이 그 창고를 **이름으로** 말한다 — 번호도 「알 수 없음」도 아니다. */
    expect(screen.getByText(t.filters.chipWarehouse(OTHER_WAREHOUSE_LABEL))).toBeInTheDocument();
    expect(screen.queryByText(t.filters.chipWarehouse(t.values.unknown))).not.toBeInTheDocument();

    /* ② 조건은 실제로 걸려 있다 — 칩만 뜨고 조회는 그대로인 상태가 아니다. */
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.get('warehouseId')).toBe('9702');

    /* ③ 그런데 선택칸 선택지에는 없다 — 좁힘이 살아 있다는 짝 방향. */
    const listbox = await openOptions(user, t.fields.warehouse);

    expect(
      within(listbox).queryByRole('option', {
        name: `${OTHER_WAREHOUSE_LABEL}${t.values.inactiveSuffix}`,
      }),
    ).not.toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: WAREHOUSE_LABEL })).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 조건 칩', () => {
  it('걸린 조건을 이름으로 보이고 ×가 그 조건만 푼다', async () => {
    const { user } = renderScreen(allRoutes(), '?wh=9701&q=GR-2026');

    await waitForList();

    expect(screen.getByText(t.filters.chipWarehouse(WAREHOUSE_LABEL))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveWarehouse }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR-2026`);
    });
  });

  /** 이름을 못 풀어도 **번호를 대신 내지 않는다**(`omf-mes#44`). */
  it('이름을 못 푼 창고 조건에도 번호를 내지 않는다', async () => {
    renderScreen(allRoutes(), '?wh=9799');

    await waitForList();

    expect(screen.getByText(t.filters.chipWarehouse(t.values.unknown))).toBeInTheDocument();
    expectNoInternalIds();
  });
});

/** 아래 구획(고른 전표) 안에서만 본다 — 위 목록 표에도 같은 글자가 있다. */
const linesPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.lines });

const qtyInput = (ordinal: number): HTMLElement =>
  screen.getByRole('textbox', { name: t.lineTable.disposalQtyLabel(ordinal) });

const lineCheckbox = (ordinal: number): HTMLElement =>
  screen.getByRole('checkbox', { name: t.lineTable.selectLabel(ordinal) });

/** 고른 전표의 라인이 실제로 그려질 때까지 기다린다. */
const waitForLines = async (): Promise<void> => {
  await screen.findByRole('checkbox', { name: t.lineTable.selectLabel(1) });
};

describe('DisposalIssueScreen — 고른 전표의 상세 조회', () => {
  /**
   * **고르기 전에는 부르지 않고, 고르면 각각 한 번씩 부른다**(감지기 M17·M20·M21).
   *
   * **경로 전체를 세어** 판정한다 — 「고르지 않았는데 부른다」가 `…/0`처럼 대체값을 단 경로로
   * 나가면 경로마다 세는 단언은 그것을 하나도 보지 못한다.
   */
  it('고르기 전에는 0회, 고른 뒤에 1회씩 부른다', async () => {
    const { requests, queryClient, user } = renderScreen(allRoutes());

    await waitForList();

    for (const path of SELECTION_PATHS) {
      expect(requestsTo(requests, path)).toHaveLength(0);
    }

    await selectReceipt(user, 'GR-2026-900001');
    await waitForLines();

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(1);
    expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(1);
    expectNoUnknownPath(requests);
    expectNoFailedQuery(queryClient);
  });

  /**
   * **라인 전용 경로를 부르지 않는다** — 상세가 헤더와 라인을 함께 준다.
   * 짝 방향으로 그 응답에만 있는 수량이 화면에 없음을 함께 잰다.
   */
  it('라인 전용 경로를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(0);
    expect(document.body.textContent ?? '').not.toContain(String(LINES_ONLY_QTY));
  });

  /** 주소로 곧바로 들어와도 같다 — `gr`는 경로 조각이라 목록과 무관하게 상세를 부른다. */
  it('주소에 실린 전표로 곧바로 상세를 부른다', async () => {
    const { requests } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
  });

  /**
   * **잔액은 품목마다 한 번**이다(감지기 M21). 라인이 셋이고 그중 둘이 같은 품목이므로
   * 라인마다 부르면 셋이 된다 — 그 어긋남을 이 픽스처가 드러낸다.
   */
  it('잔액을 품목마다 한 번만 부르고 조건 넷을 싣는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(2);
    });

    const itemIds = requestsTo(requests, BALANCES_PATH)
      .map((request) => request.url.searchParams.get('itemId'))
      .sort();

    expect(itemIds).toEqual(['9301', '9302']);

    for (const request of requestsTo(requests, BALANCES_PATH)) {
      expect(request.url.searchParams.get('groupBy')).toBe('LOT');
      expect(request.url.searchParams.get('includeZero')).toBe('true');
      expect(request.url.searchParams.get('warehouseId')).toBe('9701');
    }
  });

  /**
   * **잔액·위치의 창고는 「고른 전표의 창고」다** — 조건 줄의 창고가 아니다.
   *
   * 조건에 다른 창고(9702)를 걸어 두고 그 창고가 **아닌** 전표(9001 → 창고 9701)를 고른다.
   * 조건 줄의 값을 쓰면 **남의 창고 잔액이 상한이 되고**, 값 목록이 확정돼 선택지가 좁혀지는
   * 순간 그 어긋남이 조용히 커진다(PR ①의 창고 좁힘과 맞물리는 자리다).
   */
  it('잔액과 위치는 조건 줄의 창고가 아니라 고른 전표의 창고로 부른다', async () => {
    const { requests } = renderScreen(allRoutes(), '?wh=9702&gr=9001');

    await waitForLines();

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH).length).toBeGreaterThan(0);
    });

    for (const request of requestsTo(requests, BALANCES_PATH)) {
      expect(request.url.searchParams.get('warehouseId')).toBe('9701');
    }

    expect(requestsTo(requests, LOCATIONS_PATH)[0]?.url.searchParams.get('warehouseId')).toBe(
      '9701',
    );
    /* 짝 방향 — 목록 조회에는 조건 줄의 창고가 그대로 실려 있다. */
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.get('warehouseId')).toBe('9702');
  });

  /**
   * **「다시 조회」가 상세와 잔액도 함께 부른다**(감지기 M18 · W-01-07 Major의 형태).
   * 목록만 다시 부르면 아래 구획이 낡은 채로 남아 **이미 없어진 자재를 폐기하려 한다.**
   */
  it('다시 조회가 목록·상세·잔액을 함께 부른다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([changingListRoute(), changingDetailRoute()]),
      '?gr=9001',
    );

    await waitForLines();

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(2);
    });

    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
      expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(2);
      expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(4);
    });

    /* 참조는 그대로다 — 기준정보는 이 조작으로 달라지지 않는다. */
    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);
  });
});

describe('DisposalIssueScreen — 상세가 없는 전표', () => {
  /**
   * **404면 「찾을 수 없습니다」이고 `gr`를 주소에서 정리한다**(수명 표 5행 · 감지기 M19).
   * 남기면 빈 구획이 서고, 사용자는 자기가 무엇을 눌렀는지 되짚을 수 없다.
   */
  it('404면 안내가 서고 고른 전표가 주소에서 정리된다', async () => {
    renderScreen(allRoutes([failingDetailRoute(404)]), '?q=GR&gr=9001');

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });

    /* 조건은 하나도 바꾸지 않는다 — 없어진 전표 하나 때문에 좁혀 둔 조건까지 되돌리지 않는다. */
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /**
   * **정리가 뒤로가기 기록을 늘리지 않는다**(전례 감지기 이식 — 리뷰 t2 Major ①).
   *
   * 늘리면 뒤로 눌렀을 때 **없는 전표를 가리키는 주소로 되돌아가** 같은 정리가 되풀이되고,
   * 사용자는 **앞 화면으로 빠져나갈 수 없다.** 주소를 바깥에서 갈아 끼워(뒤로가기·주소 직접
   * 편집과 같은 경로) 히스토리가 실제로 몇 칸 쌓였는지를 잰다.
   */
  it('404 정리가 뒤로가기 기록을 늘리지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404, MISSING_DETAIL_PATH)]),
      '?q=GR',
      'gr=9002',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    /* 한 칸 뒤로 가면 **없는 전표 주소가 아니라** 그 앞의 조회 상태로 돌아간다. */
    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });
  });

  /**
   * **새 조회·초기화가 안내를 거둔다**(리뷰 t2 Minor ③).
   *
   * 안내를 끄는 자리가 클릭 핸들러 하나뿐이면, 404로 안내가 선 뒤 조건을 바꿔 조회하거나
   * 초기화를 눌러도 그 문장이 화면에 남는다 — **방금 한 조작과 무관한 사정을 화면이 계속
   * 말한다.** 지적 ①과 같은 뿌리(핸들러에만 두면 다른 경로가 샌다)다.
   */
  it('새 조회와 초기화가 없음 안내를 거둔다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404, MISSING_DETAIL_PATH)]),
      '?gr=9002',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('초기화도 없음 안내를 거둔다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404, MISSING_DETAIL_PATH)]),
      '?q=GR&gr=9002',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  /**
   * **안내는 자기 사정보다 오래 살지 않는다 — 주소로 오간 경우에도**(전례 이식분의 짝 감지기).
   *
   * 안내를 거두는 자리가 클릭 핸들러뿐이면 **뒤로가기·앞으로가기·주소 직접 편집**으로 `gr`가
   * 다시 생기는 경로가 통째로 샌다. 화면이 안내를 그리는 조건은 「고른 전표가 없다」이므로
   * 전표를 고른 동안에는 어긋남이 **가려져 있다가**, 그 전표를 놓는 순간 **아무것도 404가
   * 아닌데 「찾을 수 없습니다」가 되살아난다.** 그래서 셋을 이어서 잰다:
   * 404 → 주소로 **성한 전표** 고르기 → 뒤로 눌러 **선택 놓기**.
   */
  it('주소로 성한 전표를 고른 뒤 놓아도 없음 안내가 되살아나지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404, MISSING_DETAIL_PATH)]),
      '?gr=9002',
      'gr=9001',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    /* 클릭 핸들러를 거치지 않는 길로 성한 전표를 고른다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitForLines();

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();

    /* 다시 핸들러를 거치지 않고 선택을 놓는다 — 안내를 그리는 조건이 되살아나는 자리다. */
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /** 다시 고르면 안내가 사라진다 — 「없다」가 화면에 눌어붙지 않는다. */
  it('다시 고르면 없음 안내가 사라진다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404, MISSING_DETAIL_PATH)]),
      '?gr=9002',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await selectReceipt(user, 'GR-2026-900001');
    await waitForLines();

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  /**
   * **404가 아닌 실패를 「없다」로 말하지 않는다.** 500은 다시 시도로 풀릴 수 있고 사용자가
   * 할 조치가 다르다 — 고른 전표를 주소에서 지우면 그 조치를 할 대상이 사라진다.
   */
  it('500이면 선택을 정리하지 않는다', async () => {
    renderScreen(allRoutes([failingDetailRoute(500)]), '?gr=9001');

    await waitForList();

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?gr=9001`);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  /**
   * **물류 상세에 403 갈래를 만들지 않는다**(완료 조건 C20). 계약의 응답은 200과 404 둘뿐이라
   * 만들면 닿을 수 없는 가지가 된다 — 403이 와도 「없다」로 말하지 않는다.
   */
  it('403에도 없음 안내를 내지 않는다', async () => {
    renderScreen(allRoutes([failingDetailRoute(403)]), '?gr=9001');

    await waitForList();

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?gr=9001`);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 라인 표와 폐기 수량', () => {
  /**
   * **스펙 5열의 나머지 셋이 이 구획에 있다**(승인 기록 정정 2) — 품목·자재 LOT·보유 수량.
   * 위 표가 내는 입고번호·입고일과 함께 다섯이 한 화면에서 읽힌다.
   */
  it('제목줄과 라인 표가 서고 참조를 이름으로 푼다', async () => {
    renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    const pane = linesPane();

    expect(within(pane).getByText('GR-2026-900001')).toBeInTheDocument();
    expect(within(pane).getAllByText(ITEM_LABEL).length).toBeGreaterThan(0);
    expect(within(pane).getByText('SAMPLE-LOT-0001')).toBeInTheDocument();
    expect(within(pane).getAllByText(LOCATION_LABEL).length).toBeGreaterThan(0);
    expect(within(pane).getByText(t.lineTable.receiptQtyPair(100, UOM_LABEL))).toBeInTheDocument();
  });

  /**
   * **좁힘이 살아나도 제목줄은 이름으로 말한다**(`omf-mes#47` 방지 · PR ① 창고 좁힘과 맞물림).
   *
   * 값 목록이 확정돼 선택지가 폐기 대상 유형으로 좁혀진 상태에서, **좁힘 밖 창고**(9702)의
   * 전표를 상세가 내려 준다. 제목줄이 **좁힌 목록으로** 이름을 풀면 정상 창고가
   * 「알 수 없음」으로 찍히는데, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
   */
  it('좁힘 밖 창고의 전표를 골라도 제목줄이 이름으로 말한다', async () => {
    fillDefectWarehouseTypes();

    const { user } = renderScreen(
      allRoutes([
        {
          match: (request) => isGet(request, DETAIL_PATH),
          respond: () =>
            jsonResponse({
              goodsReceipt: { ...goodsReceiptResponseFixtures[0], warehouseId: 9702 },
              lines: receiptLineResponseFixtures,
            }),
        },
      ]),
      '?gr=9001',
    );

    await waitForLines();

    const pane = linesPane();

    expect(within(pane).getByText(OTHER_WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(within(pane).queryByText(t.values.unknown)).not.toBeInTheDocument();

    /* 짝 방향 — 좁힘은 살아 있다. 좁혀지는 자리는 **선택지 하나**이지 이름 풀이가 아니다. */
    const options = await openOptions(user, t.fields.warehouse);

    expect(
      within(options)
        .getAllByRole('option')
        .map((option) => option.getAttribute('aria-label') ?? option.textContent),
    ).not.toContain(OTHER_WAREHOUSE_LABEL);
  });

  /** **짝 단언** — 이름이 보이는 것을 먼저 재고 내부 번호가 없음을 잰다(`omf-mes#44`). */
  it('아래 구획 어디에도 내부 번호가 없다', async () => {
    renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    const pane = linesPane();

    expect(within(pane).getByText('GR-2026-900001')).toBeInTheDocument();

    for (const id of INTERNAL_IDS) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  });

  /** **빈 칸으로 시작한다**(완료 조건 C26 · 감지기 M26) — 전량 폐기가 기본값처럼 보이면 안 된다. */
  it('폐기 수량 칸이 빈 칸으로 시작한다', async () => {
    renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    for (const ordinal of [1, 2, 3]) {
      expect(qtyInput(ordinal)).toHaveValue('');
    }
  });

  /** **가용 45가 아니라 보유 80**을 상한으로 쓴다(완료 조건 C23 · 감지기 M22). */
  it('보유 수량을 상한으로 쓰고 가용 수량을 쓰지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    await screen.findByText(t.lineTable.onHandQtyPair(80, UOM_LABEL));

    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '41');

    /* 가용(45)을 상한으로 썼다면 41은 통과하고 46은 막힌다 — 둘 다 통과해야 옳다. */
    expect(screen.queryByText(t.errors.qtyOverOnHand(45))).not.toBeInTheDocument();
    expect(screen.queryByText(t.errors.qtyOverOnHand(80))).not.toBeInTheDocument();
    expect(screen.getByText(t.selection.summary(1, 41, UOM_LABEL))).toBeInTheDocument();

    await user.clear(qtyInput(1));
    await user.type(qtyInput(1), '81');

    expect(await screen.findByText(t.errors.qtyOverOnHand(80))).toBeInTheDocument();
  });

  /** 줄 선택과 수량이 **짝**이다(완료 조건 C27) — 고른 줄에 수량이 없으면 다음 단계가 막힌다. */
  it('고른 줄의 수량이 비면 그 사유가 선다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));

    expect(screen.getByText(t.reasons.selectQtyMissing)).toBeInTheDocument();

    await user.type(qtyInput(1), '5');

    await waitFor(() => {
      expect(screen.queryByText(t.reasons.selectQtyMissing)).not.toBeInTheDocument();
    });

    expect(screen.getByText(t.selection.summary(1, 5, UOM_LABEL))).toBeInTheDocument();
  });

  /** **고르지 않은 줄의 수량은 합계에 들어가지 않는다**(감지기 M28). */
  it('고르지 않은 줄에 친 수량은 요약에 들어가지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');
    await user.type(qtyInput(2), '7');

    expect(screen.getByText(t.selection.summary(1, 5, UOM_LABEL))).toBeInTheDocument();
    expect(screen.queryByText(t.selection.summary(2, 12, UOM_LABEL))).not.toBeInTheDocument();
  });

  /** **단위가 섞이면 합치지 않는다**(완료 조건 C28 · 감지기 M29) — 줄 수는 그대로 낸다. */
  it('단위가 다른 줄을 함께 고르면 합계를 내지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');
    await user.click(lineCheckbox(3));
    await user.type(qtyInput(3), '2');

    expect(screen.getByText(t.selection.summaryMixedUom(2))).toBeInTheDocument();
    expect(screen.queryByText(t.selection.summary(2, 7, UOM_LABEL))).not.toBeInTheDocument();
  });

  /** 보류 표식은 **막지 않고 알린다** — 보류·차단된 자재를 덜어 내는 것이 이 화면의 주 용도다. */
  it('보류인 LOT도 고를 수 있다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    expect(await screen.findByText(t.values.lotHeld)).toBeInTheDocument();

    await user.click(lineCheckbox(2));
    await user.type(qtyInput(2), '3');

    /* 보유가 0으로 **확인된** 줄이라 상한이 걸린다 — 표식이 아니라 수량이 막는다. */
    expect(screen.getByText(t.errors.qtyOverOnHand(0))).toBeInTheDocument();
  });

  /**
   * **상한을 확인하지 못한 줄은 막지 않는다**(완료 조건 C24 · 감지기 M23).
   * 잔액이 실패해도 선택·입력이 살아 있고 「막지 않는다」 안내가 선다.
   */
  it('잔액 조회가 실패해도 선택과 입력이 막히지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([
        {
          match: (request) => isGet(request, BALANCES_PATH),
          respond: () => jsonResponse({ message: '' }, { status: 500 }),
        },
      ]),
      '?gr=9001',
    );

    await waitForLines();

    expect(await screen.findByText(t.reasons.balancesFailed)).toBeInTheDocument();
    expect(screen.getByText(t.reasons.onHandUnknownNote)).toBeInTheDocument();
    expect(screen.getAllByText(t.values.onHandUnknown).length).toBeGreaterThan(0);

    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '99999');

    expect(screen.getByText(t.selection.summary(1, 99999, UOM_LABEL))).toBeInTheDocument();
    expect(screen.queryByText(t.reasons.selectQtyInvalid)).not.toBeInTheDocument();
  });

  /** 잔액 실패의 복구는 **잔액만** 다시 부른다 — 문구가 적은 대상과 부르는 대상이 같아야 한다. */
  it('잔액 「다시 시도」가 잔액만 다시 부른다', async () => {
    let failing = true;

    const { requests, user } = renderScreen(
      allRoutes([
        {
          match: (request) => isGet(request, BALANCES_PATH),
          respond: (request) => {
            if (failing) return jsonResponse({ message: '' }, { status: 500 });

            const itemId = Number(new URL(request.url).searchParams.get('itemId'));

            return jsonResponse(listBody(balanceResponseFixturesByItem[itemId] ?? []));
          },
        },
      ]),
      '?gr=9001',
    );

    await waitForLines();
    await screen.findByText(t.reasons.balancesFailed);

    failing = false;
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(screen.queryByText(t.reasons.balancesFailed)).not.toBeInTheDocument();
    });

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  /** 라인이 0건인 전표도 있다 — 표의 빈 상태가 맡는다(바깥에서 0건을 가르지 않는다). */
  it('라인이 0건이면 표의 빈 상태가 맡는다', async () => {
    renderScreen(allRoutes([detailRoute([])]), '?gr=9001');

    expect(await screen.findByText(t.empty.noLinesTitle)).toBeInTheDocument();
    expect(within(linesPane()).getByRole('table')).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 줄 초안의 수명', () => {
  /**
   * **전표를 바꾸면 줄·수량 초안이 비고, 응답 도착으로는 비지 않는다**(감지기 M30 · 두 방향).
   *
   * 응답 배열을 정리 effect의 의존성에 넣으면 갱신이 도착할 때마다 **치던 값이 사라진다**
   * (`omf-mes#43`). 다시 부르기가 **내용이 달라지는** 응답을 주어야 그 결함이 드러난다 —
   * 같은 본문이면 캐시가 구조 공유로 같은 참조를 유지해 effect가 깨어나지 않는다.
   */
  it('다시 조회로 상세가 새로 도착해도 고른 줄과 친 수량이 남는다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([changingListRoute(), changingDetailRoute()]),
      '?gr=9001',
    );

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');

    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(2);
    });

    expect(lineCheckbox(1)).toBeChecked();
    expect(qtyInput(1)).toHaveValue('5');
  });

  /** 짝 방향 — **전표가 바뀌면 비운다.** 앞 전표의 수량이 남으면 남의 전표의 수량이 실린다. */
  it('전표를 바꾸면 고른 줄과 친 수량이 비워진다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');

    /* 같은 전표를 풀었다 다시 고르는 것도 「대상이 바뀐 것」이다. */
    await user.click(screen.getByRole('button', { name: t.actions.deselectRow('GR-2026-900001') }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    await selectReceipt(user, 'GR-2026-900001');
    await waitForLines();

    expect(lineCheckbox(1)).not.toBeChecked();
    expect(qtyInput(1)).toHaveValue('');
  });

  /** 조건을 바꾸면 `gr`가 풀리므로 초안도 함께 사라진다(수명 표 1행). */
  it('조건을 바꾸면 줄 초안도 사라진다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');

    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 이 회차에도 쓰기가 없다', () => {
  /**
   * **기록된 모든 요청의 method가 `GET`이다**(완료 조건 C30). 줄을 고르고 수량을 치고
   * 다시 조회까지 해도 쓰기가 하나도 나가지 않는다.
   */
  it('줄을 고르고 수량을 쳐도 어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingDetailRoute()]), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');
    await user.click(lineCheckbox(3));
    await user.type(qtyInput(3), '2');
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(2);
    });

    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    expectNoUnknownPath(requests);
  });
});

/* ─────────────────────────  「처리 이력」 탭  ───────────────────────── */

const HISTORY_SEARCH = '?tab=history';

const historyListPane = (): HTMLElement =>
  screen.getByRole('region', { name: t.panes.historyList });

const historyDetailPane = (): HTMLElement =>
  screen.getByRole('region', { name: t.panes.historyDetail });

const historyTable = (): HTMLElement => {
  const table = within(historyListPane()).getAllByRole('table')[0];

  if (table === undefined) throw new Error('처리 이력 목록 표가 없다');

  return table;
};

const waitForIssueList = async (): Promise<void> => {
  await waitFor(() => {
    expect(within(historyTable()).getByText('GI-2026-950001')).toBeInTheDocument();
  });
};

const selectIssue = async (
  user: ReturnType<typeof userEvent.setup>,
  goodsIssueNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectIssueRow(goodsIssueNo) }));
};

const openTab = async (user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> => {
  await user.click(screen.getByRole('tab', { name: label }));
};

/** 고른 품의의 라인이 실제로 그려질 때까지 기다린다. */
const waitForIssueLines = async (): Promise<void> => {
  await within(historyDetailPane()).findByText('SAMPLE-LOT-0001');
};

describe('DisposalIssueScreen — 탭 둘', () => {
  it('탭이 둘이고 이름이 스펙 문면 그대로다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: t.tabs.disposal })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: t.tabs.history })).toBeInTheDocument();
  });

  /**
   * **결재는 이 화면이 하지 않는다**(승인 기록 정정 1-2). 밝히지 않으면 사용자가 여기서
   * 결재할 수 있다고 믿고 있지도 않은 승인 버튼을 찾아 헤맨다.
   */
  it('탭 줄에 결재를 어디서 하는지 적는다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByText(t.tabs.note)).toBeInTheDocument();
  });

  /** 감지기 M32 — 탭을 컴포넌트 상태로만 들고 있으면 이 단언이 무너진다. */
  it('탭 전환이 주소에 실리고 그 주소로 다시 들어가면 같은 탭이 열린다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();
    await openTab(user, t.tabs.history);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}${HISTORY_SEARCH}`);
    });

    await waitForIssueList();

    renderScreen(allRoutes(), HISTORY_SEARCH);

    expect(screen.getAllByRole('tab', { selected: true })[0]).toHaveAccessibleName(t.tabs.history);
  });

  /** 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('기본 탭은 주소에 적히지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), HISTORY_SEARCH);

    await waitForIssueList();
    await openTab(user, t.tabs.disposal);

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /**
   * 감지기 M37 — **활성 탭의 `content`에만 내용을 담는다.** 디자인 시스템 `Tabs`는 패널을 전부
   * 렌더하고 비활성만 `hidden`으로 감춘다(구현 실측). **두 방향으로 잰다.**
   *
   * **역할(role)로 재지 않고 DOM을 직접 센다.** `getByRole`은 `hidden`이 붙은 가지를 접근성
   * 트리에서 빼므로, 두 패널에 내용을 다 담아도 역할 질의로는 **잡히지 않는다**(뮤테이션
   * 실측 — 이 감지기가 처음 형태로는 죽지 않았다). 그런데 숨은 패널은 **DOM에 그대로 있고**
   * 그 안의 표·조회·입력칸이 함께 살아 있다 — 그 사실을 재려면 문서를 세는 수밖에 없다.
   */
  it('비활성 탭의 내용이 DOM에 없다', async () => {
    const paneCount = (label: string): number =>
      document.querySelectorAll(`section[aria-label="${label}"]`).length;

    const { user } = renderScreen(allRoutes());

    await waitForList();

    expect(paneCount(t.panes.list)).toBe(1);
    expect(paneCount(t.panes.historyList)).toBe(0);
    expect(paneCount(t.panes.historyDetail)).toBe(0);

    await openTab(user, t.tabs.history);
    await waitForIssueList();

    expect(paneCount(t.panes.historyList)).toBe(1);
    expect(paneCount(t.panes.list)).toBe(0);
    expect(paneCount(t.panes.lines)).toBe(0);
  });

  /**
   * 같은 규칙의 다른 관측 경로 — **숨은 탭의 표가 문서에 남지 않는다.**
   *
   * 구획을 세는 것만으로는 「구획은 없는데 표만 남는」 형태를 놓친다. 표가 남으면 그 표의
   * 행·버튼이 문서에 살아 있어 자동화·보조기술이 닿고, 같은 이름의 컨트롤이 둘이 된다.
   */
  it('비활성 탭의 표가 문서에 남지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    /* 발의 탭: 대상 목록 표 + 라인 표 둘뿐이다. */
    expect(document.querySelectorAll('table')).toHaveLength(2);

    await openTab(user, t.tabs.history);
    await waitForIssueList();

    /* 이력 탭: 이력 목록 표 하나뿐이다(품의를 고르지 않아 라인 표가 없다). */
    expect(document.querySelectorAll('table')).toHaveLength(1);
  });

  /**
   * 감지기 M38 — **보이지 않는 탭의 조회는 나가지 않는다.** 두 탭의 조건과 선택이 한 주소에
   * 함께 살아 있어 값만으로는 조회가 성립하므로, 탭을 조회의 조건으로 넘기지 않으면 숨은 탭의
   * 목록이 배경에서 왕복한다. **경로 전체를 세어** 판정한다.
   */
  it('발의 탭에 있는 동안 출고 목록을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    expect(requestsTo(requests, ISSUES_PATH)).toHaveLength(0);
    expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(0);
    expect(requestsTo(requests, APPROVAL_DETAIL_PATH)).toHaveLength(0);
    expectNoUnknownPath(requests);
  });

  it('이력 탭에 있는 동안 입고 목록·상세·잔액을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&gr=9001&gi=9501`);

    await waitForIssueLines();

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
    expectNoUnknownPath(requests);
  });

  /** 「다시 조회」도 그 탭의 것만 부른다 — 버튼 하나로 규칙이 깨지면 안 된다. */
  it('이력 탭의 다시 조회가 입고 목록을 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes(), HISTORY_SEARCH);

    await waitForIssueList();
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH).length).toBeGreaterThan(1);
    });

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
  });

  /**
   * 감지기 M39 — **탭 전환은 아무것도 비우지 않는다**(수명 표 8행). 탭은 보는 자리를 바꿀 뿐
   * 대상을 바꾸지 않는다 — 두 대상이 각자 살아 있어야 「발의해 놓고 이력에서 이어서 다룬다」가
   * 성립한다.
   */
  it('탭을 오갔다 돌아와도 두 선택과 줄 초안이 그대로다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001&gi=9501');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '5');

    await openTab(user, t.tabs.history);
    await waitForIssueLines();

    /* 이력 탭에서도 고른 품의가 그대로 열린다. */
    expect(within(historyDetailPane()).getByText('GI-2026-950001')).toBeInTheDocument();

    await openTab(user, t.tabs.disposal);
    await waitForLines();

    expect(lineCheckbox(1)).toBeChecked();
    expect(qtyInput(1)).toHaveValue('5');
    expect(currentLocation()).toBe(`${ROUTE}?gr=9001&gi=9501`);
  });

  it('탭 전환이 이력 조건과 대상 조건을 함께 나른다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=GR&iq=GI');

    await waitForList();
    await openTab(user, t.tabs.history);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&q=GR&iq=GI`);
    });
  });
});

describe('DisposalIssueScreen — 이력 조건', () => {
  /** 감지기 M33 — 조건을 컴포넌트 상태로만 들고 있으면 이 단언이 무너진다. */
  it('이력 조건이 주소에 실리고 요청에 계약 이름으로 나간다', async () => {
    const { requests, user } = renderScreen(allRoutes(), HISTORY_SEARCH);

    await waitForIssueList();
    await user.type(screen.getByLabelText(t.historyFields.q), 'GI-2026');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&iq=GI-2026`);
    });

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH)).toHaveLength(2);
    });

    expect(requestsTo(requests, ISSUES_PATH)[1]?.url.searchParams.get('q')).toBe('GI-2026');
  });

  it('첫 진입에는 조건이 하나도 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), HISTORY_SEARCH);

    await waitForIssueList();

    const issueRequests = requestsTo(requests, ISSUES_PATH);

    expect(issueRequests).toHaveLength(1);
    expect([...(issueRequests[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  /**
   * 감지기 M34 — **이력 조건이 바뀌면 고른 품의가 함께 풀린다**(수명 표 9행). 조건이 좁아지면
   * 그 품의가 새 결과에 없을 수 있다.
   */
  it('이력 조건을 바꾸면 고른 품의가 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();
    await user.type(screen.getByLabelText(t.historyFields.q), 'GI');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&iq=GI`);
    });

    expect(
      within(historyDetailPane()).getByText(t.empty.historyNoSelectionTitle),
    ).toBeInTheDocument();
  });

  it('초기화도 고른 품의를 푼다', async () => {
    const { user } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&iq=GI&gi=9501`);

    await waitForIssueLines();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history`);
    });
  });

  /**
   * **범위 있는 규칙은 잣대도 같은 범위로.** 이력 조건을 바꾸는 것은 대상 탭의 선택과 조건을
   * 건드리는 일이 아니다 — 함께 지우면 이력을 한 번 훑었다고 발의하던 것이 사라진다.
   */
  it('이력 조건 변경이 대상 조건과 고른 전표를 건드리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&q=GR&gr=9001`);

    await waitForIssueList();
    await user.type(screen.getByLabelText(t.historyFields.q), 'GI');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&q=GR&iq=GI&gr=9001`);
    });
  });

  it('이력 쪽 이동이 그 탭의 쪽만 옮기고 품의 선택을 푼다', async () => {
    const { user } = renderScreen(
      allRoutes([issueListRoute(goodsIssueResponseFixtures, { total: 120 })]),
      `${HISTORY_SEARCH}&page=3&gi=9501`,
    );

    await waitForIssueLines();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&page=3&ipage=2`);
    });
  });
});

describe('DisposalIssueScreen — 대상 조건의 범위', () => {
  /*
   * **수명 표 1~3행의 거울 방향**(리뷰 t3 Major ①).
   *
   * 이력 쪽 범위는 「이력 조건 변경이 대상 조건과 고른 전표를 건드리지 않는다」가 이미 재고
   * 있었으나, **대상 쪽 범위를 재는 잣대가 없었다.** 한쪽만 있으면 「범위 있는 규칙은 잣대도
   * 같은 범위로」가 절반만 지켜지고, `toScreenParams`는 인자 일곱을 받는 한 문이라 **인자 하나를
   * 손으로 더하는 것만으로** 「대상 조건을 바꿨더니 이력 조건까지 사라졌다」가 만들어진다.
   *
   * 세 조작을 **각각** 잰다 — 조건 변경·초기화·쪽 이동이 수명 표에서 서로 다른 행이고,
   * 실제로도 `applyQuery`를 부르는 자리가 셋이라 한 자리만 고쳐지는 일이 생긴다.
   */
  it('대상 조건 변경이 이력 조건과 고른 품의를 건드리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?iq=GI&gr=9001&gi=9501');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR&iq=GI&gi=9501`);
    });
  });

  it('대상 초기화가 이력 조건과 고른 품의를 건드리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=GR&iq=GI&gr=9001&gi=9501');

    await waitForList();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?iq=GI&gi=9501`);
    });
  });

  it('대상 쪽 이동이 이력 조건과 고른 품의를 건드리지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(goodsReceiptResponseFixtures, { total: 120 })]),
      '?iq=GI&gr=9001&gi=9501',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2&iq=GI&gi=9501`);
    });
  });
});

describe('DisposalIssueScreen — 고른 품의의 상세 조회', () => {
  /** 감지기 M35 — 고르기 전에 부르면 이 단언이 무너진다. **경로 전체를 세어** 판정한다. */
  it('고르기 전에는 부르지 않고 고르면 한 번 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes(), HISTORY_SEARCH);

    await waitForIssueList();

    expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(0);
    expect(requestsTo(requests, APPROVAL_DETAIL_PATH)).toHaveLength(0);

    await selectIssue(user, 'GI-2026-950001');
    await waitForIssueLines();

    expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(1);
    expectNoUnknownPath(requests);
  });

  it('고른 품의의 값과 라인이 그려진다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    const pane = historyDetailPane();

    expect(within(pane).getByText('GI-2026-950001')).toBeInTheDocument();
    expect(within(pane).getByText('2026-08-08 14:20')).toBeInTheDocument();
    expect(within(pane).getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(within(pane).getByText(ITEM_LABEL)).toBeInTheDocument();
    expect(within(pane).getByText(t.values.posted)).toBeInTheDocument();
    expect(within(pane).getByText(t.values.notPosted)).toBeInTheDocument();
  });

  /** 감지기 M36 — 없는 품의를 가리키는 주소는 정리한다(수명 표 11행). */
  it('출고 상세가 404면 안내가 서고 gi를 주소에서 정리한다', async () => {
    renderScreen(
      allRoutes([failingIssueDetailRoute(404, MISSING_ISSUE_DETAIL_PATH)]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    expect(await screen.findByText(t.empty.issueNotFoundTitle)).toBeVisible();

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history`);
    });

    expect(
      within(historyDetailPane()).queryByRole('button', { name: messages.common.retry }),
    ).not.toBeInTheDocument();
  });

  it('404 정리가 대상 탭의 조건과 선택을 건드리지 않는다', async () => {
    renderScreen(
      allRoutes([failingIssueDetailRoute(404, MISSING_ISSUE_DETAIL_PATH)]),
      `${HISTORY_SEARCH}&q=GR&gr=9001&gi=9502`,
    );

    await screen.findByText(t.empty.issueNotFoundTitle);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=history&q=GR&gr=9001`);
    });
  });

  it('상세가 500으로 실패하면 사유와 다시 시도가 서고 로딩 뼈대가 남지 않는다', async () => {
    renderScreen(allRoutes([failingIssueDetailRoute(500)]), `${HISTORY_SEARCH}&gi=9501`);

    const pane = historyDetailPane();

    expect(await within(pane).findByText(messages.httpError.loadTitle)).toBeVisible();
    expect(within(pane).getByRole('button', { name: messages.common.retry })).toBeEnabled();
    expect(
      within(pane).queryByRole('status', { name: t.loading.issueDetail }),
    ).not.toBeInTheDocument();
    expect(within(pane).queryByText('GI-2026-950001')).not.toBeInTheDocument();
  });

  it('상세 요청이 끊기면 오프라인 사유가 서고 로딩 뼈대가 남지 않는다', async () => {
    renderScreen(allRoutes([disconnectedIssueDetailRoute()]), `${HISTORY_SEARCH}&gi=9501`);

    const pane = historyDetailPane();

    expect(await within(pane).findByText(messages.httpError.offline)).toBeVisible();
    expect(
      within(pane).queryByRole('status', { name: t.loading.issueDetail }),
    ).not.toBeInTheDocument();
  });

  it('상세 실패의 다시 시도가 같은 품의를 다시 조회한다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([failingIssueDetailRoute(500)]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    const pane = historyDetailPane();

    await within(pane).findByText(messages.httpError.loadTitle);
    expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(1);

    await user.click(within(pane).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(2);
    });
  });

  /** 감지기 M41 — 목록만 다시 부르면 갱신된 값과 낡은 값이 한 화면에 섞인다. */
  it('다시 조회가 이력 목록·상세·승인 요청을 함께 부른다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([changingApprovalRoute()]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    await waitForIssueLines();

    expect(requestsTo(requests, ISSUES_PATH)).toHaveLength(1);
    expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(1);
    expect(requestsTo(requests, APPROVAL_DETAIL_PATH)).toHaveLength(1);

    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH)).toHaveLength(2);
    });
    await waitFor(() => {
      expect(requestsTo(requests, ISSUE_DETAIL_PATH)).toHaveLength(2);
    });
    await waitFor(() => {
      expect(requestsTo(requests, APPROVAL_DETAIL_PATH)).toHaveLength(2);
    });
  });

  it('이력 목록 조회 실패는 배너와 다시 시도를 낸다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([failingIssueListRoute(500)]),
      HISTORY_SEARCH,
    );

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    /* 실패를 빈 상태로 오인시키지 않는다 — 짝으로 단언한다. */
    expect(screen.queryByText(t.empty.historyNoResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH).length).toBeGreaterThan(1);
    });
  });
});

describe('DisposalIssueScreen — 이력 라인 표의 참조 실패', () => {
  /*
   * **넷 중 어느 하나가 실패해도 사유와 「다시 시도」가 선다**(리뷰 t3 Minor ②).
   *
   * 안내 문구가 품목·단위·자재 LOT·위치 **넷을 함께** 적고 「다시 시도」가 **넷을 함께** 부르므로,
   * 판정도 같은 범위여야 문구와 조치가 어긋나지 않는다. 접기를 하나로 좁히면 나머지 셋이
   * 실패했을 때 **복구 경로가 통째로 사라진다** — 품목만 보고 판정하는 형태가 그 결함이다.
   *
   * **품목이 아닌 축 둘로 잰다.** 품목으로만 재면 「`items.isError` 하나만 본다」는 결함이
   * 그대로 통과한다.
   */
  it('자재 LOT만 실패해도 사유와 다시 시도가 선다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([failingReferenceRoute(LOTS_PATH)]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    const pane = historyDetailPane();

    expect(await within(pane).findByText(t.reasons.lineReferencesFailed)).toBeVisible();

    await user.click(within(pane).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LOTS_PATH).length).toBeGreaterThan(1);
    });
  });

  it('위치만 실패해도 사유가 선다', async () => {
    renderScreen(allRoutes([failingReferenceRoute(LOCATIONS_PATH)]), `${HISTORY_SEARCH}&gi=9501`);

    expect(
      await within(historyDetailPane()).findByText(t.reasons.lineReferencesFailed),
    ).toBeVisible();
  });

  /** 짝 방향 — 다섯이 다 성공하면 사유도 「다시 시도」도 서지 않는다. */
  it('참조가 다 성공하면 사유가 서지 않는다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    expect(
      within(historyDetailPane()).queryByText(t.reasons.lineReferencesFailed),
    ).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 결재 진행', () => {
  /**
   * 감지기 M43·M44 — **값이 있을 때만 부르고, 그 값을 그대로 경로에 옮긴다**(계획 결정 10).
   * `enabled`를 없애면 `/app/approval-requests/0`이 나가고, 값을 가공하면 남의 요청을 연다.
   */
  it('승인 요청 값이 있으면 한 번 부르고 경로 조각이 응답 값과 같다', async () => {
    const { requests } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    const approvalRequests = requestsTo(requests, APPROVAL_DETAIL_PATH);

    expect(approvalRequests).toHaveLength(1);
    /* 응답이 실어 준 값과 **문자열로 같다** — 접두어도 변환도 없다. */
    expect(approvalRequests[0]?.url.pathname).toBe(
      `/app/approval-requests/${String(goodsIssueResponseFixtures[0]?.approvalRequestId)}`,
    );
    expectNoUnknownPath(requests);
  });

  /**
   * 감지기 M43의 반대 방향 — 값이 없으면 **부르지 않고** 그 사실을 말한다(A0).
   * `?? 0`으로 메우면 있지도 않은 요청을 여는 요청이 나간다.
   */
  it('미상신 품의에는 승인 조회가 나가지 않고 그 사실을 밝힌다', async () => {
    const { requests } = renderScreen(
      allRoutes([
        issueDetailRoute(
          goodsIssueLineResponseFixtures,
          goodsIssueResponseFixtures[1],
          MISSING_ISSUE_DETAIL_PATH,
        ),
      ]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    expect(await screen.findByText(t.progress.notSubmittedTitle)).toBeVisible();

    expect(
      requests.filter((request) => request.url.pathname.startsWith('/app/approval-requests')),
    ).toHaveLength(0);
    expectNoUnknownPath(requests);
  });

  /**
   * **이슈 §4가 지시한 목록 경로를 쓰지 않는다**(계획 §5.4-3 · 결정 10). 대상 유형 코드의 값
   * 목록이 확정되지 않아 조건을 실을 수 없고, 대상 번호만 실으면 유형이 다른 문서의 요청이 섞인다.
   */
  it('승인 요청 목록 경로로는 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    expect(requestsTo(requests, APPROVAL_LIST_PATH)).toHaveLength(0);
    /* 짝 방향 — 대신 상세 경로로는 실제로 불렀다. */
    expect(requestsTo(requests, APPROVAL_DETAIL_PATH)).toHaveLength(1);
  });

  it('결재 진행이 세로 단계로 그려지고 서버가 준 단계 번호가 선다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    const progress = await screen.findByRole('group', { name: t.progress.label });

    expect(within(progress).getByText(t.progress.position(4, 4))).toBeInTheDocument();
    expect(within(progress).getByText('합성 승인자 가')).toBeInTheDocument();
    /*
     * **노드에 서버가 준 단계 번호가 선다**(검증 t3 관찰 ①). 픽스처의 단계 번호가 비연속(1·4)이라
     * 배열 인덱스+1로 다시 매기는 결함이 여기서 값으로 갈린다 — 연속이면 가려진다.
     */
    expect(within(progress).getByText('4')).toBeInTheDocument();
    expect(within(progress).getByText('APPROVED')).toBeInTheDocument();
    expect(within(progress).getByText(t.progress.waitingCurrent)).toBeInTheDocument();
  });

  /**
   * 감지기 M47 — **위치는 서버가 준 두 수 그대로다.** 배열을 훑어 다시 세면 모순 응답에서
   * 서버와 갈리고, 갈리는 순간 화면이 서버가 말하지 않은 것을 말하게 된다.
   */
  it('서버 값과 배열 재계산이 어긋나는 응답에서도 서버 값을 따른다', async () => {
    renderScreen(
      allRoutes([approvalRoute(contradictoryApprovalDetailFixture)]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    const progress = await screen.findByRole('group', { name: t.progress.label });

    expect(within(progress).getByText(t.progress.position(3, 3))).toBeInTheDocument();
    /* 짝 방향 — 배열을 세어 만든 값(1 / 1)이 아니다. */
    expect(within(progress).queryByText(t.progress.position(1, 1))).not.toBeInTheDocument();
  });

  it('상신 사유 전문이 줄 단위로 보인다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    const reason = await screen.findByRole('group', { name: t.progress.reasonPane });

    expect(reason.querySelectorAll('p')).toHaveLength(3);
    expect(within(reason).getByText('합성 폐기 사유 첫 줄')).toBeInTheDocument();
    expect(within(reason).getByText('둘째 문단 — 근거를 적는 자리')).toBeInTheDocument();
  });

  /**
   * **이력 탭의 두 구획 어디에도 내부 번호가 없다**(`omf-mes#44`).
   *
   * 이 탭이 특히 위험하다 — 출고 상세 응답이 **승인 요청 식별자를 실어 오고** 화면은 그 값으로
   * 조회를 한다. 조회에 쓰는 값이 그리는 값으로 새는 것은 한 줄이면 되는 일이라, 부품 시험만으로
   * 두지 않고 **실제 응답이 도는 화면 수준에서도** 짝으로 잰다.
   */
  it('이력 목록과 고른 품의 구획에 내부 번호가 없다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    /* 짝 방향 — 업무 번호와 이름은 실제로 보인다(아무것도 안 그려서 통과한 것이 아니다). */
    expect(within(historyListPane()).getByText('GI-2026-950001')).toBeInTheDocument();
    expect(within(historyDetailPane()).getByText(ITEM_LABEL)).toBeInTheDocument();

    for (const pane of [historyListPane(), historyDetailPane()]) {
      for (const id of INTERNAL_IDS) {
        expect(pane.textContent ?? '').not.toContain(id);
      }
    }
  });

  /** 결재 진행에도 내부 번호가 새지 않는다(`omf-mes#44`) — 짝으로 단언한다. */
  it('결재 진행 구획에 내부 번호가 없다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    const progress = await screen.findByRole('group', { name: t.progress.label });

    expect(within(progress).getByText('AP-2026-800001')).toBeInTheDocument();

    for (const id of INTERNAL_IDS) {
      expect(progress.textContent ?? '').not.toContain(id);
    }
  });
});

describe('DisposalIssueScreen — 결재 진행을 못 읽었을 때', () => {
  /**
   * **화면 배너를 세우지 않고 위 두 구획은 그대로 산다**(수명 표 26행 · 완료 조건 C41).
   * 결재 진행은 판단을 돕는 자료이지 이 품의를 다루는 전제가 아니다.
   */
  it('403이어도 품의 정보와 라인이 그대로 서고 화면 배너가 없다', async () => {
    renderScreen(allRoutes([failingApprovalRoute(403)]), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    const pane = historyDetailPane();

    expect(await within(pane).findByText(t.progress.forbiddenTitle)).toBeVisible();
    expect(within(pane).getByText('GI-2026-950001')).toBeInTheDocument();
    expect(within(pane).getByText(ITEM_LABEL)).toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
    /* 403에는 다시 시도를 내지 않는다 — 같은 권한으로 다시 불러도 같은 답이 온다. */
    expect(
      within(pane).queryByRole('button', { name: messages.common.retry }),
    ).not.toBeInTheDocument();
  });

  it('404·500에는 다시 시도가 있고 누르면 다시 부른다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([failingApprovalRoute(500)]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    await waitForIssueLines();

    const pane = historyDetailPane();

    expect(await within(pane).findByText(t.progress.loadFailedTitle)).toBeVisible();

    await user.click(within(pane).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, APPROVAL_DETAIL_PATH).length).toBeGreaterThan(1);
    });
  });

  it('못 읽어도 할 수 있는 일이 달라지지 않는다는 사실을 밝힌다', async () => {
    renderScreen(allRoutes([failingApprovalRoute(404)]), `${HISTORY_SEARCH}&gi=9501`);

    expect(await screen.findByText(t.progress.loadFailedNote)).toBeVisible();
  });
});

describe('DisposalIssueScreen — 승인 뒤에 남은 일', () => {
  /**
   * **계약이 못 박은 사실이라 늘 선다.** 승인은 상태만 바꾸고 재고는 전기가 움직인다 —
   * 승인만 받아 놓고 잊는 일을 막는 자리다(이슈 §6).
   */
  it('승인이 재고를 차감하지 않는다는 사실이 보인다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    expect(await screen.findByText(t.progress.postSeparateNote)).toBeVisible();
  });

  /** 자리표시가 비어 있는 지금은 화면이 승인 완료를 판정하지 못한다 — 그 사실을 밝힌다. */
  it('자리표시가 비어 있으면 판정하지 못한다고 말한다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    expect(await screen.findByText(t.progress.unjudgeableNote)).toBeVisible();
    expect(screen.queryByText(t.progress.approvedNotPostedNote)).not.toBeInTheDocument();
  });

  /**
   * **전환 감지기** — 자리표시를 채우면 승인된 품의에 안내가 서고 판정 불가 안내가 사라진다.
   * 채워졌을 때 살아나는 것을 재지 않으면 그 자리표시는 죽은 가지다.
   */
  it('자리표시를 채우면 승인 뒤 안내가 선다', async () => {
    fillApprovedStatusCodes();

    renderScreen(
      allRoutes([
        issueDetailRoute(
          goodsIssueLineResponseFixtures.map((line) => ({
            ...line,
            inventoryTransactionLineId: null,
          })),
        ),
      ]),
      `${HISTORY_SEARCH}&gi=9501`,
    );

    expect(await screen.findByText(t.progress.approvedNotPostedNote)).toBeVisible();
    expect(screen.queryByText(t.progress.unjudgeableNote)).not.toBeInTheDocument();
  });

  /**
   * **이미 전기된 전표에 「재고는 아직 차감되지 않았습니다」는 거짓이다.** 승인 자리표시가
   * 채워져 있어도 라인이 원장에 갔으면 그 문장을 내지 않는다.
   */
  it('이미 전기된 전표에는 승인 뒤 안내를 내지 않는다', async () => {
    fillApprovedStatusCodes();

    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await waitForIssueLines();

    expect(await screen.findByText(t.progress.postSeparateNote)).toBeVisible();
    expect(screen.queryByText(t.progress.approvedNotPostedNote)).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 이력 탭에도 쓰기가 없다', () => {
  /**
   * **기록된 모든 요청의 method가 `GET`이다**(완료 조건 C48). 탭을 오가고 품의를 고르고
   * 다시 조회까지 해도 쓰기가 하나도 나가지 않는다.
   */
  it('탭을 오가고 품의를 골라도 어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await openTab(user, t.tabs.history);
    await waitForIssueList();
    await selectIssue(user, 'GI-2026-950001');
    await waitForIssueLines();
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH).length).toBeGreaterThan(1);
    });

    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    expectNoUnknownPath(requests);
  });
});

/* ------------------------------------------------------------------------- *
 * 품의 상신 — 전표 생성과 상신을 잇는 한 버튼(승인 기록 정정 1-1)
 * ------------------------------------------------------------------------- */

/** 품의 정보의 코드 셋을 채운다. **채워야 「승인 요청」이 열린다**(전환 감지기 M53). */
const fillFormCodeLists = (): void => {
  codeValues.issueType = [SAMPLE_FORM_CODES.issueType];
  codeValues.sourceDocumentType = [SAMPLE_FORM_CODES.sourceDocumentType];
  codeValues.reason = [SAMPLE_FORM_CODES.reason];
};

const chooseOption = async (
  user: ReturnType<typeof userEvent.setup>,
  fieldLabel: string,
  optionLabel: string,
): Promise<void> => {
  await user.click(screen.getByRole('combobox', { name: fieldLabel }));
  await user.click(screen.getByRole('option', { name: optionLabel }));
};

/**
 * 시각 입력칸에 값을 넣는다. **글자 단위로 치지 않는다** — `type="time"`은 시·분 세그먼트를
 * 따로 받아 `09:30`을 그대로 치면 마지막 글자만 분에 남는다.
 */
const setIssuedTime = (value: string): void => {
  fireEvent.change(screen.getByLabelText(t.formFields.issuedTime), { target: { value } });
};

const submitButton = (): HTMLElement =>
  screen.getByRole('button', { name: t.actions.submitDisposal });

const resubmitButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.resubmit });

const selfDisposalCheckbox = (): HTMLElement => screen.getByLabelText(t.formFields.selfDisposal);

/**
 * 품의 정보를 전부 채운다. **코드 값 목록이 채워져 있어야** 고를 수 있다.
 *
 * **도착지도 채운다**(변경 통지 #128) — 정하지 않으면 「승인 요청」이 잠긴다. 이 화면에서
 * 지금 고를 수 있는 갈래는 **자체 폐기 하나**다: 폐기 거래처 선택지를 채우는 조회가 아직
 * 없어 칸이 잠겨 있다. 「정하지 않은 상태」를 재는 잣대는 `withDestination`을 끈다.
 */
const fillDisposalForm = async (
  user: ReturnType<typeof userEvent.setup>,
  reason = '불량 판정분 폐기',
  withDestination = true,
): Promise<void> => {
  await chooseOption(user, t.formFields.issueType, SAMPLE_FORM_CODES.issueType);
  await chooseOption(user, t.formFields.sourceDocumentType, SAMPLE_FORM_CODES.sourceDocumentType);
  await chooseOption(user, t.formFields.reason, SAMPLE_FORM_CODES.reason);
  await pickDate(user, screen.getByLabelText(t.formFields.issuedDate), '2026-08-11');
  setIssuedTime('09:30');

  if (withDestination) await user.click(selfDisposalCheckbox());

  if (reason !== '') await user.type(screen.getByLabelText(t.formFields.submitReason), reason);
};

/** 「승인 요청」이 열린 상태까지 — 값 목록·줄·수량·폐기 요청 정보를 모두 넣는다. */
const setupReadyToSubmit = async (
  routes: StubRoute[] = allRoutes(chainRoutes()),
  reason?: string,
  hold: string[] = [],
  search = '?gr=9001',
  navigateTo = '',
  strict = false,
): Promise<ReturnType<typeof renderScreen>> => {
  fillFormCodeLists();

  const rendered = renderScreen(routes, search, navigateTo, hold, strict);

  await waitForLines();
  await rendered.user.click(lineCheckbox(1));
  await rendered.user.type(qtyInput(1), '10');
  await fillDisposalForm(rendered.user, reason);

  return rendered;
};

const openSubmitConfirm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(submitButton());
};

const confirmSubmit = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.confirmSubmit }));
};

/** 실제로 나간 쓰기. **경로와 method를 함께** 본다 — 한쪽만 세면 다른 경로의 쓰기를 놓친다. */
const writesTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.method === 'POST' && request.url.pathname === pathname);

const resultPane = (): HTMLElement => screen.getByRole('region', { name: t.result.label });

/**
 * 이력 탭에서 고른 **미상신 전표**(9502)의 상세. **토큰을 함께 준다** — 재상신의 `If-Match`가
 * 그 전표의 상세 경로에서 오는지 재려면 값이 있어야 한다.
 */
const notSubmittedDetailRoute = (etag = '"token-9502"'): StubRoute => ({
  match: (request) => isGet(request, MISSING_ISSUE_DETAIL_PATH),
  respond: () =>
    jsonResponse(issueDetailBody(goodsIssueLineResponseFixtures, goodsIssueResponseFixtures[1]), {
      headers: { ETag: etag },
    }),
});

describe('DisposalIssueScreen — 「승인 요청」이 열리는 조건', () => {
  /**
   * **자리표시 두 방향의 첫째**(완료 조건 C51 · 감지기 M49·M53). 값 목록이 비어 있는 동안
   * 이 화면으로는 폐기 품의를 올릴 수 없고, **왜 잠겼는지**가 버튼 옆에서 읽힌다.
   */
  it('코드 값 목록이 비면 잠기고 사유가 버튼에 이어진다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '10');

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveAccessibleDescription(t.actionReasons.codeListPending);
  });

  /**
   * **도착지를 정해야 열린다**(완료 조건 C15·C18 · 변경 통지 #128 §4 ⛔).
   *
   * 「체크 없이 거래처도 안 고르면 막는다」가 통지의 문면이고, 그 잠금은 **「승인 요청」
   * 버튼**에 선다(승인 기록 D-1 안 A — 계약에 전표 헤더를 고치는 경로가 없어 도착지는
   * 발의 시점에 정해져 생성 본문으로 나간다).
   *
   * **사유가 지금 할 수 있는 조치를 가리킨다.** 폐기 거래처 선택지가 아직 없으므로 화면은
   * 「고르세요」가 아니라 「자체 폐기를 체크하면 올릴 수 있습니다」라고 말한다 — 고를 것이
   * 없는 사용자에게 고르라고 하면 자기가 놓친 것을 찾다가 화면을 고장으로 읽는다.
   */
  it('도착지를 정하지 않으면 잠기고, 자체 폐기를 체크하면 열린다', async () => {
    fillFormCodeLists();

    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '10');
    await fillDisposalForm(user, '불량 판정분 폐기', false);

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveAccessibleDescription(t.actionReasons.disposalPartnerPending);

    /* ⭐ **선택지가 없어도 화면은 선다**(#128 §3) — 체크 하나로 열린다. */
    await user.click(selfDisposalCheckbox());

    expect(submitButton()).toBeEnabled();
  });

  /**
   * **폐기 거래처 칸은 잠겨 있고 왜 잠겼는지가 읽힌다**(완료 조건 C15).
   *
   * 코드 자리표시 셋과 **같은 모양**이다 — 값 목록을 채우는 조회가 붙기 전까지 고를 것이 없다.
   */
  it('폐기 거래처 칸이 잠겨 있고 사유가 이름에 이어진다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    /* 짝 양성 — 칸이 실제로 서 있다(없어서 통과한 것이 아니다). */
    const partner = screen.getByLabelText(t.formFields.disposalPartner);

    expect(partner).toBeDisabled();
    expect(partner).toHaveAccessibleDescription(expect.stringContaining(messages.pendingCode.note));

    /*
     * **체크하면 잠긴 사유가 갈린다**(완료 조건 C16). 같은 잠금이라도 사용자가 정한 결과와
     * 화면의 사정은 할 수 있는 조치가 다르다 — 한 문구로 뭉치면 체크를 풀어도 열리지 않는
     * 칸으로 읽는다.
     */
    await user.click(selfDisposalCheckbox());

    expect(partner).toBeDisabled();
    expect(partner).toHaveAccessibleDescription(expect.stringContaining(t.form.selfDisposalChosen));
  });

  /** **둘째 방향** — 채우면 살아나지 않는 자리표시는 죽은 가지다. */
  it('값 목록을 채우고 다 넣으면 열린다', async () => {
    const { user } = await setupReadyToSubmit();

    expect(submitButton()).toBeEnabled();
  });

  /**
   * **통지가 문면으로 지정한 낱말**(#124) — 이 버튼은 「품의 상신」이 아니라 **「승인 요청」**이다.
   *
   * 이 파일의 다른 시험은 버튼을 `t.actions.submitDisposal` **키로 조회**한다 — 상수와 조회가
   * 같은 값을 보므로 값이 무엇으로 바뀌든 늘 통과한다. 낱말이 통지 이전으로 되돌아가는 것을
   * 잡으려면 **보이는 글자를 직접 무는 자리**가 있어야 하고, 이 자리가 그 하나다.
   * 짝이 되는 낱말 셋은 `tabs.test.ts`·`resubmit-pane.test.tsx`·`submit-confirm-dialog.test.tsx`에 있다.
   */
  it('버튼의 보이는 글자가 통지 문면 그대로다', async () => {
    await setupReadyToSubmit();

    expect(submitButton()).toHaveTextContent(/^승인 요청$/);
  });

  /** 사유는 **막는 곳이 화면뿐이다** — 목이 공백만인 사유를 202로 받는다(감지기 M56). */
  it('상신 사유가 공백만이면 잠기고 그 사유가 보인다', async () => {
    const { user } = await setupReadyToSubmit(allRoutes(chainRoutes()), '   ');

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveAccessibleDescription(t.actionReasons.needsReason);
  });

  /** 줄을 고르지 않으면 **줄 판정의 사유**가 그대로 나온다 — 판정이 한 곳에서 나온다. */
  it('고른 줄이 없으면 줄 사유가 나온다', async () => {
    fillFormCodeLists();

    const { user } = renderScreen(allRoutes(chainRoutes()), '?gr=9001');

    await waitForLines();
    await fillDisposalForm(user);

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveAccessibleDescription(t.reasons.selectNone);
  });
});

describe('DisposalIssueScreen — 확인 창을 지나야 나간다', () => {
  /** **확인하기 전에는 요청 0회**(완료 조건 C57) — 누르는 순간 전표가 생기면 되돌릴 수 없다. */
  it('버튼을 눌러도 확인 전에는 어떤 쓰기도 나가지 않는다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(requests.filter((request) => request.method !== 'GET')).toEqual([]);
  });

  /** 창이 **보낼 것을 그대로** 되비춘다 — 창에서 처음 보는 값이 없어야 한다. */
  it('창이 전표·코드·일시·줄·사유를 보인다', async () => {
    const { user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('GR-2026-900001')).toBeInTheDocument();
    expect(within(dialog).getByText(SAMPLE_FORM_CODES.issueType)).toBeInTheDocument();
    expect(within(dialog).getByText(SAMPLE_FORM_CODES.reason)).toBeInTheDocument();
    expect(within(dialog).getByText('2026-08-11 09:30')).toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.lineCount(1))).toBeInTheDocument();
    expect(
      within(dialog).getByText(t.dialog.linePair(ITEM_LABEL, 'SAMPLE-LOT-0001', `10 ${UOM_LABEL}`)),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.reasonSummaryNote)).toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.submitEffects)).toBeInTheDocument();
  });

  /** **창 안에 선택칸이 없다**(완료 조건 C79 · `omf-mes#45`). */
  it('창 안에 선택칸이 없다', async () => {
    const { user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);

    expect(within(screen.getByRole('dialog')).queryAllByRole('combobox')).toHaveLength(0);
  });

  /**
   * **보내는 자리가 스스로 한 번 더 본다**(감지기 M55).
   *
   * **겹을 떼어내고 잰다.** 줄이 풀리는 경우는 본문 조립(마지막 겹)이 어차피 막으므로 그것만
   * 재면 재판정이 없어도 통과한다 — 상신 사유는 **전표 생성 본문에 들어가지 않아** 조립이
   * 보지 못하는 값이다. 사유가 빈 채로 지나가면 **전표는 만들어지고 상신은 시작조차 못 한다.**
   */
  it('창이 열린 사이에 사유가 비면 전표도 만들지 않는다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    /* 창 뒤의 칸을 비운다 — 창은 그 사실을 모르고, 전표 생성 본문도 이 값을 담지 않는다. */
    fireEvent.change(screen.getByLabelText(t.formFields.submitReason), { target: { value: '  ' } });
    await confirmSubmit(user);

    expect(writesTo(requests, ISSUES_PATH)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(t.errors.reasonRequired)).toBeInTheDocument();
  });

  /** 줄이 풀리는 길도 같은 자리가 막는다 — 조립이 마지막 겹으로 한 번 더 거른다. */
  it('창이 열린 사이에 줄이 풀리면 보내지 않는다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    /* 창 뒤의 표에서 줄 선택을 푼다 — 창은 그 사실을 모른다. */
    await user.click(lineCheckbox(1));
    await confirmSubmit(user);

    expect(requests.filter((request) => request.method !== 'GET')).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 연쇄가 실제로 보내는 것', () => {
  /**
   * **한 번 눌러 요청이 셋 나간다** — 전표 생성 → 잠금 토큰을 얻는 상세 조회 → 상신.
   * 가운데 조회가 빠지면 상신의 `If-Match`가 비어 요청이 나가지 않는다(계획 결정 13).
   */
  it('전표 생성·상세 조회·상신을 차례로 보낸다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, CREATED_APPROVAL_PATH)).toHaveLength(1);
    });

    expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
    expect(requestsTo(requests, CREATED_DETAIL_PATH).length).toBeGreaterThan(0);
    expectNoUnknownPath(requests);
  });

  /**
   * **이 화면에서 가장 무거운 한 줄**(감지기 M52). 참으로 새면 승인 없이 재고가 빠진다 —
   * 목이 생략을 201로 받으므로 기본값에 기대면 서버 기본이 바뀔 때 조용히 달라진다.
   */
  it('전표 생성 본문에 postImmediately가 거짓으로 실린다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
    });

    const body = writesTo(requests, ISSUES_PATH)[0]?.body as Record<string, unknown>;

    expect(body.postImmediately).toBe(false);
  });

  /** 본문의 값마다 출처가 다르다(완료 조건 C54·C56 · 감지기 M54). */
  it('본문의 줄·원천·일시가 화면의 값에서 온다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
    });

    const body = writesTo(requests, ISSUES_PATH)[0]?.body as Record<string, unknown>;

    expect(body.sourceDocumentId).toBe(9001);
    expect(body.sourceWarehouseId).toBe(9701);
    expect(body.issuedAt).toMatch(/^2026-08-11T09:30:00/);
    expect(body.businessDate).toBe('2026-08-11');
    expect(body.reasonCode).toBe(SAMPLE_FORM_CODES.reason);
    expect(body.lines).toEqual([
      { itemId: 9301, lotId: 9601, issueQty: 10, uomId: 9801, sourceLocationId: 9901 },
    ]);
  });

  it('자체 폐기로 올리면 나가는 본문에 도착지 두 키가 없다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
    });

    const body = writesTo(requests, ISSUES_PATH)[0]?.body as Record<string, unknown>;

    /* 짝 양성 — 본문이 실제로 나갔다(빈 객체라 통과한 것이 아니다). */
    expect(body.issueTypeCode).toBe(SAMPLE_FORM_CODES.issueType);
    expect(Object.keys(body)).not.toContain('destinationTypeCode');
    expect(Object.keys(body)).not.toContain('destinationId');
  });

  /**
   * **확인한 글자와 나가는 값이 같은 자리에서 나온다**(완료 조건 C19).
   *
   * 창이 「자체 폐기」라고 적었으면 본문에는 도착지 두 키가 없어야 한다 — 둘을 **한 잣대에서**
   * 함께 보지 않으면, 창은 그대로인데 본문만 달라지는 어긋남이 조용히 산다.
   */
  it('확인 창이 보인 도착지와 나가는 본문이 같은 사실을 말한다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText(t.formFields.destination)).toBeInTheDocument();
    expect(within(dialog).getByText(t.values.selfDisposal)).toBeInTheDocument();

    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
    });

    const body = writesTo(requests, ISSUES_PATH)[0]?.body as Record<string, unknown>;

    /* 짝 양성 — 본문이 실제로 나갔다(빈 객체라 통과한 것이 아니다 · 리뷰 Nit N6). */
    expect(body.issueTypeCode).toBe(SAMPLE_FORM_CODES.issueType);
    expect(Object.keys(body)).not.toContain('destinationTypeCode');
    expect(Object.keys(body)).not.toContain('destinationId');
  });

  /**
   * **상신 본문은 다듬은 사유 하나다**(완료 조건 C61 · 감지기 M63).
   *
   * **여러 줄을 이 폼에서 만들 수 없다** — 디자인 시스템 `TextField`에 여러 줄 입력이 없어
   * (실측 · 갭 b) 한 줄 입력칸이 줄바꿈을 받지 못한다. 줄바꿈이 유지되는지는 여러 줄을
   * 실제로 만들 수 있는 자리(`reason-draft.test.ts`)가 잰다 — 여기서 잴 수 있는 것은
   * **앞뒤 공백을 떼고 보내는가**다.
   */
  it('상신 본문이 다듬은 사유 하나다', async () => {
    const { requests, user } = await setupReadyToSubmit(
      allRoutes(chainRoutes()),
      '  불량 판정분 폐기  ',
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, CREATED_APPROVAL_PATH)).toHaveLength(1);
    });

    expect(writesTo(requests, CREATED_APPROVAL_PATH)[0]?.body).toEqual({
      reason: '불량 판정분 폐기',
    });
  });

  /**
   * **토큰을 출고 상세 경로에서 꺼낸다**(완료 조건 C63 · 감지기 M58).
   *
   * 컬렉션 경로의 토큰(등록 201이 준 것)을 실으면 **남의 토큰**이 나가고, 액션 경로를 주면
   * 토큰이 비어 요청 자체가 나가지 않는다.
   */
  it('상신의 If-Match가 상세 200의 토큰이고 등록에는 실리지 않는다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, CREATED_APPROVAL_PATH)).toHaveLength(1);
    });

    const create = writesTo(requests, ISSUES_PATH)[0];
    const submit = writesTo(requests, CREATED_APPROVAL_PATH)[0];

    expect(create?.headers.has('If-Match')).toBe(false);
    expect(submit?.headers.get('If-Match')).toBe(CREATED_DETAIL_ETAG);
    /* 짝 방향 — 컬렉션 경로의 토큰이 실리지 않았다. */
    expect(submit?.headers.get('If-Match')).not.toBe(COLLECTION_ETAG);
  });

  /** 멱등 키는 **uuid여야 한다** — 목이 비uuid를 400으로 되돌린다(실측). */
  it('두 쓰기에 uuid 멱등 키가 실린다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, CREATED_APPROVAL_PATH)).toHaveLength(1);
    });

    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const path of [ISSUES_PATH, CREATED_APPROVAL_PATH]) {
      expect(writesTo(requests, path)[0]?.headers.get('Idempotency-Key') ?? '').toMatch(uuid);
    }
  });
});

describe('DisposalIssueScreen — 연쇄가 끝난 뒤', () => {
  /** 성공하면 **서버가 준 값**으로 결과가 서고 초안이 비고 `gi`가 주소에 실린다(완료 조건 C58). */
  it('결과 구획·초안 비움·주소가 함께 이루어진다', async () => {
    const { user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(t.result.submittedTitle('GI-2026-950004'));

    expect(within(resultPane()).getByText('SAMPLE_GI_STATUS_B')).toBeInTheDocument();
    expect(within(resultPane()).getByText(t.result.lineCount(1))).toBeInTheDocument();
    expect(lineCheckbox(1)).not.toBeChecked();
    expect(qtyInput(1)).toHaveValue('');
    expect(screen.getByLabelText(t.formFields.submitReason)).toHaveValue('');
    await waitFor(() => {
      expect(currentLocation()).toContain('gi=9504');
    });
  });

  /** 상신까지 끝났으면 **승인 요청 번호를 내지 않는다**(감지기 M61) — 응답이 식별자 하나뿐이다. */
  it('결과에 승인 요청 번호가 없다', async () => {
    const { user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(t.result.submittedTitle('GI-2026-950004'));

    expect(within(resultPane()).getByText(t.result.submittedNoRequestNo)).toBeInTheDocument();
    expect(resultPane().textContent ?? '').not.toContain('9523');
  });

  /** 「이 요청 열기」가 **탭을 옮기고 그 전표를 고른 상태**로 만든다(완료 조건 C59). */
  it('이 품의 열기가 이력 탭으로 옮기고 그 품의를 고른다', async () => {
    const { user } = await setupReadyToSubmit(
      allRoutes([
        ...chainRoutes(),
        {
          match: (request) => isGet(request, CREATED_DETAIL_PATH),
          respond: () =>
            jsonResponse(createdDetailBody(), { headers: { ETag: CREATED_DETAIL_ETAG } }),
        },
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(t.result.submittedTitle('GI-2026-950004'));
    await user.click(screen.getByRole('button', { name: t.actions.openIssue }));

    expect(currentLocation()).toContain('tab=history');
    expect(currentLocation()).toContain('gi=9504');
    await screen.findByRole('region', { name: t.panes.historyDetail });
  });

  /** 만들어진 품의를 열면 그 전표의 상세가 화면에 선다 — 결과에서 이력으로 이어지는 길이다. */
  it('만들어진 품의를 열면 그 전표의 상세가 선다', async () => {
    const { user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(t.result.submittedTitle('GI-2026-950004'));

    await user.click(screen.getByRole('button', { name: t.actions.openIssue }));

    const detail = await screen.findByRole('region', { name: t.panes.historyDetail });

    expect(within(detail).getByText('GI-2026-950004')).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 부분 실패', () => {
  /**
   * **전표는 만들어졌고 상신이 실패했다**(완료 조건 C64 · 감지기 M57).
   *
   * 통째로 실패라고 말하면 사용자가 처음부터 다시 만들어 **전표가 두 벌** 남고, 통째로
   * 성공이라고 말하면 결재에 올라가지 않은 품의를 올라간 것으로 믿는다.
   */
  it('전표 번호와 함께 그 사실을 말하고 이어서 상신할 길을 낸다', async () => {
    const { user } = await setupReadyToSubmit(
      allRoutes([createRoute(), createdDetailRoute(), failingApprovalSubmitRoute(500)]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(t.result.partialTitle('GI-2026-950004'));

    expect(within(resultPane()).getByText(t.result.partialDescription)).toBeInTheDocument();
    expect(within(resultPane()).getByText(t.result.notSubmittedYet)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.openIssue })).toBeInTheDocument();
    /* 짝 방향 — 성공으로도 말하지 않는다. */
    expect(screen.queryByText(t.result.submittedTitle('GI-2026-950004'))).not.toBeInTheDocument();
  });

  /**
   * **되돌아가는 갈래에서도 앞 성공의 결과 구획을 남기지 않는다**(수명 표 17·18행).
   *
   * 「승인 요청」은 **보내기 직전에 한 번 더 본다**(둘째 겹). 확인 창이 열린 사이에 상태가
   * 바뀌어 막히면 아무것도 나가지 않는데, 그때 **앞 전표의 번호가 결과 구획에 그대로** 있으면
   * 사용자는 방금 누른 요청이 그 번호를 만들었다고 읽는다 — 되돌릴 수 없는 쓰기 화면에서
   * 가장 나쁜 오해다. 그래서 앞 결과를 비우는 자리가 **되돌아가는 갈래보다 앞**에 있어야 한다.
   *
   * 형제 슬라이스가 같은 형태의 감지기를 이미 갖고 있다(입고 처리의 「계약이 모르는 코드로
   * 다시 처리하면 앞 성공의 결과 구획이 남지 않는다」) — 그쪽은 조립이 막는 갈래이고 이쪽은
   * 재판정이 막는 갈래다.
   */
  it('창이 열린 사이 줄이 풀리면 보내지 않고 앞 성공의 결과 구획도 남지 않는다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    /* 선행 양성 — 첫 요청은 실제로 성공했고 결과 구획에 번호가 섰다. */
    await screen.findByText(t.result.submittedTitle('GI-2026-950004'));

    /* 두 번째 시도 — 성공 뒤 초안은 비어 있다(수명 표 17행). 다시 다 채운다. */
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '10');
    await fillDisposalForm(user);

    await openSubmitConfirm(user);
    await screen.findByRole('dialog');

    /*
     * **창이 열린 사이에 상태가 바뀐다.** 라인 표는 창 뒤에 그대로 살아 있고(수명 표 6행 —
     * 줄을 고치는 것은 대상을 바꾸는 것이 아니다), 줄이 풀리면 보낼 것이 없어진다.
     */
    fireEvent.click(lineCheckbox(1));
    await confirmSubmit(user);

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
    });
    /* 짝 방향 — 결과가 사라진 것은 새 전표가 나가서가 아니다. 두 번째 요청은 없다. */
    expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
  });

  /** 전표조차 만들어지지 않았으면 **결과 구획이 서지 않는다** — 없는 전표를 말하면 안 된다. */
  it('전표 생성이 실패하면 결과 구획이 없고 배너만 선다', async () => {
    const { user } = await setupReadyToSubmit(allRoutes([failingCreateRoute(403)]));

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
  });

  /**
   * **응답을 받지 못한 실패에만** 확인 안내를 낸다(다섯 겹 ⑤ · 감지기 M73의 형태).
   * 다른 갈래에 내면 경고가 배경이 되고, 이 갈래에 안 내면 같은 품의가 두 벌 남는다.
   */
  it('네트워크 갈래에만 「전달됐는지 확인할 수 없습니다」가 붙는다', async () => {
    const { user } = await setupReadyToSubmit(
      allRoutes([
        {
          match: (request) => isPost(request, ISSUES_PATH),
          respond: () => {
            throw new TypeError('network down');
          },
        },
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(t.notes.submitRecheck);
  });

  it('403에는 그 안내가 붙지 않는다', async () => {
    const { user } = await setupReadyToSubmit(allRoutes([failingCreateRoute(403)]));

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByText(t.notes.submitRecheck)).not.toBeInTheDocument();
  });

  /** 실패해도 **입력이 남는다**(수명 표 18행) — 고쳐서 다시 보낼 수 있어야 한다. */
  it('전표 생성이 실패하면 줄과 품의 정보가 그대로 남는다', async () => {
    const { user } = await setupReadyToSubmit(allRoutes([failingCreateRoute(400)]));

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(messages.httpError.description);

    expect(lineCheckbox(1)).toBeChecked();
    expect(qtyInput(1)).toHaveValue('10');
    expect(screen.getByLabelText(t.formFields.submitReason)).toHaveValue('불량 판정분 폐기');
  });
});

describe('DisposalIssueScreen — 전송 중 잠금', () => {
  /** **전송 중에는 컨트롤이 잠긴다**(첫째 겹) — 값이 바뀌면 확인한 것과 나가는 것이 갈린다. */
  it('보내는 동안 입력·버튼·목록·탭이 잠긴다', async () => {
    const { user, release } = await setupReadyToSubmit(allRoutes(chainRoutes()), undefined, [
      ISSUES_PATH,
    ]);

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });

    expect(screen.getByLabelText(t.formFields.submitReason)).toBeDisabled();
    expect(lineCheckbox(1)).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.refresh })).toBeDisabled();
    /*
     * **탭은 `aria-disabled`로 잠긴다**(디자인 시스템 구현 실측 — `disabled` 속성이 아니다).
     * 그래도 잠금이다: 클릭·키보드 로빙에서 건너뛴다. 잣대를 실물에 맞춘다.
     */
    expect(screen.getByRole('tab', { name: t.tabs.history })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    release();
  });

  /** **연타해도 요청은 1회**다 — 멱등 키가 호출마다 새로 만들어져 두 번 보내면 전표가 두 벌이다. */
  it('보내는 동안 연타해도 전표 생성이 1회다', async () => {
    const { requests, user, release } = await setupReadyToSubmit(
      allRoutes(chainRoutes()),
      undefined,
      [ISSUES_PATH],
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
    });

    await user.click(submitButton());

    expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);

    release();
  });

  /**
   * **전송 중에는 대상을 바꾸지 못한다**(둘째 겹 · W-01-05 R3-1의 셋째 길). 대상이 바뀌면
   * 나가는 중인 상신의 결과가 다른 전표 맥락에 도착한다.
   */
  it('보내는 동안 탭을 눌러도 주소가 바뀌지 않는다', async () => {
    const { user, release } = await setupReadyToSubmit(allRoutes(chainRoutes()), undefined, [
      ISSUES_PATH,
    ]);

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });

    const before = currentLocation();

    await user.click(screen.getByRole('tab', { name: t.tabs.history }));

    expect(currentLocation()).toBe(before);

    release();
  });
});

describe('DisposalIssueScreen — 배너와 결과의 매임', () => {
  /**
   * **자기 대상보다 오래 살지 않는다**(완료 조건 C77 · 감지기 M76). 전표 A의 실패가 전표 B의
   * 라인 표 위에 서면 사용자는 B도 막힌 것으로 읽는다.
   */
  it('다른 입고 전표를 고르면 실패 배너와 결과가 사라진다', async () => {
    const { user } = await setupReadyToSubmit(allRoutes([failingCreateRoute(403)]));

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(messages.httpError.forbidden);

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('GR-2026-900002') }));

    await waitFor(() => {
      expect(screen.queryByText(messages.httpError.forbidden)).not.toBeInTheDocument();
    });
  });

  /** **입력으로는 사라지지 않는다**(감지기 M77) — 사용자는 거절 사유를 읽으며 값을 고치는 중이다. */
  it('사유를 고쳐도 실패 배너가 남는다', async () => {
    const { user } = await setupReadyToSubmit(allRoutes([failingCreateRoute(403)]));

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(messages.httpError.forbidden);

    await user.type(screen.getByLabelText(t.formFields.submitReason), '더');

    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
  });

  /** **렌더마다 지워지지 않는다**(감지기 M78) — 정리 의존성에 `reset` 참조를 넣으면 그렇게 된다. */
  it('다시 조회로 응답이 도착해도 실패 배너가 남는다', async () => {
    const { user } = await setupReadyToSubmit(
      allRoutes([failingCreateRoute(403), changingListRoute()]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(messages.httpError.forbidden);

    await refresh(user);

    await waitFor(() => {
      expect(within(listTable()).getByText('GR-2026-900001')).toBeInTheDocument();
    });
    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 이력 탭의 재상신', () => {
  /** 미상신 전표에는 **상신 자리가 열린다** — 그 전표를 되살릴 길이 화면에 있어야 한다. */
  it('미상신 전표에 사유 칸과 재상신 버튼이 선다', async () => {
    renderScreen(allRoutes([notSubmittedDetailRoute()]), `${HISTORY_SEARCH}&gi=9502`);

    await screen.findByRole('region', { name: t.resubmit.label });

    expect(screen.getByText(t.resubmit.lead)).toBeInTheDocument();
    expect(screen.getByLabelText(t.formFields.submitReason)).toBeInTheDocument();
    expect(resubmitButton()).toBeDisabled();
    expect(resubmitButton()).toHaveAccessibleDescription(t.actionReasons.needsReason);
  });

  /** 이미 상신된 품의에는 **열리지 않는다** — 되풀이하면 결재 요청이 두 벌이 된다. */
  it('이미 상신된 품의에는 사유 칸이 없고 사유가 보인다', async () => {
    renderScreen(allRoutes(), `${HISTORY_SEARCH}&gi=9501`);

    await screen.findByRole('region', { name: t.resubmit.label });

    expect(screen.getByText(t.resubmit.submittedLead)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.formFields.submitReason)).not.toBeInTheDocument();
    expect(resubmitButton()).toBeDisabled();
    expect(resubmitButton()).toHaveAccessibleDescription(t.actionReasons.alreadySubmitted);
  });

  /**
   * 재상신도 **확인 창을 지나고**, 토큰은 **그 전표의 상세 경로**에서 온다.
   * 규칙이 발의 자리와 같은 파일에서 나오므로 두 자리가 갈리지 않는다.
   */
  it('사유를 적고 확인하면 그 전표의 상신 경로로 나간다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([approvalSubmitRoute(RESUBMIT_APPROVAL_PATH), notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    await screen.findByRole('region', { name: t.resubmit.label });
    await user.type(screen.getByLabelText(t.formFields.submitReason), '이어서 상신');
    await user.click(resubmitButton());
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, RESUBMIT_APPROVAL_PATH)).toHaveLength(1);
    });

    const sent = writesTo(requests, RESUBMIT_APPROVAL_PATH)[0];

    expect(sent?.body).toEqual({ reason: '이어서 상신' });
    expect(sent?.headers.get('If-Match')).toBe('"token-9502"');
  });

  /** 확인 전에는 요청이 나가지 않는다 — 상신도 되돌릴 수 없는 조작이다. */
  it('확인 전에는 재상신 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([approvalSubmitRoute(RESUBMIT_APPROVAL_PATH), notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    await screen.findByRole('region', { name: t.resubmit.label });
    await user.type(screen.getByLabelText(t.formFields.submitReason), '이어서 상신');
    await user.click(resubmitButton());

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(requests.filter((request) => request.method !== 'GET')).toEqual([]);
  });
});

describe('DisposalIssueScreen — 409 뒤의 길', () => {
  /**
   * **409에만 「최신 불러오기」가 붙고, 그 길이 실제로 토큰을 새것으로 만든다**
   * (완료 조건 C65·C66 · 감지기 M58과 짝).
   *
   * 상신이 409로 막히면 전표는 이미 만들어져 있다 — 낡은 것은 **그 전표의 잠금 토큰**이므로
   * 다시 읽을 대상도 그 전표다. 이력 탭에서 이어서 상신하면 **앞의 것과 다른 토큰**이 실린다.
   */
  it('상신 409 뒤 다시 읽고 이어서 상신하면 토큰이 새것이다', async () => {
    let submitCalls = 0;

    const { requests, user } = await setupReadyToSubmit(
      allRoutes([
        createRoute(),
        rotatingCreatedDetailRoute(),
        {
          match: (request) => isPost(request, CREATED_APPROVAL_PATH),
          respond: () => {
            submitCalls += 1;

            return submitCalls === 1
              ? jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })
              : jsonResponse({ approvalRequestId: 9523 }, { status: 202 });
          },
        },
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    /* 전표는 만들어졌고 상신만 막혔다 — 화면이 그 둘을 갈라 말한다. */
    await screen.findByText(t.result.partialTitle('GI-2026-950004'));
    expect(screen.getByText(messages.conflict.user)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

    /* 이어서 상신하는 자리는 이력 탭 하나다(계획 결정 6). */
    await user.click(screen.getByRole('button', { name: t.actions.openIssue }));
    await screen.findByRole('region', { name: t.resubmit.label });

    await user.type(screen.getByLabelText(t.formFields.submitReason), '이어서 상신');
    await user.click(resubmitButton());
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, CREATED_APPROVAL_PATH)).toHaveLength(2);
    });

    const [first, second] = writesTo(requests, CREATED_APPROVAL_PATH);

    expect(first?.headers.get('If-Match')).toBe('"token-1"');
    expect(second?.headers.get('If-Match')).not.toBe(first?.headers.get('If-Match'));
  });

  /** 409가 아닌 갈래에는 **「최신 불러오기」를 내지 않는다** — 눌러도 풀리지 않고 입력만 버린다. */
  it('403에는 최신 불러오기가 없다', async () => {
    const { user } = await setupReadyToSubmit(allRoutes([failingCreateRoute(403)]));

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(messages.httpError.forbidden);

    expect(
      screen.queryByRole('button', { name: messages.conflict.reloadAction }),
    ).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 결과 구획에 번호가 새지 않는다', () => {
  /** **내부 번호를 어느 자리에도 내지 않는다**(감지기 M62 · `omf-mes#44`) — 짝으로 단언한다. */
  it('업무 번호는 보이고 내부 번호는 보이지 않는다', async () => {
    const { user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(t.result.submittedTitle('GI-2026-950004'));

    expect(within(resultPane()).getByText('GI-2026-950004')).toBeInTheDocument();

    for (const id of INTERNAL_IDS) {
      expect(resultPane().textContent ?? '').not.toContain(id);
    }
  });
});

describe('DisposalIssueScreen — 재상신도 보내는 자리가 다시 본다', () => {
  /**
   * **보내는 자리가 스스로 한 번 더 본다**(감지기 M60). 확인 창이 버튼과 전송 사이를 벌려
   * 놓으므로 「버튼이 막았으니 여기서는 안 봐도 된다」가 성립하지 않는다 — 창이 열린 사이에
   * 사유가 비면 **공백만인 사유가 결재에 오른다**(목이 그것을 202로 받는다).
   */
  it('창이 열린 사이에 사유가 비면 보내지 않는다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([approvalSubmitRoute(RESUBMIT_APPROVAL_PATH), notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    await screen.findByRole('region', { name: t.resubmit.label });
    await user.type(screen.getByLabelText(t.formFields.submitReason), '이어서 상신');
    await user.click(resubmitButton());

    /* 창 뒤의 칸을 비운다 — 창은 그 사실을 모른다. */
    fireEvent.change(screen.getByLabelText(t.formFields.submitReason), {
      target: { value: '   ' },
    });
    await confirmSubmit(user);

    expect(writesTo(requests, RESUBMIT_APPROVAL_PATH)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(t.errors.reasonRequired)).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 상신 성공 뒤 무효화', () => {
  /**
   * **상신 성공 뒤 이력 목록·출고 상세가 다시 불린다**(완료 조건 C65 · 감지기 M59).
   *
   * 상신 응답에 `ETag`가 **없어**(실측) 상세를 다시 부르지 않으면 다음 쓰기가 **낡은 토큰**으로
   * 나가 409로 막힌다. 목록도 함께 부르는 이유는 그 전표의 상태가 달라지기 때문이다 —
   * 한쪽만 부르면 **갱신된 값과 낡은 값이 한 화면에 섞인다**(W-01-07의 Major 지적).
   *
   * **서 있는 조회로 잰다.** 무효화는 그 조회에 옵저버가 붙어 있을 때 재조회로 나타나므로,
   * 이력 탭에서 재상신해 목록·상세가 **화면에 선 채로** 다시 불리는지 본다 — 캐시 안쪽을
   * 들여다보는 대신 요청 수로 잰다.
   */
  it('재상신에 성공하면 이력 목록과 그 전표의 상세를 다시 부른다', async () => {
    let submitted = false;

    const { requests, user } = renderScreen(
      allRoutes([
        {
          match: (request) => isPost(request, RESUBMIT_APPROVAL_PATH),
          respond: () => {
            submitted = true;

            return jsonResponse({ approvalRequestId: 9523 }, { status: 202 });
          },
        },
        {
          /* **상신 뒤에는 서버가 승인 요청 값을 실어 준다** — 그 사실이 화면에 오는 길이 재조회다. */
          match: (request) => isGet(request, MISSING_ISSUE_DETAIL_PATH),
          respond: () =>
            jsonResponse(
              issueDetailBody(goodsIssueLineResponseFixtures, {
                ...goodsIssueResponseFixtures[1],
                ...(submitted ? { approvalRequestId: 9523 } : {}),
              }),
              { headers: { ETag: '"token-9502"' } },
            ),
        },
      ]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    await screen.findByRole('region', { name: t.resubmit.label });

    const beforeList = requestsTo(requests, ISSUES_PATH).length;
    const beforeDetail = requestsTo(requests, MISSING_ISSUE_DETAIL_PATH).length;

    await user.type(screen.getByLabelText(t.formFields.submitReason), '이어서 상신');
    await user.click(resubmitButton());
    await confirmSubmit(user);

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH).length).toBeGreaterThan(beforeList);
    });
    await waitFor(() => {
      expect(requestsTo(requests, MISSING_ISSUE_DETAIL_PATH).length).toBeGreaterThan(beforeDetail);
    });

    /* 다시 부른 상세가 실제로 화면을 바꾼다 — 「아직 승인을 요청하지 않았습니다」가 사라진다. */
    await waitFor(() => {
      expect(screen.queryByText(t.progress.notSubmittedTitle)).not.toBeInTheDocument();
    });
  });
});

describe('DisposalIssueScreen — 잠금이 닿지 않는 두 길', () => {
  /**
   * **둘째 겹을 첫째 겹에서 떼어내고 잰다**(감지기 M75).
   *
   * 눈에 보이는 컨트롤은 전송 중에 전부 잠기지만 **조건 칩의 ×는 잠기지 않는다** — 디자인
   * 시스템 `Chip`이 그 prop을 갖고 있지 않다(실측). 그 길로 들어오면 조건이 바뀌며 고른 전표가
   * 풀리고, 앞서 보낸 품의의 결과가 **다른 전표 맥락에** 나타난다. 막는 것은 **문 하나의 가드**다.
   */
  it('보내는 동안 조건 칩의 ×를 눌러도 주소가 바뀌지 않는다', async () => {
    const { user, release } = await setupReadyToSubmit(
      allRoutes(chainRoutes()),
      undefined,
      [ISSUES_PATH],
      '?gr=9001&q=GR',
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });

    const before = currentLocation();
    const chipRemove = screen.getByRole('button', { name: t.filters.chipRemoveQ });

    /* 첫째 겹이 없는 자리다 — 실제로 눌린다는 것을 짝으로 굳힌다. */
    expect(chipRemove).toBeEnabled();

    await user.click(chipRemove);

    expect(currentLocation()).toBe(before);

    release();
  });

  /**
   * **주소는 잠글 수 없다**(W-01-05 R3-1의 셋째 길). 뒤로가기·앞으로가기·주소 직접 편집은
   * 잠금도 가드도 거치지 않으므로, 그 길로 대상이 바뀐 뒤 도착한 실패는 **새 대상의 자리에
   * 서면 안 된다** — 매임 이름이 그것을 막는다(감지기 M76).
   *
   * **나가는 중인 쓰기는 끊지 않는다**(`resetIfIdle`) — 그래서 정리 effect가 지워 주기를
   * 기대할 수 없고, 판정이 **읽는 자리**에 있어야 한다.
   */
  it('보내는 동안 주소로 대상을 바꾸면 뒤늦게 온 실패가 서지 않는다', async () => {
    const { user, release } = await setupReadyToSubmit(
      allRoutes([
        failingCreateRoute(403),
        /* **새 대상의 구획이 실제로 서야** 「거기에 배너가 서지 않는다」를 잴 수 있다. */
        {
          match: (request) => isGet(request, MISSING_DETAIL_PATH),
          respond: () =>
            jsonResponse({
              goodsReceipt: goodsReceiptResponseFixtures[1],
              lines: receiptLineResponseFixtures,
            }),
        },
      ]),
      undefined,
      [ISSUES_PATH],
      '?gr=9001',
      '?gr=9002',
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });

    /* 화면 바깥에서 주소를 갈아 끼운다 — 잠금이 닿지 않는 길이다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    release();

    await waitFor(() => {
      expect(currentLocation()).toContain('gr=9002');
    });

    /*
     * 짝 방향 — 새 대상의 구획이 멀쩡히 서 있다(아무것도 안 그려서 통과한 것이 아니다).
     * **아래 구획 안에서 본다** — 같은 입고번호가 위 목록 표에도 있다.
     */
    await waitFor(() => {
      expect(within(linesPane()).getByText('GR-2026-900002')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(t.formFields.submitReason)).toBeInTheDocument();

    expect(screen.queryByText(messages.httpError.forbidden)).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 나가는 중인 연쇄는 끊지 않는다', () => {
  /**
   * **`omf-mes#96`의 자리**(감지기 M79).
   *
   * 공통 훅의 `reset()`은 진행 중 mutation에서 **옵저버를 떼어 낸다** — 그러면 그 호출에
   * 매달린 되먹임이 통째로 오지 않는다. 이 화면에서 그 피해는 특히 크다: 전표 생성의 성공이
   * 오지 않으면 **연쇄의 둘째 요청이 시작조차 하지 않아** 서버에는 전표가 남고 화면은 그
   * 사실을 영영 말하지 않는다 — 사용자가 볼 수 없는 미상신 전표가 조용히 쌓인다.
   *
   * 그래서 대상이 바뀌어도 **끊지 않고**, 도착한 결과를 **어느 자리에 낼지만** 매임 이름이 정한다.
   */
  it('보내는 동안 주소로 대상을 바꿔도 상신까지 이어진다', async () => {
    const { requests, user, release } = await setupReadyToSubmit(
      allRoutes([
        ...chainRoutes(),
        {
          match: (request) => isGet(request, MISSING_DETAIL_PATH),
          respond: () =>
            jsonResponse({
              goodsReceipt: goodsReceiptResponseFixtures[1],
              lines: receiptLineResponseFixtures,
            }),
        },
      ]),
      undefined,
      [ISSUES_PATH],
      '?gr=9001',
      '?gr=9002',
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
    });

    /* 잠금이 닿지 않는 길로 대상을 바꾼다 — 이미 나간 요청은 그 길을 따라가지 않는다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    release();

    await waitFor(() => {
      expect(currentLocation()).toContain('gr=9002');
    });

    /* **연쇄가 끝까지 간다** — 전표만 만들어 놓고 멈추지 않는다. */
    await waitFor(() => {
      expect(writesTo(requests, CREATED_APPROVAL_PATH)).toHaveLength(1);
    });

    /* 그러나 결과는 **자기 대상의 자리에서만** 보인다(매임 이름). */
    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 창은 자기 맥락보다 오래 살지 않는다', () => {
  /**
   * **감추는 것과 상태를 내리는 것은 다른 일이다**(수명 표 8행).
   *
   * 탭을 옮기면 창이 그려지지 않지만, 열림 상태가 선 채 남으면 돌아왔을 때 **누른 적 없는
   * 확인 창**이 떠 있다 — 되돌릴 수 없는 조작의 확인이 저절로 되살아나는 것이다.
   */
  it('탭을 옮겼다 돌아와도 확인 창이 다시 뜨지 않는다', async () => {
    const { user } = await setupReadyToSubmit(
      allRoutes(chainRoutes()),
      undefined,
      [],
      '?gr=9001',
      '?tab=history&gr=9001',
    );

    await openSubmitConfirm(user);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    /*
     * **주소로 탭을 옮긴다.** 창이 열려 있는 동안 화면의 컨트롤은 스크림 뒤에 있어 눌리지
     * 않는다 — 뒤로가기·주소 직접 편집은 그 스크림을 지나지 않는 길이라 이 잣대가 그 길을 쓴다.
     */
    fireEvent.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).toContain('tab=history');
    });

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('tab=history');
    });
    await waitForLines();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 열린 창이 갱신에 닫히지 않는다', () => {
  /**
   * **`omf-mes#43`의 창 쪽 자리.** 창을 거두는 규칙의 잣대를 **응답 객체**에 매달면, 「다시
   * 조회」 한 번에 — 사용자가 아무것도 누르지 않았는데 — **확인 창이 사라진다.** 그때 사용자는
   * 자기가 무엇을 눌러 창이 닫혔는지 되짚을 수 없다.
   *
   * 상세를 부를 때마다 **내용이 달라지는** 스텁을 쓴다 — 같은 본문이면 캐시가 참조를 그대로
   * 유지해 이 결함이 드러나지 않는다.
   */
  it('상세가 다시 도착해도 확인 창이 열려 있다', async () => {
    const { user } = await setupReadyToSubmit(allRoutes([...chainRoutes(), changingDetailRoute()]));

    await openSubmitConfirm(user);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    /* 창이 열려 있는 동안 화면의 버튼은 스크림 뒤에 있다 — 갱신만 일으키고 창은 건드리지 않는다. */
    fireEvent.click(screen.getByRole('button', { name: t.actions.refresh }));

    /*
     * **둘째 응답의 값을 기다린다.** 첫 응답의 값(`09:11`)은 초기 적재로 이미 서 있어,
     * 그것을 기다리면 재조회가 닿기도 전에 대기가 풀린다 — 잣대가 아무것도 재지 않는다
     * (검증 t4 문제 4). 갱신이 **실제로 화면에 닿은 뒤** 창을 본다.
     */
    await waitFor(() => {
      expect(within(linesPane()).getByText('2026-08-06 09:12')).toBeInTheDocument();
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

/**
 * 서버가 **필드에 매긴** 400. `scope: 'field'`인 항목은 그 이름의 칸이 화면에 있을 때
 * **인라인**으로 서고 배너에는 남지 않는다(공통 쓰기 훅의 분해 규칙).
 */
const fieldErrorBody = (field: string, message: string) => ({
  errors: [{ scope: 'field', field, code: 'SAMPLE_INVALID', message }],
});

const SAMPLE_ISSUED_AT_ERROR = '출고 일시가 영업일과 맞지 않습니다';
const SAMPLE_REASON_ERROR = '사유가 결재선 규칙에 맞지 않습니다';

describe('DisposalIssueScreen — 400이 필드에 매겨져 올 때', () => {
  /**
   * **화면이 아는 이름의 오류는 그 칸 옆에 선다**(완료 조건 C66의 「400 필드」 갈래).
   *
   * 배너로만 내면 사용자는 **어느 칸을 고쳐야 하는지** 읽을 수 없다 — 폼에 칸이 여덟이라
   * 「출고 일시가 …」 한 줄이 위에 떠 있어도 어디를 손댈지 알 수 없다.
   */
  it('등록 400의 필드 오류가 그 칸 옆에 서고 배너로 새지 않는다', async () => {
    const { user } = await setupReadyToSubmit(
      allRoutes([failingCreateRoute(400, fieldErrorBody('issuedAt', SAMPLE_ISSUED_AT_ERROR))]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(SAMPLE_ISSUED_AT_ERROR);

    /* 그 칸이 자기 오류를 가리킨다 — 글자만 어딘가에 있는 것과 다르다. */
    expect(screen.getByLabelText(t.formFields.issuedDate)).toHaveAccessibleDescription(
      SAMPLE_ISSUED_AT_ERROR,
    );
    /* 짝 방향 — 같은 문장이 배너로 한 번 더 서지 않는다(인라인으로 소화됐다). */
    expect(screen.getAllByText(SAMPLE_ISSUED_AT_ERROR)).toHaveLength(1);
    expect(screen.queryByText(messages.httpError.description)).not.toBeInTheDocument();
  });

  /**
   * **상신 400의 사유 오류는 상신 사유 칸에 선다.** 폐기 사유 코드(`reasonCode`)와 상신 사유
   * (`reason`)가 서로 다른 키라 두 칸이 섞이지 않는 것도 여기서 함께 재진다.
   */
  it('상신 400의 사유 오류가 상신 사유 칸에 선다', async () => {
    const { user } = await setupReadyToSubmit(
      allRoutes([
        createRoute(),
        createdDetailRoute(),
        failingApprovalSubmitRoute(400, fieldErrorBody('reason', SAMPLE_REASON_ERROR)),
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(SAMPLE_REASON_ERROR);

    expect(screen.getByLabelText(t.formFields.submitReason)).toHaveAccessibleDescription(
      expect.stringContaining(SAMPLE_REASON_ERROR),
    );
    /* 폐기 사유 선택칸은 그 오류를 받지 않는다 — 서로 다른 계약 필드다. */
    expect(screen.getByLabelText(t.formFields.reason)).not.toHaveAccessibleDescription(
      expect.stringContaining(SAMPLE_REASON_ERROR),
    );
  });

  /**
   * **필드 오류만 오고 배너용 오류가 없는 400**이 이 자리의 요점이다(검증 t4 문제 2④).
   *
   * 그때 훅의 `error`는 `null`이라 배너를 보는 판정만으로는 **실패를 알아채지 못하고**,
   * 결과 구획이 「올리는 중」에 영영 머문다 — 전표는 만들어졌고 상신은 실패했는데 화면은
   * 진행 중이라고 말한다. 실패의 채널이 둘이라 **둘을 함께 봐야** 한다.
   */
  it('필드 오류만 온 상신 400에서도 부분 실패라고 말한다', async () => {
    const { user } = await setupReadyToSubmit(
      allRoutes([
        createRoute(),
        createdDetailRoute(),
        failingApprovalSubmitRoute(400, fieldErrorBody('reason', SAMPLE_REASON_ERROR)),
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(t.result.partialTitle('GI-2026-950004'));

    expect(within(resultPane()).getByText(t.result.partialDescription)).toBeInTheDocument();
    /* 짝 방향 — 「올리는 중」에 머물지 않는다. */
    expect(within(resultPane()).queryByText(t.result.submitting)).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 재상신의 실패 갈래', () => {
  const setupResubmit = async (extra: StubRoute[]): Promise<ReturnType<typeof renderScreen>> => {
    const rendered = renderScreen(
      allRoutes([...extra, notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    await screen.findByRole('region', { name: t.resubmit.label });
    await rendered.user.type(screen.getByLabelText(t.formFields.submitReason), '이어서 상신');
    await rendered.user.click(resubmitButton());
    await confirmSubmit(rendered.user);

    return rendered;
  };

  /**
   * **결재선이 없으면 400이다**(계약 명시 · 승인 기록 정정 1-5). 그 400이 실제로 닿는 자리가
   * 여기이며, 화면은 **원인을 지어내지 않고 서버 문구를 그대로** 낸다 — 코드로 갈라 「결재선이
   * 없습니다」를 덧붙이면 다른 이유로 온 400에도 같은 안내가 붙는다.
   */
  it('400의 서버 문구를 그대로 내고 사유 입력이 남는다', async () => {
    await setupResubmit([
      failingApprovalSubmitRoute(
        400,
        { message: '결재선이 설정되지 않았습니다' },
        RESUBMIT_APPROVAL_PATH,
      ),
    ]);

    await screen.findByText('결재선이 설정되지 않았습니다');

    expect(screen.getByLabelText(t.formFields.submitReason)).toHaveValue('이어서 상신');
  });

  it('403은 권한 문구를 내고 최신 불러오기를 붙이지 않는다', async () => {
    await setupResubmit([failingApprovalSubmitRoute(403, { message: '' }, RESUBMIT_APPROVAL_PATH)]);

    await screen.findByText(messages.httpError.forbidden);

    expect(
      screen.queryByRole('button', { name: messages.conflict.reloadAction }),
    ).not.toBeInTheDocument();
  });

  /** **409에만 「최신 불러오기」가 붙는다** — 다시 읽어 풀리는 것은 충돌뿐이다. */
  it('409에는 최신 불러오기가 붙고 누르면 상세를 다시 부른다', async () => {
    const { requests, user } = await setupResubmit([
      failingApprovalSubmitRoute(
        409,
        { conflictCause: 'user', message: '' },
        RESUBMIT_APPROVAL_PATH,
      ),
    ]);

    await screen.findByText(messages.conflict.user);

    const before = requestsTo(requests, MISSING_ISSUE_DETAIL_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

    await waitFor(() => {
      expect(requestsTo(requests, MISSING_ISSUE_DETAIL_PATH).length).toBeGreaterThan(before);
    });
  });

  /** **네트워크 갈래에만** 확인 안내를 낸다 — 확인 없이 다시 보내면 결재 요청이 두 벌이 된다. */
  it('네트워크 끊김에만 「전달됐는지 확인할 수 없습니다」가 붙는다', async () => {
    await setupResubmit([
      {
        match: (request) => isPost(request, RESUBMIT_APPROVAL_PATH),
        respond: () => {
          throw new TypeError('network down');
        },
      },
    ]);

    await screen.findByText(t.notes.submitRecheck);
  });
});

describe('DisposalIssueScreen — 「최신 불러오기」가 실제로 다시 읽는다', () => {
  /**
   * **409 뒤의 길**(완료 조건 C65 후반 · 검증 t4 문제 1).
   *
   * 상신이 409로 막히면 낡은 것은 **그 전표의 잠금 토큰**이다 — 「최신 불러오기」는 **그
   * 자리에서** 출고 상세를 다시 읽어야 한다. 탭을 옮기면 그 조회가 새로 마운트돼 어차피 새
   * 토큰이 오므로, **탭을 옮기지 않고** 요청 수로 잰다: 버튼이 무동작이면 이 잣대가 죽는다.
   */
  it('버튼을 누르면 그 자리에서 출고 상세를 다시 부른다', async () => {
    const { requests, user } = await setupReadyToSubmit(
      allRoutes([
        createRoute(),
        rotatingCreatedDetailRoute(),
        failingApprovalSubmitRoute(409, { conflictCause: 'user', message: '' }),
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(messages.conflict.user);

    const before = requestsTo(requests, CREATED_DETAIL_PATH).length;

    expect(before).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

    await waitFor(() => {
      expect(requestsTo(requests, CREATED_DETAIL_PATH).length).toBe(before + 1);
    });

    /* 다시 읽은 토큰이 **새것**이다 — 그래야 이어서 상신할 때 409가 풀린다. */
    expect(currentLocation()).not.toContain('tab=history');
  });
});

describe('DisposalIssueScreen — 연쇄 가운데의 틈', () => {
  /**
   * **토큰을 얻는 사이에도 잠겨 있다**(잠금의 첫째 겹 · 검증 t4 문제 5①).
   *
   * 전표 생성과 상신 사이에 상세 조회가 하나 드는데, 그 사이에는 **두 쓰기 모두 「보내는 중」이
   * 아니다.** 그 틈을 덮지 않으면 잠금이 잠깐 풀려 사용자가 탭·목록·쪽으로 **대상을 바꿀 수
   * 있고**, 그때 이미 나간 연쇄의 결과가 다른 맥락에 도착한다.
   */
  it('토큰을 얻는 동안에도 탭과 조회가 잠겨 있다', async () => {
    const { requests, user, release } = await setupReadyToSubmit(
      allRoutes(chainRoutes()),
      undefined,
      [CREATED_DETAIL_PATH],
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    /* 전표는 이미 만들어졌고 상신은 아직 나가지 않았다 — 그 사이가 이 잣대의 자리다. */
    await waitFor(() => {
      expect(requestsTo(requests, CREATED_DETAIL_PATH)).toHaveLength(1);
    });

    expect(writesTo(requests, CREATED_APPROVAL_PATH)).toHaveLength(0);
    expect(screen.getByRole('tab', { name: t.tabs.history })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.refresh })).toBeDisabled();

    release();

    await waitFor(() => {
      expect(writesTo(requests, CREATED_APPROVAL_PATH)).toHaveLength(1);
    });
  });

  /**
   * **같은 연쇄를 두 번 보내지 않는다**(검증 t4 문제 5②).
   *
   * 앱은 엄격 모드로 그려져 개발 중에는 effect가 **두 번 발화한다.** 그 자리에서 보내는 것이
   * **되돌릴 수 없는 상신**이므로, 막지 않으면 같은 품의의 결재 요청이 두 벌 생긴다 — 멱등 키가
   * 호출마다 새로 만들어져(`omf-mes#55`) 서버도 재전송으로 보지 못한다.
   */
  it('엄격 모드의 이중 발화에도 상신이 1회다', async () => {
    const { requests, user } = await setupReadyToSubmit(
      allRoutes(chainRoutes()),
      undefined,
      [],
      '?gr=9001',
      '',
      true,
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(t.result.submittedTitle('GI-2026-950004'));

    expect(writesTo(requests, CREATED_APPROVAL_PATH)).toHaveLength(1);
    expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
  });
});

describe('DisposalIssueScreen — 버릴 것이 있는가', () => {
  /**
   * **두 초안을 함께 본다**(이월 항목 `hasAnyLineDraftValue`의 소비 · 검증 t4 문제 5③).
   *
   * 줄만 골랐을 때 「입력 지우기」가 잠기면 **골라 둔 줄과 친 수량이 확인 없이 남는다** —
   * 사용자는 지울 수단이 없다고 읽고, 그 상태로 다른 전표를 고르면 값이 말없이 사라진다.
   */
  it('줄만 골라도 「입력 지우기」가 열린다', async () => {
    const { user } = renderScreen(allRoutes(chainRoutes()), '?gr=9001');

    await waitForLines();

    const discard = screen.getByRole('button', { name: t.actions.discardDrafts });

    /* 짝 방향 — 아무것도 없을 때는 잠기고 사유가 붙는다. */
    expect(discard).toBeDisabled();
    expect(discard).toHaveAccessibleDescription(t.actionReasons.nothingToDiscard);

    await user.click(lineCheckbox(1));

    expect(screen.getByRole('button', { name: t.actions.discardDrafts })).toBeEnabled();
  });

  /** 품의 정보만 채워도 마찬가지다 — 어느 한쪽만 보면 나머지가 확인 없이 사라진다. */
  it('품의 정보만 채워도 「입력 지우기」가 열린다', async () => {
    const { user } = renderScreen(allRoutes(chainRoutes()), '?gr=9001');

    await waitForLines();
    await user.type(screen.getByLabelText(t.formFields.submitReason), '사유');

    expect(screen.getByRole('button', { name: t.actions.discardDrafts })).toBeEnabled();
  });
});

describe('DisposalIssueScreen — 복구 경로를 끝까지 밟은 뒤', () => {
  /**
   * **재상신에 성공하면 발의 자리도 그 사실을 따라간다**(리뷰 Major M1 · 수명 표 19행).
   *
   * 이 화면이 세운 규율의 반대 방향을 막는 자리다 — 「올라가지 않은 품의를 올라간 것으로
   * 말하지 않는다」의 짝으로, **올라간 품의를 올라가지 않은 것으로** 말해서도 안 된다.
   * 같은 전표를 가리키는 두 자리(발의의 결과 구획 · 이력의 결재 진행)가 서로 다른 사실을
   * 말하면 사용자는 재상신이 먹히지 않은 줄 알고 다른 길을 찾는다.
   */
  it('재상신 성공 뒤 발의 탭이 부분 실패라고 말하지 않는다', async () => {
    let submitCalls = 0;

    const { user } = await setupReadyToSubmit(
      allRoutes([
        createRoute(),
        createdDetailRoute(),
        {
          /* 첫 상신은 실패하고(부분 실패) 이어서 상신하는 둘째만 성공한다. */
          match: (request) => isPost(request, CREATED_APPROVAL_PATH),
          respond: () => {
            submitCalls += 1;

            return submitCalls === 1
              ? jsonResponse({ message: '' }, { status: 500 })
              : jsonResponse({ approvalRequestId: 9523 }, { status: 202 });
          },
        },
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(t.result.partialTitle('GI-2026-950004'));

    /* 복구 경로 — 「이 요청 열기」로 이력 탭에 가서 이어서 요청한다. */
    await user.click(screen.getByRole('button', { name: t.actions.openIssue }));
    await screen.findByRole('region', { name: t.resubmit.label });
    await user.type(screen.getByLabelText(t.formFields.submitReason), '이어서 상신');
    await user.click(resubmitButton());
    await confirmSubmit(user);

    await waitFor(() => {
      expect(screen.getByLabelText(t.formFields.submitReason)).toHaveValue('');
    });

    /* 발의 탭으로 돌아온다. */
    await user.click(screen.getByRole('tab', { name: t.tabs.disposal }));
    await waitForLines();

    /* 짝 방향 — 결과 구획은 서 있고(전표를 만든 사실은 남는다) 문면만 달라진다. */
    expect(
      within(resultPane()).getByText(t.result.submittedTitle('GI-2026-950004')),
    ).toBeInTheDocument();
    expect(screen.queryByText(t.result.partialTitle('GI-2026-950004'))).not.toBeInTheDocument();
    expect(screen.queryByText(t.result.partialDescription)).not.toBeInTheDocument();
    expect(screen.queryByText(t.result.notSubmittedYet)).not.toBeInTheDocument();
    /* 실패 배너도 함께 거둔다 — 그 실패는 뒤이은 상신으로 뜻을 잃었다. */
    expect(screen.queryByText(messages.httpError.description)).not.toBeInTheDocument();
  });

  /**
   * **다른 품의를 재상신해도 연쇄는 그대로다.** 매임 축이 전표이므로, 이력에서 **남의 전표**를
   * 올린 것으로 발의 자리의 사실이 달라지면 안 된다(범위 있는 규칙은 잣대도 같은 범위로).
   */
  it('다른 전표를 재상신하면 발의 자리의 부분 실패가 남는다', async () => {
    const { user } = await setupReadyToSubmit(
      allRoutes([
        createRoute(),
        createdDetailRoute(),
        failingApprovalSubmitRoute(500),
        approvalSubmitRoute(RESUBMIT_APPROVAL_PATH),
        notSubmittedDetailRoute(),
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(t.result.partialTitle('GI-2026-950004'));

    /* 이력 탭에서 **다른** 미상신 전표(9502)를 골라 올린다. */
    fireEvent.click(screen.getByRole('tab', { name: t.tabs.history }));
    await screen.findByText('GI-2026-950002');
    await user.click(
      screen.getByRole('button', { name: t.actions.selectIssueRow('GI-2026-950002') }),
    );
    await screen.findByRole('region', { name: t.resubmit.label });
    await user.type(screen.getByLabelText(t.formFields.submitReason), '다른 전표를 올린다');
    await user.click(resubmitButton());
    await confirmSubmit(user);

    await waitFor(() => {
      expect(screen.getByLabelText(t.formFields.submitReason)).toHaveValue('');
    });

    await user.click(screen.getByRole('tab', { name: t.tabs.disposal }));
    await waitForLines();

    expect(
      within(resultPane()).getByText(t.result.partialTitle('GI-2026-950004')),
    ).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 「최신 불러오기」가 실패할 때', () => {
  /**
   * **다시 읽기가 실패하면 화면이 그 사실을 말한다**(리뷰 Major M2).
   *
   * 이 버튼은 409를 푸는 유일한 길이다. 재조회가 실패했는데 아무 변화도 없으면 사용자에게는
   * 「눌러도 아무 일이 없다」로 나타나고, 거부가 아무도 받지 않은 채 떠돈다 — 짝인 연쇄 쪽
   * (`createWrite.onSuccess`)은 이미 같은 호출을 받아 두고 있다.
   */
  it('재조회가 실패하면 그 사실이 화면에 선다', async () => {
    let detailCalls = 0;

    const { user } = await setupReadyToSubmit(
      allRoutes([
        createRoute(),
        {
          /* 토큰은 한 번 주고, 「최신 불러오기」의 재조회에서 실패한다. */
          match: (request) => isGet(request, CREATED_DETAIL_PATH),
          respond: () => {
            detailCalls += 1;

            return detailCalls === 1
              ? jsonResponse(createdDetailBody(), { headers: { ETag: CREATED_DETAIL_ETAG } })
              : jsonResponse({ message: '' }, { status: 500 });
          },
        },
        failingApprovalSubmitRoute(409, { conflictCause: 'user', message: '' }),
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(messages.conflict.user);

    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

    await screen.findByText(t.notes.reloadFailed);
  });

  /** 성공하면 그 안내가 서지 않는다 — 짝 방향으로 굳힌다. */
  it('재조회에 성공하면 그 안내가 서지 않는다', async () => {
    const { user } = await setupReadyToSubmit(
      allRoutes([
        createRoute(),
        rotatingCreatedDetailRoute(),
        failingApprovalSubmitRoute(409, { conflictCause: 'user', message: '' }),
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(messages.conflict.user);

    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

    await waitFor(() => {
      expect(screen.getByText(messages.conflict.user)).toBeInTheDocument();
    });
    expect(screen.queryByText(t.notes.reloadFailed)).not.toBeInTheDocument();
  });

  /**
   * **「입력 지우기」가 그 안내를 함께 거둔다**(PR ④ 리뷰 N1 · 수명 표 23행).
   *
   * 파기는 앞서 한 시도를 **통째로 물리는 것**이라 결과 구획도 배너도 함께 사라지는데, 다시
   * 읽기 실패 안내만 남으면 화면이 **가리킬 전표조차 없는 상태에서** 「이어서 요청하세요」라고
   * 말한다. 새 상태를 수명 표에 올리지 않으면 정리하는 자리가 이렇게 하나씩 빠진다.
   */
  it('입력 지우기가 재조회 실패 안내를 함께 거둔다', async () => {
    let detailCalls = 0;

    const { user } = await setupReadyToSubmit(
      allRoutes([
        createRoute(),
        {
          match: (request) => isGet(request, CREATED_DETAIL_PATH),
          respond: () => {
            detailCalls += 1;

            return detailCalls === 1
              ? jsonResponse(createdDetailBody(), { headers: { ETag: CREATED_DETAIL_ETAG } })
              : jsonResponse({ message: '' }, { status: 500 });
          },
        },
        failingApprovalSubmitRoute(409, { conflictCause: 'user', message: '' }),
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);
    await screen.findByText(messages.conflict.user);

    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));
    await screen.findByText(t.notes.reloadFailed);

    /* 파기 버튼은 버릴 것이 있어야 열린다 — 성공 뒤 비워진 초안을 다시 채운다. */
    await fillDisposalForm(user);
    await user.click(screen.getByRole('button', { name: t.actions.discardDrafts }));
    await user.click(screen.getByRole('button', { name: t.actions.confirmDiscard }));

    await waitFor(() => {
      expect(screen.queryByText(t.notes.reloadFailed)).not.toBeInTheDocument();
    });
    /* 짝 방향 — 같은 조작이 결과 구획도 함께 거둔다(둘이 함께 사라져야 앞뒤가 맞는다). */
    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
  });

  /**
   * **보내기 직전 재판정에 막히면 앞 시도의 되먹임이 통째로 사라진다**(리뷰 Major B1·B2 ·
   * 수명 표 27행).
   *
   * 결과 구획·실패 배너·「최신 불러오기」·재조회 실패 안내는 **한 시도의 되먹임 한 벌**이다.
   * 한 벌 중 일부만 거두면 화면이 앞뒤가 안 맞는 말을 한다 — 특히 **가리킬 전표가 없어진
   * 충돌 배너**가 남으면, 그 배너의 「최신 불러오기」는 충돌한 출고 전표가 아니라 입고 축을
   * 다시 읽어 **눌러도 풀리지 않는 버튼**이 된다(이 파일이 `reloadRegisterTarget` 주석에
   * 스스로 금지 형태로 적어 둔 그것이다).
   *
   * 네 단언이 각각 다른 자리를 문다: 결과 구획(`chain`) · 배너(쓰기 훅의 오류 + 매임 이름) ·
   * 「최신 불러오기」(배너에 딸린 버튼) · 재조회 실패 안내(`hasReloadFailure`). **넷을 함께
   * 재야** 「한 벌로 거둔다」가 값으로 굳는다 — 셋만 재면 나머지 하나를 비우는 줄을 지워도
   * 아무도 울지 않는다.
   */
  it('창이 열린 사이 줄이 풀리면 배너·최신 불러오기·재조회 실패 안내가 함께 사라진다', async () => {
    let detailCalls = 0;

    const { requests, user } = await setupReadyToSubmit(
      allRoutes([
        createRoute(),
        {
          /* 토큰은 한 번 주고, 「최신 불러오기」의 재조회에서 실패한다. */
          match: (request) => isGet(request, CREATED_DETAIL_PATH),
          respond: () => {
            detailCalls += 1;

            return detailCalls === 1
              ? jsonResponse(createdDetailBody(), { headers: { ETag: CREATED_DETAIL_ETAG } })
              : jsonResponse({ message: '' }, { status: 500 });
          },
        },
        failingApprovalSubmitRoute(409, { conflictCause: 'user', message: '' }),
      ]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    /* 선행 양성 — 전표는 만들어졌고 상신이 409로 막혀 배너와 부분 실패 구획이 섰다. */
    await screen.findByText(messages.conflict.user);
    expect(screen.getByRole('region', { name: t.result.label })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));
    await screen.findByText(t.notes.reloadFailed);

    /* 두 번째 시도 — 등록 성공으로 비워진 초안을 다시 채운다(수명 표 17행). */
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '10');
    await fillDisposalForm(user);

    await openSubmitConfirm(user);
    await screen.findByRole('dialog');

    /* 창이 열린 사이에 줄이 풀린다 — 라인 표는 창 뒤에 그대로 살아 있다(수명 표 6행). */
    fireEvent.click(lineCheckbox(1));
    await confirmSubmit(user);

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
    });
    /* 배너와 그 배너에 딸린 버튼이 함께 사라진다 — 남으면 가리킬 전표가 없는 충돌이 된다. */
    expect(screen.queryByText(messages.conflict.user)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: messages.conflict.reloadAction }),
    ).not.toBeInTheDocument();
    /* 재조회 실패 안내도 같은 벌이다(인계 ①의 나머지 절반 · PR ④ 리뷰 N1과 같은 형태). */
    expect(screen.queryByText(t.notes.reloadFailed)).not.toBeInTheDocument();
    /* 짝 방향 — 되먹임이 사라진 것은 새 전표가 나가서가 아니다. 전표 생성은 한 번뿐이다. */
    expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
  });

  /**
   * **등록 실패의 배너도 같은 벌이다**(리뷰 Major B1의 짝 자리).
   *
   * 위 잣대는 **상신** 실패(409)의 배너를 잰다. 실패 배너는 등록 실패와 상신 실패가 **같은
   * 자리에 서므로**(`registerError = createWrite.error ?? chainSubmitWrite.error`), 한쪽만
   * 재면 다른 쪽 훅을 거두는 줄을 지워도 아무도 울지 않는다 — 두 훅을 각각 문다.
   *
   * 이 갈래에는 전표가 아예 없어 결과 구획이 서지 않는다(이미 잣대가 있다). 그래서 여기서
   * 재는 것은 **배너 하나**다.
   */
  it('등록이 실패한 뒤 창이 열린 사이 줄이 풀리면 그 배너도 사라진다', async () => {
    const { requests, user } = await setupReadyToSubmit(allRoutes([failingCreateRoute(403)]));

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    /* 선행 양성 — 등록이 막혀 배너가 섰다(전표가 없어 결과 구획은 서지 않는다). */
    await screen.findByText(messages.httpError.forbidden);

    /* 등록이 실패했으므로 초안은 그대로다(수명 표 18행) — 다시 채우지 않는다. */
    await openSubmitConfirm(user);
    await screen.findByRole('dialog');

    fireEvent.click(lineCheckbox(1));
    await confirmSubmit(user);

    await waitFor(() => {
      expect(screen.queryByText(messages.httpError.forbidden)).not.toBeInTheDocument();
    });
    /* 짝 방향 — 배너가 사라진 것은 새 요청이 나가서가 아니다. */
    expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
  });
});

describe('DisposalIssueScreen — 「이 요청 열기」도 잠금 안에 있다', () => {
  /**
   * **눌러도 아무 일이 없는 버튼을 두지 않는다**(리뷰 Nit C1 · 배치 규범 4).
   *
   * 상신이 나가는 동안 결과 구획은 이미 서 있는데, 그때 이 버튼을 누르면 문의 가드가 막아
   * 주소가 그대로다 — 화면의 다른 컨트롤은 전부 잠기고 사유가 붙는 자리에서 이 하나만
   * 규칙 밖이면 사용자는 화면을 고장으로 읽는다.
   */
  it('보내는 동안에는 잠기고 사유가 붙는다', async () => {
    const { user, release } = await setupReadyToSubmit(allRoutes(chainRoutes()), undefined, [
      CREATED_APPROVAL_PATH,
    ]);

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    const open = await screen.findByRole('button', { name: t.actions.openIssue });

    expect(open).toBeDisabled();
    expect(open).toHaveAccessibleDescription(t.actionReasons.openIssueLocked);

    release();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.openIssue })).toBeEnabled();
    });
  });
});

describe('DisposalIssueScreen — 떠난 뒤 돌아왔을 때', () => {
  /**
   * **결과는 자기 대상보다 오래 살지 않는다**(리뷰 Minor M3·T2의 짝).
   *
   * 전송 중 주소로 떠나면 연쇄는 끝까지 가지만(다른 잣대가 잰다) 그 결과는 **떠난 자리에도,
   * 돌아온 자리에도 서지 않는다** — 대상을 떠난 순간 그 사실은 화면에서 수명을 다했고 정리
   * effect가 거둔다. 만들어진 전표에 닿는 길은 주소의 `gi`와 「처리 이력」 탭이다.
   */
  /**
   * **나가는 중이면 매임을 지우지 않는다**(검증 t5 P1의 짝 — 발의 자리에도 같은 규율이 있다).
   *
   * 아래 잣대와 **방향이 반대다**: 저쪽은 「떠난 채로 끝났으면 서지 않는다」이고 이쪽은
   * 「**아직 나가는 중에 돌아오면 선다**」이다. 둘을 함께 두어야 정리자의 가드가 양쪽에서
   * 고정된다 — 가드를 지우면 이쪽만 무너지고, 가드를 「늘 지키기」로 넓히면 저쪽이 무너진다.
   *
   * 여기서 지켜지는 것은 **전표가 만들어졌다는 사실**이다. 매임이 지워지면 방금 만든 전표
   * 번호가 화면 어디에도 서지 않아, 사용자는 **전표가 생겼는지조차 알 수 없다.**
   */
  it('전송 중 떠났다가 돌아오면 만들어진 전표가 결과 구획에 선다', async () => {
    const { user, release } = await setupReadyToSubmit(
      allRoutes([
        ...chainRoutes(),
        {
          match: (request) => isGet(request, MISSING_DETAIL_PATH),
          respond: () =>
            jsonResponse({
              goodsReceipt: goodsReceiptResponseFixtures[1],
              lines: receiptLineResponseFixtures,
            }),
        },
      ]),
      undefined,
      /*
       * **둘째 요청을 붙잡는다.** 첫째 요청을 붙잡으면 그 사이 연쇄는 아직 `none`이라 지워도
       * 지워질 것이 없다 — **전표는 만들어졌고 상신이 나가는 중**인 국면이라야 「지키지 않으면
       * 무엇을 잃는가」가 실제로 드러난다.
       */
      [CREATED_APPROVAL_PATH],
      '?gr=9001',
      '?gr=9002',
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    /* 전표는 이미 만들어졌다 — 그 사실이 결과 구획에 서 있는 상태에서 떠난다. */
    await screen.findByText(t.result.createdTitle('GI-2026-950004'));

    /* 주소로 떠난다 — 잠금도 문의 가드도 거치지 않는 길이다. */
    fireEvent.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(currentLocation()).toContain('gr=9002');
    });

    /* **아직 나가는 중에** 되돌아온다 — 정리자가 여기서 한 번 더 돈다. */
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    await waitFor(() => {
      expect(currentLocation()).toContain('gr=9001');
    });
    await waitForLines();

    /* 돌아온 자리에 **전표가 만들어졌다는 사실이 그대로** 서 있다 — 아직 나가는 중이다. */
    expect(within(resultPane()).getByText('GI-2026-950004')).toBeInTheDocument();

    release();

    expect(
      await within(resultPane()).findByText(t.result.submittedTitle('GI-2026-950004')),
    ).toBeVisible();
  });

  it('전송 중 떠났다가 다시 고르면 결과 구획이 서지 않는다', async () => {
    const { requests, user, release } = await setupReadyToSubmit(
      allRoutes([
        ...chainRoutes(),
        {
          match: (request) => isGet(request, MISSING_DETAIL_PATH),
          respond: () =>
            jsonResponse({
              goodsReceipt: goodsReceiptResponseFixtures[1],
              lines: receiptLineResponseFixtures,
            }),
        },
      ]),
      undefined,
      [ISSUES_PATH],
      '?gr=9001',
      '?gr=9002',
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    release();

    await waitFor(() => {
      expect(writesTo(requests, CREATED_APPROVAL_PATH)).toHaveLength(1);
    });

    /* 앞 대상을 다시 고른다 — 그래도 결과는 되살아나지 않는다. */
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('GR-2026-900001') }));
    await waitForLines();

    expect(screen.queryByRole('region', { name: t.result.label })).not.toBeInTheDocument();
    /* 짝 방향 — 만들어진 품의는 주소에 남아 있어 이력에서 이어 다룰 수 있다. */
    expect(currentLocation()).toContain('gi=9504');
  });
});

/* ------------------------------------------------------------------------- *
 * 기타출고 처리 — 재고가 실제로 움직이는 자리(계획 결정 9·14·15)
 * ------------------------------------------------------------------------- */

/** 고른 품의(9501) 상세의 잠금 토큰. **전기의 `If-Match`가 여기서 온다.** */
const ISSUE_DETAIL_ETAG = '"token-9501"';

/**
 * 처리할 수 있는 품의(9501)의 상세 — **상신됐고 아직 전기되지 않았다.**
 *
 * 기본 픽스처는 한 줄이 이미 전기된 전표라 「이미 전기된 줄이 있습니다」 갈래에 걸린다.
 * 처리의 정상 경로를 재는 자리에서는 그 갈래를 빼고 본다 — **토큰은 함께 준다**(계약 실측).
 */
const postableIssueLines = goodsIssueLineResponseFixtures.map((line) => ({
  ...line,
  inventoryTransactionLineId: null,
}));

const postableDetailRoute = (etag = ISSUE_DETAIL_ETAG): StubRoute => ({
  match: (request) => isGet(request, ISSUE_DETAIL_PATH),
  respond: () => jsonResponse(issueDetailBody(postableIssueLines), { headers: { ETag: etag } }),
});

/** 줄 둘의 단위를 맞춘 상세 — 확인 창의 **합계 수량**을 실제 값으로 재는 자리다. */
const sameUomDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, ISSUE_DETAIL_PATH),
  respond: () =>
    jsonResponse(issueDetailBody(postableIssueLines.map((line) => ({ ...line, uomId: 9801 }))), {
      headers: { ETag: ISSUE_DETAIL_ETAG },
    }),
});

/**
 * 전기 200. **응답이 헤더만이고 `ETag`가 없다**(실측) — 성공 뒤 뿌리를 무효화해야 하는 근거다.
 *
 * **상태 코드가 전기 전과 같다.** 목이 전기 뒤에도 초안 상태를 그대로 주는 것이 실측됐고
 * (계획 §5.4-20), 화면이 그 값으로 「전기 완료」를 판정하면 **그 자리에서 거짓말**이 된다.
 */
const postRoute = (issue: unknown = goodsIssueResponseFixtures[0]): StubRoute => ({
  match: (request) => isPost(request, POST_PATH),
  respond: () => jsonResponse(issue),
});

const failingPostRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isPost(request, POST_PATH),
  respond: () => jsonResponse(body, { status }),
});

const postButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.postIssue });

const confirmPost = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.confirmPost }));
};

/**
 * 낡은 것으로 표시된 잔액 조회의 수.
 *
 * 잔액은 「폐기 요청」 탭의 조회라 처리 순간에는 옵저버가 없다 — 요청 수로는 무효화를 잴 수
 * 없어 **캐시가 낡은 것으로 표시됐는가**로 잰다.
 */
const invalidatedBalanceCount = (queryClient: QueryClient): number =>
  queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.queryKey[0] === balanceKeys.all[0])
    .filter((query) => query.state.isInvalidated).length;

/** 처리할 수 있는 품의를 고른 상태까지 간다. **자리표시는 건드리지 않는다** — 지금의 화면이다. */
const setupReadyToPost = async (
  routes: StubRoute[] = allRoutes([postableDetailRoute(), postRoute()]),
  search = `${HISTORY_SEARCH}&gi=9501`,
  navigateTo = '',
  hold: string[] = [],
): Promise<ReturnType<typeof renderScreen>> => {
  const rendered = renderScreen(routes, search, navigateTo, hold);

  await screen.findByRole('region', { name: t.post.label });

  return rendered;
};

describe('DisposalIssueScreen — 기타출고 처리가 열리는 조건', () => {
  /**
   * **잠그지 않고 밝힌다**(승인 기록 §13-2 안 1 · 완료 조건 C67). 승인 완료를 뜻하는 상태
   * 코드가 확정되지 않아 화면이 판정할 근거가 없다 — 잠그면 승인된 건까지 막혀 화면이 통째로
   * 무용해지고, 막는 것은 서버다.
   */
  it('상신된 품의에서 버튼이 열려 있고 판정하지 못한다는 사실이 보인다', async () => {
    await setupReadyToPost();

    expect(postButton()).toBeEnabled();
    expect(screen.getByText(t.post.unjudgeableNote)).toBeVisible();
  });

  /**
   * **《처리하면 일어나는 일》 세 문장이 상시 자리에 있다**(완료 조건 C68 · 감지기 M66).
   * 버튼이 열려 있든 잠겨 있든 같은 자리에 선다.
   */
  it('세 문장이 버튼 위 상시 자리에 있다', async () => {
    await setupReadyToPost();

    const pane = screen.getByRole('region', { name: t.post.label });

    expect(within(pane).getByText(t.post.effectDeducts)).toBeVisible();
    expect(within(pane).getByText(t.post.effectApprovalIsNotPosting)).toBeVisible();
    expect(within(pane).getByText(t.post.effectNoUndoHere)).toBeVisible();
  });

  /**
   * **미상신 전표는 잠근다**(완료 조건 C69 · 감지기 M65) — 승인 요청 값이 없다는 것은 승인이
   * 있을 수 없다는 뜻이고, 그것은 화면이 값 유무로 확실히 아는 사실이다. **구획은 선다** —
   * 감추면 「왜 여기서는 처리할 수 없는가」에 화면이 답하지 못한다.
   */
  it('미상신 품의에서는 잠기고 사유가 버튼 옆에서 읽힌다', async () => {
    await setupReadyToPost(allRoutes([notSubmittedDetailRoute()]), `${HISTORY_SEARCH}&gi=9502`);

    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNeedsSubmission);
    /* 짝 방향 — 잠겨 있어도 세 문장은 그대로 보인다. */
    expect(screen.getByText(t.post.effectDeducts)).toBeVisible();
  });

  /** 잠긴 버튼을 눌러도 창이 열리지 않고 요청도 나가지 않는다(첫째 겹). */
  it('잠긴 버튼을 눌러도 창이 열리지 않고 요청이 0회다', async () => {
    const { requests, user } = await setupReadyToPost(
      allRoutes([notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    await user.click(postButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writesTo(requests, MISSING_POST_PATH)).toHaveLength(0);
  });

  /**
   * **전환 감지기**(완료 조건 C67 · 감지기 M64). 자리표시를 채우면 **승인 전 전표가 잠기고**
   * 판정 불가 안내가 사라진다 — 채웠을 때 살아나는 것을 재지 않으면 그 자리표시는 죽은 가지다.
   */
  it('자리표시를 채우면 승인 전 전표에서 잠기고 안내가 사라진다', async () => {
    approvedStatusCodes.push('SAMPLE_AP_STATUS_OTHER');

    await setupReadyToPost();

    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNotApproved);
    expect(screen.queryByText(t.post.unjudgeableNote)).not.toBeInTheDocument();
  });

  /** 짝 방향 — 자리표시를 채우고 그 요청이 승인 상태면 열린다. 잠금이 상수로 굳지 않았다. */
  it('자리표시를 채우고 승인됐으면 열린다', async () => {
    fillApprovedStatusCodes();

    await setupReadyToPost();

    expect(postButton()).toBeEnabled();
    expect(screen.queryByText(t.post.unjudgeableNote)).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 처리도 확인 창을 지나야 나간다', () => {
  /** **확인 전에는 요청이 나가지 않는다**(완료 조건 C70) — 재고를 움직이는 조작이다. */
  it('버튼을 눌러도 창만 열리고 요청이 0회다', async () => {
    const { requests, user } = await setupReadyToPost();

    await user.click(postButton());

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(writesTo(requests, POST_PATH)).toHaveLength(0);
  });

  /**
   * **창이 전표 요약과 화면이 확인하지 못한 것을 함께 보인다**(완료 조건 C71 · 감지기 M68).
   * 사유 첫 줄은 **결재 진행에서 읽은 값**이다.
   */
  it('창이 전표 번호·줄 수·합계 수량·사유 첫 줄과 두 사실을 보인다', async () => {
    const { user } = await setupReadyToPost(allRoutes([sameUomDetailRoute(), postRoute()]));

    await user.click(postButton());

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('GI-2026-950001')).toBeVisible();
    expect(within(dialog).getByText(t.dialog.lineCount(2))).toBeVisible();
    expect(within(dialog).getByText(`45 ${UOM_LABEL}`)).toBeVisible();
    expect(within(dialog).getByText('합성 폐기 사유 첫 줄')).toBeVisible();
    expect(within(dialog).getByText(t.dialog.postDeducts)).toBeVisible();
    expect(within(dialog).getByText(t.dialog.postNoUndo)).toBeVisible();
    /* 자리표시가 비어 있으므로 판정하지 못했다는 사실이 함께 선다. */
    expect(within(dialog).getByText(t.dialog.postJudgePending)).toBeVisible();
  });

  /** **창 안에 선택칸이 없다**(완료 조건 C79 · `omf-mes#45`). */
  it('창 안에 선택칸이 없다', async () => {
    const { user } = await setupReadyToPost();

    await user.click(postButton());

    expect(within(screen.getByRole('dialog')).queryAllByRole('combobox')).toHaveLength(0);
  });

  /**
   * **이미 전기된 줄이 있으면 그 사실이 창에 선다.** 값 유무로 판정하며(상태 코드가 아니다)
   * 막지는 않는다 — 막는 것은 서버이고, 화면은 **한 번 더 움직일 수 있다**는 사실을 밝힌다.
   */
  it('이미 전기된 줄이 있는 전표에서는 그 사실이 창에 선다', async () => {
    const { user } = await setupReadyToPost(allRoutes([postRoute()]));

    await user.click(postButton());

    expect(within(screen.getByRole('dialog')).getByText(t.dialog.postAlreadyPosted)).toBeVisible();
  });

  /** 짝 방향 — 전기 전 전표에는 그 문장이 없다. */
  it('전기 전 전표에는 그 문장이 없다', async () => {
    const { user } = await setupReadyToPost();

    await user.click(postButton());

    expect(screen.queryByText(t.dialog.postAlreadyPosted)).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 전기가 실제로 보내는 것', () => {
  /**
   * **본문이 영업일과 발생 시각 둘뿐이고**(완료 조건 C72 · 감지기 M71) 영업일은 **그 전표의
   * 출고 일시**에서 나온다 — 실행 시각의 날짜를 쓰면 어제 낸 전표가 오늘 자로 원장에 잡힌다.
   */
  it('본문이 영업일과 발생 시각 둘이고 영업일이 출고 일시의 날짜다', async () => {
    const { requests, user } = await setupReadyToPost();

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(writesTo(requests, POST_PATH)).toHaveLength(1);
    });

    const sent = writesTo(requests, POST_PATH)[0];
    const body = sent?.body as { businessDate: string; occurredAt: string };

    expect(Object.keys(body).sort()).toEqual(['businessDate', 'occurredAt']);
    /* 픽스처 9501의 출고 일시는 2026-08-08이다 — 실행 시각과 무관하다. */
    expect(body.businessDate).toBe('2026-08-08');
    expect(body.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  /**
   * **`If-Match`가 출고 상세 경로에서 온다**(완료 조건 C73 · 감지기 M58과 같은 형태).
   * 컬렉션 경로를 주면 목록 조회와 열쇠가 겹치고, 액션 경로를 주면 토큰이 비어 요청이
   * 나가지 않는다.
   */
  it('잠금 토큰이 그 전표의 상세 경로에서 오고 멱등 키가 uuid다', async () => {
    const { requests, user } = await setupReadyToPost();

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(writesTo(requests, POST_PATH)).toHaveLength(1);
    });

    const sent = writesTo(requests, POST_PATH)[0];

    expect(sent?.headers.get('If-Match')).toBe(ISSUE_DETAIL_ETAG);
    expect(sent?.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  /** 예상 밖 경로로 나간 요청이 하나도 없다 — 경로마다 세는 단언이 보지 못하는 자리다. */
  it('예상 밖 경로로 요청이 나가지 않는다', async () => {
    const { requests, user, queryClient } = await setupReadyToPost();

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(writesTo(requests, POST_PATH)).toHaveLength(1);
    });

    expectNoUnknownPath(requests);
    expectNoFailedQuery(queryClient);
  });
});

describe('DisposalIssueScreen — 처리 성공 뒤', () => {
  /**
   * **결과 구획이 서버가 준 값만 말한다**(완료 조건 C74 · 계획 결정 15). ERP는 **「대기열에
   * 적재됨」**이고 「전송됨」이 아니다 — 계약이 그 둘을 갈라 못 박았다.
   */
  it('결과 구획이 서버 상태 코드와 ERP 적재를 말한다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([
        postableDetailRoute(),
        postRoute({ ...goodsIssueResponseFixtures[0], statusCode: 'SAMPLE_GI_STATUS_Z' }),
      ]),
    );

    await user.click(postButton());
    await confirmPost(user);

    const pane = await screen.findByRole('region', { name: t.result.postLabel });

    expect(within(pane).getByText(t.result.postedTitle('GI-2026-950001'))).toBeVisible();
    expect(within(pane).getByText('SAMPLE_GI_STATUS_Z')).toBeVisible();
    expect(within(pane).getByText(t.values.erpQueued)).toBeVisible();
    expect(pane.textContent ?? '').not.toContain('전송');
  });

  /**
   * **상태 코드로 「전기됨」을 판정하지 않는다**(계획 §5.4-20 · 결정 7). 목이 전기 200에도
   * 초안 상태를 그대로 주므로, 값이 그대로여도 화면은 **200을 받았다는 사실**로 결과를 낸다.
   */
  it('상태 코드가 전기 전과 같아도 처리했다고 말한다', async () => {
    const { user } = await setupReadyToPost();

    await user.click(postButton());
    await confirmPost(user);

    const pane = await screen.findByRole('region', { name: t.result.postLabel });

    /* 응답의 상태가 목록·상세와 같은 값이다 — 그래도 결과가 선다. */
    expect(within(pane).getByText('SAMPLE_GI_STATUS_A')).toBeVisible();
    expect(within(pane).getByText(t.result.postedTitle('GI-2026-950001'))).toBeVisible();
  });

  /**
   * **성공 뒤 이력 목록·출고 상세·승인 요청을 다시 부른다**(완료 조건 C74 · 감지기 M72).
   * 목록만 부르면 라인 표의 전기 표식과 결재 진행이 낡은 채로 남아 **갱신된 값과 낡은 값이
   * 한 화면에 섞인다.**
   */
  it('성공 뒤 이력 목록·상세·승인 요청을 다시 부른다', async () => {
    const { requests, user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute(), changingApprovalRoute()]),
    );

    const beforeList = requestsTo(requests, ISSUES_PATH).length;
    const beforeDetail = requestsTo(requests, ISSUE_DETAIL_PATH).length;
    const beforeApproval = requestsTo(requests, APPROVAL_DETAIL_PATH).length;

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH).length).toBeGreaterThan(beforeList);
    });
    await waitFor(() => {
      expect(requestsTo(requests, ISSUE_DETAIL_PATH).length).toBeGreaterThan(beforeDetail);
    });
    await waitFor(() => {
      expect(requestsTo(requests, APPROVAL_DETAIL_PATH).length).toBeGreaterThan(beforeApproval);
    });
  });

  /**
   * **다시 부른 상세가 화면의 진술을 뒤집는다**(리뷰 t5 M3). 무효화를 요청 수로만 재면
   * **두 끝이 따로 재어질 뿐** 이어지지 않는다 — 「다시 불렀다」와 「그래서 화면이 달라졌다」
   * 사이가 비어 있으면, 뿌리 하나를 잘못 겨눠도 요청 수는 그대로라 아무도 울지 않는다.
   *
   * 되돌릴 수 없는 쓰기의 **사후 상태**를 화면이 말하는 자리라(#127 Major의 축) 값이 있다:
   * 전기 뒤 상세가 **원장 라인 번호를 실어 오면** 라인 표의 표식이 「전기 전」에서 「전기됨」이
   * 되고, 결재 진행의 **「재고는 아직 차감되지 않았습니다」가 사라진다**(그 문장이 거짓이 됐다).
   *
   * 승인 자리표시를 채워 두는 이유는 그 안내가 **채워졌을 때만** 서기 때문이다 —
   * 두 방향(있다 → 없다)을 한 잣대에서 재려면 먼저 서 있어야 한다.
   */
  it('성공 뒤 다시 부른 상세가 전기 표식을 세우고 승인 뒤 안내를 거둔다', async () => {
    fillApprovedStatusCodes();

    let posted = false;

    const { user } = await setupReadyToPost(
      allRoutes([
        {
          /* **전기 전후로 다른 상세를 준다** — 전기됐다는 사실이 화면에 오는 길이 재조회다. */
          match: (request) => isGet(request, ISSUE_DETAIL_PATH),
          respond: () =>
            jsonResponse(
              issueDetailBody(
                posted
                  ? goodsIssueLineResponseFixtures.map((line, index) => ({
                      ...line,
                      inventoryTransactionLineId: 9541 + index,
                    }))
                  : postableIssueLines,
              ),
              { headers: { ETag: ISSUE_DETAIL_ETAG } },
            ),
        },
        {
          match: (request) => isPost(request, POST_PATH),
          respond: () => {
            posted = true;

            return jsonResponse(goodsIssueResponseFixtures[0]);
          },
        },
      ]),
    );

    /* 전기 전 — 표식은 「전기 전」이고 승인 뒤 안내가 서 있다. */
    const detailPane = historyDetailPane();

    expect(await within(detailPane).findByText(t.progress.approvedNotPostedNote)).toBeVisible();
    expect(within(detailPane).getAllByText(t.values.notPosted).length).toBe(
      goodsIssueLineResponseFixtures.length,
    );
    expect(within(detailPane).queryByText(t.values.posted)).not.toBeInTheDocument();

    await user.click(postButton());
    await confirmPost(user);
    await screen.findByRole('region', { name: t.result.postLabel });

    /* 전기 뒤 — 다시 부른 상세가 두 진술을 함께 뒤집는다. */
    await waitFor(() => {
      expect(within(historyDetailPane()).getAllByText(t.values.posted).length).toBe(
        goodsIssueLineResponseFixtures.length,
      );
    });
    await waitFor(() => {
      expect(
        within(historyDetailPane()).queryByText(t.progress.approvedNotPostedNote),
      ).not.toBeInTheDocument();
    });
    expect(within(historyDetailPane()).queryByText(t.values.notPosted)).not.toBeInTheDocument();
  });

  /**
   * **잔액도 함께 무효화한다** — 이 쓰기만 재고를 움직였다. 낡은 상한으로 다음 품의를 올리면
   * **이미 없어진 자재를 폐기하려 한다.**
   *
   * 잔액 조회는 「폐기 요청」 탭의 것이라 처리 순간에는 옵저버가 없다 — 요청 수로는 잴 수 없어
   * **캐시가 낡은 것으로 표시됐는가**로 잰다.
   */
  it('성공 뒤 잔액이 낡은 것으로 표시된다', async () => {
    const { user, queryClient } = renderScreen(
      allRoutes([postableDetailRoute(), postRoute()]),
      '?gr=9001',
    );

    await waitForLines();
    await openTab(user, t.tabs.history);
    await waitForIssueList();
    await selectIssue(user, 'GI-2026-950001');
    await screen.findByRole('region', { name: t.post.label });

    /* 짝 방향 — 처리 전에는 낡은 잔액이 하나도 없다. */
    expect(invalidatedBalanceCount(queryClient)).toBe(0);

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(invalidatedBalanceCount(queryClient)).toBeGreaterThan(0);
    });
  });

  /**
   * **세 문장을 사라지는 자리로 옮기지 않는다**(완료 조건 C68 · 감지기 M67). 성공 뒤에도
   * 상시 자리에 그대로 있고, 결과 구획에는 담기지 않는다.
   */
  it('성공 뒤에도 세 문장이 상시 자리에 있고 결과 구획에는 없다', async () => {
    const { user } = await setupReadyToPost();

    await user.click(postButton());
    await confirmPost(user);

    const result = await screen.findByRole('region', { name: t.result.postLabel });
    const pane = screen.getByRole('region', { name: t.post.label });

    expect(within(pane).getByText(t.post.effectDeducts)).toBeVisible();
    expect(result.textContent ?? '').not.toContain(t.post.effectDeducts);
    expect(result.textContent ?? '').not.toContain(t.post.effectNoUndoHere);
  });

  /** 성공 뒤 **주소도 탭도 바뀌지 않는다** — 방금 처리한 품의를 보던 자리가 사라지면 안 된다. */
  it('성공 뒤 주소가 그대로다', async () => {
    const { user } = await setupReadyToPost();

    const before = currentLocation();

    await user.click(postButton());
    await confirmPost(user);

    await screen.findByRole('region', { name: t.result.postLabel });

    expect(currentLocation()).toBe(before);
  });
});

describe('DisposalIssueScreen — 처리 전송 중 잠금', () => {
  /** **전송 중에는 컨트롤과 탭이 잠긴다**(완료 조건 C75 · 감지기 M74). */
  it('보내는 동안 버튼·목록·탭이 잠긴다', async () => {
    const { user, release } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute()]),
      `${HISTORY_SEARCH}&gi=9501`,
      '',
      [POST_PATH],
    );

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(postButton()).toBeDisabled();
    });

    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postLocked);
    expect(screen.getByRole('button', { name: t.actions.refresh })).toBeDisabled();
    expect(screen.getByRole('tab', { name: t.tabs.disposal })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    release();
  });

  /** **연타해도 요청은 1회**다 — 두 번 나가면 재고가 두 번 빠진다(`omf-mes#55`). */
  it('보내는 동안 연타해도 전기가 1회다', async () => {
    const { requests, user, release } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute()]),
      `${HISTORY_SEARCH}&gi=9501`,
      '',
      [POST_PATH],
    );

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(writesTo(requests, POST_PATH)).toHaveLength(1);
    });

    await user.click(postButton());

    /*
     * **확인 경로가 다시 열리지 않는다.** 버튼이 잠겼는지만 보면 첫째 겹이 풀렸을 때도 요청
     * 수는 그대로라 통과한다 — 창이 다시 열리면 확인 한 번으로 **재고가 두 번 빠진다.**
     */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writesTo(requests, POST_PATH)).toHaveLength(1);

    release();
  });

  /**
   * **둘째 겹을 첫째 겹에서 떼어내고 잰다**(감지기 M75).
   *
   * 눈에 보이는 컨트롤은 전송 중에 전부 잠기지만 **이력 조건 칩의 ×는 잠기지 않는다** —
   * 디자인 시스템 `Chip`이 그 prop을 갖고 있지 않다(실측). 그 길로 들어오면 조건이 바뀌며
   * 고른 품의가 풀리고, **나가는 중인 전기의 결과가 다른 품의 맥락에** 도착한다. 막는 것은
   * **문 하나의 가드**이며, 탭 잠금만 재면 그 가드를 지워도 아무 잣대가 물리지 않는다.
   */
  it('보내는 동안 이력 조건 칩의 ×를 눌러도 주소가 바뀌지 않는다', async () => {
    const { user, release } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute()]),
      `${HISTORY_SEARCH}&iq=GI&gi=9501`,
      '',
      [POST_PATH],
    );

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(postButton()).toBeDisabled();
    });

    const before = currentLocation();
    const chipRemove = screen.getByRole('button', { name: t.historyFilters.chipRemoveQ });

    /* 첫째 겹이 없는 자리다 — 실제로 눌린다는 것을 짝으로 굳힌다. */
    expect(chipRemove).toBeEnabled();

    await user.click(chipRemove);

    expect(currentLocation()).toBe(before);

    release();
  });

  /**
   * **전송 중에는 탭도 바뀌지 않는다**(첫째 겹). 탭이 바뀌면 보내는 자리가 화면에서 사라져
   * 도착한 되먹임이 설 곳을 잃는다.
   */
  it('보내는 동안 탭을 눌러도 주소가 바뀌지 않는다', async () => {
    const { user, release } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute()]),
      `${HISTORY_SEARCH}&gi=9501`,
      '',
      [POST_PATH],
    );

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(postButton()).toBeDisabled();
    });

    const before = currentLocation();

    await user.click(screen.getByRole('tab', { name: t.tabs.disposal }));

    expect(currentLocation()).toBe(before);

    release();
  });
});

describe('DisposalIssueScreen — 처리 창과 결과의 수명', () => {
  /**
   * **창은 자기 대상보다 오래 살지 않는다**(완료 조건 C76). 주소로 대상이 바뀌면 창이 닫히고
   * 요청은 나가지 않는다 — 뒤로가기·주소 편집은 클릭 핸들러를 거치지 않는다.
   */
  it('창이 열린 채 주소로 품의가 바뀌면 창이 닫히고 요청이 0회다', async () => {
    /*
     * **두 품의의 상세를 미리 받아 둔다.** 새 품의의 상세를 아직 못 받은 사이에는 아래 구획이
     * 통째로 사라져 창도 함께 사라지므로, 그 상태로 재면 **매임에 매인 정리**가 지워져도
     * 잣대가 통과한다 — 사용자가 두 품의를 오가는 흔한 경로가 바로 이 자리다.
     */
    const { requests, user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute(), notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9502`,
      `${HISTORY_SEARCH.slice(1)}&gi=9502`,
    );

    await screen.findByText(t.resubmit.lead);
    await selectIssue(user, 'GI-2026-950001');
    await waitFor(() => {
      expect(postButton()).toBeEnabled();
    });

    await user.click(postButton());

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    /* 짝 방향 — 새 품의의 구획이 **끊김 없이** 서 있다(상세가 캐시에 있다). */
    expect(screen.getByText(t.resubmit.lead)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(writesTo(requests, POST_PATH)).toHaveLength(0);
  });

  /**
   * **나가는 중인 쓰기는 끊지 않는다**(`omf-mes#96` · 감지기 M79). 전송 중 주소로 떠나도
   * 요청은 끝까지 가고 **무효화가 그대로 일어난다** — `reset()`으로 옵저버를 떼면 그 되먹임이
   * 통째로 오지 않는다.
   */
  it('전송 중 떠나도 무효화가 그대로 일어난다', async () => {
    const { requests, user, release } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute(), notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9501`,
      `${HISTORY_SEARCH.slice(1)}&gi=9502`,
      [POST_PATH],
    );

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(writesTo(requests, POST_PATH)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    const beforeList = requestsTo(requests, ISSUES_PATH).length;

    release();

    await waitFor(() => {
      expect(requestsTo(requests, ISSUES_PATH).length).toBeGreaterThan(beforeList);
    });
  });

  /**
   * **감추는 것과 상태를 내리는 것은 다른 일이다**(수명 표 8·25행).
   *
   * 탭을 옮기면 창이 그려지지 않지만, 열림 상태가 선 채 남으면 돌아왔을 때 **누른 적 없는
   * 확인 창**이 떠 있다 — 되돌릴 수 없는 조작 가운데 가장 무거운 것의 확인이 저절로
   * 되살아나는 것이다(전례 W-CO-09가 실측한 자리).
   */
  it('탭을 옮겼다 돌아와도 처리 확인 창이 다시 뜨지 않는다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute()]),
      `${HISTORY_SEARCH}&gi=9501`,
      '?gi=9501',
    );

    await user.click(postButton());

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    /*
     * **주소로 탭을 옮긴다.** 창이 열려 있는 동안 화면의 컨트롤은 스크림 뒤에 있어 눌리지
     * 않는다 — 뒤로가기·주소 직접 편집은 그 스크림을 지나지 않는 길이라 이 잣대가 그 길을 쓴다.
     */
    fireEvent.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('tab=history');
    });

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toContain('tab=history');
    });
    await screen.findByRole('region', { name: t.post.label });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /**
   * **나가는 중이면 매임을 지우지 않는다**(`omf-mes#96`의 짝 · 검증 t5 P1).
   *
   * 정리자는 「끝난 것만」 거둔다. 나가는 중인 전기의 매임까지 지우면 **도착한 결과가 어느
   * 품의의 것인지 가를 근거가 사라져**, 되돌릴 수 없는 조작의 결과가 **화면 어디에도 서지
   * 않는다** — 사용자는 재고가 움직였는지 화면에서 확인할 길을 잃는다.
   *
   * 주소로 떠났다가 **아직 나가는 중에** 돌아오는 길이 그 자리다 — 잠금도 문의 가드도 거치지
   * 않는 셋째 길이라 정리자가 두 번 도는데, 그때 가드가 없으면 매임이 통째로 지워진다.
   * 「떠난 채로 끝났으면 서지 않는다」(아래 잣대)와 **짝**이며 방향이 반대다.
   */
  it('전송 중 떠났다가 돌아오면 뒤늦게 온 결과가 선다', async () => {
    const { user, release } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute(), notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9501`,
      `${HISTORY_SEARCH.slice(1)}&gi=9502`,
      [POST_PATH],
    );

    await user.click(postButton());
    await confirmPost(user);
    await waitFor(() => {
      expect(postButton()).toBeDisabled();
    });

    /* 주소로 떠난다 — 잠금도 문의 가드도 거치지 않는 길이다. */
    fireEvent.click(screen.getByRole('button', { name: '주소 이동' }));
    await screen.findByText(t.resubmit.lead);

    /* **아직 나가는 중에** 되돌아온다 — 정리자가 여기서 한 번 더 돈다. */
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    await waitFor(() => {
      expect(currentLocation()).toContain('gi=9501');
    });

    release();

    expect(await screen.findByRole('region', { name: t.result.postLabel })).toBeVisible();
  });

  /**
   * **결과는 자기 대상보다 오래 살지 않는다.** 다른 품의를 고르면 앞 품의의 처리 결과가
   * 새 품의 아래 서지 않는다.
   */
  it('다른 품의를 고르면 처리 결과가 사라진다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute(), notSubmittedDetailRoute()]),
    );

    await user.click(postButton());
    await confirmPost(user);
    await screen.findByRole('region', { name: t.result.postLabel });

    await selectIssue(user, 'GI-2026-950002');

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: t.result.postLabel })).not.toBeInTheDocument();
    });
  });
});

describe('DisposalIssueScreen — 처리 실패의 갈래', () => {
  /**
   * **승인 전 전기의 400은 서버 문구를 그대로 낸다**(계획 결정 16 · §5.4-2). 코드로 분기해
   * 원인을 지어내면 다른 이유로 온 400에도 같은 안내가 붙는다.
   */
  it('400의 서버 문구가 배너에 그대로 선다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([
        postableDetailRoute(),
        failingPostRoute(400, {
          errors: [
            { scope: 'screen', code: 'STATE_LOCKED', message: '승인이 끝나야 처리할 수 있습니다.' },
          ],
        }),
      ]),
    );

    await user.click(postButton());
    await confirmPost(user);

    expect(await screen.findByText('승인이 끝나야 처리할 수 있습니다.')).toBeVisible();
    /* 결과 구획은 서지 않는다 — 실패를 성공처럼 말하지 않는다. */
    expect(screen.queryByRole('region', { name: t.result.postLabel })).not.toBeInTheDocument();
  });

  it('403은 권한 없음으로 갈린다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), failingPostRoute(403)]),
    );

    await user.click(postButton());
    await confirmPost(user);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeVisible();
    expect(screen.queryByText(t.notes.postRecheck)).not.toBeInTheDocument();
  });

  /**
   * **네트워크 갈래에만 확인 불가 안내를 낸다**(감지기 M73). 전 갈래에 내면 「응답을 받았고
   * 거절됐다」는 사실이 「전달됐는지 모른다」로 바뀐다.
   */
  it('네트워크 끊김에만 확인 불가 안내가 붙는다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([
        postableDetailRoute(),
        {
          match: (request) => isPost(request, POST_PATH),
          respond: () => {
            throw new TypeError('Failed to fetch');
          },
        },
      ]),
    );

    await user.click(postButton());
    await confirmPost(user);

    expect(await screen.findByText(t.notes.postRecheck)).toBeVisible();
  });

  /** **409에만 「최신 불러오기」가 붙고** 그 길이 실제로 상세를 다시 읽는다. */
  it('409 뒤 최신 불러오기가 상세를 다시 읽는다', async () => {
    const { requests, user } = await setupReadyToPost(
      allRoutes([
        postableDetailRoute(),
        failingPostRoute(409, { conflictCause: 'user', message: '' }),
      ]),
    );

    await user.click(postButton());
    await confirmPost(user);
    await screen.findByText(messages.conflict.user);

    const before = requestsTo(requests, ISSUE_DETAIL_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

    await waitFor(() => {
      expect(requestsTo(requests, ISSUE_DETAIL_PATH).length).toBeGreaterThan(before);
    });
  });

  /**
   * **앞의 성공이 새 시도의 실패 옆에 남지 않는다**(수명 표 22행). 처리한 뒤 다시 눌러
   * 거절당했는데 「처리했습니다」가 그대로 서 있으면, 사용자는 **무엇이 지금 상태인지**
   * 알 수 없다 — 되돌릴 수 없는 조작의 사후 상태에 대한 거짓 진술이 된다.
   */
  it('성공 뒤 다시 눌러 실패하면 앞의 결과 구획이 사라진다', async () => {
    let calls = 0;

    const { user } = await setupReadyToPost(
      allRoutes([
        postableDetailRoute(),
        {
          match: (request) => isPost(request, POST_PATH),
          respond: () => {
            calls += 1;

            return calls === 1
              ? jsonResponse(goodsIssueResponseFixtures[0])
              : jsonResponse({ message: '' }, { status: 403 });
          },
        },
      ]),
    );

    await user.click(postButton());
    await confirmPost(user);
    await screen.findByRole('region', { name: t.result.postLabel });

    await user.click(postButton());
    await confirmPost(user);
    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('region', { name: t.result.postLabel })).not.toBeInTheDocument();
  });

  /** 실패해도 **구획은 살아 있다** — 고친 뒤 다시 누를 수 있어야 한다. */
  it('실패 뒤에도 처리 버튼이 다시 열린다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), failingPostRoute(403)]),
    );

    await user.click(postButton());
    await confirmPost(user);
    await screen.findByText(messages.httpError.forbidden);

    expect(postButton()).toBeEnabled();
  });
});

describe('DisposalIssueScreen — 처리 배너의 매임', () => {
  /**
   * **자기 대상이 바뀌면 사라진다**(완료 조건 C77 · 감지기 M76). 품의 A의 실패가 품의 B의
   * 라인 표 아래 서면 사용자는 B도 막힌 것으로 읽는다.
   */
  it('다른 품의를 고르면 처리 실패 배너가 사라진다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), failingPostRoute(403), notSubmittedDetailRoute()]),
    );

    await user.click(postButton());
    await confirmPost(user);
    await screen.findByText(messages.httpError.forbidden);

    await selectIssue(user, 'GI-2026-950002');

    await waitFor(() => {
      expect(screen.queryByText(messages.httpError.forbidden)).not.toBeInTheDocument();
    });
  });

  /**
   * **다른 대상의 변경으로는 사라지지 않는다**(완료 조건 C77 · 감지기 M76). 두 배너를 한
   * 매임으로 묶으면 입고 전표를 바꿨을 때 이력 탭의 판정까지 사라진다 — 범위 있는 규칙은
   * 잣대도 같은 범위로.
   */
  it('입고 전표를 바꿔도 처리 실패 배너가 남는다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), failingPostRoute(403)]),
      `?gr=9001&${HISTORY_SEARCH.slice(1)}&gi=9501`,
    );

    await user.click(postButton());
    await confirmPost(user);
    await screen.findByText(messages.httpError.forbidden);

    await openTab(user, t.tabs.disposal);
    await waitForLines();
    await selectReceipt(user, 'GR-2026-900002');
    await openTab(user, t.tabs.history);

    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
  });

  /**
   * **주소는 잠글 수 없다**(W-01-05 R3-1의 셋째 길 · 감지기 M76). 뒤로가기·주소 직접 편집은
   * 잠금도 문의 가드도 거치지 않으므로, 그 길로 품의가 바뀐 뒤 **뒤늦게 도착한 실패**는 새
   * 품의의 자리에 서면 안 된다 — 판정이 **읽는 자리**에 있어야 한다.
   *
   * **나가는 중인 쓰기는 끊지 않으므로**(`resetIfIdle`) 정리 effect가 지워 주기를 기대할 수 없다.
   */
  it('보내는 동안 주소로 품의를 바꾸면 뒤늦게 온 실패가 서지 않는다', async () => {
    const { user, release } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), failingPostRoute(403), notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9501`,
      `${HISTORY_SEARCH.slice(1)}&gi=9502`,
      [POST_PATH],
    );

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(postButton()).toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    release();

    /* 새 품의의 구획이 실제로 선다 — 「거기에 배너가 없다」를 잴 수 있는 상태다. */
    await screen.findByText(t.resubmit.lead);

    /* 나가던 쓰기가 끝났음을 잠금 사유가 미상신 사유로 바뀌는 것으로 잰다. */
    await waitFor(() => {
      expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNeedsSubmission);
    });
    expect(screen.queryByText(messages.httpError.forbidden)).not.toBeInTheDocument();
  });

  /** 같은 길로 온 **성공**도 마찬가지다 — 되돌릴 수 없는 조작의 결과가 남의 품의 아래 서면 안 된다. */
  it('보내는 동안 주소로 품의를 바꾸면 뒤늦게 온 결과가 서지 않는다', async () => {
    const { user, release } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute(), notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9501`,
      `${HISTORY_SEARCH.slice(1)}&gi=9502`,
      [POST_PATH],
    );

    await user.click(postButton());
    await confirmPost(user);

    await waitFor(() => {
      expect(postButton()).toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    release();

    await screen.findByText(t.resubmit.lead);

    await waitFor(() => {
      expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNeedsSubmission);
    });
    expect(screen.queryByRole('region', { name: t.result.postLabel })).not.toBeInTheDocument();
  });

  /** **렌더마다 지워지지 않는다**(감지기 M78) — 정리 의존성에 `reset` 참조를 넣으면 그렇게 된다. */
  it('다시 조회로 응답이 도착해도 처리 실패 배너가 남는다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), failingPostRoute(403), changingApprovalRoute()]),
    );

    await user.click(postButton());
    await confirmPost(user);
    await screen.findByText(messages.httpError.forbidden);

    await refresh(user);

    /* 갱신이 실제로 도착한다 — 승인 요청 응답이 회차마다 달라 상태 코드가 바뀐다. */
    await screen.findByText('SAMPLE_AP_STATUS_2');

    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 처리도 보내는 자리가 다시 본다', () => {
  /**
   * **보내는 자리가 스스로 한 번 더 본다**(감지기 M70). 확인 창이 버튼과 전송 사이를 벌려
   * 놓으므로 「버튼이 막았으니 여기서는 안 봐도 된다」가 성립하지 않는다 — 창이 열린 사이에
   * 상세가 갱신돼 미상신 전표가 되면 **승인 없이 재고가 움직인다.**
   */
  it('창이 열린 사이에 미상신으로 바뀌면 보내지 않는다', async () => {
    let submitted = true;

    const { requests, user } = await setupReadyToPost(
      allRoutes([
        {
          match: (request) => isGet(request, ISSUE_DETAIL_PATH),
          respond: () =>
            jsonResponse(
              issueDetailBody(postableIssueLines, {
                ...goodsIssueResponseFixtures[0],
                ...(submitted ? {} : { approvalRequestId: undefined }),
              }),
              { headers: { ETag: ISSUE_DETAIL_ETAG } },
            ),
        },
        postRoute(),
      ]),
    );

    await user.click(postButton());

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    /* 창 뒤에서 상세가 갱신된다 — 창은 그 사실을 모른다. */
    submitted = false;
    await refresh(user);
    await waitFor(() => {
      expect(screen.getByText(t.progress.notSubmittedTitle)).toBeInTheDocument();
    });

    await confirmPost(user);

    expect(writesTo(requests, POST_PATH)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('DisposalIssueScreen — 승인 조회가 실패해도', () => {
  /**
   * **결재 진행은 판단을 돕는 자료이지 처리의 전제가 아니다**(완료 조건 C78 · 수명 표 26행).
   * 못 읽었다고 처리가 잠기면, 볼 권한이 없는 사람은 승인이 끝난 뒤에도 영영 처리할 수 없다.
   */
  it('처리 버튼이 그대로 열려 있고 창이 그 사실을 적는다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute(), failingApprovalRoute(403)]),
    );

    await screen.findByText(t.progress.forbiddenTitle);

    expect(postButton()).toBeEnabled();

    await user.click(postButton());

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(t.dialog.postProgressUnread)).toBeVisible();
    expect(within(dialog).queryByText(t.dialog.postReasonFirstLine)).not.toBeInTheDocument();
  });

  /** 자리표시가 채워져 있어도 **못 읽은 것은 「승인되지 않았다」가 아니다** — 잠그지 않는다. */
  it('자리표시가 채워져 있어도 진행을 못 읽었으면 잠기지 않는다', async () => {
    fillApprovedStatusCodes();

    await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute(), failingApprovalRoute(404)]),
    );

    await screen.findByText(t.progress.notFoundTitle);

    expect(postButton()).toBeEnabled();
  });

  /** 결과 구획도 그대로다 — 처리한 뒤 승인 조회가 실패해도 처리 사실은 남는다. */
  it('처리한 뒤 승인 조회가 실패해도 결과가 남는다', async () => {
    const { user } = await setupReadyToPost(
      allRoutes([postableDetailRoute(), postRoute(), failingApprovalRoute(403)]),
    );

    await user.click(postButton());
    await confirmPost(user);

    expect(await screen.findByRole('region', { name: t.result.postLabel })).toBeVisible();
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 폐기 거래처 선택칸 — **역할 코드 한 줄이 여는 자리**(변경 통지 #128 §3)
 * ────────────────────────────────────────────────────────────────────────── */

const partnerBox = (): HTMLElement => screen.getByLabelText(t.formFields.disposalPartner);

/** 실제로 나간 거래처 조회. **질의까지 본다** — 좁힌 것과 좁히지 않은 것이 같은 경로다. */
const partnerRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === PARTNERS_PATH);

/**
 * 역할 코드를 채우고 **거래처를 골라** 요청 직전까지 간다.
 *
 * `fillDisposalForm`의 도착지 갈래(자체 폐기 체크)를 끄고 그 자리에 선택칸을 쓴다 —
 * 이 회차 전까지는 고를 수 없어 닿지 못하던 경로다.
 */
const setupReadyWithPartner = async (
  routes: StubRoute[] = allRoutes(chainRoutes()),
): Promise<ReturnType<typeof renderScreen>> => {
  fillFormCodeLists();
  fillPartnerRole();

  const rendered = renderScreen(routes, '?gr=9001');

  await waitForLines();
  await rendered.user.click(lineCheckbox(1));
  await rendered.user.type(qtyInput(1), '10');
  await fillDisposalForm(rendered.user, '불량 판정분 폐기', false);

  await waitFor(() => {
    expect(partnerBox()).toBeEnabled();
  });
  await chooseOption(rendered.user, t.formFields.disposalPartner, PARTNER_LABEL);

  return rendered;
};

describe('DisposalIssueScreen — 폐기 거래처 선택지가 열리는 조건', () => {
  /**
   * **첫째 방향**(완료 조건 C23). 역할 코드가 비어 있는 동안은 **조회 자체를 내보내지 않는다** —
   * 빈 값으로 부르면 좁히지 않은 거래처 전부가 폐기 거래처 선택지로 서고, 사용자는 폐기와
   * 무관한 상대를 되돌릴 수 없는 전표에 실을 수 있다.
   */
  it('역할 코드가 비면 선택지 조회가 나가지 않고 칸이 잠긴다', async () => {
    const { requests } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();

    /* 짝 양성 — 칸은 실제로 서 있다(없어서 통과한 것이 아니다). */
    expect(partnerBox()).toBeInTheDocument();
    expect(partnerRequests(requests)).toEqual([]);
    expect(partnerBox()).toBeDisabled();
    expect(partnerBox()).toHaveAccessibleDescription(
      expect.stringContaining(messages.pendingCode.note),
    );
  });

  /**
   * **둘째 방향**(완료 조건 C24) — 한 줄을 채우면 조회가 나가고 칸이 살아난다. 그 값이
   * **질의 조건으로 실려 나가는지**까지 본다: 실리지 않으면 좁히지 않은 목록을 좁혔다고 믿는다.
   */
  it('역할 코드를 채우면 그 값이 질의로 실려 나가고 칸이 열린다', async () => {
    fillPartnerRole();

    const { requests, user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await waitFor(() => {
      expect(partnerBox()).toBeEnabled();
    });

    const calls = partnerRequests(requests);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.searchParams.get('roleTypeCode')).toBe(SAMPLE_PARTNER_ROLE);
    /* 안내와 자리표시가 함께 사라진다 — 하나만 거두면 열린 칸이 준비 중이라고 말한다. */
    expect(partnerBox()).not.toHaveAccessibleDescription(
      expect.stringContaining(messages.pendingCode.note),
    );
    expect(partnerBox()).not.toHaveTextContent(messages.pendingCode.placeholder);

    /* 좁혀 받은 목록이 실제로 선택지로 선다. */
    await user.click(partnerBox());

    expect(screen.getByRole('option', { name: PARTNER_LABEL })).toBeInTheDocument();
  });

  /**
   * **조회가 실패하면 안내도 트리거도 그 사실을 말한다**(리뷰 Major B1).
   *
   * 앞 회차에는 안내만 화면이 만들고 자리표시는 목록 길이로 지어내, **얼굴은 「선택지 준비 중」
   * 인데 설명은 「불러오지 못했습니다」**인 칸이 됐다. 한 컨트롤이 두 사실을 동시에 말하면
   * 사용자는 기다리면 열릴 것으로 읽는다 — 실패는 기다린다고 풀리지 않는다.
   */
  it('선택지 조회가 실패하면 칸의 안내와 트리거가 함께 실패를 말한다', async () => {
    fillFormCodeLists();
    fillPartnerRole();

    const { user } = renderScreen(allRoutes([failingPartnersRoute()]), '?gr=9001');

    await waitForLines();
    await waitFor(() => {
      expect(partnerBox()).toHaveAccessibleDescription(
        expect.stringContaining(t.form.partnerFailedNote),
      );
    });

    expect(partnerBox()).toHaveTextContent(t.form.partnerFailedPlaceholder);
    expect(partnerBox()).not.toHaveTextContent(messages.pendingCode.placeholder);
    expect(partnerBox()).toBeDisabled();

    /* 버튼 사유도 같은 원천에서 나온다 — 「아직 준비되지 않았습니다」라고 말하지 않는다. */
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '10');
    await fillDisposalForm(user, '불량 판정분 폐기', false);

    expect(submitButton()).toHaveAccessibleDescription(t.actionReasons.disposalPartnerUnavailable);
  });

  /**
   * **잘림 표식이 그 칸에 닿는다**(계획 §5 T4-2의 「잘림 표식을 낸다」 · 리뷰 MU-P1).
   *
   * 계약에 번호로 한 건을 받는 경로가 없어 잘린 뒤쪽 거래처는 고를 길이 아예 없다 — 감추면
   * 사용자가 「그런 거래처가 없다」로 결론짓는다. **잘려도 칸은 열려 있다**: 보이는 선택지를
   * 고르는 데 지장이 없고, 잠그면 있는 것도 못 고른다.
   */
  it('선택지 목록이 잘리면 그 사실이 칸에 닿고 칸은 열려 있다', async () => {
    fillPartnerRole();

    renderScreen(allRoutes([truncatedPartnersRoute()]), '?gr=9001');

    await waitForLines();
    await waitFor(() => {
      expect(partnerBox()).toBeEnabled();
    });

    expect(partnerBox()).toHaveAccessibleDescription(
      expect.stringContaining(t.form.partnerTruncatedNote),
    );
    /* 고를 수 있는 칸에는 자리표시가 서지 않는다 — 짝 방향. */
    expect(partnerBox()).not.toHaveTextContent(messages.pendingCode.placeholder);
  });

  /**
   * **목록은 왔는데 0건**인 갈래(리뷰 탐침 P-3). 앞 회차에는 트리거가 「준비 중」이라 말하고
   * 설명은 **아무것도 없었다** — 목록이 이미 왔는데 기다리라고 말하는 상태였다.
   */
  it('선택지가 0건이면 그 사실을 말하고 준비 중이라 하지 않는다', async () => {
    fillFormCodeLists();
    fillPartnerRole();

    const { user } = renderScreen(allRoutes([emptyPartnersRoute()]), '?gr=9001');

    await waitForLines();
    await waitFor(() => {
      expect(partnerBox()).toHaveAccessibleDescription(
        expect.stringContaining(t.form.partnerEmptyNote),
      );
    });

    expect(partnerBox()).toHaveTextContent(t.form.partnerEmptyPlaceholder);
    expect(partnerBox()).not.toHaveTextContent(messages.pendingCode.placeholder);

    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '10');
    await fillDisposalForm(user, '불량 판정분 폐기', false);

    expect(submitButton()).toHaveAccessibleDescription(t.actionReasons.disposalPartnerUnavailable);
    /* ⭐ 그래도 자체 폐기로는 열린다(#128 §3). */
    await user.click(selfDisposalCheckbox());

    expect(submitButton()).toBeEnabled();
  });

  /**
   * **잠금 사유가 갈린다**(완료 조건 C23·C24 · 변경 통지 #128 §4 ⛔).
   *
   * 고를 것이 없을 때 「고르세요」라고 말하면 사용자는 자기가 놓친 것을 찾다가 화면을 고장으로
   * 읽는다. 선택지가 살아나는 순간 그 문구가 통지 문면으로 바뀐다.
   */
  it('역할 코드를 채우면 버튼의 잠금 사유가 「고르거나 체크하십시오」로 바뀐다', async () => {
    fillFormCodeLists();
    fillPartnerRole();

    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await waitForLines();
    await user.click(lineCheckbox(1));
    await user.type(qtyInput(1), '10');
    await fillDisposalForm(user, '불량 판정분 폐기', false);

    await waitFor(() => {
      expect(submitButton()).toHaveAccessibleDescription(t.actionReasons.needsDisposalDestination);
    });
    expect(submitButton()).toBeDisabled();
  });

  /**
   * ⭐ **역할 코드가 없어도 화면은 선다**(#128 §3 · 완료 조건 C28).
   *
   * 선택지 조회가 **한 번도 나가지 않은 채로** 자체 폐기 요청이 끝까지 간다 — 값 목록을
   * 기다리는 것과 이 화면을 쓰는 것이 서로 매이지 않았음을 요청 수와 본문으로 함께 잰다.
   */
  it('역할 코드가 비어도 자체 폐기로 요청이 나간다', async () => {
    const { requests, user } = await setupReadyToSubmit();

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
    });

    const body = writesTo(requests, ISSUES_PATH)[0]?.body as Record<string, unknown>;

    expect(partnerRequests(requests)).toEqual([]);
    expect(Object.keys(body)).not.toContain('destinationTypeCode');
    expect(Object.keys(body)).not.toContain('destinationId');
    /* 짝 양성 — 본문이 비어서 통과한 것이 아니다. */
    expect(body.issueTypeCode).toBe(SAMPLE_FORM_CODES.issueType);
  });

  /**
   * **거래처를 고르면 짝 두 키가 함께 실린다**(완료 조건 C17의 화면 갈래 · #128 ⛔).
   *
   * 조립 함수는 앞 회차에 갈래를 갖췄으나 **선택지가 없어 화면에서는 닿지 못하는 길**이었다 —
   * 이 회차에 처음으로 사용자가 실제로 지나는 경로가 된다.
   */
  it('거래처를 고르면 도착지 짝이 함께 실린다', async () => {
    const { requests, user } = await setupReadyWithPartner();

    await openSubmitConfirm(user);

    /* 확인한 글자와 나가는 값이 같은 자리에서 나온다 — 창이 먼저 그 거래처를 적는다. */
    expect(within(screen.getByRole('dialog')).getByText(PARTNER_LABEL)).toBeInTheDocument();

    await confirmSubmit(user);

    await waitFor(() => {
      expect(writesTo(requests, ISSUES_PATH)).toHaveLength(1);
    });

    const body = writesTo(requests, ISSUES_PATH)[0]?.body as Record<string, unknown>;

    expect(body.destinationTypeCode).toBe('DISPOSAL_SITE');
    expect(body.destinationId).toBe(9561);
  });

  /**
   * **화면 배선의 앵커**(선행 회차 리뷰 MU-R1 · 완료 조건 C16).
   *
   * 「체크하면 값도 비운다」는 전이(`withSelfDisposal`)가 **화면에 실제로 이어져 있는가**를
   * 재는 자리다. 선행 회차에는 선택지가 비어 있어 값을 든 상태를 만들 수 없었고, 그래서
   * 배선을 순수 spread(`{ ...prev, isSelfDisposal: value }`)로 바꿔도 아무 시험도 울지 않았다.
   * 이제 값을 들고 체크할 수 있다 — 화면에서 **고른 거래처가 실제로 사라져야** 한다.
   */
  it('체크하면 화면에서도 고른 거래처가 비워진다', async () => {
    const { user } = await setupReadyWithPartner();

    /* 짝 양성 — 체크 전에는 고른 거래처가 트리거에 서 있다. */
    expect(partnerBox()).toHaveTextContent(PARTNER_LABEL);

    await user.click(selfDisposalCheckbox());

    expect(partnerBox()).not.toHaveTextContent(PARTNER_LABEL);
    expect(partnerBox()).toBeDisabled();

    /* 확인 창도 같은 사실을 말한다 — 값과 글자가 한 판정에서 나온다. */
    await openSubmitConfirm(user);

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(t.values.selfDisposal)).toBeInTheDocument();
    expect(within(dialog).queryByText(PARTNER_LABEL)).not.toBeInTheDocument();
  });

  /**
   * **체크를 풀어도 비운 값이 되살아나지 않는다**(선행 회차 검증 관찰 O-1의 화면 갈래).
   *
   * 되살리려면 지운 값을 어딘가 들고 있어야 하는데, 그것은 「체크하면 값을 비운다」와 같은 말이
   * 아니다. 되살아나면 사용자는 **체크를 풀었다는 이유만으로** 앞서 고른 거래처가 다시 실리는
   * 것을 보게 된다 — 되돌릴 수 없는 전표에서 가장 나쁜 되살아남이다.
   */
  it('체크를 풀어도 비운 거래처가 되살아나지 않는다', async () => {
    const { user } = await setupReadyWithPartner();

    await user.click(selfDisposalCheckbox());
    await user.click(selfDisposalCheckbox());

    expect(selfDisposalCheckbox()).not.toBeChecked();
    expect(partnerBox()).toBeEnabled();
    expect(partnerBox()).not.toHaveTextContent(PARTNER_LABEL);
    /* 다시 고르지 않으면 올릴 수 없다 — 「아직 안 골랐다」로 돌아간 것이다. */
    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveAccessibleDescription(t.actionReasons.needsDisposalDestination);
  });

  /**
   * **거래처 400이 그 칸 옆에 선다**(선행 회차 리뷰 M5 — 이 회차에 처음 도달한다).
   *
   * 앞 회차가 `destinationId`를 화면 소유 필드에 넣어 두었으나 선택칸이 잠겨 있어 그 오류가
   * **올 수 없는 상태**였다. 이제 실제로 오고, 배너로만 받으면 사용자는 어느 칸을 고쳐야
   * 하는지 알 수 없다.
   */
  it('거래처 400의 필드 오류가 그 칸 옆에 서고 배너로 새지 않는다', async () => {
    const SAMPLE_PARTNER_ERROR = '폐기처리 역할이 없는 거래처입니다';
    const { user } = await setupReadyWithPartner(
      allRoutes([failingCreateRoute(400, fieldErrorBody('destinationId', SAMPLE_PARTNER_ERROR))]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(SAMPLE_PARTNER_ERROR);

    expect(partnerBox()).toHaveAccessibleDescription(expect.stringContaining(SAMPLE_PARTNER_ERROR));
    /* 짝 방향 — 같은 문장이 배너로 한 번 더 서지 않는다(인라인으로 소화됐다). */
    expect(screen.getAllByText(SAMPLE_PARTNER_ERROR)).toHaveLength(1);
  });

  /**
   * **뒷면 — 자체 폐기로 올렸는데 서버가 거래처 오류를 준 경우**(선행 회차 재리뷰가 T4에
   * 확인하라고 넘긴 갈래).
   *
   * 본문에 도착지 두 키가 없으므로 서버가 이 오류를 줄 이유는 없다 — 그래도 오면 화면은
   * **그 오류를 삼키지 않는다.** 지금의 배선은 계약 필드 이름을 그 칸에 잇는 것이고, 그때 칸은
   * 자체 폐기로 잠겨 있어 **읽을 수는 있으나 그 자리에서 고칠 수는 없다.** 이 시험은 그 사실을
   * 값으로 고정해 둔다 — 다음 회차가 「잠긴 칸의 오류를 배너로 올릴 것인가」를 정할 때
   * 지금 무엇이 일어나는지부터 읽을 수 있어야 한다.
   */
  it('자체 폐기로 올린 뒤 온 거래처 오류도 삼키지 않는다', async () => {
    const SAMPLE_PARTNER_ERROR = '도착지를 확인할 수 없습니다';
    const { user } = await setupReadyToSubmit(
      allRoutes([failingCreateRoute(400, fieldErrorBody('destinationId', SAMPLE_PARTNER_ERROR))]),
    );

    await openSubmitConfirm(user);
    await confirmSubmit(user);

    await screen.findByText(SAMPLE_PARTNER_ERROR);

    /* 잠긴 칸이라 고칠 수는 없으나 **어느 축의 오류인지는 읽힌다.** */
    expect(partnerBox()).toBeDisabled();
    expect(partnerBox()).toHaveAccessibleDescription(expect.stringContaining(SAMPLE_PARTNER_ERROR));
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * ③ 구획의 도착지 — **처리 직전에 「누가 가져가는가」를 읽는다**(완료 조건 C26)
 * ────────────────────────────────────────────────────────────────────────── */

const postPane = (): HTMLElement => screen.getByRole('region', { name: t.post.label });

describe('DisposalIssueScreen — ③ 구획이 말하는 도착지', () => {
  it('도착지가 있는 전표는 「코드 · 이름」으로 말한다', async () => {
    await setupReadyToPost();

    await waitFor(() => {
      expect(within(postPane()).getByText(PARTNER_LABEL)).toBeInTheDocument();
    });
    expect(within(postPane()).getByText(t.post.destinationLabel)).toBeInTheDocument();
  });

  /** 짝이 통째로 없는 것은 **정해진 사실**이다 — 「알 수 없음」이 아니다. */
  it('짝이 없는 전표는 자체 폐기라 말한다', async () => {
    await setupReadyToPost(allRoutes([notSubmittedDetailRoute()]), `${HISTORY_SEARCH}&gi=9502`);

    expect(within(postPane()).getByText(t.values.selfDisposal)).toBeInTheDocument();
  });

  /**
   * **이름을 풀지 못하면 그 사실을 밝히고 번호를 대신 내지 않는다**(`omf-mes#44`).
   * 낱말은 확인 창의 못 푼 이름과 **같은 말**이라 사용자가 자리마다 다른 규칙을 익히지 않는다.
   */
  it('목록 밖 거래처는 알 수 없음이라 말하고 번호를 내지 않는다', async () => {
    await setupReadyToPost(
      allRoutes([
        issueDetailRoute(
          goodsIssueLineResponseFixtures,
          goodsIssueResponseFixtures[2],
          '/logistics/goods-issues/9503',
        ),
        approvalRoute(),
      ]),
      `${HISTORY_SEARCH}&gi=9503`,
    );

    await waitFor(() => {
      expect(within(postPane()).getByText(t.values.unknown)).toBeInTheDocument();
    });

    for (const id of INTERNAL_IDS) {
      expect(within(postPane()).queryByText(new RegExp(id))).not.toBeInTheDocument();
    }
  });

  /**
   * ⛔ **이름 풀이는 좁히지 않는다**(완료 조건 C25 · `omf-mes#47`).
   *
   * 이미 저장된 전표는 지금의 역할 좁힘 밖 거래처를 가리킬 수 있다 — 역할은 회수될 수 있고,
   * 그때 좁힌 목록으로 풀면 정상 도착지가 「알 수 없음」으로 찍힌다. 선택지 조회가 함께 나가는
   * 상태에서도 이 조회에는 **역할 코드가 실리지 않는다.**
   */
  it('이름 풀이 조회는 역할 코드를 싣지 않는다', async () => {
    fillPartnerRole();

    const { requests } = await setupReadyToPost();

    await waitFor(() => {
      expect(within(postPane()).getByText(PARTNER_LABEL)).toBeInTheDocument();
    });

    const calls = partnerRequests(requests);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.searchParams.has('roleTypeCode')).toBe(false);
    expect(calls[0]?.url.searchParams.get('includeInactive')).toBe('true');
  });

  /** 자체 폐기 전표에는 **풀 이름이 없다** — 부를 이유가 없는 요청을 내보내지 않는다. */
  it('자체 폐기 전표에서는 이름 풀이를 부르지 않는다', async () => {
    const { requests } = await setupReadyToPost(
      allRoutes([notSubmittedDetailRoute()]),
      `${HISTORY_SEARCH}&gi=9502`,
    );

    expect(within(postPane()).getByText(t.values.selfDisposal)).toBeInTheDocument();
    expect(partnerRequests(requests)).toEqual([]);
  });
});
