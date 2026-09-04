import type { components } from '@omf-mes/api-client';

/**
 * 스캔 한 번이 무엇을 낳는가.
 *
 * **칸이 하나이고 담기는 것도 하나다**(스펙 §3) — 이 화면은 「신규 부품 LOT」 한 건을 읽어
 * 그것으로 이전 투입을 잇는다. `P-02-03`처럼 여럿을 쌓지 않는다.
 *
 * ⛔ **금형을 여기서 읽지 않는다.** 교체 등록은 자재 축(`material_consumption`)이고 금형은
 * 그 축에 자리가 없다(요구서 §3-19). 지금 물린 금형은 세션이 알려 주고 이 화면은 **보이기만**
 * 한다(`mold.ts`).
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type LotResponse = components['schemas']['Lot'];

/**
 * 스캔한 코드를 다듬는다. 쓸 수 없으면 `null`.
 *
 * 스캐너는 코드 끝에 개행이나 캐리지리턴을 붙여 보내고, 직접 칠 때는 앞뒤 공백이 섞인다.
 * **다듬지 않은 값을 조회에 실으면 같은 LOT 이 매번 다른 검색어가 된다.**
 */
export const normalizeScanCode = (raw: string): string | null => {
  const trimmed = raw.trim();

  return trimmed === '' ? null : trimmed;
};

/** 읽어 담은 신규 부품 LOT. */
export interface ScannedPart {
  lotId: number;
  lotNo: string;
  itemId: number;
  uomId: number;
  /** 품질 판정 축. **화면이 이 값으로 막지 않는다** — 교체 가부는 서버가 정한다. */
  statusCode: string;
  /** 지금 보류 중인지. 역시 표시만 한다. */
  isHeld: boolean;
}

export const toScannedPart = (lot: LotResponse): ScannedPart => ({
  lotId: lot.lotId,
  lotNo: lot.lotNo,
  itemId: lot.itemId,
  uomId: lot.uomId,
  statusCode: lot.statusCode,
  isHeld: lot.held ?? false,
});

/**
 * 스캔 결과.
 *
 * `ambiguous`는 검색어 하나에 여러 건이 걸린 것이다. 화면이 **고르지 않는다** — 어느 것을
 * 고를지 판단할 근거가 없고, 틀리면 다른 부품이 계보에 들어간다. 교체 기록은 지워지지
 * 않으므로(§5-2 · B-3) 그 잘못이 그대로 남는다.
 *
 * ⭐ **읽은 코드(`code`)를 함께 들고 다닌다.** 검색이 번호의 일부·외부 식별자로도 걸리므로
 * 읽은 것과 찾은 것이 다를 수 있다 — 화면이 둘을 함께 보여야 작업자가 잘못 걸린 것인지
 * 판단할 수 있다.
 */
export type ScanOutcome =
  | { kind: 'part'; code: string; part: ScannedPart }
  | { kind: 'ambiguous'; count: number }
  | { kind: 'not-found'; code: string };
