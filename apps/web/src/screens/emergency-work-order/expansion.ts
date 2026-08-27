import type { Bom, Routing, RoutingOperation } from './types';

/**
 * 조회 하나의 상태를 이 모듈이 쓰는 만큼만 추린 것.
 *
 * 훅을 그대로 받지 않는 이유는 **판정을 조회 라이브러리에서 떼어 놓기 위해서**다 — 이 판정은
 * 순수 함수여야 「BOM 이 없을 때 무엇이 막히는가」를 조회 없이 확인할 수 있다.
 */
export interface LoadState<TValue> {
  /**
   * ⚠ **조회 훅의 `isLoading` 을 그대로 넣지 않는다.** 그 값은 «꺼 둔» 조회와 «연결이 끊겨
   * 멈춘» 조회에 대해 거짓이라, 그대로 넣으면 아직 묻지도 않은 것이 「받는 중」에서 빠지고
   * 아래 `value` 가 비어 「없다」로 읽힌다. 이 저장소의 다른 조회들이 쓰는 모양 —
   * **`<조회를 열었는가> && isPending`** — 을 그대로 쓴다.
   */
  isLoading: boolean;
  isError: boolean;
  /** ⛔ **「빈 목록」과 「아직 목록 없음」은 다르다.** 받지 못한 동안은 `undefined` 여야 한다. */
  value: TValue | undefined;
}

export interface ExpansionInput {
  /** 고른 품목. 고르지 않았으면 `null`. */
  itemId: number | null;
  boms: LoadState<Bom[]>;
  routings: LoadState<Routing[]>;
  /** 사람이 고른 Routing 개정. 개정이 하나면 화면이 그것으로 채워 준다. */
  selectedRoutingId: number | null;
  operations: LoadState<RoutingOperation[]>;
}

/**
 * 전개의 상태.
 *
 * ⭐ **하나의 합 타입으로 둔다.** 「BOM 이 있는가」·「Routing 이 있는가」·「고른 개정이
 * 있는가」를 각각 참·거짓으로 들고 다니면 **조합 중 어느 하나를 빠뜨린 화면**이 나온다 —
 * 예를 들어 「Routing 은 있는데 공정이 비어 있다」가 «준비됨»으로 새어 발행이 열린다.
 */
export type ExpansionState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'blocked'; reason: ExpansionBlockReason }
  | { kind: 'needsRevision'; routings: Routing[] }
  | { kind: 'ready'; bom: Bom; routing: Routing; operations: RoutingOperation[] };

export type ExpansionBlockReason =
  'bomMissing' | 'routingMissing' | 'bothMissing' | 'operationsMissing';

/**
 * 기본으로 보일 BOM 을 고른다.
 *
 * 계약이 `isDefault` 를 갖고 있어 **어느 것이 기본인지 서버가 이미 정해 두었다** — 화면이
 * 「첫 번째」로 고르면 서버가 정한 기본과 다른 것을 보일 수 있다. 기본 표시가 없으면 그때만
 * 첫 번째를 쓴다.
 */
const defaultBom = (boms: Bom[]): Bom | undefined => boms.find((bom) => bom.isDefault) ?? boms[0];

/**
 * 아직 답을 받지 못한 조회인가.
 *
 * ⛔ **`isLoading` 만으로는 부족하다.** 조회 라이브러리는 «꺼 둔» 조회를 「받는 중」으로
 * 보고하지 않는다 — 받는 중도 아니고 실패도 아닌데 값이 없는 상태가 있다. 그것을 값 없음으로
 * 읽으면 **「아직 안 받았다」가 「없다」로 바뀐다** — 사용자는 있는 BOM 을 없다고 듣고
 * 기준정보를 뒤지러 간다.
 *
 * 성공한 빈 응답은 `[]` 라 여기에 걸리지 않는다. 「빈 목록」과 「목록 없음」이 갈리는 자리다.
 */
const isUnsettled = <TValue>(state: LoadState<TValue>): boolean =>
  state.isLoading || state.value === undefined;

/**
 * 전개 판정.
 *
 * 순서가 뜻을 갖는다 — **고르기 전 → 실패 → 받는 중 → 없음 → 개정 고르기 → 준비됨.**
 *
 * ⚠ **실패를 「없음」보다 먼저 본다.** 조회가 실패했는데 「BOM 이 없습니다」로 말하면 사용자가
 * 없는 문제를 고치러 간다 — 기준정보를 뒤지거나 BOM 을 새로 만들려 한다. 받지 못한 것과
 * 없는 것은 다른 사실이다.
 *
 * ⚠ **개정이 하나뿐이어도 「고른 상태」를 요구한다.** 화면이 자동으로 채워 주더라도 판정은
 * 「골랐는가」만 본다 — 자동으로 채우는 쪽이 나중에 바뀌어도 **고르지 않은 채 발행되는 길이
 * 열리지 않는다.**
 */
export const resolveExpansion = (input: ExpansionInput): ExpansionState => {
  if (input.itemId === null) return { kind: 'idle' };

  if (input.boms.isError || input.routings.isError) return { kind: 'error' };
  if (isUnsettled(input.boms) || isUnsettled(input.routings)) return { kind: 'loading' };

  /*
   * ⛔ **다른 품목의 것을 걸러 낸다.** 품목을 바꾸면 새 조회가 시작되지만, 그 사이 화면이
   * 앞 품목의 응답을 그대로 들고 있을 수 있다. 거르지 않으면 **고른 적 없는 품목의 BOM 을
   * 보고 발행**하게 된다 — 되돌릴 수 없는 지시라 「곧 갱신되니 괜찮다」로 둘 수 없다.
   */
  const boms = (input.boms.value ?? []).filter((bom) => bom.parentItemId === input.itemId);
  const routings = (input.routings.value ?? []).filter(
    (routing) => routing.itemId === input.itemId,
  );
  const bom = defaultBom(boms);
  const hasBom = bom !== undefined;
  const hasRouting = routings.length > 0;

  if (!hasBom && !hasRouting) return { kind: 'blocked', reason: 'bothMissing' };
  if (!hasBom) return { kind: 'blocked', reason: 'bomMissing' };
  if (!hasRouting) return { kind: 'blocked', reason: 'routingMissing' };

  /*
   * ⛔ **개정의 상태 코드로 거르지 않는다.** 계약이 「상태(작성중/확정/폐기)를 가리지 않고
   * 전부 낸다」고 스스로 적었고, 상태 코드로 거르는 것은 화면이 값을 해석하는 일이라 값이
   * 정해질 때 조용히 틀린다. 대신 **고르는 자리에 상태를 함께 보여** 사람이 알고 고르게 한다.
   * ⚠ 폐기된 개정으로도 발행이 되는 것이 옳은지는 설계 저장소에 물어 두었다.
   */
  const routing = routings.find((candidate) => candidate.routingId === input.selectedRoutingId);
  if (routing === undefined) return { kind: 'needsRevision', routings };

  /*
   * ⭐ **공정의 상태는 개정을 고른 «뒤에» 본다.** 앞에서 함께 보면, 앞 개정에서 남은 조회
   * 실패가 「BOM 이 없다」·「개정을 고르라」를 덮어 버린다 — 사용자는 고칠 수 있는 문제를
   * 못 보고 「받지 못했습니다」만 본다.
   */
  if (input.operations.isError) return { kind: 'error' };
  if (isUnsettled(input.operations)) return { kind: 'loading' };

  /*
   * ⛔ **고른 개정의 줄만 남긴다.** 개정을 바꾼 직후에는 앞 개정의 공정이 남아 있을 수 있고,
   * 그것을 그대로 쓰면 **화면은 새 개정을 보이면서 옛 개정의 공정으로 발행**한다.
   */
  const operations = (input.operations.value ?? []).filter(
    (operation) => operation.routingId === routing.routingId,
  );
  /*
   * 공정이 0줄인 Routing 은 전개할 것이 없다. 발행 본문이 공정 라인 하나를 필수로 받으므로
   * 이 자리를 열어 두면 **보낼 값이 없는 채로 발행이 활성**된다.
   */
  if (operations.length === 0) return { kind: 'blocked', reason: 'operationsMissing' };

  return { kind: 'ready', bom, routing, operations: sortedBySeq(operations) };
};

/** 공정은 순서대로 보인다 — 응답 순서에 기대지 않는다. */
const sortedBySeq = (operations: RoutingOperation[]): RoutingOperation[] =>
  [...operations].sort((left, right) => left.operationSeq - right.operationSeq);

/**
 * 발행 본문에 실을 공정 라인.
 *
 * **첫 공정의 줄을 싣는다.** 계약이 W/O 하나에 공정 라인 하나를 받고, 전개는 서버가 이어서
 * 한다 — 화면이 고르는 것은 「어디서 시작하는가」다. 순서가 가장 앞선 줄이 그 답이다.
 */
export const issueRoutingOperationId = (state: ExpansionState): number | null =>
  state.kind === 'ready' ? (state.operations[0]?.routingOperationId ?? null) : null;
