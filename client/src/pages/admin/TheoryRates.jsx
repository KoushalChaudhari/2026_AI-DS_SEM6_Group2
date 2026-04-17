import { useState, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import api from '../../api';
import VoucherConfigBackButton from './VoucherConfigBackButton';

function Modal({ title, onClose, children }) {
    return (
        <div className="modal-overlay"><div className="modal">
            <div className="modal-header"><h3>{title}</h3><button className="modal-close" onClick={onClose}>✕</button></div>
            {children}
        </div></div>
    );
}

export default function TheoryRates() {
    const [rows, setRows] = useState([]);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({ max_marks: '', activity_type: '', rate_per_paper: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { load(); }, []);

    async function load() { const r = await api.get('/theory-rates'); setRows(r.data); }

    function openAdd() { setForm({ max_marks: '', activity_type: '', rate_per_paper: '' }); setModal('add'); setError(''); }
    function openEdit(r) { setForm({ max_marks: r.max_marks, activity_type: r.activity_type, rate_per_paper: r.rate_per_paper }); setModal(r); setError(''); }

    async function handleSubmit(e) {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (modal === 'add') await api.post('/theory-rates', form);
            else await api.put(`/theory-rates/${modal.theory_rate_id}`, form);
            setModal(null); load();
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving.');
        } finally { setLoading(false); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this theory rate?')) return;
        await api.delete(`/theory-rates/${id}`); load();
    }

    const ACTIVITY_TYPES = ['Assessment', 'Moderation', 'Reevaluation'];

    return (
        <div>
            <VoucherConfigBackButton />
            <div className="page-header">
                <div><div className="page-title">Theory Exam Rates</div><div className="page-subtitle">Paper assessment / moderation / reevaluation rates</div></div>
                <button id="add-theory-rate-btn" className="btn btn-primary" onClick={openAdd}>+ Add Rate</button>
            </div>
            <div className="table-wrap">
                <table>
                    <thead><tr><th>Max Marks</th><th>Activity Type</th><th>Rate per Paper (₹)</th><th style={{ width: 100 }}>Actions</th></tr></thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.theory_rate_id}>
                                <td>{r.max_marks}</td>
                                <td>{r.activity_type}</td>
                                <td>₹{parseFloat(r.rate_per_paper).toFixed(2)}</td>
                                <td><div className="flex gap-2">
                                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.theory_rate_id)}><Trash2 size={14} /></button>
                                </div></td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={4} className="text-center text-muted" style={{ padding: 24 }}>No theory rates yet.</td></tr>}
                    </tbody>
                </table>
            </div>

            {modal && (
                <Modal title={modal === 'add' ? 'Add Theory Rate' : 'Edit Theory Rate'} onClose={() => setModal(null)}>
                    {error && <div className="alert alert-error mb-4">{error}</div>}
                    <form onSubmit={handleSubmit}>
                        <div className="flex-col gap-3">
                            <div className="form-group">
                                <label className="form-label">Max Marks</label>
                                <input className="form-control" type="number" placeholder="e.g. 60 or 80" value={form.max_marks} onChange={e => setForm(f => ({ ...f, max_marks: e.target.value }))} required autoFocus />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Activity Type</label>
                                <select className="form-control" value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))} required>
                                    <option value="">— Select —</option>
                                    {ACTIVITY_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Rate per Paper (₹)</label>
                                <input className="form-control" type="number" step="0.01" placeholder="e.g. 8.00" value={form.rate_per_paper} onChange={e => setForm(f => ({ ...f, rate_per_paper: e.target.value }))} required />
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
