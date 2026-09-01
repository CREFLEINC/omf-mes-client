import { Button, Chip, Progress, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { NumericKeypad } from '../../ds-candidates/numeric-keypad';
import { readQty, validateQty, type QtyDrafts } from './input-qty';
import type { LotStatusLabels } from './lot-status-labels';
import type { RecordedNote } from './mutations';
import { isShotCountExceeded, type ScanDraft } from './scan';

const t = messages.materialInputScan;

/**
 * 친 수량의 문제를 문장으로 옮긴다. **빈 칸은 아직 오류가 아니다** — 담자마자 붉은 글씨가
 * 뜨면 작업자가 무언가 잘못한 것으로 읽는다. 보내는 자리에서 막는 것으로 충분하다.
 */
const qtyError = (draft: string): string | undefined => {
  const problem = validateQty(draft);
  if (problem === null || problem === 'empty') return undefined;

  return t.scanned.qtyProblems[problem];
};

export interface ScannedListProps {
  draft: ScanDraft;
  statusLabels: LotStatusLabels;
  qtyDrafts: QtyDrafts;
  /** 서버가 통과시키되 기록만 한 것(§5-3). 기록된 줄에만 붙는다. */
  notes: readonly RecordedNote[];
  /** 이미 기록된 자재. **되돌릴 수 없다** — 잠그고 빼기도 내리지 않는다. */
  recordedLotIds: readonly number[];
  /** 지금 기록 중인 자재. 그 줄만 잠근다. */
  savingLotId: number | null;
  onQtyChange: (lotId: number, value: string) => void;
  onRemoveMaterial: (lotId: number) => void;
  /** 수량을 마치고 그 한 건을 기록한다 — 스펙 §5-8 건별 저장. */
  onRecord: (lotId: number) => void;
}

/**
 * 담은 자재와 물린 금형 — **아직 보내지 않은 것**이다.
 *
 * LOT 상태는 **표시명으로 옮겨 낸다** — 계약이 `Lot.statusCode` 설명에 조회 경로를 못박아
 * 두었다(공유계약 G-2). 현장에서 읽는 화면에 `NORMAL` 같은 원문 코드를 낼 이유가 없다.
 *
 * ⛔ **옮기는 것은 이름뿐이다.** 값으로 색을 가르거나 문구를 지어내지 않는다 — 투입 가부는
 * 서버가 정하고(스펙 §5-2), 화면이 갈래를 만들면 **화면이 판정한 것처럼 읽힌다.** 이름을
 * 못 받으면 원문 코드를 그대로 낸다: 옮기지 못한 것과 값이 없는 것은 다르다.
 *
 * **품질 판정과 보류는 다른 축이라 줄을 나눈다.** 나란히 두면 「정상인데 보류 중」이 모순처럼
 * 읽힌다 — 하나는 검사 결과이고 하나는 지금 묶여 있는지다.
 */
export const ScannedList = ({
  draft,
  statusLabels,
  qtyDrafts,
  notes,
  recordedLotIds,
  savingLotId,
  onQtyChange,
  onRemoveMaterial,
  onRecord,
}: ScannedListProps) => (
  <>
    <h2 className="pane-title">{t.scanned.materialsLabel}</h2>

    {statusLabels.isUnavailable && draft.materials.length > 0 && (
      <p className="field-note">{t.scanned.statusLabelUnavailable}</p>
    )}

    {draft.materials.length === 0 ? (
      <p className="field-note">{t.scanned.empty}</p>
    ) : (
      <ul className="scanned-items">
        {draft.materials.map((material) => {
          const isRecorded = recordedLotIds.includes(material.lotId);
          const isSaving = savingLotId === material.lotId;

          return (
            <li key={material.lotId} className="scanned-item">
              <div className="scanned-item-head">
                <span className="scanned-code">{material.lotNo}</span>

                {/*
                 * ⭐ **기록된 줄에는 「빼기」를 두지 않는다.** 화면에서 빼도 서버 기록은 남아
                 * 정정 경로조차 없다(이력 불변 B-3 · §8 미결 9) — 뺄 수 있는 것처럼 보이면
                 * 작업자가 지웠다고 믿고 넘어간다.
                 */}
                {isRecorded ? (
                  <Chip variant="status" size="sm" status="success">
                    {t.scanned.recordedMark}
                  </Chip>
                ) : (
                  /*
                   * 「빼기」는 담은 것을 되돌리는 평범한 조작이다. 브랜드 기본색이 붉은 계열이라
                   * 테두리 변형을 쓰면 **위험 액션처럼 보인다** — 중립 변형으로 둔다.
                   */
                  <Button
                    variant="text"
                    size="sm"
                    disabled={isSaving}
                    aria-label={t.scanned.removeMaterial(material.lotNo)}
                    onClick={() => {
                      onRemoveMaterial(material.lotId);
                    }}
                  >
                    {t.scanned.remove}
                  </Button>
                )}
              </div>
              <div className="scanned-item-facts">
                <span className="field-note">
                  {t.scanned.statusLabel} · {statusLabels.describe(material.statusCode)}
                </span>
                {material.isHeld && (
                  <Chip variant="status" size="sm" status="warning">
                    {t.scanned.heldMark}
                  </Chip>
                )}

                {/*
                 * 서버가 **통과시키되 기록만 한 것**(스펙 §5-3). 「통과」가 「정상」이 아니다 —
                 * 나중에 계보를 추적할 때 이 구분이 필요하다. 보내기 전에는 비어 있다.
                 */}
                {notes
                  .filter((note) => note.lotId === material.lotId)
                  .map((note) => (
                    <span key={note.lotId} className="scanned-item-notes">
                      {note.unlinkedIssue && (
                        <Chip variant="status" size="sm" status="info">
                          {t.scanned.unlinkedIssue}
                        </Chip>
                      )}
                      {note.crossProcess && (
                        <Chip variant="status" size="sm" status="info">
                          {t.scanned.crossProcess}
                        </Chip>
                      )}
                    </span>
                  ))}
              </div>

              {/*
               * 스펙 §4-B의 **유일한 「입력」 칸**이다. 단위 환산은 서버가 하므로(§5-6) 화면은
               * 스캔한 LOT의 단위로 받은 값을 그대로 싣는다.
               *
               * ⛔ **기록된 뒤에는 고칠 수 없다.** 투입은 정정이 아니라 새 기록으로만 고치는데
               * (B-3) 계약에 그 경로가 없다(§8 미결 9) — 고칠 수 있는 것처럼 두면 작업자가
               * 고쳤다고 믿고 넘어간다.
               */}
              <TextField
                label={t.scanned.qtyLabel(material.lotNo)}
                value={readQty(qtyDrafts, material.lotId)}
                inputMode="decimal"
                autoComplete="off"
                readOnly={isRecorded || isSaving}
                error={isRecorded ? undefined : qtyError(readQty(qtyDrafts, material.lotId))}
                onChange={(event) => {
                  onQtyChange(material.lotId, event.target.value);
                }}
              />

              {/*
               * ⭐ **화면 내장 키패드**(공유계약 D-4) — OS 터치 키보드에 의존하지 않는다.
               * 키오스크 창에서 그것이 화면을 덮으면 제어할 방법이 없다.
               *
               * 「기록」이 곧 저장이다(§5-8 건별 저장) — 여기서 보내야 BOM 불일치가 **스캔
               * 자리에서** 드러나고, 그 자재가 원장에 남지 않는다.
               */}
              {!isRecorded && (
                <>
                  <p className="field-note">{t.scanned.saveHint}</p>
                  <NumericKeypad
                    value={readQty(qtyDrafts, material.lotId)}
                    label={t.scanned.keypadLabel(material.lotNo)}
                    submitLabel={isSaving ? t.scanned.saving : t.scanned.keypadSubmit}
                    clearLabel={t.scanned.keypadClear}
                    backspaceLabel={t.scanned.keypadBackspace}
                    onChange={(next) => {
                      onQtyChange(material.lotId, next);
                    }}
                    onSubmit={() => {
                      onRecord(material.lotId);
                    }}
                  />
                </>
              )}
            </li>
          );
        })}
      </ul>
    )}

    <h2 className="pane-title">{t.scanned.moldLabel}</h2>

    {draft.mold === null ? (
      <p className="field-note">{t.scanned.moldEmpty}</p>
    ) : (
      <div className="scanned-mold">
        <span className="scanned-code">
          {draft.mold.moldCode} · {draft.mold.moldName}
        </span>

        {draft.mold.guaranteedShotCount === null ? (
          /* 적정 타수가 없으면 진행률을 그릴 수 없다 — 0으로 채우면 「거의 새것」으로 보인다. */
          <p className="field-note">{t.scanned.shotCountUnknown(draft.mold.currentShotCount)}</p>
        ) : (
          <>
            {/*
             * 수치를 **눈에 보이는 글자로도** 낸다. `label`은 접근 이름이라 화면에 그려지지
             * 않는데, 막대만 보고 「몇 발 남았나」를 읽을 수는 없다.
             */}
            <p className="field-note">
              {t.scanned.shotCount(draft.mold.currentShotCount, draft.mold.guaranteedShotCount)}
            </p>
            <Progress
              value={draft.mold.currentShotCount}
              max={draft.mold.guaranteedShotCount}
              label={t.scanned.moldLabel}
              valueText={t.scanned.shotCount(
                draft.mold.currentShotCount,
                draft.mold.guaranteedShotCount,
              )}
            />
            {isShotCountExceeded(draft.mold) && (
              /* ⚠ 경고이지 차단이 아니다(미결 #6). 문구가 그 사실을 함께 말한다. */
              <p className="field-note">{t.scanned.shotCountExceeded}</p>
            )}
          </>
        )}
      </div>
    )}
  </>
);
