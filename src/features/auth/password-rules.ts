import type { Site, StaffMember } from '@/data/types'

/**
 * What a password has to be, as the Care Worker PRD sets it (AUTH-02): at
 * least ten characters, a capital letter, a number and a symbol, and, carried
 * from the Admin build, not the person's name or the home's.
 *
 * **Each rule is a predicate, and the list is what a screen renders**, so a
 * rule cannot be shown without being checked or checked without being shown.
 *
 * **The same five rules decide whether a password can sign in.** Nothing here
 * stores a password, so none is checked against a record. But a password that
 * breaks the account's own rules is one nobody could have set, and refusing it
 * is a real check rather than a pretend one. That is what makes "not
 * recognised" and the lockout reachable honestly.
 *
 * **Ten characters, where the Admin build asks for twelve.** Each product
 * follows its own PRD; one account system should have one policy, and the
 * difference is recorded in docs/DEPARTURES.md.
 */
export interface PasswordRule {
  id: 'length' | 'capital' | 'number' | 'symbol' | 'not_name'
  says: string
  met: (password: string, forbidden: string[]) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    says: 'At least 10 characters',
    met: (password) => password.length >= 10,
  },
  {
    id: 'capital',
    says: 'At least one capital letter',
    met: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'number',
    says: 'At least one number',
    met: (password) => /\d/.test(password),
  },
  {
    id: 'symbol',
    says: 'At least one symbol',
    met: (password) => /[^A-Za-z0-9]/.test(password),
  },
  {
    id: 'not_name',
    says: 'Not your name or the name of the home',
    met: (password, forbidden) => {
      const lowered = password.toLowerCase()
      return (
        password.length > 0 &&
        !forbidden.some((word) => word.length > 2 && lowered.includes(word))
      )
    },
  },
]

/** The words a password may not contain, for one person at their homes. */
export function forbiddenWords(member: StaffMember, homes: Site[]): string[] {
  return [
    ...member.ref.fullName.toLowerCase().split(/\s+/),
    ...homes.flatMap((home) => home.name.toLowerCase().split(/\s+/)),
  ]
}

export function unmetRules(password: string, forbidden: string[]): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.met(password, forbidden))
}
