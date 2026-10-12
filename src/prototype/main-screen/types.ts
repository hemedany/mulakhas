// PROTOTYPE (ticket 02): what every main-screen variant receives.
import type { SampleCopy, SampleMessage } from './sample'

export type ScreenState = 'empty' | 'ready' | 'result'

export interface VariantProps {
  copy: SampleCopy
  thread: SampleMessage[]
  state: ScreenState
  onSummarize: () => void
  onReset: () => void
}
