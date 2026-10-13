/** Ready-made Requests offered as tiles and chips. Their prompts arrive with the writer (ticket 05). */
export const PRESETS = ['recipe', 'steps', 'todo', 'points', 'translate', 'exact'] as const
export type PresetId = (typeof PRESETS)[number]
