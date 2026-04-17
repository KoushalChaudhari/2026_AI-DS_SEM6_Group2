import { useEffect, useMemo, useState } from 'react';
import { Save, Users, Shield, Trash2 } from 'lucide-react';
import api from '../../api';
import Alert from '../../components/Alert';

function PermissionPanel({ roles, selectedRoleId, setSelectedRoleId, permissionGroups, onSave, saving, canConfigure }) {
    const selectedRole = useMemo(
        () => roles.find((r) => String(r.role_id) === String(selectedRoleId)) || null,
        [roles, selectedRoleId]
    );

    const [draft, setDraft] = useState({});

    useEffect(() => {
        setDraft(selectedRole?.permissions || {});
    }, [selectedRole]);

    if (!selectedRole) {
        return <div className="text-muted">Select a role to edit permissions.</div>;
    }

    return (
        <section className="card" style={{ marginBottom: 16 }}>
            <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}><Shield size={18} /> Role Permission Panel</h3>
                <select className="form-control" style={{ maxWidth: 320 }} value={selectedRoleId || ''} onChange={(e) => setSelectedRoleId(e.target.value)}>
                    {roles.map((role) => (
                        <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                    ))}
                </select>
            </div>

            {Object.entries(permissionGroups).map(([groupKey, keys]) => (
                <div key={groupKey} className="card" style={{ marginBottom: 10, padding: 12 }}>
                    <h4 style={{ marginBottom: 10, textTransform: 'capitalize' }}>{groupKey.replace(/_/g, ' ')}</h4>
                    <div className="grid-2">
                        {keys.map((key) => (
                            <label key={key} className="flex gap-2" style={{ alignItems: 'center' }}>
                                <input
                                    type="checkbox"
                                    checked={Boolean(draft[key])}
                                    disabled={!canConfigure}
                                    onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.checked }))}
                                />
                                <span>{key}</span>
                            </label>
                        ))}
                    </div>
                </div>
            ))}

            <div className="modal-footer" style={{ marginTop: 8 }}>
                <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canConfigure || saving}
                    onClick={() => onSave(selectedRole.role_id, draft)}
                >
                    <Save size={14} /> {saving ? 'Saving…' : 'Save Permissions'}
                </button>
            </div>
        </section>
    );
}

export default function StaffRoles() {
    const [meta, setMeta] = useState(null);
    const [roles, setRoles] = useState([]);
    const [staffRows, setStaffRows] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [addingStaff, setAddingStaff] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [staffForm, setStaffForm] = useState({ staff_name: '', staff_code: '', staff_type: 'TEACHING', branch_id: '', role_ids: [] });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [saving, setSaving] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');

    const canConfigureRoles = Boolean(meta?.current_user?.permissions?.configure_roles) || (meta?.current_user?.roles || []).includes('ADMIN');
    const canManageStaff = Boolean(meta?.current_user?.permissions?.manage_staff) || (meta?.current_user?.roles || []).includes('ADMIN');
    const currentUserBranchId = meta?.current_user?.branch_id ? String(meta.current_user.branch_id) : '';
    const protectedRoleNames = meta?.protected_role_names || [];

    async function loadAll() {
        setError('');
        try {
            const [metaRes, rolesRes, staffRes, branchRes] = await Promise.all([
                api.get('/staff-roles/meta'),
                api.get('/staff-roles/roles'),
                api.get('/staff-roles/staff'),
                api.get('/branches?scope=user_staff')
            ]);
            setMeta(metaRes.data);
            const nextRoles = rolesRes.data || [];
            setRoles(nextRoles);
            setStaffRows(staffRes.data || []);
            setBranches(branchRes.data || []);
            if (nextRoles.length) {
                const currentStillExists = nextRoles.some((r) => String(r.role_id) === String(selectedRoleId));
                if (!currentStillExists) setSelectedRoleId(String(nextRoles[0].role_id));
            } else {
                setSelectedRoleId('');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load staff and roles.');
        }
    }

    useEffect(() => {
        loadAll();
    }, []);

    function beginEdit(row) {
        setEditingStaff(row);
        setStaffForm({
            staff_name: row.staff_name || '',
            staff_code: row.staff_code || '',
            staff_type: row.staff_type || 'TEACHING',
            branch_id: row.branch_id ? String(row.branch_id) : '',
            role_ids: Array.isArray(row.roles) ? row.roles.map((r) => Number(r.role_id)) : []
        });
    }

    function beginAddStaff() {
        setAddingStaff(true);
        setStaffForm({
            staff_name: '',
            staff_code: '',
            staff_type: 'TEACHING',
            branch_id: (meta?.current_user?.roles || []).includes('ADMIN') ? '' : currentUserBranchId,
            role_ids: []
        });
    }

    async function saveRolePermissions(roleId, permissions) {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await api.put(`/staff-roles/roles/${roleId}/permissions`, { permissions });
            setSuccess('Role permissions updated.');
            await loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save role permissions.');
        } finally {
            setSaving(false);
        }
    }

    async function createRole() {
        const roleName = newRoleName.trim().toUpperCase();
        if (!/^[A-Z][A-Z0-9_]*$/.test(roleName)) {
            setError('Role name must start with a letter and contain only uppercase letters, numbers, and underscores.');
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const created = await api.post('/staff-roles/roles', { role_name: roleName });
            setSuccess('Role created successfully.');
            setNewRoleName('');
            await loadAll();
            if (created?.data?.role_id) setSelectedRoleId(String(created.data.role_id));
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create role.');
        } finally {
            setSaving(false);
        }
    }

    async function deleteSelectedRole() {
        const selectedRole = roles.find((r) => String(r.role_id) === String(selectedRoleId));
        if (!selectedRole) return;
        if (protectedRoleNames.includes(selectedRole.role_name)) {
            setError('Base roles cannot be deleted.');
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await api.delete(`/staff-roles/roles/${selectedRole.role_id}`);
            setSuccess('Role deleted successfully.');
            await loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete role.');
        } finally {
            setSaving(false);
        }
    }

    async function saveStaffEdit(e) {
        e.preventDefault();
        if (!editingStaff) return;
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await api.put(`/staff-roles/staff/${editingStaff.staff_id}`, {
                staff_name: staffForm.staff_name,
                staff_code: staffForm.staff_code,
                staff_type: staffForm.staff_type,
                branch_id: staffForm.branch_id ? Number(staffForm.branch_id) : null,
                role_ids: staffForm.role_ids
            });
            setSuccess('Staff profile updated.');
            setEditingStaff(null);
            await loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update staff profile.');
        } finally {
            setSaving(false);
        }
    }

    async function deleteStaff(staffId, staffName) {
        if (!window.confirm(`Are you sure you want to delete ${staffName}? This action cannot be undone.`)) {
            return;
        }
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await api.delete(`/staff-roles/staff/${staffId}`);
            setSuccess('Staff member deleted successfully.');
            await loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete staff member.');
        } finally {
            setSaving(false);
        }
    }

    async function createStaff(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/staff-roles/staff', {
                staff_name: staffForm.staff_name,
                staff_code: staffForm.staff_code,
                staff_type: staffForm.staff_type,
                branch_id: staffForm.branch_id ? Number(staffForm.branch_id) : undefined,
                role_ids: staffForm.role_ids
            });
            setSuccess('Staff member added.');
            setAddingStaff(false);
            await loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add staff member.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h2><Users size={24} /> Staff & Roles</h2>
                    <p>Configure branch-scoped staff profiles, assigned roles, and global permission templates.</p>
                </div>
            </div>

            {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
            {success && <Alert type="success" dismissible onDismiss={() => setSuccess('')}>{success}</Alert>}

            <section className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Role Management</h3>
                <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        className="form-control"
                        style={{ maxWidth: 320 }}
                        placeholder="NEW_ROLE_NAME"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value.toUpperCase())}
                        disabled={!canConfigureRoles || saving}
                    />
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={createRole}
                        disabled={!canConfigureRoles || saving || !newRoleName.trim()}
                    >
                        Add Role
                    </button>
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={deleteSelectedRole}
                        disabled={
                            !canConfigureRoles
                            || saving
                            || !selectedRoleId
                            || protectedRoleNames.includes((roles.find((r) => String(r.role_id) === String(selectedRoleId)) || {}).role_name)
                        }
                    >
                        Delete Selected Role
                    </button>
                </div>
                <p className="text-muted" style={{ marginTop: 8, marginBottom: 0 }}>
                    Admin can add custom roles and configure permissions from the panel below. Base roles cannot be deleted.
                </p>
            </section>

            <PermissionPanel
                roles={roles}
                selectedRoleId={selectedRoleId}
                setSelectedRoleId={setSelectedRoleId}
                permissionGroups={meta?.permission_groups || {}}
                onSave={saveRolePermissions}
                saving={saving}
                canConfigure={canConfigureRoles}
            />

            <section className="card">
                <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>Staff Configuration</h3>
                    <button className="btn btn-primary btn-sm" onClick={beginAddStaff} disabled={!canManageStaff}>
                        Add Staff
                    </button>
                </div>
                <div className="table-wrap" style={{ maxHeight: 520, overflow: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Staff ID</th>
                                <th>Name</th>
                                <th>Code</th>
                                <th>Type</th>
                                <th>Roles</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffRows.map((row) => (
                                <tr key={row.staff_id}>
                                    <td>{row.staff_id}</td>
                                    <td>{row.staff_name || '-'}</td>
                                    <td>{row.staff_code || '-'}</td>
                                    <td>{row.staff_type === 'NON_TEACHING' ? 'Non-Teaching' : 'Teaching'}</td>
                                    <td>{(row.roles || []).map((r) => r.role_name).join(', ') || '-'}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => beginEdit(row)}>Edit</button>
                                            <button 
                                                className="btn btn-danger btn-sm" 
                                                onClick={() => deleteStaff(row.staff_id, row.staff_name)}
                                                disabled={saving}
                                                title="Delete staff member"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!staffRows.length && (
                                <tr>
                                    <td colSpan={6} className="text-muted text-center" style={{ padding: 16 }}>No staff profiles found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {addingStaff && (
                <div className="modal-overlay" onClick={() => setAddingStaff(false)}>
                    <div className="modal" style={{ minWidth: 560 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add Staff Member</h3>
                            <button type="button" className="modal-close" onClick={() => setAddingStaff(false)}>×</button>
                        </div>
                        <form onSubmit={createStaff} className="flex-col gap-3">
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input
                                        className="form-control"
                                        value={staffForm.staff_name}
                                        onChange={(e) => setStaffForm((prev) => ({ ...prev, staff_name: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Code</label>
                                    <input
                                        className="form-control"
                                        value={staffForm.staff_code}
                                        onChange={(e) => setStaffForm((prev) => ({ ...prev, staff_code: e.target.value.toUpperCase() }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Type</label>
                                <select
                                    className="form-control"
                                    value={staffForm.staff_type}
                                    onChange={(e) => setStaffForm((prev) => ({ ...prev, staff_type: e.target.value }))}
                                    required
                                >
                                    <option value="TEACHING">Teaching</option>
                                    <option value="NON_TEACHING">Non-Teaching</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Branch</label>
                                <select
                                    className="form-control"
                                    value={staffForm.branch_id}
                                    disabled={!(meta?.current_user?.roles || []).includes('ADMIN')}
                                    onChange={(e) => setStaffForm((prev) => ({ ...prev, branch_id: e.target.value }))}
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
                                            const checked = staffForm.role_ids.includes(Number(role.role_id));
                                            return (
                                                <label key={role.role_id} className="flex gap-2" style={{ alignItems: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            const roleId = Number(role.role_id);
                                                            setStaffForm((prev) => ({
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
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setAddingStaff(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    <Save size={14} /> {saving ? 'Saving…' : 'Add Staff'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingStaff && (
                <div className="modal-overlay" onClick={() => setEditingStaff(null)}>
                    <div className="modal" style={{ minWidth: 560 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Edit Staff Profile</h3>
                            <button type="button" className="modal-close" onClick={() => setEditingStaff(null)}>×</button>
                        </div>
                        <form onSubmit={saveStaffEdit} className="flex-col gap-3">
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input
                                        className="form-control"
                                        value={staffForm.staff_name}
                                        onChange={(e) => setStaffForm((prev) => ({ ...prev, staff_name: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Code</label>
                                    <input
                                        className="form-control"
                                        value={staffForm.staff_code}
                                        onChange={(e) => setStaffForm((prev) => ({ ...prev, staff_code: e.target.value.toUpperCase() }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Type</label>
                                <select
                                    className="form-control"
                                    value={staffForm.staff_type}
                                    onChange={(e) => setStaffForm((prev) => ({ ...prev, staff_type: e.target.value }))}
                                    required
                                >
                                    <option value="TEACHING">Teaching</option>
                                    <option value="NON_TEACHING">Non-Teaching</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Branch</label>
                                <select
                                    className="form-control"
                                    value={staffForm.branch_id}
                                    disabled={!(meta?.current_user?.roles || []).includes('ADMIN')}
                                    onChange={(e) => setStaffForm((prev) => ({ ...prev, branch_id: e.target.value }))}
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
                                <div
                                    className="card"
                                    style={{ padding: 10, maxHeight: 180, overflow: 'auto', borderRadius: 10 }}
                                >
                                    <div className="grid-2" style={{ rowGap: 8 }}>
                                        {roles.map((role) => {
                                            const checked = staffForm.role_ids.includes(Number(role.role_id));
                                            return (
                                                <label key={role.role_id} className="flex gap-2" style={{ alignItems: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            const roleId = Number(role.role_id);
                                                            setStaffForm((prev) => ({
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
                                <small className="text-muted">You can select multiple roles.</small>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingStaff(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    <Save size={14} /> {saving ? 'Saving…' : 'Save Staff'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
