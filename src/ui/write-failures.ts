import type { WriteFailure } from '@/engine'
import type { Strings } from '@/i18n/strings'

/** Failures only a (new) Groq key can fix: they offer Change key rather than Try again. */
export const needsKey = (failure: WriteFailure) => failure === 'no-key' || failure === 'rejected'

/** What each way writing (a Result or a Follow-up) can fail says. */
export const writeFailureText = (t: Strings): Record<WriteFailure, string> => ({
  'no-key': t.writeNoKey,
  empty: t.writeEmpty,
  'nothing-heard': t.writeNothingHeard,
  rejected: t.failRejected,
  busy: t.failBusy,
  unreachable: t.failUnreachable,
  'too-big': t.writeTooBig,
  unknown: t.writeUnknown,
})
