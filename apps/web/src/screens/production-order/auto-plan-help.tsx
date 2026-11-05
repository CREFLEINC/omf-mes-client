import { Button, Dialog } from '@crefle/web-ui';

export const AutoPlanHelp = ({ onClose }: { onClose: () => void }) => (
  <Dialog
    open
    size="lg"
    title="생산계획 자동 전개 도움말"
    onClose={onClose}
    footer={
      <Button variant="outlined" onClick={onClose}>
        닫기
      </Button>
    }
  >
    <div className="erp-wo-distribution-help">
      <p>
        선택한 ERP W/O를 기준으로 생산계획을 만들고, 생산 라인을 판단할 수 있으면 계획 확정까지
        시도합니다.
      </p>
      <section aria-labelledby="auto-plan-help-create">
        <h3 id="auto-plan-help-create">계획이 없을 때, 이렇게 생성합니다</h3>
        <dl className="form-grid erp-wo-auto-plan-help-facts">
          <div className="field-cell">
            <dt className="field-label">계획 수량과 단위</dt>
            <dd>ERP W/O의 전체 수량과 단위를 그대로 사용합니다.</dd>
          </div>
          <div className="field-cell">
            <dt className="field-label">계획일</dt>
            <dd>
              ERP 계획 시작일이 오늘 또는 미래이면 해당 날짜를 사용합니다. 없거나 과거이면 공장 현지
              오늘을 사용합니다.
            </dd>
          </div>
          <div className="field-cell">
            <dt className="field-label">BOM</dt>
            <dd>해당 품목의 기본 BOM 개정이 정확히 1개여야 합니다.</dd>
          </div>
          <div className="field-cell">
            <dt className="field-label">Routing</dt>
            <dd>
              사용 가능한 개정이 1개이면 선택합니다. 여러 개이면 그중 기본 개정이 정확히 1개여야
              합니다.
            </dd>
          </div>
        </dl>
        <p className="erp-wo-distribution-help-note">
          예: ERP W/O가 1,000 EA이고 계획 시작일이 미래이면, 그 날짜에 1,000 EA 계획 1건을 만듭니다.
          여러 날짜나 생산 라인으로 나누려면 생산계획 편성의 자동 분배를 사용하세요.
        </p>
      </section>
      <section aria-labelledby="auto-plan-help-data">
        <h3 id="auto-plan-help-data">준비할 ERP 데이터와 MES 기준정보</h3>
        <div className="erp-wo-auto-plan-help-table">
          <table>
            <thead>
              <tr>
                <th>정보 출처</th>
                <th>확인할 내용</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">ERP W/O</th>
                <td>
                  ERP W/O 번호, 공장, 품목, 수량, 단위와 계획 시작일을 확인합니다. 공장, 품목과
                  단위가 MES 기준정보에 연결되어 있어야 합니다. 계획 시작일은 없으면 오늘로
                  보완합니다.
                </td>
              </tr>
              <tr>
                <th scope="row">MES에 반영된 ERP BOM</th>
                <td>
                  해당 품목의 기본 BOM 개정과 구성 자재, 소요량, 기준 수량 및 단위를 확인합니다.
                  기본 개정을 하나로 결정하지 못하면 신규 계획을 만들지 않습니다.
                </td>
              </tr>
              <tr>
                <th scope="row">MES Routing</th>
                <td>
                  해당 품목에서 사용할 개정과 공정 순서가 준비되어 있어야 합니다. 후보가 여러 개이면
                  기본 개정 지정이 필요합니다.
                </td>
              </tr>
              <tr>
                <th scope="row">MES 기본 자원 매핑과 생산 라인</th>
                <td>
                  생산 라인을 판단해 자동 확정을 시도할 때 사용합니다. 공장과 품목에 지정된 기본
                  자원 매핑, 공정별 설비와 금형, 기본 설비의 소속 생산 라인을 확인합니다. 매핑은
                  기본 및 활성 상태이고 자원이 사용 가능해야 자동 배정에 사용됩니다.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="auto-plan-help-confirm">
        <h3 id="auto-plan-help-confirm">생산 라인에 따라 결과가 달라집니다</h3>
        <ul>
          <li>
            <strong>생산 라인을 판단할 수 있음:</strong> 계획에 지정된 생산 라인이 있거나, 기본 자원
            매핑으로 배정될 설비에서 소속 생산 라인을 찾을 수 있으면 확정을 시도합니다. 확정 검증도
            통과해야 계획 확정이 완료됩니다.
          </li>
          <li>
            <strong>생산 라인을 판단할 수 없음:</strong> BOM과 Routing이 결정되면 신규 계획은
            미확정으로 생성합니다. 생산계획 편성에서 생산 라인을 보완하고 확정하세요.
          </li>
          <li>
            <strong>BOM이나 Routing을 결정할 수 없음:</strong> 신규 계획을 만들지 않습니다. 결과의
            확인 필요 사유를 보고 해당 기준정보를 보완하세요.
          </li>
        </ul>
      </section>
      <section aria-labelledby="auto-plan-help-existing">
        <h3 id="auto-plan-help-existing">기존 계획이 있으면</h3>
        <ul>
          <li>
            <strong>확정 계획량이 ERP W/O 수량을 충족:</strong> 새 계획을 중복 생성하지 않습니다.
            기존 계획을 기준으로 결과를 표시합니다.
          </li>
          <li>
            <strong>미확정 계획이 있음:</strong> 먼저 생성된 미확정 계획 1건의 생산 라인을 확인해
            확정을 시도합니다. 라인을 판단할 수 없으면 미확정 상태로 유지합니다.
          </li>
          <li>
            <strong>미확정 계획은 없고 확정량이 부족:</strong> 부족한 수량을 자동으로 추가하지
            않습니다. 생산계획 편성에서 계획 추가로 보완하세요.
          </li>
        </ul>
      </section>
      <section aria-labelledby="auto-plan-help-next">
        <h3 id="auto-plan-help-next">실행 후 확인할 것</h3>
        <p>
          결과 화면에서 ERP W/O별 처리 결과와 사유를 확인하세요. 계획 확정은 배포 완료가 아닙니다.
          4M 배정과 점검을 완료한 후 배포 확인으로 진행합니다. 작업자, 교대, 위치와 시간 등은 4M에서
          확인하며, 최종 배포는 담당자가 실행합니다.
        </p>
        <p className="field-note">
          생산능력, 재고와 납기를 비교해 최적의 일정이나 여러 생산 라인을 자동으로 편성하는 기능은
          아닙니다.
        </p>
      </section>
      <details className="erp-wo-distribution-help-note">
        <summary>ERP 수신 시 자동 실행과는 무엇이 다른가요?</summary>
        <p>
          ERP 수신 시에는 수신 상태와 날짜 조건도 확인합니다. 받은 상태가 아니거나 기준 날짜가 공장
          현지 오늘보다 과거이면 자동 전개를 건너뜁니다. 기준 날짜는 납기가 있으면 납기, 없으면 ERP
          계획 시작일입니다. 이 도움말의 생성 기준은 작업계획 목록에서 직접 실행하는 생산계획 자동
          전개를 설명합니다.
        </p>
      </details>
    </div>
  </Dialog>
);
