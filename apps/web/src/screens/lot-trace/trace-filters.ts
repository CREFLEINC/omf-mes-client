/**
 * 고른 LOT과 지나온 경로의 주소 값, 다른 화면이 이 화면을 여는 주소. 조회 조건은 `filters.ts`가 맡는다.
 */

/** 지나온 LOT 하나. 상세에서 [보기]로 다른 LOT을 가운데 두면 쌓이고, 상세 머리 위 경로 줄이 이것으로 그려진다. */
export interface PathStep {
  lotType: 'MATERIAL' | 'PRODUCTION';
  lotId: number;
  lotNo: string;
}

const POSITIVE = /^[1-9][0-9]*$/;

export const readTraceSelected = (params: URLSearchParams): number | null => {
  const raw = params.get('selected');
  return raw !== null && POSITIVE.test(raw) ? Number(raw) : null;
};

/**
 * [보기]로 `next`를 가운데 둘 때의 경로. 이미 지나온 LOT이면 그 자리까지 되돌려 경로가 돌며 늘지 않게 한다
 * (자재 → 생산 → 같은 자재). 아니면 지금 LOT(`here`)을 끝에 붙인다.
 */
export const pathTo = (path: readonly PathStep[], here: PathStep, next: PathStep): PathStep[] => {
  const index = path.findIndex((step) => step.lotId === next.lotId);
  return index >= 0 ? path.slice(0, index) : [...path, here];
};

const STEP_SEPARATOR = '~';

/** 지나온 경로. 가운데 LOT(`selected`)이 없으면 경로도 뜻이 없어 비운다. 깨진 단계는 버린다. */
export const readPath = (params: URLSearchParams): PathStep[] =>
  readTraceSelected(params) === null
    ? []
    : params.getAll('via').flatMap((raw) => {
        const [type, id, ...rest] = raw.split(STEP_SEPARATOR);
        const lotNo = rest.join(STEP_SEPARATOR);
        if (type !== 'M' && type !== 'P') return [];
        if (id === undefined || !POSITIVE.test(id) || lotNo === '') return [];
        return [
          {
            lotType: type === 'M' ? 'MATERIAL' : 'PRODUCTION',
            lotId: Number(id),
            lotNo,
          } satisfies PathStep,
        ];
      });

const writeStep = (step: PathStep): string =>
  [step.lotType === 'MATERIAL' ? 'M' : 'P', String(step.lotId), step.lotNo].join(STEP_SEPARATOR);

/** 주소에 지나온 경로를 붙인다. */
export const appendPath = (params: URLSearchParams, path: readonly PathStep[]): URLSearchParams => {
  for (const step of path) params.append('via', writeStep(step));
  return params;
};

/** LOT 생산 이력 조회 화면 주소. 다른 화면(W-03-01 LOT 상세)이 한 LOT의 이력을 열 때 쓴다. */
export const LOT_TRACE_PATH = '/production/lot-trace';

/**
 * 한 LOT의 이력을 여는 주소 — 자재 LOT은 자재 LOT 번호, 그 밖의 LOT(생산, 제품)은 제품 LOT 번호 조건으로 찾고
 * 그 LOT을 상세에 세운다(`selected`). 기간은 화면이 기본 기간으로 채운다.
 */
export const lotTraceHref = (lot: { lotId: number; lotNo: string; lotTypeCode: string }): string =>
  `${LOT_TRACE_PATH}?${new URLSearchParams({
    [lot.lotTypeCode === 'MATERIAL' ? 'mlot' : 'plot']: lot.lotNo,
    selected: String(lot.lotId),
  }).toString()}`;
