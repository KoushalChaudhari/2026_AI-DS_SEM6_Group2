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

export default function Categories() {
    const [rows, setRows] = useState([]);
    const [modal, setModal] = useState(null); // null | 'add' | {row}
    const [form, setForm] = useState({ category_name: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { load(); }, []);

    async function load() {
        const res = await api.get('/categories');
        setRows(res.data);
    }

    function openAdd() { setForm({ category_name: '' }); setModal('add'); setError(''); }
    function openEdit(row) { setForm({ category_name: row.category_name }); setModal(row); setError(''); }

    async function handleSubmit(e) {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (modal === 'add') await api.post('/categories', form);
            else await api.put(`/categories/${modal.category_id}`, form);
            setModal(null); load();
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving.');
        } finally { setLoading(false); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this category? This will also delete all associated titles and rates.')) return;
        await api.delete(`/categories/${id}`);
        load();
    }

    return (
        <div>
            <VoucherConfigBackButton />
            <div className="page-header">
                <div><div className="page-title">Categories</div><div className="page-subtitle">Manage exam category groups</div></div>
                <button id="add-category-btn" className="btn btn-primary" onClick={openAdd}>+ Add Category</button>
            </div>
            <div className="table-wrap">
                <table>
                    <thead><tr><th>ID</th><th>Category Name</th><th style={{ width: 100 }}>Actions</th></tr></thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.category_id}>
                                <td>{r.category_id}</td>
                                <td>{r.category_name}</td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.category_id)}><Trash2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={3} className="text-center text-muted" style={{ padding: 24 }}>No categories yet.</td></tr>}
                    </tbody>
                </table>
            </div>

            {modal && (
                <Modal title={modal === 'add' ? 'Add Category' : 'Edit Category'} onClose={() => setModal(null)}>
                    {error && <div className="alert alert-error mb-4">{error}</div>}
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Category Name</label>
                            <input id="category-name-input" className="form-control" value={form.category_name} onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))} required autoFocus />
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                            <button id="save-category-btn" type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
