import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Upload, Save, Plus, Trash2, RefreshCcw } from 'lucide-react';
import api from '../../api';
import Alert from '../../components/Alert';

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const emptyForm = {
    branch_id: '',
    year: 'SE',
    semester_number: 3,
    subject_code: '',
    subject_name: '',
    abbreviation: '',
    is_theory: true,
    is_lab: false,
    is_project: false,
    is_elective: false
};

export default function CurriculumSettings() {
    const [branches, setBranches] = useState([]);
    const [rows, setRows] = useState([]);
    const [rules, setRules] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('');
    const [importBranch, setImportBranch] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [editForm, setEditForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [currentSemesterType, setCurrentSemesterType] = useState('ODD');
    const [ruleDraft, setRuleDraft] = useState({
        ODD: { start_month: 7, end_month: 11 },
        EVEN: { start_month: 1, end_month: 5 }
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [uploadErrors, setUploadErrors] = useState([]);

    useEffect(() => {
        loadAll();
    }, []);

    async function loadAll() {
        setError('');
        try {
            const [branchesRes, curriculumRes, rulesRes] = await Promise.all([
                api.get('/branches'),
                api.get('/curriculum'),
                api.get('/curriculum/rules')
            ]);
            setBranches(branchesRes.data);
            setRows(curriculumRes.data);
            setRules(rulesRes.data.rules || []);
            setCurrentSemesterType(rulesRes.data.current_semester_type || 'ODD');

            const nextDraft = {
                ODD: { start_month: 7, end_month: 11 },
                EVEN: { start_month: 1, end_month: 5 }
            };
            (rulesRes.data.rules || []).forEach((rule) => {
                nextDraft[rule.semester_type] = {
                    start_month: rule.start_month,
                    end_month: rule.end_month
                };
            });
            setRuleDraft(nextDraft);

            if (!form.branch_id && branchesRes.data.length) {
                setForm((prev) => ({ ...prev, branch_id: String(branchesRes.data[0].branch_id) }));
            }
            if (!importBranch && branchesRes.data.length) {
                setImportBranch(String(branchesRes.data[0].branch_id));
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load curriculum settings.');
        }
    }

    const filteredRows = useMemo(() => {
        return rows.filter((row) => {
            const branchMatch = selectedBranch ? String(row.branch_id) === selectedBranch : true;
            const q = search.trim().toLowerCase();
            const textMatch = !q
                ? true
                : `${row.subject_code} ${row.subject_name} ${row.abbreviation || ''} ${row.year}`
                    .toLowerCase()
                    .includes(q);
            return branchMatch && textMatch;
        });
    }, [rows, selectedBranch, search]);

    function getSortValue(row, key) {
        switch (key) {
            case 'branch_name':
                return row.branch_name || '';
            case 'year':
                return { SE: 1, TE: 2, BE: 3 }[row.year] || 999;
            case 'semester_number':
                return Number(row.semester_number || 0);
            case 'subject_code':
                return row.subject_code || '';
            case 'subject_name':
                return row.subject_name || '';
            case 'abbreviation':
                return row.abbreviation || '';
            case 'type':
                if (row.is_project) return 'Project';
                if (row.is_lab) return 'Lab';
                return 'Theory';
            case 'elective':
                return row.is_elective ? 'Yes' : 'No';
            default:
                return '';
        }
    }

    const sortedRows = useMemo(() => {
        if (!sortConfig.key) return filteredRows;

        const sorted = [...filteredRows];
        sorted.sort((a, b) => {
            const aVal = getSortValue(a, sortConfig.key);
            const bVal = getSortValue(b, sortConfig.key);

            let compare = 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                compare = aVal - bVal;
            } else {
                compare = String(aVal).localeCompare(String(bVal), undefined, {
                    numeric: true,
                    sensitivity: 'base'
                });
            }

            return sortConfig.direction === 'asc' ? compare : -compare;
        });

        return sorted;
    }, [filteredRows, sortConfig]);

    function toggleSort(key) {
        setSortConfig((prev) => {
            if (prev.key === key) {
                return {
                    key,
                    direction: prev.direction === 'asc' ? 'desc' : 'asc'
                };
            }

            return { key, direction: 'asc' };
        });
    }

    function sortIndicator(key) {
        return <span aria-hidden="true">↕</span>;
    }

    const headerSortButtonStyle = {
        background: 'none',
        border: 'none',
        padding: 0,
        font: 'inherit',
        fontWeight: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
    };

    function resetForm() {
        setForm((prev) => ({
            ...emptyForm,
            branch_id: prev.branch_id || (branches[0] ? String(branches[0].branch_id) : '')
        }));
    }

    async function saveSubject(e) {
        e.preventDefault();
        setError('');
        setSuccess('');
        setUploadErrors([]);
        setLoading(true);
        try {
            const payload = {
                ...form,
                branch_id: Number(form.branch_id),
                semester_number: Number(form.semester_number)
            };

            await api.post('/curriculum', payload);
            setSuccess('Curriculum subject added.');

            resetForm();
            const listRes = await api.get('/curriculum');
            setRows(listRes.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save curriculum subject.');
        } finally {
            setLoading(false);
        }
    }

    function beginEdit(row) {
        setEditingId(row.curriculum_id);
        setEditForm({
            branch_id: String(row.branch_id),
            year: row.year,
            semester_number: row.semester_number,
            subject_code: row.subject_code,
            subject_name: row.subject_name,
            abbreviation: row.abbreviation || '',
            is_theory: row.is_theory,
            is_lab: row.is_lab || false,
            is_project: row.is_project || false,
            is_elective: row.is_elective
        });
    }

    function closeEditModal() {
        setEditingId(null);
        setEditForm(emptyForm);
    }

    async function saveEditedSubject(e) {
        e.preventDefault();
        if (!editingId) return;

        setError('');
        setSuccess('');
        setUploadErrors([]);
        setLoading(true);
        try {
            const payload = {
                ...editForm,
                branch_id: Number(editForm.branch_id),
                semester_number: Number(editForm.semester_number)
            };

            await api.put(`/curriculum/${editingId}`, payload);
            setSuccess('Curriculum subject updated.');
            closeEditModal();

            const listRes = await api.get('/curriculum');
            setRows(listRes.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save curriculum subject.');
        } finally {
            setLoading(false);
        }
    }

    function requestRemoveSubject(row) {
        setDeleteTarget(row);
    }

    async function removeSubject() {
        if (!deleteTarget?.curriculum_id) return;
        setError('');
        setSuccess('');
        setUploadErrors([]);
        setLoading(true);
        try {
            await api.delete(`/curriculum/${deleteTarget.curriculum_id}`);
            const listRes = await api.get('/curriculum');
            setRows(listRes.data);
            setSuccess('Curriculum subject deleted.');
            setDeleteTarget(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete curriculum subject.');
        } finally {
            setLoading(false);
        }
    }

    async function importCurriculumFile() {
        if (!uploadFile || !importBranch) {
            setError('Select a branch and upload a CSV/XLSX file.');
            return;
        }

        const maxBytes = 10 * 1024 * 1024;
        const fileName = String(uploadFile.name || '').toLowerCase();
        const hasValidExtension = fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        if (!hasValidExtension) {
            setError('Invalid file type. Please upload a CSV, XLS, or XLSX file.');
            return;
        }
        if (uploadFile.size > maxBytes) {
            setError('File is too large. Please upload a file smaller than 10 MB.');
            return;
        }

        setError('');
        setSuccess('');
        setUploadErrors([]);
        setLoading(true);
        try {
            const body = new FormData();
            body.append('file', uploadFile);
            const res = await api.post(`/curriculum/import/${importBranch}`, body, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const listRes = await api.get('/curriculum');
            setRows(listRes.data);
            setUploadFile(null);
            setSuccess(`Import complete. ${res.data.imported} rows synced.`);
        } catch (err) {
            const details = err.response?.data?.details;
            const fallback = err.response?.data?.error || 'Import failed.';
            if (Array.isArray(details) && details.length) {
                setError('Import failed. Please review the issues below.');
                setUploadErrors(details);
            } else {
                setError(fallback);
            }
        } finally {
            setLoading(false);
        }
    }

    async function saveRule(semesterType) {
        setError('');
        setSuccess('');
        setUploadErrors([]);
        setLoading(true);
        try {
            await api.put(`/curriculum/rules/${semesterType}`, {
                semester_type: semesterType,
                start_month: Number(ruleDraft[semesterType].start_month),
                end_month: Number(ruleDraft[semesterType].end_month)
            });

            const rulesRes = await api.get('/curriculum/rules');
            setRules(rulesRes.data.rules || []);
            setCurrentSemesterType(rulesRes.data.current_semester_type || 'ODD');
            setSuccess(`${semesterType} semester rule saved.`);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save semester rule.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h2>
                        <BookOpen size={24} /> Curriculum Settings
                    </h2>
                    <p>Manage branch-wise subjects and semester rules for internal timetable generation.</p>
                </div>
                <button className="btn btn-secondary" onClick={loadAll}>
                    <RefreshCcw size={14} /> Refresh
                </button>
            </div>

            {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
            {success && <Alert type="success" dismissible onDismiss={() => setSuccess('')}>{success}</Alert>}
            {uploadErrors.length > 0 && (
                <Alert type="error" dismissible onDismiss={() => setUploadErrors([])}>
                    <div style={{ marginBottom: 6 }}>Upload errors:</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {uploadErrors.slice(0, 10).map((item, idx) => (
                            <li key={`${item}-${idx}`}>{item}</li>
                        ))}
                    </ul>
                    {uploadErrors.length > 10 && (
                        <div style={{ marginTop: 6 }}>
                            ...and {uploadErrors.length - 10} more issue(s).
                        </div>
                    )}
                </Alert>
            )}

            <div className="grid-2 curriculum-admin-grid" style={{ marginBottom: 16 }}>
                <section className="card">
                    <h3 style={{ marginBottom: 12 }}>Add Subject</h3>
                    <form onSubmit={saveSubject} className="flex-col gap-3">
                        <div className="grid-2">
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
                                        <option key={b.branch_id} value={b.branch_id}>
                                            {b.branch_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Year</label>
                                <select
                                    className="form-control"
                                    value={form.year}
                                    onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                                    required
                                >
                                    <option value="SE">SE</option>
                                    <option value="TE">TE</option>
                                    <option value="BE">BE</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Semester (1-8)</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    min={1}
                                    max={8}
                                    value={form.semester_number}
                                    onChange={(e) => setForm((prev) => ({ ...prev, semester_number: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subject Code</label>
                                <input
                                    className="form-control"
                                    value={form.subject_code}
                                    onChange={(e) => setForm((prev) => ({ ...prev, subject_code: e.target.value.toUpperCase() }))}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Subject Name</label>
                            <input
                                className="form-control"
                                value={form.subject_name}
                                onChange={(e) => setForm((prev) => ({ ...prev, subject_name: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Abbreviation</label>
                                <input
                                    className="form-control"
                                    value={form.abbreviation}
                                    onChange={(e) => setForm((prev) => ({ ...prev, abbreviation: e.target.value.toUpperCase() }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subject Type</label>
                                <select
                                    className="form-control"
                                    value={form.is_project ? 'project' : form.is_lab ? 'lab' : 'theory'}
                                    onChange={(e) => {
                                        const nextType = e.target.value;
                                        setForm((prev) => ({
                                            ...prev,
                                            is_theory: nextType === 'theory',
                                            is_lab: nextType === 'lab',
                                            is_project: nextType === 'project'
                                        }));
                                    }}
                                >
                                    <option value="theory">Theory</option>
                                    <option value="lab">Lab</option>
                                    <option value="project">Project</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Elective</label>
                            <select
                                className="form-control"
                                value={form.is_elective ? 'yes' : 'no'}
                                onChange={(e) => setForm((prev) => ({ ...prev, is_elective: e.target.value === 'yes' }))}
                            >
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                <Save size={14} /> Add Subject
                            </button>
                        </div>
                    </form>
                </section>

                <section className="card">
                    <h3 style={{ marginBottom: 12 }}>Smart Importer (CSV/XLSX)</h3>
                    <div className="flex-col gap-3">
                        <div className="form-group">
                            <label className="form-label">Upload Branch</label>
                            <select
                                className="form-control"
                                value={importBranch}
                                onChange={(e) => setImportBranch(e.target.value)}
                            >
                                {branches.map((b) => (
                                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">File</label>
                            <input
                                type="file"
                                className="form-control"
                                accept=".csv,.xlsx,.xls"
                                onChange={(e) => {
                                    setUploadErrors([]);
                                    setError('');
                                    setUploadFile(e.target.files?.[0] || null);
                                }}
                            />
                        </div>
                        <button className="btn btn-primary" onClick={importCurriculumFile} disabled={loading || !uploadFile}>
                            <Upload size={14} /> Import And Sync
                        </button>
                        <p className="text-muted" style={{ marginTop: 6 }}>
                            Upsert is based on subject_code. Unknown Branch Name values in file trigger validation errors.
                        </p>
                    </div>
                </section>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h3>Subject Manager</h3>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                        <input
                            className="form-control"
                            style={{ minWidth: 240 }}
                            placeholder="Search subject code, name, abbreviation"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <select className="form-control" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
                            <option value="">All branches</option>
                            {branches.map((b) => (
                                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="table-wrap" style={{ marginTop: 12, maxHeight: 500, overflow: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>
                                    <button type="button" onClick={() => toggleSort('branch_name')} style={headerSortButtonStyle}>
                                        <span>Branch</span>{sortIndicator('branch_name')}
                                    </button>
                                </th>
                                <th>
                                    <button type="button" onClick={() => toggleSort('year')} style={headerSortButtonStyle}>
                                        <span>Year</span>{sortIndicator('year')}
                                    </button>
                                </th>
                                <th>
                                    <button type="button" onClick={() => toggleSort('semester_number')} style={headerSortButtonStyle}>
                                        <span>Sem</span>{sortIndicator('semester_number')}
                                    </button>
                                </th>
                                <th>
                                    <button type="button" onClick={() => toggleSort('subject_code')} style={headerSortButtonStyle}>
                                        <span>Code</span>{sortIndicator('subject_code')}
                                    </button>
                                </th>
                                <th>
                                    <button type="button" onClick={() => toggleSort('subject_name')} style={headerSortButtonStyle}>
                                        <span>Subject Name</span>{sortIndicator('subject_name')}
                                    </button>
                                </th>
                                <th>
                                    <button type="button" onClick={() => toggleSort('abbreviation')} style={headerSortButtonStyle}>
                                        <span>Abbr</span>{sortIndicator('abbreviation')}
                                    </button>
                                </th>
                                <th>
                                    <button type="button" onClick={() => toggleSort('type')} style={headerSortButtonStyle}>
                                        <span>Type</span>{sortIndicator('type')}
                                    </button>
                                </th>
                                <th>
                                    <button type="button" onClick={() => toggleSort('elective')} style={headerSortButtonStyle}>
                                        <span>Elective</span>{sortIndicator('elective')}
                                    </button>
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRows.map((row) => (
                                <tr key={row.curriculum_id}>
                                    <td>{row.branch_name}</td>
                                    <td>{row.year}</td>
                                    <td>{row.semester_number}</td>
                                    <td><strong>{row.subject_code}</strong></td>
                                    <td>{row.subject_name}</td>
                                    <td>{row.abbreviation || '-'}</td>
                                    <td>{row.is_project ? 'Project' : row.is_lab ? 'Lab' : 'Theory'}</td>
                                    <td>{row.is_elective ? 'Yes' : 'No'}</td>
                                    <td>
                                        <div className="flex gap-2">
                                            <button className="btn btn-secondary btn-sm" onClick={() => beginEdit(row)}>
                                                <Plus size={14} /> Edit
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => requestRemoveSubject(row)}>
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!sortedRows.length && (
                                <tr>
                                    <td colSpan={9} className="text-center text-muted" style={{ padding: 20 }}>
                                        No curriculum rows found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {editingId && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div className="modal" style={{ minWidth: 560 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Edit Subject</h3>
                            <button type="button" className="modal-close" onClick={closeEditModal}>×</button>
                        </div>

                        <form onSubmit={saveEditedSubject} className="flex-col gap-3">
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Branch</label>
                                    <select
                                        className="form-control"
                                        value={editForm.branch_id}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, branch_id: e.target.value }))}
                                        required
                                    >
                                        <option value="">Select branch</option>
                                        {branches.map((b) => (
                                            <option key={b.branch_id} value={b.branch_id}>
                                                {b.branch_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Year</label>
                                    <select
                                        className="form-control"
                                        value={editForm.year}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, year: e.target.value }))}
                                        required
                                    >
                                        <option value="SE">SE</option>
                                        <option value="TE">TE</option>
                                        <option value="BE">BE</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Semester (1-8)</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        min={1}
                                        max={8}
                                        value={editForm.semester_number}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, semester_number: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Subject Code</label>
                                    <input
                                        className="form-control"
                                        value={editForm.subject_code}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, subject_code: e.target.value.toUpperCase() }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Subject Name</label>
                                <input
                                    className="form-control"
                                    value={editForm.subject_name}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, subject_name: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Abbreviation</label>
                                    <input
                                        className="form-control"
                                        value={editForm.abbreviation}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, abbreviation: e.target.value.toUpperCase() }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Subject Type</label>
                                    <select
                                        className="form-control"
                                        value={editForm.is_project ? 'project' : editForm.is_lab ? 'lab' : 'theory'}
                                        onChange={(e) => {
                                            const nextType = e.target.value;
                                            setEditForm((prev) => ({
                                                ...prev,
                                                is_theory: nextType === 'theory',
                                                is_lab: nextType === 'lab',
                                                is_project: nextType === 'project'
                                            }));
                                        }}
                                    >
                                        <option value="theory">Theory</option>
                                        <option value="lab">Lab</option>
                                        <option value="project">Project</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Elective</label>
                                <select
                                    className="form-control"
                                    value={editForm.is_elective ? 'yes' : 'no'}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, is_elective: e.target.value === 'yes' }))}
                                >
                                    <option value="no">No</option>
                                    <option value="yes">Yes</option>
                                </select>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    <Save size={14} /> Update Subject
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteTarget && (
                <div className="modal-overlay" onClick={() => !loading && setDeleteTarget(null)}>
                    <div className="modal" style={{ width: '92vw', maxWidth: 480, minWidth: 'unset' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header" style={{ marginBottom: 12 }}>
                            <h3>Delete Subject</h3>
                            <button type="button" className="modal-close" onClick={() => setDeleteTarget(null)} disabled={loading}>×</button>
                        </div>
                        <p className="text-muted" style={{ fontSize: 13, marginBottom: 14 }}>
                            This will permanently remove the selected curriculum subject and cannot be undone.
                        </p>
                        <div
                            style={{
                                background: 'var(--bg-2)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '10px 12px',
                                marginBottom: 14,
                                fontSize: 13,
                                color: 'var(--text)'
                            }}
                        >
                            <strong>{deleteTarget.subject_code}</strong> - {deleteTarget.subject_name}
                        </div>
                        <div className="modal-footer" style={{ marginTop: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setDeleteTarget(null)}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={removeSubject}
                                disabled={loading}
                            >
                                {loading ? 'Deleting...' : 'Delete Subject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                <h3 style={{ marginBottom: 6 }}>Semester Rules</h3>
                <p className="text-muted" style={{ marginBottom: 14 }}>
                    Current semester mode from rules + current date: <strong>{currentSemesterType}</strong>
                </p>
                <div className="grid-2">
                    {['ODD', 'EVEN'].map((semesterType) => (
                        <div key={semesterType} className="curriculum-rule-box">
                            <h4 style={{ marginBottom: 10 }}>{semesterType} Semester</h4>
                            <div className="grid-2" style={{ marginBottom: 10 }}>
                                <div className="form-group">
                                    <label className="form-label">Start Month</label>
                                    <select
                                        className="form-control"
                                        value={ruleDraft[semesterType].start_month}
                                        onChange={(e) => setRuleDraft((prev) => ({
                                            ...prev,
                                            [semesterType]: {
                                                ...prev[semesterType],
                                                start_month: Number(e.target.value)
                                            }
                                        }))}
                                    >
                                        {MONTH_ABBREV.map((month, idx) => (
                                            <option key={idx} value={idx + 1}>{month}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">End Month</label>
                                    <select
                                        className="form-control"
                                        value={ruleDraft[semesterType].end_month}
                                        onChange={(e) => setRuleDraft((prev) => ({
                                            ...prev,
                                            [semesterType]: {
                                                ...prev[semesterType],
                                                end_month: Number(e.target.value)
                                            }
                                        }))}
                                    >
                                        {MONTH_ABBREV.map((month, idx) => (
                                            <option key={idx} value={idx + 1}>{month}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={() => saveRule(semesterType)} disabled={loading}>
                                <Save size={14} /> Save {semesterType}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
