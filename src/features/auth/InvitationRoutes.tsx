import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { setStanding } from '@/data/access/team-store'
import { useSession } from '@/app/session/use-session'
import { setMedicationPin } from '@/app/session/medication-pins'
import {
  Button,
  DigitField,
  PasswordField,
  TextField,
  buttonClassName,
} from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { StatusPill, Unrecorded } from '@/components/status'
import { formatDate } from '@/lib/format'
import { AuthActions, AuthPage, AuthStack, authLinkClass } from './AuthPage'
import { PasswordRules } from './PasswordRules'
import { forbiddenWords, unmetRules } from './password-rules'
import { PIN_RULES, pinReady } from './pin-rules'
import { addressFor } from './addresses'
import { careInvitationFor, careInvitations } from './invitation-people'
import { authIcons } from './auth.icons'
import styles from './auth.module.css'

const backToSignIn = (
  <Link href="/sign-in" className={authLinkClass()}>
    Back to sign in
  </Link>
)

/**
 * The invitations waiting, as a way in (AUTH-01).
 *
 * **In a real deployment this screen does not exist**: an invitation arrives as
 * a link in an email to one person. Nothing here sends email, so without it the
 * invitation screens could be reached only by typing an address, which is the
 * same as not having built them.
 */
export function InvitationIndexRoute() {
  const { sites } = useSession()
  const waiting = careInvitations(sites)
  return (
    <AuthPage
      title="Invitations"
      lede="Care workers never sign up: a manager invites them."
      data-invitation-index
      after={backToSignIn}
    >
      <AuthStack>
        <ul className={styles.peopleList}>
          {waiting.map(({ invitation, member, home, expired }) => (
            <li key={member.id}>
              <Link
                href={`/invitation/${member.id}/email`}
                className={styles.person}
                data-invitation-link={member.id}
              >
                <span className={styles.personName}>{member.ref.fullName}</span>
                <span className={styles.personMeta}>
                  {STAFF_ROLE_NAMES[member.role]} · {home.name} · invited by{' '}
                  {invitation.invitedBy.fullName} on {formatDate(invitation.invitedOn)}
                </span>
                <span
                  className={styles.personState}
                  data-invite-state={expired ? 'expired' : 'live'}
                >
                  {expired ? (
                    <StatusPill
                      tone="critical"
                      label={`Expired ${formatDate(invitation.expiresOn)}`}
                    />
                  ) : (
                    <StatusPill
                      tone="info"
                      label={`Expires ${formatDate(invitation.expiresOn)}`}
                    />
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </AuthStack>
    </AuthPage>
  )
}

function useInvitation() {
  const params = useParams<{ staffId: string }>()
  const { sites } = useSession()
  return careInvitationFor(params.staffId, sites)
}

function NoInvitation() {
  return (
    <AuthPage
      title="No invitation with that link"
      lede="If you were expecting one, ask the manager who invited you to send it again."
      data-invitation-missing
      after={backToSignIn}
    >
      <Link
        href="/invitation"
        className={buttonClassName({ variant: 'secondary', size: 'large' })}
      >
        See the invitations waiting
      </Link>
    </AuthPage>
  )
}

/**
 * The invitation email (AUTH-01), drawn as the email somebody would receive.
 *
 * It says it is never sent before anything else, because a reader looking at
 * an email expects it to have arrived somewhere.
 */
export function InvitationEmailRoute() {
  const { organisation } = useSession()
  const found = useInvitation()
  if (found === undefined) return <NoInvitation />
  const { invitation, member, home } = found
  const firstName = member.ref.fullName.split(/\s+/)[0] ?? member.ref.fullName

  return (
    <AuthPage
      title="Your invitation email"
      data-invitation-email={member.id}
      after={
        <Link href="/invitation" className={authLinkClass()}>
          All invitations
        </Link>
      }
    >
      <AuthStack>
        <div className={styles.email}>
          <dl className={styles.emailHead}>
            <div>
              <dt>From</dt>
              <dd>noreply@digicare.com</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{addressFor(member, home)}</dd>
            </div>
            <div>
              <dt>Subject</dt>
              <dd>You&apos;ve been added to {organisation.name} on diGi-Care</dd>
            </div>
          </dl>
          <div className={styles.emailBody}>
            <p>Hello {firstName},</p>
            <p>
              {invitation.invitedBy.fullName} has added you to {home.name} as a{' '}
              {STAFF_ROLE_NAMES[member.role].toLowerCase()}. Set up your account to
              start recording care.
            </p>
            <Link
              href={`/invitation/${member.id}`}
              className={buttonClassName({ size: 'large' })}
            >
              Set up your account
            </Link>
            <p className={styles.emailSmall}>
              This link works once, for 72 hours: until the end of{' '}
              {formatDate(invitation.expiresOn)}.
            </p>
          </div>
        </div>
      </AuthStack>
    </AuthPage>
  )
}

/**
 * Setting up an account from an invitation (AUTH-02).
 *
 * **The name is shown and not editable.** The PRD offers an editable name, and
 * nothing here could keep an edit: a staff member's name is the team record's,
 * changed by a manager. A field that accepts a correction and keeps none would
 * be a control that does nothing.
 *
 * **Accepting is real for this session.** Access is set on the team record in
 * memory, so the person can verify and sign in; signing out discards it, as it
 * discards everything.
 */
export function InvitationSetupRoute() {
  const { awaitCode, sites } = useSession()
  const router = useRouter()
  const found = useInvitation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')

  if (found === undefined) return <NoInvitation />
  const { invitation, member, home, today, expired } = found
  const address = addressFor(member, home)
  const firstName = member.ref.fullName.split(/\s+/)[0] ?? member.ref.fullName
  const forbidden = forbiddenWords(
    member,
    sites.filter((site) => member.siteIds.includes(site.id)),
  )
  const passwordReady =
    unmetRules(password, forbidden).length === 0 && password === confirm
  const ready = passwordReady && pinReady(pin, pinConfirm)

  if (expired) {
    return (
      <AuthPage
        title="This invitation has expired"
        lede={`It was good for 72 hours, until the end of ${formatDate(invitation.expiresOn)}.`}
        data-invitation-expired={member.id}
        after={backToSignIn}
      >
        <AuthStack>
          <Unrecorded
            variant="panel"
            caption="Account"
            label="Not set up"
            detail={`Ask ${invitation.invitedBy.fullName} to send a new invitation from Team Management.`}
          />
        </AuthStack>
      </AuthPage>
    )
  }

  return (
    <AuthPage
      title={`Set up your account, ${firstName}`}
      lede={`${invitation.invitedBy.fullName} invited you to ${home.name} on ${formatDate(invitation.invitedOn)}. This invitation expires at the end of ${formatDate(invitation.expiresOn)}.`}
      data-invitation-setup={member.id}
      after={backToSignIn}
    >
      <AuthStack>
        <TextField
          label="Full name"
          value={member.ref.fullName}
          readOnly
          hint="Your manager corrects your name in Team Management."
        />
        <TextField label="Email" type="email" value={address} readOnly />
        <p className={styles.detailLine}>
          {STAFF_ROLE_NAMES[member.role]} at {home.name}
        </p>

        <PasswordField
          label="Create password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          data-field="password"
        />
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          data-field="confirm"
        />
        <PasswordRules password={password} confirm={confirm} forbidden={forbidden} />

        <DigitField
          label="Medication PIN"
          length={4}
          masked
          value={pin}
          onValueChange={setPin}
          hint="It confirms a dose, and also signs a handover and a risk assessment. It is not for signing in."
        />
        <DigitField
          label="Confirm medication PIN"
          length={4}
          masked
          value={pinConfirm}
          onValueChange={setPinConfirm}
        />
        <ul className={styles.ruleList} data-pin-rules>
          {PIN_RULES.map((rule) => {
            const ok = rule.met(pin, pinConfirm)
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
        </ul>

        <AuthActions>
          <Button
            size="large"
            disabled={!ready}
            onClick={() => {
              setStanding(member.id, {
                kind: 'has_access',
                since: today,
                grantedBy: invitation.invitedBy,
              })
              setMedicationPin(member.id, pin)
              awaitCode(member, address, 'set_up_account', '/')
              router.push(`/invitation/${member.id}/verify`)
            }}
            data-set-up-account
          >
            Set up account
          </Button>
        </AuthActions>
      </AuthStack>
    </AuthPage>
  )
}
