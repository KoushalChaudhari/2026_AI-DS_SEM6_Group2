import { useState, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import api from '../../api';
import VoucherConfigBackButton from './VoucherConfigBackButton';

function Modal({ title, onClose, children }) {
    return (
        <div className="modal-overlay">
            <div className="modal">
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}

export default function Titles() {
    const [rows, setRows] = useState([]);
    const [categories, setCategories] = useState([]);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({ category_id: '', title_name: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/categories').then(r => setCategories(r.data));
        load();
    }, []);

    async function load() {
        const res = await api.get('/titles');
        setRows(res.data);
    }

    function openAdd() { setForm({ category_id: '', title_name: '' }); setModal('add'); setError(''); }
    function openEdit(row) { setForm({ category_id: row.category_id, title_name: row.title_name }); setModal(row); setError(''); }

    async function handleSubmit(e) {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (modal === 'add') await api.post('/titles', form);
            else await api.put(`/titles/${modal.title_id}`, form);
            setModal(null); load();
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving.');
        } finally { setLoading(false); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this title? This will also delete its remuneration rates.')) return;
        await api.delete(`/titles/${id}`);
        load();
    }

    return (
        <div>
            <VoucherConfigBackButton />
            <div className="page-header">
                <div><div className="page-title">Titles</div><div className="page-subtitle">Manage exam/activity titles within categories</div></div>
                <button id="add-title-btn" className="btn btn-primary" onClick={openAdd}>+ Add Title</button>
            </div>
            <div className="table-wrap">
                <table>
                    <thead><tr><th>ID</th><th>Category</th><th>Title Name</th><th style={{ width: 100 }}>Actions</th></tr></thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.title_id}>
                                <td>{r.title_id}</td>
                                <td>{r.category_name}</td>
                                <td>{r.title_name}</td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.title_id)}><Trash2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={4} className="text-center text-muted" style={{ padding: 24 }}>No titles yet.</td></tr>}
                    </tbody>
                </table>
            </div>

            {modal && (
                <Modal title={modal === 'add' ? 'Add Title' : 'Edit Title'} onClose={() => setModal(null)}>
                    {error && <div className="alert alert-error mb-4">{error}</div>}
                    <form onSubmit={handleSubmit}>
                        <div className="flex-col gap-3">
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select id="title-category-select" className="form-control" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} required autoFocus>
                                    <option value="">— Select Category —</option>
                                    {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Title Name</label>
                                <input id="title-name-input" className="form-control" value={form.title_name} onChange={e => setForm(f => ({ ...f, title_name: e.target.value }))} required />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                            <button id="save-title-btn" type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
