import { useSearchParams } from 'react-router';

/**
 * 이 화면이 「어느 포장에 · 누가」 라벨을 붙이는지.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** 스펙은 ① 발행 대기 목록에서 대상을 «고르는» 화면으로
 * 그렸는데, 그 목록을 계약이 세우지 못한다(`omf-mes#418` · `types.ts` 머리). 앞단이 정해지면
 * **이 파일 하나가** 목록 선택에서 받는 형태로 바뀐다 — 화면 본문은 이 훅만 부른다
 * (전례 `P-02-09` `packing-label-reprint/entry-context.ts`).
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로, 임시 사번을 채워
 * 두면 화면은 발행되는 것처럼 보이고 실패는 서버에서야 드러난다.
 */
export interface RepackLabelEntry {
  /** 대상 포장. 이 화면의 모든 조회가 이 축에서 시작한다. 없으면 `null` */
  handlingUnitId: number | null;
  /** 귀속용 사번. 발행·인쇄 결과 보고의 `X-Worker-No` 헤더에 실린다. 없으면 `null` */
  workerNo: string | null;
}

const parseId = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseWorkerNo = (value: string | null): string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export const useRepackLabelEntry = (): RepackLabelEntry => {
  const [searchParams] = useSearchParams();

  return {
    handlingUnitId: parseId(searchParams.get('handlingUnitId')),
    workerNo: parseWorkerNo(searchParams.get('workerNo')),
  };
};
