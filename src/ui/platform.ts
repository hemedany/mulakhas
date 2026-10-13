/**
 * Whether this device can share voice notes from WhatsApp into Mulakhas: an installed web app on
 * Android, in a browser that supports receiving shares (Firefox for Android doesn't). No browser
 * feature says so, so this asks the platform; it only decides what the tutorial mentions.
 */
export function canReceiveShares() {
  const android = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform === 'Android' || /Android/i.test(navigator.userAgent)
  return android && !/Firefox/i.test(navigator.userAgent)
}
