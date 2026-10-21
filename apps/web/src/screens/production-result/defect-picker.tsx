import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import type { DefectMajor } from './defect-draft';

const t = messages.productionResult.flow.defects;

export interface DefectPickerProps {
  open: boolean;
  majors: DefectMajor[];
  isLoading: boolean;
  isError: boolean;
  onPick: (defectCodeId: number) => void;
  onClose: () => void;
}

/** 불량 유형 고르기 — 대분류 타일을 누르면 그 상세 타일로 넘어가고, 상세를 누르면 정해진다. */
export const DefectPicker = ({
  open,
  majors,
  isLoading,
  isError,
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
      title={major === null ? t.pickerTitle : `${t.pickerTitle} · ${major.name}`}
      showCloseButton={false}
      /* 터치 단말의 오조작 — 바깥을 눌러 닫히지 않는다. */
      closeOnBackdropClick={false}
      className="production-flow-defect-picker"
      footer={
        <>
          {major !== null && (
            <Button variant="outlined" size="xl" onClick={() => setMajorId(null)}>
              {t.back}
            </Button>
          )}
          <Button variant="outlined" size="xl" onClick={close}>
            {t.cancel}
          </Button>
        </>
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
                  onClick={() => setMajorId(candidate.majorId)}
                >
                  {candidate.name}
                </Button>
              ))
            : major.minors.map((code) => (
                <Button
                  key={code.defectCodeId}
                  variant="outlined"
                  size="xl"
                  title={code.defectCode}
                  onClick={() => {
                    setMajorId(null);
                    onPick(code.defectCodeId);
                  }}
                >
                  {code.defectName}
                </Button>
              ))}
        </div>
      )}
    </Dialog>
  );
};
