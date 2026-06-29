---
name: Luminous Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#464554'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#006b5f'
  on-secondary: '#ffffff'
  secondary-container: '#6df5e1'
  on-secondary-container: '#006f64'
  tertiary: '#515c71'
  on-tertiary: '#ffffff'
  tertiary-container: '#6a758a'
  on-tertiary-container: '#fefcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#d8e3fb'
  tertiary-fixed-dim: '#bcc7de'
  on-tertiary-fixed: '#111c2d'
  on-tertiary-fixed-variant: '#3c475a'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  data-display:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  card-padding: 24px
---

## Brand & Style
The design system is centered on "Modern Glassmorphism & Airy Data Visualization," specifically tailored for high-stakes data analysis. The brand personality is clinical yet sophisticated—aiming to reduce the cognitive load of complex datasets through visual breathability. It targets analysts and engineers who require a high-fidelity environment that feels more like a cockpit than a spreadsheet.

The aesthetic blends **Minimalism** with **Glassmorphism**. It utilizes heavy whitespace to isolate data clusters, while frosted glass effects and translucent layers provide a sense of physical depth without adding visual weight. The emotional response is one of clarity, precision, and technological forwardness.

## Colors
The palette is rooted in a sophisticated trio: **Deep Slate** for foundational text and primary navigation, **Vibrant Indigo** for primary actions and brand presence, and **Soft Teal** for success states and secondary data trends.

- **Primary (Indigo):** Used for CTA buttons, active states, and primary data series.
- **Secondary (Teal):** Used for accent points, secondary data series, and "positive" delta indicators.
- **Neutral (Slate & Light Grey):** Light grey (#f8fafc) serves as the primary surface color, while Slate (#1e293b) provides high-contrast legibility for headers and body copy.
- **Gradients:** Use a 135-degree linear gradient from Indigo to Teal for hero elements and primary interactive states.

## Typography
Inter is used exclusively for its systematic, utilitarian nature and exceptional legibility at small sizes. 

- **High Contrast Data:** Primary metrics should use the `data-display` style to pop against glass surfaces. 
- **Hierarchy:** Use tight letter-spacing on display sizes to maintain a "tech-dense" feel, while increasing spacing for `label-sm` to ensure readability in metadata and axis labels.
- **Color Application:** Use Slate (#1e293b) for all primary text; use a 60% opacity of Slate for secondary labels to maintain the "airy" feel.

## Layout & Spacing
The system utilizes a **12-column fluid grid** for the main content area, with fixed side navigation.

- **Desktop:** 40px outer margins with 24px gutters. Dashboard widgets should typically span 3, 4, 6, or 12 columns.
- **Tablet:** 24px outer margins. Content reflows to an 8-column logic.
- **Mobile:** 16px outer margins. Cards stack vertically, spanning the full width of the viewport.
- **Rhythm:** All spacing is based on an 8px baseline grid to ensure mathematical harmony across components.

## Elevation & Depth
Depth is created through "Luminous Layering" rather than traditional dark shadows.

- **Level 1 (Base):** Light Grey (#f8fafc) background.
- **Level 2 (Cards):** Frosted glass surfaces using `backdrop-filter: blur(12px)` and `background: rgba(255, 255, 255, 0.7)`. Borders are 1px solid white with 40% opacity.
- **Level 3 (Modals/Popovers):** Multi-layered "Ambient Shadows." A soft, 15% opacity Indigo tint shadow (0px 20px 40px) combined with a tight 5% opacity Slate shadow (0px 4px 8px).
- **Interactive Elements:** Buttons should have a soft glow effect (`box-shadow`) using the primary Indigo color at 30% opacity when hovered.

## Shapes
The shape language is "Soft Geometric." 

- **Cards/Containers:** Use `rounded-lg` (16px) to maintain a modern, friendly feel.
- **Buttons/Inputs:** Use "Pill-shaped" (full radius) for all primary actions and search inputs to contrast against the rectangular grid.
- **Icons:** Enclosed in circular or squircle containers with a soft teal or indigo glow for emphasis.

## Components
- **Buttons:** Primary buttons are pill-shaped with the Indigo-to-Teal gradient and white text. Secondary buttons are "Ghost" style with an Indigo border and transparent background.
- **Cards:** Glassmorphic with a 1px inner white border. Padding is generous (24px) to ensure data visualizations do not touch the edges.
- **Data Visualization:** Charts should use Indigo and Teal as primary series colors. Use a light grey dashed line for grid backgrounds.
- **Inputs:** Translucent background with a 1px slate-200 border. On focus, the border transitions to Indigo with a 4px soft outer glow.
- **Chips/Status:** Pill-shaped with low-opacity background fills (e.g., 10% Teal for "Success") and high-opacity text.
- **Monochromatic Icons:** Use thin-stroke (1.5pt) icons in Slate. Active states should glow with the color of the associated action (Indigo or Teal).