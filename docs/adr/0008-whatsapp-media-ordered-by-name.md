# WhatsApp media are ordered by their names, not their file dates

The spec ordered a batch of added files by their file dates. On a phone those dates say when a file was saved, shared or downloaded, not when it was sent: voice notes shared from WhatsApp together often carry the same moment, or the order they were picked in. WhatsApp's own names do carry the sending order: `PTT-20261011-WA0003.opus` is the third voice note of 11 October 2026.

So when every file in a batch has a WhatsApp name (`PTT-`, `AUD-` or `VID-`, then a date and a `WA` number), the batch is ordered by that date and number. Any other batch falls back to file dates, and same-dated files to the number in their names. Each batch goes after the Messages already in the Thread, and any Message can still be moved by hand.

## Considered Options

- **File dates only**, as specced: wrong whenever a phone stamps a batch with the moment it was shared.
- **Names first, even in a mixed batch**: a batch that mixes WhatsApp media with other files has no single right order, so it keeps to file dates rather than guess.
