import { AlertBanner, Button, Card, NumberPad, Select, TextArea, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useLocations } from '../../patterns/locations';
import { useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useItemsByCode, useWarehouses } from './queries';
import {
  canSubmit,
  qtyProblem,
  recycledRowOf,
  toOutboxDraft,
  type RecycleDraft,
  type RecycleEntry,
} from './recycle';
import './screen.css';

const t = messages.recycleEntry;

type Outcome = 'queued' | 'sent' | 'rejected';

const emptyDraft: RecycleDraft = {
  itemCode: '',
  warehouseId: null,
  location: null,
  quantity: '',
  remarks: '',
};

export const RecycleEntryScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected, loaded } = useOutbox();
  const { worker } = useWorkerSession();

  const [draft, setDraft] = useState<RecycleDraft>(emptyDraft);
  const [searching, setSearching] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [lotNo, setLotNo] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 두 건이 담기고, 서버가 흡수하지 못해 재고가 두 번 는다.
   */
  const inFlight = useRef(false);

  const patch = (next: Partial<RecycleDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const take = (value: string) => {
    const code = value.trim();

    if (code === '') {
      return;
    }

    setSearching(code);
    patch({ itemCode: code });
  };

  const scanField = useScanField({ onScan: take });

  const rows = useItemsByCode(searching);
  const warehouses = useWarehouses();
  const locations = useLocations(draft.warehouseId);
  const uoms = useUomCodes(true);

  /*
   * 품목코드 하나에 행이 둘 온다. 첫 행을 잡으면 신재로 재고가 늘고 되돌릴 자리가 없어,
   * 구분으로 가른 뒤에만 고른 것으로 친다.
   */
  const item = rows.data === undefined ? null : recycledRowOf(rows.data);
  const missing = rows.data !== undefined && item === null;

  const ready = loaded && canSubmit(draft, item, worker !== null);
  const uom = item?.baseUomId === undefined ? null : (uoms.data?.get(item.baseUomId) ?? null);

  const qtyMessage = (): string | undefined => {
    const problem = qtyProblem(draft.quantity);

    return problem === null || draft.quantity === '' ? undefined : t.qty[problem];
  };

  const restart = () => {
    setDraft(emptyDraft);
    setSearching(null);
    setManual('');
    setOutcome(null);
    setLotNo(null);
    setSaveFailed(false);
    scanField.focus();
  };

  const submit = async () => {
    if (
      worker === null ||
      item === null ||
      draft.warehouseId === null ||
      draft.location === null ||
      inFlight.current
    ) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const entry = toOutboxDraft(
        draft,
        item.itemId,
        draft.warehouseId,
        draft.location.locationId,
        new Date(),
        worker.workerNo,
      );

      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 등록된 줄 안다. */
      try {
        await enqueue(entry);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === entry.idempotencyKey;

      /*
       * 자기가 부른 보내기의 결과만 보면 딸려 되돌아간 건을 놓친다 - 그 판정은 셸이 도는 다른
       * 회차에서 내려질 수 있고, 화면은 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(entry.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      if (result === null || result.remaining.some(mine)) {
        setOutcome('queued');
        return;
      }

      /* 번호는 서버가 매긴다. 간 건에만 있고, 담긴 채로 끝나면 아직 없다. */
      const sent = result.responses.get(entry.idempotencyKey) as RecycleEntry | undefined;

      setLotNo(sent?.lotNo ?? null);
      setOutcome('sent');
    } finally {
      inFlight.current = false;
    }
  };

  if (outcome !== null) {
    return (
      <div className="recycle">
        {outcome === 'sent' ? (
          <AlertBanner variant="success" title={t.sent.title}>
            {lotNo === null ? null : <p>{t.sent.lotNo(lotNo)}</p>}
          </AlertBanner>
        ) : null}
        {outcome === 'queued' ? (
          <AlertBanner variant="warning" title={t.queued.title}>
            <p>{t.queued.description}</p>
            <p>{t.queued.labelLater}</p>
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <Button className="recycle__wide" variant="filled" size="2xl" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="recycle">
      <section className="recycle__section">
        <h2>{t.item.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.item.label}
          placeholder={t.item.placeholder}
          size="xl"
          fullWidth
        />
        {/* 스캔이 실패했을 때 손으로 넣을 길을 함께 둔다. */}
        <div className="recycle__row">
          <TextField
            label={t.item.manualSubmit}
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
              take(manual);
              setManual('');
            }}
          >
            {t.item.manualSubmit}
          </Button>
        </div>

        {rows.isPending && searching !== null ? <p role="status">{t.item.searching}</p> : null}
        {rows.isError ? <AlertBanner variant="error" title={t.item.loadFailed} /> : null}
        {/* 이 화면은 품목을 만들지 않는다. 없으면 어디서 만드는지 알린다. */}
        {missing ? (
          <AlertBanner variant="warning" title={t.item.notRecycled}>
            {t.item.notRecycledWhy}
          </AlertBanner>
        ) : null}

        {item === null ? null : (
          <Card bordered>
            <Card.Body className="card-body recycle__card">
              <strong>{t.item.chosen(item.itemCode, item.itemName)}</strong>
              <p>{uom === null ? t.item.uomUnknown : t.item.uom(uom)}</p>
            </Card.Body>
          </Card>
        )}
      </section>

      {item === null ? null : (
        <>
          <section className="recycle__section">
            <h2>{t.place.legend}</h2>
            {warehouses.isPending ? <p role="status">{t.place.warehouseLoading}</p> : null}
            {warehouses.isError ? (
              <AlertBanner variant="error" title={t.place.warehouseLoadFailed} />
            ) : null}
            {warehouses.data !== undefined && warehouses.data.length === 0 ? (
              <AlertBanner variant="warning" title={t.place.warehouseNone} />
            ) : null}
            {warehouses.data === undefined ? null : (
              <div className="recycle__field">
                <label htmlFor="recycle-warehouse">{t.place.warehouseLabel}</label>
                <Select
                  id="recycle-warehouse"
                  placeholder={t.place.warehousePlaceholder}
                  size="xl"
                  value={draft.warehouseId === null ? null : String(draft.warehouseId)}
                  onChange={(value) => {
                    /* 창고가 바뀌면 앞 창고의 위치는 이 창고에 없다. */
                    patch({ warehouseId: Number(value), location: null });
                  }}
                  options={warehouses.data.map((each) => ({
                    value: String(each.warehouseId),
                    label: each.warehouseName,
                  }))}
                />
              </div>
            )}

            {draft.warehouseId === null ? null : (
              <>
                {locations.isPending ? <p role="status">{t.place.locationLoading}</p> : null}
                {locations.isError ? (
                  <AlertBanner variant="error" title={t.place.locationLoadFailed} />
                ) : null}
                {locations.data !== undefined && locations.data.length === 0 ? (
                  <AlertBanner variant="warning" title={t.place.locationNone} />
                ) : null}
                {locations.data === undefined ? null : (
                  <div className="recycle__field">
                    <label htmlFor="recycle-location">{t.place.locationLabel}</label>
                    <Select
                      id="recycle-location"
                      placeholder={t.place.locationPlaceholder}
                      size="xl"
                      value={draft.location === null ? null : String(draft.location.locationId)}
                      onChange={(value) => {
                        patch({
                          location:
                            locations.data.find((each) => each.locationId === Number(value)) ??
                            null,
                        });
                      }}
                      options={locations.data.map((each) => ({
                        value: String(each.locationId),
                        label: `${each.locationCode} ${each.locationName}`,
                      }))}
                    />
                  </div>
                )}
              </>
            )}
          </section>

          <section className="recycle__section">
            <h2>{t.qty.legend}</h2>
            <TextField
              label={t.qty.label}
              inputMode="decimal"
              size="xl"
              fullWidth
              value={draft.quantity}
              onChange={(event) => {
                patch({ quantity: event.target.value });
              }}
              error={qtyMessage()}
            />
            <NumberPad
              value={draft.quantity}
              onChange={(value) => {
                patch({ quantity: value });
              }}
              allowDecimal
            />
            <TextArea
              label={t.qty.remarks}
              size="xl"
              fullWidth
              value={draft.remarks}
              onChange={(event) => {
                patch({ remarks: event.target.value });
              }}
            />
          </section>

          <section className="recycle__section">
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {/* 번호를 화면이 정하면 오프라인 두 단말이 같은 번호를 만든다. 먼저 말해 둔다. */}
            <p className="recycle__note">{t.numberLater}</p>
            {worker === null ? <p className="recycle__note">{t.noWorker}</p> : null}
            <Button
              className="recycle__wide"
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
