// WhatsApp's and phones' formats, which browsers label inconsistently, so they are also matched by name.
const MEDIA_EXTENSIONS = ['ogg', 'opus', 'oga', 'm4a', 'aac', 'mp3', 'wav', 'flac', 'mp4', 'mov', 'webm', '3gp', 'mkv']
const MEDIA_NAME = new RegExp(`\\.(${MEDIA_EXTENSIONS.join('|')})$`, 'i')

/** What the file picker offers. */
export const MEDIA_ACCEPT = ['audio/*', 'video/*', ...MEDIA_EXTENSIONS.map(e => `.${e}`)].join(',')

/** A Voice note or Video, judged by its type or, failing that, its name. */
export const isMedia = (file: File) => /^(audio|video)\//.test(file.type) || MEDIA_NAME.test(file.name)
