/**
 * 시나리오 목 서버 — **실동작 확인용**이다.
 *
 * `pnpm mock`(Prism)은 계약 정본을 그대로 서빙하므로 **어떤 검색어에도 예시 하나**만 돌려준다.
 * 그래서 「자재 두 건을 담는다」·「부족·미수령을 본다」·「금형 한도 초과를 본다」 같은 갈래를
 * 사람이 눈으로 확인할 수 없다. 이 서버가 그 자리를 메운다.
 *
 * ## 지키는 경계
 *
 * ⛔ **업무 규칙을 지어내지 않는다.**
 *
 * - 응답의 **모양**은 계약 스키마를 따른다. 어긋나면 이 파일의 결함이며 계약을 고칠 근거가 아니다
 * - **검색은 계약이 적은 의미 그대로** 동작한다 — `q`는 「LOT 번호·외부 식별자 검색」이므로
 *   **부분 일치**다. 특정 문자열에만 반응하는 마법 값을 두지 않는다
 * - 값은 전부 **합성값**이다(`SAMPLE-` 접두). 실 운영 코드·LOT 번호를 쓰지 않는다
 * - 실패·빈 상태를 만드는 장치는 **목 전용 제어 파라미터**(`__mock`)로 두어 업무 값과 섞이지
 *   않게 한다. 작업지시 번호 같은 업무 식별자에 뜻을 붙이지 않는다
 *
 * ⛔ **계약 검증용이 아니다.** 그것은 `pnpm mock`(Prism)의 몫이다.
 *
 * ## 사용
 *
 * ```bash
 * pnpm mock:scenario                    # http://127.0.0.1:4020
 * MOCK_SCENARIO_PORT=4030 pnpm mock:scenario
 * ```
 *
 * 화면이 이 서버를 보게 하려면 기준 URL을 지정한다.
 *
 * ```bash
 * VITE_API_BASE_URL=http://127.0.0.1:4020 pnpm --filter @omf-mes/web dev
 * ```
 *
 * ## 담긴 자료
 *
 * 자재LOT 여섯·금형 셋. **검색은 부분 일치**이므로 아래 번호의 일부만 읽어도 걸린다.
 *
 * | LOT 번호 | 성격 |
 * | --- | --- |
 * | `SAMPLE-LOT-0001` · `0002` · `0003` | 정상 — 연달아 담아 본다 |
 * | `SAMPLE-LOT-0091` | 검사 대기 · 보류 중 — 상태 표시가 갈리는지 본다 |
 * | `SAMPLE-LOT-0071` · `0072` | 번호가 닮았다 — `007`을 읽으면 **두 건이 함께** 걸린다 |
 *
 * `SAMPLE-LOT-0001`은 외부 식별자 `SAMPLE-EXT-77`로도 걸린다 — **읽은 코드와 찾은 번호가
 * 다른** 경우를 재현한다.
 *
 * | 금형 코드 | 성격 |
 * | --- | --- |
 * | `SAMPLE-MLD-01` | 타발 12,450 / 50,000 |
 * | `SAMPLE-MLD-02` | 적정 타수를 넘겼다 — 경고만, 막지 않는다 |
 * | `SAMPLE-MLD-03` | 적정 타수가 없다 — 「산출 불가」이지 0이 아니다 |
 *
 * ## 목 전용 제어
 *
 * 실패·빈 상태는 업무 값이 아니라 이 파라미터로 만든다.
 *
 * | 붙이는 값 | 결과 |
 * | --- | --- |
 * | `&__mock=empty` | 수령 내역 없음 |
 * | `&__mock=partial-fail` | 전표 둘 중 하나의 상세가 실패 |
 * | `&__mock=forbidden` | 목록 조회가 403 |
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_SCENARIO_PORT ?? 4020);

/** 화면이 WebView(`http://localhost`)에서도 부르므로 오리진을 가리지 않는다. 개발 도구다. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'ETag',
};

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
  res.end(JSON.stringify(body));
};

const page = (items) => ({ items, page: { page: 1, size: 50, total: items.length } });

/** 계약이 오류 응답에 요구하는 본문 모양. */
const errorBody = (code, message) => ({ errors: [{ scope: 'screen', code, message }] });

const lot = (id, no, overrides = {}) => ({
  lotId: id,
  lotNo: no,
  itemId: 8200 + (id % 100),
  lotTypeCode: 'MATERIAL',
  plantId: 8700,
  initialQty: 100,
  uomId: 8400,
  sourceTypeCode: 'SAMPLE_SOURCE',
  sourceId: 8800,
  statusCode: 'NORMAL',
  held: false,
  ...overrides,
});

const mold = (id, code, name, overrides = {}) => ({
  moldId: id,
  plantId: 8700,
  moldCode: code,
  moldName: name,
  toolTypeCode: 'MOLD',
  cavityCount: 4,
  currentShotCount: 12450,
  guaranteedShotCount: 50000,
  availableShotCount: 37550,
  pmTriggerTypeCode: 'NONE',
  statusCode: 'IN_SERVICE',
  isActive: true,
  ...overrides,
});

/**
 * 담긴 자재LOT.
 *
 * `externalIds`는 계약이 `q`의 검색 대상으로 적은 **외부 식별자**다 — 응답 본문에는 싣지
 * 않는다(계약의 `Lot`에 그 자리가 없다). 검색에만 쓴다.
 */
const LOTS = [
  { row: lot(8301, 'SAMPLE-LOT-0001'), externalIds: ['SAMPLE-EXT-77'] },
  { row: lot(8302, 'SAMPLE-LOT-0002'), externalIds: [] },
  { row: lot(8303, 'SAMPLE-LOT-0003'), externalIds: [] },
  {
    row: lot(8391, 'SAMPLE-LOT-0091', { statusCode: 'INSPECTION_PENDING', held: true }),
    externalIds: [],
  },
  { row: lot(8371, 'SAMPLE-LOT-0071'), externalIds: [] },
  { row: lot(8372, 'SAMPLE-LOT-0072'), externalIds: [] },
];

const MOLDS = [
  mold(8601, 'SAMPLE-MLD-01', '합성 금형 가'),
  mold(8602, 'SAMPLE-MLD-02', '합성 금형 나', {
    currentShotCount: 50120,
    availableShotCount: 0,
  }),
  mold(8603, 'SAMPLE-MLD-03', '합성 금형 다', {
    guaranteedShotCount: null,
    availableShotCount: null,
  }),
];

/**
 * 계약이 적은 `q`의 의미 — 「LOT 번호·외부 식별자 검색」.
 *
 * **부분 일치다.** 실 서버가 어떻게 구현하든 화면이 기대하는 것은 「여러 건이 올 수 있다」이고,
 * 그 갈래를 여기서 재현한다. 빈 검색어는 아무것도 내지 않는다 — 전량을 돌려주면 스캔 한 번에
 * 목록 전체가 걸린다.
 */
const matches = (haystack, q) => haystack.toUpperCase().includes(q.toUpperCase());

const lotsFor = (q) => {
  const code = q.trim();
  if (code === '') return [];

  return LOTS.filter(
    (entry) => matches(entry.row.lotNo, code) || entry.externalIds.some((id) => matches(id, code)),
  ).map((entry) => entry.row);
};

const moldsFor = (q) => {
  const code = q.trim();
  if (code === '') return [];

  return MOLDS.filter((row) => matches(row.moldCode, code) || matches(row.moldName, code));
};

const receiptLine = (id, itemId, lotId, issued, received) => ({
  shopfloorReceiptLineId: id,
  shopfloorReceiptId: 8001,
  goodsIssueLineId: 8500 + (id % 100),
  itemId,
  lotId,
  issuedQty: issued,
  receivedQty: received,
  varianceQty: issued - received,
  uomId: 8400,
});

const receipt = (id, workOrderId) => ({
  shopfloorReceiptId: id,
  shopfloorReceiptNo: `SAMPLE-SR-000${String(id % 10)}`,
  goodsIssueId: 8500,
  workOrderId,
  destinationLocationId: 8900,
  receivedAt: '2026-08-13T09:12:00+09:00',
  statusCode: 'CONFIRMED',
});

/** 상태 표시명 — 계약이 `Lot.statusCode` 설명에 이 코드 그룹을 적어 두었다. */
const LOT_STATUS_VALUES = [
  ['NORMAL', '정상'],
  ['DEFECTIVE', '불량'],
  ['INSPECTION_PENDING', '검사 대기'],
  ['SCRAPPED', '폐기'],
].map(([code, codeName], index) => ({
  codeValueId: 8100 + index,
  codeGroupId: 8100,
  code,
  codeName,
  displayOrder: index + 1,
  isActive: true,
}));

/** ⚠ 목 전용 제어. 업무 값이 아니라는 것이 이름에 드러나야 한다. */
const MOCK_CONTROL = '__mock';

const routes = (url) => {
  const path = url.pathname;
  const q = url.searchParams.get('q') ?? '';
  const control = url.searchParams.get(MOCK_CONTROL) ?? '';
  const workOrderId = Number(url.searchParams.get('workOrderId') ?? '0');

  if (path === '/trace/lots') return [200, page(lotsFor(q))];
  if (path === '/mdm/molds') return [200, page(moldsFor(q))];

  if (path === '/mdm/code-values') {
    const group = url.searchParams.get('codeGroupCode');
    return [200, page(group === 'LOT_STATUS' ? LOT_STATUS_VALUES : [])];
  }

  if (path === '/logistics/shopfloor-receipts') {
    if (control === 'forbidden') {
      return [403, errorBody('FORBIDDEN', '이 단말에는 열려 있지 않습니다.')];
    }
    if (control === 'empty') return [200, page([])];
    if (control === 'partial-fail') {
      return [200, page([receipt(8001, workOrderId), receipt(8002, workOrderId)])];
    }

    return [200, page([receipt(8001, workOrderId)])];
  }

  const detail = /^\/logistics\/shopfloor-receipts\/(\d+)$/.exec(path);
  if (detail !== null) {
    const id = Number(detail[1]);
    // 8002 는 `__mock=partial-fail` 일 때만 목록에 실린다 — 그 전표의 상세가 실패한다.
    if (id === 8002) return [500, errorBody('SAMPLE_FAIL', '합성 실패 — 부분 결과 확인용')];

    return [
      200,
      {
        shopfloorReceipt: receipt(id, 0),
        lines: [
          receiptLine(8101, 8201, 8301, 100, 100), // 수령 완료
          receiptLine(8102, 8202, 8302, 200, 180), // 부족
          receiptLine(8103, 8203, 8303, 50, 0), // 미수령
        ],
      },
    ];
  }

  return [404, errorBody('NOT_FOUND', `시나리오에 없는 경로입니다: ${path}`)];
};

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
  const [status, body] = routes(url);

  console.log(`${String(status)} ${req.method ?? 'GET'} ${url.pathname}${url.search}`);
  json(res, status, body);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`시나리오 목 서버: http://127.0.0.1:${String(PORT)}`);
  console.log('⛔ 계약 검증용이 아니다 — 그것은 `pnpm mock`(Prism)이 한다.');
  console.log('자재LOT: SAMPLE-LOT-0001·0002·0003·0071·0072·0091 (부분 일치 검색)');
  console.log('        SAMPLE-LOT-0001 은 외부 식별자 SAMPLE-EXT-77 로도 걸린다');
  console.log('금형:   SAMPLE-MLD-01·02(한도 초과)·03(적정 타수 없음)');
  console.log(`목 전용 제어: &${MOCK_CONTROL}=empty|partial-fail|forbidden`);
});
