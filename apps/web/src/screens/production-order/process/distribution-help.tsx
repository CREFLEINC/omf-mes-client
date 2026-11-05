import { Button, Dialog } from '@crefle/web-ui';

export const DistributionHelp = ({ onClose }: { onClose: () => void }) => (
  <Dialog
    open
    size="lg"
    title="자동 분배 도움말"
    onClose={onClose}
    footer={
      <Button variant="outlined" onClick={onClose}>
        닫기
      </Button>
    }
  >
    <div className="erp-wo-distribution-help">
      <p className="erp-wo-distribution-help-intro">
        ERP W/O별로 지정한 기간과 생산 라인에 수량을 나누어 생산계획을 추가합니다.
      </p>
      <section aria-labelledby="distribution-help-flow">
        <h3 id="distribution-help-flow">사용 순서</h3>
        <ol className="erp-wo-distribution-help-flow">
          <li>
            <strong>조건 입력</strong>
            <span>ERP W/O, 기간, 생산 라인과 수량을 지정합니다.</span>
          </li>
          <li>
            <strong>분배 미리보기</strong>
            <span>날짜별 수량과 기존 계획의 겹침을 확인합니다.</span>
          </li>
          <li>
            <strong>분배안 적용</strong>
            <span>확인한 분배안을 미저장 계획으로 추가합니다.</span>
          </li>
          <li>
            <strong>계획 저장 및 확정</strong>
            <span>계획을 저장하고 확인 후 확정합니다.</span>
          </li>
        </ol>
      </section>
      <section aria-labelledby="distribution-help-modes">
        <h3 id="distribution-help-modes">두 가지 분배 방식</h3>
        <div className="erp-wo-distribution-help-modes">
          <div>
            <h4>균등 배분</h4>
            <p>
              구간 수량을 기간의 날짜 수로 나눕니다. 단위의 소수 자릿수에 맞추고, 나머지는 앞
              날짜부터 배정합니다.
            </p>
            <p className="field-note">예: 정수 단위 100 EA를 3일에 분배</p>
            <table>
              <caption className="visually-hidden">균등 배분 예시</caption>
              <thead>
                <tr>
                  <th>1일차</th>
                  <th>2일차</th>
                  <th>3일차</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>34 EA</td>
                  <td>33 EA</td>
                  <td>33 EA</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h4>날짜별 수량</h4>
            <p>
              날짜마다 필요한 수량을 직접 입력합니다. 수량을 일정하게 나누지 않아도 됩니다. 빈칸이나
              0인 날짜에는 계획을 만들지 않습니다.
            </p>
            <p className="field-note">예: 날짜별로 60, 0, 40 EA 입력</p>
            <table>
              <caption className="visually-hidden">날짜별 수량 예시</caption>
              <thead>
                <tr>
                  <th>1일차</th>
                  <th>2일차</th>
                  <th>3일차</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>60 EA</td>
                  <td>계획 없음</td>
                  <td>40 EA</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section aria-labelledby="distribution-help-rules">
        <h3 id="distribution-help-rules">분배할 때 확인할 규칙</h3>
        <ul>
          <li>
            <strong>기간은 시작일과 종료일을 모두 포함합니다.</strong> 주말과 공휴일도 포함합니다.
            제외할 날짜는 날짜별 수량을 0으로 입력하세요.
          </li>
          <li>
            <strong>ERP W/O마다 조건을 다르게 지정할 수 있습니다.</strong> 한 ERP W/O에도 기간이나
            생산 라인이 다른 구간을 여러 개 추가할 수 있습니다. 구간 합계는 해당 ERP W/O의 편성 대기
            수량을 넘을 수 없습니다.
          </li>
          <li>
            <strong>기존 계획은 그대로 유지합니다.</strong> 새 분배 구간끼리 ERP W/O, 날짜, 생산
            라인이 같으면 수량을 합칩니다. 기존 계획과 겹치면 기존 계획을 바꾸지 않고 추가 계획을
            만듭니다. 미리보기에서 겹침을 확인한 후 적용하세요.
          </li>
          <li>
            <strong>생산 라인과 수량은 사용자가 판단합니다.</strong> 생산능력, 설비 가용 여부, 자재
            재고와 납기를 계산해 최적의 계획을 찾는 기능은 아닙니다.
          </li>
        </ul>
      </section>
      <p className="erp-wo-distribution-help-note">
        처음 열면 편성 대기 수량과 오늘부터 7일이 기본 조건으로 표시됩니다. 생산 라인은 직접
        선택하세요. 미리보기와 분배안 적용만으로 계획이 저장되거나 확정되지는 않습니다.
      </p>
    </div>
  </Dialog>
);
