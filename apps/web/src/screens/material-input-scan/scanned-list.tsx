import { Button, Chip, Progress } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { isShotCountExceeded, type ScanDraft } from './scan';

const t = messages.materialInputScan;

export interface ScannedListProps {
  draft: ScanDraft;
  onRemoveMaterial: (lotId: number) => void;
}

/**
 * 담은 자재와 물린 금형 — **아직 보내지 않은 것**이다.
 *
 * LOT 상태는 **원문 코드를 그대로 낸다.** 계약이 네 값을 적어 두긴 했으나(`정상`·`불량`·
 * `검사 대기`·`폐기`) 투입 가부를 정하는 것은 서버이고(스펙 §5-2), 화면이 색이나 문구로
 * 갈래를 만들면 **화면이 판정한 것처럼 읽힌다.**
 */
export const ScannedList = ({ draft, onRemoveMaterial }: ScannedListProps) => (
  <>
    <h2 className="pane-title">{t.scanned.materialsLabel}</h2>

    {draft.materials.length === 0 ? (
      <p className="field-note">{t.scanned.empty}</p>
    ) : (
      <ul className="scanned-items">
        {draft.materials.map((material) => (
          <li key={material.lotId} className="scanned-item">
            <span className="scanned-code">{material.lotNo}</span>
            <Chip variant="status" size="sm">
              {material.statusCode}
            </Chip>
            {material.isHeld && (
              <Chip variant="status" size="sm" status="warning">
                {t.scanned.heldMark}
              </Chip>
            )}
            <Button
              variant="outlined"
              size="sm"
              aria-label={t.scanned.removeMaterial(material.lotNo)}
              onClick={() => {
                onRemoveMaterial(material.lotId);
              }}
            >
              {t.scanned.remove}
            </Button>
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
