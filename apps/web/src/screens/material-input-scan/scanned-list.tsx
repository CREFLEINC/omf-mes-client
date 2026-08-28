import { Button, Chip, Progress, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
  /** 서버가 통과시키되 기록만 한 것(§5-3). 보내기 전에는 비어 있다. */
  notes: readonly RecordedNote[];
  onQtyChange: (lotId: number, value: string) => void;
  onRemoveMaterial: (lotId: number) => void;
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
  onQtyChange,
  onRemoveMaterial,
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
        {draft.materials.map((material) => (
          <li key={material.lotId} className="scanned-item">
            <div className="scanned-item-head">
              <span className="scanned-code">{material.lotNo}</span>
              {/*
               * 「빼기」는 담은 것을 되돌리는 평범한 조작이다. 브랜드 기본색이 붉은 계열이라
               * 테두리 변형을 쓰면 **위험 액션처럼 보인다** — 중립 변형으로 둔다.
               */}
              <Button
                variant="text"
                size="sm"
                aria-label={t.scanned.removeMaterial(material.lotNo)}
                onClick={() => {
                  onRemoveMaterial(material.lotId);
                }}
              >
                {t.scanned.remove}
              </Button>
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
             */}
            <TextField
              label={t.scanned.qtyLabel(material.lotNo)}
              value={readQty(qtyDrafts, material.lotId)}
              inputMode="decimal"
              autoComplete="off"
              error={qtyError(readQty(qtyDrafts, material.lotId))}
              onChange={(event) => {
                onQtyChange(material.lotId, event.target.value);
              }}
            />
          </li>
        ))}
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
