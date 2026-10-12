// PROTOTYPE (ticket 02): icon per Message kind.
import type { Icon } from '@phosphor-icons/react'
import { ChatTextIcon, MicrophoneIcon, VideoCameraIcon } from '@phosphor-icons/react'
import type { SampleMessage } from './sample'

export const KIND_ICON: Record<SampleMessage['kind'], Icon> = {
  voice: MicrophoneIcon,
  video: VideoCameraIcon,
  text: ChatTextIcon,
}
