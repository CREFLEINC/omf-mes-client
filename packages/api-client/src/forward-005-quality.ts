/*
 * 005 C-K4 덧댐 — W-03-10 처분 · 선별 · 특채(§10), W-03-05 재검 표시(§8).
 * 서버 병합 뒤 `gen:api` 로 다시 만들고 이 파일을 걷는다(T111). 계약에 적히지 않아 화면이 정한 칸은 「(C5 정함)」 · 「(C6 정함)」.
 */
import type { Json } from './forward-contract';
import type { components, paths } from './generated/api';

type PageMeta = components['schemas']['PageMeta'];

/* ── W-03-05 재검 표시(계약 §8 · D-18) ── */

/**
 * 검사 결과 행 + `confirmCycle`(계약 §8) — 입하 LOT IQC 결과만 값이 있다(1 = 처음, 2 이상 = 재검사).
 * 옛 IQC · PQC · OQC 는 null(또는 없음) — 화면은 그때 지금처럼 `previousResultId` 사슬 깊이로 보인다.
 */
export type InspectionResultForward005 = components['schemas']['InspectionResult'] & {
  confirmCycle?: number | null;
  /**
   * 새 흐름 IQC 결과의 입하 LOT 번호(G2 L9 대비 — 칸 이름은 서버 보고 뒤 맞춘다, 지금은 C7 가정). 결과가 LOT 하나에 붙지 않아
   * `lotNo` 가 비므로 W-03-05 「LOT 번호」 칸이 이것을 보인다.
   */
  inboundLotNo?: string | null;
};

/** `GET /quality/inspection-results` 의 200 몸통 — 행만 위 모양으로 바꾼다. 덮는 자리는 `forward-contract.ts` 의 그 경로. */
export interface InspectionResultListForward005 {
  items: InspectionResultForward005[];
  page: PageMeta;
}

/* ── W-03-10 부적합 · 처분(계약 §10) ── */

/** 자재 관리 LOT 에 매칭된(또는 매칭 없는) IQC 결과 한 건 — 참고용 표시. (C5 정함 — 칸 이름 · 모양 전부) */
export interface NonconformanceIqcResultRefForward005 {
  inspectionResultId: number;
  /** 「결과 n」의 n — `:split-lots` 미리 보기의 `seqNo` 와 같은 뜻. (C5 정함) */
  seqNo: number;
  /** 합격 · 불합격 · 보류 — `INSPECTION_RESULT_OVERALL_JUDGMENT` 값. (C5 정함) */
  overallJudgmentCode: string | null;
  /** 불량 요약 한 줄(예: 「외관 찍힘」). 없으면 null. (C5 정함) */
  defectSummary?: string | null;
}

export type NonconformanceLotForward005 = components['schemas']['NonconformanceLot'] & {
  /** IQC 결과 매칭 요약 — LOT 별 불합격 결과 수(계약 §10 「참고용」). 칸 이름은 (C5 정함). */
  rejectedResultCount?: number | null;
  /** 이 자재 관리 LOT 에 매칭된 결과(참고용). 입하 LOT IQC 부적합만. (C5 정함) */
  matchedResults?: NonconformanceIqcResultRefForward005[] | null;
};

/**
 * 부적합 + 입하 LOT 단위 처분에 쓰는 칸(계약 §10 — `inspectionRequestId` · `inboundLotNo` · 매칭 요약 · 상태 `CANCELLED`).
 * 입하 LOT 이 있으면 자재 입하 IQC 부적합이다(선별은 그때만) — 반품 · OQC 부적합은 null.
 */
export type NonconformanceForward005 = Omit<components['schemas']['Nonconformance'], 'lots'> & {
  inspectionRequestId?: number | null;
  inboundLotNo?: string | null;
  /** 입하 LOT 식별자. (C5 정함) */
  inboundLotId?: number | null;
  /** IQC 검사(의뢰) 번호 — 「IQC 검사 IR-…」. (C5 정함) */
  inspectionRequestNo?: string | null;
  /** 공급사 이름(자재 입하 IQC 부적합). (C5 정함) */
  supplierName?: string | null;
  /** 선별로 떼어 낸 불량에서 생긴 부적합이면 원래 부적합 — 「선별로 생김 ← NC-…」, 정상 처분 막음. (C5 정함) */
  sortedFromNonconformanceId?: number | null;
  /** (C5 정함) */
  sortedFromNonconformanceNo?: string | null;
  /** 어느 자재 관리 LOT 에도 매칭되지 않은 결과(참고용). (C5 정함) */
  unmatchedResults?: NonconformanceIqcResultRefForward005[] | null;
  lots: NonconformanceLotForward005[];
};

/** 정상 · 폐기 · 재작업 — 남은 수량 전부(FR-038 · 일부 판정 없음). 본문 모양은 지금 그대로. */
export interface DispositionDecisionWholeCreateForward005 {
  dispositionTypeCode: 'REWORK' | 'SCRAP' | 'NORMAL';
  decisionQty: number;
  uomId: number;
  reason: string;
}

/** 선별 — 불량 자재 관리 LOT 을 새 입하 LOT 로 옮긴다(계약 §10). 옛 수량 분할 본문은 없다. */
export interface DispositionDecisionSortCreateForward005 {
  dispositionTypeCode: 'SORT';
  /** 불량 자재 관리 LOT — 전부가 아니어야 한다. */
  lotIds: number[];
  /** 정보 — 0 이상, 재고 · LOT 수량은 바뀌지 않는다. */
  goodQty?: number;
  defectQty?: number;
  /** 판정 사유 — 계약 §10 이 적지 않았으나 다른 판정과 같이 필수로 싣는다. (C5 정함) */
  reason: string;
}

export type DispositionDecisionCreateForward005 =
  DispositionDecisionWholeCreateForward005 | DispositionDecisionSortCreateForward005;

/** 판정 저장 응답 — 선별이면 새 입하 LOT · 새 부적합(계약 §10 `newInboundLotId` · `newNonconformanceId`). */
export type DispositionDecisionCreatedForward005 = components['schemas']['DispositionDecision'] & {
  newInboundLotId?: number | null;
  newNonconformanceId?: number | null;
  /** 새 입하 LOT 번호 — 결과 카드 · 알림에 보인다. (C5 정함) */
  newInboundLotNo?: string | null;
  /** 새 부적합 번호. (C5 정함) */
  newNonconformanceNo?: string | null;
  /** 새 입하 LOT 에 불합격으로 확정된 IQC 검사(의뢰) 번호. (C5 정함) */
  newInspectionRequestNo?: string | null;
  /** 판정 조회 응답의 정보 수량(계약 §10 — 없으면 null). */
  sortGoodQty?: number | null;
  sortDefectQty?: number | null;
};

/**
 * 특채 요청 — `lotId` 를 비우면 부적합 LOT 전부(LOT 마다 특채 행, 결재 1건 · D-14). `approvedQty` 는 남은 수량과 같아야 한다.
 */
export type ConcessionCreateForward005 = Omit<
  components['schemas']['ConcessionCreate'],
  'lotId'
> & {
  lotId?: number;
};

/** 특채 요청 응답 — 지금 응답(`concessionId` = 첫 행) + 묶음(계약 §10). */
export type ConcessionCreatedForward005 = components['schemas']['Concession'] & {
  concessionIds: number[];
  approvalRequestId: number;
};

type NonconformanceListPath = paths['/quality/nonconformances'];
type NonconformanceDetailPath = paths['/quality/nonconformances/{nonconformanceId}'];
type DispositionDecisionsPath =
  paths['/quality/nonconformances/{nonconformanceId}/disposition-decisions'];
type ConcessionsPath = paths['/quality/concessions'];

export interface ForwardPaths005Quality {
  /** 행에 입하 LOT · IQC 매칭 요약을 더한다(계약 §10). */
  '/quality/nonconformances': Omit<NonconformanceListPath, 'get'> & {
    get: Omit<NonconformanceListPath['get'], 'responses'> & {
      responses: Omit<NonconformanceListPath['get']['responses'], 200> & {
        200: Json<{ items: NonconformanceForward005[]; page: PageMeta }>;
      };
    };
  };
  '/quality/nonconformances/{nonconformanceId}': Omit<NonconformanceDetailPath, 'get'> & {
    get: Omit<NonconformanceDetailPath['get'], 'responses'> & {
      responses: Omit<NonconformanceDetailPath['get']['responses'], 200> & {
        200: Omit<NonconformanceDetailPath['get']['responses'][200], 'content'> & {
          content: { 'application/json': NonconformanceForward005 };
        };
      };
    };
  };
  /** 판정 하나가 부적합 LOT 전부를 옮긴다 · 선별 본문 바뀜(계약 §10). 선별 응답은 200. */
  '/quality/nonconformances/{nonconformanceId}/disposition-decisions': Omit<
    DispositionDecisionsPath,
    'post'
  > & {
    post: Omit<DispositionDecisionsPath['post'], 'requestBody' | 'responses'> & {
      requestBody: { content: { 'application/json': DispositionDecisionCreateForward005 } };
      responses: Omit<DispositionDecisionsPath['post']['responses'], 201> & {
        200: Json<DispositionDecisionCreatedForward005>;
        201: Json<DispositionDecisionCreatedForward005>;
      };
    };
  };
  /** 전량 특채 — `lotId` 선택 · 응답에 묶음(계약 §10). */
  '/quality/concessions': Omit<ConcessionsPath, 'post'> & {
    post: Omit<ConcessionsPath['post'], 'requestBody' | 'responses'> & {
      requestBody: { content: { 'application/json': ConcessionCreateForward005 } };
      responses: Omit<ConcessionsPath['post']['responses'], 201> & {
        201: Json<ConcessionCreatedForward005>;
      };
    };
  };
}
