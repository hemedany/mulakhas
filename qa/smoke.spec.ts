import { ANSWER, FAKE_GROQ_KEY, HEARD, QUESTION, RESULT_TITLE, expect, openApp, stubGroq, test, voiceNote } from './fixtures.ts'

test('turns voice notes into one Result, shown first with the Messages folded away, then answers a Follow-up', async ({ page }) => {
  await stubGroq(page)
  await openApp(page)
  // The first screen is only for adding: what to make comes after.
  await expect(page.getByRole('button', { name: 'Recipe' })).toHaveCount(0)

  await page.locator('input[type=file]').setInputFiles([voiceNote('PTT-20261011-WA0001.wav'), voiceNote('PTT-20261011-WA0002.wav')])
  await expect(page.getByRole('main').getByText('Heard', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Recipe' }).click()
  await page.getByRole('button', { name: 'Summarize it' }).click()
  await expect(page.getByRole('heading', { name: RESULT_TITLE })).toBeVisible()

  const folded = page.getByRole('button', { name: /2 messages/ })
  await expect(folded).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('main').getByText('Heard', { exact: true })).toHaveCount(0)
  await folded.click()
  await expect(page.getByRole('main').getByText('Heard', { exact: true })).toHaveCount(2)

  const ask = page.locator('footer textarea')
  await ask.fill(QUESTION)
  await ask.press('Enter')
  await expect(page.getByText(ANSWER).filter({ visible: true })).toBeVisible()
})

test('opens a saved Result from History, and starts over from the header', async ({ page }) => {
  await stubGroq(page)
  await openApp(page)
  await page.locator('input[type=file]').setInputFiles(voiceNote('PTT-20261011-WA0001.wav'))
  await expect(page.getByRole('main').getByText('Heard', { exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Summarize it' }).click()
  await expect(page.getByRole('heading', { name: RESULT_TITLE })).toBeVisible()

  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByRole('dialog', { name: 'Start over' }).getByRole('button', { name: 'Clear and start over' }).click()
  await expect(page.getByRole('heading', { name: 'Share voice notes here' })).toBeVisible()

  await page.getByRole('button', { name: 'History' }).click()
  await page.getByRole('dialog', { name: 'Your saved results' }).getByText(RESULT_TITLE).click()
  const saved = page.getByRole('dialog', { name: 'Result' })
  await expect(saved.getByRole('heading', { name: RESULT_TITLE })).toBeVisible()
  await page.waitForTimeout(400) // past the time the list takes to leave
  await expect(saved).toBeVisible()
})

test('asks for a Groq key with the first Message, then hears it', async ({ page }) => {
  await stubGroq(page)
  await openApp(page, { key: false })

  await page.locator('input[type=file]').setInputFiles(voiceNote('PTT-20261011-WA0001.wav'))
  const sheet = page.getByRole('dialog', { name: 'Your key' })
  await expect(sheet).toBeVisible()
  await sheet.locator('input').first().fill(FAKE_GROQ_KEY)
  await sheet.getByRole('button', { name: 'Connect' }).click()

  await expect(page.getByRole('main').getByText('Heard', { exact: true })).toHaveCount(1)
})

test('moves a Message with its arrows, puts a Text message between two, and undoes a removal', async ({ page }) => {
  await stubGroq(page)
  await openApp(page)
  await page.locator('input[type=file]').setInputFiles([voiceNote('PTT-20261011-WA0001.wav'), voiceNote('PTT-20261011-WA0002.wav')])
  const rows = page.getByRole('main').getByRole('listitem')
  await expect(rows).toHaveCount(2)
  const names = () => rows.evaluateAll(lis => lis.map(li => li.textContent?.match(/WA000\d|use lamb/)?.[0]))

  await page.getByRole('button', { name: 'Move message 2 up' }).click()
  await expect.poll(names).toEqual(['WA0002', 'WA0001'])

  await page.getByRole('button', { name: 'Add a text message before message 2' }).click()
  await page.getByRole('main').getByRole('textbox').fill('use lamb')
  await expect.poll(names).toEqual(['WA0002', 'use lamb', 'WA0001'])

  await page.getByRole('button', { name: 'Remove message 1' }).click()
  await expect.poll(names).toEqual(['use lamb', 'WA0001'])
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(names).toEqual(['WA0002', 'use lamb', 'WA0001'])
})

test('chooses the language dictation listens for', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Add a text message' }).click()

  await page.locator('footer').getByRole('button', { name: 'Dictation language: English' }).click()
  await page.getByRole('dialog', { name: 'Dictation language' }).getByRole('radio', { name: 'Any language' }).click()

  await expect(page.locator('footer').getByRole('button', { name: 'Dictation language: Any language' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('hands over from one sheet to the next without closing both', async ({ page }) => {
  await stubGroq(page)
  await openApp(page)

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Change' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Your key' })).toBeVisible()
  await page.waitForTimeout(400) // past the time the first sheet takes to leave
  await expect(page.getByRole('dialog', { name: 'Your key' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('switches to Arabic, right to left', async ({ page }) => {
  await openApp(page)

  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('radio', { name: 'العربية' }).click()

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'شارك الرسائل الصوتية هنا' })).toBeVisible()
})

test('takes dictation phrase by phrase where the browser has no speech engine', async ({ page, browserName }) => {
  test.skip(browserName !== 'firefox', 'Firefox has no speech engine, so it dictates through Whisper')
  await stubGroq(page)
  // A microphone that hears the room, then a phrase, then a pause, as someone speaking would. A
  // browser's own fake microphone plays one steady tone, which is only ever the room.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext()
      await context.resume()
      const voice = context.createOscillator()
      const loudness = context.createGain()
      const t = context.currentTime
      loudness.gain.setValueAtTime(0.003, t)
      loudness.gain.setValueAtTime(0.3, t + 0.6)
      loudness.gain.setValueAtTime(0.003, t + 1.8)
      const microphone = context.createMediaStreamDestination()
      voice.connect(loudness).connect(microphone)
      voice.start()
      return microphone.stream
    }
  })
  await openApp(page)
  await page.getByRole('button', { name: 'Add a text message' }).click()
  await page.getByRole('main').getByRole('textbox').fill('Fry the vermicelli first')

  await page.locator('footer').getByRole('button', { name: 'Speak instead of typing' }).click()
  await expect(page.getByText('Listening. Your words appear after each pause.')).toBeVisible()
  // The phrase is written down after its pause, while still listening.
  await expect(page.locator('footer textarea')).toHaveValue(new RegExp(HEARD), { timeout: 10_000 })
  await page.locator('footer').getByRole('button', { name: 'Stop and keep what you said' }).click()

  await expect(page.locator('footer textarea')).toHaveValue(new RegExp(HEARD))
})

test.describe('with the service worker', () => {
  test.use({ serviceWorkers: 'allow' })

  test('keeps voice notes shared from WhatsApp in several goes together', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Sharing into an installed app is Android Chrome’s; one engine is enough here')
    await stubGroq(page)
    await openApp(page)
    await page.evaluate(() => navigator.serviceWorker.ready)

    // What Android's share sheet does: POST the files to the share target, then open the page.
    const wav = [...voiceNote('x').buffer]
    for (const names of [['PTT-20261011-WA0001.opus', 'PTT-20261011-WA0002.opus'], ['PTT-20261011-WA0003.opus']]) {
      await page.evaluate(async ({ names, wav }) => {
        const form = new FormData()
        for (const name of names) form.append('media', new File([new Uint8Array(wav)], name, { type: 'audio/ogg' }))
        await fetch('./share-target', { method: 'POST', body: form })
      }, { names, wav })
      await page.reload()
    }

    await expect(page.getByRole('main').getByText('Heard', { exact: true })).toHaveCount(3)
  })

  test('opens again without a connection once it has been visited', async ({ page, context, browserName, pageErrors }) => {
    test.skip(browserName !== 'chromium', 'One engine is enough for the offline shell')
    await openApp(page)
    await page.evaluate(() => navigator.serviceWorker.ready)

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Share voice notes here' })).toBeVisible()
    // Fonts are kept as they are first used under the worker, so after this first visit they still
    // came from the network: offline they fall back to the system's until the next visit.
    const fontMiss = (e: string) => /^Failed to load resource: .*\.woff2?$/.test(e)
    pageErrors.splice(0, pageErrors.length, ...pageErrors.filter(e => !fontMiss(e)))
  })
})
