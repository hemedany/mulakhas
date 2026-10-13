# Sheets use the native <dialog> element, not shadcn/Radix

The spec planned shadcn/ui (Radix) primitives for dialogs and menus. Radix's modal scroll lock (react-remove-scroll) injects `<style>` elements at runtime, which the Content Security Policy blocks (`style-src 'self'`, no `'unsafe-inline'`). A static site cannot add per-request nonces, so we would have had to weaken the CSP. Instead every sheet is a native `<dialog>` opened with `showModal()`: the browser provides focus trapping, Escape, the top layer and `::backdrop`, and scroll locking is one CSS rule (`html:has(dialog[open])`). Supported in every browser Mulakhas targets (Safari 15.4+).

## Consequences

- No Radix dependency; menus are choice lists inside sheets rather than dropdowns.
- Revisit if a component needs behaviour `<dialog>` lacks (anchored popovers): the Popover API is the next candidate, not Radix.
