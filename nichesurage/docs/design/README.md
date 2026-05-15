# NicheSurage design system

The canonical design system lives in [/DESIGN.md](../../DESIGN.md). AI coding agents and human contributors should consult it before making UI changes.

## Files in this folder

- `preview.html` — visual catalog: all colors, type ladder, buttons, cards, badges, premium block, marketing hero. Open directly in a browser; not part of the Next.js app.

## When to update DESIGN.md

- Adding a new color token, type size, or component pattern.
- Changing a token value (e.g., raising emerald saturation).
- Adding or removing a surface variant.

## When NOT to update

- Implementing existing tokens in new components — that's a code change, not a design change.
- Adjusting one component's padding by 4px — local to the component, not a system-wide token shift.
