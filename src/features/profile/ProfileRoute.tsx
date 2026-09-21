import { useState } from 'react'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import {
  checkMedicationPin,
  hasChosenPin,
  setMedicationPin,
} from '@/app/session/medication-pins'
import { addressFor } from '@/features/auth/addresses'
import { forbiddenWords } from '@/features/auth/password-rules'
import { PasswordRules } from '@/features/auth/PasswordRules'
import { PIN_RULES } from '@/features/auth/pin-rules'
import { askToSignOut } from '@/features/auth/SignOutDialog'
import { authIcons } from '@/features/auth/auth.icons'
import { Icon } from '@/components/icon/Icon'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  ActLine,
  Avatar,
  Button,
  Card,
  CardHead,
  Dialog,
  DigitField,
  PasswordField,
  Switch,
} from '@/components/primitives'
import { pluralise } from '@/lib/format'
import {
  PIN_LOCK_IS_SHARED,
  outstandingPassword,
  passwordReady,
  pinReadyToSubmit,
} from './credentials'
import {
  NOTIFICATIONS,
  PREFERENCE_QUESTION,
  canBeTurnedOff,
  type NotificationKind,
} from './notification-table'
import { isTurnedOff, turnOff, turnOn } from './preference-store'
import styles from './profile.module.css'

/**
 * Profile and settings (PROF-01), reached from the account menu or the rail.
 *
 * **The last screen in this build, and the one where most controls are
 * refused.** Four of its six sections describe something this product cannot
 * do — authenticate, store a file, send a notification, or hold a session on
 * another device — so the discipline this build applies to a clinical gap
 * applies here to a control: each one says what it does not do at the point it
 * is offered, in one line, never behind a click.
 *
 * **One of them is real, and that matters more than the others.** The
 * medication PIN is held in this tab and confirms a dose afterwards, so
 * changing it here changes that. Drawing it as inert alongside the rest would
 * be the cheaper, less true thing.
 */

/** Said where a photograph would be chosen. Phase 8's precedent, DOC upload. */
export const NO_PHOTO_LINE =
  'No file is stored: this build has no server to put one on. Your initials stand in, and they are drawn from your name rather than from an anonymous silhouette.'

/** The three device features scope put out of this build, said in one place. */
export const DEVICE_LINE =
  'Biometric sign-in, a shared-device mode and GPS check-in are stated as unavailable rather than drawn: this build has no device APIs and no session token to clear.'

/**
 * Shared-device mode's own content, which is already true here.
 *
 * Worth saying rather than leaving as a disabled switch: PROF-01 defines the
 * mode as what happens at sign-out, and every sign-out in this build already
 * does all of it, because there is nothing anywhere else to clear.
 */
export const SHARED_DEVICE_LINE =
  'What the mode describes already happens: every sign-out here clears everything, because every record this session wrote is in this tab and nowhere else.'

export function ProfileRoute() {
  const { member, at } = useSignedIn()
  const { sites, activeSite } = useSession()
  const viewer = useViewer()
  const format = useSiteFormat()

  const theirs = sites.filter((site) => member.siteIds.includes(site.id))
  const address = addressFor(member, theirs[0] ?? activeSite)
  const firstName = member.ref.fullName.split(/\s+/)[0] ?? member.ref.fullName

  return (
    <div className={styles.page} data-profile>
      <PageHead
        title="Profile and settings"
        lines={[
          member.ref.fullName,
          STAFF_ROLE_NAMES[member.role],
          pluralise(theirs.length, 'home'),
        ]}
        action={
          <Button
            variant="destructive"
            size="large"
            onClick={askToSignOut}
            data-sign-out-link
          >
            Sign out
          </Button>
        }
      />

      <Card>
        <CardHead
          title="You"
          subtitle="What the team record holds about you, and who changes each part of it"
          expand={{ kind: 'whole' }}
        />
        <div className={styles.you}>
          <div className={styles.photo}>
            <Avatar
              photo={{ kind: 'not_on_file' }}
              name={member.ref.fullName}
              size="xlarge"
            />
          </div>

          <dl className={styles.fields}>
            <div className={styles.field} data-field="name">
              <dt className={styles.fieldName}>Name</dt>
              <dd className={styles.fieldValue}>
                {member.ref.fullName}
                <span className={styles.quiet}>
                  Shown as {member.ref.displayName} on every record you write
                </span>
              </dd>
            </div>

            <div className={styles.field} data-field="role">
              <dt className={styles.fieldName}>Role</dt>
              <dd className={styles.fieldValue}>
                {STAFF_ROLE_NAMES[member.role]}
                <ActPoint
                  answer={viewer.ask('change_your_role')}
                  label="Change role"
                  notBuilt="Changing your own role is not built."
                />
              </dd>
            </div>

            <div className={styles.field} data-field="email">
              <dt className={styles.fieldName}>Email</dt>
              <dd className={styles.fieldValue}>
                {address}
                <span className={styles.quiet}>
                  Derived from your name and your home for this specification. No email
                  address is held on the team record.
                </span>
                <ActPoint
                  answer={viewer.ask('change_your_email')}
                  label="Change email"
                  notBuilt="Changing your own email address is not built."
                />
              </dd>
            </div>

            <div className={styles.field} data-field="homes">
              <dt className={styles.fieldName}>
                {theirs.length === 1 ? 'Home' : 'Homes'}
              </dt>
              <dd className={styles.fieldValue}>
                <ul className={styles.homes}>
                  {theirs.map((site) => (
                    <li key={site.id} data-home={site.id}>
                      {site.name}
                      {site.id === activeSite.id ? (
                        <span className={styles.here}> · signed in here</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <PasswordCard forbidden={forbiddenWords(member, theirs)} firstName={firstName} />

      <PinCard staffId={member.id} />

      <Card>
        <CardHead
          title="Notification preferences"
          subtitle="Every notification this product sends, from the PRD’s Appendix D"
          expand={{ kind: 'whole' }}
        />
        <NotificationTable />
        <ActLine kind="not_stated">{PREFERENCE_QUESTION}</ActLine>
      </Card>

      <Card>
        <CardHead
          title="Device settings"
          subtitle="Drawn on both layouts, where PROF-01 asks for them on the phone"
          expand={{ kind: 'whole' }}
        />
        {/*
         * **Named, not drawn.** Scope puts all three of these out of this
         * product, and a switch nobody can move is a control that refuses —
         * so each is a sentence saying what it would do and that it is not
         * here. CLAUDE.md, Scope.
         */}
        <div className={styles.switches}>
          <div className={styles.deviceRow} data-device="biometric">
            <p className={styles.deviceName}>Sign in with a fingerprint or face</p>
            <p className={styles.said}>{DEVICE_LINE}</p>
          </div>
          <div className={styles.deviceRow} data-device="shared">
            <p className={styles.deviceName}>This is a shared device</p>
            <p className={styles.said}>{SHARED_DEVICE_LINE}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Where you are signed in"
          subtitle="This browser tab, which is the only session this build can know about"
          expand={{ kind: 'whole' }}
        />
        <ul className={styles.sessions}>
          <li className={styles.session} data-session="this">
            <div>
              <p className={styles.sessionWhat}>This browser tab</p>
              <p className={styles.quiet}>
                Signed in {format.dateTime(at)} · {activeSite.name}
              </p>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={askToSignOut}
              data-end-session
            >
              End this session
            </Button>
          </li>
        </ul>
        {/* **No hatch here.** A session on another device is not a care record
            somebody failed to write, and spending the one signal that means
            "nobody has recorded this" on a device list would blunt it. The
            words carry the whole claim instead. */}
        <div className={styles.noOthers}></div>
      </Card>
    </div>
  )
}

/**
 * Changing a password, which changes nothing.
 *
 * The confirmation is held above the fields it clears, because a message owned
 * by the thing the act resets is a message destroyed by its own act — the
 * shape that has now appeared four times in this build.
 */
function PasswordCard({
  forbidden,
  firstName,
}: {
  forbidden: string[]
  firstName: string
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)

  const [open, setOpen] = useState(false)

  const waiting = outstandingPassword(current, next, confirm, forbidden)
  const ready = passwordReady(current, next, confirm, forbidden)

  const clear = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  /*
   * **The three fields are in a dialog, and the card says what they are for.**
   * Settings is a screen somebody reads down; two password forms and a PIN
   * form open on it put three sets of empty boxes between the reader and
   * everything else, and none of them is what they came for.
   */
  return (
    <Card>
      <div className={styles.cardHeadRow}>
        <div className={styles.cardHeading}>
          <CardHead
            title="Change your password"
            subtitle="The same rules the account was set up under"
            expand={{ kind: 'whole' }}
          />
        </div>
        <Button
          size="large"
          onClick={() => {
            clear()
            setOpen(true)
          }}
          data-open-password
        >
          Change password
        </Button>
      </div>
      {done ? (
        <p className={styles.said} data-password-done>
          The rules are met, {firstName}. Nothing was saved.
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen} title="Change your password">
        <div className={styles.form}>
          <PasswordField
            label="Current password"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
          <PasswordField
            label="New password"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          <PasswordRules password={next} confirm={confirm} forbidden={forbidden} />
          {waiting.length > 0 ? (
            <p className={styles.waiting} data-password-waiting>
              Still waiting for {waiting.join(', ')}.
            </p>
          ) : null}
          <div className={styles.formAct}>
            <Button
              size="large"
              disabled={!ready}
              onClick={() => {
                setDone(true)
                clear()
                setOpen(false)
              }}
              data-change-password
            >
              Save new password
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  )
}

/**
 * Changing the medication PIN, which is real for this session.
 *
 * **The current PIN is asked for only where one is held**, because where none
 * is, any four digits would be accepted and a field that cannot be wrong is a
 * field that says nothing. That state is stated before anybody types.
 */
function PinCard({ staffId }: { staffId: Parameters<typeof hasChosenPin>[0] }) {
  const [held] = useState(() => hasChosenPin(staffId))
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [said, setSaid] = useState<string | undefined>(undefined)

  const ready = pinReadyToSubmit(held, current, next, confirm)

  const change = () => {
    if (held) {
      const checked = checkMedicationPin(staffId, current)
      if (checked.kind === 'wrong') {
        setSaid(
          `That is not your current PIN. ${pluralise(checked.left, 'try', 'tries')} left before it locks.`,
        )
        setCurrent('')
        return
      }
      if (checked.kind === 'locked') {
        setSaid('The PIN is locked for 15 minutes after five wrong entries.')
        setCurrent('')
        return
      }
    }
    setMedicationPin(staffId, next)
    setSaid('Your medication PIN is changed for this session.')
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  const [open, setOpen] = useState(false)

  return (
    <Card>
      <div className={styles.cardHeadRow}>
        <div className={styles.cardHeading}>
          <CardHead
            title="Change your medication PIN"
            subtitle="Four digits, and the same PIN signs a dose, a handover and a risk assessment"
            expand={{ kind: 'whole' }}
          />
        </div>
        <Button
          size="large"
          onClick={() => {
            setCurrent('')
            setNext('')
            setConfirm('')
            setOpen(true)
          }}
          data-open-pin
        >
          Change PIN
        </Button>
      </div>
      {said === undefined ? null : (
        <p className={styles.said} data-pin-said>
          {said}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen} title="Change your medication PIN">
        <div className={styles.form}>
          {held ? (
            <>
              <DigitField
                label="Current medication PIN"
                length={4}
                value={current}
                onValueChange={setCurrent}
                masked
              />
              {/* Not a notice about this build: it is one PIN, and the lock is
                the same lock wherever it is entered. */}
              <p className={styles.said}>{PIN_LOCK_IS_SHARED}</p>
            </>
          ) : null}
          <DigitField
            label="New medication PIN"
            length={4}
            value={next}
            onValueChange={setNext}
            masked
          />
          <DigitField
            label="Confirm new medication PIN"
            length={4}
            value={confirm}
            onValueChange={setConfirm}
            masked
          />
          {/* A mark as well as the colour: colour is never the sole carrier of
            whether a rule is met. The same treatment as the password rules and
            the account setup screen, which is where these three came from. */}
          <ul className={styles.ruleList} data-pin-rules>
            {PIN_RULES.map((rule) => {
              const met = rule.met(next, confirm)
              return (
                <li
                  key={rule.id}
                  className={styles.rule}
                  data-rule={rule.id}
                  data-met={met}
                >
                  <Icon name={met ? authIcons.met : authIcons.unmet} size={16} />
                  {rule.says}
                </li>
              )
            })}
          </ul>
          <div className={styles.formAct}>
            <Button
              size="large"
              disabled={!ready}
              onClick={() => {
                change()
                setOpen(false)
              }}
              data-change-pin
            >
              Save new PIN
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  )
}

/**
 * Appendix D, drawn as a real table because it is one.
 *
 * Every row, including the six nobody can turn off: absence from a list is the
 * same bug as a blank cell, and a preferences screen showing only the
 * switchable ones would say this product sends six notifications.
 */
function NotificationTable() {
  const [, redraw] = useState(0)

  return (
    <>
      <div className={styles.scroll}>
        <table className={styles.table} data-notification-table>
          <caption className={styles.caption}>
            {NOTIFICATIONS.length} notifications, in the PRD’s own order, with what each
            one can be turned off
          </caption>
          <thead>
            <tr>
              <th scope="col">Notification</th>
              <th scope="col">Channel</th>
              <th scope="col">When</th>
              <th scope="col">Who it reaches</th>
              <th scope="col">Turning it off</th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICATIONS.map((kind) => (
              <tr key={kind.id} data-notification={kind.id}>
                <th scope="row" className={styles.rowHead}>
                  {kind.what}
                </th>
                <td>{kind.channel}</td>
                <td>{kind.when}</td>
                <td>{kind.reaches}</td>
                <td>
                  <OffSwitch kind={kind} onChange={() => redraw((n) => n + 1)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
       * **The same twelve as a list, for a screen no five-column table fits.**
       * At 390 the table was 650px inside a 314px window. Restyling the table
       * would take its semantics with it, so the phone gets a list that is
       * honestly a list and the desk keeps the table; CSS chooses (CLAUDE.md
       * §4). Every row and every column is in both.
       */}
      <ul className={styles.kindList} data-notification-list>
        {NOTIFICATIONS.map((kind) => (
          <li className={styles.kind} key={kind.id} data-notification={kind.id}>
            <p className={styles.kindWhat}>{kind.what}</p>
            <dl className={styles.kindFacts}>
              <div className={styles.kindFact}>
                <dt>Channel</dt>
                <dd>{kind.channel}</dd>
              </div>
              <div className={styles.kindFact}>
                <dt>When</dt>
                <dd>{kind.when}</dd>
              </div>
              <div className={styles.kindFact}>
                <dt>Who it reaches</dt>
                <dd>{kind.reaches}</dd>
              </div>
            </dl>
            <div className={styles.kindAct}>
              <OffSwitch kind={kind} onChange={() => redraw((n) => n + 1)} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * The one cell that can be acted on, or the words saying why it cannot.
 *
 * **Not a disabled switch where Appendix D refuses one**, because a switch
 * drawn off reads as a notification somebody turned off. The words say the
 * table refuses it, and the two the table calls safety critical say that too.
 */
function OffSwitch({
  kind,
  onChange,
}: {
  kind: NotificationKind
  onChange: () => void
}) {
  if (!canBeTurnedOff(kind))
    return (
      <span className={styles.fixed} data-fixed={kind.canTurnOff}>
        Cannot be turned off
        {kind.canTurnOff === 'no_safety_critical' ? (
          <span className={styles.quiet}>Safety critical</span>
        ) : null}
      </span>
    )

  const off = isTurnedOff(kind.id)
  return (
    <Switch
      label={off ? 'Off' : 'On'}
      checked={!off}
      onCheckedChange={(on) => {
        if (on) turnOn(kind.id)
        else turnOff(kind.id)
        onChange()
      }}
    />
  )
}
