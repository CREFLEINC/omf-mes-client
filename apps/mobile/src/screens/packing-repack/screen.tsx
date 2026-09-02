import { AlertBanner, Button, Card, Radio, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import {
  handlingUnitKeys,
  useLotLabels,
  useScannedHandlingUnit,
  type ScannedHandlingUnit,
} from '../../patterns/handling-units';
import { useItemLabels, useUomCodes } from '../../patterns/masters';
import { createIdempotencyKey, useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  MERGE,
  RECONFIGURE,
  SPLIT,
  canConfirm,
  mergedPairs,
  pooledContents,
  qtyProblemOf,
  remainderOf,
  toCreateDraft,
  toReplaceDraft,
  type DraftLine,
  type RepackType,
} from './repack';
import './screen.css';

const t = messages.packingRepack;

type Outcome = 'queued' | 'sent' | 'rejected';

const TYPES: { value: RepackType; label: string }[] = [
  { value: MERGE, label: t.type.merge },
  { value: SPLIT, label: t.type.split },
  { value: RECONFIGURE, label: t.type.reconfigure },
];

export const PackingRepackScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush } = useOutbox();
  const queryClient = useQueryClient();
  const { worker } = useWorkerSession();

  const [sources, setSources] = useState<ScannedHandlingUnit[]>([]);
  const [scanned, setScanned] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [type, setType] = useState<RepackType | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [manual, setManual] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const found = useScannedHandlingUnit(scanned);
  const uoms = useUomCodes(sources.length > 0);
  /* 내용물은 품목·LOT 식별자만 준다. 그 번호로는 실물 라벨과 대조할 수 없다. */
  const itemLabels = useItemLabels(sources.length > 0);
  const lotLabels = useLotLabels(sources);

  const pooled = pooledContents(sources);
  const merged = mergedPairs(sources);
  const remainder = remainderOf(sources, lines);
  const ready = canConfirm(sources, lines, worker !== null) && type !== null;

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
      if (current.some((each) => each.handlingUnit.handlingUnitId === unit.handlingUnit.handlingUnitId)) {
        setDuplicate(true);
        return current;
      }

      setDuplicate(false);
      setLines((drafted) => [
        ...drafted,
        ...unit.contents
          .filter((content) => !drafted.some((line) => line.lotId === content.lotId))
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
          .some((each) => each.contents.some((content) => content.lotId === line.lotId)),
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
    scanField.focus();
  };

  const submit = async () => {
    if (worker === null || type === null) {
      return;
    }

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

    await enqueue(create);

    for (const replace of replaces) {
      await enqueue(replace);
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

    if (result !== null && result.rejected.some((each) => mine(each.entry))) {
      setOutcome('rejected');
      return;
    }

    setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
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
          label={sources.length === 0 ? t.source.scanLabel : t.source.add}
          placeholder={t.source.scanPlaceholder}
          size="xl"
          fullWidth
        />
        {/* 스캔 칸은 스캐너 전용이다. 스캔이 실패했을 때 손으로 넣을 길을 함께 둔다. */}
        <div className="repack__row">
          <TextField
            label={t.source.manualLabel}
            size="xl"
            fullWidth
            value={manual}
            onChange={(event) => {
              setManual(event.target.value);
            }}
          />
          <Button
            variant="outlined"
            size="xl"
            onClick={() => {
              setDuplicate(false);
              setScanned(manual.trim());
              setManual('');
            }}
          >
            {t.source.manualSubmit}
          </Button>
        </div>

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

          <section className="repack__section">
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

          <section className="repack__section">
            <h2>{t.contents.legend}</h2>
            {lines.map((line, index) => {
              const pool = pooled.find((content) => content.lotId === line.lotId);
              const problem = pool === undefined ? null : qtyProblemOf(line, pool.qty);
              const limit = `${String(pool?.qty ?? 0)} ${uomOf(line.uomId)}`;

              return (
                <div key={line.lotId} className="repack__line">
                  <TextField
                    label={t.contents.qtyLabel(nameOf(line))}
                    size="xl"
                    fullWidth
                    inputMode="numeric"
                    value={line.qty}
                    onChange={(event) => {
                      const next = event.target.value;
                      setLines((current) =>
                        current.map((each, at) => (at === index ? { ...each, qty: next } : each)),
                      );
                    }}
                    error={
                      problem === null || line.qty.trim() === ''
                        ? undefined
                        : problem === 'overPooled'
                          ? t.contents.problem.overPooled(limit)
                          : t.contents.problem[problem]
                    }
                  />
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

          <section className="repack__section">
            {worker === null ? <p className="repack__note">{t.noWorker}</p> : null}
            {type === null ? <p className="repack__note">{t.noType}</p> : null}
            <Button
              className="repack__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void submit()}
            >
              {t.submit}
            </Button>
          </section>
        </>
      )}
    </div>
  );
};
