import { Icon } from '@/components/icon/Icon'
import { PASSWORD_RULES } from './password-rules'
import { authIcons } from './auth.icons'
import styles from './auth.module.css'

/**
 * The password rules as a checklist, and the count of them met.
 *
 * **"N of 5 rules met", never Weak, Fair or Strong.** Traffic-light colours are
 * for findings, and "strong" is a claim about security nothing here can make.
 * Every rule is visible from the start, because a rule somebody only learns
 * about by breaking it wasted their time. Met and unmet differ by the mark as
 * well as the colour.
 */
export function PasswordRules({
  password,
  confirm,
  forbidden,
}: {
  password: string
  confirm: string
  forbidden: string[]
}) {
  const met = PASSWORD_RULES.filter((rule) => rule.met(password, forbidden)).length
  const matches = password.length > 0 && password === confirm
  return (
    <div className={styles.rules} data-password-rules>
      <p className={styles.rulesCount} data-numeric>
        {met} of {PASSWORD_RULES.length} rules met
      </p>
      <ul className={styles.ruleList}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.met(password, forbidden)
          return (
            <li
              key={rule.id}
              className={ok ? styles.ruleMet : styles.rule}
              data-rule={rule.id}
              data-met={ok}
            >
              <Icon name={ok ? authIcons.met : authIcons.unmet} size={16} />
              {rule.says}
            </li>
          )
        })}
        <li
          className={matches ? styles.ruleMet : styles.rule}
          data-rule="match"
          data-met={matches}
        >
          <Icon name={matches ? authIcons.met : authIcons.unmet} size={16} />
          Both entries match
        </li>
      </ul>
    </div>
  )
}
