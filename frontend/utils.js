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
