import { messages } from '@omf-mes/i18n';

import { formatBaseQty } from '../../patterns/package-qty';
import { PuButton, PuDialog, PuNote } from '../../patterns/pop-uniform';
import {
  needsReissueReason,
  useSplitMaterialLots,
  type SplitMaterialLot,
} from '../goods-issue-qr/split-lots';
import { useSplitLabelPrint, type SplitPrintResult } from '../goods-issue-qr/split-print';

/* 부를 때 읽는다 — 단말 언어(`setLocale`)를 모듈이 실릴 때 붙잡지 않는다. */
const words = () => messages.materialReturn.label;

export interface LabelPrinter {
  printerName: string | null;
  shellPrinterName: string | null;
}

export type LabelOutcome =
  | { kind: 'later' }
  | { kind: 'printed'; count: number }
  | { kind: 'failed'; reason: string | null };

/** 찍은 결과를 한 줄로 — 다 나갔으면 장 수, 아니면 첫 실패 까닭(서버 · 셸 문구 그대로). */
export const labelOutcomeOf = (results: readonly SplitPrintResult[]): LabelOutcome => {
  const failed = results.find((result) => result.outcome !== 'printed');

  return failed === undefined
    ? { kind: 'printed', count: results.length }
    : { kind: 'failed', reason: failed.message };
};

/**
 * 반납 직후 라벨 찍기 창(FR-017 · US4-5 · 시안 ③-3) — 반납 응답에 `labelUnprinted` 줄이 있으면 뜬다.
 *
 * ⭐ 새 인쇄 코드가 없다 — P-01-02 「분할 LOT 라벨」의 목록(`split-material-lots`)에서 그 LOT 을 찾아 같은 찍기
 *    (`useSplitLabelPrint` · `MATERIAL_LOT_LABEL`)로 보낸다. [나중에]는 그 탭의 발행 대기에 그대로 남긴다.
 * ⚠ 전에 찍다 실패한 LOT(발행 기록 있음)은 재발행 사유가 필요해 여기서 찍지 않는다 — 그 탭에서 사유와 함께 찍는다.
 */
export const ReturnLabelDialog = ({
  lotIds,
  plantId,
  workerNo,
  printer,
  onDone,
}: {
  lotIds: readonly number[];
  plantId: number | null;
  workerNo: string | null;
  printer: LabelPrinter;
  onDone: (outcome: LabelOutcome) => void;
}) => {
  const t = words();
  const list = useSplitMaterialLots(plantId, 'UNPRINTED', 'week');
  const printing = useSplitLabelPrint(workerNo);

  const wanted = new Set(lotIds);
  const found: SplitMaterialLot[] = (list.data?.items ?? []).filter((lot) => wanted.has(lot.lotId));
  const printable = found.filter((lot) => !needsReissueReason(lot));
  const canPrint = workerNo !== null && printable.length > 0 && !printing.isRunning;

  const print = async (): Promise<void> => {
    const results = await printing.run(printable, {
      printerName: printer.printerName,
      shellPrinterName: printer.shellPrinterName,
      reissueReasonCode: null,
    });
    onDone(labelOutcomeOf(results));
  };

  return (
    <PuDialog
      title={t.title(lotIds.length)}
      onClose={() => {
        if (!printing.isRunning) onDone({ kind: 'later' });
      }}
      footer={
        <>
          <PuButton
            disabled={printing.isRunning}
            onClick={() => {
              onDone({ kind: 'later' });
            }}
          >
            {t.later}
          </PuButton>
          <PuButton
            variant="primary"
            icon="print"
            disabled={!canPrint}
            onClick={() => {
              void print();
            }}
          >
            {printing.isRunning ? t.printing : t.print}
          </PuButton>
        </>
      }
    >
      <PuNote>{t.body}</PuNote>
      {list.isPending ? (
        <PuNote live>{t.loading}</PuNote>
      ) : found.length === 0 ? (
        <PuNote tone="warn">{t.notFound}</PuNote>
      ) : (
        <ul className="pmr-label-list">
          {found.map((lot) => (
            <li key={lot.lotId}>
              <b className="pu-mono">{lot.item.itemCode}</b>
              <span className="pu-mono pmr-lotno">{lot.lotNo}</span>
              <span>{formatBaseQty(lot.qty, lot.uomCode)}</span>
            </li>
          ))}
        </ul>
      )}
      {workerNo === null ? <PuNote tone="warn">{t.workerMissing}</PuNote> : null}
      <span className="pmr-hint">{t.same}</span>
    </PuDialog>
  );
};
