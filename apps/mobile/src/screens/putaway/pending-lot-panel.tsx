import { AlertBanner, Icon, IconButton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';

import { useBackStep } from '../../patterns/back-step';
import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { playErrorTone } from '../../patterns/error-tone';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import { useOutbox } from '../../patterns/outbox';
import { ApiRequestError } from '../../patterns/request';
import { ScanZone } from '../../patterns/scan-zone';
import { TaskHeader } from '../../patterns/task-header';
import { useScanField } from '../../patterns/use-scan-field';
import {
  modeTextOf,
  reasonTextOf,
  toDirectDraft,
  verdictKindOf,
  verdictTextOf,
  type LocationCheck,
  type PendingLot,
  type PendingLotLookup,
  type PutawayDirectResult,
} from './direct';
import { useCheckLocation } from './queries';

const t = messages.putaway;
const d = messages.putaway.direct;
const required = messages.common.required;

export type DirectOutcome = 'queued' | 'sent' | 'rejected';

/** 적치 한 건의 결과 — 목록 화면의 배너와 「적치됨」 줄이 받는다. */
export interface DirectRecorded {
  key: string;
  lotNo: string;
  locationCode: string;
  qty: string;
  outcome: DirectOutcome;
  /** 입고 번호 · 창고(보낸 뒤 응답이 있을 때). */
  note: string | null;
  /** 적치 방식(지정 위치 · 미지정 위치). */
  mode: string | null;
}

/**
 * 위치 스캔의 결과.
 * - `checking`·`failed`: 판정을 받는 중·받지 못함(연결).
 * - `verdict`: 서버 판정 — 지정이면 곧바로 기록, 미지정이면 확인, 그 밖은 막힘.
 * - `reason`: 그 사이 LOT 이 적치 대기가 아니게 됐다(409 이유 코드).
 */
type Check =
  | { code: string; kind: 'checking' }
  | { code: string; kind: 'failed'; error: unknown }
  | { code: string; kind: 'verdict'; check: LocationCheck }
  | { code: string; kind: 'reason'; reasonCode: string };

const reasonCodeOf = (error: unknown): string | null => {
  if (!(error instanceof ApiRequestError)) return null;
  const api = error.apiError;
  if (api.kind === 'network' || api.status !== 409) return null;
  const codes =
    api.kind === 'validation' || api.kind === 'stateLocked'
      ? api.errors.map((item) => item.code)
      : api.code === undefined
        ? []
        : [api.code];

  return codes.find((code) => reasonTextOf(code) !== null) ?? null;
};

export interface PendingLotPanelProps {
  /** `:lookup` 이 적치 대기라고 답한 결과(`lot` 이 있다). */
  found: PendingLotLookup & { lot: PendingLot };
  workerNo: string;
  onClose: () => void;
  onRecorded: (recorded: DirectRecorded) => void;
}

/**
 * M-01-05 적치 대기 LOT 하나(피처 009, 시안 M0105-After ②~⑥).
 *
 * LOT 은 이미 스캔했으니(①) 위치 스캔만 남는다. 지정 위치는 창고별로 보이고, 지정 위치를 스캔하면 단추 없이
 * 기록한다(SC-002). 미지정 위치는 확인 한 번, 그 밖은 [다시 스캔]만 — 지정 품목 목록은 어떤 메시지에도
 * 보이지 않는다(시안 결정).
 */
export const PendingLotPanel = ({ found, workerNo, onClose, onRecorded }: PendingLotPanelProps) => {
  const failureText = useLoadFailure();
  const { enqueue, flush, isRejected } = useOutbox();
  const checkLocation = useCheckLocation();
  const lot = found.lot;
  const [check, setCheck] = useState<Check | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /* 앞선 판정이 늦게 돌아와 뒤 스캔의 결과를 덮지 않게 한다. */
  const checkSeq = useRef(0);
  /* 같은 틱에 두 번 기록하지 않는다 - 멱등키가 다른 두 건이 담기면 서버가 흡수하지 못한다. */
  const inFlight = useRef(false);
  const qty = `${String(lot.qty)} ${lot.uomCode}`;

  const verdict = check?.kind === 'verdict' ? check.check : null;
  const kind = verdict === null ? null : verdictKindOf(verdict.verdictCode);

  const rescan = () => {
    checkSeq.current += 1;
    setCheck(null);
    setSaveFailed(false);
  };

  /* 막힌 판정을 보고 있으면 뒤로가기는 판정을 걷는다. 아니면 LOT 을 닫는다. */
  useBackStep(check !== null, rescan);
  useBackStep(check === null, onClose);

  const record = async (target: LocationCheck, confirmUndesignated: boolean) => {
    if (target.locationId === undefined || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);
    const entry = toDirectDraft(
      lot,
      { locationId: target.locationId, locationCode: target.locationCode },
      confirmUndesignated,
      new Date(),
      workerNo,
    );

    try {
      try {
        await enqueue(entry);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === entry.idempotencyKey;
      const outcome: DirectOutcome =
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(entry.idempotencyKey)
          ? 'rejected'
          : result === null || result.remaining.some(mine)
            ? 'queued'
            : 'sent';
      const response = result?.responses.get(entry.idempotencyKey) as
        PutawayDirectResult | undefined;

      onRecorded({
        key: entry.idempotencyKey,
        lotNo: lot.lotNo,
        locationCode: target.locationCode,
        qty,
        outcome,
        note:
          outcome === 'sent' && response !== undefined
            ? d.receipt(response.goodsReceiptNo, response.warehouseName)
            : null,
        mode:
          outcome === 'rejected'
            ? null
            : modeTextOf(
                response?.putawayModeCode ?? (confirmUndesignated ? 'UNDESIGNATED' : 'DESIGNATED'),
              ),
      });
    } finally {
      inFlight.current = false;
    }
  };

  const judge = async (code: string) => {
    if (code === '') return;
    checkSeq.current += 1;
    const seq = checkSeq.current;
    setSaveFailed(false);
    setCheck({ code, kind: 'checking' });

    let answer: LocationCheck;
    try {
      answer = await checkLocation(lot.lotId, code);
    } catch (error) {
      if (seq !== checkSeq.current) return;
      const reasonCode = reasonCodeOf(error);
      setCheck(
        reasonCode === null
          ? { code, kind: 'failed', error }
          : { code, kind: 'reason', reasonCode },
      );
      playErrorTone();
      return;
    }

    if (seq !== checkSeq.current) return;
    setCheck({ code, kind: 'verdict', check: answer });

    /* 지정 위치 — 단추 없이 곧바로 기록한다(SC-002). 그 밖은 화면에 남겨 사람이 고르게 한다. */
    if (verdictKindOf(answer.verdictCode) === 'record') {
      await record(answer, false);
    } else {
      /* 단말을 허리에 매단 채 스캔하므로 소리로도 알린다(공유계약 D-2). */
      playErrorTone();
    }
  };

  const locationField = useScanField({
    onScan: (value) => {
      void judge(value.trim());
    },
  });

  /* 판정이 서 있으면 스캔 칸을 접는다 — 다음에 읽는 라벨이 위치 칸으로 들어가지 않게, [다시 스캔]으로만 연다. */
  const scanOpen = check === null || check.kind === 'checking' || check.kind === 'failed';

  const manualButton = (
    <IconButton
      className="putaway__zone-button"
      icon={locationField.manual ? 'keyboard_return' : 'keyboard'}
      size="lg"
      aria-label={locationField.manual ? t.location.manualSubmit : t.location.manual}
      onClick={locationField.manual ? locationField.submitManual : locationField.openManual}
    />
  );

  const where = (target: LocationCheck) => (
    <>
      <span className="putaway__verdict-line putaway__scanned">{target.locationCode}</span>
      {target.locationPath === undefined ? null : (
        <span className="putaway__verdict-line putaway__path">{target.locationPath}</span>
      )}
    </>
  );

  return (
    <>
      <TaskHeader
        fields={[
          { label: t.tasks.itemLabel, value: lot.itemCode, strong: true },
          { label: t.tasks.itemNameLabel, value: lot.itemName, caption: true },
          {
            label: d.statusLabel,
            value: lot.lotStatusCode === 'DEFECTIVE' ? d.defective : d.normal,
          },
          { label: d.qtyLabel, value: qty },
          ...(lot.inboundLotNo === undefined
            ? []
            : [{ label: d.inboundLotLabel, value: lot.inboundLotNo, code: true }]),
          { label: d.lotLabel, value: lot.lotNo, code: true },
        ]}
        step={{ index: 2, total: 2 }}
        action={{ icon: 'list', label: d.change, onClick: onClose }}
      />

      <section className="putaway__section">
        <h2 className="putaway__step-title">
          <span className="putaway__step-badge" aria-hidden="true">
            2
          </span>
          {t.location.legend}
        </h2>

        {scanOpen ? (
          <ScanZone
            field={locationField}
            label={required(t.location.scanLabel)}
            prompt={t.location.scanPlaceholder}
            tools={manualButton}
          />
        ) : null}
        {check?.kind === 'checking' ? <p role="status">{d.checking}</p> : null}
        {check?.kind === 'failed' ? (
          <FailureBanner variant="error" title={failureText(check.error, d.checkFailed)} />
        ) : null}

        {/* 그 사이 LOT 이 적치 대기가 아니게 됐다(다른 단말이 먼저 적치 등) — 목록으로 돌아가 다시 고른다. */}
        {check?.kind === 'reason' ? (
          <AlertBanner className="putaway__verdict" variant="error" title={lot.lotNo}>
            <span className="putaway__verdict-line">{reasonTextOf(check.reasonCode)}</span>
            <span className="putaway__verdict-line">{d.notRecorded}</span>
          </AlertBanner>
        ) : null}

        {verdict !== null && kind === 'record' ? (
          <AlertBanner className="putaway__verdict" variant="success" title={verdict.locationCode}>
            <span className="putaway__verdict-line">{d.verdict.DESIGNATED}</span>
          </AlertBanner>
        ) : null}

        {/* ④ 지정되지 않은 위치 — 확인 한 번. 적치하면 그 위치의 보관 품목에 이 품목이 더해진다(FR-017a). */}
        {verdict !== null && kind === 'confirm' ? (
          <AlertBanner
            className="putaway__verdict"
            variant="warning"
            title={d.verdict.UNDESIGNATED}
          >
            {where(verdict)}
            <span className="putaway__verdict-line">{d.addsDesignation(lot.itemCode)}</span>
            <span className="putaway__verdict-line">{d.notYetRecorded}</span>
          </AlertBanner>
        ) : null}

        {/* ⑤⑥ 막는 판정 — [다시 스캔]만. 지정 품목 목록은 보이지 않는다. */}
        {verdict !== null && kind === 'blocked' ? (
          <AlertBanner
            className="putaway__verdict"
            variant="error"
            title={verdictTextOf(verdict.verdictCode) ?? verdict.message}
          >
            {where(verdict)}
            <span className="putaway__verdict-line">{d.notRecorded}</span>
          </AlertBanner>
        ) : null}

        {saveFailed ? (
          <AlertBanner variant="error" title={t.saveFailed.title}>
            {t.saveFailed.description}
          </AlertBanner>
        ) : null}

        {/* ② 지정 위치 — 공장 안 모든 창고, 창고별. 위치는 창고를 고르지 않고 코드로 찾는다. */}
        {check === null || check.kind === 'checking' || check.kind === 'failed' ? (
          <div className="putaway__designated">
            <p className="putaway__designated-legend">{d.designatedLegend}</p>
            {(found.designated ?? []).length === 0 ? (
              <p className="putaway__note">{d.designatedNone}</p>
            ) : (
              (found.designated ?? []).map((group) => (
                <div key={group.warehouseId} className="putaway__designated-group">
                  <p className="putaway__designated-warehouse">{group.warehouseName}</p>
                  <ul>
                    {group.locations.map((each) => (
                      <li key={each.locationId}>
                        <span className="putaway__scanned">{each.locationCode}</span>
                        <span className="putaway__path">{each.locationPath}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        ) : null}
      </section>

      {kind === 'confirm' && verdict !== null ? (
        <BottomActionBar
          primary={{
            label: d.confirmUndesignated,
            onClick: () => void record(verdict, true),
          }}
          secondary={{ label: d.rescan, onClick: rescan }}
        />
      ) : check !== null && check.kind !== 'checking' && check.kind !== 'failed' ? (
        <BottomActionBar primary={{ label: d.rescan, onClick: rescan }} />
      ) : (
        <BottomActionBar
          prompt={
            <p className="putaway__auto-note">
              <Icon name="barcode_scanner" size={20} />
              <span>{d.auto}</span>
            </p>
          }
        />
      )}
    </>
  );
};
