import type { components } from '@omf-mes/api-client';

/**
 * W-04-10 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스(`disposal-issue`·`disposition-decision`)의
 * 같은 이름 파일을 참조하지 않는다. 타입 모양이 겹쳐도 각자 새로 쓴다.
 */

type DispositionDecisionResponse = components['schemas']['DispositionDecision'];
type PartnerResponse = components['schemas']['Partner'];

/**
 * ① 폐기 대상 — **처분 결정** 한 건.
 *
 * ⭐ **처분 유형은 «폐기»만 온다** — 질의가 `dispositionTypeCode=SCRAP` 으로 좁힌다(`queries.ts`).
 * 한때 값 목록이 없어 거르지 못하고 열로 보여 사람이 가리게 했는데, 통지 `#674` 로 축이 닫혔다.
 * 열은 그대로 둔다 — 좁혀진 목록이라도 **무엇으로 판정된 것인지**는 보여야 한다.
 *
 * ⚠ `lotNo`·`itemId` 가 선택 필드다. 없으면 「없는 것」이 아니라 **못 받은 것**이라 표시 지점에서
 * 사실을 적는다.
 */
export interface DisposalTarget {
  dispositionDecisionId: number;
  nonconformanceNo: string | null;
  dispositionTypeCode: string;
  decisionQty: number;
  uomId: number;
  /** ⭐ 폐기 요청 사유의 기본값이 된다(§5-5) — 승인자가 판정 근거를 바로 본다. */
  reason: string;
  /**
   * ⚠ **식별자다** — 계약이 `number` 로 닫았다. 사람 이름은 `decidedByName` 이 따로 낸다.
   * 한때 이 자리를 `string` 으로 두어 화면에 식별자가 이름처럼 찍힐 뻔했다.
   */
  decidedBy: number;
  decidedByName: string | null;
  decidedAt: string;
  lotId: number | null;
  lotNo: string | null;
  itemId: number | null;
}

export const toDisposalTarget = (data: DispositionDecisionResponse): DisposalTarget => ({
  dispositionDecisionId: data.dispositionDecisionId,
  nonconformanceNo: data.nonconformanceNo ?? null,
  dispositionTypeCode: data.dispositionTypeCode,
  decisionQty: data.decisionQty,
  uomId: data.uomId,
  reason: data.reason,
  decidedBy: data.decidedBy,
  decidedByName: data.decidedByName ?? null,
  decidedAt: data.decidedAt,
  lotId: data.lotId ?? null,
  lotNo: data.lotNo ?? null,
  itemId: data.itemId ?? null,
});

export interface DisposalPartner {
  partnerId: number;
  label: string;
}

export const toDisposalPartner = (data: PartnerResponse): DisposalPartner => ({
  partnerId: data.partnerId,
  label: `${data.partnerCode} · ${data.partnerName}`,
});

/** 고른 대상들의 수량 합. 단위가 섞이면 합이 성립하지 않으므로 `null`을 낸다. */
export const totalQtyOf = (targets: readonly DisposalTarget[]): number | null => {
  if (targets.length === 0) return 0;

  const [first] = targets;
  if (first === undefined) return 0;
  /*
   * ⚠ **단위가 섞이면 더하지 않는다.** 「40 EA + 120 KG = 160」은 아무 뜻도 없는 수인데,
   * 되돌릴 수 없는 폐기 앞에서 사용자가 그 수를 보고 판단한다.
   */
  if (targets.some((target) => target.uomId !== first.uomId)) return null;

  return targets.reduce((sum, target) => sum + target.decisionQty, 0);
};

/**
 * 고른 대상들의 처분 사유를 요청 사유의 기본값으로 옮긴다(§5-5).
 *
 * ⭐ 여러 건이면 줄로 잇는다 — 승인자가 **건마다 무엇 때문인지**를 봐야 한다. 하나로 뭉치면
 * 가장 흔한 사유만 남고 예외적인 한 건이 사라진다.
 */
export const quotedReason = (targets: readonly DisposalTarget[]): string => {
  const reasons = [
    ...new Set(targets.map((target) => target.reason.trim()).filter((r) => r !== '')),
  ];
  return reasons.join('\n');
};
