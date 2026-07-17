# Design

## Register

product

## Theme

### Color Space

OKLCH — all design tokens defined as OKLCH values in CSS custom properties within `globals.css`.

### Light Theme — "Clinical White"

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.985 0.001 240)` | Page bg, near-white blue tint |
| `--foreground` | `oklch(0.18 0.012 250)` | Body text, very dark navy |
| `--card` | `oklch(1 0 0)` | Card surface, pure white |
| `--card-foreground` | `oklch(0.18 0.012 250)` | Card text, matches foreground |
| `--primary` | `oklch(0.52 0.14 255)` | Buttons, links, active states |
| `--secondary` | `oklch(0.93 0.008 240)` | Secondary surfaces |
| `--muted` | `oklch(0.95 0.004 240)` | Subtle backgrounds |
| `--muted-foreground` | `oklch(0.55 0.01 250)` | Secondary/secondary text |
| `--accent` | `oklch(0.90 0.02 240)` | Hover/selected states |
| `--border` | `oklch(0.91 0.005 240)` | Card borders, dividers |
| `--destructive` | `oklch(0.58 0.18 25)` | Errors, destructive actions |
| `--success` | `oklch(0.55 0.16 150)` | Success states |
| `--warning` | `oklch(0.70 0.16 80)` | Warning states |
| `--info` | `oklch(0.55 0.12 240)` | Info states |
| `--sidebar` | `oklch(1 0 0)` | Sidebar surface |

### Dark Theme — "Deep Navy"

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.11 0.015 255)` | Page bg, very dark navy |
| `--foreground` | `oklch(0.93 0.005 240)` | Body text, light gray-blue |
| `--card` | `oklch(0.16 0.012 255)` | Card surface |
| `--card-foreground` | `oklch(0.93 0.005 240)` | Card text |
| `--primary` | `oklch(0.60 0.15 255)` | Brighter for dark bg |
| `--border` | `oklch(0.28 0.015 255)` | Card borders |
| `--sidebar` | `oklch(0.13 0.012 255)` | Sidebar surface |

### Radius Scale

```
--radius:    0.75rem   (12px)  base
--radius-sm:  0.45rem   (~7px)
--radius-md:  0.6rem   (~10px)
--radius-lg:  0.75rem   (12px)
--radius-xl:  1.05rem  (~17px)
--radius-2xl: 1.35rem  (~22px)
--radius-3xl: 1.65rem  (~26px)
```

### Typography

| Role | Font | Source |
|------|------|--------|
| Body (sans) | Inter | `next/font/google`, CSS variable `--font-inter` |
| Heading | Outfit | `@fontsource/outfit`, weights 400/500/600/700 |

Utility class `font-heading` maps to `"Outfit", sans-serif`. Applied to all card titles, page headers, and navigation labels.

### Easing

```
--ease-out:     cubic-bezier(0.23, 1, 0.32, 1)   /* Emil Kowalski */
--ease-in-out:  cubic-bezier(0.77, 0, 0.175, 1)  /* Emil Kowalski */
```

Applied to all interactive transitions (hover, active, enter/exit).

## Components

### Button

- **Primitive:** `@base-ui/react/button`
- **Variants:** 6 — default, outline, secondary, ghost, destructive, link
- **Sizes:** 7 — xs (h-6), sm (h-7), default (h-8), lg (h-9), icon (size-8), icon-xs (size-6), icon-sm (size-7)
- **Radius:** `rounded-lg` (9.6px)
- **Behavior:** Active scale-down `scale-[0.97]`, focus-visible ring

### Card

- **Sizes:** sm (12px padding), default (16px padding)
- **Radius:** `rounded-xl` (17px)
- **Border:** `border border-border`
- **Sub-components:** CardHeader, CardTitle (font-heading), CardDescription, CardAction, CardContent, CardFooter
- **Accent extension:** `.card-accent` class adds 3px primary gradient top bar

### Input

- **Primitive:** `@base-ui/react/input`
- **Sizes:** sm (h-8, default for tables/filters), lg (h-11 rounded-xl, for prominent forms)
- **Behavior:** Focus-visible ring with `color-mix(in oklch, var(--primary) 8%, transparent)` shadow
- **States:** Disabled (opacity-50 + bg-input), invalid (destructive border + ring)

### Status Badge

- Pill shape: `rounded-full px-2.5 py-0.5 text-[11px]`
- Colored dot indicator: `h-1.5 w-1.5 rounded-full bg-current`
- 14 status variants with color mapping

### Sonner Toast

- Position: `top-right`
- richColors + closeButton
- Icon per type via lucide

### Sidebar

- Expanded: 240px width, collapsible to 56px
- Active item: 3px gradient left bar + background glow
- Role-based filtering
- Theme toggle (Sun/Moon) at bottom

### Theme Toggle

- 32x32px, rounded-lg
- Sun/Moon lucide icons

## Layout

### Dashboard Layout

- Fixed sidebar left, scrollable content right
- Header: 64px, breadcrumb + notification bell + user avatar
- Content: `p-6 lg:p-8`
- Bento grid: responsive card grids (sm: 2-col, lg: 3/4-col)

### Login Layout

- Two-panel: left brand panel (45%) + right form (55%)
- Left: gradient navy bg, dot pattern, subtle CLJ watermark, brand tagline
- Right: centered form, max-w-sm
- Mobile: single column, centered form with logo

### Animation

| Name | Properties | Duration |
|------|-----------|----------|
| fade-up | opacity 0→1, translateY 10→0 | 0.35s |
| slide-up | opacity 0→1, translateY 8→0 | 0.35s |
| slide-down | opacity 0→1, translateY -8→0 | 0.3s |
| fade-in | opacity 0→1 | 0.2s |
| scale-in | opacity 0→1, scale 0.96→1 | 0.2s |

Stagger system: `.stagger-1` through `.stagger-10` (increments of 0.04s).
Reduced motion: all durations zeroed at `prefers-reduced-motion: reduce`.

## Architecture

- **Framework:** Next.js 16.2.9 with Turbopack build
- **Styling:** Tailwind CSS v4 (CSS-based config via `@theme` block)
- **UI primitives:** shadcn/ui (base-ui/react underlay)
- **Icons:** lucide-react, `stroke-[1.5]` convention
- **Forms:** Zod v4 validation
- **State:** React context (auth, theme) + Supabase direct queries
- **Toast:** sonner

## Patterns

- **Card accent bar:** 3px gradient top border on KPI/metric cards via `.card-accent`
- **Empty state:** Centered column with icon (rounded container), heading, description, CTA
- **Loading:** Full-height centered `<Loader2 className="animate-spin" />`
- **Error states:** Centered column with icon, error message, optional back action
- **Stagger entrance:** Section groups animate in with increasing delay
- **Hover effect:** Cards lift `-translate-y-0.5` + shadow-md + border accent
- **Press effect:** Active `scale-[0.97]` on buttons and clickable cards
