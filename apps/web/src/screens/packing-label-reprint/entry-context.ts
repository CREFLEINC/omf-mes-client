import { useSearchParams } from 'react-router';

/**
 * 이 화면이 「어느 포장 단위에서 · 누가」 들어왔는지.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** 포장 단위는 포장 작업(`P-02-08`)이 만들고 그 화면이 이
 * 주소로 넘기는데, 그것이 아직 이 저장소에 없다(#76). 그것이 서면 **이 파일 하나가** 세션·셸에서
 * 받는 형태로 바뀐다 — 화면 본문은 이 훅만 부른다(전례 `P-02-05`).
 *
 * ⚠ **사번을 `patterns/worker-session` 에서 읽지 않는다.** POP 쓰기 화면들이 아직 각자 다른
 * 출처를 쓰고 있고, 모으는 일은 셸이 `pop-identity` 를 채우는 시점이다 — 여기서만 앞질러
 * 옮기면 출처가 더 갈린다.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로, 임시 사번을 채워
 * 두면 화면은 재출력되는 것처럼 보이고 실패는 서버에서야 드러난다.
 */
export interface ReprintEntry {
  /** 포장 단위 식별자. 이 화면의 모든 조회가 이 축에서 시작한다. 없으면 `null` */
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

/** 발행·인쇄 결과 보고 모두 사번을 요구한다 — 없으면 쓰기를 시도하지 않는다. */
export const canWrite = (entry: ReprintEntry): boolean => entry.workerNo !== null;

export const useReprintEntry = (): ReprintEntry => {
  const [searchParams] = useSearchParams();

  return {
    handlingUnitId: parseId(searchParams.get('handlingUnitId')),
    workerNo: parseWorkerNo(searchParams.get('workerNo')),
  };
};
