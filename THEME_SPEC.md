# VoidStaffOS (HeadofficeOS) — Theme Specification

## Source
HeadofficeOS Neutral Design System (ClickUp task 86c7yj0uu)

## Product Accent
- **Product:** StaffOS / HeadofficeOS
- **Primary Accent:** Dusty Blue `#b8c4d4`
- **Accent Hover:** `#a8b8c9`

## Architecture: CSS Variable Theming (White-label Ready)

### File Structure
```
frontend/src/
├── theme/
│   ├── variables.css          # All CSS custom properties (design tokens)
│   ├── base.css               # Reset, typography, body defaults
│   ├── components.css         # Component-level styles (cards, tables, modals, badges, nav, etc.)
│   └── themes/
│       └── default.css        # Default StaffOS overrides (product accent, any tweaks)
├── App.css                    # DELETE or replace with single @import chain
├── index.css                  # DELETE or replace with single @import chain
└── main.jsx                   # Import theme/variables.css + theme/base.css + theme/components.css
```

### White-label Mechanism
To retheme for a client:
1. Copy `themes/default.css` → `themes/client-name.css`
2. Override any CSS variables
3. Switch import in main.jsx

---

## Design Tokens (variables.css)

### Colours — Primary
```css
:root {
  /* Primary */
  --color-primary: #134e4a;
  --color-primary-hover: #0f3d3a;
  --color-secondary: #4338ca;
  --color-secondary-hover: #3730a3;

  /* Product Accent (StaffOS = Dusty Blue) */
  --color-product-accent: #b8c4d4;
  --color-product-accent-hover: #a8b8c9;

  /* Neutrals */
  --color-bg: #f9f6f2;
  --color-surface: #ffffff;
  --color-border: #e8e2d9;
  --color-text: #5c6b63;
  --color-text-heading: #134e4a;
  --color-text-muted: #8a9490;

  /* Semantic */
  --color-success: #b5ccc4;
  --color-success-text: #2d6a4f;
  --color-warning: #d4c4b5;
  --color-warning-text: #92400e;
  --color-error: #d4a5a5;
  --color-error-text: #991b1b;
  --color-info: #b8c4d4;
  --color-info-text: #1e40af;

  /* Dusty Accents */
  --color-taupe: #d4c4b5;
  --color-dusty-blue: #b8c4d4;
  --color-sage: #b5ccc4;
  --color-lavender: #c4b8d4;
  --color-rose: #d4a5a5;
}
```

### Typography
```css
:root {
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Scale */
  --text-display: 4.5rem;    /* 72px */
  --text-h1: 3rem;           /* 48px */
  --text-h2: 2.5rem;         /* 40px */
  --text-h3: 1.5rem;         /* 24px */
  --text-h4: 1.25rem;        /* 20px */
  --text-body-lg: 1.25rem;   /* 20px */
  --text-body: 1rem;         /* 16px */
  --text-body-sm: 0.875rem;  /* 14px */
  --text-label: 0.875rem;    /* 14px */
  --text-caption: 0.75rem;   /* 12px */

  /* Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Line heights */
  --leading-tight: 1.1;
  --leading-normal: 1.4;
  --leading-relaxed: 1.6;

  /* Letter spacing */
  --tracking-tight: -0.02em;
  --tracking-snug: -0.01em;
  --tracking-normal: 0;
  --tracking-wide: 0.01em;
}
```

### Spacing
```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
}
```

### Border Radius
```css
:root {
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;
}
```

### Shadows
```css
:root {
  --shadow-sm: 0 2px 8px rgba(19, 78, 74, 0.04);
  --shadow-md: 0 4px 20px rgba(19, 78, 74, 0.06);
  --shadow-lg: 0 12px 40px rgba(19, 78, 74, 0.10);
  --shadow-xl: 0 24px 64px rgba(19, 78, 74, 0.12);
  --shadow-focus: 0 0 0 3px rgba(67, 56, 202, 0.15);
  --shadow-input-focus: 0 8px 32px rgba(67, 56, 202, 0.12);
}
```

### Motion
```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --duration-slower: 800ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## Colour Mapping: Old → New

| Old (Dark Theme)       | Hex       | New (Design System)       | Variable                  |
|------------------------|-----------|---------------------------|---------------------------|
| Body bg                | #1a1a2e   | Cream                     | --color-bg (#f9f6f2)      |
| Card/surface bg        | #16213e   | White                     | --color-surface (#ffffff)  |
| Borders                | #2a2a4a   | Stone                     | --color-border (#e8e2d9)  |
| Primary accent         | #7f5af0   | Dark Teal                 | --color-primary (#134e4a)  |
| Primary hover          | #6b46e5   | Dark Teal hover           | --color-primary-hover      |
| Body text              | #eee/#ddd | Muted Teal                | --color-text (#5c6b63)     |
| Heading text           | #fff      | Dark Teal                 | --color-text-heading       |
| Secondary text         | #888/#aaa | Grey                      | --color-text-muted (#8a9490)|
| Links                  | #646cff   | Indigo                    | --color-secondary (#4338ca)|
| Success                | #2ed573   | Sage                      | --color-success (#b5ccc4)  |
| Warning                | #ffa500   | Taupe                     | --color-warning (#d4c4b5)  |
| Error/danger           | #ff4757   | Muted Rose                | --color-error (#d4a5a5)    |
| Info                   | #3498db   | Dusty Blue                | --color-info (#b8c4d4)     |

## Key Implementation Notes

1. **Inter font** — Add to index.html: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">`
2. **No dark mode** — Remove `prefers-color-scheme` media query and `color-scheme: light dark`
3. **Grain overlay** — Optional, add as final enhancement
4. **Status badges** — Use semantic colours with slightly darker text for WCAG contrast
5. **Form focus** — Use `--shadow-input-focus` (indigo glow) not purple
6. **Buttons** — Primary = `--color-primary`, rounded with `--radius-lg`, hover lift `translateY(-2px)`
7. **Tables** — White surface, stone borders, cream header bg, no uppercase headers
8. **Nav** — Cream bg, teal text, dusty blue active indicator
9. **Container** — max-width: 1152px, padding-inline: 24px

## Execution Order for Claude Code

1. Create `frontend/src/theme/variables.css` with all tokens above
2. Create `frontend/src/theme/base.css` — reset, typography, body, links, grain overlay
3. Create `frontend/src/theme/components.css` — migrate ALL component styles from App.css using variables
4. Create `frontend/src/theme/themes/default.css` — StaffOS product accent overrides (empty initially, accent is in variables)
5. Update `frontend/index.html` — add Inter font link
6. Update `frontend/src/main.jsx` — replace CSS imports with theme chain
7. Delete old `index.css` content (or make it a redirect import)
8. Replace `App.css` with theme imports only
9. Test: `npm run dev` and verify no missing styles, no dark remnants

## WCAG Contrast Notes
Semantic colours (#b5ccc4, #d4c4b5, #d4a5a5, #b8c4d4) are BACKGROUNDS only.
Text on them must use darker variants (--color-success-text, --color-warning-text, etc.)
Text on --color-bg (#f9f6f2) uses --color-text (#5c6b63) = 5.2:1 ratio ✓
Text on --color-surface (#ffffff) uses --color-text = 5.8:1 ratio ✓
Headings use --color-text-heading (#134e4a) = 9.4:1 ratio on white ✓
