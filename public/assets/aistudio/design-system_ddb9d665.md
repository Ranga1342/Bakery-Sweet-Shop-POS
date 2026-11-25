# RESTO CORE — POS Design System Documentation

> **Source:** One uploaded composite screenshot (`Frame 75.png`, 2048 × 317 px) containing four desktop application views: Dashboard, Menu Management, POS Billing, and Reports.
>
> **Documentation scope:** Reverse-engineering of the visible interface only. This is not a redesign specification. Values marked **Approx.** are visual estimates from the raster screenshot, not verified source tokens. Behaviours and states not shown are marked **Not identifiable from screenshots**.

## Table of Contents

1. [Evidence and Confidence](#1-evidence-and-confidence)
2. [Design Overview](#2-design-overview)
3. [Color System](#3-color-system)
4. [Typography System](#4-typography-system)
5. [Spacing and Layout System](#5-spacing-and-layout-system)
6. [Global Application Shell](#6-global-application-shell)
7. [Reusable Component Library](#7-reusable-component-library)
8. [Navigation and Information Architecture](#8-navigation-and-information-architecture)
9. [Screen Layout Documentation](#9-screen-layout-documentation)
10. [Tables and Data Presentation](#10-tables-and-data-presentation)
11. [Forms and Input Patterns](#11-forms-and-input-patterns)
12. [Feedback and Interaction States](#12-feedback-and-interaction-states)
13. [Iconography and Visual Assets](#13-iconography-and-visual-assets)
14. [Design Consistency Rules](#14-design-consistency-rules)
15. [Unverified / Not Identifiable](#15-unverified--not-identifiable)

---

## 1. Evidence and Confidence

### 1.1 Source coverage

| Source view | Visible content | Confidence |
|---|---|---|
| Dashboard | Global shell, KPI cards, top-selling items, recommendations, orders on hold | High for visible structure; low for exact dimensions and text sizes |
| Menu Management | Global shell, category navigation, dish sub-groups, item table, stock status | High for visible structure |
| POS Billing | Global shell, category and favourite navigation, menu item cards, order list, order summary, payment actions, stock warning | High for visible structure |
| Reports | Global shell, report type navigation, KPI cards, filter row, orders table | High for visible structure |

### 1.2 Confidence labels

- **Observed:** Directly visible in the supplied screenshot.
- **Approximate:** Estimated from rendered pixels or visual comparison; verify against design source before treating as a token.
- **Not identifiable:** The screenshot does not provide enough evidence to determine the value or behaviour.

The screenshot is a small-height composite image. Fine text, exact font metrics, hover/focus states, and precise component dimensions cannot be reliably measured. The four views share a visual system, but individual pages use different content arrangements.

## 2. Design Overview

### 2.1 Overall visual direction

- **Observed:** Desktop web-based restaurant POS/admin interface.
- **Observed:** Warm orange is the primary accent against a very dark brown-black navigation rail.
- **Observed:** Main workspaces use pale cool-grey backgrounds, with white cards and panels.
- **Observed:** The interface is compact and information-dense, prioritising operational data, menu selection, order processing, and reporting.
- **Observed:** Cards and panels use rounded corners, subtle borders or soft separation, and restrained shadows where visible.
- **Observed:** Small line-style icons accompany navigation items, actions, metrics, and status labels.
- **Observed:** Food thumbnails appear in menu and sales-item contexts; they are photographic rather than illustrative.

### 2.2 Visual hierarchy

1. Persistent dark sidebar establishes application navigation.
2. White top header establishes page identity, search, and account/branch context.
3. Page title and primary actions sit at the top of the workspace.
4. Operational summaries and key controls are placed above detailed lists.
5. Tables, menu cards, and order panels contain the working-level information.
6. Orange highlights important actions and current selections; secondary content remains neutral.

### 2.3 Density and layout character

The four screens show a compact desktop layout with many small controls and data points visible at once. The Dashboard and Reports views use card-and-table arrangements. Menu Management uses a category rail plus a central listing. POS Billing uses a multi-column operational workspace with menu browsing, order contents, and payment summary visible together.

## 3. Color System

Colors below are sampled or visually estimated from the supplied raster. The sampled values are useful reference approximations, not confirmed design tokens from source code.

### 3.1 Core palette

| Token name | Approx. HEX | Use | Evidence |
|---|---:|---|---|
| `brand-primary` | `#FB923C` | Primary buttons, active navigation, selected tabs/chips, highlights, small accent marks | Approx.; orange pixels sampled from screenshot |
| `brand-primary-dark` | Not identifiable | Hover/pressed brand state | Not shown clearly |
| `sidebar-background` | `#181210` | Persistent left navigation background | Approx.; sampled dark brown-black |
| `workspace-background` | `#E0E2E7` | Main work area behind white panels, especially Menu Management and POS Billing | Approx.; sampled cool grey |
| `surface-primary` | `#FFFFFF` | Cards, tables, header, order summary, panels | Observed; white |
| `surface-subtle` | `#FAF9F5` | Some light warm-toned panel or card surfaces | Approx.; sampled warm off-white |
| `text-primary` | `#181210` | Main dark text and headings | Approx.; visually close to sidebar tone |
| `text-secondary` | Not identifiable | Secondary labels, metadata, helper copy | Grey text visible; exact value not reliable |
| `text-inverse` | `#FFFFFF` | Text/icons on dark sidebar and orange buttons | Observed visually |
| `border-subtle` | Not identifiable | Input outlines, card boundaries, table separators | Light neutral lines visible; exact value not reliable |

### 3.2 Semantic/status colors

| Semantic role | Visible treatment | Approx. value | Notes |
|---|---|---|---|
| Success / available | Pale green badge with green text in item availability column | Not reliably identifiable | Visible in Menu Management |
| Warning | Pale orange/yellow warning treatment and orange accent | Not reliably identifiable | Visible in stock warning area and warning indicators |
| Error / destructive | Red/pink badge or icon treatment for some alerts/actions | Not reliably identifiable | Small red status and delete-related icon treatments are visible |
| Informational | Neutral grey or pale tinted surfaces | Not identifiable | No distinct information-blue token can be confirmed |
| Active / selected | Orange fill or orange text/icon | `#FB923C` approx. | Used in sidebar, category selection, chips, and primary actions |

### 3.3 Color usage conventions

- Use orange for primary actions, active navigation, selected controls, and key emphasis.
- Keep large content surfaces white or pale neutral to maintain contrast with the dark sidebar.
- Use the dark brown-black only for the persistent navigation area and dark text accents visible in the interface.
- Use semantic colors locally for statuses and alerts; do not infer a full semantic palette beyond the visible examples.

## 4. Typography System

### 4.1 Font family and source

| Property | Specification | Confidence / source |
|---|---|---|
| Font family | **Plus Jakarta Sans** | Supplied design token; use as the documented application font family |
| Numeric style | Plus Jakarta Sans numerals | Supplied font-family token; screenshot shows compact numeric KPI and table values |
| General text character | Modern sans-serif with compact operational typography | Observed in screenshots |

The font family and type scale below were supplied as design tokens after the initial screenshot analysis. They take precedence over the earlier visual-only estimate. They are not claimed to have been measured from the composite screenshot.

### 4.2 Typography tokens

| Token | Font family | Size | Weight | Line height | Letter spacing |
|---|---|---:|---:|---:|---:|
| `headline-xl` | Plus Jakarta Sans | 32px | 700 | 40px | -0.02em |
| `headline-xl-mobile` | Plus Jakarta Sans | 26px | 700 | 34px | -0.02em |
| `headline-lg` | Plus Jakarta Sans | 24px | 700 | 32px | -0.015em |
| `headline-md` | Plus Jakarta Sans | 20px | 600 | 28px | -0.01em |
| `headline-sm` | Plus Jakarta Sans | 16px | 600 | 24px | Not specified |
| `body-lg` | Plus Jakarta Sans | 16px | 400 | 24px | Not specified |
| `body-md` | Plus Jakarta Sans | 14px | 400 | 20px | Not specified |
| `body-sm` | Plus Jakarta Sans | 12px | 400 | 18px | Not specified |
| `label-lg` | Plus Jakarta Sans | 14px | 600 | 20px | 0.01em |
| `label-md` | Plus Jakarta Sans | 12px | 600 | 16px | 0.02em |
| `label-sm` | Plus Jakarta Sans | 11px | 600 | 14px | 0.03em |
| `code-sm` | Plus Jakarta Sans | 12px | 600 | 16px | 0.04em |

### 4.3 Mapping tokens to visible UI roles

The following mapping is a practical interpretation of the supplied scale against the visible hierarchy. The token definitions are supplied; individual screen-to-token assignments are inferred and should be checked against the source design file if exact implementation parity is required.

| UI role | Suggested documented token | Notes |
|---|---|---|
| Large page/marketing-level heading, if used | `headline-xl` | No 32px heading is clearly visible in the supplied composite |
| Mobile large heading | `headline-xl-mobile` | Mobile screenshot was not supplied; token is provided by the user |
| Page title | `headline-sm` or `headline-md` | Select according to the page-title prominence in the actual implementation |
| Section heading / card heading | `label-lg` or `headline-sm` | Compact headings are visible in the screenshots |
| KPI value | `headline-md` or `headline-lg` | Use the larger token only where the metric hierarchy warrants it |
| Standard body copy | `body-md` | Main readable content and descriptions |
| Supporting copy / table metadata | `body-sm` | Compact secondary text |
| Form labels | `label-md` | Small semibold labels |
| Compact badges / table headers | `label-sm` | Dense interface labels |
| Code-like identifiers | `code-sm` | Token supplied; no distinct code treatment is confirmed in the screenshot |

### 4.4 Typography conventions visible in the screenshots

- KPI values receive stronger emphasis than their labels and supporting metadata.
- Page titles are distinct from compact section headings.
- Table headers and metadata are visually smaller than row content.
- Button and chip labels are compact and semibold.
- Supporting descriptions use smaller, lower-emphasis text.


## 5. Spacing and Layout System

### 5.1 Supplied spacing tokens

The following spacing values were supplied as design tokens. They are documented as the intended spacing scale rather than inferred measurements from the composite screenshot.

| Token | Value | Approx. px equivalent* | Intended role / notes |
|---|---:|---:|---|
| `gutter` | `1.25rem` | 20px | Standard page/content gutter |
| `gutter-mobile` | `0.75rem` | 12px | Mobile page/content gutter |
| `margin` | `1.75rem` | 28px | Standard outer margin |
| `margin-mobile` | `1rem` | 16px | Mobile outer margin |
| `space-xs` | `0.25rem` | 4px | Extra-small spacing |
| `space-sm` | `0.5rem` | 8px | Small spacing |
| `space-md` | `1rem` | 16px | Medium spacing |
| `space-lg` | `1.5rem` | 24px | Large spacing |
| `space-xl` | `2rem` | 32px | Extra-large spacing |

*Pixel equivalents assume a 16px root font size. Preserve the rem values as the source tokens if the application uses a different root size.

### 5.2 Supplied corner-radius tokens

| Token | Value | Approx. px equivalent* | Typical component fit |
|---|---:|---:|---|
| `rounded-sm` | `0.25rem` | 4px | Small controls and compact surfaces |
| `rounded` / `DEFAULT` | `0.5rem` | 8px | Default rounded component treatment |
| `rounded-md` | `0.75rem` | 12px | Medium rounded cards/panels |
| `rounded-lg` | `1rem` | 16px | Larger panel/card corners |
| `rounded-xl` | `1.5rem` | 24px | Extra-large surface corners |
| `rounded-full` | `9999px` | Fully rounded | Pills, circular elements, and round badges where applicable |

*Pixel equivalents assume a 16px root font size. The token scale is supplied; the exact token used by each visible component is not identifiable from the composite screenshot.

### 5.3 Screenshot-derived layout observations

| Element | Visible pattern | Measurement confidence |
|---|---|---|
| Sidebar width | Persistent narrow left rail | Exact width not identifiable from the composite's scaled views |
| Top header | Horizontal bar spanning the workspace | Exact height not identifiable |
| Main page gutters | Compact, consistent inset around page content | Exact screenshot-derived measurement not reliable |
| Card padding | Compact internal spacing | Exact component-level padding not identifiable |
| Control height | Compact controls suited to a dense desktop POS | Exact heights not identifiable |
| Inter-card gap | Tight and consistent gaps between panels | Exact gap not identifiable |

### 5.4 Layout conventions

- The sidebar is fixed-looking and vertically stacked along the left edge.
- The top header spans the remaining application width.
- Page content begins below the header and is arranged in white cards/panels.
- Dashboard and Reports use modular card layouts with clear gutters.
- Menu Management places category navigation on the left and the item-management workspace on the right.
- POS Billing uses a multi-panel layout: menu browsing on the left, order contents and summary on the right.
- The POS workspace uses a grey background to distinguish operational panels from the white global header and cards.
- Use the supplied spacing scale as the documented token vocabulary; do not assume every gap in the screenshot maps to a different token.

### 5.5 Responsive behaviour

The token set includes mobile gutter, margin, and headline values, but the supplied screenshot itself contains desktop-style views only. Mobile breakpoint values, breakpoint names, responsive column changes, sidebar collapse rules, and tablet behaviour remain **Not identifiable from screenshots**.


## 6. Global Application Shell

### 6.1 Sidebar

**Observed elements:**

- Brand/logo block at the top, with a compact icon and RESTO CORE wordmark.
- Small product descriptor beneath or adjacent to the brand name.
- A navigation section label.
- Vertically stacked navigation items with an icon and text label.
- Visible destinations: Dashboard, POS Billing, Menus, Reports, Stock & Inventory, and Settings.
- Active item shown as an orange rounded rectangle with light text/icon.
- Inactive items shown on the dark background with light text and small icons.
- Some items show a compact count/badge at the right edge.

**Dimensions:** Exact sidebar width, item height, icon size, and internal padding are not identifiable with confidence from the composite.

### 6.2 Top header

**Observed elements:**

- Current page title and a small supporting subtitle/descriptor on the left.
- Search input near the centre-left.
- Orange primary action in the header on some screens, labelled `New Bill` or similar page-specific action.
- Notification icon/control.
- Branch/business identity text and circular profile/avatar control at the right.

The exact header controls differ slightly by screen. Do not assume every page has the same primary action.

### 6.3 Workspace

- White cards are placed over a light grey or white page surface depending on the screen.
- Content panels have compact headings and action controls aligned along their top edges.
- The page shell remains visually consistent across all four screenshots.

## 7. Reusable Component Library

### 7.1 Buttons

| Variant | Appearance | Visible use |
|---|---|---|
| Primary | Orange fill, white label, rounded corners | New Bill, Add, Add Item, Bill & Print, main create actions |
| Secondary / neutral | White or very light surface with neutral border and dark label/icon | Filter, Export, Refresh Tickets, View Stock and compact panel actions |
| Text / icon action | Small icon or text with minimal surrounding treatment | Edit, delete, row actions, close controls |
| Selected navigation action | Orange background with light icon and text | Active sidebar item |

**Approximate dimensions:** Compact height around 20–30 px in the screenshot. Width is content-dependent. Exact padding and radius are not identifiable.

**States:** Default and selected/active treatments are visible. Hover, keyboard focus, pressed, loading, and disabled appearances are not identifiable.

### 7.2 Search fields

- Light neutral or white fill.
- Rounded rectangular shape.
- Search icon at the leading edge.
- Placeholder copy in muted grey.
- Appears in the global header and within page-specific category/item areas.
- Exact height, border colour, focus ring, and clear-button behaviour are not identifiable.

### 7.3 Inputs and text fields

- White/light neutral background.
- Thin light border or subtle outline.
- Rounded corners.
- Small placeholder and label typography.
- Customer name field is visible in the POS order summary.
- Search and customer inputs are the only clearly identifiable text-entry examples.
- Validation, error messaging, required indicators, and focus states are not shown.

### 7.4 Dropdowns and filter controls

- Compact white/light controls with a small chevron or filter icon.
- Used for date range (`Last 7 Days`), filter controls, payment details expansion, and other page-level options.
- Some controls combine a label and chevron inside a bordered rounded rectangle.
- Dropdown menu contents and open-state appearance are not visible.

### 7.5 Tabs, chips, and category selectors

- Compact pill or rounded-rectangle controls.
- Selected category uses orange fill or orange emphasis.
- Unselected categories use a white/light neutral background with dark text.
- POS Billing shows category chips such as All, Tiffen, Lunch, Dinner, Snacks, and Beverages.
- Menu Management shows category and sub-group selection patterns.
- Favourite navigation is presented as a distinct category/section.
- Exact selected-state contrast and keyboard interaction are not identifiable beyond the visible selected styling.

### 7.6 Cards and panels

- Predominantly white surfaces.
- Rounded corners, approximately 5–8 px (Approx.).
- Compact internal padding.
- Very subtle shadow or light edge separation; exact shadow token is not identifiable.
- Card headings align to the top-left, with optional actions at the top-right.
- Used for KPI summaries, top-selling products, recommendations, order-on-hold tickets, menu item groups, and report summaries.

### 7.7 KPI / metric cards

- White rounded card.
- Small label above or beside a large bold metric.
- Small supporting metadata below the main value.
- A compact tinted icon tile appears near the card's upper/right area in some examples.
- Dashboard examples: Today's Sales, Today's Orders, Running Orders.
- Reports examples: Today's Sales and Today's Orders.

### 7.8 Menu item cards

- White card with food thumbnail image.
- Item name and price below or beside the image depending on the visible arrangement.
- Orange Add button beneath the item content in POS Billing.
- Menu group cards show a small thumbnail, group name, and item count/metadata.
- Image crop, source ratio, and exact card dimensions are not identifiable.

### 7.9 Tables / data grids

- White panel containing a compact row-and-column layout.
- Header row uses small uppercase or compact labels.
- Row separators are very light or minimal.
- Item thumbnail can appear in the first data column.
- Numeric values are visually aligned within their columns.
- Status appears as a coloured text/badge treatment.
- Row actions are placed at the far right using small icons.
- See [Tables and Data Presentation](#10-tables-and-data-presentation).

### 7.10 Badges and status indicators

- Small rounded labels or compact coloured indicators.
- Orange used for selected/attention labels and count indicators.
- Pale green with green text indicates item availability in Menu Management.
- Red/pink treatment appears for warning or destructive-related indicators.
- Examples include item availability, stock warning, pending count, and category counts.
- Exact semantic colour values are not identifiable.

### 7.11 Alerts and warning panels

- POS Billing displays a stock warning banner near the top of the menu area.
- The banner includes a warning icon, short title/message, a `View Stock` action, and a close icon.
- The treatment uses a pale warm warning surface and orange emphasis.
- Dismissal behaviour is suggested by the close icon but cannot be verified from a static screenshot.

### 7.12 Order list / ticket cards

- A narrow list of order/ticket entries is shown in the POS Billing panel.
- Each entry appears as a compact bordered or light-filled row/card.
- Order identifier and short customer/order descriptor are shown.
- A small delete/remove icon appears at the right of at least one entry.
- Dashboard's Orders on Hold section uses larger ticket cards with order number, customer/order metadata, item and amount, and a prominent resume-bill action.

### 7.13 Pagination

- Compact pagination appears below the Menu Management item table and Reports orders table.
- Current page is highlighted in orange.
- Previous/next controls are small and neutral.
- Total page count and exact pagination behaviour are not fully identifiable.

### 7.14 Modals, popovers, and overlays

- No open modal or popover is clearly visible in this composite.
- Filter buttons and dropdown affordances are visible, but their expanded content is not.
- Modal dimensions, overlay opacity, placement, and interaction behaviour are **Not identifiable from screenshots**.

### 7.15 Checkboxes, radio buttons, and toggles

- Small square selection checkboxes are visible in table rows and at least one table header.
- Their checked appearance is not clearly visible.
- Radio controls and toggle switches are not identifiable in the supplied image.

### 7.16 Empty states

- POS Billing's Order Summary shows an empty-order illustration/icon and a short instruction prompting the user to select menu items to create a new order.
- The empty state is centred in the right-side order panel.
- It uses a pale orange circular icon treatment and muted supporting text.
- Other empty-state variants are not shown.

### 7.17 Expandable sections

- Payment Details appears as a compact expandable row with a chevron in the POS order summary.
- Whether it is expanded or collapsed in the screenshot is not fully determinable.
- Expansion animation and content are not identifiable.

## 8. Navigation and Information Architecture

### 8.1 Primary navigation

The visible sidebar order is:

1. Dashboard
2. POS Billing
3. Menus
4. Reports
5. Stock & Inventory
6. Settings

The Dashboard, Menus, and Reports screens show their corresponding active navigation item highlighted in orange. POS Billing is shown as a separate operational screen with the same global shell.

### 8.2 Page-level navigation

- **Menu Management:** Category list on the left; dish sub-groups and all-items table in the main content area.
- **POS Billing:** Category navigation and favourites on the left; menu item selection in the main area; order summary and payment actions on the right.
- **Reports:** Report type selector in a left-side panel; selected report content in the main area.
- **Dashboard:** Primarily a summary page; no secondary page navigation is clearly visible.

### 8.3 Active and inactive states

- Active primary navigation: orange rounded rectangle, white/light icon and label.
- Inactive navigation: dark sidebar background, light icon and label.
- Selected page-level category/chip: orange fill or orange emphasis.
- Inactive page-level category/chip: light surface and dark label.

## 9. Screen Layout Documentation

### 9.1 Dashboard

**Purpose:** Provide an at-a-glance view of sales, order volume, running orders, popular menu items, recommendations, and held orders.

**Layout:**

- Global sidebar and top header.
- Three KPI cards across the upper content area:
  - Today's Sales with a currency value.
  - Today's Orders with an order count.
  - Running Orders with an active count.
- Middle content row is split into two primary panels:
  - **Top Selling Item:** grid/list of menu items with thumbnails, item names, order counts, and small progress bars.
  - **Our Recommendation:** stacked recommendation entries with item name, short descriptor, percentage/metric badge, and small progress indicator.
- Bottom section: **Order on Hold**, with a pending-count badge and refresh action.
- Held orders appear as horizontally arranged ticket cards. Each card includes an order identifier, customer/order metadata, item and amount, and a prominent Resume Bill action.

**Hierarchy:** KPI metrics first, product performance and recommendations second, held-order recovery third.

**Important patterns:**
- KPI cards use large bold values.
- Product rows pair small food imagery with text and a quantitative value.
- Progress bars use orange as the visual accent.
- Held orders are actionable cards rather than a conventional table.

### 9.2 Menu Management

**Purpose:** Organise menu categories and dish sub-groups, and manage menu item information and availability.

**Layout:**

- Global sidebar and top header.
- A narrow category panel appears to the left of the main workspace.
- Category panel includes a `Categories` heading, an add-category action, and a category search field.
- Category entries are vertically stacked; the selected category is orange.
- Main workspace begins with a `Dish Sub-Groups` heading and a `New Group` action.
- Group cards appear in a horizontal row. The selected group uses orange emphasis; other groups remain on white/light surfaces.
- An `All Items` section follows, with an item count and compact actions such as Filter, Export, and Add Item.
- Item table includes selection checkboxes, product image/name, price, stock/availability-related information, status, and row actions.
- Pagination is placed at the bottom-right of the table panel.

**Hierarchy:** Category selection → dish sub-group selection → all-items table.

**Important patterns:**
- The category panel and central content area are visually separated.
- Group cards use a small image and compact metadata.
- Table statuses use colour-coded labels.
- Main actions sit at the top-right of their relevant sections.

### 9.3 POS Billing

**Purpose:** Build an order from menu items, review the order, enter customer information, and proceed to payment or kitchen/order actions.

**Layout:**

- Global sidebar and top header.
- Main workspace uses a light grey background and a three-part operational arrangement.
- **Left navigation panel:** Categories and favourites. Categories include All, Tiffen, Lunch, Dinner, Snacks, Beverages, and additional menu groups visible in the list.
- **Menu selection area:** Stock warning banner at the top, favourites/category controls, and a grid of food item cards with image, item name, price, and orange Add button.
- **Order list area:** Compact order/ticket list with an add-new action.
- **Order Summary panel:** Customer name input, empty-state message when no items have been selected, Payment Details expandable row, Grand Total, and primary/secondary order actions.

**Visible order actions:**
- Bill & Print (Enter)
- Hold Order (F4)
- Send to KOT

**Hierarchy:** Choose category → add menu items → review order → enter customer details / payment details → choose an order action.

**Important patterns:**
- Menu cards prioritise food photography and a direct Add action.
- Order Summary is a distinct white panel on the right.
- Grand Total is emphasised in orange.
- Primary billing action is a full-width orange button.
- Secondary actions sit below the primary action.
- The empty state occupies the order summary's central area when there are no selected items.

### 9.4 Reports

**Purpose:** Review business reports, sales/order summaries, and individual order records.

**Layout:**

- Global sidebar and top header.
- A report-type navigation panel appears to the left of the main report area.
- The panel is headed `Report Types` and contains options including Orders, Item Sales, and Tax/related report types visible in the screenshot.
- The selected report type is orange.
- Main report area shows the selected report title (`Orders`) and an Export action.
- Two KPI cards appear near the top: Today's Sales and Today's Orders.
- A filter row appears above the data table, including search/filter controls and a date range selector (`Last 7 Days`).
- Orders table includes selection checkbox, order number, date/time, product/item, amount, and action column.
- Pagination and a result-count summary appear at the bottom of the table.

**Hierarchy:** Report type → KPI summary → filters → detailed records.

**Important patterns:**
- Report type selection uses a left-side panel rather than top tabs.
- Summary cards sit above the data table.
- Filters are grouped in a horizontal row.
- Export is positioned at the top-right of the report content.

## 10. Tables and Data Presentation

### 10.1 Visible table structures

**Menu Management item table**

- Selection checkbox column.
- Product image and name column.
- Price column.
- Additional inventory/stock-related value column(s).
- Availability/status column.
- Action column with compact icons.

**Reports orders table**

- Selection checkbox column.
- Order number.
- Date and time.
- Product/item.
- Amount.
- Action column.

### 10.2 Table styling

| Property | Observed pattern | Measurement |
|---|---|---|
| Table surface | White panel | Observed |
| Header | Compact, small text, uppercase or strongly compact labels | Approximate |
| Rows | Short, dense rows | Exact height not identifiable |
| Dividers | Very light/minimal separators | Exact colour not identifiable |
| Selection | Small square checkbox at left | Observed |
| Product identity | Thumbnail plus item name in menu table | Observed |
| Numeric values | Kept in separate columns; visually aligned | Observed, exact alignment rules not fully measurable |
| Status | Compact coloured text/badge | Observed |
| Actions | Small icon controls at far right | Observed |
| Pagination | Compact controls at bottom-right | Observed |

### 10.3 Data formatting

- Currency is displayed with the rupee symbol (`₹`) in visible examples.
- Counts are displayed as numeric values followed by a unit such as orders.
- Dates and times appear in compact formats in the Reports table.
- Product/item names are paired with small green or neutral status markers in some rows.
- Exact date format, decimal precision, sorting behaviour, and column resizing are not identifiable.

## 11. Forms and Input Patterns

### 11.1 Visible form fields

| Field/control | Screen | Visible treatment |
|---|---|---|
| Global search | All views | Compact rounded search field with leading search icon and muted placeholder |
| Category search | Menu Management | Search field within category panel |
| Customer name | POS Billing | Label above a light input with placeholder indicating optional entry |
| Report search/filter | Reports | Compact search/filter control above the table |
| Date range | Dashboard / Reports | Compact dropdown-like control displaying `Last 7 Days` |

### 11.2 Form layout conventions

- Labels are small and placed above or within the relevant field area.
- Inputs use light backgrounds and subtle borders.
- Form fields are compact to preserve workspace density.
- Customer name is positioned near the top of the Order Summary panel.
- Page-level filters are aligned horizontally above the relevant data table.

### 11.3 Validation and required fields

**Not identifiable from screenshots.** No visible inline validation error, required-field marker, success validation, or disabled-submit state can be confirmed.

## 12. Feedback and Interaction States

Only states visible in the screenshot are documented below.

| State | Evidence | Notes |
|---|---|---|
| Default | Neutral white/light surfaces and inactive navigation | Observed across all screens |
| Active navigation | Orange sidebar item | Observed |
| Selected category/group | Orange fill or orange emphasis | Observed in Menu Management and POS Billing |
| Available/success-like status | Pale green status label | Observed in Menu Management |
| Warning | Stock warning banner with warning icon and View Stock action | Observed in POS Billing |
| Pending/count indicator | Small orange/red count badges | Observed in Dashboard and other sections |
| Empty | Order Summary empty state with icon and instruction | Observed in POS Billing |
| Destructive/remove affordance | Small red delete/remove icon | Observed in order/ticket context |
| Hover | Not identifiable | No pointer or hover capture |
| Keyboard focus | Not identifiable | No visible focus ring can be confirmed |
| Pressed | Not identifiable | Static screenshot only |
| Disabled | Not identifiable | No unambiguous disabled control |
| Loading | Not identifiable | No spinner/skeleton state visible |
| Error | Not identifiable as a distinct inline error state | Red accents alone are insufficient to define a complete error state |
| Modal open | Not identifiable | No clearly visible modal overlay |

## 13. Iconography and Visual Assets

### 13.1 Icons

- Small, simple line-style icons are used throughout the sidebar and controls.
- Sidebar icons are positioned to the left of navigation labels.
- Small icons appear in KPI cards, search fields, filter controls, action buttons, status indicators, and close/remove controls.
- Icons are generally monochrome, with orange or white used to indicate active/primary contexts.
- Exact icon library, stroke width, and canonical icon size are not identifiable.

### 13.2 Food imagery

- Food/product thumbnails appear in Dashboard top-selling items, Menu Management groups/items, and POS Billing menu cards.
- Images are photographic food imagery, not flat illustrations.
- Thumbnails are small and cropped to fit compact card/table layouts.
- Exact image dimensions, aspect ratios, corner radius, and image-fit rules are not identifiable.

### 13.3 Illustration

- POS Billing empty state includes a simple orange-toned shopping/cart-like icon illustration inside a pale circular background.
- No other large illustration style is visible.

### 13.4 Shape and depth

| Property | Visible treatment |
|---|---|
| Corner radius | Rounded cards, inputs, buttons, chips, and badges; exact token not confirmed |
| Borders | Light, subtle outlines on selected controls and some panels |
| Shadows | Very restrained, where present; exact blur/spread/opacity not identifiable |
| Dividers | Thin, pale separators in lists and tables |

## 14. Design Consistency Rules

The following rules describe the visual conventions repeated in the supplied screens. They are documentation of the observed system, not proposed enhancements.

1. **Preserve the global shell:** Keep the dark left sidebar and light top header as the recurring application frame.
2. **Use orange as the primary accent:** Orange identifies primary actions, active navigation, selected categories, and key numeric emphasis.
3. **Keep working surfaces light:** Use white cards and panels against pale neutral workspace backgrounds, as shown.
4. **Maintain compact information density:** Controls, labels, rows, and cards are small and operationally focused.
5. **Keep hierarchy consistent:** Page title first, section heading next, then content and detailed data.
6. **Use the same button hierarchy:** Orange filled buttons represent prominent actions; neutral buttons and icon actions are secondary.
7. **Use compact status treatments:** Availability, pending counts, and warnings appear as small badges or alert strips rather than large decorative blocks.
8. **Keep action placement predictable:** Section-level actions sit near the section heading, usually toward the right; row actions sit at the far-right edge.
9. **Use photographic product imagery in food/menu contexts:** Thumbnails support item recognition in product cards and lists.
10. **Retain screen-specific information architecture:** Dashboard uses summary cards; Menu Management uses category/group/table hierarchy; POS Billing uses a multi-panel order workflow; Reports uses report selector, summaries, filters, and table.
11. **Use consistent rounded geometry:** Cards, buttons, fields, and chips share a compact rounded visual language. The radius token scale is supplied; the exact token-to-component mapping is not identifiable from the screenshots.
12. **Do not infer unseen interaction states:** The screenshots do not define hover, focus, loading, modal, or responsive behaviours.
13. **Document existing variation rather than forcing uniformity:** Some page headers and action sets differ by screen. Preserve these visible differences unless a separate source confirms a shared rule.

## 15. Unverified / Not Identifiable

This section separates details now documented through supplied design tokens from details that remain unverified in the available visual source.

### 15.1 Details supplied and now documented

The following previously unknown values were provided as explicit design tokens and are included in this document:

- **Font family:** Plus Jakarta Sans.
- **Typography scale:** `headline-xl`, `headline-xl-mobile`, `headline-lg`, `headline-md`, `headline-sm`, `body-lg`, `body-md`, `body-sm`, `label-lg`, `label-md`, `label-sm`, and `code-sm`, with the supplied sizes, weights, line heights, and letter spacing documented in [Typography System](#4-typography-system).
- **Corner-radius scale:** `rounded-sm`, `rounded` / `DEFAULT`, `rounded-md`, `rounded-lg`, `rounded-xl`, and `rounded-full`, documented in [Spacing and Layout System](#5-spacing-and-layout-system).
- **Spacing scale:** `gutter`, `gutter-mobile`, `margin`, `margin-mobile`, `space-xs`, `space-sm`, `space-md`, `space-lg`, and `space-xl`, documented in [Spacing and Layout System](#5-spacing-and-layout-system).

These are treated as supplied application tokens, not as values independently measured from the screenshot. Pixel conversions are approximate and assume a 16px root font size.

### 15.2 Details that remain unverified

The following details cannot be reliably extracted from the supplied composite screenshot and have not been supplied as authoritative source tokens. Do not treat estimates or visual descriptions elsewhere in this document as confirmed implementation values.

- Authoritative HEX/RGB values for all colours, especially subtle greys and semantic colours.
- Exact colour values for hover, pressed, disabled, focus, and other interactive states.
- Exact grid dimensions, column widths, and responsive breakpoints.
- Exact sidebar and header dimensions at the original design viewport.
- Exact page-level and component-level padding/gap assignments from the supplied spacing scale.
- Which specific radius token is assigned to each individual component.
- Border widths, border colours, shadow values, blur, spread, opacity, and elevation levels.
- Hover, focus, pressed, disabled, loading, and keyboard-accessibility states.
- Open dropdown, date picker, filter popover, and modal designs.
- Form validation and error/success messaging patterns.
- Toggle and radio-button styling.
- Detailed interaction behaviour, including whether close, delete, add, and expand controls trigger confirmation or undo flows.
- Exact table row heights, column widths, sorting indicators, and pagination rules.
- Exact dimensions, aspect ratios, crop modes, and source of product images.
- Responsive behaviour at mobile, tablet, and intermediate viewport sizes. Mobile-specific typography and spacing tokens are known, but the actual responsive layouts are not shown.
- Exact icon library, icon names, stroke widths, and sizing rules.

### 15.3 Implementation guidance for unknowns

- Use the supplied typography, spacing, and radius tokens as the documented token definitions.
- For the remaining unknowns, retain the visual descriptions and approximate values already identified in this document, but label them as provisional estimates.
- Do not convert an approximate screenshot colour or dimension into an authoritative design token without checking the source design file or application styles.
- Do not invent unseen component states or interaction behaviour. Record them as unknown until a screen capture, prototype, or source specification provides evidence.
- Where a future implementation requires a value that is still unknown, inspect the original design source or running application and record the measured value separately with its source and confidence level.

---

**End of design-system documentation.**
