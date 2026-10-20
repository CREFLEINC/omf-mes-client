import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { usePopRegistration } from '../pop-registration';

const t = messages.popChrome.console.terminal;

/**
 * 이 단말이 무엇으로 등록돼 있는가 — 단말 코드 · 유형 · 설비 · 공정. 단말 정보 창과 홈의 「이 단말」이
 * 같은 것을 쓴다.
 *
 * ⛔ 모르는 값을 지어내지 않는다 — 받지 못했으면 「없음」이다.
 */
export const usePopTerminalFacts = (): [label: string, value: string][] => {
  const { terminal, processes } = usePopRegistration();

  const equipment =
    terminal === null
      ? ''
      : [terminal.equipmentName, terminal.equipmentCode]
          .filter((part) => part !== null)
          .join(' · ');
  const processText = (processes ?? [])
    .map((row) => row.processName ?? String(row.processId))
    .join(', ');

  return [
    [t.code, terminal?.terminalCode ?? t.none],
    [t.type, terminal?.terminalTypeCode ?? t.none],
    [t.equipment, equipment === '' ? t.none : equipment],
    [t.processes, processText === '' ? t.none : processText],
  ];
};

export interface PopTerminalDialogProps {
  onClose: () => void;
}

/**
 * **단말 정보** — 부서 레일 바닥의 [단말]이 연다. 이 단말이 무엇으로 등록돼 있는지와 재등록.
 *
 * ⭐ **단말 재등록으로 들어가는 유일한 길**(P-CO-01 §5-1 · 공유계약 F-4). 설치 담당자용이라 작업자
 *    단추들과 떨어진 레일 바닥 → 창 바닥에 둔다. 잘못된 단말로 등록되면 사번부터 막히므로, 사번
 *    없이도 눌려야 한다.
 *
 * ⛔ 큐가 남은 채 다른 단말로 바꾸는 것은 적용 단계가 막는다 — 여기서 막지 않는다.
 */
export const PopTerminalDialog = ({ onClose }: PopTerminalDialogProps) => {
  const { restart } = usePopRegistration();
  const facts = usePopTerminalFacts();

  return (
    <Dialog
      open
      size="md"
      onClose={onClose}
      /* ⛔ 스치는 손에 닫히지 않는다 — POP 창 공통 규칙(#1005). */
      closeOnBackdropClick={false}
      title={t.title}
      footer={
        <>
          <Button
            className="pop-console-dialog-action"
            variant="text"
            onClick={() => {
              onClose();
              restart();
            }}
          >
            {messages.workerAssignment.registration.reRegister}
          </Button>
          <Button className="pop-console-dialog-action" variant="outlined" onClick={onClose}>
            {t.close}
          </Button>
        </>
      }
    >
      <dl className="pop-console-terminal">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="pop-console-terminal__note">{t.reRegisterNote}</p>
    </Dialog>
  );
};
