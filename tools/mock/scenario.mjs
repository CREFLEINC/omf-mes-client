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
 * 자재LOT 여섯·금형 셋. 아래 번호의 일부만 읽어도 걸린다(부분 일치 — 아래 `matches` 의 단서).
 * **대소문자를 가린다** — 계약에 규칙이 없어 목이 임의로 무시하지 않는다.
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
 * ⚠ **부분 일치는 가정이다.** 계약은 검색 규칙을 말하지 않는다. 다만 응답이 배열과 `page`
 * 이므로 **여러 건이 올 수 있다는 것만은 확실**하고, 화면은 그 갈래를 반드시 다뤄야 한다 —
 * 그래서 여기서 재현한다. 규칙 자체는 검토 요청 omf-mes#254 로 물어 두었다.
 *
 * ⛔ **대소문자는 가리는 대로 둔다.** 계약에 아무 말이 없어 무시할 근거가 없다. 목이 임의로
 * 무시하면 실 서버가 가리는 경우를 **여기서만 통과시켜** 확인이 헛돈다.
 *
 * 빈 검색어는 아무것도 내지 않는다 — 전량을 돌려주면 스캔 한 번에 목록 전체가 걸린다.
 */
const matches = (haystack, q) => haystack.includes(q);

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

/**
 * 단말 기능 구성 — 게이팅 조회가 읽는다.
 *
 * **7901 은 열려 있고, 그 밖의 단말은 이 공정 행이 없다.** 「행이 없다」와 「닫혀 있다」를
 * 화면이 같게 다루는지 보려면 후자가 필요하다.
 */
const TERMINAL_PROCESSES = {
  7901: [{ processId: 7902, processName: '합성 공정 가', canInputMaterial: true }],
  7902: [{ processId: 7902, processName: '합성 공정 가', canInputMaterial: false }],
};

/** 투입 확정 응답. 요청 본문을 되비추고, 기록만 되는 것을 LOT 번호로 가른다. */
const toConsumption = (body, seq) => ({
  materialConsumptionId: 6000 + seq,
  consumptionNo: `SAMPLE-MC-${String(6000 + seq)}`,
  workOrderId: body.workOrderId,
  itemId: body.itemId,
  lotId: body.lotId,
  /* 화면이 보내지 않는 칸 — 서버가 채운 것으로 되돌려 준다. */
  consumptionTypeCode: 'NORMAL',
  inputQty: body.inputQty,
  uomId: body.uomId,
  occurredAt: body.occurredAt,
  recordedAt: body.occurredAt,
  workerId: 8801,
  terminalId: 7901,
  statusCode: 'RECORDED',
  /*
   * **0071 은 출고에 귀속되지 않은 자재**, **0072 는 다른 공정 자재**로 되돌려 준다 —
   * 스펙 §5-3의 「통과하되 기록만 되는 것」 두 갈래를 눈으로 볼 수 있게.
   */
  ...(body.lotId === 8371 ? {} : { shopfloorReceiptLineId: 8101 }),
  ...(body.lotId === 8372 ? { actualUseProcessId: 7903 } : {}),
});

let consumptionSeq = 0;

/**
 * ⚠ 목 전용 제어 — **서버가 상태로 들고 있는다.**
 *
 * 화면은 자기 요청에 이 값을 싣지 않는다(실을 이유가 없다). 그래서 브라우저 주소에 붙여도
 * 서버에 닿지 않는다 — 모드를 **서버에 미리 걸어 두고** 화면은 평소대로 부르게 한다.
 *
 * ```
 * http://127.0.0.1:4020/__mock?mode=gate-fail   ← 브라우저에서 한 번 연다
 * http://127.0.0.1:4020/__mock                  ← 지금 모드 확인
 * http://127.0.0.1:4020/__mock?mode=off         ← 해제
 * ```
 */
const MODES = [
  'off',
  'empty',
  'partial-fail',
  'forbidden',
  'gate-fail',
  'write-forbidden',
  'write-fail',
];
let mockMode = 'off';

const routes = (url, method, body) => {
  const path = url.pathname;
  const q = url.searchParams.get('q') ?? '';
  /* 질의로도 받되(감지기·curl 용) 평소에는 서버에 걸어 둔 모드를 쓴다. */
  const control = url.searchParams.get('__mock') ?? (mockMode === 'off' ? '' : mockMode);
  const workOrderId = Number(url.searchParams.get('workOrderId') ?? '0');

  const gating = /^\/mdm\/terminals\/(\d+)\/processes$/.exec(path);
  if (gating !== null) {
    if (control === 'gate-fail')
      return [500, errorBody('SAMPLE_FAIL', '합성 실패 — 게이팅 확인 불가')];

    return [200, { items: TERMINAL_PROCESSES[Number(gating[1])] ?? [] }];
  }

  if (path === '/production/material-consumptions' && method === 'POST') {
    if (control === 'write-forbidden') {
      return [403, errorBody('FORBIDDEN', '이 단말에는 열려 있지 않습니다.')];
    }
    if (control === 'write-fail') {
      return [400, errorBody('SAMPLE_FAIL', '합성 실패 — 투입 기록 불가')];
    }

    consumptionSeq += 1;

    return [201, toConsumption(body ?? {}, consumptionSeq)];
  }

  if (path === '/__mock') {
    const next = url.searchParams.get('mode');
    if (next !== null) {
      if (!MODES.includes(next)) {
        return [400, { error: `모르는 모드: ${next}`, modes: MODES }];
      }
      mockMode = next;
    }

    return [200, { mode: mockMode, modes: MODES }];
  }

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

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return undefined;

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    return undefined;
  }
};

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  void readBody(req).then((requestBody) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    const [status, body] = routes(url, req.method ?? 'GET', requestBody);

    /* 쓰기는 헤더까지 찍는다 — 멱등 키와 귀속 사번이 실제로 실렸는지 눈으로 본다. */
    const headers =
      req.method === 'POST'
        ? `  [Idempotency-Key=${req.headers['idempotency-key'] ?? '없음'} · X-Worker-No=${req.headers['x-worker-no'] ?? '없음'}]`
        : '';

    console.log(`${String(status)} ${req.method ?? 'GET'} ${url.pathname}${url.search}${headers}`);
    json(res, status, body);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`시나리오 목 서버: http://127.0.0.1:${String(PORT)}`);
  console.log('⛔ 계약 검증용이 아니다 — 그것은 `pnpm mock`(Prism)이 한다.');
  console.log('자재LOT: SAMPLE-LOT-0001·0002·0003·0071·0072·0091 (부분 일치 검색)');
  console.log('        SAMPLE-LOT-0001 은 외부 식별자 SAMPLE-EXT-77 로도 걸린다');
  console.log('금형:   SAMPLE-MLD-01·02(한도 초과)·03(적정 타수 없음)');
  console.log('단말: 7901(투입 열림) · 7902(닫힘) · 그 밖(구성 없음) · 공정 7902');
  console.log(`목 전용 제어: http://127.0.0.1:${String(PORT)}/__mock?mode=<${MODES.join('|')}>`);
});
