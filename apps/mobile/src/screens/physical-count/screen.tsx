import { AlertBanner, Button, Card, NumberPad, Progress, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { formatMaterialLotNo } from '../../patterns/material-lot-no';
import { useBackStep } from '../../patterns/back-step';
import { ItemPicker } from '../../patterns/item-picker';
import { useOnlineStatus } from '../../patterns/online-status';
import { useCodeValues } from '../../patterns/code-values';
import { useLocationByCode } from '../../patterns/locations';
import { uomLabelOf, useUomCodes } from '../../patterns/masters';
import { referenceFromQuery, referenceLabel, type ReferenceState } from '../../patterns/reference';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import {
  useCountLines,
  useCountSummary,
  useOpenCounts,
  useUncountedLocations,
  useWarehouseNames,
} from './queries';
import {
  COUNT_LABEL,
  canSubmit,
  countedLines,
  diffOf,
  needsReason,
  qtyProblemOf,
  queuedForLocationOf,
  toCountDraft,
  type DraftLine,
  type InventoryCount,
} from './count';
import './screen.css';

const t = messages.physicalCount;
const VARIANCE_REASON = 'VARIANCE_REASON';
const INVENTORY_COUNT_TYPE = 'INVENTORY_COUNT_TYPE';
/*
 * 한 줄에 세우는 위치 수. 창고 하나의 실사는 위치가 수십 곳이라 다 늘어놓으면 화면을 넘겨
 * 위치 스캔 칸이 아래로 밀린다. 순회는 앞에서부터 하므로 뒤쪽 코드는 지금 쓸모가 없다.
 */
const SHOWN_LOCATIONS = 4;

type Outcome = 'held' | 'sent' | 'rejected';

export const PhysicalCountScreen = () => {
  useScreenTitle(t.title);
  const failureText = useLoadFailure();

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();

  const [countId, setCountId] = useState<number | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  /* 단말 키보드는 키가 촘촘하고 올라오면 줄 목록과 완료 단추를 덮는다. */
  const [keypadFor, setKeypadFor] = useState<string | null>(null);
  /*
   * 순회하다 보면 장부에 없는 물건이 나온다. 새 라인의 번호는 서버가 채번하므로 오프라인에서는
   * 만들 수 없다 - 온라인일 때만 연다.
   */
  const [addingItem, setAddingItem] = useState(false);
  const added = useRef(0);
  const online = useOnlineStatus();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 같은 위치를 두 번 치환한다.
   */
  const inFlight = useRef(false);

  const counts = useOpenCounts();
  const count = (counts.data ?? []).find((each) => each.inventoryCountId === countId) ?? null;
  const location = useLocationByCode(count?.warehouseId ?? null, scanned);
  const at = location.data ?? null;
  const planned = useCountLines(countId, at?.locationId ?? null);
  const reasons = useCodeValues(VARIANCE_REASON);
  const summary = useCountSummary(countId);
  const remaining = useUncountedLocations(countId);

  /*
   * 실사를 고를 때 보는 값들. 못 받은 것과 없는 것을 가른다 - 창고 이름을 못 받았는데 비워
   * 두면 창고가 없는 실사로 읽힌다.
   */
  const warehouses = useWarehouseNames();
  const warehouseOf = referenceFromQuery(warehouses, (name: string) => name);
  const countTypes = useCodeValues(INVENTORY_COUNT_TYPE);
  const typeOf = (code: string): ReferenceState => {
    if (countTypes.isError) return { kind: 'failed' };
    if (countTypes.isPending) return { kind: 'loading' };
    const found = (countTypes.data ?? []).find((value) => value.code === code);

    return found === undefined ? { kind: 'unknown' } : { kind: 'named', label: found.name };
  };

  /*
   * 한 위치에 개수로 세는 품목과 무게로 세는 품목이 섞여 선다. 단위가 빠지면 40 이 마흔 개인지
   * 마흔 킬로그램인지 가릴 수 없고, 그 판단이 그대로 재고 조정으로 나간다.
   */
  const uoms = useUomCodes(countId !== null);
  const uomOf = (uomId: number | null | undefined) => uomLabelOf(uoms.data, uomId);

  /*
   * 큐에 담긴 것은 서버 응답에 없다. 읽기 전에는 담긴 것이 없는 것과 구별되지 않아 그 사이에
   * 다시 보내게 되므로, 읽기 전에는 담긴 것으로 세어 막아 둔다.
   */
  const queuedForLocation =
    countId === null || at === null
      ? 0
      : loaded
        ? queuedForLocationOf(pendingOf(COUNT_LABEL), countId, at.locationId)
        : 1;

  const ready =
    count !== null &&
    canSubmit(
      at,
      lines,
      worker !== null,
      queuedForLocation,
      count,
      (reasons.data ?? []).map((reason) => reason.code),
    );

  /*
   * 위치의 라인을 화면이 적을 자리로 옮긴다. 아직 안 센 줄만 비워 둔다 - 비어 있는 것이
   * 아직 세지 않았다는 뜻이다.
   *
   * 앞서 센 줄은 그 값을 그대로 담아 둔다. 이 경로는 위치 전체를 치환하므로 본문에 없는
   * 기존 라인이 미실사로 되돌아간다 - 한 위치를 나눠 세면 앞 회차가 지워지고 다시 세러
   * 가야 한다. 담아 두면 손대지 않아도 함께 나가고, 고치면 고친 값이 나간다.
   */
  useEffect(() => {
    const rows = planned.data;

    if (rows === undefined) {
      return;
    }

    /*
     * 적어 둔 것은 다시 읽어와도 남긴다 - 재접속이나 재조회가 돌 때 덮어쓰면 한 선반을 다
     * 센 사람이 아무 말 없이 처음부터 다시 세게 된다.
     */
    setLines((current) => {
      const typed = new Map(current.map((line) => [line.key, line]));

      const next = rows.map((row) => ({
        key: `line-${String(row.inventoryCountLineId)}`,
        inventoryCountLineId: row.inventoryCountLineId,
        locationId: row.locationId,
        itemId: row.itemId,
        lotId: row.lotId ?? null,
        uomId: row.uomId,
        itemCode: row.itemCode ?? '',
        lotNo: row.lotNo ?? null,
        /* 블라인드 실사에서는 서버가 장부를 내려보내지 않는다. */
        systemQty: row.systemQty ?? null,
        counted: row.counted,
        previousQty: row.counted ? row.countedQty : null,
        previousCountedAt: row.counted ? row.countedAt : null,
        previousReasonCode: row.varianceReasonCode ?? null,
        qty:
          typed.get(`line-${String(row.inventoryCountLineId)}`)?.qty ??
          (row.counted ? String(row.countedQty) : ''),
        reasonCode:
          typed.get(`line-${String(row.inventoryCountLineId)}`)?.reasonCode ??
          row.varianceReasonCode ??
          '',
      }));

      /*
       * 화면에서 더한 줄은 아직 서버에 없어 다시 읽어와도 안 온다. 붙여 두지 않으면 적어 둔
       * 것이 재조회 한 번에 사라진다.
       */
      return [...next, ...current.filter((line) => line.inventoryCountLineId === null)];
    });
  }, [planned.data]);

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
    },
  });

  /*
   * 뒤로가기는 화면 안 단계를 먼저 되돌린다. 라우터 이력에는 이 화면 하나뿐이라, 두지 않으면
   * 실사를 고르고 위치까지 스캔한 사람이 한 번에 작업 목록까지 나간다.
   *
   * 안쪽부터 되돌리도록 조건을 서로 배타로 둔다.
   */
  useBackStep(addingItem, () => {
    setAddingItem(false);
  });
  useBackStep(!addingItem && countId !== null && scanned !== null, () => {
    setScanned(null);
    setLines([]);
    setKeypadFor(null);
  });
  useBackStep(!addingItem && countId !== null && scanned === null, () => {
    setCountId(null);
  });

  /*
   * 34자리를 붙여 쓰면 실물 라벨과 눈으로 대조할 수 없다. 한 위치에 같은 품목이 아홉 줄까지
   * 서므로 자릿수를 세어 가며 줄을 찾게 된다 - 실사는 그 대조가 일의 전부다.
   */
  const nameOf = (line: DraftLine): string =>
    t.lines.name(line.itemCode, line.lotNo === null ? '' : formatMaterialLotNo(line.lotNo));

  /*
   * 고를 때 보는 값들. 번호와 날짜만으로는 갈리지 않아 창고와 유형을 함께 세운다.
   *
   * 아직 못 받은 이름 자리에는 지어내지 않는다 - 창고를 못 받았는데 비워 두면 창고가 없는
   * 실사로 읽힌다.
   */
  const planFields = (each: InventoryCount) => (
    <dl className="physical-count__plan-fields">
      <dt>{t.plan.noLabel}</dt>
      <dd>
        <strong>{each.inventoryCountNo}</strong>
      </dd>
      <dt>{t.plan.warehouseLabel}</dt>
      <dd>{referenceLabel(warehouseOf(each.warehouseId))}</dd>
      <dt>{t.plan.typeLabel}</dt>
      <dd>{referenceLabel(typeOf(each.countTypeCode))}</dd>
      <dt>{t.plan.plannedLabel}</dt>
      <dd>{each.plannedDate}</dd>
    </dl>
  );

  /*
   * 숫자판이 지금 적고 있는 줄. 목록 밖에 서므로 자리를 번호가 아니라 줄 자체로 든다 - 다른
   * 위치로 옮겨 그 번호가 사라지면 숫자판도 함께 닫힌다.
   */
  const keypadAt = lines.findIndex((line) => line.key === keypadFor);
  const keypad = keypadAt === -1 ? null : { at: keypadAt, line: lines[keypadAt] as DraftLine };

  /*
   * 입력칸 위에 함께 서는 값들. 서로를 밀어내지 않는다.
   *
   * 앞서 센 값은 칸에 담겨 있어도 따로 세운다 - 칸의 값을 고치고 나면 무엇을 덮어쓰는
   * 중인지 알 길이 없어진다. 차이는 그 옆에 붙어 되돌릴 수 없는 조정이 얼마인지 말한다.
   */
  const statusOf = (line: DraftLine) => {
    const diff = diffOf(line);
    const unit = uomOf(line.uomId);

    return (
      <>
        {!line.counted ? null : (
          <span className="physical-count__previous">
            {t.lines.already(String(line.previousQty ?? 0), unit)}
          </span>
        )}
        {diff === null ? null : (
          <strong className="physical-count__diff">
            {diff > 0
              ? t.lines.diffOver(String(diff), unit)
              : t.lines.diffShort(String(-diff), unit)}
          </strong>
        )}
        {line.counted || line.qty.trim() !== '' ? null : (
          <span className="physical-count__previous">{t.lines.uncounted}</span>
        )}
      </>
    );
  };

  const restart = () => {
    setScanned(null);
    setLines([]);
    setOutcome(null);
    setSaveFailed(false);
    /*
     * 방금 끝낸 위치는 남은 목록에서 빠지고 진행도 늘어난다. 화면이 서 있는 동안에는 조회가
     * 저절로 다시 돌지 않아, 낡은 목록이 이미 다 센 선반으로 사람을 다시 보낸다.
     */
    void remaining.refetch();
    void summary.refetch();
    scanField.focus();
  };

  const submit = async () => {
    if (count === null || at === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const draft = toCountDraft(count, at.locationId, lines, new Date(), worker.workerNo);

      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 센 줄 안다. */
      try {
        await enqueue(draft);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === draft.idempotencyKey;

      /*
       * 자기가 부른 보내기의 결과만 보면 셸이 도는 다른 회차에서 되돌려진 건을 놓친다 - 화면은
       * 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(draft.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      setOutcome(result === null || result.remaining.some(mine) ? 'held' : 'sent');
    } finally {
      inFlight.current = false;
    }
  };

  /*
   * 마스터가 커서 찾는 일에 화면을 통째로 내준다 - 입하에서 무발주 품목을 고르는 자리와
   * 같은 부품이다.
   */
  if (addingItem) {
    return (
      <ItemPicker
        onPick={(picked) => {
          added.current += 1;
          setLines((current) => [
            ...current,
            {
              key: `added-${String(added.current)}`,
              /* 서버가 채번한다. 화면이 지어내면 다른 줄을 덮어쓴다. */
              inventoryCountLineId: null,
              locationId: at?.locationId ?? 0,
              itemId: picked.itemId,
              /* LOT 은 계획에 없던 재고라 아직 모른다. 계약이 빈 값을 받는다. */
              lotId: null,
              uomId: picked.baseUomId,
              itemCode: picked.itemCode,
              lotNo: null,
              /* 장부에 없어 견줄 것이 없다. 차이는 센 값 그대로다. */
              systemQty: 0,
              counted: false,
              previousQty: null,
              previousCountedAt: null,
              previousReasonCode: null,
              qty: '',
              reasonCode: '',
            },
          ]);
          setAddingItem(false);
        }}
        onCancel={() => {
          setAddingItem(false);
        }}
      />
    );
  }

  if (outcome !== null) {
    return (
      <div className="physical-count">
        {outcome === 'sent' ? <AlertBanner variant="success" title={t.sent.title} /> : null}
        {outcome === 'held' ? (
          <AlertBanner variant="warning" title={t.held.title}>
            {t.held.description}
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <Button variant="filled" size="2xl" className="physical-count__wide" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={keypad === null ? 'physical-count' : 'physical-count physical-count--keypad-open'}
    >
      <section className="physical-count__section">
        <h2>{t.plan.legend}</h2>
        {counts.isPending ? <p role="status">{t.plan.loading}</p> : null}
        {counts.isError ? (
          <FailureBanner variant="error" title={failureText(counts.error, t.plan.loadFailed)} />
        ) : null}
        {counts.isSuccess && counts.data.length === 0 ? <p>{t.plan.none}</p> : null}

        {/*
          번호와 날짜만으로는 어느 실사인지 갈리지 않는다 - 같은 날 여러 창고의 실사가 함께
          선다. 무엇을 고르는지 보고 고르게 한다.
        */}
        {count !== null ? (
          <Card bordered>
            <Card.Body className="card-body">{planFields(count)}</Card.Body>
          </Card>
        ) : (
          <ul className="physical-count__plans">
            {(counts.data ?? []).map((each) => (
              <li key={each.inventoryCountId}>
                <Card
                  bordered
                  interactive
                  onClick={() => {
                    setCountId(each.inventoryCountId);
                    setScanned(null);
                    setLines([]);
                  }}
                >
                  <Card.Body className="card-body">{planFields(each)}</Card.Body>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {/* 장부를 감춘 실사다. 작업자가 장부 수를 보고 그대로 적는 것을 막는다. */}
        {count?.blindCount === true ? <AlertBanner variant="info" title={t.plan.blind} /> : null}
        {/*
          대상 위치는 실사 헤더에 없고 라인에 붙어 있다. 말해 주지 않으면 위치 코드를 외우고
          있는 사람만 이 화면을 쓸 수 있다.
        */}
        {remaining.data === undefined || remaining.data.length === 0 ? null : (
          <p className="physical-count__remaining">
            {remaining.data.length <= SHOWN_LOCATIONS
              ? t.plan.remaining(remaining.data.join(' · '))
              : t.plan.remainingMore(
                  remaining.data.slice(0, SHOWN_LOCATIONS).join(' · '),
                  String(remaining.data.length - SHOWN_LOCATIONS),
                )}
          </p>
        )}
        {/*
          창고를 순회하는 일이라 한 번에 끝나지 않는다. 얼마나 남았는지를 말하지 않으면 언제
          끝나는지 모른 채 돌게 되고, 다 돌았는지도 스스로 셈해야 한다.
        */}
        {summary.data === undefined || summary.data.plannedCount === 0 ? null : (
          <div className="physical-count__progress">
            <span>
              {t.plan.progress(
                String(summary.data.countedCount),
                String(summary.data.plannedCount),
              )}
            </span>
            <Progress
              value={summary.data.countedCount}
              max={summary.data.plannedCount}
              label={t.plan.progressLabel}
              valueText={t.plan.progress(
                String(summary.data.countedCount),
                String(summary.data.plannedCount),
              )}
            />
          </div>
        )}
      </section>

      {count === null ? null : (
        <section className="physical-count__section">
          <h2>{t.location.legend}</h2>
          <TextField
            ref={scanField.ref}
            label={t.location.scanLabel}
            placeholder={t.location.scanPlaceholder}
            size="xl"
            fullWidth
          />
          {/*
           * 스캔 칸 하나로 받는다. 스캐너를 기다리는 동안에는 키보드를 열지 않고, 직접
           * 입력을 누르면 그 칸이 열린다. 치는 도중 스캔이 오면 스캔값이 이긴다.
           */}
          {scanField.manual ? (
            <Button variant="outlined" size="xl" onClick={scanField.submitManual}>
              {t.location.manualSubmit}
            </Button>
          ) : (
            <Button variant="text" size="xl" onClick={scanField.openManual}>
              {t.location.manualLabel}
            </Button>
          )}

          {scanned !== null && location.isPending ? (
            <p role="status">{t.location.loading}</p>
          ) : null}
          {scanned !== null && location.data === null ? (
            <AlertBanner variant="error" title={t.location.notFound(scanned)} />
          ) : null}
          {at !== null ? <p>{t.location.picked(at.locationCode)}</p> : null}
          {planned.isError ? (
            <FailureBanner
              variant="error"
              title={failureText(planned.error, t.location.loadFailed)}
            />
          ) : null}
          {at !== null && planned.isSuccess && planned.data.length === 0 ? (
            <AlertBanner variant="warning" title={t.location.empty} />
          ) : null}
        </section>
      )}

      {lines.length === 0 ? null : (
        <>
          <section className="physical-count__section">
            <h2>{t.lines.legend}</h2>
            {/*
              이 선반을 다 셌는지는 실사 전체 진행과 다른 물음이다. 화면이 든 줄로 바로 세고,
              한 위치를 끝낼 때마다 확인하는 것이 이 값이다.
            */}
            <div className="physical-count__here">
              <span>
                {t.lines.atHere(String(countedLines(lines).length), String(lines.length))}
              </span>
              {/* 숫자만 있으면 읽고 나눠야 한다. 남은 양은 길이로 먼저 들어온다. */}
              <Progress
                value={countedLines(lines).length}
                max={lines.length}
                label={t.lines.atHereLabel}
                valueText={t.lines.atHere(String(countedLines(lines).length), String(lines.length))}
              />
            </div>
            {/* 0 과 빈 칸이 다르다는 것을 말한다. 안 밝히면 안 센 것을 0 으로 적는다. */}
            <p className="physical-count__note">{t.lines.zeroHint}</p>

            {lines.map((line, index) => {
              const problem = qtyProblemOf(line);

              return (
                <div key={line.key} className="physical-count__line">
                  {/*
                    적어야 할 값을 입력칸 위에 둔다. 아래에 두면 칸을 지나쳐 내려다봐야 하고,
                    숫자판이 올라오면 그 자리가 덮여 전산 잔량을 못 본 채 적게 된다.
                  */}
                  <p className="physical-count__head">{nameOf(line)}</p>
                  <div className="physical-count__figures">
                    <span className="physical-count__system">
                      {line.systemQty === null
                        ? t.lines.systemQty(t.lines.masked, '')
                        : t.lines.systemQty(String(line.systemQty), uomOf(line.uomId))}
                    </span>
                    {statusOf(line)}
                  </div>
                  <TextField
                    label={t.lines.qty}
                    aria-label={t.lines.qtyLabel(nameOf(line))}
                    size="xl"
                    fullWidth
                    /*
                     * 장갑을 끼고 한 손으로 조작한다. 단말 키보드는 키가 촘촘하고, 올라오면
                     * 줄 목록과 완료 단추를 덮는다.
                     */
                    inputMode="none"
                    onFocus={() => {
                      setKeypadFor(line.key);
                    }}
                    value={line.qty}
                    onChange={(event) => {
                      const next = event.target.value;
                      setLines((current) =>
                        current.map((each, at2) => {
                          if (at2 !== index) return each;
                          const changed = { ...each, qty: next };
                          return count !== null && !needsReason(count, changed)
                            ? { ...changed, reasonCode: '' }
                            : changed;
                        }),
                      );
                    }}
                    error={problem === null ? undefined : t.lines.problem[problem]}
                  />
                  {/*
                   * 안 센 것과 0 으로 센 것을 화면이 갈라 말한다.
                   *
                   * 이 줄은 서버에 저장된 상태다. 지금 적고 있는 값 옆에 그대로 두면 적은 것이
                   * 안 먹은 것처럼 읽히므로, 칸이 빈 동안에만 말한다.
                   */}

                  {count !== null && needsReason(count, line) ? (
                    <>
                      <label htmlFor={`physical-count-reason-${line.key}`}>{t.lines.reason}</label>
                      <Select
                        id={`physical-count-reason-${line.key}`}
                        aria-label={t.lines.reasonLabel(nameOf(line))}
                        placeholder={t.lines.reasonPlaceholder}
                        size="xl"
                        value={line.reasonCode === '' ? null : line.reasonCode}
                        onChange={(value) => {
                          const next = String(value);
                          setLines((current) =>
                            current.map((each, at2) =>
                              at2 === index ? { ...each, reasonCode: next } : each,
                            ),
                          );
                        }}
                        options={(reasons.data ?? []).map((reason) => ({
                          value: reason.code,
                          label: reason.name,
                        }))}
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </section>

          <section className="physical-count__section">
            {/*
              장부에 없는 물건을 찾았을 때 적을 자리다. 새 라인의 번호는 서버가 채번하므로
              오프라인에서는 만들 수 없다.
            */}
            <Button
              className="physical-count__wide"
              variant="outlined"
              size="xl"
              disabled={!online}
              aria-describedby={online ? undefined : 'physical-count-add-reason'}
              onClick={() => {
                setAddingItem(true);
              }}
            >
              {t.lines.add}
            </Button>
            {/* 규범 4 - 사유는 감추지 않고 그 컨트롤 바로 아래에 붙여 잇는다. */}
            {online ? null : (
              <p className="physical-count__reason" id="physical-count-add-reason">
                {t.lines.addOffline}
              </p>
            )}
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="physical-count__note">{t.noWorker}</p> : null}
            <Button
              className="physical-count__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void submit()}
            >
              {t.submit}
            </Button>
          </section>

          {/*
            숫자판은 줄 사이에 끼우지 않는다. 끼우면 그 아래 줄들이 화면 밖으로 밀려 적던
            자리를 잃고, 뒤이어 뜨는 차이 사유가 숫자판 아래에 생겨 어디서 온 칸인지 알 수
            없다. 기기 키보드처럼 화면 아래에 붙여 목록 위에 띄운다.

            목록 밖에 서므로 어느 줄에 적는 중인지 스스로 말한다.
          */}
          {keypad === null ? null : (
            <div className="physical-count__keypad">
              <p className="physical-count__keypad-head">{nameOf(keypad.line)}</p>
              <NumberPad
                value={keypad.line.qty}
                onChange={(value) => {
                  setLines((current) =>
                    current.map((each, at2) => {
                      if (at2 !== keypad.at) return each;
                      const changed = { ...each, qty: value };

                      return count !== null && !needsReason(count, changed)
                        ? { ...changed, reasonCode: '' }
                        : changed;
                    }),
                  );
                }}
                allowDecimal
                /*
                 * 소수점 키 옆 빈 칸이 확인 키 자리다. 닫는 단추를 따로 세우면 숫자판이 한 줄
                 * 더 길어져 그만큼 목록이 가려진다.
                 */
                onConfirm={() => {
                  setKeypadFor(null);
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
