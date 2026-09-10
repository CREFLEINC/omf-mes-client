import { AlertBanner, Button, Card, NumberPad, Radio, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { playErrorTone } from '../../patterns/error-tone';
import {
  handlingUnitKeys,
  useLotLabels,
  useScannedHandlingUnit,
  type ScannedHandlingUnit,
} from '../../patterns/handling-units';
import { useItemLabels, useUomCodes } from '../../patterns/masters';
import { createIdempotencyKey, useOutbox } from '../../patterns/outbox';
import { ManualEntry } from '../../patterns/manual-entry';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useRepackEvents, useShipmentAllocations } from './queries';
import {
  MERGE,
  RECONFIGURE,
  SPLIT,
  allocatedSources,
  canConfirm,
  contentKey,
  mergedPairs,
  pooledContents,
  qtyProblemOf,
  remainderOf,
  toCreateDraft,
  toReplaceDraft,
  unverifiedSources,
  type DraftLine,
  type RepackType,
} from './repack';
import './screen.css';

const numbersOf = (units: ScannedHandlingUnit[]): string =>
  units.map((unit) => unit.handlingUnit.handlingUnitNo).join(' · ');

const t = messages.packingRepack;
const required = messages.common.required;

const stamp = (iso: string): string => {
  const at = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

type Outcome = 'queued' | 'sent' | 'rejected';

const TYPES: { value: RepackType; label: string }[] = [
  { value: MERGE, label: t.type.merge },
  { value: SPLIT, label: t.type.split },
  { value: RECONFIGURE, label: t.type.reconfigure },
];

export const PackingRepackScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected } = useOutbox();
  const queryClient = useQueryClient();
  const { worker } = useWorkerSession();

  const [sources, setSources] = useState<ScannedHandlingUnit[]>([]);
  const [scanned, setScanned] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [type, setType] = useState<RepackType | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [manual, setManual] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /* 키패드는 지금 적는 줄 아래에만 선다(공유계약 D-4). 줄마다 두면 화면이 키패드로 찬다. */
  const [keypadFor, setKeypadFor] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  /* 같은 라벨을 다시 읽으면 상태는 그대로라 소리가 다시 나지 않는다. 회차를 함께 센다. */
  const [scanSeq, setScanSeq] = useState(0);
  const typeSection = useRef<HTMLDivElement | null>(null);
  const contentsSection = useRef<HTMLDivElement | null>(null);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 묶음이 하나 더 담기고, 같은 물건이 두 번 재구성된다.
   */
  const inFlight = useRef(false);

  const found = useScannedHandlingUnit(scanned);
  const uoms = useUomCodes(sources.length > 0);
  /* 내용물은 품목·LOT 식별자만 준다. 그 번호로는 실물 라벨과 대조할 수 없다. */
  const itemLabels = useItemLabels(sources.length > 0);
  const lotLabels = useLotLabels(sources);

  const allocations = useShipmentAllocations(sources);

  const pooled = pooledContents(sources);
  const merged = mergedPairs(sources);
  const remainder = remainderOf(sources, lines);
  const blocked = allocatedSources(sources, allocations);
  const unverified = unverifiedSources(sources, allocations);
  const ready = canConfirm(sources, lines, worker !== null, allocations) && type !== null;

  /* 이력은 원 포장에 달린다. 합병이면 첫 포장이 잔량을 갖는 쪽이라 그 포장의 이력을 본다. */
  const historyOf = sources[0]?.handlingUnit.handlingUnitId ?? null;
  const history = useRepackEvents(historyOf, historyOpen);

  /*
   * 스캔한 것을 찾지 못했다는 것을 소리로도 알린다(공유계약 D-2). 기기를 허리에 매단 채
   * 읽으므로 화면에만 적으면 사람은 통과한 줄 알고 다음 포장을 집는다.
   */
  const scanMissed = scanned !== null && found.isSuccess && found.data === null;

  useEffect(() => {
    if (scanMissed) {
      playErrorTone();
    }
  }, [scanMissed, scanSeq]);

  /* 세로 화면이라 채운 구획이 자리를 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(sources.length > 0, typeSection);
  useAdvanceTo(type !== null, contentsSection);

  /*
   * 뒤로가기는 스캔한 포장을 먼저 놓는다. 두지 않으면 수량을 적던 사람이 한 번에 작업
   * 목록까지 나가 포장을 다시 스캔해야 한다.
   */
  useBackStep(sources.length > 0, () => {
    restart();
  });

  const uomOf = (uomId: number): string => uoms.data?.get(uomId) ?? '';

  const nameOf = (content: { itemId: number; lotId: number }): string => {
    const item = itemLabels.data?.get(content.itemId);
    const lotNo = lotLabels.get(content.lotId) ?? String(content.lotId);

    return t.contents.lot(item === undefined ? '' : item.itemCode, lotNo);
  };

  const label = (content: { itemId: number; lotId: number; qty: number; uomId: number }): string =>
    `${nameOf(content)} · ${String(content.qty)} ${uomOf(content.uomId)}`;

  /*
   * 찾은 포장을 목록에 얹는다. 조회가 끝난 뒤에 일어나야 해서 렌더 중에 하지 않는다.
   *
   * 같은 포장을 두 번 세면 물건이 두 배로 있는 것처럼 보이므로 이미 있는 것은 말하고 만다.
   */
  useEffect(() => {
    const unit = found.data;

    if (unit === undefined || unit === null) {
      return;
    }

    setScanned(null);

    setSources((current) => {
      if (
        current.some(
          (each) => each.handlingUnit.handlingUnitId === unit.handlingUnit.handlingUnitId,
        )
      ) {
        setDuplicate(true);
        return current;
      }

      setDuplicate(false);
      setLines((drafted) => [
        ...drafted,
        ...unit.contents
          .filter((content) => !drafted.some((line) => contentKey(line) === contentKey(content)))
          .map((content) => ({
            itemId: content.itemId,
            lotId: content.lotId,
            uomId: content.uomId,
            qty: '',
          })),
      ]);

      return [...current, unit];
    });
  }, [found.data]);

  const scanField = useScanField({
    onScan: (value) => {
      setDuplicate(false);
      setScanned(value.trim());
      setScanSeq((seq) => seq + 1);
    },
  });

  const drop = (handlingUnitId: number) => {
    const dropped = sources.find((each) => each.handlingUnit.handlingUnitId === handlingUnitId);

    setSources((current) =>
      current.filter((each) => each.handlingUnit.handlingUnitId !== handlingUnitId),
    );

    /* 뺀 포장에만 있던 LOT 은 담을 곳이 없어진다. 그 줄을 남기면 없는 것에 수량을 적는다. */
    setLines((current) =>
      current.filter((line) =>
        sources
          .filter((each) => each.handlingUnit.handlingUnitId !== handlingUnitId)
          .some((each) =>
            each.contents.some((content) => contentKey(content) === contentKey(line)),
          ),
      ),
    );

    if (dropped === undefined) {
      setDuplicate(false);
    }
  };

  const restart = () => {
    setSources([]);
    setLines([]);
    setType(null);
    setScanned(null);
    setManual('');
    setDuplicate(false);
    setOutcome(null);
    setKeypadFor(null);
    setHistoryOpen(false);
    scanField.focus();
  };

  const submit = async () => {
    if (worker === null || type === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const now = new Date();
      /* 새 포장과 원 포장 치환이 한 묶음이다. 앞이 거부되면 뒤가 함께 되돌아간다. */
      const batchId = createIdempotencyKey();
      const create = toCreateDraft(sources, lines, batchId, now, worker.workerNo);

      /*
       * 잔량은 첫 포장에 남긴다 - 분할 잔량이 원 번호를 그대로 쓴다는 규칙이고, 나머지 원
       * 포장들은 내용이 첫 포장으로 모였으므로 비운다.
       */
      const replaces = sources.map((source, index) =>
        toReplaceDraft(source, index === 0 ? remainder : [], batchId, now, worker.workerNo),
      );

      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 재구성된 줄 안다. */
      try {
        await enqueue(create);

        for (const replace of replaces) {
          await enqueue(replace);
        }
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);

      /*
       * 우리가 방금 바꾼 포장이다. 캐시를 두면 다음 스캔이 옛 수량을 보이고, 구성 치환은 집합을
       * 통째로 갈아 끼우므로 그 옛 수량으로 계산한 잔량이 실재를 덮어 물건이 조용히 사라진다.
       */
      queryClient.removeQueries({ queryKey: handlingUnitKeys.root });

      /*
       * 묶음 전체를 본다. 새 포장 하나만 보면 원 포장 치환이 거부돼도 성공으로 보이는데, 그때
       * 새 포장은 이미 만들어졌고 원 포장은 그대로라 같은 물건이 두 곳에 있게 된다. 되돌리기
       * 경로가 없고 작업자는 끝난 줄 안다.
       */
      const keys = new Set([create, ...replaces].map((entry) => entry.idempotencyKey));
      const mine = (each: { idempotencyKey: string }) => keys.has(each.idempotencyKey);

      /*
       * 자기가 부른 보내기의 결과만 보면 딸려 되돌아간 건을 놓친다 - 그 판정은 셸이 도는 다른
       * 회차에서 내려질 수 있고, 화면은 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        [...keys].some((key) => isRejected(key))
      ) {
        setOutcome('rejected');
        return;
      }

      setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
    } finally {
      inFlight.current = false;
    }
  };

  if (outcome !== null) {
    return (
      <div className="repack">
        {outcome === 'sent' ? <AlertBanner variant="success" title={t.sent.title} /> : null}
        {outcome === 'queued' ? (
          <AlertBanner variant="warning" title={t.queued.title}>
            {t.queued.description}
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <Button variant="filled" size="2xl" className="repack__wide" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="repack">
      <section className="repack__section">
        <h2>{t.source.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={sources.length === 0 ? required(t.source.scanLabel) : t.source.add}
          placeholder={t.source.scanPlaceholder}
          size="xl"
          fullWidth
        />
        <ManualEntry
          label={t.source.manualLabel}
          submitLabel={t.source.manualSubmit}
          value={manual}
          onChange={setManual}
          onSubmit={() => {
            setDuplicate(false);
            setScanned(manual.trim());
            setManual('');
          }}
        />

        {scanned !== null && found.isPending ? <p role="status">{t.source.loading}</p> : null}
        {found.isError ? <AlertBanner variant="warning" title={t.source.loadFailed} /> : null}
        {duplicate ? <AlertBanner variant="warning" title={t.source.already} /> : null}
        {scanned !== null && found.data === null ? (
          <AlertBanner variant="error" title={t.source.notFound(scanned)} />
        ) : null}

        {sources.map((source) => (
          <Card bordered key={source.handlingUnit.handlingUnitId}>
            <Card.Header>{source.handlingUnit.handlingUnitNo}</Card.Header>
            <Card.Body className="card-body">
              {source.contents.length === 0 ? <p>{t.source.empty}</p> : null}
              <ul className="repack__contents">
                {source.contents.map((content) => (
                  <li key={content.handlingUnitContentId}>{label(content)}</li>
                ))}
              </ul>
              <Button
                variant="text"
                size="xl"
                onClick={() => {
                  drop(source.handlingUnit.handlingUnitId);
                }}
              >
                {t.source.remove}
              </Button>
            </Card.Body>
          </Card>
        ))}

        {/* 스캔 자리에서 말한다. 아래에서만 말하면 수량을 다 적고 마지막에 막힌 것을 안다. */}
        {blocked.length > 0 ? (
          <AlertBanner variant="error" title={t.allocated.title(numbersOf(blocked))}>
            {t.allocated.description}
          </AlertBanner>
        ) : null}
        {blocked.length === 0 && unverified.length > 0 ? (
          <AlertBanner variant="warning" title={t.unverified.title(numbersOf(unverified))}>
            {t.unverified.description}
          </AlertBanner>
        ) : null}
      </section>

      {sources.length === 0 ? null : (
        <>
          {merged.length === 0 ? null : (
            <AlertBanner variant="info" title={t.source.scanned(sources.length)}>
              {merged.map((pair) => (
                <p key={pair.content.handlingUnitContentId}>
                  {t.contents.merged(
                    String(pair.parts[0] ?? 0),
                    pair.parts.slice(1).map(String).join(' · '),
                    `${String(pair.content.qty)} ${uomOf(pair.content.uomId)}`,
                  )}
                </p>
              ))}
            </AlertBanner>
          )}

          <section className="repack__section" ref={typeSection}>
            <h2>{t.type.legend}</h2>
            {TYPES.map((each) => (
              <Radio
                key={each.value}
                name="repack-type"
                value={each.value}
                checked={type === each.value}
                onChange={() => {
                  setType(each.value);
                }}
              >
                {each.label}
              </Radio>
            ))}
          </section>

          <section className="repack__section" ref={contentsSection}>
            <h2>{t.contents.legend}</h2>
            {lines.map((line, index) => {
              const pool = pooled.find((content) => contentKey(content) === contentKey(line));
              const problem = pool === undefined ? null : qtyProblemOf(line, pool.qty);
              const limit = `${String(pool?.qty ?? 0)} ${uomOf(line.uomId)}`;

              return (
                <div key={contentKey(line)} className="repack__line">
                  <TextField
                    label={required(t.contents.qtyLabel(nameOf(line)))}
                    size="xl"
                    fullWidth
                    /*
                     * 장갑을 끼고 한 손으로 조작한다. 기기 키보드는 키가 촘촘하고, 올라오면
                     * 구성 표와 확정 단추를 덮는다(설계 §7 · 공유계약 G-6).
                     */
                    inputMode="none"
                    value={line.qty}
                    onChange={(event) => {
                      const next = event.target.value;
                      setLines((current) =>
                        current.map((each, at) => (at === index ? { ...each, qty: next } : each)),
                      );
                    }}
                    onFocus={() => {
                      setKeypadFor(contentKey(line));
                    }}
                    error={
                      problem === null || line.qty.trim() === ''
                        ? undefined
                        : problem === 'overPooled'
                          ? t.contents.problem.overPooled(limit)
                          : t.contents.problem[problem]
                    }
                  />
                  {keypadFor !== contentKey(line) ? null : (
                    <NumberPad
                      value={line.qty}
                      onChange={(next) => {
                        setLines((current) =>
                          current.map((each, at) => (at === index ? { ...each, qty: next } : each)),
                        );
                      }}
                      max={pool?.qty}
                      allowDecimal
                    />
                  )}
                  <p className="repack__pooled">{t.contents.pooled(limit)}</p>
                </div>
              );
            })}
          </section>

          <section className="repack__section">
            <h2>{t.remainder.legend}</h2>
            {remainder.length === 0 ? (
              <p>{t.remainder.none}</p>
            ) : (
              <Card bordered>
                <Card.Header>
                  {t.remainder.keepsNumber(sources[0]?.handlingUnit.handlingUnitNo ?? '')}
                </Card.Header>
                <Card.Body className="card-body">
                  <ul className="repack__contents">
                    {remainder.map((content) => (
                      <li key={content.handlingUnitContentId}>{label(content)}</li>
                    ))}
                  </ul>
                </Card.Body>
              </Card>
            )}
          </section>

          <p className="repack__note">{t.labelNotice}</p>

          {/* 되돌리기가 없는 화면이라 지난 재구성을 되짚을 길이 화면 안에 있어야 한다. */}
          <section className="repack__section">
            <Button
              className="repack__wide"
              variant="text"
              size="xl"
              onClick={() => {
                setHistoryOpen((open) => !open);
              }}
            >
              {historyOpen ? t.history.close : t.history.open}
            </Button>

            {!historyOpen ? null : (
              <>
                <h2>{t.history.legend}</h2>
                {history.isPending ? <p role="status">{t.history.loading}</p> : null}
                {/* 확인하지 못한 것을 이력이 없는 것으로 말하지 않는다. */}
                {history.isError ? (
                  <AlertBanner variant="warning" title={t.history.loadFailed} />
                ) : null}
                {history.isSuccess && history.data.length === 0 ? <p>{t.history.none}</p> : null}
                {(history.data ?? []).map((event) => (
                  <Card bordered key={event.repackEventId}>
                    <Card.Header>
                      {`${t.history.type[event.repackTypeCode]} · ${stamp(event.occurredAt)}`}
                    </Card.Header>
                    <Card.Body className="card-body">
                      <ul className="repack__contents">
                        {event.lines.map((line) => (
                          <li
                            key={`${String(line.handlingUnitId)}/${contentKey(line)}/${line.roleCode}`}
                          >
                            {t.history.line(
                              t.history.role[line.roleCode],
                              nameOf(line),
                              String(line.qtyBefore),
                              String(line.qtyAfter),
                            )}
                          </li>
                        ))}
                      </ul>
                    </Card.Body>
                  </Card>
                ))}
              </>
            )}
          </section>

          <section className="repack__section">
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="repack__note">{t.noWorker}</p> : null}
            {type === null ? <p className="repack__note">{t.noType}</p> : null}
            <div className="action-bar">
              <Button
                className="repack__wide"
                variant="filled"
                size="2xl"
                disabled={!ready}
                onClick={() => void submit()}
              >
                {t.submit}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
