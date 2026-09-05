import type { TrainingAttemptRecord } from '@devreplay/domain'
import { zhCN } from './i18n/zh-CN'

export function AssessmentEvidence({
  attempt
}: {
  readonly attempt: TrainingAttemptRecord
}): React.JSX.Element {
  return (
    <section aria-label={zhCN.assessment.evidence}>
      <h3>
        {zhCN.assessment.initial}：{attempt.initial.passed ? zhCN.common.pass : zhCN.common.fail}
      </h3>
      <p>{attempt.initial.reason}</p>
      <ul>
        {attempt.initial.evidence.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {attempt.review ? (
        <section aria-label={zhCN.assessment.review}>
          <h3>
            {zhCN.assessment.review}：
            {attempt.review.result.passed ? zhCN.common.pass : zhCN.common.fail}
          </h3>
          <p>
            {zhCN.assessment.reason}：{attempt.review.requestedReason}
          </p>
          <p>{attempt.review.result.reason}</p>
          <ul>
            {attempt.review.result.evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  )
}
