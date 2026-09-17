import { ClientOnly } from '../client-only'

export default function SignedOutPage() {
  return <ClientOnly screen="signedOut" />
}
