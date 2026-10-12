# Mulakhas

Mulakhas (ملخّص, "summary") reads a run of voice notes, videos and text messages in order and writes the one document the user asked for.

## Language

### What the user brings

**Thread**:
An ordered run of Messages that Mulakhas reads together, top to bottom, to produce one Result. Later Messages may correct earlier ones.
_Avoid_: pile, timeline, batch, session, conversation

**Message**:
One entry in a Thread: a Voice note, a Video or a Text message.
_Avoid_: item, file, entry

**Voice note**:
A Message that is sound only, such as a WhatsApp voice message or any audio file.
_Avoid_: voice message, audio file, recording

**Video**:
A Message with moving pictures and, usually, sound.

**Text message**:
A Message the user types or pastes and places between other Messages.

**Share-in**:
A Voice note or Video arriving from another app (such as WhatsApp) through the phone's share sheet, added to the end of the current Thread. After a Result, it starts a fresh Thread instead (the Result stays in History).
_Avoid_: shared file, share target

**Request**:
What the user asks Mulakhas to make from a Thread, in their own words or by picking a preset.
_Avoid_: instructions, prompt, query

**Dictation**:
Speaking a Request or Follow-up instead of typing it. Dictation only ever fills those boxes; it never adds a Message to the Thread.
_Avoid_: voice input, recording

### What Mulakhas gives back

**Mode**:
Whether a Result is a Summary or Exact words.

**Summary**:
A Result shaped by the Request: a recipe, a to-do list, key points, a translation.

**Exact words**:
A Result that keeps everything said in every Message, cleaned of filler but not shortened.
_Avoid_: transcript (for the Result), verbatim

**Result**:
The document Mulakhas produces for a Thread, in either Mode.
_Avoid_: output, answer, response

**Transcript**:
The words Mulakhas heard in one Voice note or Video; for a Video Gemini watched, also what it shows. Users see it only behind "what it heard"; they never have to correct it.

**Unclear passage**:
A stretch of a Transcript that was heard with low confidence, flagged as `[unclear]` inside the Result.
_Avoid_: low-confidence segment, uncertain word

**Reliability report**:
The optional section at the end of a Result listing each Message's clarity and its Unclear passages.
_Avoid_: accuracy report, noise report, confidence score

**Follow-up**:
A question the user asks about a Result after it is made.

**History**:
The Results saved on the user's device.

### Keys

**Own key**:
A provider key a user connects once so Mulakhas runs on their own account: a Groq key (required) and, optionally, a Gemini key that lets Mulakhas watch Videos.
_Avoid_: BYOK, API key setup
