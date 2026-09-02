import {
  AlertBanner,
  Button,
  Card,
  NumberPad,
  Table,
  Tabs,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { useScannedLot } from '../../patterns/lots';
import { useItem, useUomCodes } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { toApiError } from '../../patterns/request';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  useDefectRecords,
  useDispatchRepair,
  useOpenRepairs,
  useOpenRepairsForLot,
  useReturnRepair,
} from './queries';
import {
  DEFECT_WINDOW_DAYS,
  FAILED,
  SUCCEEDED,
  canDispatch,
  canReturn,
  isAlreadyOpen,
  openFor,
  qtyProblem,
  type DefectRecord,
  type RepairExecution,
  type RepairResult,
} from './repair';
import './screen.css';

const t = messages.repairRoundtrip;

const DISPATCH = 'dispatch';
const RETURN = 'return';

const stamp = (iso: string): string => {
  const at = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

const uomLabel = (uoms: Map<number, string> | undefined, uomId: number): string =>
  uoms?.get(uomId) ?? '';

export const RepairRoundtripScreen = () => {
  useScreenTitle(t.title);

  const online = useOnlineStatus();
  const { worker } = useWorkerSession();

  const [tab, setTab] = useState<string>(DISPATCH);
  const [scanned, setScanned] = useState<string | null>(null);
  const [defectId, setDefectId] = useState<number | null>(null);
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [qty, setQty] = useState('');
  const [typing, setTyping] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value);
      setDefectId(null);
      setExecutionId(null);
      setQty('');
      setResult(null);
      setDone(null);
    },
  });

  const lot = useScannedLot(scanned);
  const lotId = lot.data?.lotId ?? null;
  const item = useItem(lot.data?.itemId ?? null);
  const uoms = useUomCodes(true);
  const defects = useDefectRecords(lotId);
  const scopedOpen = useOpenRepairsForLot(lotId);
  const allOpen = useOpenRepairs();
  const dispatch = useDispatchRepair();
  const returning = useReturnRepair();

  /* 한 줄뿐이면 고를 것이 없다. 고르는 동작을 요구하면 스캔 한 번에 끝날 일이 두 번이 된다. */
  useEffect(() => {
    if (defects.data?.length === 1) {
      setDefectId(defects.data[0]?.defectRecordId ?? null);
    }
  }, [defects.data]);

  useEffect(() => {
    if (scopedOpen.data?.length === 1) {
      setExecutionId(scopedOpen.data[0]?.repairExecutionId ?? null);
    }
  }, [scopedOpen.data]);

  if (!online) {
    return (
      <div className="repair">
        <AlertBanner variant="warning" title={t.offline.title}>
          {t.offline.description}
        </AlertBanner>
      </div>
    );
  }

  const defect = defects.data?.find((each) => each.defectRecordId === defectId) ?? null;
  const execution = scopedOpen.data?.find((each) => each.repairExecutionId === executionId) ?? null;
  const alreadyOpen =
    defect === null ? null : openFor(scopedOpen.data ?? [], defect.defectRecordId);
  const problem = defect === null ? null : qtyProblem(defect, qty);

  const qtyMessage = (): string | undefined => {
    if (defect === null || problem === null || (qty.trim() === '' && !typing)) {
      return undefined;
    }

    if (problem === 'overDefect') {
      return t.qty.overDefect(String(defect.defectQty));
    }

    return t.qty[problem];
  };

  const restart = () => {
    setScanned(null);
    setDefectId(null);
    setExecutionId(null);
    setQty('');
    setResult(null);
    setDone(null);
    scanField.focus();
  };

  const submitDispatch = async () => {
    if (defect === null || worker === null) {
      return;
    }

    await dispatch
      .mutateAsync({ defect, qty, workerNo: worker.workerNo })
      .then(() => {
        setDone(t.dispatch.done);
      })
      .catch(() => null);
  };

  const submitReturn = async () => {
    if (execution === null || result === null || worker === null) {
      return;
    }

    await returning
      .mutateAsync({
        repairExecutionId: execution.repairExecutionId,
        result,
        workerNo: worker.workerNo,
      })
      .then(() => {
        setDone(t.return.done);
      })
      .catch(() => null);
  };

  const scannedCard = (
    <>
      {lot.isPending && scanned !== null ? <p role="status">{t.scan.loading}</p> : null}
      {lot.isError ? <AlertBanner variant="error" title={t.scan.loadFailed} /> : null}
      {lot.isSuccess && lot.data === null ? (
        <AlertBanner variant="warning" title={t.scan.notFound(scanned ?? '')} />
      ) : null}
    </>
  );

  const defectCard = (record: DefectRecord) => (
    <Card bordered>
      <Card.Body className="card-body repair__card">
        <strong>{lot.data?.lotNo}</strong>
        <p className="repair__note">{item.data?.itemCode ?? ''}</p>
        <p>{t.defect.qty(String(record.defectQty), uomLabel(uoms.data, record.uomId))}</p>
        <p className="repair__note">{t.defect.detectedAt(stamp(record.detectedAt))}</p>
      </Card.Body>
    </Card>
  );

  const dispatchPanel = (
    <div className="repair__panel">
      {scannedCard}
      {defects.isPending && lotId !== null ? <p role="status">{t.defect.loading}</p> : null}
      {/* 확인하지 못한 것을 불량이 아닌 것으로 말하지 않는다. */}
      {defects.isError ? <AlertBanner variant="error" title={t.defect.loadFailed} /> : null}
      {defects.isSuccess && defects.data.length === 0 ? (
        <>
          <AlertBanner variant="warning" title={t.defect.none} />
          <p className="repair__note">{t.defect.window(DEFECT_WINDOW_DAYS)}</p>
        </>
      ) : null}

      {defects.data !== undefined && defects.data.length > 1 ? (
        <section className="repair__section">
          <h2>{t.defect.pick}</h2>
          <ul className="repair__picks">
            {defects.data.map((each) => (
              <li key={each.defectRecordId}>
                <Button
                  variant={each.defectRecordId === defectId ? 'filled' : 'outlined'}
                  size="lg"
                  onClick={() => {
                    setDefectId(each.defectRecordId);
                    setQty('');
                  }}
                >
                  {t.defect.qty(String(each.defectQty), uomLabel(uoms.data, each.uomId))}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {defect === null ? null : (
        <>
          {defectCard(defect)}

          {alreadyOpen === null ? (
            <section className="repair__section">
              <h2>{t.qty.label}</h2>
              <TextField
                label={t.qty.label}
                inputMode="decimal"
                size="xl"
                fullWidth
                value={qty}
                onChange={(event) => {
                  setTyping(true);
                  setQty(event.target.value);
                }}
                error={qtyMessage()}
              />
              <NumberPad
                value={qty}
                onChange={(next) => {
                  setTyping(true);
                  setQty(next);
                }}
                max={defect.defectQty}
                allowDecimal
              />
            </section>
          ) : (
            <AlertBanner variant="warning" title={t.dispatch.already}>
              {t.dispatch.alreadyAt(stamp(alreadyOpen.startedAt))}
            </AlertBanner>
          )}

          {worker === null ? <p className="repair__note">{t.noWorker}</p> : null}
          {dispatch.error === null || dispatch.error === undefined ? null : isAlreadyOpen(
              toApiError(dispatch.error),
            ) ? (
            <AlertBanner variant="warning" title={t.dispatch.already} />
          ) : (
            <AlertBanner variant="error" title={t.dispatch.failed} />
          )}
          <Button
            className="repair__submit"
            variant="filled"
            size="2xl"
            loading={dispatch.isPending}
            disabled={
              !canDispatch({ defect, qty, openExecutions: scopedOpen.data ?? [] }, worker !== null)
            }
            onClick={() => void submitDispatch()}
          >
            {t.dispatch.submit}
          </Button>
        </>
      )}
    </div>
  );

  const returnPanel = (
    <div className="repair__panel">
      {scannedCard}
      {scopedOpen.isError ? <AlertBanner variant="error" title={t.open.loadFailed} /> : null}
      {lotId !== null && scopedOpen.isSuccess && scopedOpen.data.length === 0 ? (
        <AlertBanner variant="warning" title={t.return.noOpen} />
      ) : null}

      {scopedOpen.data !== undefined && scopedOpen.data.length > 1 ? (
        <ul className="repair__picks">
          {scopedOpen.data.map((each) => (
            <li key={each.repairExecutionId}>
              <Button
                variant={each.repairExecutionId === executionId ? 'filled' : 'outlined'}
                size="lg"
                onClick={() => {
                  setExecutionId(each.repairExecutionId);
                }}
              >
                {`${String(each.repairQty)} ${uomLabel(uoms.data, each.uomId)} · ${stamp(each.startedAt)}`}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {execution === null ? null : (
        <>
          <Card bordered>
            <Card.Body className="card-body repair__card">
              <strong>{lot.data?.lotNo}</strong>
              <p>{`${String(execution.repairQty)} ${uomLabel(uoms.data, execution.uomId)}`}</p>
              <p className="repair__note">{t.dispatch.alreadyAt(stamp(execution.startedAt))}</p>
            </Card.Body>
          </Card>

          <section className="repair__section">
            <h2>{t.return.legend}</h2>
            <div className="repair__results">
              <Button
                variant={result === SUCCEEDED ? 'filled' : 'outlined'}
                size="xl"
                onClick={() => {
                  setResult(SUCCEEDED);
                }}
              >
                {t.return.succeeded}
              </Button>
              <Button
                variant={result === FAILED ? 'filled' : 'outlined'}
                size="xl"
                onClick={() => {
                  setResult(FAILED);
                }}
              >
                {t.return.failed}
              </Button>
            </div>
          </section>

          {/* 수리분은 원 LOT 으로 돌아가지 않는다. 이 화면이 그다음을 약속하지 않는다. */}
          <p className="repair__note">{t.return.afterNote}</p>
          {worker === null ? <p className="repair__note">{t.noWorker}</p> : null}
          {returning.isError ? <AlertBanner variant="error" title={t.return.error} /> : null}
          <Button
            className="repair__submit"
            variant="filled"
            size="2xl"
            loading={returning.isPending}
            disabled={!canReturn(execution, result, worker !== null)}
            onClick={() => void submitReturn()}
          >
            {t.return.submit}
          </Button>
        </>
      )}
    </div>
  );

  const columns: Column<RepairExecution>[] = [
    { key: 'no', header: t.open.columns.no, render: (row) => String(row.repairExecutionId) },
    {
      key: 'qty',
      header: t.open.columns.qty,
      align: 'end',
      render: (row) => `${String(row.repairQty)} ${uomLabel(uoms.data, row.uomId)}`,
    },
    {
      key: 'startedAt',
      header: t.open.columns.startedAt,
      render: (row) => stamp(row.startedAt),
    },
  ];

  if (done !== null) {
    return (
      <div className="repair">
        <AlertBanner variant="success" title={done} />
        <Button className="repair__submit" variant="filled" size="2xl" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="repair">
      <TextField
        ref={scanField.ref}
        label={t.scan.label}
        placeholder={t.scan.placeholder}
        size="xl"
        fullWidth
      />

      <Tabs
        aria-label={t.title}
        value={tab}
        onChange={setTab}
        items={[
          { value: DISPATCH, label: t.tabs.dispatch, content: dispatchPanel },
          { value: RETURN, label: t.tabs.return, content: returnPanel },
        ]}
      />

      <section className="repair__section">
        <h2>{t.open.legend(allOpen.data?.length ?? 0)}</h2>
        {allOpen.isError ? <AlertBanner variant="error" title={t.open.loadFailed} /> : null}
        {allOpen.data === undefined ? null : allOpen.data.length === 0 ? (
          <p className="repair__note">{t.open.none}</p>
        ) : (
          <div className="repair__table">
            <Table
              caption={t.open.caption}
              columns={columns}
              rows={allOpen.data}
              getRowId={(row) => String(row.repairExecutionId)}
              density="compact"
            />
          </div>
        )}
      </section>
    </div>
  );
};
