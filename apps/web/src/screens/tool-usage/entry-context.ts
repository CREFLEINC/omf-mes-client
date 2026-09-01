import { useSearchParams } from 'react-router';

/**
 * 이 화면이 「어느 작업지시에서 · 누가」 들어왔는지.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** 스펙은 「POP 은 작업지시를 고른 뒤 진입하고 헤더에 고정한다」
 * 이고, 그 진입 화면(P-02-01)과 사번 인증(P-CO-01)이 아직 이 저장소에 없다. 그것들이 서면
 * **이 파일 하나가** 세션·셸에서 받는 형태로 바뀐다 — 화면 본문은 이 훅만 부르므로 그때 고칠
 * 자리가 한 곳으로 남는다.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로(계약: 없으면 거부),
 * 임시 사번을 채워 두면 화면은 저장되는 것처럼 보이고 실패는 서버에서야 드러난다.
 */
export interface PopEntry {
  /** 작업지시 식별자. 없으면 `null` */
  workOrderId: number | null;
  /** 귀속용 사번. 없으면 `null` */
  workerNo: string | null;
}

const parseWorkOrderId = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseWorkerNo = (value: string | null): string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

/** 둘 다 있어야 저장할 수 있다 — 하나만으로는 요청이 서지 않는다. */
export const hasEntry = (entry: PopEntry): boolean =>
  entry.workOrderId !== null && entry.workerNo !== null;

export const usePopEntry = (): PopEntry => {
  const [searchParams] = useSearchParams();

  return {
    workOrderId: parseWorkOrderId(searchParams.get('workOrderId')),
    workerNo: parseWorkerNo(searchParams.get('workerNo')),
  };
};
