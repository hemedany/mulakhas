/** The tutorial's steps, in order ('share' only where WhatsApp can share into Mulakhas). */
export const TUTORIAL_STEPS = ['key', 'add', 'share', 'request', 'result'] as const
export type TutorialStep = (typeof TUTORIAL_STEPS)[number]
