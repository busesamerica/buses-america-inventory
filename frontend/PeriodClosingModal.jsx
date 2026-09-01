// PeriodClosingModal.jsx — Period Closing with FX Revaluation

const PeriodClosingModal = ({ isOpen, onClose, onComplete }) => {
  var _s = React.useState;
  var _pcs = _s([]), closings = _pcs[0], setClosings = _pcs[1];
  var _ls = _s(false), loading = _ls[0], setLoading = _ls[1];
  var _ss = _s(false), saving = _ss[0], setSaving = _ss[1];
  var _es = _s(''), error = _es[0], setError = _es[1];
  var _rs = _s(null), result = _rs[0], setResult = _rs[1];
  var _fs = _s({
    period_start: '',
    period_end: '',
    notes: ''
  }), form = _fs[0], setForm = _fs[1];

  var API_URL = window.API_BASE_URL ? window.API_BASE_URL + '/api' : 'https://buses-america.onrender.com/api';

  React.useEffect(function() {
    if (isOpen) { loadClosings(); loadLastDate(); }
  }, [isOpen]);

  var loadClosings = function() {
    setLoading(true);
    var token = localStorage.getItem('session_token');
    fetch(API_URL + '/accounting/period-closings', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(data) { setClosings(data || []); setLoading(false); })
    .catch(function() { setLoading(false); });
  };

  var loadLastDate = function() {
    var token = localStorage.getItem('session_token');
    fetch(API_URL + '/accounting/last-closing-date', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(r) { return r.ok ? r.json() : {}; })
    .then(function(data) {
      if (data.last_closing_date) {
        var lastDate = new Date(data.last_closing_date + 'T00:00:00');
        lastDate.setDate(lastDate.getDate() + 1);
        var nextStart = lastDate.toISOString().split('T')[0];
        setForm(function(f) { return Object.assign({}, f, { period_start: nextStart }); });
      } else {
        setForm(function(f) { return Object.assign({}, f, { period_start: '2026-01-01' }); });
      }
    })
    .catch(function() {});
  };

  var handleClose = function() {
    if (!form.period_start || !form.period_end) {
      setError('Please select both start and end dates');
      return;
    }
    if (form.period_end >= new Date().toISOString().split('T')[0]) {
      setError('Cannot close a period that has not ended yet');
      return;
    }
    if (!window.confirm('Close period ' + form.period_start + ' to ' + form.period_end + '?\n\nThis will:\n- Close all income/expense accounts to Retained Earnings\n- Create FX revaluation entry\n- Lock the period from edits\n\nThis action cannot be undone.')) {
      return;
    }
    setSaving(true);
    setError('');
    setResult(null);
    var token = localStorage.getItem('session_token');
    fetch(API_URL + '/accounting/period-close', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    .then(function(r) {
      if (r.ok) return r.json();
      return r.json().then(function(err) { throw new Error(err.detail || 'Failed to close period'); });
    })
    .then(function(data) {
      setResult(data);
      loadClosings();
      if (onComplete) onComplete();
    })
    .catch(function(err) {
      setError(err.message);
    })
    .finally(function() { setSaving(false); });
  };

  if (!isOpen) return null;

  var h = React.createElement;

  return h('div', { style: { position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem' } },
    h('div', { style: { background:'white',borderRadius:'0.75rem',maxWidth:'650px',width:'100%',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 25px rgba(0,0,0,0.15)' } },

      // Header
      h('div', { style: { padding:'1.25rem 1.5rem',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center' } },
        h('h2', { style: { margin:0,fontSize:'1.1rem',fontWeight:'700',color:'#111827' } }, '\uD83D\uDD12 Period Closing'),
        h('button', { onClick:onClose, style: { background:'transparent',border:'none',fontSize:'1.25rem',cursor:'pointer',color:'#6b7280' } }, '\u2715')
      ),

      // Past Closings
      h('div', { style: { padding:'1.5rem',borderBottom:'1px solid #e5e7eb' } },
        h('div', { style: { fontSize:'0.85rem',fontWeight:'600',color:'#374151',marginBottom:'0.75rem' } }, 'Closed Periods'),
        closings.length === 0
          ? h('div', { style: { color:'#9ca3af',fontSize:'0.85rem',fontStyle:'italic' } }, 'No periods closed yet')
          : h('table', { style: { width:'100%',borderCollapse:'collapse',fontSize:'0.8rem' } },
              h('thead', null,
                h('tr', { style: { borderBottom:'1px solid #e5e7eb' } },
                  h('th', { style: { textAlign:'left',padding:'0.4rem 0',color:'#6b7280',fontWeight:'600' } }, 'Period'),
                  h('th', { style: { textAlign:'right',padding:'0.4rem 0',color:'#6b7280',fontWeight:'600' } }, 'Net Income (USD)'),
                  h('th', { style: { textAlign:'right',padding:'0.4rem 0',color:'#6b7280',fontWeight:'600' } }, 'Net Income (MXN)'),
                  h('th', { style: { textAlign:'right',padding:'0.4rem 0',color:'#6b7280',fontWeight:'600' } }, 'FX Gain/Loss'),
                  h('th', { style: { textAlign:'right',padding:'0.4rem 0',color:'#6b7280',fontWeight:'600' } }, 'Rate')
                )
              ),
              h('tbody', null,
                closings.map(function(c, idx) {
                  return h('tr', { key: idx, style: { borderBottom:'1px solid #f3f4f6' } },
                    h('td', { style: { padding:'0.4rem 0',color:'#111827' } }, formatDate(c.period_start) + ' \u2014 ' + formatDate(c.period_end)),
                    h('td', { style: { padding:'0.4rem 0',textAlign:'right',fontWeight:'600' } }, formatCurrency(c.net_income_usd, 'USD')),
                    h('td', { style: { padding:'0.4rem 0',textAlign:'right',fontWeight:'600' } }, formatCurrency(c.net_income_mxn, 'MXN')),
                    h('td', { style: { padding:'0.4rem 0',textAlign:'right',fontWeight:'600',color: parseFloat(c.fx_gain_loss || 0) >= 0 ? '#059669' : '#dc2626' } }, formatCurrency(c.fx_gain_loss, 'MXN')),
                    h('td', { style: { padding:'0.4rem 0',textAlign:'right',color:'#6b7280' } }, parseFloat(c.exchange_rate || 0).toFixed(4))
                  );
                })
              )
            )
      ),

      // Close New Period
      h('div', { style: { padding:'1.5rem' } },
        h('div', { style: { fontSize:'0.85rem',fontWeight:'600',color:'#374151',marginBottom:'1rem' } }, 'Close New Period'),

        error && h('div', { style: { padding:'0.75rem',background:'#fee2e2',borderRadius:'0.5rem',color:'#991b1b',fontSize:'0.85rem',marginBottom:'1rem' } }, error),

        result && h('div', { style: { padding:'1rem',background:'#d1fae5',borderRadius:'0.5rem',marginBottom:'1rem' } },
          h('div', { style: { fontWeight:'600',color:'#065f46',marginBottom:'0.5rem' } }, '\u2713 ' + result.message),
          h('div', { style: { fontSize:'0.8rem',color:'#065f46' } },
            'Net Income: ' + formatCurrency(result.net_income.usd, 'USD') + ' / ' + formatCurrency(result.net_income.mxn, 'MXN')),
          h('div', { style: { fontSize:'0.8rem',color:'#065f46' } },
            'FX Gain/Loss: ' + formatCurrency(result.fx_gain_loss, 'MXN') + ' at rate ' + result.exchange_rate)
        ),

        !result && h('div', null,
          h('div', { style: { display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem' } },
            h('div', null,
              h('label', { style: { display:'block',fontSize:'0.7rem',fontWeight:'600',color:'#6b7280',marginBottom:'0.25rem',textTransform:'uppercase' } }, 'Period Start'),
              h('input', { type:'date',value:form.period_start,
                onChange:function(e){setForm(Object.assign({},form,{period_start:e.target.value}))},
                style:{width:'100%',padding:'0.5rem',border:'1px solid #d1d5db',borderRadius:'0.375rem',fontSize:'0.85rem'} })
            ),
            h('div', null,
              h('label', { style: { display:'block',fontSize:'0.7rem',fontWeight:'600',color:'#6b7280',marginBottom:'0.25rem',textTransform:'uppercase' } }, 'Period End'),
              h('input', { type:'date',value:form.period_end,
                onChange:function(e){setForm(Object.assign({},form,{period_end:e.target.value}))},
                style:{width:'100%',padding:'0.5rem',border:'1px solid #d1d5db',borderRadius:'0.375rem',fontSize:'0.85rem'} })
            )
          ),
          h('div', { style: { marginBottom:'0.75rem' } },
            h('label', { style: { display:'block',fontSize:'0.7rem',fontWeight:'600',color:'#6b7280',marginBottom:'0.25rem',textTransform:'uppercase' } }, 'Notes (Optional)'),
            h('input', { type:'text',value:form.notes,
              onChange:function(e){setForm(Object.assign({},form,{notes:e.target.value}))},
              placeholder:'e.g. Q1 2026 closing',
              style:{width:'100%',padding:'0.5rem',border:'1px solid #d1d5db',borderRadius:'0.375rem',fontSize:'0.85rem'} })
          ),

          h('div', { style: { padding:'0.75rem',background:'#fef3c7',borderRadius:'0.5rem',fontSize:'0.8rem',color:'#92400e',marginBottom:'1rem' } },
            '\u26A0\uFE0F This will close all income and expense accounts to Retained Earnings, create an FX revaluation entry, and lock the period. This action cannot be undone.'
          ),

          h('button', {
            onClick:handleClose,
            disabled:saving,
            style: Object.assign({}, buttonStyle('red', 'md', saving), { width:'100%', padding:'0.75rem' })
          }, saving ? 'Closing period...' : '\uD83D\uDD12 Close Period')
        )
      )
    )
  );
};

window.PeriodClosingModal = PeriodClosingModal;
