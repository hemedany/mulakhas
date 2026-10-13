import { ANSWER, FAKE_GROQ_KEY, HEARD, QUESTION, RESULT_TITLE, expect, openApp, stubGroq, test, voiceNote } from './fixtures.ts'

test('turns voice notes into one Result, then answers a Follow-up about it', async ({ page, isMobile }) => {
  await stubGroq(page)
  await openApp(page)

  await page.getByRole('button', { name: 'Recipe' }).click()
  await page.locator('input[type=file]').setInputFiles([voiceNote('PTT-20261011-WA0001.wav'), voiceNote('PTT-20261011-WA0002.wav')])
  await expect(page.getByRole('main').getByText('Heard', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Summarize it' }).click()
  await expect(page.getByRole('heading', { name: RESULT_TITLE })).toBeVisible()

  // On a phone the Result rises as a sheet, and Follow-ups are asked there.
  const ask = isMobile ? page.locator('dialog[open] textarea') : page.locator('footer textarea')
  await ask.fill(QUESTION)
  await ask.press('Enter')
  await expect(page.getByText(ANSWER).filter({ visible: true })).toBeVisible()
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

test('switches to Arabic, right to left', async ({ page }) => {
  await openApp(page)

  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('radio', { name: 'العربية' }).click()

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'ماذا تريد من هذه الرسائل؟' })).toBeVisible()
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

    await expect(page.getByRole('heading', { name: 'What do you want from these?' })).toBeVisible()
    // Fonts are kept as they are first used under the worker, so after this first visit they still
    // came from the network: offline they fall back to the system's until the next visit.
    const fontMiss = (e: string) => /^Failed to load resource: .*\.woff2?$/.test(e)
    pageErrors.splice(0, pageErrors.length, ...pageErrors.filter(e => !fontMiss(e)))
  })
})
