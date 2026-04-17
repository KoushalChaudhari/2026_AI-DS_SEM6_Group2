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

function SimpleCrudPage({ title, subtitle, endpoint, fields, columns, idKey }) {
    const [rows, setRows] = useState([]);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({});
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { load(); }, []);

    async function load() { const r = await api.get(endpoint); setRows(r.data); }

    function makeEmpty() { return Object.fromEntries(fields.map(f => [f.key, ''])); }
    function openAdd() { setForm(makeEmpty()); setModal('add'); setError(''); }
    function openEdit(row) { setForm(Object.fromEntries(fields.map(f => [f.key, row[f.key]]))); setModal(row); setError(''); }

    async function handleSubmit(e) {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (modal === 'add') await api.post(endpoint, form);
            else await api.put(`${endpoint}/${modal[idKey]}`, form);
            setModal(null); load();
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving.');
        } finally { setLoading(false); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this record?')) return;
        await api.delete(`${endpoint}/${id}`); load();
    }

    return (
        <div>
            <VoucherConfigBackButton />
            <div className="page-header">
                <div><div className="page-title">{title}</div><div className="page-subtitle">{subtitle}</div></div>
                <button id={`add-${endpoint.replace('/api/', '').replace('/', '-')}-btn`} className="btn btn-primary" onClick={openAdd}>+ Add</button>
            </div>
            <div className="table-wrap">
                <table>
                    <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}<th style={{ width: 100 }}>Actions</th></tr></thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r[idKey]}>
                                {columns.map(c => <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>)}
                                <td><div className="flex gap-2">
                                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r[idKey])}><Trash2 size={14} /></button>
                                </div></td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={columns.length + 1} className="text-center text-muted" style={{ padding: 24 }}>No records.</td></tr>}
                    </tbody>
                </table>
            </div>
            {modal && (
                <Modal title={modal === 'add' ? `Add ${title}` : `Edit ${title}`} onClose={() => setModal(null)}>
                    {error && <div className="alert alert-error mb-4">{error}</div>}
                    <form onSubmit={handleSubmit}>
                        <div className="flex-col gap-3">
                            {fields.map(f => (
                                <div className="form-group" key={f.key}>
                                    <label className="form-label">{f.label}</label>
                                    <input className="form-control" type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required={f.required !== false} autoFocus={f.autoFocus} placeholder={f.placeholder} />
                                </div>
                            ))}
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

export function ExaminerTypes() {
    return <SimpleCrudPage
        title="Examiner Types" subtitle="Internal / External examiner classifications"
        endpoint="/examiner-types" idKey="examiner_type_id"
        fields={[{ key: 'type_name', label: 'Type Name', autoFocus: true, placeholder: 'e.g. Internal' }]}
        columns={[{ key: 'examiner_type_id', label: 'ID' }, { key: 'type_name', label: 'Type Name' }]}
    />;
}

export function PaymentUnits() {
    return <SimpleCrudPage
        title="Payment Units" subtitle="Per student / per group payment basis"
        endpoint="/payment-units" idKey="unit_id"
        fields={[{ key: 'unit_name', label: 'Unit Name', autoFocus: true, placeholder: 'e.g. per student' }]}
        columns={[{ key: 'unit_id', label: 'ID' }, { key: 'unit_name', label: 'Unit Name' }]}
    />;
}

export default ExaminerTypes;
