import { useState, useEffect } from 'react';
import { Key, Trash2 } from 'lucide-react';
import api from '../../api';
import Alert from '../../components/Alert';

function Modal({ title, onClose, children }) {
    return (
        <div className="modal-overlay"><div className="modal">
            <div className="modal-header"><h3>{title}</h3><button className="modal-close" onClick={onClose}>✕</button></div>
            {children}
        </div></div>
    );
}

export default function Users() {
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [roles, setRoles] = useState([]);
    const [modal, setModal] = useState(null); // null | 'add' | 'pwd:{user}'
    const [form, setForm] = useState({ username: '', password: '', role: 'user', branch_id: '', staff_code: '', staff_type: 'TEACHING', role_ids: [] });
    const [pwdForm, setPwdForm] = useState({ password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => { loadAll(); }, []);
    async function loadAll() {
        try {
            const [usersRes, branchesRes, rolesRes] = await Promise.all([
                api.get('/auth/users'),
                api.get('/branches?scope=user_staff'),
                api.get('/staff-roles/roles')
            ]);
            setUsers(usersRes.data || []);
            setBranches(branchesRes.data || []);
            setRoles(rolesRes.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load user configuration data.');
        }
    }

    function openAdd() {
        setForm({ username: '', password: '', role: 'user', branch_id: '', staff_code: '', staff_type: 'TEACHING', role_ids: [] });
        setModal('add');
        setError('');
    }
    function openPwd(u) { setPwdForm({ password: '' }); setModal(`pwd:${u.user_id}`); setError(''); }

    async function handleAdd(e) {
        e.preventDefault();
        if (loading) return; // Prevent double-submission
        if (!form.username || !form.password || !form.staff_code || !form.branch_id) {
            setError('Please fill in all required fields.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/users', {
                ...form,
                staff_code: form.staff_code.trim().toUpperCase(),
                branch_id: Number(form.branch_id),
                role_ids: Array.from(new Set((form.role_ids || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)))
            });
            setModal(null);
            await loadAll();
        }
        catch (err) { setError(err.response?.data?.error || 'Error.'); }
        finally { setLoading(false); }
    }

    async function handlePwd(e) {
        e.preventDefault(); setError(''); setLoading(true);
        const uid = modal.replace('pwd:', '');
        try { await api.put(`/auth/users/${uid}/password`, pwdForm); setModal(null); }
        catch (err) { setError(err.response?.data?.error || 'Error.'); }
        finally { setLoading(false); }
    }

    async function handleDelete(u) {
        if (!confirm(`Delete user "${u.username}"?`)) return;
        await api.delete(`/auth/users/${u.user_id}`); loadAll();
    }

    return (
        <div>
            <div className="page-header">
                <div><div className="page-title">Users</div><div className="page-subtitle">Manage system access and roles</div></div>
                <button id="add-user-btn" className="btn btn-primary" onClick={openAdd}>+ Add User</button>
            </div>
            <div className="table-wrap">
                <table>
                    <thead><tr><th>ID</th><th>Username</th><th>Role</th><th style={{ width: 160 }}>Actions</th></tr></thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.user_id}>
                                <td>{u.user_id}</td>
                                <td>{u.username} {u.username === currentUser.username && <span className="badge badge-admin">you</span>}</td>
                                <td><span className={`badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>{u.role}</span></td>
                                <td><div className="flex gap-2">
                                    <button className="btn btn-secondary btn-sm" onClick={() => openPwd(u)} title="Change password"><Key size={14} /></button>
                                    <button className="btn btn-danger btn-sm" disabled={u.username === currentUser.username} onClick={() => handleDelete(u)}><Trash2 size={14} /></button>
                                </div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modal === 'add' && (
                <Modal title="Add User" onClose={() => setModal(null)}>
                    {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
                    <form onSubmit={handleAdd} className="flex-col gap-3">
                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input id="new-username" className="form-control" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required autoFocus />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Code</label>
                                <input id="new-code" className="form-control" value={form.staff_code} onChange={e => setForm(f => ({ ...f, staff_code: e.target.value.toUpperCase() }))} required placeholder="e.g., USR001" />
                            </div>
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input id="new-password" className="form-control" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
                            </div>
                            <div />
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">System Role</label>
                                <select id="new-role" className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Type</label>
                                <select
                                    className="form-control"
                                    value={form.staff_type}
                                    onChange={(e) => setForm((prev) => ({ ...prev, staff_type: e.target.value }))}
                                    required
                                >
                                    <option value="TEACHING">Teaching</option>
                                    <option value="NON_TEACHING">Non-Teaching</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Branch</label>
                            <select
                                className="form-control"
                                value={form.branch_id}
                                onChange={(e) => setForm((prev) => ({ ...prev, branch_id: e.target.value }))}
                                required
                            >
                                <option value="">Select branch</option>
                                {branches.map((b) => (
                                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Assigned Roles</label>
                            <div className="card" style={{ padding: 10, maxHeight: 180, overflow: 'auto', borderRadius: 10 }}>
                                <div className="grid-2" style={{ rowGap: 8 }}>
                                    {roles.map((role) => {
                                        const roleId = Number(role.role_id);
                                        const checked = form.role_ids.includes(roleId);
                                        return (
                                            <label key={role.role_id} className="flex gap-2" style={{ alignItems: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            role_ids: e.target.checked
                                                                ? [...prev.role_ids, roleId]
                                                                : prev.role_ids.filter((id) => id !== roleId)
                                                        }));
                                                    }}
                                                />
                                                <span>{role.role_name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <small className="text-muted">If none selected, default role assignment will be used.</small>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)} disabled={loading}>Cancel</button>
                            <button id="save-user-btn" type="submit" className="btn btn-primary" disabled={loading || !form.username || !form.password || !form.staff_code || !form.branch_id}>{loading ? 'Creating…' : 'Create User'}</button>
                        </div>
                    </form>
                </Modal>
            )}

            {modal && modal.startsWith('pwd:') && (
                <Modal title="Change Password" onClose={() => setModal(null)}>
                    {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
                    <form onSubmit={handlePwd}>
                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <input id="new-pwd-input" className="form-control" type="password" value={pwdForm.password} onChange={e => setPwdForm({ password: e.target.value })} required autoFocus minLength={6} />
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Updating…' : 'Update Password'}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
