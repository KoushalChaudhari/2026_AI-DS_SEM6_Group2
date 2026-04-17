import { useEffect, useMemo, useState } from 'react';
import api from '../../api';
import Alert from '../../components/Alert';

const EMPTY_PROFILE = {
    profile_name: '',
    semester: '3',
    iat_max: '',
    end_sem_max: '',
    tw_max: '',
    oral_pr_max: ''
};

const EMPTY_ALLOTMENT = {
    branch_id: '',
    pool_id: '',
    profile_id: '',
    student_count: ''
};

function normalizeNullableInt(value) {
    if (value === '' || value === null || value === undefined) return null;
    return Number(value);
}

export default function HonorsConfiguration() {
    const [branches, setBranches] = useState([]);
    const [honorsPool, setHonorsPool] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [allotments, setAllotments] = useState([]);

    const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
    const [allotmentForm, setAllotmentForm] = useState(EMPTY_ALLOTMENT);

    const [validationBranchId, setValidationBranchId] = useState('');
    const [validationSemester, setValidationSemester] = useState('3');
    const [validation, setValidation] = useState(null);
    const [selectedProfileId, setSelectedProfileId] = useState('');

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadAll();
    }, []);

    useEffect(() => {
        if (!validationBranchId || !validationSemester) {
            setValidation(null);
            return;
        }
        loadValidation(validationBranchId, validationSemester);
    }, [validationBranchId, validationSemester, allotments]);

    const semesterProfiles = useMemo(
        () => profiles.filter((p) => Number(p.semester) === Number(allotmentForm.profile_id ? profiles.find((row) => String(row.profile_id) === String(allotmentForm.profile_id))?.semester : p.semester)),
        [profiles, allotmentForm.profile_id]
    );

    const groupedAllotments = useMemo(() => {
        const groups = new Map();
        for (const row of allotments) {
            if (selectedProfileId && String(row.profile_id) !== String(selectedProfileId)) continue;
            const key = String(row.profile_id);
            const existing = groups.get(key) || {
                profile_id: row.profile_id,
                profile_name: row.profile_name,
                semester: row.semester,
                rows: [],
                total_students: 0
            };
            existing.rows.push(row);
            existing.total_students += Number(row.student_count || 0);
            groups.set(key, existing);
        }
        return Array.from(groups.values()).sort((a, b) => Number(a.semester) - Number(b.semester) || String(a.profile_name).localeCompare(String(b.profile_name)));
    }, [allotments, selectedProfileId]);

    async function loadAll() {
        setError('');
        try {
            const [branchRes, poolRes, profileRes, allotmentRes] = await Promise.allSettled([
                api.get('/branches'),
                api.get('/curriculum/subject-pool', { params: { type: 'HONORS' } }),
                api.get('/curriculum/honors/profiles'),
                api.get('/curriculum/honors/allotments')
            ]);

            const loadedBranches = branchRes.status === 'fulfilled' ? (branchRes.value.data || []) : [];
            setBranches(loadedBranches);
            setHonorsPool(poolRes.status === 'fulfilled' ? (poolRes.value.data || []) : []);
            setProfiles(profileRes.status === 'fulfilled' ? (profileRes.value.data || []) : []);
            setAllotments(allotmentRes.status === 'fulfilled' ? (allotmentRes.value.data || []) : []);

            if (loadedBranches.length && !validationBranchId) {
                setValidationBranchId(String(loadedBranches[0].branch_id));
                setAllotmentForm((prev) => ({ ...prev, branch_id: String(loadedBranches[0].branch_id) }));
            }

            const failed = [];
            if (branchRes.status === 'rejected') failed.push('branches');
            if (poolRes.status === 'rejected') failed.push('honors subject pool');
            if (profileRes.status === 'rejected') failed.push('honors profiles');
            if (allotmentRes.status === 'rejected') failed.push('honors allotments');

            if (failed.length) {
                setError(`Some honors data could not be loaded (${failed.join(', ')}).`);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load honors configuration data.');
        }
    }

    async function loadValidation(branchId, semester) {
        try {
            const res = await api.get('/curriculum/honors/population-validation', {
                params: {
                    branchId: Number(branchId),
                    semester: Number(semester)
                }
            });
            setValidation(res.data || null);
        } catch {
            setValidation(null);
        }
    }

    async function handleCreateProfile(e) {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            await api.post('/curriculum/honors/profiles', {
                profile_name: profileForm.profile_name,
                semester: Number(profileForm.semester),
                iat_max: normalizeNullableInt(profileForm.iat_max),
                end_sem_max: normalizeNullableInt(profileForm.end_sem_max),
                tw_max: normalizeNullableInt(profileForm.tw_max),
                oral_pr_max: normalizeNullableInt(profileForm.oral_pr_max)
            });
            setSuccess('Honors profile created.');
            setProfileForm(EMPTY_PROFILE);
            await loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create honors profile.');
        }
    }

    async function handleCreateAllotment(e) {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            await api.post('/curriculum/honors/allotments', {
                branch_id: Number(allotmentForm.branch_id),
                pool_id: Number(allotmentForm.pool_id),
                profile_id: Number(allotmentForm.profile_id),
                student_count: Number(allotmentForm.student_count)
            });
            setSuccess('Honors allotment created.');
            setAllotmentForm((prev) => ({ ...EMPTY_ALLOTMENT, branch_id: prev.branch_id }));
            await loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create honors allotment.');
        }
    }

    async function handleDeleteAllotment(allotmentId) {
        const confirmed = window.confirm('Delete this honors allotment?');
        if (!confirmed) return;

        setError('');
        setSuccess('');
        try {
            await api.delete(`/curriculum/honors/allotments/${allotmentId}`);
            setSuccess('Honors allotment deleted.');
            await loadAll();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete honors allotment.');
        }
    }

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 12 }}>
                <h2>Honors Configuration</h2>
                <div className="page-subtitle">Define shared honors assessment profiles and branch allotments with population checks.</div>
            </div>

            {error && <Alert type="error">{error}</Alert>}
            {success && <Alert type="success">{success}</Alert>}
            {validation?.exceeds_capacity && (
                <Alert type="error">
                    Honors population exceeds branch strength by {validation.excess_students} student(s). Honors total: {validation.honors_total}, capacity: {validation.capacity_total}.
                </Alert>
            )}

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Population Validation</h3>
                <div className="grid-2">
                    <div className="form-group">
                        <label className="form-label">Branch</label>
                        <select
                            className="form-control"
                            value={validationBranchId}
                            onChange={(e) => {
                                const value = e.target.value;
                                setValidationBranchId(value);
                                setAllotmentForm((prev) => ({ ...prev, branch_id: value }));
                            }}
                        >
                            <option value="">Select branch</option>
                            {branches.map((branch) => (
                                <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Semester</label>
                        <select className="form-control" value={validationSemester} onChange={(e) => setValidationSemester(e.target.value)}>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => <option key={sem} value={sem}>{sem}</option>)}
                        </select>
                    </div>
                </div>
                {validation && (
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                        Honors total: <strong>{validation.honors_total}</strong> | Branch strength: <strong>{validation.capacity_total}</strong>
                    </div>
                )}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Create Assessment Profile</h3>
                <form className="grid-3" onSubmit={handleCreateProfile}>
                    <div className="form-group">
                        <label className="form-label">Profile Name</label>
                        <input
                            className="form-control"
                            value={profileForm.profile_name}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, profile_name: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Semester</label>
                        <select
                            className="form-control"
                            value={profileForm.semester}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, semester: e.target.value }))}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => <option key={sem} value={sem}>{sem}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">IAT Max</label>
                        <input className="form-control" type="number" min="0" value={profileForm.iat_max} onChange={(e) => setProfileForm((prev) => ({ ...prev, iat_max: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">End Sem Max</label>
                        <input className="form-control" type="number" min="0" value={profileForm.end_sem_max} onChange={(e) => setProfileForm((prev) => ({ ...prev, end_sem_max: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">TW Max</label>
                        <input className="form-control" type="number" min="0" value={profileForm.tw_max} onChange={(e) => setProfileForm((prev) => ({ ...prev, tw_max: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Oral/PR Max</label>
                        <input className="form-control" type="number" min="0" value={profileForm.oral_pr_max} onChange={(e) => setProfileForm((prev) => ({ ...prev, oral_pr_max: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <button className="btn btn-primary" type="submit">Create Profile</button>
                    </div>
                </form>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Create Branch Allotment</h3>
                <form className="grid-4" onSubmit={handleCreateAllotment}>
                    <div className="form-group">
                        <label className="form-label">Branch</label>
                        <select className="form-control" value={allotmentForm.branch_id} onChange={(e) => setAllotmentForm((prev) => ({ ...prev, branch_id: e.target.value }))} required>
                            <option value="">Select branch</option>
                            {branches.map((branch) => <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Honors Subject</label>
                        <select className="form-control" value={allotmentForm.pool_id} onChange={(e) => setAllotmentForm((prev) => ({ ...prev, pool_id: e.target.value }))} required>
                            <option value="">Select honors subject</option>
                            {honorsPool.map((row) => <option key={row.pool_id} value={row.pool_id}>{row.course_code} - {row.course_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Assessment Profile</label>
                        <select className="form-control" value={allotmentForm.profile_id} onChange={(e) => setAllotmentForm((prev) => ({ ...prev, profile_id: e.target.value }))} required>
                            <option value="">Select profile</option>
                            {(semesterProfiles.length ? semesterProfiles : profiles).map((row) => (
                                <option key={row.profile_id} value={row.profile_id}>{row.profile_name} (Sem {row.semester})</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Student Count</label>
                        <input className="form-control" type="number" min="0" value={allotmentForm.student_count} onChange={(e) => setAllotmentForm((prev) => ({ ...prev, student_count: e.target.value }))} required />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <button className="btn btn-primary" type="submit">Create Allotment</button>
                    </div>
                </form>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Profile-Centered Group View</h3>
                <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Filter by Profile</label>
                    <select
                        className="form-control"
                        value={selectedProfileId}
                        onChange={(e) => setSelectedProfileId(e.target.value)}
                    >
                        <option value="">All Profiles</option>
                        {profiles.map((row) => (
                            <option key={row.profile_id} value={row.profile_id}>{row.profile_name} (Sem {row.semester})</option>
                        ))}
                    </select>
                </div>
                {!groupedAllotments.length && <div className="text-muted">No grouped honors allotments found.</div>}
                {groupedAllotments.map((group) => (
                    <div key={group.profile_id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <strong>{group.profile_name} (Sem {group.semester})</strong>
                            <span>Total Students: {group.total_students}</span>
                        </div>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Branch</th>
                                        <th>Subject</th>
                                        <th>Students</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.rows.map((row) => (
                                        <tr key={row.allotment_id}>
                                            <td>{row.branch_name}</td>
                                            <td>{row.course_code} - {row.course_name}</td>
                                            <td>{row.student_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card">
                <h3 style={{ marginBottom: 12 }}>Existing Honors Allotments</h3>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Branch</th>
                                <th>Subject</th>
                                <th>Profile</th>
                                <th>Semester</th>
                                <th>Students</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!allotments.length && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center' }}>No honors allotments configured.</td>
                                </tr>
                            )}
                            {allotments.map((row) => (
                                <tr key={row.allotment_id}>
                                    <td>{row.branch_name}</td>
                                    <td>{row.course_code} - {row.course_name}</td>
                                    <td>{row.profile_name}</td>
                                    <td>{row.semester}</td>
                                    <td>{row.student_count}</td>
                                    <td>
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteAllotment(row.allotment_id)}>
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
