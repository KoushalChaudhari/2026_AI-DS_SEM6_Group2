import { useEffect, useMemo, useState } from 'react';
import api from '../../api';
import Alert from '../../components/Alert';

const EMPTY_FORM = {
    course_code: '',
    course_name: '',
    type: 'ELECTIVE'
};

export default function MasterPoolManager() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [importType, setImportType] = useState('ELECTIVE');
    const [importFile, setImportFile] = useState(null);
    const [importPreview, setImportPreview] = useState([]);
    const [importSummary, setImportSummary] = useState(null);
    const [importErrors, setImportErrors] = useState([]);

    useEffect(() => {
        loadRows();
    }, []);

    const sortedRows = useMemo(
        () => [...rows].sort((a, b) => String(a.course_code || '').localeCompare(String(b.course_code || ''))),
        [rows]
    );

    async function loadRows() {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/curriculum/subject-pool');
            setRows(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load subject pool.');
        } finally {
            setLoading(false);
        }
    }

    function startEdit(row) {
        setEditingId(row.pool_id);
        setForm({
            course_code: row.course_code || '',
            course_name: row.course_name || '',
            type: row.type || 'ELECTIVE'
        });
    }

    function resetForm() {
        setEditingId(null);
        setForm(EMPTY_FORM);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingId) {
                await api.put(`/curriculum/subject-pool/${editingId}`, form);
                setSuccess('Subject pool row updated.');
            } else {
                await api.post('/curriculum/subject-pool', form);
                setSuccess('Subject pool row created.');
            }
            resetForm();
            await loadRows();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save subject pool row.');
        }
    }

    async function handleDelete(poolId) {
        const confirmed = window.confirm('Delete this subject from master pool?');
        if (!confirmed) return;

        setError('');
        setSuccess('');
        try {
            await api.delete(`/curriculum/subject-pool/${poolId}`);
            setSuccess('Subject pool row deleted.');
            await loadRows();
            if (editingId === poolId) resetForm();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete subject pool row.');
        }
    }

    async function runImportPreview(file) {
        if (!file) return;

        setError('');
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post(`/curriculum/subject-pool/import/preview?type=${importType}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setImportSummary(res.data.summary || null);
            setImportPreview(res.data.preview || []);
            setImportErrors(res.data.row_errors || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to preview master pool import file.');
            setImportSummary(null);
            setImportPreview([]);
            setImportErrors([]);
        }
    }

    async function handleImport() {
        if (!importFile) {
            setError('Select a file to import.');
            return;
        }

        setError('');
        setSuccess('');

        try {
            const formData = new FormData();
            formData.append('file', importFile);

            const res = await api.post(`/curriculum/subject-pool/import?type=${importType}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSuccess(`Imported ${Number(res.data.imported || 0)} subject pool row(s).`);
            setImportSummary(res.data.summary || null);
            setImportErrors(res.data.row_errors || []);
            await loadRows();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to import subject pool file.');
        }
    }

    function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportFile(file);
        runImportPreview(file);
    }

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 12 }}>
                <h2>Master Pool Manager</h2>
                <div className="page-subtitle">Create reusable Open Elective and Honors subjects.</div>
            </div>

            {error && <Alert type="error">{error}</Alert>}
            {success && <Alert type="success">{success}</Alert>}

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>{editingId ? 'Edit Subject Pool Row' : 'Add Subject Pool Row'}</h3>
                <form className="grid-3" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Course Code</label>
                        <input
                            className="form-control"
                            value={form.course_code}
                            onChange={(e) => setForm((prev) => ({ ...prev, course_code: e.target.value.toUpperCase() }))}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Course Name</label>
                        <input
                            className="form-control"
                            value={form.course_name}
                            onChange={(e) => setForm((prev) => ({ ...prev, course_name: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Type</label>
                        <select
                            className="form-control"
                            value={form.type}
                            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                        >
                            <option value="ELECTIVE">ELECTIVE</option>
                            <option value="HONORS">HONORS</option>
                        </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" type="submit">{editingId ? 'Update' : 'Create'}</button>
                        {editingId && (
                            <button className="btn btn-secondary" type="button" onClick={resetForm}>Cancel Edit</button>
                        )}
                    </div>
                </form>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Bulk Import Subject Pool</h3>
                <div className="grid-3" style={{ gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Default Type</label>
                        <select
                            className="form-control"
                            value={importType}
                            onChange={(e) => setImportType(e.target.value)}
                        >
                            <option value="ELECTIVE">ELECTIVE</option>
                            <option value="HONORS">HONORS</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">File (.xlsx/.csv with course_code, course_name, optional type)</label>
                        <input
                            type="file"
                            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                            className="form-control"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => runImportPreview(importFile)} disabled={!importFile}>Preview</button>
                    <button type="button" className="btn btn-primary" onClick={handleImport} disabled={!importFile}>Import</button>
                </div>
                {importSummary && (
                    <div style={{ marginTop: 10, fontSize: 13 }}>
                        Total: {importSummary.total_rows} | Valid: {importSummary.valid_rows} | Failed: {importSummary.failed_rows}
                    </div>
                )}
                {importPreview.length > 0 && (
                    <div className="table-wrap" style={{ marginTop: 12 }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Name</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {importPreview.map((row, idx) => (
                                    <tr key={`${row.course_code}-${idx}`}>
                                        <td>{row.course_code}</td>
                                        <td>{row.course_name}</td>
                                        <td>{row.type}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {importErrors.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>
                        {importErrors.length} row(s) have validation errors and were skipped.
                    </div>
                )}
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3>Pool Subjects</h3>
                    <button type="button" className="btn btn-secondary" onClick={loadRows} disabled={loading}>Refresh</button>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!sortedRows.length && (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center' }}>
                                        {loading ? 'Loading...' : 'No subject pool rows found.'}
                                    </td>
                                </tr>
                            )}
                            {sortedRows.map((row) => (
                                <tr key={row.pool_id}>
                                    <td>{row.course_code}</td>
                                    <td>{row.course_name}</td>
                                    <td>{row.type}</td>
                                    <td style={{ display: 'flex', gap: 8 }}>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(row)}>Edit</button>
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(row.pool_id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
