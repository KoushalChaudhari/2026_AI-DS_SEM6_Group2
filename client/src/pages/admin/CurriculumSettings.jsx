import React, { useState, useEffect, useRef } from 'react';
import { Upload, Plus, Edit2, Trash2, BookOpen, RefreshCcw, Save, CalendarDays, FileUp, ListChecks, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../../api';
import Alert from '../../components/Alert';
import MasterPoolManager from './MasterPoolManager';
import ElectiveMappingManager from './ElectiveMappingManager';
import HonorsConfiguration from './HonorsConfiguration';

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CurriculumSettings() {
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [filteredSubjects, setFilteredSubjects] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [examTypeFilter, setExamTypeFilter] = useState('');
    const [semesterFilter, setSemesterFilter] = useState('');
    const [currentSemesterType, setCurrentSemesterType] = useState('ODD');
    const [ruleDraft, setRuleDraft] = useState({
        ODD: { start_month: 7, end_month: 11 },
        EVEN: { start_month: 1, end_month: 5 }
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // File upload state
    const [importFile, setImportFile] = useState(null);
    const [importMode, setImportMode] = useState('append'); // 'append' or 'replace'
    const [importPreview, setImportPreview] = useState([]);
    const [importLoading, setImportLoading] = useState(false);
    const [importPreviewLoading, setImportPreviewLoading] = useState(false);
    const [importError, setImportError] = useState('');
    const [importSummary, setImportSummary] = useState(null);
    const [importRowErrors, setImportRowErrors] = useState([]);
    const fileInputRef = useRef();

    // Form state for adding/editing
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        branch_id: '',
        semester: '',
        course_code: '',
        course_name: '',
        is_placeholder: false,
        subject_type: '',
        iat_max_marks: '',
        end_sem_max_marks: '',
        tw_max_marks: '',
        oral_pr_max_marks: '',
        total_max_marks: ''
    });
    const [formError, setFormError] = useState('');
    const [dynamicTab, setDynamicTab] = useState('master_pool');

    useEffect(() => {
        loadBranches();
        loadRules();
    }, []);

    useEffect(() => {
        if (selectedBranch) {
            loadSubjects();
        }
    }, [selectedBranch]);

    useEffect(() => {
        applyFilters();
    }, [subjects, searchTerm, examTypeFilter, semesterFilter]);

    async function loadBranches() {
        try {
            const res = await api.get('/branches');
            const nextBranches = res.data || [];
            setBranches(nextBranches);

            if (!nextBranches.length) {
                setSelectedBranch('');
                setSubjects([]);
                return;
            }

            const currentSelection = String(selectedBranch || '');
            const stillAvailable = currentSelection && nextBranches.some((branch) => String(branch.branch_id) === currentSelection);
            if (stillAvailable) {
                return;
            }

            for (const branch of nextBranches) {
                try {
                    const subjectRes = await api.get('/curriculum', {
                        params: { branchId: Number(branch.branch_id) }
                    });

                    if ((subjectRes.data || []).length) {
                        setSelectedBranch(String(branch.branch_id));
                        setSubjects(subjectRes.data || []);
                        return;
                    }
                } catch (subjectErr) {
                    continue;
                }
            }

            setSelectedBranch(String(nextBranches[0].branch_id));
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load branches.');
        }
    }

    async function loadRules() {
        try {
            const res = await api.get('/curriculum/rules');
            const nextDraft = {
                ODD: { start_month: 7, end_month: 11 },
                EVEN: { start_month: 1, end_month: 5 }
            };

            (res.data.rules || []).forEach((rule) => {
                nextDraft[rule.semester_type] = {
                    start_month: rule.start_month,
                    end_month: rule.end_month
                };
            });

            setCurrentSemesterType(res.data.current_semester_type || 'ODD');
            setRuleDraft(nextDraft);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load semester rules.');
        }
    }

    async function saveRule(semesterType) {
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            await api.put(`/curriculum/rules/${semesterType}`, {
                semester_type: semesterType,
                start_month: Number(ruleDraft[semesterType].start_month),
                end_month: Number(ruleDraft[semesterType].end_month)
            });
            await loadRules();
            setSuccess(`${semesterType} semester rule saved.`);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save semester rule.');
        } finally {
            setLoading(false);
        }
    }

    async function loadSubjects() {
        if (!selectedBranch) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/curriculum', {
                params: { branchId: Number(selectedBranch) }
            });
            setSubjects(res.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load subjects.');
        } finally {
            setLoading(false);
        }
    }

    function applyFilters() {
        let filtered = subjects;

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                String(s.course_code).toLowerCase().includes(search) ||
                String(s.course_name).toLowerCase().includes(search)
            );
        }

        if (examTypeFilter) {
            filtered = filtered.filter(s => inferSubjectType(s) === examTypeFilter);
        }

        if (semesterFilter) {
            filtered = filtered.filter(s => Number(s.semester) === Number(semesterFilter));
        }

        setFilteredSubjects(filtered);
    }

    function getAssessmentProfile(subject) {
        const chips = [];
        if (subject.iat_max_marks !== null && subject.iat_max_marks !== undefined) chips.push({ key: 'IA', value: subject.iat_max_marks });
        if (subject.end_sem_max_marks !== null && subject.end_sem_max_marks !== undefined) chips.push({ key: 'ES', value: subject.end_sem_max_marks });
        if (subject.tw_max_marks !== null && subject.tw_max_marks !== undefined) chips.push({ key: 'TW', value: subject.tw_max_marks });
        if (subject.oral_pr_max_marks !== null && subject.oral_pr_max_marks !== undefined) chips.push({ key: 'OP', value: subject.oral_pr_max_marks });
        return chips;
    }

    function inferSubjectType(subject) {
        const explicitType = String(subject.subject_type || '').toLowerCase();
        if (explicitType === 'theory' || explicitType === 'lab' || explicitType === 'project') {
            return explicitType;
        }

        const courseName = String(subject.course_name || '').toLowerCase();
        const endSem = Number(subject.end_sem_max_marks || 0);

        if (courseName.includes('mini project') || courseName.includes('major project') || courseName.includes('project')) {
            return 'project';
        }

        if (endSem > 0) return 'theory';

        return 'lab';
    }

    function getSubjectTypeMeta(subjectType) {
        switch (subjectType) {
            case 'project':
                return { label: 'Project', bg: '#f5e8ff', color: '#7e22ce' };
            case 'lab':
                return { label: 'Lab', bg: '#fef08a', color: '#92400e' };
            default:
                return { label: 'Theory', bg: '#dbeafe', color: '#1e40af' };
        }
    }

    function downloadImportErrors() {
        if (!importRowErrors.length) return;
        const lines = ['row_number,course_code,course_name,field,message'];

        importRowErrors.forEach((row) => {
            const base = [row.row_number, row.course_code || '', row.course_name || ''];
            (row.errors || []).forEach((err) => {
                const csvRow = [
                    ...base,
                    err.field || '',
                    String(err.message || '').replace(/\"/g, '""')
                ].map((v) => `"${String(v)}"`).join(',');
                lines.push(csvRow);
            });
        });

        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `curriculum-import-errors-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/csv'];
        if (!validTypes.includes(file.type)) {
            setImportError('Please select a valid .xlsx or .csv file.');
            return;
        }

        setImportFile(file);
        setImportError('');
        setImportSummary(null);
        setImportRowErrors([]);
        setImportPreview([]);

        if (!selectedBranch) {
            setImportError('Select a branch before previewing import file.');
            return;
        }

        runImportPreview(file);
    }

    async function runImportPreview(file) {
        try {
            setImportPreviewLoading(true);
            setImportError('');

            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post(`/curriculum/import/${selectedBranch}/preview`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setImportSummary(res.data.summary || null);
            setImportRowErrors(res.data.row_errors || []);
            setImportPreview(res.data.preview || []);
        } catch (err) {
            setImportError('Failed to preview file: ' + err.message);
            setImportSummary(err.response?.data?.summary || null);
            setImportRowErrors(err.response?.data?.row_errors || []);
            setImportPreview([]);
        } finally {
            setImportPreviewLoading(false);
        }
    }

    async function handleImport() {
        if (!importFile || !selectedBranch) {
            setImportError('Please select a file and branch.');
            return;
        }

        if (importMode === 'replace') {
            const ok = window.confirm('Replace mode will delete existing curriculum rows for this branch before importing valid rows. Continue?');
            if (!ok) return;
        }

        setImportLoading(true);
        setImportError('');
        setImportSummary(null);
        setImportRowErrors([]);
        setSuccess('');

        try {
            const formData = new FormData();
            formData.append('file', importFile);

            const res = await api.post(`/curriculum/import/${selectedBranch}?replace=${importMode === 'replace'}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setImportSummary(res.data.summary || null);
            setImportRowErrors(res.data.row_errors || []);

            if ((res.data.summary?.failed_rows || 0) > 0) {
                setSuccess(
                    `Imported ${res.data.summary.valid_rows}/${res.data.summary.total_rows} rows. ` +
                    `${res.data.summary.failed_rows} row(s) failed validation.`
                );
            } else {
                setSuccess(`Successfully imported ${res.data.imported} subjects (Mode: ${importMode}).`);
            }

            setImportFile(null);
            setImportPreview([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            await loadSubjects();
        } catch (err) {
            setImportError(err.response?.data?.error || 'Import failed.');
            setImportSummary(err.response?.data?.summary || null);
            setImportRowErrors(err.response?.data?.row_errors || []);
            if (err.response?.data?.details) {
                setImportError(prev => prev + '\n' + err.response.data.details.join('\n'));
            }
        } finally {
            setImportLoading(false);
        }
    }

    function resetForm() {
        setFormData({
            branch_id: selectedBranch,
            semester: '',
            course_code: '',
            course_name: '',
            is_placeholder: false,
            subject_type: '',
            iat_max_marks: '',
            end_sem_max_marks: '',
            tw_max_marks: '',
            oral_pr_max_marks: '',
            total_max_marks: ''
        });
        setFormError('');
        setEditingId(null);
    }

    function startEdit(subject) {
        setFormData({
            branch_id: String(subject.branch_id),
            semester: String(subject.semester),
            course_code: subject.course_code,
            course_name: subject.course_name,
            is_placeholder: Boolean(subject.is_placeholder),
            subject_type: String(subject.subject_type || (subject.is_project ? 'project' : subject.is_lab ? 'lab' : 'theory')),
            iat_max_marks: subject.iat_max_marks ? String(subject.iat_max_marks) : '',
            end_sem_max_marks: subject.end_sem_max_marks ? String(subject.end_sem_max_marks) : '',
            tw_max_marks: subject.tw_max_marks ? String(subject.tw_max_marks) : '',
            oral_pr_max_marks: subject.oral_pr_max_marks ? String(subject.oral_pr_max_marks) : '',
            total_max_marks: String(subject.total_max_marks)
        });
        setEditingId(subject.subject_id);
        setShowForm(true);
    }

    async function handleSaveSubject() {
        setFormError('');

        const inferredType = editingId ? String(formData.subject_type || 'theory') : inferSubjectType(formData);
        const iat = formData.iat_max_marks ? parseInt(formData.iat_max_marks) : null;
        const endSem = formData.end_sem_max_marks ? parseInt(formData.end_sem_max_marks) : null;
        const tw = formData.tw_max_marks ? parseInt(formData.tw_max_marks) : null;
        const oralPr = formData.oral_pr_max_marks ? parseInt(formData.oral_pr_max_marks) : null;
        const total = parseInt(formData.total_max_marks);

        const sum = (iat || 0) + (endSem || 0) + (tw || 0) + (oralPr || 0);
        if (total !== sum) {
            setFormError(`Total marks (${total}) must equal sum of assessment marks (${sum})`);
            return;
        }

        try {
            const payload = {
                branch_id: Number(formData.branch_id),
                semester: Number(formData.semester),
                course_code: formData.course_code,
                course_name: formData.course_name,
                iat_max_marks: iat,
                end_sem_max_marks: endSem,
                tw_max_marks: tw,
                oral_pr_max_marks: oralPr,
                total_max_marks: total,
                is_placeholder: Boolean(formData.is_placeholder),
                subject_type: editingId ? inferredType : null
            };

            if (editingId) {
                await api.put(`/curriculum/${editingId}`, payload);
                setSuccess('Subject updated successfully.');
            } else {
                await api.post('/curriculum', payload);
                setSuccess('Subject created successfully.');
            }

            setShowForm(false);
            resetForm();
            await loadSubjects();
        } catch (err) {
            setFormError(err.response?.data?.error || 'Failed to save subject.');
        }
    }

    async function handleDelete(subject_id) {
        if (!window.confirm('Delete this subject?')) return;

        try {
            await api.delete(`/curriculum/${subject_id}`);
            setSuccess('Subject deleted successfully.');
            await loadSubjects();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete subject.');
        }
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BookOpen size={24} /> Curriculum Settings
                    </h2>
                    <p>Manage branch-wise subjects and semester rules for internal timetable generation.</p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => { loadBranches(); loadRules(); }}>
                    <RefreshCcw size={14} /> Refresh
                </button>
            </div>

            {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
            {success && <Alert type="success" dismissible onDismiss={() => setSuccess('')}>{success}</Alert>}

            {/* Branch & Filter Controls */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="grid-4" style={{ gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Branch</label>
                        <select
                            className="form-control"
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        >
                            <option value="">Select Branch</option>
                            {branches.map(b => (
                                <option key={b.branch_id} value={b.branch_id}>
                                    {b.branch_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Exam Type</label>
                        <select
                            className="form-control"
                            value={examTypeFilter}
                            onChange={(e) => setExamTypeFilter(e.target.value)}
                        >
                            <option value="">All Types</option>
                            <option value="theory">Theory</option>
                            <option value="lab">Lab</option>
                            <option value="project">Project</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Semester</label>
                        <select
                            className="form-control"
                            value={semesterFilter}
                            onChange={(e) => setSemesterFilter(e.target.value)}
                        >
                            <option value="">All Semesters</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                <option key={s} value={s}>Sem {s}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Search</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Code or name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Semester Rules */}
            <div className="card" style={{ marginBottom: 20, background: 'var(--surface)' }}>
                <h3 style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDays size={16} /> Semester Rules
                </h3>
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
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => saveRule(semesterType)} disabled={loading}>
                                <Save size={14} /> Save {semesterType}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Subjects Table */}
            <div className="card" style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 12 }}>
                    <ListChecks size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Subjects ({filteredSubjects.length})
                </h3>

                {loading ? (
                    <p className="text-muted">Loading subjects...</p>
                ) : filteredSubjects.length === 0 ? (
                    <p className="text-muted">No subjects found.</p>
                ) : (
                    <div className="curriculum-subjects-scroll">
                        <table className="curriculum-subjects-table">
                            <thead>
                                <tr>
                                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Code</th>
                                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Sem</th>
                                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assessment Profile</th>
                                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSubjects.map(subject => (
                                    <tr key={subject.subject_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: 12 }}>
                                            <strong>{subject.course_code}</strong>
                                        </td>
                                        <td style={{ padding: 12 }}>
                                            {subject.course_name}
                                        </td>
                                        <td style={{ padding: 12, textAlign: 'center' }}>{subject.semester}</td>
                                        <td style={{ padding: 12, textAlign: 'center' }}>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                backgroundColor: getSubjectTypeMeta(inferSubjectType(subject)).bg,
                                                color: getSubjectTypeMeta(inferSubjectType(subject)).color,
                                                fontSize: 12,
                                                fontWeight: 'bold'
                                            }}>
                                                {getSubjectTypeMeta(inferSubjectType(subject)).label}
                                            </span>
                                        </td>
                                        <td style={{ padding: 12 }}>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {getAssessmentProfile(subject).map((chip) => (
                                                    <span
                                                        key={`${subject.subject_id}-${chip.key}`}
                                                        className="curriculum-assessment-pill"
                                                    >
                                                        <strong style={{ marginRight: 4 }}>{chip.key}</strong>{chip.value}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
                                            {subject.total_max_marks}
                                        </td>
                                        <td style={{ padding: 12, textAlign: 'center' }}>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => startEdit(subject)}
                                                style={{ marginRight: 4 }}
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDelete(subject.subject_id)}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Form */}
            <div className="card curriculum-form-card">
                <h3>{editingId ? 'Edit Subject' : 'Add New Subject'}</h3>
                {formError && <Alert type="error" dismissible onDismiss={() => setFormError('')}>{formError}</Alert>}

                <div className="grid-3" style={{ gap: 12, marginBottom: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Semester *</label>
                        <select
                            className="form-control"
                            value={formData.semester}
                            onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                            required
                        >
                            <option value="">Select</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                <option key={s} value={s}>Sem {s}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Course Code *</label>
                        <input
                            type="text"
                            className="form-control"
                            value={formData.course_code}
                            onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Course Name *</label>
                        <input
                            type="text"
                            className="form-control"
                            value={formData.course_name}
                            onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Classification</label>
                    <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                        {(() => {
                            const meta = getSubjectTypeMeta(inferSubjectType(formData));
                            return (
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '4px 10px',
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: meta.bg,
                                    color: meta.color
                                }}>
                                    {meta.label}
                                </span>
                            );
                        })()}
                        <span className="text-muted" style={{ alignSelf: 'center' }}>
                            Auto-inferred from the subject name and End Sem allotment.
                        </span>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={Boolean(formData.is_placeholder)}
                            onChange={(e) => setFormData({ ...formData, is_placeholder: e.target.checked })}
                        />
                        Mark As Elective Placeholder
                    </label>
                </div>

                {editingId && (
                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label">Reassign Classification</label>
                        <select
                            className="form-control"
                            value={formData.subject_type}
                            onChange={(e) => setFormData({ ...formData, subject_type: e.target.value })}
                        >
                            <option value="theory">Theory</option>
                            <option value="lab">Lab</option>
                            <option value="project">Project</option>
                        </select>
                    </div>
                )}

                <h4 style={{ marginBottom: 8 }}>Assessment Marks (Leave blank if not applicable)</h4>
                <div className={inferSubjectType(formData) === 'theory' ? 'grid-5' : 'grid-4'} style={{ gap: 8, marginBottom: 12 }}>
                    <div className="form-group">
                        <label className="form-label">IA Total/Avg</label>
                        <input
                            type="number"
                            className="form-control"
                            value={formData.iat_max_marks}
                            onChange={(e) => setFormData({ ...formData, iat_max_marks: e.target.value })}
                        />
                    </div>
                    {inferSubjectType(formData) === 'theory' && (
                        <div className="form-group">
                            <label className="form-label">End Sem Exam</label>
                            <input
                                type="number"
                                className="form-control"
                                value={formData.end_sem_max_marks}
                                onChange={(e) => setFormData({ ...formData, end_sem_max_marks: e.target.value })}
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Term Work (TW)</label>
                        <input
                            type="number"
                            className="form-control"
                            value={formData.tw_max_marks}
                            onChange={(e) => setFormData({ ...formData, tw_max_marks: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Oral Max</label>
                        <input
                            type="number"
                            className="form-control"
                            value={formData.oral_pr_max_marks}
                            onChange={(e) => setFormData({ ...formData, oral_pr_max_marks: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Total Max *</label>
                        <input
                            type="number"
                            className="form-control"
                            value={formData.total_max_marks}
                            onChange={(e) => setFormData({ ...formData, total_max_marks: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div
                    style={{
                        padding: 10,
                        borderRadius: 6,
                        marginBottom: 12,
                        backgroundColor: (() => {
                            const iat = Number(formData.iat_max_marks || 0);
                            const endSem = Number((inferSubjectType(formData) === 'theory' ? formData.end_sem_max_marks : 0) || 0);
                            const tw = Number(formData.tw_max_marks || 0);
                            const oral = Number(formData.oral_pr_max_marks || 0);
                            const total = Number(formData.total_max_marks || 0);
                            const sum = iat + endSem + tw + oral;
                            return total && total !== sum ? 'color-mix(in srgb, var(--danger) 10%, var(--surface) 90%)' : 'color-mix(in srgb, var(--success) 10%, var(--surface) 90%)';
                        })(),
                        border: '1px solid var(--border)'
                    }}
                >
                    {(() => {
                        const iat = Number(formData.iat_max_marks || 0);
                        const endSem = Number((inferSubjectType(formData) === 'theory' ? formData.end_sem_max_marks : 0) || 0);
                        const tw = Number(formData.tw_max_marks || 0);
                        const oral = Number(formData.oral_pr_max_marks || 0);
                        const total = Number(formData.total_max_marks || 0);
                        const sum = iat + endSem + tw + oral;
                        return (
                            <span style={{ fontSize: 13 }}>
                                Sum check: {iat} (IA) + {endSem} (End Sem) + {tw} (TW) + {oral} (Oral/Practical) = <strong>{sum}</strong>
                                {total ? (
                                    total === sum
                                        ? ` | Total: ${total} (OK)`
                                        : ` | Total: ${total} (Mismatch)`
                                ) : ''}
                            </span>
                        );
                    })()}
                </div>

                <div className="flex gap-2">
                    <button type="button" className="btn btn-success" onClick={handleSaveSubject}>
                        {editingId ? 'Update Subject' : 'Add Subject'}
                    </button>
                </div>
            </div>

            {/* Bulk Import Section */}
            <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--primary)' }}>
                <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><FileUp size={16} /> Bulk Import (XLSX/CSV)</h3>
                <div className="grid-3" style={{ gap: 12, marginBottom: 12 }}>
                    <div className="form-group">
                        <label className="form-label">File (.xlsx or .csv)</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                            className="form-control"
                            onChange={handleFileSelect}
                        />
                        <small style={{ marginTop: 4, color: '#666' }}>
                            Expected columns: Semester, Course Code, Course Name, IAT-1, IAT-2, IA Total/Avg, End Sem Exam, Term Work (TW), Oral & Pract., Total
                        </small>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Import Mode</label>
                        <select
                            className="form-control"
                            value={importMode}
                            onChange={(e) => setImportMode(e.target.value)}
                        >
                            <option value="append">Append/Update (Default)</option>
                            <option value="replace">Replace All for Branch</option>
                        </select>
                        <small style={{ marginTop: 4, color: '#666' }}>
                            {importMode === 'replace' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Will delete existing subjects</span>
                            ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> Will merge/update rows</span>
                            )}
                        </small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                        <button
                            className="btn btn-success"
                            onClick={handleImport}
                            disabled={!importFile || importLoading}
                            style={{ flex: 1 }}
                        >
                            <Upload size={14} /> {importLoading ? 'Importing...' : 'Import'}
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setImportFile(null);
                                setImportPreview([]);
                                setImportSummary(null);
                                setImportRowErrors([]);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            disabled={importLoading}
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {importError && <Alert type="error" dismissible onDismiss={() => setImportError('')}>{importError}</Alert>}

                {importSummary && (
                    <div style={{ marginTop: 8, marginBottom: 8, fontSize: 13 }}>
                        <strong>Import Summary:</strong>{' '}
                        Total {importSummary.total_rows} | Valid {importSummary.valid_rows} | Failed {importSummary.failed_rows}
                    </div>
                )}

                {importPreviewLoading && (
                    <p className="text-muted" style={{ marginBottom: 8 }}>Validating file...</p>
                )}

                {importRowErrors.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <h4 style={{ marginBottom: 0 }}>Row Errors ({importRowErrors.length})</h4>
                            <button className="btn btn-secondary btn-sm" onClick={downloadImportErrors}>
                                Download Error Report
                            </button>
                        </div>
                        <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#fff7ed' }}>
                                        <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Row</th>
                                        <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Code</th>
                                        <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Course</th>
                                        <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Issue(s)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importRowErrors.map((rowErr, idx) => (
                                        <tr key={`${rowErr.row_number}-${idx}`}>
                                            <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{rowErr.row_number}</td>
                                            <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{rowErr.course_code || '-'}</td>
                                            <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{rowErr.course_name || '-'}</td>
                                            <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                                                {(rowErr.errors || []).map((e, i) => (
                                                    <div key={`${e.field}-${i}`}>{e.field}: {e.message}</div>
                                                ))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {importPreview.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <h4 style={{ marginBottom: 8 }}>Normalized Preview (First 5 rows)</h4>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                                        {Object.keys(importPreview[0] || {}).map(key => (
                                            <th key={key} style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                                {key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {importPreview.map((row, idx) => (
                                        <tr key={idx}>
                                            {Object.values(row).map((val, i) => (
                                                <td key={i} style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                                                    {String(val).substring(0, 30)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 10 }}>Dynamic Electives & Honors</h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className={dynamicTab === 'master_pool' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                        onClick={() => setDynamicTab('master_pool')}
                    >
                        Master Pool
                    </button>
                    <button
                        type="button"
                        className={dynamicTab === 'elective_mapping' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                        onClick={() => setDynamicTab('elective_mapping')}
                    >
                        Elective Mapping
                    </button>
                    <button
                        type="button"
                        className={dynamicTab === 'honors' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                        onClick={() => setDynamicTab('honors')}
                    >
                        Honors Config
                    </button>
                </div>

                {dynamicTab === 'master_pool' && <MasterPoolManager />}
                {dynamicTab === 'elective_mapping' && <ElectiveMappingManager />}
                {dynamicTab === 'honors' && <HonorsConfiguration />}
            </div>



        </div>
    );
}
