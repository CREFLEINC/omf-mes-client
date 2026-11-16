import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { masterName } from '../../patterns/master-name';
import type { DefectMajor } from './defect-draft';

const t = messages.productionResult.flow.defects;

export interface DefectPickerProps {
  open: boolean;
  majors: DefectMajor[];
  isLoading: boolean;
  isError: boolean;
  /** 줄의 유형을 바꾸려고 열었을 때 지금 고른 유형. 새 줄이면 `null`. 그 칸에 ✓ 표시를 한다. */
  selectedId?: number | null;
  onPick: (defectCodeId: number) => void;
  onClose: () => void;
}

/** 불량 유형 고르기 — 대분류 타일을 누르면 그 상세 타일로 넘어가고, 상세를 누르면 정해진다. */
export const DefectPicker = ({
  open,
  majors,
  isLoading,
  isError,
  selectedId = null,
  onPick,
  onClose,
}: DefectPickerProps) => {
  const [majorId, setMajorId] = useState<number | null>(null);
  const major = majors.find((candidate) => candidate.majorId === majorId) ?? null;

  const close = () => {
    setMajorId(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={major === null ? t.pickerTitle : t.pickerTitleFor(major.name)}
      showCloseButton={false}
      /* 터치 단말의 오조작 — 바깥을 눌러 닫히지 않는다. */
      closeOnBackdropClick={false}
      className="production-flow-defect-picker"
      /* [대분류로 돌아가기]는 왼쪽 끝, [취소]는 오른쪽 끝(사용자 지시 2026-11-16). */
      footer={
        <div className="production-flow-defect-picker-footer">
          {major !== null && (
            <Button
              variant="outlined"
              size="xl"
              className="production-flow-defect-picker-back"
              onClick={() => setMajorId(null)}
            >
              {t.back}
            </Button>
          )}
          <Button variant="outlined" size="xl" onClick={close}>
            {t.cancel}
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <p role="status">{t.loading}</p>
      ) : isError ? (
        <AlertBanner variant="error">{t.loadFailed}</AlertBanner>
      ) : majors.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <div className="production-flow-defect-tiles">
          {major === null
            ? majors.map((candidate) => (
                <Button
                  key={candidate.majorId}
                  variant="outlined"
                  size="xl"
                  className="production-flow-defect-tile"
                  aria-pressed={candidate.minors.some((code) => code.defectCodeId === selectedId)}
                  onClick={() => setMajorId(candidate.majorId)}
                >
                  {candidate.name}
                </Button>
              ))
            : major.minors.map((code) => (
                /* 코드값 말풍선(title)은 두지 않는다 — 작업자에게 읽을 거리가 아니다(사용자 지시 2026-11-16). */
                <Button
                  key={code.defectCodeId}
                  variant="outlined"
                  size="xl"
                  className="production-flow-defect-tile"
                  aria-pressed={code.defectCodeId === selectedId}
                  onClick={() => {
                    setMajorId(null);
                    onPick(code.defectCodeId);
                  }}
                >
                  {code.defectCodeId === selectedId && (
                    <span className="production-flow-defect-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                  {masterName(code, code.defectName)}
                </Button>
              ))}
        </div>
      )}
    </Dialog>
  );
};
