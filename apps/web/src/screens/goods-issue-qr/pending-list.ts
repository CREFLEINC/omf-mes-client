/**
 * **QR 발행 대기 목록** — 자재창고 담당이 관리자 웹 없이 「무엇을 찍어야 하는가」를 보는 자리
 * (사용자 요구 2026-09-16 · ISSUE-QR-01 D5).
 *
 * ⚠⚠ **이 목록은 「최근 창」 안에서만 완전하다.** 서버에 **「미발행 라인만」 축이 없고** 라인을
 *    평면으로 묻는 경로도 없다(계약 실측 — `/logistics/goods-issue-lines` 없음). 그래서 화면은
 *    ① 최근 전표를 한 쪽 받아 ② 전표마다 라인을 묻고 ③ 발행 요약을 한 번에 받아 걸러 낸다.
 *    **창 밖의 오래된 미발행 건은 이 목록에 서지 않는다.**
 *
 * ⛔ **그 사실을 숨기지 않는다.** 화면이 창(며칠·몇 건)을 함께 적는다 — 「대기 없음」과 「창
 *    밖에 있음」이 같아 보이면, 담당은 찍어야 할 것을 못 찍고도 다 찍은 줄 안다.
 *    서버가 미발행 필터를 갖게 되면 이 모듈이 그 축 하나로 줄어든다(통합 담당에 변경안 전달).
 *
 * ⚠ **전표마다 한 번씩 부른다**(N+1). 창을 좁게 잡아 그 수를 묶어 둔다 — 넓히려면 서버 축이
 *   먼저다.
 */

import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

import { goodsIssueQrKeys, useDocumentIssueSummary } from './queries';
import { LINE_TARGET_TYPE_CODE, type GoodsIssue, type GoodsIssueLine } from './types';

/** 목록이 훑는 기간. 넓힐수록 호출이 는다 — 서버 축이 생기기 전까지의 타협이다. */
export const PENDING_WINDOW_DAYS = 7;
/** 한 번에 받아 둘 전표 수. 전표마다 라인 조회가 한 번씩 붙는다. */
export const PENDING_ISSUE_LIMIT = 20;

/** 자재 인계 출고만 본다 — 제품 출하는 이 화면 소관이 아니다. */
const MATERIAL_ISSUE_TYPE_CODE = 'PRODUCTION';
const POSTED = 'POSTED';

/**
 * 이 라인이 왜 대기인가 — **두 갈래이고 담당이 할 일이 다르다.**
 *
 * ⭐ `printFailed` 는 **이미 회차가 올라간** 라인이라 다시 찍으려면 **재발행 사유**가 필요하다
 *    (계약: 대상 중 하나라도 발행된 것이 있으면 사유 없이 422). 「미발행」과 한 덩어리로 보이면
 *    담당은 사유 칸이 왜 열렸는지 모른 채 막힌다.
 */
export type PendingReason =
  | { kind: 'notIssued' }
  | { kind: 'printFailed'; issueCount: number }
  /** 이미 찍힌 라인 — 「발행 완료」 쪽에 선다. 재발행 사유를 골라 다시 찍을 수 있다. */
  | { kind: 'issued'; issueCount: number };

export interface PendingLine {
  goodsIssueId: number;
  goodsIssueNo: string;
  issuedAt: string;
  destinationTypeCode?: string | null;
  destinationId?: number | null;
  line: GoodsIssueLine;
  reason: PendingReason;
}

export interface PendingList {
  /** 찍어야 할 라인 — 미발행이거나 **인쇄가 실패한** 것. 최근 전표가 위로 온다. */
  lines: readonly PendingLine[];
  /**
   * 이미 찍힌 라인 — **「발행 완료」 탭**(사용자 지시 2026-09-21 · omf-all-around#35).
   *
   * ⭐ 자재 LOT 라벨 발행(P-01-01)과 같은 짜임이다. 찍은 라인이 목록에서 통째로 빠지면
   *    **라벨이 찢어졌을 때 다시 찍을 길이 없다** — 담당이 전표 번호를 외워 들어가야 했다.
   */
  issuedLines: readonly PendingLine[];
  /** 창 안에서 **더 찍을 것이 없는** 라인 수. 「대기 없음」이 왜 비었는지 말할 때 쓴다. */
  issuedCount: number;
  isLoading: boolean;
  isError: boolean;
  /** 창 안의 전표를 다 받았는가 — 서버 총계가 받은 수보다 크면 창 밖이 더 있다. */
  truncated: boolean;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * 창이 시작하는 **날짜**(`YYYY-MM-DD`).
 *
 * ⛔ **`toISOString()` 을 쓰지 않는다.** 계약의 `issuedAtFrom` 은 `format: date` 라 date-time 을
 *    보내면 서버가 400 으로 되돌린다(실측 2026-09-16 — `must match format "date"`). 그때 목록이
 *    통째로 비고 화면은 「불러오지 못했습니다」만 말했다(ISSUE-QR-01 D6).
 *
 * ⛔ **UTC 로 자르지 않는다.** `toISOString().slice(0, 10)` 은 한국 시각 오전 9시 이전을 **전날**로
 *    민다 — 아침에 찍는 담당에게 창이 하루 어긋난다. 단말이 선 곳의 **현지 날짜**로 자른다
 *    (모바일 `material-picking/picking.ts` 의 `businessDateOf` 와 같은 셈법).
 */
const windowStart = (now: Date): string => {
  const from = new Date(now);
  from.setDate(from.getDate() - PENDING_WINDOW_DAYS);

  return `${String(from.getFullYear())}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
};

export const usePendingIssueLines = (): PendingList => {
  const { client } = useApiClient();

  const issues = useQuery({
    queryKey: goodsIssueQrKeys.pendingIssues,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/goods-issues', {
          params: {
            query: {
              statusCode: POSTED,
              issueTypeCode: MATERIAL_ISSUE_TYPE_CODE,
              issuedAtFrom: windowStart(new Date()),
              size: PENDING_ISSUE_LIMIT,
            },
          },
        }),
      );

      return data;
    },
  });

  /* 최근 것이 위로 온다 — 계약이 차례를 약속하지 않으므로 화면이 세운다. */
  const sorted = [...(issues.data?.items ?? [])].sort((left, right) =>
    right.issuedAt.localeCompare(left.issuedAt),
  );

  const lineQueries = useQueries({
    queries: sorted.map((issue) => ({
      queryKey: goodsIssueQrKeys.lines(issue.goodsIssueId),
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/logistics/goods-issues/{goodsIssueId}/lines', {
            params: { path: { goodsIssueId: issue.goodsIssueId } },
          }),
        );

        return data.items;
      },
    })),
  });

  /** 아직 왜 대기인지 가르기 «전»의 라인. 요약이 와야 갈래가 정해진다. */
  type PendingCandidate = Omit<PendingLine, 'reason'>;

  const all: PendingCandidate[] = sorted.flatMap((issue: GoodsIssue, index) =>
    (lineQueries[index]?.data ?? []).map((line) => ({
      goodsIssueId: issue.goodsIssueId,
      goodsIssueNo: issue.goodsIssueNo,
      issuedAt: issue.issuedAt,
      destinationTypeCode: issue.destinationTypeCode,
      destinationId: issue.destinationId,
      line,
    })),
  );

  /* 발행 현황은 **한 번에** 묻는다 — 라인마다 물으면 창 크기만큼 호출이 또 는다. */
  const summary = useDocumentIssueSummary(
    LINE_TARGET_TYPE_CODE,
    all.map((each) => each.line.goodsIssueLineId),
  );

  const byTarget = new Map((summary.data ?? []).map((each) => [each.targetId, each]));

  /**
   * 이 라인이 대기인가, 그렇다면 왜인가.
   *
   * ⭐ **찍혔는가로 가른다 — 발행됐는가가 아니다**(사용자 결정 2026-09-16 · D8). 발행 기록이
   *    남아도 **인쇄가 실패했으면 현장에 라벨이 없다.** 그 라인을 목록에서 빼면 담당은 라벨이
   *    없다는 사실을 알 길이 없다(계약도 「FAILED 면 화면이 재발행을 권한다」고 적었다).
   *
   * ⛔ **`PENDING` 을 대기로 세우지 않는다.** 보고가 아직 안 온 것이지 실패한 것이 아니다 —
   *    실패로 보면 방금 잘 찍은 라벨을 다시 찍게 한다.
   *
   * ⛔ **요약에 없는 라인도 대기로 세우지 않는다.** 계약이 요청한 대상 전건을 돌려준다고
   *    약속했으므로(`DocumentIssueSummaryResponse`) 빠진 행은 **「모른다」**이고, 모르는 것을
   *    대기로 보이면 이미 붙인 라벨을 다시 찍는다.
   */
  const reasonOf = (line: PendingCandidate): PendingReason | null => {
    const found = byTarget.get(line.line.goodsIssueLineId);

    if (found === undefined) return null;
    if (found.issueCount === 0) return { kind: 'notIssued' };

    return found.lastPrintOutcome === 'FAILED'
      ? { kind: 'printFailed', issueCount: found.issueCount }
      : { kind: 'issued', issueCount: found.issueCount };
  };

  /*
   * ⛔ **현황을 모르는 라인을 「대기」로 세우지 않는다.** 요약 조회가 아직이거나 실패했으면
   *    발행된 것을 대기로 보여 **이미 붙인 라벨을 다시 찍게** 만든다. 모를 때는 목록을 비우고
   *    화면이 그 사실을 말한다(아래 `isLoading`·`isError`).
   */
  const ready = summary.isSuccess;
  const classified = ready
    ? all.flatMap((each) => {
        const reason = reasonOf(each);

        return reason === null ? [] : [{ ...each, reason }];
      })
    : [];
  const pending = classified.filter((each) => each.reason.kind !== 'issued');
  const issued = classified.filter((each) => each.reason.kind === 'issued');

  return {
    lines: pending,
    issuedLines: issued,
    issuedCount: issued.length,
    isLoading:
      issues.isPending ||
      lineQueries.some((query) => query.isPending) ||
      (all.length > 0 && summary.isPending),
    isError: issues.isError || lineQueries.some((query) => query.isError) || summary.isError,
    truncated: issues.data !== undefined && issues.data.page.total > sorted.length,
  };
};
