import type { components } from '@omf-mes/api-client';

/**
 * 스캔 한 번이 무엇을 낳는가.
 *
 * **칸이 하나다**(스펙 §3) — 자재LOT과 금형을 같은 자리에서 받는다. 작업자가 무엇을 스캔할지
 * 미리 고르지 않는다. 그래서 「어느 쪽인지」는 조회 결과가 정한다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type LotResponse = components['schemas']['Lot'];
type MoldResponse = components['schemas']['Mold'];

/**
 * 스캔한 코드를 다듬는다. 쓸 수 없으면 `null`.
 *
 * 스캐너는 코드 끝에 개행이나 캐리지리턴을 붙여 보내고, 직접 칠 때는 앞뒤 공백이 섞인다.
 * **다듬지 않은 값을 조회에 실으면 같은 LOT이 매번 다른 검색어가 된다.**
 */
export const normalizeScanCode = (raw: string): string | null => {
  const trimmed = raw.trim();

  return trimmed === '' ? null : trimmed;
};

/** 담긴 자재LOT 한 줄. */
export interface ScannedMaterial {
  lotId: number;
  lotNo: string;
  itemId: number;
  uomId: number;
  /** 품질 판정 축. **화면이 이 값으로 막지 않는다** — 투입 가부는 서버가 정한다(스펙 §5-2). */
  statusCode: string;
  /** 지금 보류 중인지. 역시 표시만 한다. */
  isHeld: boolean;
}

export const toScannedMaterial = (lot: LotResponse): ScannedMaterial => ({
  lotId: lot.lotId,
  lotNo: lot.lotNo,
  itemId: lot.itemId,
  uomId: lot.uomId,
  statusCode: lot.statusCode,
  isHeld: lot.held ?? false,
});

/** 담긴 금형. **한 번에 하나다**(스펙 §3의 투입 목록에 금형 줄이 하나다). */
export interface ScannedMold {
  moldId: number;
  moldCode: string;
  moldName: string;
  currentShotCount: number;
  /** 적정 타수. 마스터에 없을 수 있다 — 그때 남은 타수는 **산출 불가**이지 0이 아니다. */
  guaranteedShotCount: number | null;
  /** 서버가 계산한 남은 타수. 적정 타수가 없으면 `null`이다. */
  availableShotCount: number | null;
}

export const toScannedMold = (mold: MoldResponse): ScannedMold => ({
  moldId: mold.moldId,
  moldCode: mold.moldCode,
  moldName: mold.moldName,
  currentShotCount: mold.currentShotCount,
  guaranteedShotCount: mold.guaranteedShotCount ?? null,
  availableShotCount: mold.availableShotCount ?? null,
});

/**
 * 스캔 결과.
 *
 * `duplicate`는 실패가 아니다 — 같은 LOT을 두 번 읽는 것은 현장에서 흔하고, 그때 줄을 늘리면
 * **같은 자재가 두 번 투입된 것처럼 보인다.**
 *
 * `ambiguous`는 검색어 하나에 여러 건이 걸린 것이다. 화면이 **고르지 않는다** — 어느 것을
 * 고를지 판단할 근거가 없고, 틀리면 다른 자재가 계보에 들어간다.
 *
 * ⭐ **읽은 코드(`code`)를 함께 들고 다닌다.** 검색이 번호의 일부·외부 식별자로도 걸리므로
 * 읽은 것과 찾은 것이 다를 수 있다 — 화면이 둘을 함께 보여야 작업자가 잘못 걸린 것인지
 * 판단할 수 있다.
 */
export type ScanOutcome =
  | { kind: 'material'; code: string; material: ScannedMaterial }
  | { kind: 'mold'; code: string; mold: ScannedMold }
  | { kind: 'duplicate'; code: string; lotNo: string }
  | { kind: 'ambiguous'; count: number }
  | { kind: 'not-found'; code: string };

/** 화면이 들고 있는 투입 후보. 아직 보내지 않은 것이다. */
export interface ScanDraft {
  materials: ScannedMaterial[];
  mold: ScannedMold | null;
}

export const EMPTY_SCAN_DRAFT: ScanDraft = { materials: [], mold: null };

/**
 * 스캔 결과를 후보에 담는다. **담을 것이 없으면 그대로 돌려준다**(같은 참조).
 *
 * 금형은 **덮어쓴다** — 러닝체인지로 금형을 바꾸면 새로 스캔한 것이 지금 물린 금형이다.
 * 자재는 쌓는다.
 */
export const applyScan = (draft: ScanDraft, outcome: ScanOutcome): ScanDraft => {
  switch (outcome.kind) {
    case 'material':
      return { ...draft, materials: [...draft.materials, outcome.material] };
    case 'mold':
      return { ...draft, mold: outcome.mold };
    case 'duplicate':
    case 'ambiguous':
    case 'not-found':
      return draft;
  }
};

/** 이미 담긴 LOT인가. 번호가 아니라 **`lotId`**로 본다 — 표기는 같아도 다른 LOT일 수 있다. */
export const hasMaterial = (draft: ScanDraft, lotId: number): boolean =>
  draft.materials.some((material) => material.lotId === lotId);

/**
 * 금형 타발수가 한도를 넘었는가.
 *
 * ⚠ **넘어도 막지 않는다.** 스펙 §8 미결 #6이 차단 여부를 정하지 않았고, 착수 이슈가 그 항목을
 * 「만들지 않는다 — 경고만」으로 처리했다. 여기서 차단을 만들면 설계가 정한 적 없는 규칙이
 * 현장에 굳는다.
 *
 * 적정 타수가 없으면 **넘었는지 알 수 없다** — `false`가 아니라 판정 자체가 서지 않으므로
 * 화면은 「산출 불가」로 말한다(`availableShotCount`가 `null`인 것이 그 표현이다).
 */
export const isShotCountExceeded = (mold: ScannedMold): boolean =>
  mold.availableShotCount !== null && mold.availableShotCount <= 0;
