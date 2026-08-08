// TransactionJournal.jsx - General Journal (Industry Standard Format)
// Loads accounts separately for reliable type lookups

const TransactionJournal = ({ isOpen, onClose }) => {
  var _s = React.useState, _e = React.useEffect;
  var _ts = _s([]), transactions = _ts[0], setTransactions = _ts[1];
  var _as = _s({}), accountMap = _as[0], setAccountMap = _as[1];
  var _ls = _s(false), loading = _ls[0], setLoading = _ls[1];
  var _es = _s(''), error = _es[0], setError = _es[1];
  var _fs = _s({
    start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reference_type: ''
  }), filters = _fs[0], setFilters = _fs[1];

  var API_URL = window.API_BASE_URL ? window.API_BASE_URL + '/api' : 'https://buses-america.onrender.com/api';

  _e(function() {
    if (isOpen) { loadAccounts(); loadTransactions(); }
  }, [isOpen]);

  var loadAccounts = function() {
    var token = localStorage.getItem('session_token');
    fetch(API_URL + '/accounting/accounts', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(data) {
      var map = {};
      (data || []).forEach(function(a) {
        map[a.account_id] = { type: a.account_type, subtype: a.account_subtype, name: a.account_name };
      });
      setAccountMap(map);
    })
    .catch(function() {});
  };

  var loadTransactions = function() {
    setLoading(true); setError('');
    var token = localStorage.getItem('session_token');
    var params = new URLSearchParams({ limit: '500' });
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.reference_type) params.append('reference_type', filters.reference_type);
    fetch(API_URL + '/accounting/transactions?' + params, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(r) { return r.ok ? r.json() : Promise.reject('Failed to load'); })
    .then(function(data) {
      var norm = (data || []).map(function(t) {
        var lines = t.lines;
        if (typeof lines === 'string') { try { lines = JSON.parse(lines); } catch(e) { lines = []; } }
        if (!Array.isArray(lines)) lines = [];
        lines = lines.filter(function(l) { return l != null && typeof l === 'object'; });
        lines.sort(function(a, b) { return parseFloat(b.debit_amount || 0) - parseFloat(a.debit_amount || 0); });
        return Object.assign({}, t, { lines: lines });
      });
      setTransactions(norm); setLoading(false);
    })
    .catch(function(err) { setError(String(err)); setLoading(false); });
  };

  var sf = function(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };
  var fc = function(amt, cur) {
    var n = sf(amt); if (n === 0) return '';
    var f = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
    return (cur === 'MXN' ? 'MX$' : '$') + f;
  };
  var fd = function(ds) {
    if (!ds) return '';
    try {
      var s = String(ds).split('T')[0].split('-');
      if (s.length !== 3) return String(ds);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[parseInt(s[1])-1] + ' ' + parseInt(s[2]) + ', ' + s[0];
    } catch(e) { return String(ds); }
  };

  // Look up account type from the separately loaded accounts map
  var getAccountType = function(line) {
    // First try the map (most reliable — comes directly from accounts table)
    var acctId = line.account_id;
    if (accountMap[acctId]) return accountMap[acctId].type;
    // Fallback to json_build_object data
    if (line.account_type) return line.account_type;
    return null;
  };

  var getAccountTypeLabel = function(type) {
    if (type === 'Asset') return 'ASSET';
    if (type === 'Expense') return 'EXPENSE';
    if (type === 'Income') return 'REVENUE';
    if (type === 'Equity') return 'EQUITY';
    if (type === 'Liability') return 'LIABILITY';
    return '';
  };

  // Effect: does this line increase or decrease the account?
  var getEffect = function(type, debit, credit) {
    var d = sf(debit), c = sf(credit);
    // Assets & Expenses are "debit-normal" — debits increase them
    var isDebitNormal = (type === 'Asset' || type === 'Expense');
    if (d > 0) return isDebitNormal ? 'increase' : 'decrease';
    if (c > 0) return isDebitNormal ? 'decrease' : 'increase';
    return 'neutral';
  };

  var typeLabels = {
    sale: 'Sale', cogs: 'COGS', purchase: 'Purchase', cost: 'Cost',
    payment: 'Payment Received', distribution: 'Profit Distribution',
    distribution_payout: 'Distribution Payout', deposit: 'Deposit',
    expense: 'Expense', transfer: 'Transfer', exchange: 'Currency Exchange'
  };

  if (!isOpen) return null;

  var totD = { USD: 0, MXN: 0 }, totC = { USD: 0, MXN: 0 };
  transactions.forEach(function(t) {
    (t.lines || []).forEach(function(l) {
      var c = (l && l.currency) || 'USD';
      totD[c] = (totD[c] || 0) + sf(l.debit_amount);
      totC[c] = (totC[c] || 0) + sf(l.credit_amount);
    });
  });

  var h = React.createElement;

  return h('div', { style: { position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem' } },
    h('div', { style: { background:'white',borderRadius:'0.75rem',maxWidth:'960px',width:'100%',maxHeight:'95vh',display:'flex',flexDirection:'column',boxShadow:'0 25px 50px rgba(0,0,0,0.15)' } },

      // Header
      h('div', { style: { padding:'1.25rem 2rem',borderBottom:'2px solid #111827',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0 } },
        h('div', null,
          h('h2', { style: { margin:0,fontSize:'1.1rem',fontWeight:'700',color:'#111827',letterSpacing:'-0.01em' } }, 'GENERAL JOURNAL'),
          h('div', { style: { fontSize:'0.75rem',color:'#6b7280',marginTop:'0.25rem' } }, 'Buses America \u2014 All Transactions')
        ),
        h('button', { onClick:onClose, style: { padding:'0.5rem',background:'transparent',border:'none',fontSize:'1.25rem',cursor:'pointer',color:'#6b7280' } }, '\u2715')
      ),

      // Legend
      h('div', { style: { padding:'0.5rem 2rem',borderBottom:'1px solid #e5e7eb',background:'#f9fafb',display:'flex',gap:'1.5rem',alignItems:'center',flexShrink:0,fontSize:'0.7rem',color:'#6b7280' } },
        h('span', { style: { fontWeight:'600' } }, 'Effect:'),
        h('span', { style: { display:'flex',alignItems:'center',gap:'0.25rem' } },
          h('span', { style: { color:'#059669',fontSize:'0.6rem' } }, '\u25B2'), 'Increases account'),
        h('span', { style: { display:'flex',alignItems:'center',gap:'0.25rem' } },
          h('span', { style: { color:'#dc2626',fontSize:'0.6rem' } }, '\u25BC'), 'Decreases account'),
        h('span', { style: { borderLeft:'1px solid #d1d5db',paddingLeft:'1rem',fontStyle:'italic' } }, 'Indented = credits')
      ),

      // Filters
      h('div', { style: { padding:'0.75rem 2rem',borderBottom:'1px solid #e5e7eb',display:'flex',gap:'1rem',flexWrap:'wrap',alignItems:'flex-end',flexShrink:0 } },
        h('div', null,
          h('label', { style: { display:'block',fontSize:'0.65rem',fontWeight:'700',color:'#9ca3af',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.05em' } }, 'From'),
          h('input', { type:'date',value:filters.start_date,onChange:function(e){setFilters(Object.assign({},filters,{start_date:e.target.value}))},style:{padding:'0.35rem 0.5rem',border:'1px solid #d1d5db',borderRadius:'0.25rem',fontSize:'0.8rem'} })
        ),
        h('div', null,
          h('label', { style: { display:'block',fontSize:'0.65rem',fontWeight:'700',color:'#9ca3af',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.05em' } }, 'To'),
          h('input', { type:'date',value:filters.end_date,onChange:function(e){setFilters(Object.assign({},filters,{end_date:e.target.value}))},style:{padding:'0.35rem 0.5rem',border:'1px solid #d1d5db',borderRadius:'0.25rem',fontSize:'0.8rem'} })
        ),
        h('div', null,
          h('label', { style: { display:'block',fontSize:'0.65rem',fontWeight:'700',color:'#9ca3af',marginBottom:'0.2rem',textTransform:'uppercase',letterSpacing:'0.05em' } }, 'Type'),
          h('select', { value:filters.reference_type,onChange:function(e){setFilters(Object.assign({},filters,{reference_type:e.target.value}))},style:{padding:'0.35rem 0.5rem',border:'1px solid #d1d5db',borderRadius:'0.25rem',fontSize:'0.8rem'} },
            h('option',{value:''},'All'), h('option',{value:'sale'},'Sales'), h('option',{value:'cogs'},'COGS'),
            h('option',{value:'purchase'},'Purchases'), h('option',{value:'cost'},'Costs'),
            h('option',{value:'payment'},'Payments'), h('option',{value:'distribution'},'Distributions'),
            h('option',{value:'distribution_payout'},'Payouts'), h('option',{value:'exchange'},'Exchanges'),
            h('option',{value:'deposit'},'Deposits'), h('option',{value:'expense'},'Expenses'),
            h('option',{value:'transfer'},'Transfers')
          )
        ),
        h('button', { onClick:function(){loadAccounts();loadTransactions();}, style:{padding:'0.35rem 1rem',background:'#111827',color:'white',border:'none',borderRadius:'0.25rem',fontSize:'0.8rem',fontWeight:'600',cursor:'pointer'} }, 'Run Report'),
        h('div', { style:{marginLeft:'auto',fontSize:'0.8rem',color:'#6b7280',fontWeight:'600'} }, transactions.length + ' entries')
      ),

      // Content
      h('div', { style: { flex:1,overflow:'auto',padding:'0 2rem 2rem 2rem' } },
        loading
          ? h('div', { style:{padding:'3rem',textAlign:'center',color:'#6b7280'} }, 'Loading...')
          : error
            ? h('div', { style:{padding:'2rem',textAlign:'center',color:'#991b1b'} }, error)
            : transactions.length === 0
              ? h('div', { style:{padding:'3rem',textAlign:'center',color:'#6b7280'} }, 'No entries found.')
              : h('table', { style:{width:'100%',borderCollapse:'collapse',marginTop:'1rem'} },
                  h('thead', null,
                    h('tr', { style:{borderBottom:'2px solid #111827'} },
                      h('th', { style:{padding:'0.5rem 0',textAlign:'left',fontSize:'0.65rem',fontWeight:'700',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',width:'90px'} }, 'DATE'),
                      h('th', { style:{padding:'0.5rem 0',textAlign:'left',fontSize:'0.65rem',fontWeight:'700',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em'} }, 'ACCOUNT'),
                      h('th', { style:{padding:'0.5rem 0',textAlign:'center',fontSize:'0.65rem',fontWeight:'700',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',width:'30px'} }, ''),
                      h('th', { style:{padding:'0.5rem 0',textAlign:'right',fontSize:'0.65rem',fontWeight:'700',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',width:'130px'} }, 'DEBIT'),
                      h('th', { style:{padding:'0.5rem 0',textAlign:'right',fontSize:'0.65rem',fontWeight:'700',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.05em',width:'130px'} }, 'CREDIT')
                    )
                  ),
                  h('tbody', null,
                    transactions.map(function(t) {
                      var lines = t.lines || [];
                      var rows = [];
                      var typeLabel = typeLabels[t.reference_type] || t.reference_type || 'Entry';

                      lines.forEach(function(line, lIdx) {
                        var debit = sf(line.debit_amount);
                        var credit = sf(line.credit_amount);
                        var isCredit = credit > 0 && debit === 0;

                        // Get account type from the reliable lookup map
                        var acctType = getAccountType(line);
                        var acctTypeLabel = getAccountTypeLabel(acctType);
                        var effect = getEffect(acctType, line.debit_amount, line.credit_amount);

                        var arrowColor = effect === 'increase' ? '#059669' : effect === 'decrease' ? '#dc2626' : '#9ca3af';
                        var arrowSymbol = effect === 'increase' ? '\u25B2' : effect === 'decrease' ? '\u25BC' : '';

                        rows.push(
                          h('tr', { key:'t'+t.transaction_id+'l'+lIdx, style:{borderBottom:'none'} },
                            h('td', { style:{padding:'0.2rem 0',fontSize:'0.8rem',color:'#374151',verticalAlign:'top',whiteSpace:'nowrap'} },
                              lIdx === 0 ? fd(t.transaction_date) : ''
                            ),
                            h('td', { style:{padding:'0.2rem 0',paddingLeft:isCredit?'2rem':'0'} },
                              h('div', { style:{fontSize:'0.85rem',color:'#111827',fontWeight:'500'} }, line.account_name || ''),
                              h('div', { style:{fontSize:'0.6rem',color:'#9ca3af',marginTop:'0.05rem',letterSpacing:'0.03em'} },
                                acctTypeLabel + (acctTypeLabel && line.currency ? ' \u00B7 ' : '') + (line.currency || '')
                              ),
                              line.notes ? h('div', { style:{fontSize:'0.7rem',color:'#6b7280',marginTop:'0.1rem',fontStyle:'italic'} }, line.notes) : null
                            ),
                            h('td', { style:{padding:'0.2rem 0',textAlign:'center',verticalAlign:'top',paddingTop:'0.3rem'} },
                              h('span', { style:{fontSize:'0.55rem',color:arrowColor,fontWeight:'700'} }, arrowSymbol)
                            ),
                            h('td', { style:{padding:'0.2rem 0',textAlign:'right',fontSize:'0.85rem',color:debit>0?'#111827':'transparent',fontWeight:debit>0?'600':'400',verticalAlign:'top'} },
                              debit > 0 ? fc(debit, line.currency) : ''
                            ),
                            h('td', { style:{padding:'0.2rem 0',textAlign:'right',fontSize:'0.85rem',color:credit>0?'#111827':'transparent',fontWeight:credit>0?'600':'400',verticalAlign:'top'} },
                              credit > 0 ? fc(credit, line.currency) : ''
                            )
                          )
                        );
                      });

                      rows.push(
                        h('tr', { key:'t'+t.transaction_id+'m', style:{borderBottom:'none'} },
                          h('td', null, ''),
                          h('td', { colSpan:4, style:{padding:'0.15rem 0',paddingLeft:'1rem',fontSize:'0.7rem',color:'#9ca3af',fontStyle:'italic',paddingBottom:'0.75rem'} },
                            typeLabel + ' \u2014 ' + (t.description || '')
                          )
                        )
                      );

                      rows.push(
                        h('tr', { key:'t'+t.transaction_id+'s' },
                          h('td', { colSpan:5, style:{padding:0,borderBottom:'1px solid #e5e7eb'} })
                        )
                      );

                      return rows;
                    }).flat()
                  )
                )
      ),

      // Footer — Trial Balance Summary
      (function() {
        var usdBal = Math.abs(totD.USD - totC.USD) < 0.01;
        var mxnBal = Math.abs(totD.MXN - totC.MXN) < 0.01;
        var bothBal = usdBal && mxnBal;
        var hasExchange = !usdBal || !mxnBal;

        return h('div', { style:{borderTop:'2px solid #111827',background:'#fafafa',flexShrink:0} },
          // Totals table
          h('div', { style:{padding:'0.75rem 2rem'} },
            h('table', { style:{width:'100%',borderCollapse:'collapse',fontSize:'0.75rem',fontFamily:'monospace'} },
              h('thead', null,
                h('tr', { style:{borderBottom:'1px solid #d1d5db'} },
                  h('th', { style:{textAlign:'left',padding:'0.25rem 0',color:'#6b7280',fontWeight:'600',fontSize:'0.65rem',textTransform:'uppercase',letterSpacing:'0.05em'} }, 'Currency'),
                  h('th', { style:{textAlign:'right',padding:'0.25rem 0',color:'#6b7280',fontWeight:'600',fontSize:'0.65rem',textTransform:'uppercase',letterSpacing:'0.05em'} }, 'Total Debits'),
                  h('th', { style:{textAlign:'right',padding:'0.25rem 0',color:'#6b7280',fontWeight:'600',fontSize:'0.65rem',textTransform:'uppercase',letterSpacing:'0.05em'} }, 'Total Credits'),
                  h('th', { style:{textAlign:'right',padding:'0.25rem 0',color:'#6b7280',fontWeight:'600',fontSize:'0.65rem',textTransform:'uppercase',letterSpacing:'0.05em'} }, 'Difference')
                )
              ),
              h('tbody', null,
                h('tr', null,
                  h('td', { style:{padding:'0.25rem 0',fontWeight:'600'} }, 'USD'),
                  h('td', { style:{padding:'0.25rem 0',textAlign:'right'} }, '$' + totD.USD.toLocaleString('en-US',{minimumFractionDigits:2})),
                  h('td', { style:{padding:'0.25rem 0',textAlign:'right'} }, '$' + totC.USD.toLocaleString('en-US',{minimumFractionDigits:2})),
                  h('td', { style:{padding:'0.25rem 0',textAlign:'right',color: usdBal ? '#059669' : '#6b7280',fontWeight:'600'} },
                    usdBal ? 'Balanced' : '$' + (totD.USD - totC.USD).toLocaleString('en-US',{minimumFractionDigits:2})
                  )
                ),
                h('tr', { style:{borderBottom:'1px solid #d1d5db'} },
                  h('td', { style:{padding:'0.25rem 0',fontWeight:'600'} }, 'MXN'),
                  h('td', { style:{padding:'0.25rem 0',textAlign:'right'} }, 'MX$' + totD.MXN.toLocaleString('en-US',{minimumFractionDigits:2})),
                  h('td', { style:{padding:'0.25rem 0',textAlign:'right'} }, 'MX$' + totC.MXN.toLocaleString('en-US',{minimumFractionDigits:2})),
                  h('td', { style:{padding:'0.25rem 0',textAlign:'right',color: mxnBal ? '#059669' : '#6b7280',fontWeight:'600'} },
                    mxnBal ? 'Balanced' : 'MX$' + (totD.MXN - totC.MXN).toLocaleString('en-US',{minimumFractionDigits:2})
                  )
                )
              )
            )
          ),
          // Status bar
          h('div', { style:{padding:'0.5rem 2rem',borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'0.7rem'} },
            h('div', { style:{color:'#6b7280'} }, transactions.length + ' journal entries'),
            bothBal
              ? h('div', { style:{color:'#059669',fontWeight:'600'} }, '\u2713 All currencies balanced')
              : h('div', { style:{color:'#6b7280',fontStyle:'italic'} }, 'Per-currency differences are expected when cross-currency transactions (exchanges) are present.')
          )
        );
      })()
    )
  );
};

window.TransactionJournal = TransactionJournal;
