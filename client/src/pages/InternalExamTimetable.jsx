import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, GripVertical, Printer, Save } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../api';
import Alert from '../components/Alert';

const YEARS = ['SE', 'TE', 'BE'];
const SESSIONS = ['Session 1', 'Session 2'];
// Map semester values to year grouping
const SEMESTER_TO_YEAR = {
    3: 'SE', 4: 'SE',  //  SE: 3 (ODD) and 4 (EVEN)
    5: 'TE', 6: 'TE',  // TE: 5 (ODD) and 6 (EVEN)
    7: 'BE', 8: 'BE'   // BE: 7 (ODD) and 8 (EVEN)
};
const SEMESTER_BY_MODE = {
    ODD: { SE: 3, TE: 5, BE: 7 },
    EVEN: { SE: 4, TE: 6, BE: 8 }
};

function getSemesterModeFromDate(dateText) {
    if (!dateText) return null;
    const d = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const month = d.getMonth() + 1;
    return month >= 7 ? 'ODD' : 'EVEN';
}

function buildDaySlots(startDateText) {
    const start = startDateText ? new Date(`${startDateText}T00:00:00`) : new Date();
    const days = [];
    for (let i = 0; i < 3; i += 1) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        days.push(day);
    }
    return days;
}

function moveItem(list, from, to) {
    const copy = [...list];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
}

function addDays(dateText, offset) {
    const d = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateText;
    d.setDate(d.getDate() + offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function buildSavedTimetablePlans(sessions) {
    const byDate = new Map();
    sessions.forEach((row) => {
        const date = String(row.exam_date || '');
        if (!date) return;
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date).push(row);
    });

    const dates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));
    const used = new Set();
    const plans = [];

    for (const date of dates) {
        if (used.has(date)) continue;

        const d2 = addDays(date, 1);
        const d3 = addDays(date, 2);
        const hasThreeDayWindow = byDate.has(d2) && byDate.has(d3);

        const windowDates = hasThreeDayWindow ? [date, d2, d3] : [date];
        windowDates.forEach((d) => used.add(d));

        const groupedRows = windowDates
            .flatMap((d) => byDate.get(d) || [])
            .sort((a, b) => {
                const dateCmp = String(a.exam_date).localeCompare(String(b.exam_date));
                if (dateCmp !== 0) return dateCmp;
                return String(a.time_slot || '').localeCompare(String(b.time_slot || ''));
            });

        const dayOneRows = groupedRows.filter((r) => String(r.exam_date) === date);
        const sortedDayOneSlots = dayOneRows
            .map((r) => String(r.time_slot || ''))
            .sort((a, b) => a.localeCompare(b));

        plans.push({
            key: `${date}::${groupedRows.map((r) => r.timetable_id).join('-')}`,
            start_date: date,
            end_date: windowDates[windowDates.length - 1],
            session_count: groupedRows.length,
            sessions: groupedRows,
            session1_time: sortedDayOneSlots[0] || '10:00 - 11:00',
            session2_time: sortedDayOneSlots[1] || '11:15 - 12:15'
        });
    }

    return plans.sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
}

function buildScheduleForYear(yearSubjects, startDateText, session1Time = '10:00 - 11:00', session2Time = '11:15 - 12:15') {
    const days = buildDaySlots(startDateText);
    const activeSubjects = yearSubjects.filter((item) => item.enabled);
    const slots = [];
    const sessionTimes = [session1Time, session2Time];

    for (let dayIndex = 0; dayIndex < 3; dayIndex += 1) {
        for (let sessionIndex = 0; sessionIndex < 2; sessionIndex += 1) {
            const subject = activeSubjects[slots.length] || null;
            slots.push({
                day: days[dayIndex],
                sessionLabel: SESSIONS[sessionIndex],
                sessionTime: sessionTimes[sessionIndex],
                subject
            });
        }
    }

    return {
        slots,
        overflowCount: Math.max(0, activeSubjects.length - 6)
    };
}

export default function InternalExamTimetable() {
    const [branches, setBranches] = useState([]);
    const [branchId, setBranchId] = useState('');
    const [examType, setExamType] = useState('theory');
    const [semesterMode, setSemesterMode] = useState('ODD');
    const [startDate, setStartDate] = useState('');
    const [subjectsByYear, setSubjectsByYear] = useState({ SE: [], TE: [], BE: [] });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);
    const [session1Time, setSession1Time] = useState('10:00 - 11:00');
    const [session2Time, setSession2Time] = useState('11:15 - 12:15');
    const [sessionTimesByYear, setSessionTimesByYear] = useState({ SE: {}, TE: {}, BE: {} });
    const [savingTimetable, setSavingTimetable] = useState(false);
    const [deletingTimetable, setDeletingTimetable] = useState(false);
    const [success, setSuccess] = useState('');
    const [savedTimetablePlans, setSavedTimetablePlans] = useState([]);
    const [selectedSavedPlanKey, setSelectedSavedPlanKey] = useState('');

    const printRef = useRef(null);
    const handlePrint = useReactToPrint({ content: () => printRef.current });

    useEffect(() => {
        async function loadInitial() {
            try {
                const [branchRes, modeRes] = await Promise.all([
                    api.get('/branches'),
                    api.get('/curriculum/semester-mode/current')
                ]);
                setBranches(branchRes.data);
                if (branchRes.data.length) {
                    setBranchId(String(branchRes.data[0].branch_id));
                }
                setSemesterMode(modeRes.data.semester_type || 'ODD');
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load timetable setup data.');
            }
        }
        loadInitial();
    }, []);

    useEffect(() => {
        if (!branchId) return;
        fetchSubjects();
    }, [branchId, examType, semesterMode]);

    useEffect(() => {
        if (!branchId) return;
        loadSavedTimetablePlans();
    }, [branchId, examType]);

    useEffect(() => {
        const autoMode = getSemesterModeFromDate(startDate);
        if (!autoMode) return;
        setSemesterMode((prev) => (prev === autoMode ? prev : autoMode));
    }, [startDate]);

    async function loadSavedTimetablePlans() {
        try {
            const res = await api.get('/curriculum/timetable/sessions', {
                params: {
                    source: 'internal_generator',
                    examType
                }
            });

            const filtered = (res.data || []).filter((row) => String(row.branch_id || '') === String(branchId || ''));
            setSavedTimetablePlans(buildSavedTimetablePlans(filtered));
        } catch {
            setSavedTimetablePlans([]);
        }
    }

    function applySavedTimetablePlan(planKey) {
        setSelectedSavedPlanKey(planKey);
        if (!planKey) return;

        const selected = savedTimetablePlans.find((p) => p.key === planKey);
        if (!selected) return;

        setStartDate(selected.start_date || '');
        setSession1Time(selected.session1_time || '10:00 - 11:00');
        setSession2Time(selected.session2_time || '11:15 - 12:15');
        setSuccess(`Loaded saved timetable starting ${selected.start_date}.`);
    }

    async function fetchSubjects() {
        setError('');
        setLoading(true);
        try {
            const grouped = { SE: [], TE: [], BE: [] };
            const modeMap = SEMESTER_BY_MODE[semesterMode] || SEMESTER_BY_MODE.ODD;

            if (examType === 'theory') {
                const semesters = YEARS.map((year) => modeMap[year]).filter(Boolean);
                const resolvedResponses = await Promise.all(
                    semesters.map((sem) => api.get('/curriculum/resolved-theory', {
                        params: { branchId: Number(branchId), semester: Number(sem) }
                    }))
                );

                resolvedResponses.forEach((response) => {
                    const rows = Array.isArray(response.data?.rows) ? response.data.rows : [];
                    rows.forEach((row) => {
                        const year = SEMESTER_TO_YEAR[Number(row.semester)];
                        if (!year || !grouped[year]) return;
                        grouped[year].push({
                            subject_id: row.subject_id,
                            course_code: row.course_code,
                            course_name: row.course_name,
                            semester: row.semester,
                            is_lab: false,
                            is_elective: row.is_elective,
                            has_iat: row.has_iat,
                            has_term_work: row.has_term_work,
                            has_oral_pr: row.has_oral_pr,
                            enabled: true,
                            elective_choice: row.course_name
                        });
                    });
                });
            } else {
                const res = await api.get('/curriculum', {
                    params: {
                        branchId,
                        examType
                    }
                });

                (res.data || []).forEach((row) => {
                    const year = SEMESTER_TO_YEAR[Number(row.semester)];
                    if (!year || !grouped[year]) return;

                    const expectedSemForYear = modeMap[year];
                    if (Number(row.semester) !== expectedSemForYear) return;

                    grouped[year].push({
                        subject_id: row.subject_id,
                        course_code: row.course_code,
                        course_name: row.course_name,
                        semester: row.semester,
                        is_lab: row.is_lab,
                        is_elective: row.is_elective,
                        has_iat: row.has_iat,
                        has_term_work: row.has_term_work,
                        has_oral_pr: row.has_oral_pr,
                        enabled: true,
                        elective_choice: row.course_name
                    });
                });
            }

            YEARS.forEach((year) => {
                grouped[year] = grouped[year].sort((a, b) => {
                    if (a.semester !== b.semester) {
                        return a.semester - b.semester;
                    }
                    return a.course_code.localeCompare(b.course_code);
                });
            });

            setSubjectsByYear(grouped);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch curriculum subjects.');
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerateTimetableSessions() {
        if (!branchId || !startDate) {
            setError('Select branch and start date before generating timetable sessions.');
            return;
        }

        setSavingTimetable(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/curriculum/timetable/generate', {
                branch_id: Number(branchId),
                exam_type: examType,
                semester_mode: semesterMode,
                start_date: startDate,
                session1_time: session1Time,
                session2_time: session2Time
            });
            setSuccess('Timetable generated and saved for all 3 days x 2 sessions. Seating can now be generated.');
            await loadSavedTimetablePlans();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate timetable sessions.');
        } finally {
            setSavingTimetable(false);
        }
    }

    async function handleDeleteSavedTimetablePlan() {
        if (!selectedSavedPlanKey) {
            setError('Select a saved timetable plan to delete.');
            return;
        }

        const selected = savedTimetablePlans.find((p) => p.key === selectedSavedPlanKey);
        const timetableIds = (selected?.sessions || []).map((s) => Number(s.timetable_id)).filter((id) => Number.isInteger(id) && id > 0);

        if (!timetableIds.length) {
            setError('No sessions found for the selected saved plan.');
            return;
        }

        const confirmed = window.confirm(`Delete saved timetable plan ${selected.start_date} to ${selected.end_date}? This action cannot be undone.`);
        if (!confirmed) return;

        setDeletingTimetable(true);
        setError('');
        setSuccess('');
        try {
            const res = await api.delete('/curriculum/timetable/plans', {
                data: { timetable_ids: timetableIds }
            });

            const deletedCount = Number(res.data?.deleted_count || 0);
            setSuccess(`Deleted ${deletedCount} timetable session(s) from saved plan.`);
            setSelectedSavedPlanKey('');
            await loadSavedTimetablePlans();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete saved timetable plan.');
        } finally {
            setDeletingTimetable(false);
        }
    }

    function updateSubject(year, idx, patch) {
        setSubjectsByYear((prev) => {
            const nextYear = [...prev[year]];
            const subject = nextYear[idx];

            // If enabling a subject, check 6-subject limit
            if (patch.enabled === true) {
                const enabledCount = nextYear.filter((s) => s.enabled).length;
                if (enabledCount >= 6) {
                    setError('Maximum 6 subjects per year.');
                    return prev;
                }
                // If this is an elective being enabled, disable other electives for this year
                if (subject.is_elective) {
                    nextYear.forEach((s, i) => {
                        if (i !== idx && s.is_elective) {
                            s.enabled = false;
                        }
                    });
                }
            }

            nextYear[idx] = { ...nextYear[idx], ...patch };
            setError('');
            return { ...prev, [year]: nextYear };
        });
    }

    function handleDragStart(year, idx) {
        setDraggedItem({ year, idx });
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDrop(year, dropIdx) {
        if (!draggedItem || draggedItem.year !== year) {
            setDraggedItem(null);
            return;
        }

        const { idx: dragIdx } = draggedItem;
        if (dragIdx === dropIdx) {
            setDraggedItem(null);
            return;
        }

        setSubjectsByYear((prev) => ({
            ...prev,
            [year]: moveItem(prev[year], dragIdx, dropIdx)
        }));
        setDraggedItem(null);
    }

    function handleDragEnd() {
        setDraggedItem(null);
    }

    const electiveOptionsByYear = useMemo(() => {
        const map = { SE: [], TE: [], BE: [] };
        YEARS.forEach((year) => {
            map[year] = subjectsByYear[year]
                .filter((s) => s.is_elective)
                .map((s) => s.course_name);
        });
        return map;
    }, [subjectsByYear]);

    const schedules = useMemo(() => {
        return {
            SE: buildScheduleForYear(
                subjectsByYear.SE,
                startDate,
                sessionTimesByYear.SE?.session1Time || session1Time,
                sessionTimesByYear.SE?.session2Time || session2Time
            ),
            TE: buildScheduleForYear(
                subjectsByYear.TE,
                startDate,
                sessionTimesByYear.TE?.session1Time || session1Time,
                sessionTimesByYear.TE?.session2Time || session2Time
            ),
            BE: buildScheduleForYear(
                subjectsByYear.BE,
                startDate,
                sessionTimesByYear.BE?.session1Time || session1Time,
                sessionTimesByYear.BE?.session2Time || session2Time
            )
        };
    }, [subjectsByYear, startDate, session1Time, session2Time, sessionTimesByYear]);

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h2><CalendarDays size={24} /> Internal Exam Timetable Generator</h2>
                    <p>Create 3-day, 2-session/day timetables from curriculum data with year-wise printable pages.</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={handleGenerateTimetableSessions} disabled={savingTimetable || !startDate || !branchId}>
                        <Save size={14} /> {savingTimetable ? 'Generating...' : 'Generate Timetable'}
                    </button>
                    <button className="btn btn-primary" onClick={handlePrint}>
                        <Printer size={14} /> Print / Save PDF
                    </button>
                </div>
            </div>

            {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
            {success && <Alert type="success" dismissible onDismiss={() => setSuccess('')}>{success}</Alert>}

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="grid-3 timetable-controls-grid">
                    <div className="form-group">
                        <label className="form-label">Branch</label>
                        <select className="form-control" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                            {branches.map((b) => (
                                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Exam Type</label>
                        <select className="form-control" value={examType} onChange={(e) => setExamType(e.target.value)}>
                            <option value="theory">Theory</option>
                            <option value="lab">Lab</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Semester Mode</label>
                        <select className="form-control" value={semesterMode} onChange={(e) => setSemesterMode(e.target.value)}>
                            <option value="ODD">ODD</option>
                            <option value="EVEN">EVEN</option>
                        </select>
                    </div>
                </div>
                <div className="form-group" style={{ marginTop: 10, maxWidth: 260 }}>
                    <label className="form-label">Schedule Start Date</label>
                    <input
                        type="date"
                        className="form-control"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #ddd' }}>
                    <h4 style={{ marginBottom: 12 }}>Saved Timetable Plans</h4>
                    <div className="grid-2" style={{ gap: 12 }}>
                        <div className="form-group">
                            <label className="form-label">Load Saved Plan</label>
                            <select
                                className="form-control"
                                value={selectedSavedPlanKey}
                                onChange={(e) => applySavedTimetablePlan(e.target.value)}
                            >
                                <option value="">Select saved timetable</option>
                                {savedTimetablePlans.map((plan) => (
                                    <option key={plan.key} value={plan.key}>
                                        {plan.start_date} to {plan.end_date} | {plan.session_count} sessions
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Saved Plans Count</label>
                            <div className="form-control" style={{ display: 'flex', alignItems: 'center' }}>
                                {savedTimetablePlans.length}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2" style={{ marginTop: 10 }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={!selectedSavedPlanKey || deletingTimetable}
                            onClick={handleDeleteSavedTimetablePlan}
                        >
                            {deletingTimetable ? 'Deleting...' : 'Delete Selected Plan'}
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #ddd' }}>
                    <h4 style={{ marginBottom: 12 }}>Session Times (All Years)</h4>
                    <div className="grid-2" style={{ gap: 12 }}>
                        <div className="form-group">
                            <label className="form-label">Session 1 Time</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g., 09:00 - 10:00"
                                value={session1Time}
                                onChange={(e) => setSession1Time(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Session 2 Time</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g., 10:15 - 11:15"
                                value={session2Time}
                                onChange={(e) => setSession2Time(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid-3 timetable-subject-grid" style={{ marginBottom: 18 }}>
                {YEARS.map((year) => (
                    <section key={year} className="card timetable-year-card">
                        <h3>{year} Subjects (Max 6)</h3>
                        {loading && <p className="text-muted">Loading subjects...</p>}
                        {!loading && !subjectsByYear[year].length && (
                            <p className="text-muted">No subjects found for this year and exam type.</p>
                        )}
                        <div className="flex-col gap-2">
                            {subjectsByYear[year].map((subject, idx) => (
                                <div
                                    key={`${subject.subject_id}-${idx}`}
                                    className="timetable-subject-item"
                                    draggable
                                    onDragStart={() => handleDragStart(year, idx)}
                                    onDragOver={handleDragOver}
                                    onDrop={() => handleDrop(year, idx)}
                                    onDragEnd={handleDragEnd}
                                    style={{
                                        opacity: draggedItem?.year === year && draggedItem?.idx === idx ? 0.5 : 1,
                                        cursor: 'grab',
                                        transition: 'opacity 0.2s'
                                    }}
                                >
                                    <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                        <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
                                            <GripVertical size={16} style={{ color: '#999', flexShrink: 0, cursor: 'grab' }} />
                                            <label className="flex gap-2" style={{ alignItems: 'center' }}>
                                                {subject.is_elective ? (
                                                    <input
                                                        type="radio"
                                                        name={`elective-${year}`}
                                                        checked={subject.enabled}
                                                        onChange={(e) => updateSubject(year, idx, { enabled: e.target.checked })}
                                                    />
                                                ) : (
                                                    <input
                                                        type="checkbox"
                                                        checked={subject.enabled}
                                                        onChange={(e) => updateSubject(year, idx, { enabled: e.target.checked })}
                                                    />
                                                )}
                                                <span>
                                                    <strong>{subject.course_code}</strong> - {subject.course_name}
                                                    {subject.is_lab && <span style={{ fontSize: 11, marginLeft: 6, color: '#d97706', fontWeight: 'bold' }}>[Lab]</span>}
                                                    {subject.is_elective && <span style={{ fontSize: 12, marginLeft: 6, color: '#666' }}>(Elective)</span>}
                                                    {subject.has_iat && <span style={{ fontSize: 10, marginLeft: 6, color: '#1d4ed8' }}>[IA]</span>}
                                                    {subject.has_term_work && <span style={{ fontSize: 10, marginLeft: 4, color: '#0f766e' }}>[TW]</span>}
                                                    {subject.has_oral_pr && <span style={{ fontSize: 10, marginLeft: 4, color: '#7c3aed' }}>[OP]</span>}
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                    {subject.is_elective && (
                                        <div className="form-group" style={{ marginTop: 8 }}>
                                            <label className="form-label" style={{ fontSize: 12 }}>Elective Choice</label>
                                            <select
                                                className="form-control"
                                                value={subject.elective_choice || subject.course_name}
                                                onChange={(e) => updateSubject(year, idx, { elective_choice: e.target.value })}
                                            >
                                                {electiveOptionsByYear[year].map((opt) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '2px solid #ddd' }}>
                <h3 style={{ marginBottom: 16 }}>Per-Year Session Time Overrides</h3>
                <div className="grid-3" style={{ gap: 16, marginBottom: 24 }}>
                    {YEARS.map((year) => (
                        <div key={year} className="card" style={{ padding: 12 }}>
                            <h4 style={{ marginBottom: 12 }}>{year} Year</h4>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: 12 }}>Session 1 Time</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder={session1Time}
                                    value={sessionTimesByYear[year]?.session1Time || ''}
                                    onChange={(e) => setSessionTimesByYear(prev => ({
                                        ...prev,
                                        [year]: { ...prev[year], session1Time: e.target.value }
                                    }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: 12 }}>Session 2 Time</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder={session2Time}
                                    value={sessionTimesByYear[year]?.session2Time || ''}
                                    onChange={(e) => setSessionTimesByYear(prev => ({
                                        ...prev,
                                        [year]: { ...prev[year], session2Time: e.target.value }
                                    }))}
                                />
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setSessionTimesByYear(prev => ({ ...prev, [year]: {} }))}
                                style={{ marginTop: 8 }}
                            >
                                Reset to Global
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div ref={printRef} className="timetable-print-area">
                {YEARS.map((year, yearIndex) => (
                    <section key={year} className={`timetable-print-page ${yearIndex < YEARS.length - 1 ? 'with-page-break' : ''}`}>
                        <header className="timetable-print-header">
                            <h2>Internal Examination Timetable</h2>
                            <p>
                                Year: {year} | Mode: {semesterMode} | Type: {examType === 'theory' ? 'Theory' : 'Lab'}
                            </p>
                        </header>

                        <table className="timetable-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Session</th>
                                    <th>Time</th>
                                    <th>Subject Code</th>
                                    <th>Subject Name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schedules[year].slots.map((slot, idx) => (
                                    <tr key={`${year}-slot-${idx}`}>
                                        <td>{slot.day.toLocaleDateString()}</td>
                                        <td>{slot.sessionLabel}</td>
                                        <td>{slot.sessionTime}</td>
                                        <td>{slot.subject?.course_code || '-'}</td>
                                        <td>
                                            {slot.subject
                                                ? slot.subject.is_elective
                                                    ? slot.subject.elective_choice || slot.subject.course_name
                                                    : slot.subject.course_name
                                                : 'No subject assigned'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {schedules[year].overflowCount > 0 && (
                            <p className="text-muted" style={{ marginTop: 8 }}>
                                {schedules[year].overflowCount} selected subject(s) were not scheduled due to 6-slot limit.
                            </p>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
}
