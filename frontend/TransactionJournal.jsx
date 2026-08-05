// TransactionJournal.jsx - General Journal (Industry Standard Format)

const TransactionJournal = ({ isOpen, onClose }) => {
  const [transactions, setTransactions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [filters, setFilters] = React.useState({
    start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reference_type: ''
  });

  var API_URL = window.API_BASE_URL ? window.API_BASE_URL + '/api' : 'https://buses-america.onrender.com/api';

  React.useEffect(function() {
    if (isOpen) loadTransactions();
  }, [isOpen]);

  var loadTransactions = function() {
    setLoading(true);
    setError('');
    var token = localStorage.getItem('session_token');
    var params = new URLSearchParams({ limit: '500' });
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.reference_type) params.append('reference_type', filters.reference_type);

    fetch(API_URL + '/accounting/transactions?' + params, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) { return res.ok ? res.json() : Promise.reject('Failed to load'); })
    .then(function(data) {
      var normalized = (data || []).map(function(t) {
        var lines = t.lines;
        if (typeof lines === 'string') { try { lines = JSON.parse(lines); } catch(e) { lines = []; } }
        if (!Array.isArray(lines)) lines = [];
        lines = lines.filter(function(l) { return l != null && typeof l === 'object'; });
        // Sort: debits first, then credits
        lines.sort(function(a, b) {
          var aDebit = parseFloat(a.debit_amount || 0);
          var bDebit = parseFloat(b.debit_amount || 0);
          return bDebit - aDebit; // Higher debits first
        });
        return Object.assign({}, t, { lines: lines });
      });
      setTransactions(normalized);
      setLoading(false);
    })
    .catch(function(err) {
      setError(String(err));
      setLoading(false);
    });
  };

  var sf = function(val) { var n = parseFloat(val); return isNaN(n) ? 0 : n; };

  var fc = function(amount, currency) {
    var n = sf(amount);
    if (n === 0) return '';
    var f = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
    return (currency === 'MXN' ? 'MX$' : '$') + f;
  };

  var fd = function(dateStr) {
    if (!dateStr) return '';
    try {
      var s = String(dateStr).split('T')[0];
      var p = s.split('-');
      if (p.length !== 3) return s;
      var d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    } catch(e) { return String(dateStr); }
  };

  var typeLabels = {
    sale: 'Sale', cogs: 'COGS', purchase: 'Purchase', cost: 'Cost',
    payment: 'Payment Received', distribution: 'Profit Distribution',
    distribution_payout: 'Distribution Payout', deposit: 'Deposit',
    expense: 'Expense', transfer: 'Transfer', exchange: 'Currency Exchange'
  };

  if (!isOpen) return null;

  // Totals
  var totD = { USD: 0, MXN: 0 }, totC = { USD: 0, MXN: 0 };
  transactions.forEach(function(t) {
    (t.lines || []).forEach(function(l) {
      var c = (l && l.currency) || 'USD';
      totD[c] = (totD[c] || 0) + sf(l.debit_amount);
      totC[c] = (totC[c] || 0) + sf(l.credit_amount);
    });
  });

  var h = React.createElement;

  // Styles
  var overlay = { position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem' };
  var modal = { background:'white',borderRadius:'0.75rem',maxWidth:'900px',width:'100%',maxHeight:'95vh',display:'flex',flexDirection:'column',boxShadow:'0 25px 50px rgba(0,0,0,0.15)' };
  var headerStyle = { padding:'1.25rem 2rem',borderBottom:'2px solid #111827',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0 };
  var filterBar = { padding:'1rem 2rem',borderBottom:'1px solid #e5e7eb',display:'flex',gap:'1rem',flexWrap:'wrap',alignItems:'flex-end',flexShrink:0,background:'#fafafa' };
  var content = { flex:1,overflow:'auto',padding:'0 2rem 2rem 2rem' };
  var footerStyle = { padding:'1rem 2rem',borderTop:'2px solid #111827',background:'#fafafa',flexShrink:0,fontSize:'0.8rem',color:'#374151',display:'flex',justifyContent:'space-between' };

  var filterLabel = { display:'block',fontSize:'0.7rem',fontWeight:'700',color:'#6b7280',marginBottom:'0.25rem',textTransform:'uppercase',letterSpacing:'0.05em' };
  var filterInput = { padding:'0.4rem 0.5rem',border:'1px solid #d1d5db',borderRadius:'0.25rem',fontSize:'0.85rem' };

  return h('div', { style: overlay },
    h('div', { style: modal },

      // Header
      h('div', { style: headerStyle },
        h('div', null,
          h('h2', { style: { margin:0,fontSize:'1.1rem',fontWeight:'700',color:'#111827',letterSpacing:'-0.01em' } }, 'GENERAL JOURNAL'),
          h('div', { style: { fontSize:'0.75rem',color:'#6b7280',marginTop:'0.25rem' } }, 'Buses America \u2014 All Transactions')
        ),
        h('button', { onClick: onClose, style: { padding:'0.5rem',background:'transparent',border:'none',fontSize:'1.25rem',cursor:'pointer',color:'#6b7280' } }, '\u2715')
      ),

      // Filters
      h('div', { style: filterBar },
        h('div', null,
          h('label', { style: filterLabel }, 'Period Start'),
          h('input', { type:'date', value:filters.start_date, onChange:function(e){setFilters(Object.assign({},filters,{start_date:e.target.value}))}, style:filterInput })
        ),
        h('div', null,
          h('label', { style: filterLabel }, 'Period End'),
          h('input', { type:'date', value:filters.end_date, onChange:function(e){setFilters(Object.assign({},filters,{end_date:e.target.value}))}, style:filterInput })
        ),
        h('div', null,
          h('label', { style: filterLabel }, 'Type'),
          h('select', { value:filters.reference_type, onChange:function(e){setFilters(Object.assign({},filters,{reference_type:e.target.value}))}, style:filterInput },
            h('option', { value:'' }, 'All'),
            h('option', { value:'sale' }, 'Sales'),
            h('option', { value:'cogs' }, 'COGS'),
            h('option', { value:'purchase' }, 'Purchases'),
            h('option', { value:'cost' }, 'Costs'),
            h('option', { value:'payment' }, 'Payments'),
            h('option', { value:'distribution' }, 'Distributions'),
            h('option', { value:'distribution_payout' }, 'Payouts'),
            h('option', { value:'exchange' }, 'Exchanges'),
            h('option', { value:'deposit' }, 'Deposits'),
            h('option', { value:'expense' }, 'Expenses'),
            h('option', { value:'transfer' }, 'Transfers')
          )
        ),
        h('button', { onClick:loadTransactions, style: { padding:'0.4rem 1rem',background:'#111827',color:'white',border:'none',borderRadius:'0.25rem',fontSize:'0.8rem',fontWeight:'600',cursor:'pointer' } }, 'Run Report'),
        h('div', { style: { marginLeft:'auto',fontSize:'0.8rem',color:'#6b7280',fontWeight:'600' } }, transactions.length + ' entries')
      ),

      // Content
      h('div', { style: content },
        loading
          ? h('div', { style: { padding:'3rem',textAlign:'center',color:'#6b7280' } }, 'Loading...')
          : error
            ? h('div', { style: { padding:'2rem',textAlign:'center',color:'#991b1b' } }, error)
            : transactions.length === 0
              ? h('div', { style: { padding:'3rem',textAlign:'center',color:'#6b7280' } }, 'No entries found for this period.')
              : h('div', null,

                  // Column headers
                  h('table', { style: { width:'100%',borderCollapse:'collapse',marginTop:'1.5rem' } },
                    h('thead', null,
                      h('tr', { style: { borderBottom:'2px solid #111827' } },
                        h('th', { style: { padding:'0.5rem 0',textAlign:'left',fontSize:'0.7rem',fontWeight:'700',color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',width:'90px' } }, 'DATE'),
                        h('th', { style: { padding:'0.5rem 0',textAlign:'left',fontSize:'0.7rem',fontWeight:'700',color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em' } }, 'ACCOUNT / DESCRIPTION'),
                        h('th', { style: { padding:'0.5rem 1rem',textAlign:'left',fontSize:'0.7rem',fontWeight:'700',color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',width:'50px' } }, 'CUR'),
                        h('th', { style: { padding:'0.5rem 0',textAlign:'right',fontSize:'0.7rem',fontWeight:'700',color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',width:'120px' } }, 'DEBIT'),
                        h('th', { style: { padding:'0.5rem 0',textAlign:'right',fontSize:'0.7rem',fontWeight:'700',color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',width:'120px' } }, 'CREDIT')
                      )
                    ),
                    h('tbody', null,
                      transactions.map(function(t, tIdx) {
                        var lines = t.lines || [];
                        var rows = [];
                        var typeLabel = typeLabels[t.reference_type] || t.reference_type || 'Entry';

                        // Each line gets a row
                        lines.forEach(function(line, lIdx) {
                          var debit = sf(line.debit_amount);
                          var credit = sf(line.credit_amount);
                          var isCredit = credit > 0 && debit === 0;
                          var accountName = line.account_name || '';

                          rows.push(
                            h('tr', { key: 't' + t.transaction_id + 'l' + lIdx, style: { borderBottom:'none' } },
                              // Date - only on first line
                              h('td', { style: { padding:'0.15rem 0',fontSize:'0.85rem',color:'#374151',verticalAlign:'top',whiteSpace:'nowrap' } },
                                lIdx === 0 ? fd(t.transaction_date) : ''
                              ),
                              // Account name - credits indented
                              h('td', { style: { padding:'0.15rem 0',paddingLeft: isCredit ? '2rem' : '0',fontSize:'0.85rem',color:'#111827',fontWeight:'500' } },
                                accountName
                              ),
                              // Currency
                              h('td', { style: { padding:'0.15rem 1rem',fontSize:'0.75rem',color:'#9ca3af',verticalAlign:'top' } },
                                line.currency || ''
                              ),
                              // Debit
                              h('td', { style: { padding:'0.15rem 0',textAlign:'right',fontSize:'0.85rem',color:'#111827',fontWeight: debit > 0 ? '600' : '400' } },
                                debit > 0 ? fc(debit, line.currency) : ''
                              ),
                              // Credit
                              h('td', { style: { padding:'0.15rem 0',textAlign:'right',fontSize:'0.85rem',color:'#111827',fontWeight: credit > 0 ? '600' : '400' } },
                                credit > 0 ? fc(credit, line.currency) : ''
                              )
                            )
                          );
                        });

                        // Description/memo row
                        rows.push(
                          h('tr', { key: 't' + t.transaction_id + 'desc', style: { borderBottom:'none' } },
                            h('td', null, ''),
                            h('td', { colSpan:4, style: { padding:'0.15rem 0',paddingLeft:'1rem',fontSize:'0.75rem',color:'#6b7280',fontStyle:'italic',paddingBottom:'0.75rem' } },
                              typeLabel + ' \u2014 ' + (t.description || '') + (t.reference_number ? ' (Ref: ' + t.reference_number + ')' : '')
                            )
                          )
                        );

                        // Separator line between entries
                        rows.push(
                          h('tr', { key: 't' + t.transaction_id + 'sep' },
                            h('td', { colSpan:5, style: { padding:0, borderBottom:'1px solid #e5e7eb' } })
                          )
                        );

                        return rows;
                      }).flat()
                    )
                  )
                )
      ),

      // Footer
      h('div', { style: footerStyle },
        h('div', null, transactions.length + ' journal entries'),
        h('div', { style: { display:'flex',gap:'2rem',fontFamily:'monospace' } },
          h('div', null,
            h('span', { style: { color:'#6b7280' } }, 'USD: '),
            h('span', { style: { fontWeight:'600' } }, '$' + totD.USD.toLocaleString('en-US',{minimumFractionDigits:2})),
            h('span', { style: { color:'#9ca3af',margin:'0 0.25rem' } }, '/'),
            h('span', { style: { fontWeight:'600' } }, '$' + totC.USD.toLocaleString('en-US',{minimumFractionDigits:2}))
          ),
          h('div', null,
            h('span', { style: { color:'#6b7280' } }, 'MXN: '),
            h('span', { style: { fontWeight:'600' } }, 'MX$' + totD.MXN.toLocaleString('en-US',{minimumFractionDigits:2})),
            h('span', { style: { color:'#9ca3af',margin:'0 0.25rem' } }, '/'),
            h('span', { style: { fontWeight:'600' } }, 'MX$' + totC.MXN.toLocaleString('en-US',{minimumFractionDigits:2}))
          )
        )
      )
    )
  );
};

window.TransactionJournal = TransactionJournal;
