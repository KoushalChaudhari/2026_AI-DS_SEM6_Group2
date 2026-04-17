import { useState, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import api from '../../api';
import VoucherConfigBackButton from './VoucherConfigBackButton';

function Modal({ title, onClose, children }) {
    return (
        <div className="modal-overlay"><div className="modal" style={{ minWidth: 520 }}>
            <div className="modal-header"><h3>{title}</h3><button className="modal-close" onClick={onClose}>✕</button></div>
            {children}
        </div></div>
    );
}

export default function RemunerationRates() {
    const [rows, setRows] = useState([]);
    const [titles, setTitles] = useState([]);
    const [examinerTypes, setExaminerTypes] = useState([]);
    const [paymentUnits, setPaymentUnits] = useState([]);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({ title_id: '', examiner_type_id: '', unit_id: '', max_marks: '', rate_rs: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        load();
        api.get('/titles').then(r => setTitles(r.data));
        api.get('/examiner-types').then(r => setExaminerTypes(r.data));
        api.get('/payment-units').then(r => setPaymentUnits(r.data));
    }, []);

    async function load() { const r = await api.get('/remuneration-rates'); setRows(r.data); }

    function openAdd() { setForm({ title_id: '', examiner_type_id: '', unit_id: '', max_marks: '', rate_rs: '' }); setModal('add'); setError(''); }
    function openEdit(r) { setForm({ title_id: r.title_id, examiner_type_id: r.examiner_type_id, unit_id: r.unit_id, max_marks: r.max_marks || '', rate_rs: r.rate_rs }); setModal(r); setError(''); }

    async function handleSubmit(e) {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (modal === 'add') await api.post('/remuneration-rates', form);
            else await api.put(`/remuneration-rates/${modal.rate_id}`, form);
            setModal(null); load();
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving.');
        } finally { setLoading(false); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this rate?')) return;
        await api.delete(`/remuneration-rates/${id}`); load();
    }

    return (
        <div>
            <VoucherConfigBackButton />
            <div className="page-header">
                <div><div className="page-title">Remuneration Rates</div><div className="page-subtitle">Practical / Oral exam payment rates</div></div>
                <button id="add-rate-btn" className="btn btn-primary" onClick={openAdd}>+ Add Rate</button>
            </div>
            <div className="table-wrap">
                <table>
                    <thead><tr><th>Title</th><th>Examiner Type</th><th>Payment Unit</th><th>Max Marks</th><th>Rate (₹)</th><th style={{ width: 100 }}>Actions</th></tr></thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.rate_id}>
                                <td>{r.title_name}</td>
                                <td>{r.type_name}</td>
                                <td>{r.unit_name}</td>
                                <td>{r.max_marks ?? '—'}</td>
                                <td>₹{parseFloat(r.rate_rs).toFixed(2)}</td>
                                <td><div className="flex gap-2">
                                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.rate_id)}><Trash2 size={14} /></button>
                                </div></td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 24 }}>No rates yet.</td></tr>}
                    </tbody>
                </table>
            </div>

            {modal && (
                <Modal title={modal === 'add' ? 'Add Rate' : 'Edit Rate'} onClose={() => setModal(null)}>
                    {error && <div className="alert alert-error mb-4">{error}</div>}
                    <form onSubmit={handleSubmit}>
                        <div className="grid-2" style={{ gap: 12 }}>
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <select className="form-control" value={form.title_id} onChange={e => setForm(f => ({ ...f, title_id: e.target.value }))} required autoFocus>
                                    <option value="">— Select —</option>
                                    {titles.map(t => <option key={t.title_id} value={t.title_id}>{t.title_name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Examiner Type</label>
                                <select className="form-control" value={form.examiner_type_id} onChange={e => setForm(f => ({ ...f, examiner_type_id: e.target.value }))} required>
                                    <option value="">— Select —</option>
                                    {examinerTypes.map(e => <option key={e.examiner_type_id} value={e.examiner_type_id}>{e.type_name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Payment Unit</label>
                                <select className="form-control" value={form.unit_id} onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))} required>
                                    <option value="">— Select —</option>
                                    {paymentUnits.map(u => <option key={u.unit_id} value={u.unit_id}>{u.unit_name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Max Marks (optional)</label>
                                <input className="form-control" type="number" placeholder="e.g. 25" value={form.max_marks} onChange={e => setForm(f => ({ ...f, max_marks: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Rate (₹)</label>
                                <input className="form-control" type="number" step="0.01" placeholder="e.g. 10.00" value={form.rate_rs} onChange={e => setForm(f => ({ ...f, rate_rs: e.target.value }))} required />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
