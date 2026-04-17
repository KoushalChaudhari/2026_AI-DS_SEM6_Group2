import { useEffect, useMemo, useState } from 'react';
import api from '../../api';
import Alert from '../../components/Alert';

export default function ElectiveMappingManager() {
    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [semester, setSemester] = useState('3');
    const [placeholderSubjectId, setPlaceholderSubjectId] = useState('');
    const [poolId, setPoolId] = useState('');
    const [placeholders, setPlaceholders] = useState([]);
    const [electives, setElectives] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadStaticData();
    }, []);

    useEffect(() => {
        if (!selectedBranchId || !semester) return;
        loadBranchSemesterData(selectedBranchId, semester);
    }, [selectedBranchId, semester]);

    const selectedBranch = useMemo(
        () => branches.find((b) => String(b.branch_id) === String(selectedBranchId)),
        [branches, selectedBranchId]
    );

    async function loadStaticData() {
        setError('');
        try {
            const [branchRes, poolRes] = await Promise.all([
                api.get('/branches'),
                api.get('/curriculum/subject-pool', { params: { type: 'ELECTIVE' } })
            ]);

            const loadedBranches = branchRes.data || [];
            setBranches(loadedBranches);
            if (loadedBranches.length) {
                setSelectedBranchId(String(loadedBranches[0].branch_id));
            }
            setElectives(poolRes.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load mapping setup data.');
        }
    }

    async function loadBranchSemesterData(branchId, sem) {
        setError('');
        try {
            const [curriculumRes, mappingsRes] = await Promise.all([
                api.get('/curriculum', {
                    params: { branchId: Number(branchId), semester: Number(sem), examType: 'theory' }
                }),
                api.get('/curriculum/elective-mappings', {
                    params: { branchId: Number(branchId), semester: Number(sem) }
                })
            ]);

            const curriculumRows = curriculumRes.data || [];
            setPlaceholders(curriculumRows.filter((row) => row.is_placeholder));
            setMappings(mappingsRes.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load elective mappings.');
            setPlaceholders([]);
            setMappings([]);
        }
    }

    async function handleAddMapping(e) {
        e.preventDefault();
        if (!selectedBranchId || !semester || !placeholderSubjectId || !poolId) {
            setError('Select branch, semester, placeholder, and elective subject.');
            return;
        }

        setError('');
        setSuccess('');

        try {
            await api.post('/curriculum/elective-mappings', {
                branch_id: Number(selectedBranchId),
                semester: Number(semester),
                placeholder_subject_id: Number(placeholderSubjectId),
                pool_id: Number(poolId)
            });
            setSuccess('Elective mapping saved.');
            setPoolId('');
            await loadBranchSemesterData(selectedBranchId, semester);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save elective mapping.');
        }
    }

    async function handleDeleteMapping(mappingId) {
        const confirmed = window.confirm('Delete this mapping?');
        if (!confirmed) return;

        setError('');
        setSuccess('');

        try {
            await api.delete(`/curriculum/elective-mappings/${mappingId}`);
            setSuccess('Mapping deleted.');
            await loadBranchSemesterData(selectedBranchId, semester);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete mapping.');
        }
    }

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 12 }}>
                <h2>Elective Mapping</h2>
                <div className="page-subtitle">Replace placeholder rows with dynamic Open Elective subjects.</div>
            </div>

            {error && <Alert type="error">{error}</Alert>}
            {success && <Alert type="success">{success}</Alert>}

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Branch/Semester Context</h3>
                <div className="grid-2">
                    <div className="form-group">
                        <label className="form-label">Branch</label>
                        <select
                            className="form-control"
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(e.target.value)}
                        >
                            {branches.map((branch) => (
                                <option key={branch.branch_id} value={branch.branch_id}>
                                    {branch.branch_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Semester</label>
                        <select className="form-control" value={semester} onChange={(e) => setSemester(e.target.value)}>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                                <option key={sem} value={sem}>{sem}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Add Mapping</h3>
                <form className="grid-2" onSubmit={handleAddMapping}>
                    <div className="form-group">
                        <label className="form-label">Placeholder Subject</label>
                        <select
                            className="form-control"
                            value={placeholderSubjectId}
                            onChange={(e) => setPlaceholderSubjectId(e.target.value)}
                            required
                        >
                            <option value="">Select placeholder</option>
                            {placeholders.map((row) => (
                                <option key={row.subject_id} value={row.subject_id}>
                                    {row.course_code} - {row.course_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Elective Subject (Master Pool)</label>
                        <select
                            className="form-control"
                            value={poolId}
                            onChange={(e) => setPoolId(e.target.value)}
                            required
                        >
                            <option value="">Select elective subject</option>
                            {electives.map((row) => (
                                <option key={row.pool_id} value={row.pool_id}>
                                    {row.course_code} - {row.course_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <button className="btn btn-primary" type="submit">Save Mapping</button>
                    </div>
                </form>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: 12 }}>
                    Existing Mappings {selectedBranch ? `(${selectedBranch.branch_name} - Sem ${semester})` : ''}
                </h3>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Placeholder</th>
                                <th>Mapped Elective</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!mappings.length && (
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'center' }}>No mappings configured.</td>
                                </tr>
                            )}
                            {mappings.map((row) => (
                                <tr key={row.mapping_id}>
                                    <td>{row.placeholder_course_code} - {row.placeholder_course_name}</td>
                                    <td>{row.course_code} - {row.course_name}</td>
                                    <td>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleDeleteMapping(row.mapping_id)}
                                        >
                                            Delete
                                        </button>
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
