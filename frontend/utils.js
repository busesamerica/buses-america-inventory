// Buses America - Shared formatting utilities
//
// Every component used to define its own formatCurrency/formatDate, and they
// had drifted into several different behaviors (negative amounts shown as
// "$-123.45" in some places and "($123.45)" in others, MXN amounts rendered
// as "MXN $123.45" here and "MX$123.45" there, date-only strings shifted a
// day off in some reports because of timezone-unsafe parsing). This file is
// the single source of truth so every screen renders money and dates the
// same way. Load it before any component script.

// Negative amounts use parentheses (standard accounting convention) instead
// of a leading minus sign, which is easy to misread next to a "$".
function formatCurrency(amount, currency = 'USD') {
  if (!amount && amount !== 0) return currency === 'USD' ? '$0.00' : 'MXN $0.00';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  const prefix = currency === 'USD' ? '$' : 'MXN $';
  return amount < 0 ? `(${prefix}${formatted})` : `${prefix}${formatted}`;
}

// `dateString` is expected to be a date-only or ISO string from the API.
// Appending 'T00:00:00' (no 'Z') forces the browser to parse it as local
// midnight instead of UTC midnight - without that, toLocaleDateString() can
// print the wrong day in timezones behind UTC.
// `style` controls the month format: 'short' (default, e.g. "Aug 25, 2026")
// or 'long' (e.g. "August 25, 2026") for formal report headers.
function formatDate(dateString, style = 'short') {
  if (!dateString) return 'N/A';
  const str = String(dateString).split('T')[0];
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: style,
    day: 'numeric'
  });
}

// Heading hierarchy, shared the same way as the formatters above.
//
// Every screen sits under the app shell's own page title (the top bar
// <h1>, e.g. "Sales Management" - see App_COMPLETE.jsx), so a module or a
// tab within it should never render another heading at that same 1.5rem
// weight: SalesManagement, AccountingDashboard and PreInspectionsList each
// used to repeat the page name in a same-size (or, for Pre-Inspections,
// even larger) <h1> of their own, and a tab inside a module (e.g. Sales
// Management's Analytics tab) matched that same size again - three
// same-weight titles stacked on one screen with no visual hierarchy
// between "page", "module" and "tab". SECTION_HEADER_STYLE/
// SECTION_SUBTITLE_STYLE is the one step below the page title that all of
// those should use instead, on a <h2> (the page title is the page's only
// <h1>).
const SECTION_HEADER_STYLE = { margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: '700', color: '#111827' };
const SECTION_SUBTITLE_STYLE = { margin: 0, color: '#6b7280', fontSize: '0.875rem' };

// Stat card system, shared the same way as the formatters/headings above.
//
// Every module's top-row summary tiles (Total Clients, Cash (USD), Total
// Sales, Total Inspections...) had drifted into four different styles:
// full gradient fills with a color-tinted shadow (ClientManagement,
// PreInspectionsList), full gradient fills with a flat gray shadow
// (AccountingDashboard), white cards with a colored left border and gray
// #666 text (the main Dashboard, App_COMPLETE.jsx), and white cards with a
// single fixed gold left border regardless of metric plus smaller,
// differently-sized type (QuoteManagement). ClientManagement's cards are
// the reference everything else now matches: full gradient, white text,
// 0.75rem radius, a shadow tinted to the card's own color.
//
// STAT_CARD_COLORS keys a named accent to its {gradient, shadow} pair -
// pick the same key for the same kind of metric across modules (e.g.
// 'blue' for a primary count, 'green' for USD money, 'purple' for MXN
// money, 'orange' for a rate/achievement metric, 'red' for something
// outstanding/owed) so a given color keeps one meaning system-wide rather
// than being reassigned per screen. statCardStyle(colorKey) returns the
// full card style; STAT_CARD_LABEL_STYLE/VALUE_STYLE/SUBTEXT_STYLE are the
// three text rows every card uses (label, big number, optional caption).
const STAT_CARD_COLORS = {
  blue:   { gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', shadow: 'rgba(59, 130, 246, 0.3)' },
  green:  { gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', shadow: 'rgba(16, 185, 129, 0.3)' },
  purple: { gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', shadow: 'rgba(139, 92, 246, 0.3)' },
  orange: { gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', shadow: 'rgba(245, 158, 11, 0.3)' },
  red:    { gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', shadow: 'rgba(239, 68, 68, 0.3)' },
  cyan:   { gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', shadow: 'rgba(6, 182, 212, 0.3)' },
  gray:   { gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)', shadow: 'rgba(107, 114, 128, 0.3)' }
};

function statCardStyle(colorKey) {
  const c = STAT_CARD_COLORS[colorKey] || STAT_CARD_COLORS.blue;
  return {
    padding: '1.5rem',
    background: c.gradient,
    borderRadius: '0.75rem',
    color: 'white',
    boxShadow: `0 4px 6px ${c.shadow}`
  };
}

const STAT_CARD_LABEL_STYLE = { fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' };
// A fixed 2rem worked for short values ("3", "9.5%") but let a longer one
// (a formatted currency amount, especially MXN's "MXN $900,000.00", or
// Pending Balance's combined "$X + MXN Y") run past the card's edge instead
// of shrinking to fit - the number visibly overflowed the gradient tile.
// statCardValueStyle(value) sizes the text to how long it actually is, and
// overflowWrap/wordBreak are the fallback for whatever's still too wide for
// even the smallest step. STAT_CARD_VALUE_STYLE stays as a fixed-2rem
// constant for the handful of callers that already know their value is
// always short (a plain count, a percentage).
//
// roomy=true bumps every step up one size. Only pass it for a card that
// (a) is at least ~250px wide and (b) only ever holds a single plain
// formatCurrency() value, never a concatenated "$X + MXN Y" string - e.g.
// Accounting Dashboard's cash cards, which read as too small once real
// (longer) balances pushed them into the default ladder's lower tiers.
// Sales' Pending Balance card needs the tighter default ladder since it
// can render exactly that concatenated string.
function statCardValueStyle(value, roomy) {
  const len = String(value == null ? '' : value).length;
  if (roomy) {
    let fontSize = '2.25rem';
    if (len > 18) fontSize = '1.25rem';
    else if (len > 14) fontSize = '1.5rem';
    else if (len > 11) fontSize = '1.75rem';
    else if (len > 8) fontSize = '2rem';
    return { fontSize, fontWeight: '800', overflowWrap: 'break-word', wordBreak: 'break-word' };
  }
  let fontSize = '2rem';
  if (len > 16) fontSize = '1rem';
  else if (len > 12) fontSize = '1.25rem';
  else if (len > 9) fontSize = '1.5rem';
  else if (len > 6) fontSize = '1.75rem';
  return { fontSize, fontWeight: '800', overflowWrap: 'break-word', wordBreak: 'break-word' };
}
const STAT_CARD_VALUE_STYLE = { fontSize: '2rem', fontWeight: '800', overflowWrap: 'break-word', wordBreak: 'break-word' };
const STAT_CARD_SUBTEXT_STYLE = { fontSize: '0.75rem', opacity: 0.8, marginTop: '0.5rem' };

// Button system, shared the same way as the card/heading/formatter
// constants above. QuoteManagement's buttons were the reference picked:
// flat solid colors (no gradients), one radius for regular buttons
// (0.5rem) and a smaller one for compact row-actions (0.3rem), colors
// assigned by what the action means rather than per-screen taste. Every
// other module had its own mix instead - full gradient fills on primary
// actions (Record Transaction, Apply Filters, Distribute Profit, every
// Quick Action in Accounting), different radii (4px/6px/8px/0.375rem
// alongside Quotes' 0.5rem/0.3rem), and gradients even on a disabled
// button's own "disabled" gray.
//
// BUTTON_COLORS keys a named color to its {bg, fg, border} - border is
// only set for the outline variant. buttonStyle(colorKey, size, disabled)
// returns the full button style; size is 'md' (default, primary/toolbar
// buttons) or 'sm' (compact row-actions, matching Quotes' table buttons).
// A disabled button always renders as flat gray regardless of colorKey,
// same convention already used for "Recording…"/"Saving…" submit buttons.
const BUTTON_COLORS = {
  primary: { bg: '#FFD700', fg: '#1a1a1a' },  // brand CTA - "New X" creates
  dark:    { bg: '#1a1a1a', fg: 'white' },
  blue:    { bg: '#2563eb', fg: 'white' },
  green:   { bg: '#059669', fg: 'white' },
  red:     { bg: '#dc2626', fg: 'white' },     // solid danger - permanent/high-stakes
  redSoft: { bg: '#fee2e2', fg: '#991b1b' },   // soft danger - reversible/lower-stakes
  gray:    { bg: '#f3f4f6', fg: '#374151' },
  outline: { bg: 'white', fg: '#374151', border: '#d1d5db' }
};
const BUTTON_SIZES = {
  md: { padding: '0.75rem 1.5rem', fontSize: '0.875rem', borderRadius: '0.5rem' },
  sm: { padding: '0.35rem 0.7rem', fontSize: '0.75rem', borderRadius: '0.3rem' }
};
function buttonStyle(colorKey, size, disabled) {
  if (disabled) {
    const s = BUTTON_SIZES[size] || BUTTON_SIZES.md;
    return { ...s, background: '#9ca3af', color: 'white', border: 'none', fontWeight: '700', cursor: 'not-allowed' };
  }
  const c = BUTTON_COLORS[colorKey] || BUTTON_COLORS.gray;
  const s = BUTTON_SIZES[size] || BUTTON_SIZES.md;
  return {
    ...s,
    background: c.bg,
    color: c.fg,
    border: c.border ? `1px solid ${c.border}` : 'none',
    fontWeight: '700',
    cursor: 'pointer'
  };
}
