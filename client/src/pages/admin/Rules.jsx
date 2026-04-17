import { useState, useEffect } from 'react';
import { ClipboardList } from 'lucide-react';
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

export default function Rules() {
    const [rows, setRows] = useState([]);
    const [modal, setModal] = useState(null); // null | 'add' | {row}
    const [form, setForm] = useState({ rule_name: '', rule_key: '', rule_value: '', description: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { load(); }, []);

    async function load() {
        try {
            const res = await api.get('/rules');
            setRows(res.data);
        } catch (err) {
            setError('Failed to load rules.');
            console.error(err);
        }
    }

    function openAdd() { setForm({ rule_name: '', rule_key: '', rule_value: '', description: '' }); setModal('add'); setError(''); }
    function openEdit(row) { setForm({ rule_name: row.rule_name, rule_key: row.rule_key, rule_value: row.rule_value, description: row.description || '' }); setModal(row); setError(''); }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!form.rule_name.trim() || !form.rule_key.trim() || form.rule_value === '') {
            setError('All fields are required.');
            setLoading(false);
            return;
        }

        try {
            if (modal === 'add') {
                await api.post('/rules', form);
            } else {
                await api.put(`/rules/${modal.rule_id}`, {
                    rule_name: form.rule_name,
                    rule_value: form.rule_value,
                    description: form.description
                });
            }
            setModal(null);
            load();
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving rule.');
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this rule? This may affect system calculations.')) return;
        try {
            await api.delete(`/rules/${id}`);
            load();
        } catch (err) {
            setError(err.response?.data?.error || 'Error deleting rule.');
        }
    }

    const formatValue = (val) => {
        if (typeof val === 'number') return val.toFixed(2);
        return val;
    };

    return (
        <div className="page-container">
            <VoucherConfigBackButton />
            <div className="page-header">
                <h2><ClipboardList size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} /> System Rules</h2>
                <p>Manage system-wide configuration rules for calculations</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="page-actions">
                <button className="btn btn-primary" onClick={openAdd}>+ Add Rule</button>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Rule Name</th>
                            <th>Rule Key</th>
                            <th>Value</th>
                            <th>Description</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan="5" className="text-center text-muted">No rules defined</td></tr>
                        ) : (
                            rows.map(row => (
                                <tr key={row.rule_id}>
                                    <td><strong>{row.rule_name}</strong></td>
                                    <td><code>{row.rule_key}</code></td>
                                    <td><strong className="text-primary">{formatValue(row.rule_value)}</strong></td>
                                    <td>{row.description || '—'}</td>
                                    <td>
                                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(row)}>Edit</button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(row.rule_id)}>Delete</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {modal && (
                <Modal title={modal === 'add' ? 'Add New Rule' : 'Edit Rule'} onClose={() => setModal(null)}>
                    <form onSubmit={handleSubmit} className="form">
                        <div className="form-group">
                            <label>Rule Name *</label>
                            <input
                                type="text"
                                value={form.rule_name}
                                onChange={(e) => setForm({ ...form, rule_name: e.target.value })}
                                placeholder="e.g., Minimum Remuneration"
                                disabled={modal !== 'add'}
                            />
                        </div>
                        <div className="form-group">
                            <label>Rule Key *</label>
                            <input
                                type="text"
                                value={form.rule_key}
                                onChange={(e) => setForm({ ...form, rule_key: e.target.value })}
                                placeholder="e.g., MIN_REMUNERATION"
                                disabled={modal !== 'add'}
                                title="Unique identifier for this rule"
                            />
                        </div>
                        <div className="form-group">
                            <label>Value *</label>
                            <input
                                type="number"
                                step="any"
                                value={form.rule_value}
                                onChange={(e) => setForm({ ...form, rule_value: e.target.value })}
                                placeholder="e.g., 100"
                            />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="e.g., Minimum remuneration per item in rupees"
                                rows="3"
                            />
                        </div>
                        {error && <div className="alert alert-error">{error}</div>}
                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Saving...' : 'Save'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
