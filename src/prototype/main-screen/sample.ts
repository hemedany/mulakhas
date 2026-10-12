// PROTOTYPE (ticket 02): sample content for the main-screen variants. Throwaway.

export type SampleState = 'heard' | 'hearing' | 'waiting'

export type SampleMessage =
  | { kind: 'voice'; name: string; seconds: number; state: SampleState; progress?: number; heard: string }
  | { kind: 'video'; name: string; seconds: number; state: SampleState; progress?: number; heard: string }
  | { kind: 'text'; text: string }

export interface SampleCopy {
  appName: string
  tagline: string
  emptyTitle: string
  emptyBody: string
  addMessages: string
  addText: string
  requestLabel: string
  requestPlaceholder: string
  summarize: string
  modeSummary: string
  modeExact: string
  presets: { id: string; label: string; hint: string }[]
  whatItHeard: string
  states: Record<SampleState, string>
  kind: Record<'voice' | 'video' | 'text', string>
  messages: string
  messagesCount: (n: number) => string
  result: string
  copy: string
  share: string
  followUp: string
  ask: string
  history: string
  language: string
  help: string
  reliability: string
  whatDoYouWant: string
  somethingElse: string
  writing: string
  textMessage: SampleMessage
  resultMd: string
  reliabilityRows: { n: number; clarity: number; note: string }[]
}

const files = (heard: [string, string, string, string]): SampleMessage[] => [
  { kind: 'voice', name: 'PTT-20261011-WA0003.opus', seconds: 48, state: 'heard', heard: heard[0] },
  { kind: 'voice', name: 'PTT-20261011-WA0004.opus', seconds: 72, state: 'heard', heard: heard[1] },
  { kind: 'video', name: 'VID-20261011-WA0007.mp4', seconds: 35, state: 'hearing', progress: 0.62, heard: heard[2] },
  { kind: 'voice', name: 'PTT-20261011-WA0005.opus', seconds: 21, state: 'waiting', heard: heard[3] },
]

const HEARD_AR: [string, string, string, string] = [
  'يا بنتي أول شي بتنقعي البرغل نص ساعة، وبعدين بتعصريه منيح منيح لحتى ما يضل فيه مي.',
  'الحشوة: بتقلي البصل مع اللحمة، وبتحطي صنوبر، و… [غير واضح] بهار حلو، وشوية سماق.',
  'شوفي هيك بتمدي الطبقة الأولى، بتضغطيها بإيدك المبلولة…',
  'وما تنسي تقطعيها قبل ما تدخليها عالفرن!',
]

export const COPY: Record<'en' | 'ar', SampleCopy> = {
  en: {
    appName: 'Mulakhas',
    tagline: 'Voice notes in, one clean summary out.',
    emptyTitle: 'Share voice notes here',
    emptyBody: 'From WhatsApp, or pick files. Videos and typed messages work too.',
    addMessages: 'Add voice notes or videos',
    addText: 'Add a text message',
    requestLabel: 'What should Mulakhas make?',
    requestPlaceholder: 'e.g. one recipe with quantities and numbered steps',
    summarize: 'Summarize',
    modeSummary: 'Summary',
    modeExact: 'Exact words',
    presets: [
      { id: 'recipe', label: 'Recipe', hint: 'Ingredients and steps' },
      { id: 'steps', label: 'Step by step', hint: 'Numbered, in order' },
      { id: 'todo', label: 'To-do list', hint: 'Only what to do' },
      { id: 'points', label: 'Key points', hint: 'Short bullets' },
      { id: 'translate', label: 'Translation', hint: 'Everything, in full' },
      { id: 'exact', label: 'Exact words', hint: 'Cleaned, nothing cut' },
    ],
    whatItHeard: 'What it heard',
    states: { heard: 'Heard', hearing: 'Listening', waiting: 'Waiting' },
    kind: { voice: 'Voice note', video: 'Video', text: 'Text message' },
    messages: 'Messages',
    messagesCount: n => `${n} messages`,
    result: 'Result',
    copy: 'Copy',
    share: 'Share',
    followUp: 'Ask about this result',
    ask: 'Ask',
    history: 'History',
    language: 'Language',
    help: 'Help',
    reliability: 'Reliability',
    whatDoYouWant: 'What do you want from these?',
    somethingElse: 'Something else…',
    writing: 'Listening to 5 messages',
    textMessage: { kind: 'text', text: 'Use lamb, not beef!' },
    resultMd: `# Kibbeh bil sanieh

**Ingredients**
- 500 g finely minced lamb, for the shell
- 250 g minced lamb, for the filling
- 2 cups fine bulgur
- 2 onions, finely chopped
- ½ cup pine nuts
- Salt, black pepper, sweet spice (bahar helo)
- [unclear: maybe ½] teaspoon sumac
- Ghee or olive oil

**Method**
1. Soak the bulgur for 30 minutes, then squeeze it until no water is left.
2. Fry the onion with the filling lamb, then add the pine nuts and spices.
3. Knead the bulgur with the shell lamb. Press half into an oiled tray with wet hands.
4. Spread the filling, then press the second layer on top.
5. Cut it into diamonds before it goes in the oven.

Lamb, not beef: the text message corrects the first voice note.`,
    reliabilityRows: [
      { n: 1, clarity: 94, note: 'Clear' },
      { n: 2, clarity: 81, note: 'Kitchen noise; one spice unclear' },
      { n: 4, clarity: 88, note: 'Short, clear' },
    ],
  },
  ar: {
    appName: 'ملخّص',
    tagline: 'رسائل صوتية تدخل، ملخص واحد واضح يخرج.',
    emptyTitle: 'شارك الرسائل الصوتية هنا',
    emptyBody: 'من واتساب، أو اختر ملفات. الفيديو والرسائل المكتوبة أيضاً.',
    addMessages: 'أضف رسائل صوتية أو فيديو',
    addText: 'أضف رسالة نصية',
    requestLabel: 'ماذا تريد من ملخّص؟',
    requestPlaceholder: 'مثلاً: وصفة واحدة بالمقادير وخطوات مرقّمة',
    summarize: 'لخّص',
    modeSummary: 'ملخص',
    modeExact: 'الكلمات حرفياً',
    presets: [
      { id: 'recipe', label: 'وصفة', hint: 'المقادير والخطوات' },
      { id: 'steps', label: 'خطوة بخطوة', hint: 'مرقّمة وبالترتيب' },
      { id: 'todo', label: 'قائمة مهام', hint: 'المطلوب فقط' },
      { id: 'points', label: 'نقاط أساسية', hint: 'نقاط قصيرة' },
      { id: 'translate', label: 'ترجمة', hint: 'كل شيء كاملاً' },
      { id: 'exact', label: 'الكلمات حرفياً', hint: 'منقّحة بلا حذف' },
    ],
    whatItHeard: 'ماذا سمع',
    states: { heard: 'سُمعت', hearing: 'يستمع', waiting: 'بالانتظار' },
    kind: { voice: 'رسالة صوتية', video: 'فيديو', text: 'رسالة نصية' },
    messages: 'الرسائل',
    messagesCount: n => `${n} رسائل`,
    result: 'النتيجة',
    copy: 'نسخ',
    share: 'مشاركة',
    followUp: 'اسأل عن هذه النتيجة',
    ask: 'اسأل',
    history: 'السجل',
    language: 'اللغة',
    help: 'مساعدة',
    reliability: 'الموثوقية',
    whatDoYouWant: 'ماذا تريد من هذه الرسائل؟',
    somethingElse: 'شيء آخر…',
    writing: 'يستمع إلى ٥ رسائل',
    textMessage: { kind: 'text', text: 'استعملي لحم غنم، مو بقر!' },
    resultMd: `# كبة بالصينية

**المقادير**
- ٥٠٠ غ لحم غنم مفروم ناعم للعجينة
- ٢٥٠ غ لحم غنم مفروم للحشوة
- كوبان من البرغل الناعم
- بصلتان مفرومتان ناعماً
- نصف كوب صنوبر
- ملح وفلفل أسود وبهار حلو
- [غير واضح: ربما نصف] ملعقة صغيرة سماق
- سمن أو زيت زيتون

**الطريقة**
1. انقعي البرغل نصف ساعة ثم اعصريه حتى لا يبقى فيه ماء.
2. اقلي البصل مع لحم الحشوة، ثم أضيفي الصنوبر والبهارات.
3. اعجني البرغل مع لحم العجينة، وافردي نصفها في صينية مدهونة بيد مبلولة.
4. وزّعي الحشوة ثم غطّيها بالطبقة الثانية واضغطيها.
5. قطّعيها معيّنات قبل إدخالها إلى الفرن.

لحم غنم لا بقر: الرسالة النصية تصحّح الرسالة الصوتية الأولى.`,
    reliabilityRows: [
      { n: 1, clarity: 94, note: 'واضحة' },
      { n: 2, clarity: 81, note: 'ضجيج مطبخ، وبهار واحد غير واضح' },
      { n: 4, clarity: 88, note: 'قصيرة وواضحة' },
    ],
  },
}

export function sampleThread(lang: 'en' | 'ar'): SampleMessage[] {
  const m = files(HEARD_AR)
  return [m[0], m[1], COPY[lang].textMessage, m[2], m[3]]
}

export function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Deterministic pseudo-waveform from the file name, so each Voice note looks distinct. */
export function waveform(name: string, bars = 28): number[] {
  let h = 2166136261
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return Array.from({ length: bars }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) + i
    return 0.25 + ((h >>> 0) % 1000) / 1333
  })
}
