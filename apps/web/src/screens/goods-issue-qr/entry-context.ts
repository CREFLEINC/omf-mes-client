import { useSearchParams } from 'react-router';

/**
 * 이 화면이 「어느 출고 전표에서 · 누가」 들어왔는지.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** 창고 스테이션 모드가 전표를 고른 뒤 이 화면으로 넘기고
<<<<<<< HEAD
 * 사번은 사번 경량 인증(P-CO-01)이 `patterns/worker-session` 에 두는데, 전자는 아직 없고
 * 후자는 **그 자리를 읽는 화면이 아직 없다**(`P-02-05` 가 같은 사정을 적어 두었다). 그때
 * **이 파일 하나가** 세션·셸에서 받는 형태로 바뀐다 — 화면 본문은 이 훅만 부른다.
=======
 * 사번은 사번 경량 인증(P-CO-01)이 단말에 두는 값인데, 전자는 아직 없고 후자는 화면은 섰으나
 * **고른 사번을 다른 화면에 건네는 자리가 아직 없다.** 그 통로가 서면 **이 파일 하나가**
 * 세션·셸에서 받는 형태로 바뀐다 — 화면 본문은 이 훅만 부른다.
>>>>>>> origin/feat/140-pop-shipment-qr-issue
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로(귀속 조항), 임시
 * 사번을 채워 두면 화면은 발행되는 것처럼 보이고 실패는 서버에서야 드러난다.
 *
 * 전례: `screens/tool-usage/entry-context.ts`(P-05-01) — 같은 사정, 같은 형태.
 */
export interface GoodsIssueQrEntry {
  /** 출고 전표 식별자. 없으면 `null` */
  goodsIssueId: number | null;
  /** 귀속용 사번. 없으면 `null` */
  workerNo: string | null;
}

const parseGoodsIssueId = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseWorkerNo = (value: string | null): string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

/** 둘 다 있어야 발행할 수 있다 — 전표만으로는 쓰기가 서지 않는다. */
export const canIssue = (entry: GoodsIssueQrEntry): boolean =>
  entry.goodsIssueId !== null && entry.workerNo !== null;

export const useGoodsIssueQrEntry = (): GoodsIssueQrEntry => {
  const [searchParams] = useSearchParams();

  return {
    goodsIssueId: parseGoodsIssueId(searchParams.get('goodsIssueId')),
    workerNo: parseWorkerNo(searchParams.get('workerNo')),
  };
};
