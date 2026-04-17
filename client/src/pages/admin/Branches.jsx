import { useState, useEffect } from 'react';
import { Pencil, Trash2, GraduationCap, Settings, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import api from '../../api';

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

export default function Branches() {
    const [branches, setBranches] = useState([]);
    const [modal, setModal] = useState(null); // null | 'add' | 'config' | {branch data to edit}
    const [form, setForm] = useState({ branch_code: '', branch_name: '', assigned_floor: '', se_students: '', te_students: '', be_students: '', divisions: null });
    const [expandedYears, setExpandedYears] = useState({}); // Track which year accordions are open
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const floorOptions = [
        { value: '', label: 'Not Assigned' },
        { value: 'Ground Floor', label: 'Ground Floor' },
        { value: '1st Floor', label: '1st Floor' },
        { value: '2nd Floor', label: '2nd Floor' },
        { value: '3rd Floor', label: '3rd Floor' },
        { value: '4th Floor', label: '4th Floor' },
        { value: '5th Floor', label: '5th Floor' },
        { value: '6th Floor', label: '6th Floor' }
    ];

    useEffect(() => { load(); }, []);

    async function load() {
        try {
            const res = await api.get('/branch-config');
            setBranches(res.data);
        } catch (err) {
            setError('Failed to load branches.');
            console.error(err);
        }
    }

    function openAdd() {
        setForm({ branch_code: '', branch_name: '', assigned_floor: '', se_students: '0', te_students: '0', be_students: '0', divisions: null });
        setModal('add');
        setError('');
        setExpandedYears({});
    }

    function openEdit(branch) {
        setForm({
            branch_code: branch.branch_code,
            branch_name: branch.branch_name,
            assigned_floor: branch.assigned_floor || '',
            se_students: branch.se_students,
            te_students: branch.te_students,
            be_students: branch.be_students,
            divisions: null
        });
        setModal({ type: 'edit', ...branch });
        setError('');
        setExpandedYears({});
    }

    function openConfig(branch) {
        // Initialize divisions structure
        const divisions = branch.divisions || { SE: [], TE: [], BE: [] };
        
        setForm({
            branch_id: branch.branch_id,
            se_students: branch.se_students,
            te_students: branch.te_students,
            be_students: branch.be_students,
            divisions: divisions
        });
        setModal({ type: 'config', ...branch });
        setError('');
        setExpandedYears({});
    }
    
    // Division management functions
    function toggleYear(year) {
        setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
    }
    
    function addDivision(year) {
        const newDivisionName = String.fromCharCode(65 + form.divisions[year].length); // A, B, C...
        setForm(prev => ({
            ...prev,
            divisions: {
                ...prev.divisions,
                [year]: [...prev.divisions[year], { division: newDivisionName, count: 0 }]
            }
        }));
        setExpandedYears(prev => ({ ...prev, [year]: true })); // Expand year when adding division
    }
    
    function removeDivision(year, index) {
        setForm(prev => ({
            ...prev,
            divisions: {
                ...prev.divisions,
                [year]: prev.divisions[year].filter((_, i) => i !== index)
            }
        }));
    }
    
    function updateDivisionCount(year, index, count) {
        const updatedDivisions = [...form.divisions[year]];
        updatedDivisions[index] = { ...updatedDivisions[index], count: parseInt(count, 10) || 0 };
        setForm(prev => ({
            ...prev,
            divisions: {
                ...prev.divisions,
                [year]: updatedDivisions
            }
        }));
    }
    
    function updateDivisionName(year, index, name) {
        const updatedDivisions = [...form.divisions[year]];
        updatedDivisions[index] = { ...updatedDivisions[index], division: name.toUpperCase() };
        setForm(prev => ({
            ...prev,
            divisions: {
                ...prev.divisions,
                [year]: updatedDivisions
            }
        }));
    }
    
    function getTotalForYear(year) {
        if (!form.divisions || !form.divisions[year] || form.divisions[year].length === 0) {
            return parseInt(form[`${year.toLowerCase()}_students`], 10) || 0;
        }
        return form.divisions[year].reduce((sum, div) => sum + (parseInt(div.count, 10) || 0), 0);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (modal === 'add' || modal.type === 'edit') {
            if (!form.branch_code.trim() || !form.branch_name.trim()) {
                setError('Both branch code and name are required.');
                setLoading(false);
                return;
            }

            try {
                if (modal === 'add') {
                    await api.post('/branches', { branch_code: form.branch_code, branch_name: form.branch_name, assigned_floor: form.assigned_floor || null });
                } else {
                    await api.put(`/branches/${modal.branch_id}`, { branch_code: form.branch_code, branch_name: form.branch_name, assigned_floor: form.assigned_floor || null });
                }
                setModal(null);
                load();
            } catch (err) {
                setError(err.response?.data?.error || 'Error saving branch.');
            } finally {
                setLoading(false);
            }
        } else if (modal.type === 'config') {
            const se = parseInt(form.se_students, 10) || 0;
            const te = parseInt(form.te_students, 10) || 0;
            const be = parseInt(form.be_students, 10) || 0;

            if (se < 0 || te < 0 || be < 0) {
                setError('Student counts cannot be negative.');
                setLoading(false);
                return;
            }

            try {
                // Prepare divisions data (clean up empty divisions)
                let divisionsToSend = null;
                if (form.divisions) {
                    divisionsToSend = {
                        SE: form.divisions.SE.filter(d => d.count > 0),
                        TE: form.divisions.TE.filter(d => d.count > 0),
                        BE: form.divisions.BE.filter(d => d.count > 0)
                    };
                    
                    // If all divisions are empty, send null
                    if (divisionsToSend.SE.length === 0 && divisionsToSend.TE.length === 0 && divisionsToSend.BE.length === 0) {
                        divisionsToSend = null;
                    }
                }
                
                await api.put(`/branch-config/${modal.branch_id}`, {
                    se_students: se,
                    te_students: te,
                    be_students: be,
                    divisions: divisionsToSend
                });
                setModal(null);
                load();
            } catch (err) {
                setError(err.response?.data?.error || 'Error saving configuration.');
            } finally {
                setLoading(false);
            }
        }
    }

    async function handleDelete(branch) {
        if (!confirm(`Delete branch "${branch.branch_name}" (${branch.branch_code})?\n\nThis will also delete all associated student configuration data.`)) {
            return;
        }

        try {
            await api.delete(`/branches/${branch.branch_id}`);
            load();
        } catch (err) {
            setError(err.response?.data?.error || 'Error deleting branch.');
        }
    }

    const totalStudents = (branch) => {
        return branch.se_students + branch.te_students + branch.be_students;
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h2>
                        <GraduationCap size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                        Branch Management
                    </h2>
                    <p>Manage engineering branches and year-wise student counts</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>+ Add Branch</button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Branch Code</th>
                            <th>Branch Name</th>
                            <th>Assigned Floor</th>
                            <th style={{ textAlign: 'center' }}>SE</th>
                            <th style={{ textAlign: 'center' }}>TE</th>
                            <th style={{ textAlign: 'center' }}>BE</th>
                            <th style={{ textAlign: 'center' }}>Total</th>
                            <th style={{ width: 180 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {branches.map(branch => {
                            const isFE = branch.branch_code === 'FE';
                            return (
                                <tr key={branch.branch_id}>
                                    <td><strong>{branch.branch_code}</strong></td>
                                    <td>{branch.branch_name}</td>
                                    <td>
                                        {branch.assigned_floor ? (
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                background: 'var(--bg-2)',
                                                color: 'var(--primary)'
                                            }}>
                                                {branch.assigned_floor}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>Not assigned</span>
                                        )}
                                    </td>
                                    {isFE ? (
                                        <td colSpan="3" style={{ textAlign: 'center' }}>
                                            <span className="branch-student-pill branch-pill-se">
                                                {branch.se_students} students
                                            </span>
                                        </td>
                                    ) : (
                                        <>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="branch-student-pill branch-pill-se">
                                                    {branch.se_students}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="branch-student-pill branch-pill-te">
                                                    {branch.te_students}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="branch-student-pill branch-pill-be">
                                                    {branch.be_students}
                                                </span>
                                            </td>
                                        </>
                                    )}
                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                        {totalStudents(branch)}
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => openConfig(branch)}
                                                title="Configure student counts"
                                            >
                                                <Settings size={14} />
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => openEdit(branch)}
                                                title="Edit branch"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDelete(branch)}
                                                title="Delete branch"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {branches.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center text-muted" style={{ padding: 24 }}>
                                    No branches configured yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {modal && (
                <Modal
                    title={
                        modal === 'add' ? 'Add New Branch' :
                        modal.type === 'edit' ? 'Edit Branch' :
                        `Configure ${modal.branch_name} (${modal.branch_code})`
                    }
                    onClose={() => setModal(null)}
                >
                    {error && <div className="alert alert-error mb-4">{error}</div>}
                    <form className="form-stack" onSubmit={handleSubmit}>
                        {(modal === 'add' || modal.type === 'edit') ? (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Branch Code</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g., ME, EE, CSE"
                                        value={form.branch_code}
                                        onChange={(e) => setForm({ ...form, branch_code: e.target.value.toUpperCase() })}
                                        maxLength={50}
                                        required
                                    />
                                    <small className="text-muted">Short abbreviation (e.g., FE, ME, CSE)</small>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Branch Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g., Mechanical Engineering"
                                        value={form.branch_name}
                                        onChange={(e) => setForm({ ...form, branch_name: e.target.value })}
                                        maxLength={150}
                                        required
                                    />
                                    <small className="text-muted">Full branch name (max 150 characters)</small>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Assigned Floor (for Auto-Allocation)</label>
                                    <select
                                        className="form-input"
                                        value={form.assigned_floor}
                                        onChange={(e) => setForm({ ...form, assigned_floor: e.target.value })}
                                    >
                                        {floorOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <small className="text-muted">Preferred floor for seating auto-allocation</small>
                                </div>
                            </>
                        ) : (
                            <>
                                <>
                                    <div style={{ marginBottom: '16px' }}>
                                        <small className="text-muted" style={{ display: 'block', marginBottom: '12px' }}>
                                            {modal.branch_code === 'FE'
                                                ? 'Configure FE students. You can optionally split FE into divisions for internal cross-division pairing.'
                                                : 'Configure student counts by year. Click to expand and optionally split years into divisions.'}
                                        </small>
                                    </div>

                                    {(() => {
                                        const yearsToConfigure = modal.branch_code === 'FE' ? ['SE'] : ['SE', 'TE', 'BE'];
                                        const yearLabelMap = modal.branch_code === 'FE'
                                            ? { SE: 'First Year (FE)' }
                                            : { SE: 'Second Year', TE: 'Third Year', BE: 'Final Year' };

                                        return yearsToConfigure.map(year => {
                                            const yearLabel = yearLabelMap[year];
                                            const hasDivisions = form.divisions && form.divisions[year] && form.divisions[year].length > 0;
                                            const isExpanded = expandedYears[year];
                                            const totalCount = getTotalForYear(year);

                                            return (
                                                <div key={year} style={{
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '8px',
                                                    marginBottom: '12px',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div
                                                        onClick={() => toggleYear(year)}
                                                        style={{
                                                            padding: '12px 16px',
                                                            background: 'var(--bg-2)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            userSelect: 'none'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <strong style={{ fontSize: '14px' }}>{year} ({yearLabel})</strong>
                                                            {hasDivisions && (
                                                                <span style={{
                                                                    fontSize: '11px',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    background: 'var(--primary)',
                                                                    color: 'white'
                                                                }}>
                                                                    {form.divisions[year].length} division{form.divisions[year].length !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <span style={{ fontSize: '13px', fontWeight: '600' }}>
                                                                {totalCount} students
                                                            </span>
                                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div style={{ padding: '16px' }}>
                                                            {!hasDivisions ? (
                                                                <div className="form-group" style={{ marginBottom: '12px' }}>
                                                                    <label className="form-label" style={{ fontSize: '12px', marginBottom: '6px' }}>
                                                                        Total Students (No Divisions)
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        className="form-input"
                                                                        min="0"
                                                                        value={form[`${year.toLowerCase()}_students`]}
                                                                        onChange={(e) => setForm({ ...form, [`${year.toLowerCase()}_students`]: e.target.value })}
                                                                        placeholder="e.g., 60"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div style={{ marginBottom: '12px' }}>
                                                                    {form.divisions[year].map((div, index) => (
                                                                        <div key={index} style={{
                                                                            display: 'flex',
                                                                            gap: '8px',
                                                                            marginBottom: '8px',
                                                                            alignItems: 'flex-start'
                                                                        }}>
                                                                            <div style={{ flex: '0 0 80px' }}>
                                                                                <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Division</label>
                                                                                <input
                                                                                    type="text"
                                                                                    className="form-input"
                                                                                    value={div.division}
                                                                                    onChange={(e) => updateDivisionName(year, index, e.target.value)}
                                                                                    maxLength={10}
                                                                                    placeholder="A"
                                                                                    style={{ textAlign: 'center', fontWeight: '600' }}
                                                                                />
                                                                            </div>
                                                                            <div style={{ flex: 1 }}>
                                                                                <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Students</label>
                                                                                <input
                                                                                    type="number"
                                                                                    className="form-input"
                                                                                    min="0"
                                                                                    value={div.count}
                                                                                    onChange={(e) => updateDivisionCount(year, index, e.target.value)}
                                                                                    placeholder="0"
                                                                                />
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-danger btn-sm"
                                                                                onClick={() => removeDivision(year, index)}
                                                                                style={{ marginTop: '24px' }}
                                                                                title="Remove division"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <div style={{
                                                                        marginTop: '8px',
                                                                        padding: '8px',
                                                                        background: 'var(--bg-2)',
                                                                        borderRadius: '6px',
                                                                        fontSize: '12px'
                                                                    }}>
                                                                        Total: <strong>{totalCount}</strong> students across {form.divisions[year].length} division{form.divisions[year].length !== 1 ? 's' : ''}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                {!hasDivisions ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-secondary btn-sm"
                                                                        onClick={() => {
                                                                            // Convert flat count to division A
                                                                            const currentCount = parseInt(form[`${year.toLowerCase()}_students`], 10) || 0;
                                                                            setForm(prev => ({
                                                                                ...prev,
                                                                                divisions: {
                                                                                    ...prev.divisions,
                                                                                    [year]: [{ division: 'A', count: currentCount }]
                                                                                }
                                                                            }));
                                                                        }}
                                                                        style={{ fontSize: '11px', padding: '6px 12px' }}
                                                                    >
                                                                        <Plus size={12} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                                                                        Split into Divisions
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-secondary btn-sm"
                                                                            onClick={() => addDivision(year)}
                                                                            style={{ fontSize: '11px', padding: '6px 12px' }}
                                                                        >
                                                                            <Plus size={12} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                                                                            Add Division
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-secondary btn-sm"
                                                                            onClick={() => {
                                                                                // Merge all divisions back to flat count
                                                                                const total = form.divisions[year].reduce((sum, d) => sum + (parseInt(d.count, 10) || 0), 0);
                                                                                setForm(prev => ({
                                                                                    ...prev,
                                                                                    [`${year.toLowerCase()}_students`]: total,
                                                                                    divisions: {
                                                                                        ...prev.divisions,
                                                                                        [year]: []
                                                                                    }
                                                                                }));
                                                                            }}
                                                                            style={{ fontSize: '11px', padding: '6px 12px' }}
                                                                        >
                                                                            Merge to Flat Count
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}

                                    <div className="branch-total-preview" style={{ marginTop: '16px' }}>
                                        <small>
                                            {modal.branch_code === 'FE' ? (
                                                <>Total Students: <strong>{getTotalForYear('SE')}</strong> (FE: {getTotalForYear('SE')})</>
                                            ) : (
                                                <>Total Students: <strong>{
                                                    getTotalForYear('SE') + getTotalForYear('TE') + getTotalForYear('BE')
                                                }</strong> (SE: {getTotalForYear('SE')}, TE: {getTotalForYear('TE')}, BE: {getTotalForYear('BE')})</>
                                            )}
                                        </small>
                                    </div>
                                </>
                            </>
                        )}

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setModal(null)}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : 
                                    modal === 'add' ? 'Add Branch' :
                                    modal.type === 'edit' ? 'Save Changes' :
                                    'Save Configuration'
                                }
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
