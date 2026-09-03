import { useSearchParams } from 'react-router';

/**
 * 이 화면이 「어느 작업지시에서 · 누가」 들어왔는지.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** POP 은 작업지시를 고른 뒤 진입하고 헤더에 고정하는데, 그
 * 진입 화면(`P-02-01`)이 아직 이 저장소에 없다. 그것이 서면 **이 파일 하나가** 세션·셸에서
 * 받는 형태로 바뀐다 — 화면 본문은 이 훅만 부른다(전례 `P-02-05`·`P-05-01`).
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로(계약: 없으면 거부),
 * 임시 사번을 채워 두면 화면은 저장되는 것처럼 보이고 실패는 서버에서야 드러난다.
 */
export interface ResultEntry {
  /** 작업지시 식별자. 대상 LOT·잔여수량·PQC 대기 조회가 전부 이 축으로 선다. 없으면 `null` */
  workOrderId: number | null;
  /** 귀속용 사번. 저장의 `X-Worker-No` 헤더에 실린다. **인증이 아니라 귀속이다.** 없으면 `null` */
  workerNo: string | null;
}

const POSITIVE_INTEGER = /^\d+$/;

/**
 * 자원 번호는 1부터 매겨지므로 `0`·음수·소수·문자는 **어떤 자원도 가리키지 않는다.**
 * 그대로 실어 보내면 서버가 무엇을 하는지 계약이 말하지 않는다.
 */
const parseWorkOrderId = (value: string | null): number | null => {
  if (value === null || !POSITIVE_INTEGER.test(value)) return null;

  const parsed = Number(value);

  return parsed >= 1 ? parsed : null;
};

const parseWorkerNo = (value: string | null): string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

/** 저장은 사번을 요구한다 — 없으면 시도조차 하지 않는다. */
export const canWrite = (entry: ResultEntry): boolean => entry.workerNo !== null;

export const useResultEntry = (): ResultEntry => {
  const [searchParams] = useSearchParams();

  return {
    workOrderId: parseWorkOrderId(searchParams.get('workOrderId')),
    workerNo: parseWorkerNo(searchParams.get('workerNo')),
  };
};
