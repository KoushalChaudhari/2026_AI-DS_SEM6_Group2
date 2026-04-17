import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, Printer, RefreshCcw, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../../api';
import Alert from '../../components/Alert';
import { useAuth } from '../../context/AuthContext';

function sessionKey(session) {
    return `${session.timetable_id}|${session.exam_date}|${session.time_slot}`;
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

function mapSessionsToTimeRanges(sessions) {
    const ranges = [];
    sessions.forEach((s) => {
        const label = String(s.display_time_slot || s.time_slot || '').trim();
        if (label.includes('Timing 1') || label.includes('timing 1') || label === '1') {
            ranges.push('11:00 - 12:00');
        } else if (label.includes('Timing 2') || label.includes('timing 2') || label === '2') {
            ranges.push('14:00 - 15:00');
        } else if (label) {
            ranges.push(label);
        } else {
            ranges.push('Session');
        }
    });
    return ranges;
}

function getSessionRangeLabel(session) {
    return mapSessionsToTimeRanges([session])[0] || session.display_time_slot || session.time_slot;
}

export default function SupervisionAllotments() {
    const { user, hasPermission, isAdminAccount } = useAuth();
    const canEdit = hasPermission('edit_supervision');
    const canRequestTransfer = hasPermission('request_transfer');
    const currentStaffId = Number(user?.staff_profile?.staff_id || 0) || null;
    const printRef = useRef(null);

    const [approvedPlans, setApprovedPlans] = useState([]);
    const [branches, setBranches] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [dashboardSessions, setDashboardSessions] = useState([]);
    const [staffRows, setStaffRows] = useState([]);
    const [staffPool, setStaffPool] = useState([]);

    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [selectedPlanScopeId, setSelectedPlanScopeId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [selectedTimetableId, setSelectedTimetableId] = useState('');
    const [selectedExamDate, setSelectedExamDate] = useState('');
    const [selectedSavedPlanDates, setSelectedSavedPlanDates] = useState([]);
    const [stateFilter, setStateFilter] = useState('all');
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [leaveNoteByAssignment, setLeaveNoteByAssignment] = useState({});
    const [assignStaffByRequest, setAssignStaffByRequest] = useState({});

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [expandedSavedPlanKey, setExpandedSavedPlanKey] = useState('');
    const [directAssignModal, setDirectAssignModal] = useState(null);
    const [directAssignRoom, setDirectAssignRoom] = useState('');
    const [directAssignStaff, setDirectAssignStaff] = useState('');
    const [reassignModal, setReassignModal] = useState(null);
    const [reassignNewRoom, setReassignNewRoom] = useState('');
    const [reassignNewStaff, setReassignNewStaff] = useState('');
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: selectedTimetableId
            ? `supervision-allotment-${selectedTimetableId}`
            : 'supervision-allotment'
    });

    async function loadBaseData() {
        setError('');
        try {
            const [plansRes, sessionsRes, staffRes, branchesRes] = await Promise.all([
                api.get('/seating/plans', { params: { status: 'approved' } }),
                api.get('/supervision/sessions'),
                api.get('/staff-roles/staff'),
                api.get('/branches')
            ]);
            setApprovedPlans(plansRes.data || []);
            setSessions(sessionsRes.data || []);
            setStaffPool(staffRes.data || []);
            setBranches(branchesRes.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load supervision setup data.');
        }
    }

    function onChangePlan(nextPlanId) {
        setSelectedPlanId(nextPlanId);
        setSelectedPlanScopeId('');
        setSelectedExamDate('');
        const selected = approvedPlans.find((p) => String(p.plan_id) === String(nextPlanId));
        const cfg = selected?.config || {};
        const single = Number(cfg.selected_branch_id);
        const branchIds = Array.isArray(cfg.selected_branch_ids)
            ? cfg.selected_branch_ids.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)
            : [];

        if (Number.isInteger(single) && single > 0) {
            setSelectedBranchId(String(single));
        } else if (branchIds.length === 1) {
            setSelectedBranchId(String(branchIds[0]));
        }
    }

    async function loadDashboard(
        timetableId = selectedTimetableId,
        state = stateFilter,
        planId = selectedPlanScopeId,
        examDate = selectedExamDate
    ) {
        setLoading(true);
        try {
            const params = { state };
            if (timetableId) params.timetableId = timetableId;
            if (planId) params.planId = planId;
            if (examDate) params.examDate = examDate;
            const leaveParams = {
                status: 'open'
            };
            if (timetableId) leaveParams.timetableId = timetableId;
            if (planId) leaveParams.planId = planId;

            const [res, leaveRes] = await Promise.all([
                api.get('/supervision/allotments', { params }),
                api.get('/supervision/leave-requests', { params: leaveParams })
            ]);

            setStaffRows(res.data?.staff || []);
            setDashboardSessions(res.data?.sessions || []);
            setLeaveRequests(leaveRes.data || []);
            // Clear stale banner if a previous dashboard request failed.
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load allotment dashboard.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadBaseData();
        loadDashboard('', 'all');
    }, []);

    useEffect(() => {
        loadDashboard(selectedTimetableId, stateFilter, selectedPlanScopeId);
    }, [selectedTimetableId, stateFilter, selectedPlanScopeId, selectedExamDate]);

    const sessionColumns = useMemo(() => {
        let base = dashboardSessions;

        if (selectedSavedPlanDates.length > 0) {
            const picked = new Set(selectedSavedPlanDates.map((d) => String(d)));
            base = base.filter((s) => picked.has(String(s.exam_date || '')));
        }

        if (selectedTimetableId) {
            return base.filter((s) => String(s.timetable_id) === String(selectedTimetableId));
        }
        return base;
    }, [dashboardSessions, selectedTimetableId, selectedSavedPlanDates]);

    const groupedSessionColumns = useMemo(() => {
        const byDate = new Map();
        sessionColumns.forEach((session) => {
            const dateKey = String(session.exam_date || '');
            if (!byDate.has(dateKey)) {
                byDate.set(dateKey, []);
            }
            byDate.get(dateKey).push(session);
        });

        return Array.from(byDate.entries()).map(([examDate, sessionsForDate]) => ({
            examDate,
            sessions: sessionsForDate
        }));
    }, [sessionColumns]);

    const selectedSession = useMemo(
        () => sessions.find((s) => String(s.timetable_id) === String(selectedTimetableId)),
        [sessions, selectedTimetableId]
    );

    const selectedSessionLocked = useMemo(() => {
        if (!selectedTimetableId) return false;
        const session = dashboardSessions.find((s) => String(s.timetable_id) === String(selectedTimetableId));
        if (!session) return false;
        const total = Number(session.assignment_count || 0);
        const published = Number(session.published_count || 0);
        return total > 0 && published === total;
    }, [dashboardSessions, selectedTimetableId]);

    function isSessionPublished(timetableId) {
        const session = dashboardSessions.find((s) => String(s.timetable_id) === String(timetableId));
        if (!session) return false;
        const total = Number(session.assignment_count || 0);
        const published = Number(session.published_count || 0);
        return total > 0 && published === total;
    }

    const myAssignments = useMemo(() => {
        if (!currentStaffId) return [];
        const me = staffRows.find((row) => Number(row.staff_id) === Number(currentStaffId));
        if (!me) return [];

        const out = [];
        Object.entries(me.cells || {}).forEach(([key, cell]) => {
            if (!cell?.assignment_id) return;
            const [timetableId, examDate, timeSlot] = String(key).split('|');
            const alreadyRequested = leaveRequests.some((r) => Number(r.assignment_id) === Number(cell.assignment_id) && String(r.status).toUpperCase() === 'OPEN');
            out.push({
                assignment_id: cell.assignment_id,
                timetable_id: Number(timetableId),
                exam_date: examDate,
                time_slot: timeSlot,
                room_number: cell.room_number,
                allotment_state: cell.allotment_state,
                alreadyRequested
            });
        });

        return out.sort((a, b) => {
            const d = String(a.exam_date).localeCompare(String(b.exam_date));
            if (d !== 0) return d;
            return String(a.time_slot).localeCompare(String(b.time_slot));
        });
    }, [staffRows, currentStaffId, leaveRequests]);

    const savedPlans = useMemo(() => {
        const active = sessions.filter((s) => Number(s.assignment_count || 0) > 0);
        const grouped = new Map();

        active.forEach((s) => {
            const planId = s.plan_id ? Number(s.plan_id) : null;
            const key = planId ? `plan-${planId}` : `date-${s.exam_date}`;

            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
                    plan_id: planId,
                    start_date: s.exam_date,
                    end_date: s.exam_date,
                    hasMixedPlans: false,
                    assignment_count: 0,
                    published_count: 0,
                    sessions: [],
                    timetable_ids: new Set()
                });
            }

            const row = grouped.get(key);
            if (row.plan_id !== planId) {
                row.hasMixedPlans = true;
            }
            if (!row.start_date || String(s.exam_date) < String(row.start_date)) {
                row.start_date = s.exam_date;
            }
            if (!row.end_date || String(s.exam_date) > String(row.end_date)) {
                row.end_date = s.exam_date;
            }
            row.assignment_count += Number(s.assignment_count || 0);
            row.published_count += Number(s.published_count || 0);
            row.sessions.push(s);
            row.timetable_ids.add(Number(s.timetable_id));
        });

        return Array.from(grouped.values())
            .map((plan) => ({
                ...plan,
                timetable_count: plan.timetable_ids.size,
                sessions: (plan.sessions || []).sort((a, b) => {
                    const dateCmp = String(a.exam_date || '').localeCompare(String(b.exam_date || ''));
                    if (dateCmp !== 0) return dateCmp;
                    return String(a.time_slot || '').localeCompare(String(b.time_slot || ''));
                })
            }))
            .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
    }, [sessions]);

    const selectedPlanLocked = useMemo(() => {
        if (!selectedPlanId) return false;
        const found = savedPlans.find((s) => String(s.plan_id || '') === String(selectedPlanId));
        if (!found) return false;
        return getSavedPlanStatus(found) === 'published';
    }, [savedPlans, selectedPlanId]);

    const calculatedMinDuties = useMemo(() => {
        if (!selectedPlanId || !staffPool.length || !selectedBranchId) return 10;

        const selectedPlan = approvedPlans.find((p) => String(p.plan_id) === String(selectedPlanId));
        if (!selectedPlan || !Array.isArray(selectedPlan.rooms)) return 10;

        const roomCount = selectedPlan.rooms.length;
        const totalSlotsNeeded = roomCount * 2; // 2 supervisors per room

        // Filter eligible staff: not excluded and matching selected branch
        let eligibleStaff = staffPool.filter((s) => {
            // Must belong to selected branch
            if (Number(s.branch_id) !== Number(selectedBranchId)) return false;
            
            // Extract role names from roles array
            const roleNames = (Array.isArray(s.roles) ? s.roles : []).map(r => String(r.role_name || '').toUpperCase());
            
            // Exclude HOD and EXAM_COORDINATOR roles
            if (roleNames.includes('HOD') || roleNames.includes('EXAM_COORDINATOR')) return false;
            
            return true;
        });

        if (eligibleStaff.length === 0) return 10;

        // Calculate average duties per staff, rounded up for even distribution
        const avgDutiesPerStaff = Math.ceil(totalSlotsNeeded / eligibleStaff.length);
        return Math.max(1, Math.min(avgDutiesPerStaff, 200)); // Clamp between 1 and 200
    }, [selectedPlanId, staffPool, approvedPlans, selectedBranchId]);

    function getDutyCount(staff) {
        return sessionColumns.reduce((sum, s) => {
            const key = sessionKey(s);
            return sum + (staff.cells?.[key] ? 1 : 0);
        }, 0);
    }

    async function viewSavedPlan(savedPlan) {
        setStateFilter('all');

        setSelectedPlanScopeId(savedPlan.plan_id ? String(savedPlan.plan_id) : '');
        setSelectedTimetableId('');
        setSelectedExamDate('');
        setSelectedSavedPlanDates([]);
        await loadDashboard('', 'all', savedPlan.plan_id ? String(savedPlan.plan_id) : '', '');
        setSuccess(`Loaded saved plan ${savedPlan.plan_id ? `#${savedPlan.plan_id}` : ''} (${savedPlan.start_date}${savedPlan.end_date && savedPlan.end_date !== savedPlan.start_date ? ` to ${savedPlan.end_date}` : ''}).`);
        setError('');
    }

    async function toggleSavedPlanDate(savedPlan, examDate) {
        const planScope = savedPlan.plan_id ? String(savedPlan.plan_id) : '';
        if (selectedPlanScopeId !== planScope) {
            setSelectedPlanScopeId(planScope);
            setSelectedTimetableId('');
            setSelectedExamDate('');
            await loadDashboard('', 'all', planScope, '');
        }

        setSelectedSavedPlanDates((prev) => {
            const key = String(examDate || '');
            if (!key) return prev;

            if (isAdminAccount) {
                return prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key];
            }

            // Non-admin: single-date selection
            return prev.includes(key) ? [] : [key];
        });

        setSuccess(`${isAdminAccount ? 'Updated' : 'Loaded'} date filter for plan ${savedPlan.plan_id ? `#${savedPlan.plan_id}` : ''}.`);
        setError('');
    }

    function getSavedPlanStatus(savedPlan) {
        const total = Number(savedPlan.assignment_count || 0);
        const published = Number(savedPlan.published_count || 0);
        return total > 0 && published === total ? 'published' : 'draft';
    }

    async function applyActionToSavedPlan(savedPlan, action) {
        const timetableIds = Array.from(new Set((savedPlan.sessions || [])
            .map((x) => Number(x.timetable_id))
            .filter((x) => Number.isInteger(x) && x > 0)));

        if (!timetableIds.length) {
            setError('No timetable sessions found for this saved plan row.');
            return;
        }

        const labels = {
            publish: 'publish',
            archive: 'archive',
            delete: 'delete'
        };

        if (action === 'delete') {
            const ok = window.confirm(`Delete allotments for ${savedPlan.exam_date}? This includes published entries.`);
            if (!ok) return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            if (action === 'publish') {
                await Promise.all(timetableIds.map((timetableId) => api.post('/supervision/publish', { timetable_id: timetableId })));
                setSuccess(`Saved plan for ${savedPlan.exam_date} published.`);
            } else if (action === 'archive') {
                await Promise.all(timetableIds.map((timetableId) => api.post('/supervision/archive', { timetable_id: timetableId })));
                setSuccess(`Saved plan for ${savedPlan.exam_date} moved to draft.`);
            } else if (action === 'delete') {
                await Promise.all(timetableIds.map((timetableId) => api.delete('/supervision/allotments', { data: { timetable_id: timetableId } })));
                setSuccess(`Saved plan for ${savedPlan.exam_date} deleted.`);
            } else {
                return;
            }

            await loadBaseData();
            await loadDashboard(selectedTimetableId, stateFilter, selectedPlanScopeId, selectedExamDate);
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${labels[action] || 'process'} saved plan.`);
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerate() {
        if (!selectedPlanId) {
            setError('Select an approved seating plan first.');
            return;
        }

        if (selectedPlanLocked) {
            setError('This plan is published and locked. Only print or delete is allowed.');
            return;
        }

        setError('');
        setSuccess('');
        setLoading(true);
        try {
            const generated = await api.post('/supervision/generate', {
                plan_id: Number(selectedPlanId),
                branch_id: selectedBranchId ? Number(selectedBranchId) : undefined,
                min_duties: calculatedMinDuties
            });
            setSelectedPlanScopeId(String(selectedPlanId));
            setSelectedTimetableId('');
            setSelectedExamDate('');
            const sessionCount = Array.isArray(generated.data?.timetable_ids)
                ? generated.data.timetable_ids.length
                : 1;
            setSuccess(`Draft supervision allotment generated successfully for ${sessionCount} session(s).`);
            await loadBaseData();
            await loadDashboard('', stateFilter, String(selectedPlanId));
        } catch (err) {
            const meta = err.response?.data?.meta;
            const detail = meta?.unfilled_slots
                ? ` Unfilled slots: ${meta.unfilled_slots}.`
                : '';
            setError((err.response?.data?.error || 'Failed to generate supervision allotment.') + detail);
        } finally {
            setLoading(false);
        }
    }

    async function handlePublish() {
        if (!selectedTimetableId) {
            setError('Select a timetable session before publishing.');
            return;
        }

        if (selectedSessionLocked) {
            setError('This session is already published and locked.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/supervision/publish', { timetable_id: Number(selectedTimetableId) });
            setSuccess('Allotment published and now visible to staff.');
            await loadBaseData();
            await loadDashboard(selectedTimetableId, stateFilter);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to publish allotment.');
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteAllotments({ timetableId, planId, label }) {
        const hasScope = Boolean(timetableId || planId);
        if (!hasScope) {
            setError('Select a timetable session or plan to delete allotments.');
            return;
        }

        const ok = window.confirm(`Delete allotments for ${label || 'selected scope'}? This includes published entries.`);
        if (!ok) return;

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.delete('/supervision/allotments', {
                data: {
                    timetable_id: timetableId ? Number(timetableId) : undefined,
                    plan_id: planId ? Number(planId) : undefined
                }
            });

            if (timetableId && String(timetableId) === String(selectedTimetableId)) {
                setSelectedTimetableId('');
            }
            setSelectedPlanScopeId('');
            setSelectedExamDate('');

            setSuccess('Allotments deleted successfully (including published records).');
            await loadBaseData();
            await loadDashboard('', stateFilter);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete allotments.');
        } finally {
            setLoading(false);
        }
    }

    function isStaffFreeInTimetable(staffId, timetableId) {
        const targetStaff = staffRows.find((row) => Number(row.staff_id) === Number(staffId));
        if (!targetStaff) return true;
        const hasAssignment = Object.entries(targetStaff.cells || {}).some(([k, cell]) => {
            if (!cell) return false;
            return String(k).startsWith(`${timetableId}|`);
        });
        return !hasAssignment;
    }

    function freeStaffCandidatesForRequest(reqRow) {
        const timetableId = Number(reqRow.timetable_id);
        return staffPool.filter((s) => {
            const sid = Number(s.staff_id);
            if (!sid) return false;
            if (sid === Number(reqRow.requester_staff_id)) return false;
            return isStaffFreeInTimetable(sid, timetableId);
        });
    }

    function hasOpenLeaveRequestForAssignment(assignmentId) {
        if (!assignmentId) return false;
        return leaveRequests.some((r) => Number(r.assignment_id) === Number(assignmentId) && String(r.status || '').toUpperCase() === 'OPEN');
    }

    function canCreateLeaveRequestFromCell(staffId, cell) {
        if (!canRequestTransfer || !currentStaffId) return false;
        if (!cell?.assignment_id) return false;
        if (String(cell.allotment_state || '').toUpperCase() === 'PUBLISHED') return false;
        if (Number(staffId) !== Number(currentStaffId)) return false;
        if (hasOpenLeaveRequestForAssignment(cell.assignment_id)) return false;
        return true;
    }

    async function handleGridCellLeaveRequest(staffId, cell) {
        if (!canCreateLeaveRequestFromCell(staffId, cell) || loading) return;
        const existingNote = String(leaveNoteByAssignment[cell.assignment_id] || '');
        const note = window.prompt('Optional leave note (press OK to submit request):', existingNote);
        if (note === null) return;
        await createLeaveRequest(cell.assignment_id, note);
    }

    async function createLeaveRequest(assignmentId, noteOverride) {
        if (selectedSessionLocked) {
            setError('Published plans are locked. Leave requests cannot be changed.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const note = typeof noteOverride === 'string'
                ? String(noteOverride).trim()
                : String(leaveNoteByAssignment[assignmentId] || '').trim();
            await api.post('/supervision/leave-requests', {
                assignment_id: Number(assignmentId),
                note
            });
            setSuccess('Leave request submitted successfully.');
            setLeaveNoteByAssignment((prev) => ({ ...prev, [assignmentId]: '' }));
            await loadDashboard(selectedTimetableId, stateFilter, selectedPlanScopeId, selectedExamDate);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit leave request.');
        } finally {
            setLoading(false);
        }
    }

    async function claimLeaveRequest(requestId) {
        const reqRow = leaveRequests.find((r) => Number(r.request_id) === Number(requestId));
        if (reqRow && isSessionPublished(reqRow.timetable_id)) {
            setError('Published plans are locked. Shift claiming is disabled.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post(`/supervision/leave-requests/${requestId}/claim`);
            setSuccess('Shift claimed successfully.');
            await loadDashboard(selectedTimetableId, stateFilter, selectedPlanScopeId, selectedExamDate);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to claim shift.');
        } finally {
            setLoading(false);
        }
    }

    async function assignLeaveRequest(requestId) {
        const reqRow = leaveRequests.find((r) => Number(r.request_id) === Number(requestId));
        if (reqRow && isSessionPublished(reqRow.timetable_id)) {
            setError('Published plans are locked. Shift assignment is disabled.');
            return;
        }

        const nextStaffId = Number(assignStaffByRequest[requestId] || 0);
        if (!nextStaffId) {
            setError('Select a free staff member first.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post(`/supervision/leave-requests/${requestId}/assign`, { staff_id: nextStaffId });
            setSuccess('Shift assigned successfully.');
            setAssignStaffByRequest((prev) => ({ ...prev, [requestId]: '' }));
            await loadDashboard(selectedTimetableId, stateFilter, selectedPlanScopeId, selectedExamDate);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to assign shift.');
        } finally {
            setLoading(false);
        }
    }

    async function cancelLeaveRequest(requestId) {
        const reqRow = leaveRequests.find((r) => Number(r.request_id) === Number(requestId));
        if (reqRow && isSessionPublished(reqRow.timetable_id)) {
            setError('Published plans are locked. Leave requests cannot be changed.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post(`/supervision/leave-requests/${requestId}/cancel`);
            setSuccess('Leave request cancelled.');
            await loadDashboard(selectedTimetableId, stateFilter, selectedPlanScopeId, selectedExamDate);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to cancel leave request.');
        } finally {
            setLoading(false);
        }
    }

    function openDirectAssignModal(staffId, timetableId) {
        if (!canEdit || loading) return;
        if (isSessionPublished(timetableId)) {
            setError('This session is published and locked. Only print or delete is allowed.');
            return;
        }
        setDirectAssignModal({ staffId, timetableId });
        setDirectAssignRoom('');
        setDirectAssignStaff(staffId);
    }

    async function submitDirectAssign() {
        if (!directAssignModal || !directAssignRoom.trim()) {
            setError('Please enter a room number.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/supervision/direct-assign', {
                staff_id: Number(directAssignModal.staffId),
                timetable_id: Number(directAssignModal.timetableId),
                room_number: directAssignRoom.trim()
            });
            setSuccess('Staff assigned to supervision shift successfully.');
            setDirectAssignModal(null);
            setDirectAssignRoom('');
            await loadDashboard(selectedTimetableId, stateFilter, selectedPlanScopeId, selectedExamDate);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to assign staff to shift.');
        } finally {
            setLoading(false);
        }
    }

    function openReassignModal(staffId, currentRoom, timetableId, assignmentId) {
        if (!canEdit || loading) return;
        if (isSessionPublished(timetableId)) {
            setError('This session is published and locked. Reassignment is disabled.');
            return;
        }
        setReassignModal({ staffId, currentRoom, timetableId, assignmentId });
        setReassignNewRoom('');
        setReassignNewStaff('');
    }

    async function submitReassign() {
        if (!reassignModal) return;

        if (isSessionPublished(reassignModal.timetableId)) {
            setError('This session is published and locked. Reassignment is disabled.');
            return;
        }
        
        const hasRoom = reassignNewRoom.trim();
        const hasStaff = reassignNewStaff;

        if (!hasRoom && !hasStaff) {
            setError('Please enter a new room number or select a staff member to replace.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            if (hasStaff && !hasRoom) {
                // Replace with different staff in same room
                await api.post('/supervision/reassign', {
                    assignment_id: Number(reassignModal.assignmentId),
                    new_staff_id: Number(reassignNewStaff),
                    new_room: reassignModal.currentRoom
                });
                setSuccess('Staff replaced successfully.');
            } else if (hasRoom && !hasStaff) {
                // Move same staff to different room
                await api.post('/supervision/reassign', {
                    assignment_id: Number(reassignModal.assignmentId),
                    new_staff_id: Number(reassignModal.staffId),
                    new_room: reassignNewRoom.trim()
                });
                setSuccess('Staff moved to new room successfully.');
            } else {
                // Replace with different staff AND different room
                await api.post('/supervision/reassign', {
                    assignment_id: Number(reassignModal.assignmentId),
                    new_staff_id: Number(reassignNewStaff),
                    new_room: reassignNewRoom.trim()
                });
                setSuccess('Staff replaced and moved to new room successfully.');
            }
            setReassignModal(null);
            setReassignNewRoom('');
            setReassignNewStaff('');
            await loadDashboard(selectedTimetableId, stateFilter, selectedPlanScopeId, selectedExamDate);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reassign staff.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h2><ClipboardCheck size={24} /> Supervision Allotments</h2>
                    <p>Generate, review, and publish room-wise supervision assignments from approved seating plans and timetable sessions.</p>
                </div>
                <button className="btn btn-secondary" onClick={() => { loadBaseData(); loadDashboard(selectedTimetableId, stateFilter, selectedPlanScopeId, selectedExamDate); }}>
                    <RefreshCcw size={14} /> Refresh
                </button>
            </div>

            {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
            {success && <Alert type="success" dismissible onDismiss={() => setSuccess('')}>{success}</Alert>}

            {directAssignModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'var(--background)',
                        padding: 20,
                        borderRadius: 8,
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                        maxWidth: 400,
                        width: '90%'
                    }}>
                        <h3 style={{ marginBottom: 16 }}>Assign Staff to Supervision Shift</h3>
                        <div className="form-group" style={{ marginBottom: 12 }}>
                            <label className="form-label">Room Number</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Enter room number"
                                value={directAssignRoom}
                                onChange={(e) => setDirectAssignRoom(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setDirectAssignModal(null)}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={submitDirectAssign}
                                disabled={loading}
                            >
                                Assign
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {reassignModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: 'var(--background)',
                        padding: 24,
                        borderRadius: 12,
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        maxWidth: 450,
                        width: '90%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        background: 'linear-gradient(135deg, var(--background) 0%, rgba(255, 255, 255, 0.02) 100%)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                            <AlertCircle size={24} style={{ color: 'var(--primary)' }} />
                            <h3 style={{ margin: 0 }}>Reassign Staff Member</h3>
                        </div>
                        <div style={{ 
                            fontSize: 13, 
                            color: 'var(--text-muted)', 
                            marginBottom: 16,
                            padding: '12px',
                            backgroundColor: 'rgba(255, 200, 87, 0.1)',
                            borderLeft: '3px solid var(--primary)',
                            borderRadius: 6
                        }}>
                            Current Assignment Room: <strong style={{ color: 'var(--text)' }}>{reassignModal.currentRoom}</strong>
                        </div>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label">Move to New Room (Optional)</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Leave blank to keep same room"
                                value={reassignNewRoom}
                                onChange={(e) => setReassignNewRoom(e.target.value)}
                                disabled={loading}
                                style={{ borderRadius: 6 }}
                            />
                            <small style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Enter room number or leave empty to maintain current room</small>
                        </div>
                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">Replace with Different Staff (Optional)</label>
                            <select
                                className="form-control"
                                value={reassignNewStaff}
                                onChange={(e) => setReassignNewStaff(e.target.value)}
                                disabled={loading}
                                style={{ borderRadius: 6 }}
                            >
                                <option value="">Keep same staff</option>
                                {staffPool
                                    .filter(s => Number(s.staff_id) !== Number(reassignModal.staffId))
                                    .filter(s => {
                                        const roleNames = (Array.isArray(s.roles) ? s.roles : []).map(r => String(r.role_name || '').toUpperCase());
                                        return !roleNames.includes('HOD') && !roleNames.includes('EXAM_COORDINATOR');
                                    })
                                    .map((s) => (
                                        <option key={`reassign-${s.staff_id}`} value={s.staff_id}>
                                            {s.staff_code || 'NA'} ({s.staff_name || `Staff ${s.staff_id}`})
                                        </option>
                                    ))}
                            </select>
                            <small style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Or select a different staff member to swap</small>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setReassignModal(null)}
                                disabled={loading}
                                style={{ borderRadius: 6 }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={submitReassign}
                                disabled={loading}
                                style={{ borderRadius: 6 }}
                            >
                                Reassign
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <section className="card" style={{ marginBottom: 16 }}>
                <div className="grid-3" style={{ gap: 10 }}>
                    <div className="form-group">
                        <label className="form-label">Approved Seating Plan</label>
                        <select className="form-control" value={selectedPlanId} onChange={(e) => onChangePlan(e.target.value)}>
                            <option value="">Select approved plan</option>
                            {approvedPlans.map((p) => (
                                <option key={p.plan_id} value={p.plan_id}>
                                    {p.plan_date} | {p.time_slot} | {p.exam_type}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Department Scope</label>
                        <select className="form-control" value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)}>
                            <option value="">Auto (from plan/user scope)</option>
                            {branches.map((b) => (
                                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Exam Session</label>
                        <select
                            className="form-control"
                            value={selectedTimetableId}
                            onChange={(e) => {
                                setSelectedPlanScopeId('');
                                setSelectedExamDate('');
                                setSelectedTimetableId(e.target.value);
                            }}
                        >
                            <option value="">All sessions</option>
                            {dashboardSessions.map((s) => (
                                <option key={s.timetable_id} value={s.timetable_id}>
                                    {s.exam_date} | {s.time_slot}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Min Duties (Overflow Threshold)</label>
                        <div style={{
                            padding: '10px 12px',
                            backgroundColor: 'var(--background-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            fontWeight: 500,
                            fontSize: 14
                        }}>
                            {calculatedMinDuties} duties
                            <div style={{
                                fontSize: 12,
                                color: 'var(--text-muted)',
                                marginTop: 4,
                                fontWeight: 'normal'
                            }}>
                                {selectedPlanId && approvedPlans.find(p => String(p.plan_id) === String(selectedPlanId))?.rooms
                                    ? (() => {
                                        const plan = approvedPlans.find(p => String(p.plan_id) === String(selectedPlanId));
                                        const roomCount = plan.rooms.length;
                                        const totalSlots = roomCount * 2;
                                        const eligibleStaff = staffPool.filter(s => {
                                            const roleNames = (Array.isArray(s.roles) ? s.roles : []).map(r => String(r.role_name || '').toUpperCase());
                                            if (roleNames.includes('HOD') || roleNames.includes('EXAM_COORDINATOR')) return false;
                                            if (selectedBranchId && Number(s.branch_id) !== Number(selectedBranchId)) return false;
                                            return true;
                                        }).length;
                                        const avgDuties = eligibleStaff > 0 ? Math.ceil(totalSlots / eligibleStaff) : 10;
                                        return `Average of ${avgDuties} duties per staff member`;
                                    })()
                                    : 'Select a plan to calculate'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={handleGenerate} disabled={!canEdit || loading || !selectedPlanId}>
                        Generate Draft Allotment
                    </button>
                    <button className="btn btn-secondary" onClick={handlePublish} disabled={!canEdit || loading || !selectedTimetableId || selectedSessionLocked}>
                        Publish Allotment
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => handleDeleteAllotments({
                            timetableId: selectedTimetableId,
                            label: selectedSession ? `${selectedSession.exam_date} (${selectedSession.time_slot})` : 'selected session'
                        })}
                        disabled={!canEdit || loading || !selectedTimetableId}
                    >
                        Delete Allotment
                    </button>
                    <button className="btn btn-secondary" onClick={handlePrint} disabled={!staffRows.length}>
                        <Printer size={14} /> Print Current Plan
                    </button>
                    <select className="form-control" style={{ maxWidth: 180, marginLeft: 'auto' }} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                        <option value="all">All States</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                    </select>
                </div>
            </section>

            <section className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 10 }}>Saved Supervision Plans</h3>
                {!savedPlans.length ? (
                    <div className="text-muted" style={{ fontSize: 13 }}>No saved supervision allotments yet.</div>
                ) : (
                    <div className="table-wrap" style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--border)' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ minWidth: 190 }}>Plan Window</th>
                                    <th style={{ minWidth: 120 }}>Plan ID</th>
                                    <th style={{ minWidth: 120 }}>Timetables</th>
                                    <th style={{ minWidth: 120 }}>Assignments</th>
                                    <th style={{ minWidth: 120 }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {savedPlans.map((s) => {
                                    const isExpanded = expandedSavedPlanKey === s.key;
                                    const status = getSavedPlanStatus(s);
                                    return (
                                        <Fragment key={`saved-${s.key}`}>
                                            <tr
                                                onClick={() => setExpandedSavedPlanKey((prev) => (prev === s.key ? '' : s.key))}
                                                style={{ cursor: 'pointer' }}
                                                title={isExpanded ? 'Collapse actions' : 'Expand actions'}
                                            >
                                                <td>
                                                    <span style={{ display: 'inline-block', width: 14, marginRight: 6, fontWeight: 700 }}>
                                                        {isExpanded ? 'v' : '>'}
                                                    </span>
                                                    {s.start_date}{s.end_date && s.end_date !== s.start_date ? ` to ${s.end_date}` : ''}
                                                </td>
                                                <td>{s.hasMixedPlans ? 'Multiple' : (s.plan_id || '-')}</td>
                                                <td>{s.timetable_count || 0}</td>
                                                <td>{s.assignment_count || 0}</td>
                                                <td style={{ textTransform: 'capitalize' }}>{status}</td>
                                            </tr>
                                            {isExpanded && (
                                                <tr key={`saved-expanded-${s.key}`}>
                                                    <td colSpan={5}>
                                                        <div style={{ marginBottom: 10 }}>
                                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                                                                Select day(s) from this plan:{isAdminAccount ? ' multi-select enabled' : ' single-select'}
                                                            </div>
                                                            <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                                                                {Array.from(new Set((s.sessions || []).map((x) => x.exam_date))).map((d) => (
                                                                    <button
                                                                        key={`saved-day-${s.key}-${d}`}
                                                                        type="button"
                                                                        className={`btn btn-sm ${selectedSavedPlanDates.includes(String(d)) ? 'btn-primary' : 'btn-secondary'}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleSavedPlanDate(s, d);
                                                                        }}
                                                                    >
                                                                        {d}
                                                                    </button>
                                                                ))}
                                                                {selectedSavedPlanDates.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-secondary btn-sm"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedSavedPlanDates([]);
                                                                        }}
                                                                    >
                                                                        Clear Dates
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    viewSavedPlan(s);
                                                                }}
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-sm"
                                                                disabled={!canEdit || loading || status === 'published'}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    applyActionToSavedPlan(s, 'publish');
                                                                }}
                                                            >
                                                                Publish
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-sm"
                                                                disabled={!canEdit || loading || status === 'published'}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    applyActionToSavedPlan(s, 'archive');
                                                                }}
                                                            >
                                                                Archive
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-sm"
                                                                disabled={!canEdit || loading}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    applyActionToSavedPlan(s, 'delete');
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 10 }}>Leave Requests & Shift Takeover</h3>

                {canRequestTransfer && currentStaffId && (
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                            Submit a leave request for your assigned shift
                        </div>
                        {!myAssignments.length ? (
                            <div className="text-muted" style={{ fontSize: 13 }}>No assigned shifts available for your account in current view.</div>
                        ) : (
                            <div className="table-wrap" style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--border)' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Time Slot</th>
                                            <th>Room</th>
                                            <th style={{ minWidth: 220 }}>Note</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {myAssignments.map((a) => (
                                            <tr key={`my-assignment-${a.assignment_id}`}>
                                                <td>{a.exam_date}</td>
                                                <td>{a.time_slot}</td>
                                                <td>{a.room_number}</td>
                                                <td>
                                                    <input
                                                        className="form-control"
                                                        placeholder="Optional reason"
                                                        value={leaveNoteByAssignment[a.assignment_id] || ''}
                                                        disabled={a.alreadyRequested || loading}
                                                        onChange={(e) => setLeaveNoteByAssignment((prev) => ({ ...prev, [a.assignment_id]: e.target.value }))}
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        disabled={a.alreadyRequested || loading || String(a.allotment_state || '').toUpperCase() === 'PUBLISHED'}
                                                        onClick={() => createLeaveRequest(a.assignment_id)}
                                                    >
                                                        {a.alreadyRequested ? 'Requested' : 'Request Leave'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {!leaveRequests.length ? (
                    <div className="text-muted" style={{ fontSize: 13 }}>No open leave requests.</div>
                ) : (
                    <div className="table-wrap" style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--border)' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Time Slot</th>
                                    <th>Room</th>
                                    <th>Requested By</th>
                                    <th>Current Assignee</th>
                                    <th>Note</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaveRequests.map((r) => {
                                    const requestIsMine = currentStaffId && Number(r.requester_staff_id) === Number(currentStaffId);
                                    const canClaim = canRequestTransfer
                                        && currentStaffId
                                        && !requestIsMine
                                        && isStaffFreeInTimetable(currentStaffId, Number(r.timetable_id));
                                    const freeCandidates = canEdit ? freeStaffCandidatesForRequest(r) : [];

                                    return (
                                        <tr key={`leave-request-${r.request_id}`}>
                                            <td>{r.exam_date}</td>
                                            <td>{r.time_slot}</td>
                                            <td>{r.room_number}</td>
                                            <td>{r.requester_code || 'NA'}{r.requester_name ? ` (${r.requester_name})` : ''}</td>
                                            <td>{r.current_staff_code || 'NA'}{r.current_staff_name ? ` (${r.current_staff_name})` : ''}</td>
                                            <td>{r.note || '-'}</td>
                                            <td>
                                                <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                                                    {canRequestTransfer && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary btn-sm"
                                                            disabled={!canClaim || loading}
                                                            onClick={() => claimLeaveRequest(r.request_id)}
                                                        >
                                                            Take Shift
                                                        </button>
                                                    )}

                                                    {(requestIsMine || canEdit) && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary btn-sm"
                                                            disabled={loading}
                                                            onClick={() => cancelLeaveRequest(r.request_id)}
                                                        >
                                                            Cancel Request
                                                        </button>
                                                    )}

                                                    {canEdit && (
                                                        <>
                                                            <select
                                                                className="form-control"
                                                                style={{ minWidth: 150 }}
                                                                value={assignStaffByRequest[r.request_id] || ''}
                                                                onChange={(e) => setAssignStaffByRequest((prev) => ({ ...prev, [r.request_id]: e.target.value }))}
                                                            >
                                                                <option value="">Select free staff</option>
                                                                {freeCandidates.map((s) => (
                                                                    <option key={`assign-${r.request_id}-${s.staff_id}`} value={s.staff_id}>
                                                                        {s.staff_code || 'NA'} ({s.staff_name || `Staff ${s.staff_id}`})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-sm"
                                                                disabled={loading || !assignStaffByRequest[r.request_id]}
                                                                onClick={() => assignLeaveRequest(r.request_id)}
                                                            >
                                                                Assign Shift
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="card" ref={printRef}>
                <h3 style={{ marginBottom: 4 }}>Allotment Grid</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    {selectedSession
                        ? `Session: ${selectedSession.exam_date} | ${selectedSession.time_slot}`
                        : selectedExamDate
                            ? `Date: ${selectedExamDate} (all sessions grouped)`
                        : 'Showing all available sessions.'}
                </p>

                <div className="supervision-grid-screen table-wrap" style={{ maxHeight: 560, overflow: 'auto', border: '1px solid var(--border)' }}>
                    <table>
                        <thead>
                            <tr>
                                <th rowSpan={2} style={{ minWidth: 100, textAlign: 'left' }}>Staff</th>
                                <th rowSpan={2} style={{ minWidth: 100, textAlign: 'center' }}>Total assignments</th>
                                {groupedSessionColumns.map((group) => (
                                    <th
                                        key={`date-${group.examDate}`}
                                        colSpan={group.sessions.length}
                                        style={{ minWidth: Math.max(160, group.sessions.length * 140), textAlign: 'center', fontSize: 12 }}
                                    >
                                        {group.examDate}
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                {groupedSessionColumns.flatMap((group) => {
                                    const ranges = mapSessionsToTimeRanges(group.sessions);
                                    return group.sessions.map((s, idx) => (
                                        <th key={`time-${s.synthetic_id || sessionKey(s)}`} style={{ minWidth: 140, textAlign: 'center', fontSize: 12 }}>
                                            {ranges[idx] || getSessionRangeLabel(s)}
                                        </th>
                                    ));
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {staffRows.map((staff) => (
                                <tr key={staff.staff_id}>
                                    <td style={{ paddingRight: 8 }}>
                                        <strong style={{ fontSize: 13 }}>{staff.staff_code || `STF-${staff.staff_id}`}</strong>
                                    </td>
                                    <td style={{ textAlign: 'center', paddingRight: 8 }}>
                                        <strong style={{ fontSize: 13 }}>{getDutyCount(staff)}</strong>
                                    </td>
                                    {sessionColumns.map((s) => {
                                        const key = sessionKey(s);
                                        const cell = staff.cells?.[key];
                                        const canRequestFromCell = canCreateLeaveRequestFromCell(staff.staff_id, cell);
                                        const sessionPublished = isSessionPublished(s.timetable_id);
                                        const cellPublished = String(cell?.allotment_state || '').toUpperCase() === 'PUBLISHED';
                                        const canAssignToCell = canEdit && !loading && !cell && !sessionPublished;
                                        const canReassignCell = canEdit && !loading && cell && !cellPublished && !sessionPublished;
                                        return (
                                            <td key={`${staff.staff_id}-${key}`} style={{ textAlign: 'center', fontSize: 12, padding: '4px 2px' }}>
                                                {!cell ? (
                                                    <div
                                                        style={{
                                                            color: '#00c853',
                                                            fontWeight: 800,
                                                            cursor: canAssignToCell ? 'pointer' : 'default',
                                                            padding: '2px 4px',
                                                            borderRadius: 2,
                                                            transition: 'background-color 0.2s',
                                                            backgroundColor: canAssignToCell ? 'rgba(0, 165, 242, 0.16)' : 'transparent'
                                                        }}
                                                        onClick={() => canAssignToCell && openDirectAssignModal(staff.staff_id, s.timetable_id)}
                                                        title={canAssignToCell ? 'Click to assign this staff to a supervision shift' : 'Free'}
                                                    >
                                                        Free
                                                    </div>
                                                ) : (
                                                    <div
                                                        style={{
                                                            whiteSpace: 'nowrap',
                                                            color: 'var(--primary)',
                                                            fontWeight: 700,
                                                            fontSize: 12,
                                                            cursor: (canRequestFromCell || canReassignCell) && !loading ? 'pointer' : 'default',
                                                            padding: '2px 4px',
                                                            borderRadius: 2,
                                                            transition: 'background-color 0.2s',
                                                            backgroundColor: canReassignCell ? 'rgba(249, 115, 22, 0.25)' : (canRequestFromCell ? 'rgba(249, 115, 22, 0.16)' : 'rgba(249, 115, 22, 0.10)')
                                                        }}
                                                        onClick={() => canReassignCell ? openReassignModal(staff.staff_id, cell.room_number, s.timetable_id, cell.assignment_id) : (canRequestFromCell && handleGridCellLeaveRequest(staff.staff_id, cell))}
                                                        title={canReassignCell ? 'Click to reassign this staff member to a different shift' : (canRequestFromCell ? 'Click to submit leave request for this shift' : '')}
                                                    >
                                                        {cell.room_number}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            {!staffRows.length && (
                                <tr>
                                    <td colSpan={Math.max(3, sessionColumns.length + 2)} className="text-center text-muted" style={{ padding: 16 }}>
                                        {loading ? 'Loading allotments...' : 'No allotment rows available for the selected filter.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="supervision-print-area">
                    {groupedSessionColumns.map((group, index) => {
                        const ranges = mapSessionsToTimeRanges(group.sessions);
                        const isLast = index === groupedSessionColumns.length - 1;

                        return (
                            <section
                                key={`print-page-${group.examDate}`}
                                className={`supervision-print-page ${!isLast ? 'with-page-break' : ''}`}
                            >
                                <header className="supervision-print-header">
                                    <h4>Supervision Allotment Grid</h4>
                                    <p>Date: {group.examDate}</p>
                                </header>

                                <div className="supervision-print-table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th rowSpan={2} style={{ minWidth: 100, textAlign: 'left' }}>Staff</th>
                                                <th rowSpan={2} style={{ minWidth: 100, textAlign: 'center' }}>Total assignments</th>
                                                <th
                                                    colSpan={group.sessions.length}
                                                    style={{ minWidth: Math.max(160, group.sessions.length * 140), textAlign: 'center', fontSize: 12 }}
                                                >
                                                    {group.examDate}
                                                </th>
                                            </tr>
                                            <tr>
                                                {group.sessions.map((s, idx) => (
                                                    <th key={`print-time-${s.synthetic_id || sessionKey(s)}`} style={{ minWidth: 140, textAlign: 'center', fontSize: 12 }}>
                                                        {ranges[idx] || getSessionRangeLabel(s)}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {staffRows.map((staff) => (
                                                <tr key={`print-${group.examDate}-${staff.staff_id}`}>
                                                    <td style={{ paddingRight: 8 }}>
                                                        <strong style={{ fontSize: 13 }}>{staff.staff_code || `STF-${staff.staff_id}`}</strong>
                                                    </td>
                                                    <td style={{ textAlign: 'center', paddingRight: 8 }}>
                                                        <strong style={{ fontSize: 13 }}>{getDutyCount(staff)}</strong>
                                                    </td>
                                                    {group.sessions.map((s) => {
                                                        const key = sessionKey(s);
                                                        const cell = staff.cells?.[key];
                                                        return (
                                                            <td key={`print-cell-${staff.staff_id}-${key}`} style={{ textAlign: 'center', fontSize: 12, padding: '4px 2px' }}>
                                                                {!cell ? (
                                                                    <span style={{ color: '#00c853', fontWeight: 800 }}>Free</span>
                                                                ) : (
                                                                    <div
                                                                        style={{
                                                                            whiteSpace: 'nowrap',
                                                                            color: 'var(--primary)',
                                                                            fontWeight: 700,
                                                                            fontSize: 12,
                                                                            padding: '2px 4px',
                                                                            borderRadius: 2,
                                                                            backgroundColor: 'rgba(249, 115, 22, 0.10)'
                                                                        }}
                                                                    >
                                                                        {cell.room_number}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                            {!staffRows.length && (
                                                <tr>
                                                    <td colSpan={Math.max(3, group.sessions.length + 2)} className="text-center text-muted" style={{ padding: 16 }}>
                                                        {loading ? 'Loading allotments...' : 'No allotment rows available for the selected filter.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        );
                    })}
                </div>
            </section>

        </div>
    );
}
