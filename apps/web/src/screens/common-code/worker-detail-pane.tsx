import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { lookupLabel } from './code-options';
import type { LookupEntry, Worker } from './types';

const t = messages.commonCode;

export interface WorkerDetailPaneProps {
  worker: Worker;
  businessUnitEntries: LookupEntry[];
  plantEntries: LookupEntry[];
  departmentEntries: LookupEntry[];
}

/** 라벨과 값 한 쌍. **폼 컨트롤이 아니다** — 잠긴 입력칸은 「언젠가 열린다」는 뜻이 된다. */
const ValueField = ({ label, value }: { label: string; value: string }) => {
  const labelId = useId();

  return (
    <div className="field-cell">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <p aria-labelledby={labelId}>{value}</p>
    </div>
  );
};

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string): string => (value === '' ? t.values.empty : value);

/**
 * 우 칸 위쪽 — 작업자 기본 정보. **값 표기만 있다.**
 *
 * 계약에 쓰기 경로가 **아예 없다**(`POST /mdm/workers`도 `PUT /mdm/workers/{id}`도 없다).
 * 그래서 폼 컨트롤을 잠그는 것이 아니라 두지 않는다 — 배치 규범 3이 정한 처리다.
 * 비활성 저장 버튼 + 사유로 두면 「언젠가 풀린다」는 뜻이 되는데 계약에 그 경로가 없다.
 *
 * 안내는 **`editability`가 아니라 고정 문구**다. 계약은 「항상 `RECEIVED_FROM_ERP`」라고 적었으나
 * 목 서버는 `reason:'EDITABLE'`을 준다 — 쓰기 경로가 없다는 사실이 그보다 강한 근거다.
 *
 * **번호를 화면에 내지 않는다.** 사업부·공장·부서는 이름으로, 계정 연결은 연결 여부로 낸다.
 * 상태 코드는 값 목록이 미정이라 **원본 문자열을 그대로** 낸다 — 이름을 지어내지 않는다.
 */
export const WorkerDetailPane = ({
  worker,
  businessUnitEntries,
  plantEntries,
  departmentEntries,
}: WorkerDetailPaneProps) => (
  <section className="pane" aria-label={t.panes.workerDetail}>
    <div className="banner-slot">
      <AlertBanner variant="info">{t.worker.readOnlyNotice}</AlertBanner>
    </div>

    <div className="form-grid">
      <ValueField label={t.worker.fields.workerNo} value={orEmptyMark(worker.workerNo)} />
      <ValueField label={t.worker.fields.workerName} value={orEmptyMark(worker.workerName)} />
      <ValueField
        label={t.worker.fields.businessUnit}
        value={lookupLabel(businessUnitEntries, worker.businessUnitId)}
      />
      <ValueField label={t.worker.fields.plant} value={lookupLabel(plantEntries, worker.plantId)} />
      <ValueField
        label={t.worker.fields.department}
        value={lookupLabel(departmentEntries, worker.departmentId)}
      />
      <ValueField label={t.worker.fields.status} value={orEmptyMark(worker.statusCode)} />
      <ValueField
        label={t.worker.fields.appUser}
        value={
          worker.appUserId === null || worker.appUserId === undefined
            ? t.worker.values.appUserNotLinked
            : t.worker.values.appUserLinked
        }
      />
      <ValueField
        label={t.worker.fields.isActive}
        value={worker.isActive ? t.worker.values.active : t.worker.values.inactive}
      />
    </div>
  </section>
);
