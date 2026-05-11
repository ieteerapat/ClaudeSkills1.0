# Figma → CSS Property Mapping

Exact mappings from Figma design context properties to CSS. Use these to avoid approximation errors.

## Layout (Auto Layout → Flexbox)

| Figma Property | Value | CSS Equivalent |
|---|---|---|
| `layoutMode` | HORIZONTAL | `display: flex; flex-direction: row` |
| `layoutMode` | VERTICAL | `display: flex; flex-direction: column` |
| `layoutMode` | NONE | No flex (absolute/static positioning) |
| `primaryAxisAlignItems` | MIN | `justify-content: flex-start` |
| `primaryAxisAlignItems` | CENTER | `justify-content: center` |
| `primaryAxisAlignItems` | MAX | `justify-content: flex-end` |
| `primaryAxisAlignItems` | SPACE_BETWEEN | `justify-content: space-between` |
| `counterAxisAlignItems` | MIN | `align-items: flex-start` |
| `counterAxisAlignItems` | CENTER | `align-items: center` |
| `counterAxisAlignItems` | MAX | `align-items: flex-end` |
| `counterAxisAlignItems` | BASELINE | `align-items: baseline` |
| `layoutWrap` | WRAP | `flex-wrap: wrap` |
| `layoutWrap` | NO_WRAP | `flex-wrap: nowrap` |
| `itemSpacing` | number (px) | `gap: {value}px` |
| `counterAxisSpacing` | number (px) | `column-gap: {value}px` (when wrapped) |
| `paddingTop` | number | `padding-top: {value}px` |
| `paddingRight` | number | `padding-right: {value}px` |
| `paddingBottom` | number | `padding-bottom: {value}px` |
| `paddingLeft` | number | `padding-left: {value}px` |

## Sizing

| Figma Property | Value | CSS Equivalent |
|---|---|---|
| `primaryAxisSizingMode` | FIXED | Explicit width/height |
| `primaryAxisSizingMode` | AUTO | Content-hugging (no explicit size) |
| `counterAxisSizingMode` | FIXED | Explicit cross-axis size |
| `counterAxisSizingMode` | AUTO | Content-hugging cross-axis |
| `layoutGrow` | 1 | `flex-grow: 1` |
| `layoutGrow` | 0 | `flex-grow: 0` (default) |
| `layoutAlign` | STRETCH | `align-self: stretch` |
| `layoutAlign` | INHERIT | Uses parent's counterAxisAlignItems |
| `layoutSizingHorizontal` | FIXED | Explicit width |
| `layoutSizingHorizontal` | HUG | `width: fit-content` |
| `layoutSizingHorizontal` | FILL | `width: 100%` or `flex: 1` |
| `layoutSizingVertical` | FIXED | Explicit height |
| `layoutSizingVertical` | HUG | `height: fit-content` |
| `layoutSizingVertical` | FILL | `height: 100%` or `flex: 1` |

## Typography

| Figma Property | CSS Equivalent |
|---|---|
| `fontFamily` | `font-family: "{value}"` |
| `fontSize` | `font-size: {value}px` |
| `fontWeight` | `font-weight: {value}` |
| `lineHeight` (AUTO) | `line-height: normal` |
| `lineHeight` (px) | `line-height: {value}px` |
| `lineHeight` (%) | `line-height: {value/100}` |
| `letterSpacing` (px) | `letter-spacing: {value}px` |
| `letterSpacing` (%) | `letter-spacing: {value/100}em` |
| `textAlignHorizontal` MIN | `text-align: left` |
| `textAlignHorizontal` CENTER | `text-align: center` |
| `textAlignHorizontal` MAX | `text-align: right` |
| `textAlignHorizontal` JUSTIFIED | `text-align: justify` |
| `textDecoration` UNDERLINE | `text-decoration: underline` |
| `textCase` UPPER | `text-transform: uppercase` |
| `textCase` LOWER | `text-transform: lowercase` |
| `textCase` TITLE | `text-transform: capitalize` |

### Font Weight Name → Number

| Figma Style Name | CSS font-weight |
|---|---|
| Thin | 100 |
| ExtraLight / UltraLight | 200 |
| Light | 300 |
| Regular / Normal | 400 |
| Medium | 500 |
| SemiBold / DemiBold | 600 |
| Bold | 700 |
| ExtraBold / UltraBold | 800 |
| Black / Heavy | 900 |

## Colors & Fills

| Figma Property | CSS Equivalent |
|---|---|
| Solid fill `{r, g, b}` (0-1 range) | `background-color: rgb({r*255}, {g*255}, {b*255})` |
| Solid fill with opacity | `background-color: rgba({r*255}, {g*255}, {b*255}, {opacity})` |
| Linear gradient | `background: linear-gradient(...)` |
| Radial gradient | `background: radial-gradient(...)` |
| Image fill | `background-image: url(...)` + `background-size: cover/contain` |
| Stroke (solid) | `border: {weight}px solid {color}` |
| Stroke (inside) | `box-shadow: inset 0 0 0 {weight}px {color}` |
| Stroke (outside) | `box-shadow: 0 0 0 {weight}px {color}` |
| Stroke (center) | `border: {weight}px solid {color}` |

## Effects

| Figma Effect | CSS Equivalent |
|---|---|
| Drop shadow | `box-shadow: {x}px {y}px {blur}px {spread}px {color}` |
| Inner shadow | `box-shadow: inset {x}px {y}px {blur}px {spread}px {color}` |
| Layer blur | `filter: blur({radius}px)` |
| Background blur | `backdrop-filter: blur({radius}px)` |

## Border Radius

| Figma Property | CSS Equivalent |
|---|---|
| `cornerRadius` (uniform) | `border-radius: {value}px` |
| Individual corners | `border-radius: {TL}px {TR}px {BR}px {BL}px` |
| `cornerSmoothing` > 0 | iOS-style squircle (no pure CSS equivalent, use SVG clip-path) |

## Constraints (for absolute positioning)

| Figma Constraint | CSS Equivalent |
|---|---|
| LEFT | `position: absolute; left: {x}px` |
| RIGHT | `position: absolute; right: {parentWidth - x - width}px` |
| TOP | `position: absolute; top: {y}px` |
| BOTTOM | `position: absolute; bottom: {parentHeight - y - height}px` |
| LEFT_RIGHT | `position: absolute; left: {x}px; right: {parentWidth - x - width}px` |
| TOP_BOTTOM | `position: absolute; top: {y}px; bottom: {parentHeight - y - height}px` |
| CENTER (horizontal) | `position: absolute; left: 50%; transform: translateX(-50%)` |
| CENTER (vertical) | `position: absolute; top: 50%; transform: translateY(-50%)` |
| SCALE | `position: absolute; left: {x/parentWidth * 100}%; width: {width/parentWidth * 100}%` |

## Overflow & Clipping

| Figma Property | CSS Equivalent |
|---|---|
| `clipsContent: true` | `overflow: hidden` |
| `clipsContent: false` | `overflow: visible` |

## Opacity & Visibility

| Figma Property | CSS Equivalent |
|---|---|
| `opacity` (0-1) | `opacity: {value}` |
| `visible: false` | `display: none` or `visibility: hidden` |

## Blend Modes

| Figma Blend Mode | CSS mix-blend-mode |
|---|---|
| NORMAL | normal |
| MULTIPLY | multiply |
| SCREEN | screen |
| OVERLAY | overlay |
| DARKEN | darken |
| LIGHTEN | lighten |
| COLOR_DODGE | color-dodge |
| COLOR_BURN | color-burn |
| HARD_LIGHT | hard-light |
| SOFT_LIGHT | soft-light |
| DIFFERENCE | difference |
| EXCLUSION | exclusion |
