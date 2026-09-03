import { useSearchParams } from 'react-router';

/**
 * 이 화면이 「어느 작업지시에서 · 누가」 들어왔는지.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** POP 은 작업지시를 고른 뒤 진입해 헤더에 고정하는데, 그
 * 진입 화면(`P-02-01`)이 아직 이 저장소에 없다. 그것이 서면 **이 파일 하나가** 세션·셸에서
 * 받는 형태로 바뀐다 — 화면 본문은 이 훅만 부른다(전례 `P-02-05`·`P-05-01`).
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로, 임시 사번을 채워
 * 두면 화면은 발행되는 것처럼 보이고 실패는 서버에서야 드러난다.
 */
export interface LotLabelEntry {
  /** 작업지시 식별자. 완료 LOT 목록을 이 축으로 좁힌다. 없으면 `null` */
  workOrderId: number | null;
  /** 귀속용 사번. 발행·인쇄 보고의 `X-Worker-No` 헤더에 실린다. 없으면 `null` */
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

/** 발행도 인쇄 결과 보고도 사번을 요구한다 — 없으면 쓰기를 시도하지 않는다(슬라이스 ③). */
export const canWrite = (entry: LotLabelEntry): boolean => entry.workerNo !== null;

export const useLotLabelEntry = (): LotLabelEntry => {
  const [searchParams] = useSearchParams();

  return {
    workOrderId: parseWorkOrderId(searchParams.get('workOrderId')),
    workerNo: parseWorkerNo(searchParams.get('workerNo')),
  };
};
