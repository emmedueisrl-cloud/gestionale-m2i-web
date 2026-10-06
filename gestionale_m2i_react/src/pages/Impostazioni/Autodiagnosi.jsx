import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { autodiagnosiApi } from '../../api/autodiagnosi';

const colors = {
  critico: { fg: '#dc2626', bg: 'rgba(220,38,38,.12)' },
  errore: { fg: '#ea580c', bg: 'rgba(234,88,12,.12)' },
  avviso: { fg: '#ca8a04', bg: 'rgba(202,138,4,.12)' }
};

const formatDate = value => value
  ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
  : '—';

export default function Autodiagnosi() {
  const [data, setData] = useState({ records: [], riepilogo: {}, aree: [] });
  const [filters, setFilters] = useState({ stato: 'tutti', gravita: 'tutte', area: 'tutte' });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await autodiagnosiApi.elenco(filters)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const total = useMemo(() => Object.values(data.riepilogo || {}).reduce((sum, value) => sum + Number(value || 0), 0), [data]);

  const updateStatus = async stato => {
    try {
      const updated = await autodiagnosiApi.aggiornaStato(selected.id, stato);
      setSelected(updated);
      await load();
    } catch (err) { setError(err.message); }
  };

  return <div>
    <div style={styles.heading}>
      <div>
        <h2 style={styles.title}>Autodiagnosi</h2>
        <p style={styles.subtitle}>Errori applicativi raggruppati, spiegati e pronti per la verifica.</p>
      </div>
      <button style={styles.refresh} onClick={load} disabled={loading}>↻ Aggiorna</button>
    </div>

    <div style={styles.cards}>
      <Summary label="Nuovi" value={data.riepilogo?.nuovo || 0} color="#dc2626" />
      <Summary label="Verificati" value={data.riepilogo?.verificato || 0} color="#ca8a04" />
      <Summary label="Risolti" value={data.riepilogo?.risolto || 0} color="#059669" />
      <Summary label="Totale" value={total} color="#4f46e5" />
    </div>

    <div style={styles.filters}>
      <Filter label="Stato" value={filters.stato} onChange={value => setFilters(old => ({ ...old, stato: value }))}
        options={[['tutti', 'Tutti'], ['nuovo', 'Nuovi'], ['verificato', 'Verificati'], ['risolto', 'Risolti']]} />
      <Filter label="Gravità" value={filters.gravita} onChange={value => setFilters(old => ({ ...old, gravita: value }))}
        options={[['tutte', 'Tutte'], ['critico', 'Critico'], ['errore', 'Errore'], ['avviso', 'Avviso']]} />
      <Filter label="Area" value={filters.area} onChange={value => setFilters(old => ({ ...old, area: value }))}
        options={[['tutte', 'Tutte'], ...data.aree.map(area => [area, area])]} />
    </div>

    {error && <div style={styles.error}>⚠ {error}</div>}
    <div style={styles.list}>
      {loading ? <div style={styles.empty}>Caricamento autodiagnosi...</div>
        : data.records.length === 0 ? <div style={styles.empty}>Nessun errore corrisponde ai filtri selezionati.</div>
        : data.records.map(record => {
          const tone = colors[record.gravita] || colors.errore;
          return <button key={record.id} style={styles.row} onClick={() => setSelected(record)}>
            <span style={{ ...styles.severity, color: tone.fg, background: tone.bg }}>{record.gravita}</span>
            <span style={styles.mainText}>
              <strong style={styles.operation}>{record.operazione}</strong>
              <span style={styles.explanation}>{record.spiegazione}</span>
            </span>
            <span style={styles.area}>{record.area}</span>
            <span style={styles.occurrences}>{record.occorrenze}×</span>
            <span style={styles.date}>{formatDate(record.ultima_occorrenza)}</span>
            <span style={styles.chevron}>›</span>
          </button>;
        })}
    </div>

    {selected && <div style={styles.overlay} onMouseDown={event => event.target === event.currentTarget && setSelected(null)}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-label="Dettaglio autodiagnosi">
        <button style={styles.close} onClick={() => setSelected(null)} aria-label="Chiudi">×</button>
        <div style={styles.modalTop}>
          <span style={{ ...styles.severity, color: (colors[selected.gravita] || colors.errore).fg, background: (colors[selected.gravita] || colors.errore).bg }}>{selected.gravita}</span>
          <span style={styles.status}>{selected.stato}</span>
        </div>
        <h3 style={styles.modalTitle}>{selected.operazione}</h3>
        <Detail title="Che cosa è successo" text={selected.spiegazione} />
        <Detail title="Perché è stato generato" text={selected.causa} />
        <Detail title="Cosa fare" text={selected.soluzione} />
        <Detail title="Messaggio registrato" text={selected.messaggio} technical />
        <div style={styles.meta}>
          <span><b>Area:</b> {selected.area}</span>
          <span><b>Occorrenze:</b> {selected.occorrenze}</span>
          <span><b>Prima:</b> {formatDate(selected.prima_occorrenza)}</span>
          <span><b>Ultima:</b> {formatDate(selected.ultima_occorrenza)}</span>
        </div>
        <div style={styles.actions}>
          {selected.stato !== 'nuovo' && <button style={styles.secondary} onClick={() => updateStatus('nuovo')}>Riapri</button>}
          {selected.stato !== 'verificato' && <button style={styles.secondary} onClick={() => updateStatus('verificato')}>Segna verificato</button>}
          {selected.stato !== 'risolto' && <button style={styles.resolve} onClick={() => updateStatus('risolto')}>Segna risolto</button>}
        </div>
      </div>
    </div>}
  </div>;
}

function Summary({ label, value, color }) {
  return <div style={{ ...styles.summary, borderTopColor: color }}><span style={styles.summaryLabel}>{label}</span><strong style={{ ...styles.summaryValue, color }}>{value}</strong></div>;
}
function Filter({ label, value, onChange, options }) {
  return <label style={styles.filterLabel}>{label}<select style={styles.select} value={value} onChange={event => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
function Detail({ title, text, technical }) {
  return <section style={styles.detail}><h4 style={styles.detailTitle}>{title}</h4><p style={technical ? styles.technical : styles.detailText}>{text}</p></section>;
}

const styles = {
  heading: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 },
  title: { margin: '0 0 7px', fontSize: 24, color: 'var(--text-primary)' },
  subtitle: { margin: 0, fontSize: 14, color: 'var(--text-secondary)' },
  refresh: { border: '1px solid var(--border-color)', background: 'var(--bg-card-secondary)', color: 'var(--text-primary)', borderRadius: 9, padding: '9px 14px', cursor: 'pointer' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(110px, 1fr))', gap: 12, marginBottom: 20 },
  summary: { background: 'var(--bg-card-secondary)', border: '1px solid var(--border-color)', borderTop: '3px solid', borderRadius: 11, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: 'var(--text-secondary)', fontSize: 13 }, summaryValue: { fontSize: 24 },
  filters: { display: 'flex', flexWrap: 'wrap', gap: 12, padding: 14, background: 'var(--bg-card-secondary)', borderRadius: 11, marginBottom: 15 },
  filterLabel: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text-secondary)', minWidth: 145 },
  select: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 10px' },
  error: { padding: 12, borderRadius: 9, color: '#dc2626', background: 'rgba(220,38,38,.1)', marginBottom: 14 },
  list: { border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' },
  row: { width: '100%', border: 0, borderBottom: '1px solid var(--border-color)', padding: '13px 14px', background: 'var(--bg-card)', color: 'var(--text-primary)', display: 'grid', gridTemplateColumns: '78px minmax(210px,1fr) 100px 45px 135px 18px', gap: 10, alignItems: 'center', textAlign: 'left', cursor: 'pointer' },
  severity: { textTransform: 'uppercase', fontSize: 10, fontWeight: 800, letterSpacing: '.04em', borderRadius: 99, padding: '5px 8px', textAlign: 'center' },
  mainText: { display: 'flex', flexDirection: 'column', minWidth: 0, gap: 3 }, operation: { fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  explanation: { color: 'var(--text-secondary)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  area: { fontSize: 12, color: 'var(--text-secondary)' }, occurrences: { fontWeight: 700, textAlign: 'center' }, date: { fontSize: 11, color: 'var(--text-muted)' }, chevron: { fontSize: 24, color: 'var(--text-muted)' },
  empty: { padding: 38, textAlign: 'center', color: 'var(--text-muted)' },
  overlay: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,6,23,.68)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { position: 'relative', width: 'min(680px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 26, boxShadow: '0 24px 70px rgba(0,0,0,.35)' },
  close: { position: 'absolute', right: 16, top: 12, border: 0, background: 'transparent', color: 'var(--text-secondary)', fontSize: 28, cursor: 'pointer' },
  modalTop: { display: 'flex', gap: 9, paddingRight: 35 }, status: { textTransform: 'capitalize', color: 'var(--text-secondary)', fontSize: 12, padding: '5px 8px' },
  modalTitle: { color: 'var(--text-primary)', fontSize: 22, margin: '17px 0 20px' },
  detail: { marginBottom: 16 }, detailTitle: { color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 6px' }, detailText: { color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.55, margin: 0 },
  technical: { color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12, background: 'var(--bg-card-secondary)', borderRadius: 8, padding: 11, margin: 0, overflowWrap: 'anywhere' },
  meta: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, color: 'var(--text-secondary)', fontSize: 12, borderTop: '1px solid var(--border-color)', paddingTop: 15 },
  actions: { display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 9, marginTop: 22 },
  secondary: { border: '1px solid var(--border-color)', background: 'var(--bg-card-secondary)', color: 'var(--text-primary)', borderRadius: 9, padding: '9px 13px', cursor: 'pointer' },
  resolve: { border: 0, background: '#059669', color: 'white', borderRadius: 9, padding: '9px 13px', cursor: 'pointer', fontWeight: 700 }
};
