/*
 * 005 C-K4 덧댐 — 자재 관리 LOT 생애(대기 · 폐기) 안내 · 패키징 입력 · IQC 생략 입하 LOT(§11).
 * 서버 병합 뒤 `gen:api` 로 다시 만들고 이 파일을 걷는다(T111). 계약에 적히지 않아 화면이 정한 칸은 「(C5 정함)」 · 「(C6 정함)」.
 */
import type { components, paths } from './generated/api';
import type { Json, MaterialPackage } from './forward-contract';

/**
 * 005 `Lot` 응답에 더해진 칸(계약 §1 · 서버 계약 S7f `Lot`) — 입하 LOT · 패키징.
 * 생애(`lifecycleStatusCode`)는 이미 있는 칸이고 뜻만 넓어졌다(`WAITING` 대기 · `ACTIVE` 입하 · `VOIDED` 폐기).
 */
export type LotForward = components['schemas']['Lot'] & {
  /** 속한 입하 LOT — 입하 전 · 자재가 아닌 LOT 은 null. */
  inboundLotId?: number | null;
  inboundLotNo?: string | null;
  /** 패키징 — 없으면 null. 분할로 생긴 자식 LOT 은 패키징이 없다. */
  package?: MaterialPackage | null;
};

/**
 * IQC 생략 요청 · 실행 응답에 더해진 입하 LOT(계약 §11 「응답에 `inboundLotNo`·`lotCount` 추가」).
 * 서버 S10 전에는 오지 않으므로 선택 칸으로 둔다.
 */
export interface IqcSkipInboundLotForward {
  inboundLotNo?: string | null;
  /** 이 입하 LOT 의 자재 관리 LOT 수 — 생략은 이것 전부에 걸린다. */
  lotCount?: number | null;
}

type LotListPath = paths['/trace/lots'];
type LotListGet = LotListPath['get'];
type LotDetailPath = paths['/trace/lots/{lotId}'];
type LotDetailGet = LotDetailPath['get'];
type RequestSkipPath = paths['/trace/lots/{lotId}:request-iqc-skip'];
type RequestSkipPost = RequestSkipPath['post'];
type SkipPath = paths['/trace/lots/{lotId}:skip-iqc'];
type SkipPost = SkipPath['post'];

type ApprovalDetailPath = paths['/app/approval-requests/{approvalRequestId}'];
type ApprovalDetailGet = ApprovalDetailPath['get'];

/**
 * 결재 대상(`ApprovalTarget`)에 더한 칸 — 생략 실행에 쓸 대표 자재 관리 LOT(C5 정함 — 총괄 결정 2026-11-12).
 * S10 부터 IQC 생략 결재는 전부 `targetTypeCode = INBOUND_LOT` · `targetId` = 입하 LOT id 이고, 서버가 이 칸에
 * 그 입하 LOT 의 자재 관리 LOT 중 가장 작은 id 를 채운다. `:skip-iqc` · LOT 상태 조회는 이 id 로 부른다(계약 §11 —
 * 아무 자재 관리 LOT 이면 그 입하 LOT 전부). 다른 결재 유형에는 없거나 null.
 */
export type ApprovalTargetForward = components['schemas']['ApprovalTarget'] & {
  targetLotId?: number | null;
  /**
   * 입하 마감 취소로 이 생략이 무효가 됐는가(G2 L11 대비 — 칸 이름은 서버 보고 뒤 맞춘다, 지금은 C7 가정). 참이면 실행을 잠근다.
   */
  skipVoided?: boolean | null;
};

export type ApprovalRequestForward = Omit<components['schemas']['ApprovalRequest'], 'target'> & {
  target: ApprovalTargetForward;
};

export type ApprovalRequestDetailForward = Omit<
  components['schemas']['ApprovalRequestDetail'],
  'request'
> & { request: ApprovalRequestForward };

type LotDetailForward = Omit<components['schemas']['LotDetailResponse'], 'lot'> & {
  lot: LotForward;
};

export interface ForwardPaths005Lots {
  /** 005 — 목록 줄에 입하 LOT · 패키징(계약 §1). 생애로 대기 · 폐기 LOT 을 가른다(US1-6). */
  '/trace/lots': Omit<LotListPath, 'get'> & {
    get: Omit<LotListGet, 'responses'> & {
      responses: Omit<LotListGet['responses'], 200> & {
        200: Json<{ items: LotForward[]; page: components['schemas']['PageMeta'] }>;
      };
    };
  };
  /** 005 — 상세의 LOT 에도 같은 칸(계약 §1). W-01-02 대상 LOT 의 입하 LOT 번호. */
  '/trace/lots/{lotId}': Omit<LotDetailPath, 'get'> & {
    get: Omit<LotDetailGet, 'responses'> & {
      responses: Omit<LotDetailGet['responses'], 200> & { 200: Json<LotDetailForward> };
    };
  };
  /** 005 — W-01-02 가 결재 대상을 읽는 상세. 대상에 `targetLotId`(C5 정함 — 총괄 결정). */
  '/app/approval-requests/{approvalRequestId}': Omit<ApprovalDetailPath, 'get'> & {
    get: Omit<ApprovalDetailGet, 'responses'> & {
      responses: Omit<ApprovalDetailGet['responses'], 200> & {
        200: Json<ApprovalRequestDetailForward>;
      };
    };
  };
  /**
   * 005 — 생략 요청은 이 LOT 의 **마감된** 입하 LOT 단위(계약 §11). 응답에 입하 LOT 번호 · LOT 수.
   * 입하 중(마감 전)이면 409 — 칸 이름 · 코드는 계약에 없어 상태 코드로만 가른다(C5 정함).
   */
  '/trace/lots/{lotId}:request-iqc-skip': Omit<RequestSkipPath, 'post'> & {
    post: Omit<RequestSkipPost, 'responses'> & {
      responses: Omit<RequestSkipPost['responses'], 202> & {
        202: Json<components['schemas']['ApprovalRequestRef'] & IqcSkipInboundLotForward>;
      };
    };
  };
  /** 005 — 생략 실행은 입하 LOT 의 자재 관리 LOT 전부(계약 §11). 응답에 입하 LOT 번호 · LOT 수, 입하 중이면 409. */
  '/trace/lots/{lotId}:skip-iqc': Omit<SkipPath, 'post'> & {
    post: Omit<SkipPost, 'responses'> & {
      responses: Omit<SkipPost['responses'], 200> & {
        200: Json<LotDetailForward & IqcSkipInboundLotForward>;
        409: Json<components['schemas']['ErrorResponse']>;
      };
    };
  };
}
