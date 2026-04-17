import { useState, useEffect, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ClipboardList, Users, Save, CheckCircle, Printer, Ruler, Bot, PencilLine, AlertTriangle, Trash2 } from 'lucide-react';
import api from '../api';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

const YEARS = ['SE', 'TE', 'BE'];

function formatDate(d) {
    if (!d) return '';
    if (typeof d === 'string') {
        const trimmed = d.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }
    }
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return '';
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDisplayDate(d) {
    const ymd = formatDate(d);
    if (!ymd) return 'Unknown Date';
    const [y, m, day] = ymd.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function extractStartTime(timeSlot) {
    const m = String(timeSlot || '').match(/(\d{1,2}):(\d{2})/);
    if (!m) return '';
    return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
}

function addDays(dateText, offset) {
    const d = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateText;
    d.setDate(d.getDate() + offset);
    return formatDate(d);
}

export default function SeatingArrangement() {
    const { hasPermission } = useAuth();
    const canEditSeating = hasPermission('edit_seating');
    const canEditSupervision = hasPermission('edit_supervision');
    const [examType, setExamType] = useState('internals');
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [timetableSessions, setTimetableSessions] = useState([]);
    const [selectedTimetableId, setSelectedTimetableId] = useState('');
    const [selectedTimetable, setSelectedTimetable] = useState(null);
    const [allocationMode, setAllocationMode] = useState('auto'); // 'manual' or 'auto'
    const [branches, setBranches] = useState([]);
    const [branchConfigs, setBranchConfigs] = useState({});
    const [yearCounts, setYearCounts] = useState({ SE: '', TE: '', BE: '' });
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [autoAllocLoading, setAutoAllocLoading] = useState(false);

    const [planDate, setPlanDate] = useState('');
    const [timeSlotStart, setTimeSlotStart] = useState('11:00');

    // Virtual Room state
    const [roomsConfig, setRoomsConfig] = useState([]);
    const [selectedRoomIds, setSelectedRoomIds] = useState([]);
    const [activeFloor, setActiveFloor] = useState('Ground');

    const [savedPlanId, setSavedPlanId] = useState(null);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');
    const [loadingSave, setLoadingSave] = useState(false);
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [availabilityDate, setAvailabilityDate] = useState(formatDate(new Date()));
    const [availability, setAvailability] = useState(null);
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deletingPlan, setDeletingPlan] = useState(false);
    const [generatePromptPlanId, setGeneratePromptPlanId] = useState(null);
    const [generatePromptBusy, setGeneratePromptBusy] = useState(false);
    const [internalsTimetableReady, setInternalsTimetableReady] = useState(false);
    const [internalsTimetableSummary, setInternalsTimetableSummary] = useState('');

    const [pendingPrint, setPendingPrint] = useState(false);

    const printRef = useRef();
    const handlePrint = useReactToPrint({ content: () => printRef.current });

    // When View is clicked, we populate state and set pendingPrint = true.
    // This effect waits for state to flush to DOM, then triggers the print preview.
    useEffect(() => {
        if (pendingPrint && result) {
            // Slight timeout ensures any nested React renders inside printRef finish
            const timer = setTimeout(() => {
                handlePrint();
                setPendingPrint(false);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [pendingPrint, result, handlePrint]);

    const isInternals = examType === 'internals';

    const groupedTimetableOptions = useMemo(() => {
        const byScope = new Map();

        for (const s of timetableSessions) {
            const scopeKey = `${s.branch_id || 'NA'}::${s.exam_type || 'NA'}::${s.source || 'NA'}`;
            if (!byScope.has(scopeKey)) {
                byScope.set(scopeKey, []);
            }
            byScope.get(scopeKey).push(s);
        }

        const groups = [];

        for (const [scopeKey, scopeRows] of byScope.entries()) {
            const dateMap = new Map();
            scopeRows.forEach((row) => {
                const d = String(row.exam_date || '');
                if (!d) return;
                if (!dateMap.has(d)) dateMap.set(d, []);
                dateMap.get(d).push(row);
            });

            const dates = Array.from(dateMap.keys()).sort((a, b) => a.localeCompare(b));
            const usedDates = new Set();

            for (const date of dates) {
                if (usedDates.has(date)) continue;

                const d2 = addDays(date, 1);
                const d3 = addDays(date, 2);
                const hasThreeDayWindow = dateMap.has(d2) && dateMap.has(d3);
                const bundleDates = hasThreeDayWindow ? [date, d2, d3] : [date];
                bundleDates.forEach((d) => usedDates.add(d));

                const bundleRows = bundleDates
                    .flatMap((d) => dateMap.get(d) || [])
                    .sort((a, b) => {
                        const dateCmp = String(a.exam_date || '').localeCompare(String(b.exam_date || ''));
                        if (dateCmp !== 0) return dateCmp;
                        return String(a.time_slot || '').localeCompare(String(b.time_slot || ''));
                    });

                const first = bundleRows[0];
                if (!first) continue;

                groups.push({
                    group_key: `${scopeKey}::${date}`,
                    branch_id: first.branch_id || null,
                    branch_code: first.branch_code || null,
                    branch_name: first.branch_name || null,
                    exam_type: first.exam_type || null,
                    start_date: date,
                    end_date: bundleDates[bundleDates.length - 1],
                    session_count: bundleRows.length,
                    session_ids: bundleRows.map((x) => x.timetable_id),
                    source: first.source || null,
                    time_slot: hasThreeDayWindow ? 'ALL_SESSIONS_3_DAYS' : (first.time_slot || 'SESSION')
                });
            }
        }

        return groups.sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')));
    }, [timetableSessions]);

    // Fetch physical rooms and branches on mount
    useEffect(() => {
        async function loadBaseData() {
            try {
                const [roomsRes, branchesRes, configRes, sessionsRes] = await Promise.all([
                    api.get('/rooms'),
                    api.get('/branches'),
                    api.get('/branch-config'),
                    api.get('/curriculum/timetable/sessions', { params: { source: 'internal_generator' } })
                ]);

                setRoomsConfig(roomsRes.data);
                if (roomsRes.data.length > 0) setActiveFloor(roomsRes.data[0].floor_name);

                setBranches(branchesRes.data);

                let sessions = sessionsRes.data || [];
                if (sessions.length === 0) {
                    const fallbackSessionsRes = await api.get('/curriculum/timetable/sessions');
                    sessions = fallbackSessionsRes.data || [];
                }
                setTimetableSessions(sessions);

                // Create a map of branch_id -> config for quick lookup
                const configMap = {};
                configRes.data.forEach(config => {
                    configMap[config.branch_id] = config;
                });
                setBranchConfigs(configMap);
            } catch (err) {
                console.error('Failed to load rooms or branches configuration', err);
            }
        }

        loadBaseData();
    }, []);

    useEffect(() => {
        if (!selectedTimetableId) {
            setSelectedTimetable((prev) => (prev === null ? prev : null));
            setSelectedBranch((prev) => (prev === '' ? prev : ''));
            setSelectedBranches((prev) => (prev.length === 0 ? prev : []));
            return;
        }

        const selected = groupedTimetableOptions.find((s) => String(s.group_key) === String(selectedTimetableId)) || null;
        setSelectedTimetable((prev) => {
            if (!selected && !prev) return prev;
            if (prev?.group_key && selected?.group_key && prev.group_key === selected.group_key) return prev;
            return selected;
        });

        if (selected?.branch_id) {
            const branchIdText = String(selected.branch_id);
            setSelectedBranch((prev) => (prev === branchIdText ? prev : branchIdText));
            setSelectedBranches((prev) => (prev.length === 1 && prev[0] === branchIdText ? prev : [branchIdText]));
        } else {
            // Legacy timetable rows may not have branch_id; keep or default to first branch.
            const fallbackBranchId = selectedBranch || (branches.length ? String(branches[0].branch_id) : '');
            setSelectedBranch((prev) => (prev === fallbackBranchId ? prev : fallbackBranchId));
            setSelectedBranches((prev) => (
                fallbackBranchId
                    ? (prev.length === 1 && prev[0] === fallbackBranchId ? prev : [fallbackBranchId])
                    : (prev.length === 0 ? prev : [])
            ));
        }

        if (selected?.start_date) {
            setPlanDate(String(selected.start_date));
        }

        if (!isInternals && selected?.time_slot) {
            const start = extractStartTime(selected.time_slot);
            if (start) setTimeSlotStart(start);
        }
    }, [selectedTimetableId, groupedTimetableOptions, isInternals, branches, selectedBranch]);

    // Auto-fill SE, TE, BE when branch is selected in auto mode
    useEffect(() => {
        if (allocationMode === 'auto' && selectedBranches.length > 0 && branchConfigs[selectedBranches[0]]) {
            const firstBranchId = selectedBranches[0];
            const selectedBranchObj = branches.find(b => b.branch_id === parseInt(firstBranchId));
            const config = branchConfigs[firstBranchId];
            const isFE = selectedBranchObj && selectedBranchObj.branch_code === 'FE';

            if (isFE) {
                setYearCounts({
                    SE: String(config.se_students),
                    TE: '',
                    BE: ''
                });
            } else {
                setYearCounts({
                    SE: String(config.se_students),
                    TE: String(config.te_students),
                    BE: String(config.be_students)
                });
            }
        }
        // In manual mode, preserve user-entered counts - don't auto-clear
    }, [selectedBranches, allocationMode, branchConfigs, branches]);

    useEffect(() => {
        async function checkInternalsTimetable() {
            if (examType !== 'internals') {
                setInternalsTimetableReady(true);
                setInternalsTimetableSummary('');
                return;
            }

            if (selectedTimetable && Number(selectedTimetable.session_count || 0) > 0) {
                setInternalsTimetableReady(true);
                setInternalsTimetableSummary('Timetable selected and available for seating generation.');
                return;
            }

            if (!selectedBranches.length) {
                setInternalsTimetableReady(false);
                setInternalsTimetableSummary('Select a timetable to verify timetable generation coverage.');
                return;
            }

            try {
                const checks = await Promise.all(
                    selectedBranches.map((branchId) =>
                        api.get('/curriculum/timetable/status', {
                            params: { branchId: Number(branchId), examType: 'theory' }
                        })
                    )
                );

                const ready = checks.every((r) => Boolean(r.data?.generated));
                const counts = checks.map((r, idx) => `${selectedBranches[idx]}: ${r.data?.session_count || 0}`).join(', ');
                setInternalsTimetableReady(ready);
                setInternalsTimetableSummary(
                    ready
                        ? `Timetable available for selected branches (${counts}).`
                        : `Generate timetable first for all selected branches. Current sessions: ${counts}.`
                );
            } catch {
                setInternalsTimetableReady(false);
                setInternalsTimetableSummary('Unable to verify timetable generation status.');
            }
        }

        checkInternalsTimetable();
    }, [examType, selectedBranches, selectedTimetable]);

    const totalFromYears = YEARS.reduce((sum, y) => sum + parseInt(yearCounts[y] || '0', 10), 0);
    const numClasses = selectedRoomIds.length;

    // Auto-calculate time slot duration based on exam type
    const calculateTimeSlot = () => {
        if (isInternals) {
            return 'ALL_SESSIONS_3_DAYS';
        }
        if (!timeSlotStart) return '';
        const [hh, mm] = timeSlotStart.split(':').map(Number);
        const durationHours = isInternals ? 1 : 3;

        const start = new Date(2000, 0, 1, hh, mm);
        const end = new Date(2000, 0, 1, hh + durationHours, mm);

        const formatTime = (d) => {
            let h = d.getHours();
            const m = d.getMinutes().toString().padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
        };
        return `${formatTime(start)} to ${formatTime(end)}`;
    };

    const formattedTimeSlot = calculateTimeSlot();

    function setYearCount(year, value) {
        setYearCounts(prev => ({ ...prev, [year]: value }));
    }

    // Term end: assign rooms so each room has only one year (SE or TE or BE). One student per bench.
    function computeTermEnd(SE, TE, BE, selectedRoomsList) {
        const total = SE + TE + BE;
        let availableSeats = 0;
        selectedRoomsList.forEach(r => availableSeats += r.bench_capacity);

        if (availableSeats < total) {
            return {
                ok: false,
                extraRoomsNeeded: 1, // rough estimate flag
                totalRoomsNeeded: 1,
                roomsNeededSE: SE,
                roomsNeededTE: TE,
                roomsNeededBE: BE
            };
        }

        const rooms = [];
        let roomIndex = 0;
        const yearRollTracker = { SE: 0, TE: 0, BE: 0 };
        const fill = (year, count) => {
            let left = count;
            while (left > 0 && roomIndex < selectedRoomsList.length) {
                const physicalRoom = selectedRoomsList[roomIndex];
                const cap = physicalRoom.bench_capacity;
                const assign = Math.min(left, cap);
                const rollStart = yearRollTracker[year] + 1;
                const rollEnd = yearRollTracker[year] + assign;

                rooms.push({
                    index: roomIndex + 1,
                    physicalRoom: physicalRoom.room_number,
                    year,
                    rollStart,
                    rollEnd,
                    students: assign,
                    emptySeats: cap - assign
                });

                yearRollTracker[year] += assign;
                left -= assign;
                roomIndex += 1;
            }
        };

        fill('SE', SE);
        fill('TE', TE);
        fill('BE', BE);

        const usedRooms = rooms.length;
        const unusedSeats = rooms.reduce((s, r) => s + r.emptySeats, 0);

        // If we ran out of rooms before assigning everyone
        if (roomIndex >= selectedRoomsList.length && (SE + TE + BE > rooms.reduce((s, r) => s + r.students, 0))) {
            return { ok: false, extraRoomsNeeded: 1 };
        }

        return {
            ok: true,
            total,
            classes: selectedRoomsList.length,
            rooms,
            unusedSeats,
            usedRooms
        };
    }

    // Internals: max two distinct years per room, max 2 students per bench.
    function computeInternals(SE, TE, BE, selectedRoomsList) {
        const total = SE + TE + BE;
        const totalBenchesNeeded = Math.ceil(total / 2);

        let totalBenchCapacity = 0;
        selectedRoomsList.forEach(r => totalBenchCapacity += r.bench_capacity);

        if (totalBenchCapacity < totalBenchesNeeded) {
            return { ok: false, extraBenchesNeeded: totalBenchesNeeded - totalBenchCapacity };
        }

        // We will fill benches room by room.
        // To prevent a student sitting alone (if total is even), we don't distribute extra.
        // If odd, one room will naturally have a bench with 1 student.
        const rooms = [];
        const rem = { SE, TE, BE };
        const keys = ['SE', 'TE', 'BE'];

        // We will distribute the required benches using a fair-share round-robin limit allocation.
        // This ensures halls are equally populated but cleanly caps and redistributes excess benches 
        // to larger rooms if smaller ones hit their individual physical capacities.
        const numRooms = selectedRoomsList.length;
        const roomAllocations = new Array(numRooms).fill(0);
        let benchesToAllocate = totalBenchesNeeded;

        // Loop round-robin until all needed benches are allocated
        let changed = true;
        while (benchesToAllocate > 0 && changed) {
            changed = false;
            for (let i = 0; i < numRooms; i++) {
                if (benchesToAllocate > 0 && roomAllocations[i] < selectedRoomsList[i].bench_capacity) {
                    roomAllocations[i]++;
                    benchesToAllocate--;
                    changed = true;
                }
            }
        }

        for (let r = 0; r < numRooms; r++) {
            const physicalRoom = selectedRoomsList[r];
            let roomBenches = roomAllocations[r];

            if (roomBenches === 0) continue;

            const roomCounts = { SE: 0, TE: 0, BE: 0 };
            let benchesToFill = roomBenches;
            const allowedYears = new Set();

            while (benchesToFill > 0) {
                const availableYears = keys.filter((k) => rem[k] > 0);
                if (availableYears.length === 0) break;

                if (allowedYears.size < 2) {
                    const nextYear = availableYears
                        .filter((k) => !allowedYears.has(k))
                        .sort((a, b) => rem[b] - rem[a])[0];
                    if (nextYear) {
                        allowedYears.add(nextYear);
                    }
                }

                const candidates = [...allowedYears]
                    .filter((k) => rem[k] > 0)
                    .sort((a, b) => rem[b] - rem[a]);

                if (candidates.length === 0) break;

                const y1 = candidates[0];
                const y2 = candidates[1];

                if (rem[y1] <= 0) break; // No students left at all

                if (!y2 || rem[y2] <= 0) {
                    // Only one allowed year has students left, so fill one seat on this bench.
                    roomCounts[y1] += 1;
                    rem[y1] -= 1;
                    benchesToFill -= 1;
                    continue;
                }

                // Fill one bench with two students from the two selected years.
                const pairs = 1;

                roomCounts[y1] += pairs;
                roomCounts[y2] += pairs;
                rem[y1] -= pairs;
                rem[y2] -= pairs;
                benchesToFill -= pairs;
            }

            const studentsInRoom = roomCounts.SE + roomCounts.TE + roomCounts.BE;
            if (studentsInRoom > 0) {
                rooms.push({
                    index: r + 1,
                    physicalRoom: physicalRoom.room_number,
                    benches: roomBenches,
                    physicalCapacity: physicalRoom.bench_capacity,
                    SE: roomCounts.SE,
                    TE: roomCounts.TE,
                    BE: roomCounts.BE,
                    students: studentsInRoom,
                    emptySeats: (physicalRoom.bench_capacity * 2) - studentsInRoom
                });
            }
        }

        // Did we seat everyone?
        const seated = rooms.reduce((sum, r) => sum + r.students, 0);
        if (seated < total) {
            return { ok: false, extraBenchesNeeded: Math.ceil((total - seated) / 2) };
        }

        const unusedSeats = (totalBenchCapacity * 2) - total;
        return {
            ok: true,
            total,
            classes: numRooms,
            totalCapacity: totalBenchCapacity * 2,
            rooms,
            unusedSeats,
            usedBenches: totalBenchesNeeded
        };
    }

    function handleCalculate(e) {
        e.preventDefault();
        setError('');

        if (!selectedTimetableId) {
            setResult(null);
            setError('Select a timetable first. Branch and timing will be fetched from it.');
            return;
        }

        if (isInternals && !internalsTimetableReady) {
            setResult(null);
            setError('Generate internal timetable first (3 days x 2 sessions) before creating seating allocation.');
            return;
        }

        const SE = Math.max(0, parseInt(yearCounts.SE || '0', 10));
        const TE = Math.max(0, parseInt(yearCounts.TE || '0', 10));
        const BE = Math.max(0, parseInt(yearCounts.BE || '0', 10));
        const total = SE + TE + BE;

        if (selectedRoomIds.length <= 0) {
            setResult(null);
            setError('Please select at least one room from the visual planner.');
            return;
        }
        if (total <= 0) {
            setResult(null);
            setError('Enter at least one student count for SE, TE or BE.');
            return;
        }

        // Prepare the actual room objects mapped from selected IDs
        const selectedRoomsList = selectedRoomIds.map(id => roomsConfig.find(r => r.room_id === id)).filter(Boolean);

        if (examType === 'term_ends') {
            const out = computeTermEnd(SE, TE, BE, selectedRoomsList);
            if (!out.ok) {
                setResult(null);
                setError(`Not enough capacity. Need more rooms added to the plan.`);
                return;
            }
            setResult({
                examType: 'term_ends',
                total: out.total,
                yearCounts: { SE, TE, BE },
                classes: out.classes,
                rooms: out.rooms,
                unusedSeats: out.unusedSeats,
                usedRooms: out.usedRooms,
                extraStudents: 0
            });
            return;
        }

        // Internals
        const out = computeInternals(SE, TE, BE, selectedRoomsList);
        if (!out.ok) {
            if (out.extraBenchesNeeded != null) {
                setResult(null);
                setError(`Need ${out.extraBenchesNeeded} more bench capacity (each bench seats 2). Add more rooms from the planner.`);
            }
            return;
        }
        setResult({
            examType: 'internals',
            total: out.total,
            yearCounts: { SE, TE, BE },
            classes: out.classes,
            effectiveCapacityPerClass: out.effectiveCapacityPerClass,
            totalCapacity: out.totalCapacity,
            rooms: out.rooms,
            unusedSeats: out.unusedSeats,
            usedBenches: out.usedBenches,
            extraStudents: 0
        });
    }

    // Auto-allocation for multiple branches using allocator service
    async function handleAutoAllocate() {
        setError('');
        setResult(null); // Clear result instead of autoAllocResult

        if (!selectedTimetableId) {
            setError('Select a timetable first. Branch and timing will be fetched from it.');
            return;
        }

        if (isInternals && !internalsTimetableReady) {
            setError('Generate internal timetable first (3 days x 2 sessions) before auto-allocating seating.');
            return;
        }

        if (selectedBranches.length === 0) {
            setError('Please select at least one branch for auto-allocation.');
            return;
        }

        setAutoAllocLoading(true);
        try {
            // Prepare branches payload with student counts from config
            const branchesPayload = selectedBranches.map(branchIdStr => {
                const branchId = parseInt(branchIdStr, 10);
                const branchObj = branches.find(b => b.branch_id === branchId);
                if (!branchObj) {
                    console.warn(`Branch not found for ID: ${branchId}`);
                    return null;
                }

                const config = branchConfigs[branchId];
                return {
                    branchId: branchId,
                    branchCode: branchObj.branch_code,
                    SE: config?.se_students || 0,
                    TE: config?.te_students || 0,
                    BE: config?.be_students || 0
                };
            }).filter(Boolean);

            if (branchesPayload.length === 0) {
                setError('Unable to find selected branches. Please try again.');
                setAutoAllocLoading(false);
                return;
            }

            const divisionRangesByBranchCode = {};
            branchesPayload.forEach((branch) => {
                const cfg = branchConfigs[branch.branchId];
                const divisionsCfg = cfg?.divisions;
                if (!divisionsCfg) return;

                const yearMap = {};
                ['SE', 'TE', 'BE'].forEach((year) => {
                    const items = Array.isArray(divisionsCfg[year]) ? divisionsCfg[year] : [];
                    let cursor = 1;
                    yearMap[year] = items
                        .map((item) => {
                            const count = Number(item?.count || 0);
                            if (!count) return null;
                            const start = cursor;
                            const end = cursor + count - 1;
                            cursor = end + 1;
                            return {
                                division: item?.division ? String(item.division).trim() : null,
                                start,
                                end
                            };
                        })
                        .filter(Boolean);
                });

                divisionRangesByBranchCode[branch.branchCode] = yearMap;
            });

            function inferDivisionLabel(student) {
                if (student?.division) return student.division;
                const branchCode = String(student?.branchCode || '').toUpperCase();
                let year = String(student?.year || '').toUpperCase();
                if (year === 'FE') year = 'SE';

                const ranges = divisionRangesByBranchCode[branchCode]?.[year] || [];
                if (!ranges.length) return null;

                const rollStart = Number(student?.rollStart || 0);
                const rollEnd = Number(student?.rollEnd || 0);
                const exact = ranges.find((r) => rollStart >= r.start && rollEnd <= r.end);
                if (exact) return exact.division;

                const overlap = ranges.find((r) => rollStart <= r.end && rollEnd >= r.start);
                return overlap ? overlap.division : null;
            }

            const response = await api.post('/seating/auto-allot', {
                examType,
                branches: branchesPayload,
                planDate: selectedTimetable?.start_date || planDate || null,
                timeSlot: isInternals ? 'ALL_SESSIONS_3_DAYS' : (selectedTimetable?.time_slot || timeSlotStart)
            });

            // Transform allocator response to match manual mode format
            const allocData = response.data;
            if (!allocData.success) {
                setError(allocData.errors?.[0]?.message || 'Allocation failed.');
                return;
            }

            // Calculate year totals
            const yearCounts = { SE: 0, TE: 0, BE: 0 };
            branchesPayload.forEach(branch => {
                yearCounts.SE += branch.SE;
                yearCounts.TE += branch.TE;
                yearCounts.BE += branch.BE;
            });

            // Transform allocation rooms to match manual result format
            const rooms = allocData.allocation.map(room => {
                if (examType === 'term_ends') {
                    // For term ends: simple format with year
                    const yearData = room.students[0]; // Should have one year per room
                    const divisionLabel = inferDivisionLabel(yearData);
                    return {
                        physicalRoom: room.roomNumber,
                        year: yearData.year,
                        rollStart: yearData.rollStart,
                        rollEnd: yearData.rollEnd,
                        students: room.totalAllocated,
                        emptySeats: room.remainingCapacity,
                        division: divisionLabel // Include inferred division info
                    };
                } else {
                    // For internals: breakdown by year
                    const yearBreakdown = { SE: 0, TE: 0, BE: 0 };
                    const divisions = {}; // Track divisions per year
                    room.students.forEach(s => {
                        yearBreakdown[s.year] = (yearBreakdown[s.year] || 0) + s.count;
                        const divisionLabel = inferDivisionLabel(s);
                        if (!divisions[s.year]) divisions[s.year] = [];
                        divisions[s.year].push({
                            division: divisionLabel,
                            count: s.count,
                            rollStart: s.rollStart,
                            rollEnd: s.rollEnd
                        });
                    });
                    return {
                        physicalRoom: room.roomNumber,
                        floorName: room.floorName,
                        benches: Math.floor(room.capacity / 2),
                        SE: yearBreakdown.SE || 0,
                        TE: yearBreakdown.TE || 0,
                        BE: yearBreakdown.BE || 0,
                        students: room.totalAllocated,
                        emptySeats: room.remainingCapacity,
                        divisions: divisions // Include division details
                    };
                }
            });

            // Set result in the same format as manual mode
            setResult({
                examType,
                total: allocData.summary.totalStudents,
                yearCounts,
                classes: allocData.summary.totalRooms,
                usedRooms: allocData.summary.totalRooms,
                rooms,
                unusedSeats: allocData.allocation.reduce((sum, r) => sum + r.remainingCapacity, 0)
            });

        } catch (err) {
            setError(err.response?.data?.error || 'Auto-allocation failed. Ensure rooms are configured with sufficient capacity.');
        } finally {
            setAutoAllocLoading(false);
        }
    }

    function handleReset() {
        setExamType('internals');
        setAllocationMode('auto');
        setSelectedTimetableId('');
        setYearCounts({ SE: '', TE: '', BE: '' });
        setResult(null);
        setError('');
        setSavedPlanId(null);
        setSaveError('');
        setSaveSuccess('');
    }

    function buildPlanConfig() {
        const normalizedSelectedBranches = (selectedBranches || [])
            .map((x) => Number(x))
            .filter((x) => Number.isInteger(x) && x > 0);
        const selectedBranchIdNum = Number(selectedBranch);

        return {
            examType: result?.examType,
            yearCounts: result?.yearCounts,
            capacity: result?.capacity,
            numClasses: result?.classes,
            allocationMode,
            internals_timetable_ready: isInternals ? internalsTimetableReady : null,
            selected_timetable_group_key: selectedTimetable?.group_key || null,
            selected_timetable_session_ids: selectedTimetable?.session_ids || [],
            selected_timetable_slot: selectedTimetable?.time_slot || null,
            selected_branch_id: Number.isInteger(selectedBranchIdNum) && selectedBranchIdNum > 0 ? selectedBranchIdNum : null,
            selected_branch_ids: normalizedSelectedBranches
        };
    }

    async function handleSaveDraft() {
        const effectivePlanDate = selectedTimetable?.start_date || planDate;
        if (!result?.rooms?.length || !effectivePlanDate) {
            setSaveError('Select a timetable and generate a plan with at least one room before saving.');
            return;
        }
        setSaveError('');
        setSaveSuccess('');
        setLoadingSave(true);
        try {
            const roomNumbers = result.rooms.map(r => r.physicalRoom.toString());
            const config = buildPlanConfig();
            const roomsPayload = result.rooms.map((room, i) => ({
                roomNumber: roomNumbers[i],
                distribution: result.examType === 'term_ends'
                    ? {
                        year: room.year,
                        division: room.division,
                        rollStart: room.rollStart,
                        rollEnd: room.rollEnd,
                        students: room.students,
                        emptySeats: room.emptySeats
                    }
                    : { benches: room.benches, FE: room.FE, SE: room.SE, TE: room.TE, BE: room.BE, students: room.students, emptySeats: room.emptySeats }
            }));
            const res = await api.post('/seating/plans', {
                examType: result.examType,
                planDate: effectivePlanDate,
                timeSlot: isInternals ? 'ALL_SESSIONS_3_DAYS' : (selectedTimetable?.time_slot || formattedTimeSlot),
                config,
                rooms: roomsPayload
            });
            setSavedPlanId(res.data.plan_id);
            setSaveSuccess('Plan saved as draft.');
            loadPlans();
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to save plan.');
        } finally {
            setLoadingSave(false);
        }
    }

    async function handleApprove() {
        const effectivePlanDate = selectedTimetable?.start_date || planDate;
        if (!result?.rooms?.length || !effectivePlanDate) {
            setSaveError('Select a timetable and generate a plan before approving.');
            return;
        }
        setSaveError('');
        setSaveSuccess('');
        setLoadingSave(true);
        try {
            let planId = savedPlanId;
            if (planId == null) {
                const roomNumbers = result.rooms.map(r => r.physicalRoom.toString());
                const config = buildPlanConfig();
                const roomsPayload = result.rooms.map((room, i) => ({
                    roomNumber: roomNumbers[i],
                    distribution: result.examType === 'term_ends'
                        ? {
                            year: room.year,
                            division: room.division,
                            rollStart: room.rollStart,
                            rollEnd: room.rollEnd,
                            students: room.students,
                            emptySeats: room.emptySeats
                        }
                        : { benches: room.benches, FE: room.FE, SE: room.SE, TE: room.TE, BE: room.BE, students: room.students, emptySeats: room.emptySeats }
                }));
                const createRes = await api.post('/seating/plans', {
                    examType: result.examType,
                    planDate: effectivePlanDate,
                    timeSlot: isInternals ? 'ALL_SESSIONS_3_DAYS' : (selectedTimetable?.time_slot || formattedTimeSlot),
                    config,
                    rooms: roomsPayload
                });
                planId = createRes.data.plan_id;
                setSavedPlanId(planId);
            }
            await api.put(`/seating/plans/${planId}/approve`);
            setSaveSuccess('Plan approved. Rooms are now marked used for this date.');
            loadPlans();
            if (canEditSupervision) {
                setGeneratePromptPlanId(planId);
            }
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to save or approve plan.');
        } finally {
            setLoadingSave(false);
        }
    }

    async function loadPlans({ showLoader = true } = {}) {
        if (showLoader) setLoadingPlans(true);
        try {
            const res = await api.get('/seating/plans');
            setPlans(res.data || []);
        } catch {
            setPlans([]);
        } finally {
            if (showLoader) setLoadingPlans(false);
        }
    }

    async function checkAvailability() {
        if (!availabilityDate) return;
        setLoadingAvailability(true);
        setAvailability(null);
        try {
            const res = await api.get('/seating/availability', { params: { date: availabilityDate } });
            setAvailability(res.data);
        } catch {
            setAvailability({ date: availabilityDate, usedRoomNumbers: [] });
        } finally {
            setLoadingAvailability(false);
        }
    }

    async function approvePlanById(planId) {
        try {
            await api.put(`/seating/plans/${planId}/approve`);
            setSaveSuccess('Plan approved.');
            loadPlans();
            if (canEditSupervision) {
                setGeneratePromptPlanId(planId);
            }
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to approve.');
            setTimeout(() => setSaveError(''), 5000);
        }
    }

    async function handleGenerateSupervision(planId) {
        if (!planId) return;
        setGeneratePromptBusy(true);
        setSaveError('');
        try {
            await api.post('/supervision/generate', {
                plan_id: Number(planId),
                min_duties: 10
            });
            setSaveSuccess('Supervision draft allotment generated for all sessions in this approved seating plan.');
            setGeneratePromptPlanId(null);
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to generate supervision allotment.');
        } finally {
            setGeneratePromptBusy(false);
        }
    }

    function requestDeletePlan(plan) {
        setDeleteTarget(plan);
    }

    async function handleDeletePlan() {
        if (!deleteTarget) return;

        const planId = deleteTarget.plan_id;
        setDeletingPlan(true);
        try {
            await api.delete(`/seating/plans/${planId}`);
            setSaveSuccess('Plan deleted successfully.');
            // Clear current view if it's the one we just deleted
            if (savedPlanId === planId) {
                handleReset();
            }
            await loadPlans({ showLoader: false });
            setDeleteTarget(null);
            setTimeout(() => setSaveSuccess(''), 5000);
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to delete plan.');
            setTimeout(() => setSaveError(''), 5000);
        } finally {
            setDeletingPlan(false);
        }
    }

    function handleViewPlan(plan) {
        // Reconstruct form state
        setExamType(plan.exam_type);
        setPlanDate(formatDate(plan.plan_date || plan.date_from));
        // Simple heuristic to extract HH:MM start time from string like "11:00 AM to 02:00 PM"
        if (plan.time_slot) {
            const timeMatch = plan.time_slot.match(/(\d{1,2}:\d{2})\s*(AM|PM)/i);
            if (timeMatch) {
                let [_, time, period] = timeMatch;
                let [hours, minutes] = time.split(':');
                hours = parseInt(hours, 10);
                if (period.toUpperCase() === 'PM' && hours < 12) hours += 12;
                if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
                setTimeSlotStart(`${hours.toString().padStart(2, '0')}:${minutes}`);
            }
        }

        // Restore counts
        const config = plan.config || {};
        if (config.yearCounts) {
            setYearCounts(config.yearCounts);
        }

        // Reconstruct result state
        setSavedPlanId(plan.plan_id);

        const reconstructedRooms = (plan.rooms || []).map(r => {
            const dist = r.distribution || {};
            if (plan.exam_type === 'term_ends') {
                return {
                    physicalRoom: r.room_number,
                    year: dist.year,
                    students: dist.students,
                    emptySeats: dist.emptySeats,
                    rollStart: dist.rollStart,
                    rollEnd: dist.rollEnd,
                    division: dist.division
                };
            } else {
                return {
                    physicalRoom: r.room_number,
                    benches: dist.benches,
                    SE: dist.SE,
                    TE: dist.TE,
                    BE: dist.BE,
                    students: dist.students,
                    emptySeats: dist.emptySeats,
                    divisions: dist.divisions
                };
            }
        });

        // Compute total students across rooms to ensure match
        let totalSt = 0;
        reconstructedRooms.forEach(r => totalSt += (r.students || 0));

        setResult({
            examType: plan.exam_type,
            yearCounts: config.yearCounts || { SE: 0, TE: 0, BE: 0 },
            total: totalSt,
            classes: reconstructedRooms.length,
            usedRooms: reconstructedRooms.length,
            rooms: reconstructedRooms,
            unusedSeats: reconstructedRooms.reduce((sum, r) => sum + (r.emptySeats || 0), 0)
        });

        setAllocationMode('manual'); // Default to manual when viewing a plan

        // Trigger the print preview directly instead of scrolling to the forms
        setPendingPrint(true);
    }


    useEffect(() => { loadPlans(); }, []);

    return (
        <div className="voucher-container seating-arrangement-page">
            <div className="page-header">
                <div>
                    <div className="page-title">Seating Arrangement Planner</div>
                    <div className="page-subtitle">
                        Enter number of students, classes and fixed capacity per classroom to auto-distribute students.
                    </div>
                </div>
            </div>

            <div className="grid-2 seating-main-grid">
                <form className="card" onSubmit={handleCalculate}>
                    <div
                        className="voucher-header-bar"
                        style={{ padding: '16px 20px', margin: '-20px -20px 20px -20px' }}
                    >
                        <h2 style={{ fontSize: '1rem' }}>1. Input Details</h2>
                    </div>

                    <div className="form-group mb-4">
                        <label className="form-label">Type of Exam</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className={`btn ${examType === 'internals' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => { setExamType('internals'); setResult(null); }}
                            >
                                <Users size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> Internal
                            </button>
                            <button
                                type="button"
                                className={`btn ${examType === 'term_ends' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => { setExamType('term_ends'); setResult(null); }}
                            >
                                <ClipboardList size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> Term
                            </button>
                        </div>
                        <small className="form-group small" style={{ display: 'block', marginTop: 6 }}>
                            {examType === 'term_ends'
                                ? 'One student per bench. One year per room only (SE or TE or BE).'
                                : 'Two students per bench. A room can include at most two distinct years, and same-year divisions are allowed.'}
                        </small>
                    </div>

                    <div className="form-group mb-4">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <label className="form-label" style={{ marginBottom: 0 }}>Timetable Selection</label>
                        </div>

                        <small className="text-muted" style={{ display: 'block', marginBottom: '12px' }}>
                            Select a timetable set by date and department. Seating will be reused for all 6 sessions.
                        </small>

                        <select
                            className="form-control"
                            value={selectedTimetableId}
                            onChange={(e) => setSelectedTimetableId(e.target.value)}
                        >
                            <option value="">Select timetable</option>
                            {groupedTimetableOptions.map((s) => (
                                <option key={s.group_key} value={s.group_key}>
                                    {s.start_date}{s.end_date && s.end_date !== s.start_date ? ` to ${s.end_date}` : ''} | {s.branch_code || 'N/A'} | {s.session_count} sessions
                                </option>
                            ))}
                        </select>

                        {selectedTimetable && (
                            <small className="text-muted" style={{ display: 'block', marginTop: 8 }}>
                                Using department: <strong>{selectedTimetable.branch_name || selectedTimetable.branch_code || '-'}</strong> | Date: <strong>{selectedTimetable.start_date || '-'}</strong> | Sessions: <strong>{selectedTimetable.session_count || 0}</strong>
                            </small>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                            <label className="form-label" style={{ marginBottom: 0 }}>Allocation Mode</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    className={`btn btn-sm ${allocationMode === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => { setAllocationMode('auto'); setResult(null); }}
                                    style={{ padding: '4px 12px', fontSize: '12px', fontWeight: '600' }}
                                >
                                    <Bot size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> Auto-Allocate
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm ${allocationMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => { setAllocationMode('manual'); setResult(null); }}
                                    style={{ padding: '4px 12px', fontSize: '12px', fontWeight: '600' }}
                                >
                                    <PencilLine size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> Manual
                                </button>
                            </div>
                        </div>

                        {allocationMode === 'auto' && selectedBranches.length > 0 && (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleAutoAllocate}
                                    disabled={!canEditSeating || autoAllocLoading}
                                    style={{ width: '100%', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    {autoAllocLoading
                                        ? 'Allocating...'
                                        : <><Bot size={16} /> Auto-Allocate {selectedBranches.length} Branch{selectedBranches.length !== 1 ? 'es' : ''}</>}
                                </button>
                            </>
                        )}
                    </div>

                    {/* --- MANUAL MODE: VISUAL ROOM SELECTOR --- */}
                    {allocationMode === 'manual' && (
                        <>
                            <div className="form-group mb-4">
                                <label className="form-label" style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                                    1. Select Rooms
                                </label>
                                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
                                    {['Ground', '1st', '2nd', '3rd', '4th', '5th', '6th'].map(floor => (
                                        <button
                                            key={floor}
                                            type="button"
                                            className={`btn ${activeFloor === floor ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setActiveFloor(floor)}
                                            style={{ padding: '6px 16px', borderRadius: '20px', whiteSpace: 'nowrap' }}
                                        >
                                            {floor} Floor
                                        </button>
                                    ))}
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                                    gap: '12px',
                                    background: 'var(--bg-2)',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)'
                                }}>
                                    {roomsConfig.filter(r => r.floor_name === activeFloor).map(room => {
                                        const isSelected = selectedRoomIds.includes(room.room_id);
                                        return (
                                            <button
                                                key={room.room_id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedRoomIds(prev =>
                                                        prev.includes(room.room_id)
                                                            ? prev.filter(id => id !== room.room_id)
                                                            : [...prev, room.room_id]
                                                    );
                                                }}
                                                style={{
                                                    aspectRatio: '1',
                                                    borderRadius: '8px',
                                                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                    background: isSelected ? 'var(--primary)' : 'var(--surface)',
                                                    color: isSelected ? 'var(--surface)' : 'var(--text)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    boxShadow: isSelected ? 'var(--shadow)' : 'var(--shadow-sm)',
                                                    transition: 'all 0.2s',
                                                    padding: '4px'
                                                }}
                                            >
                                                <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{room.room_number}</span>
                                                <span style={{ fontSize: '0.7rem', opacity: isSelected ? 0.9 : 0.6 }}>
                                                    {room.bench_capacity} {examType === 'term_ends' ? 'stu' : 'bench'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <small className="text-muted" style={{ display: 'block', marginTop: 8 }}>
                                    Selected: <strong>{selectedRoomIds.length}</strong> room{selectedRoomIds.length !== 1 ? 's' : ''}.
                                </small>
                            </div>

                            <div className="form-group mb-4">
                                <label className="form-label" style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                                    2. Students by Year
                                </label>
                                <div className="grid-3">
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: 11 }}>SE (Second Year)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="form-control"
                                            value={yearCounts.SE}
                                            onChange={e => setYearCount('SE', e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: 11 }}>TE (Third Year)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="form-control"
                                            value={yearCounts.TE}
                                            onChange={e => setYearCount('TE', e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: 11 }}>BE (Final Year)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="form-control"
                                            value={yearCounts.BE}
                                            onChange={e => setYearCount('BE', e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>
                                    Total: {totalFromYears || 0} students
                                    {isInternals && totalFromYears > 0 && totalFromYears % 2 !== 0 && (
                                        <span> — odd total: students will be distributed unevenly across classrooms (max 2 per bench)</span>
                                    )}
                                </small>
                            </div>

                            {error && allocationMode === 'manual' && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}

                            <div className="flex gap-2">
                                <button type="submit" className="btn btn-primary" disabled={!canEditSeating} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Ruler size={18} /> Generate Seating Plan
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={handleReset}>
                                    Reset
                                </button>
                            </div>
                        </>
                    )}

                    {/* Auto-Allocation Error Display */}
                    {error && allocationMode === 'auto' && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}

                </form>

                <div className="card">
                    <div
                        className="voucher-header-bar"
                        style={{ padding: '16px 20px', margin: '-20px -20px 20px -20px', background: 'var(--surface)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
                    >
                        <h2 style={{ fontSize: '1rem' }}>2. Seating Summary</h2>
                    </div>

                    {!result ? (
                        <div className="text-center text-muted" style={{ padding: '32px 0' }}>
                            Enter students by year (SE, TE, BE), no. of classes and capacity, then click &quot;Generate Seating Plan&quot;.
                        </div>
                    ) : (
                        <div className="flex-col gap-3">
                            <div className="stat-grid" style={{ marginBottom: 0 }}>
                                <div className="stat-card">
                                    <div className="stat-label">Total Students</div>
                                    <div className="stat-value">{result.total}</div>
                                </div>
                                {result.yearCounts && (
                                    <div className="stat-card">
                                        <div className="stat-label">SE / TE / BE</div>
                                        <div className="stat-value" style={{ fontSize: '0.9rem' }}>
                                            {result.yearCounts.SE} / {result.yearCounts.TE} / {result.yearCounts.BE}
                                        </div>
                                    </div>
                                )}
                                <div className="stat-card">
                                    <div className="stat-label">Rooms</div>
                                    <div className="stat-value">{result.usedRooms ?? result.classes}</div>
                                </div>
                            </div>

                            {/* Term end: not enough rooms */}
                            {result.examType === 'term_ends' && result.extraRoomsNeeded > 0 && (
                                <Alert type="error">
                                    One year per room only. Need <strong>{result.totalRoomsNeeded}</strong> rooms
                                    (SE: {result.roomsNeededSE}, TE: {result.roomsNeededTE}, BE: {result.roomsNeededBE}).
                                    <br />
                                    Add <strong>{result.extraRoomsNeeded}</strong> more room{result.extraRoomsNeeded > 1 ? 's' : ''}.
                                </Alert>
                            )}

                            {/* Internals: not enough bench capacity */}
                            {result.examType === 'internals' && result.extraBenchesNeeded > 0 && (
                                <Alert type="error">
                                    Need <strong>{result.extraBenchesNeeded}</strong> more bench capacity (each bench seats 2). Add more rooms or benches per class.
                                </Alert>
                            )}

                            {result.rooms && result.rooms.length > 0 && (
                                <>
                                    <Alert type="success">
                                        {result.examType === 'term_ends'
                                            ? <>One class per room. Unused seats: <strong>{result.unusedSeats}</strong>.</>
                                            : <>
                                                Internals use max 2 students per bench and at most 2 distinct years per room. Unused seats: <strong>{result.unusedSeats}</strong>.
                                                {result.total % 2 !== 0 && (
                                                    <span style={{ display: 'block', marginTop: 6 }}>
                                                        Odd total: students distributed unevenly across classrooms — no bench has more than 2 students.
                                                    </span>
                                                )}
                                            </>
                                        }
                                    </Alert>

                                    {result.examType === 'term_ends' ? (
                                        <div className="table-wrap">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Room no.</th>
                                                        <th>Year</th>
                                                        <th>Division</th>
                                                        <th>Roll Numbers</th>
                                                        <th>Students</th>
                                                        <th>Empty Seats</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.rooms.map((room, idx) => (
                                                        <tr key={idx}>
                                                            <td><strong>Room {room.physicalRoom}</strong></td>
                                                            <td><strong>{room.year}</strong></td>
                                                            <td>{room.division && room.division !== 'Default' ? room.division : '-'}</td>
                                                            <td>
                                                                {room.rollStart && room.rollEnd
                                                                    ? `${room.rollStart} - ${room.rollEnd}`
                                                                    : '1 - ' + room.students}
                                                            </td>
                                                            <td>{room.students}</td>
                                                            <td>{room.emptySeats}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="table-wrap">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Room no.</th>
                                                        <th>Benches</th>
                                                        <th>FE</th>
                                                        <th>SE</th>
                                                        <th>TE</th>
                                                        <th>BE</th>
                                                        <th>Division Details</th>
                                                        <th>Empty Seats</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.rooms.map((room, idx) => {
                                                        // Format division details with line breaks and bold years
                                                        let divDetailsJSX = <span>-</span>;
                                                        if (room.divisions) {
                                                            const divElements = [];
                                                            ['FE', 'SE', 'TE', 'BE'].forEach(year => {
                                                                if (room.divisions[year] && room.divisions[year].length > 0) {
                                                                    room.divisions[year].forEach((d, dIdx) => {
                                                                        const divLabel = d.division && d.division !== 'Default' ? `-${d.division}` : '';
                                                                        divElements.push(
                                                                            <div key={`${year}-${dIdx}`}>
                                                                                <strong>{year}</strong>{divLabel}({d.rollStart}-{d.rollEnd})
                                                                            </div>
                                                                        );
                                                                    });
                                                                }
                                                            });
                                                            if (divElements.length > 0) {
                                                                divDetailsJSX = <>{divElements}</>;
                                                            }
                                                        }

                                                        // Fallback: derive year-wise ranges when explicit division map is unavailable.
                                                        if (
                                                            divDetailsJSX.props?.children === '-'
                                                            || (room.divisions && Object.keys(room.divisions).length === 0)
                                                        ) {
                                                            const fallback = [];
                                                            ['FE', 'SE', 'TE', 'BE'].forEach((year) => {
                                                                const count = Number(room[year] || 0);
                                                                if (count > 0) {
                                                                    fallback.push(
                                                                        <div key={`fallback-${year}`}>
                                                                            <strong>{year}</strong>(1-{count})
                                                                        </div>
                                                                    );
                                                                }
                                                            });
                                                            if (fallback.length > 0) divDetailsJSX = <>{fallback}</>;
                                                        }

                                                        return (
                                                            <tr key={idx}>
                                                                <td><strong>Room {room.physicalRoom}</strong></td>
                                                                <td>{room.benches}</td>
                                                                <td>{room.FE || '-'}</td>
                                                                <td>{room.SE || '-'}</td>
                                                                <td>{room.TE || '-'}</td>
                                                                <td>{room.BE || '-'}</td>
                                                                <td style={{ textAlign: 'left', lineHeight: '1.6', paddingLeft: '16px' }}>{divDetailsJSX}</td>
                                                                <td>{room.emptySeats}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <div className="mt-4">
                                        {saveError && <Alert type="error" dismissible onDismiss={() => setSaveError('')}>{saveError}</Alert>}
                                        {saveSuccess && <Alert type="success" dismissible onDismiss={() => setSaveSuccess('')}>{saveSuccess}</Alert>}
                                        <div className="flex gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={handleSaveDraft}
                                                disabled={!canEditSeating || loadingSave || !planDate}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                {loadingSave ? 'Saving…' : <><Save size={16} /> Save as draft</>}
                                            </button>
                                            {canEditSeating && (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={handleApprove}
                                                    disabled={loadingSave || !planDate}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    {loadingSave ? 'Saving…' : <><CheckCircle size={16} /> Approve & save</>}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={handlePrint}
                                                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                disabled={!savedPlanId && !saveSuccess}
                                            >
                                                <Printer size={16} /> Print / PDF
                                            </button>
                                        </div>
                                        <small className="text-muted" style={{ display: 'block', marginTop: 6 }}>
                                            Approved plans mark these rooms as used for this date. Check &quot;Room availability&quot; below. Wait to save before printing.
                                        </small>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid-2 mt-6 seating-secondary-grid" style={{ gap: 20 }}>
                <div className="card">
                    <div className="voucher-header-bar" style={{ padding: '12px 16px', margin: '-20px -20px 16px -20px' }}>
                        <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Room availability</h3>
                    </div>
                    <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>See which rooms are in use on a given date (from approved plans).</p>
                    <div className="flex gap-2 flex-wrap">
                        <input
                            type="date"
                            className="form-control"
                            value={availabilityDate}
                            onChange={e => setAvailabilityDate(e.target.value)}
                            style={{ maxWidth: 160 }}
                        />
                        <button type="button" className="btn btn-secondary btn-sm" onClick={checkAvailability} disabled={loadingAvailability}>
                            {loadingAvailability ? 'Checking…' : 'Check'}
                        </button>
                    </div>
                    {availability && (
                        <div className="mt-4">
                            <div className="stat-label">Rooms in use on {availability.date}</div>
                            {availability.usedRoomNumbers?.length > 0 ? (
                                <div style={{ marginTop: 12 }}>
                                    {Object.entries(availability.slots || {}).map(([slot, rooms]) => (
                                        <div key={slot} style={{ marginBottom: 8 }}>
                                            <strong style={{ fontSize: 13 }}>{slot}:</strong>
                                            <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: 13 }}>{rooms.join(', ')}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted" style={{ marginTop: 6, fontSize: 13 }}>No rooms marked in use for this date.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="voucher-header-bar" style={{ padding: '12px 16px', margin: '-20px -20px 16px -20px' }}>
                        <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Saved plans</h3>
                    </div>
                    <p className="text-muted" style={{ fontSize: 12, marginBottom: 16 }}>Drafts can be approved to lock room usage for the date range.</p>
                    {loadingPlans ? (
                        <p className="text-muted" style={{ fontSize: 13, textAlign: 'center', padding: '16px' }}>Loading plans…</p>
                    ) : plans.length === 0 ? (
                        <p className="text-muted" style={{ fontSize: 13, textAlign: 'center', padding: '16px' }}>No saved plans yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {plans.map(p => {
                                const isApproved = p.status === 'approved';
                                const planDate = p.plan_date || p.date_from;
                                const niceDate = formatDisplayDate(planDate);

                                return (
                                    <div key={p.plan_id} style={{
                                        padding: '12px 16px',
                                        background: 'var(--bg-2)',
                                        border: `1px solid ${isApproved ? 'var(--primary)' : 'var(--border)'}`,
                                        borderRadius: '8px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '12px',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        {isApproved && (
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--primary)' }} />
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text)' }}>
                                                    {niceDate}
                                                </span>
                                                {p.time_slot && (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        padding: '2px 8px',
                                                        background: 'var(--surface)',
                                                        borderRadius: '12px',
                                                        border: '1px solid var(--border)',
                                                        color: 'var(--text-muted)'
                                                    }}>
                                                        {p.time_slot}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                                <span style={{ textTransform: 'capitalize' }}>
                                                    {p.exam_type.replace('_', ' ')}
                                                </span>
                                                <span style={{ opacity: 0.5 }}>•</span>
                                                <span style={{
                                                    color: isApproved ? 'var(--primary)' : 'inherit',
                                                    fontWeight: isApproved ? '600' : 'normal',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    {isApproved ? <CheckCircle size={12} /> : null}
                                                    {p.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleViewPlan(p)}
                                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                            >
                                                View
                                            </button>

                                            {!isApproved && canEditSeating && (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => approvePlanById(p.plan_id)}
                                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                                >
                                                    Approve
                                                </button>
                                            )}

                                            {canEditSeating && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm"
                                                    onClick={() => requestDeletePlan(p)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: '12px',
                                                        background: 'transparent',
                                                        border: '1px solid #ef4444',
                                                        color: '#ef4444'
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {deleteTarget && (
                <div
                    className="modal-overlay"
                    onClick={() => !deletingPlan && setDeleteTarget(null)}
                >
                    <div
                        className="modal"
                        style={{ width: '92vw', maxWidth: 460, minWidth: 'unset' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header" style={{ marginBottom: 12 }}>
                            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={18} color="var(--warning)" /> Delete Saved Plan
                            </h3>
                        </div>
                        <p className="text-muted" style={{ fontSize: 13, marginBottom: 14 }}>
                            This will permanently remove the selected saved allocation plan and cannot be undone.
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
                            Plan: {deleteTarget.plan_date || deleteTarget.date_from
                                ? formatDisplayDate(deleteTarget.plan_date || deleteTarget.date_from)
                                : 'Unknown Date'}
                        </div>
                        <div className="modal-footer" style={{ marginTop: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deletingPlan}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleDeletePlan}
                                disabled={deletingPlan}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                                <Trash2 size={14} /> {deletingPlan ? 'Deleting...' : 'Delete Plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {generatePromptPlanId && (
                <div
                    className="modal-overlay"
                    onClick={() => !generatePromptBusy && setGeneratePromptPlanId(null)}
                >
                    <div
                        className="modal"
                        style={{ width: '92vw', maxWidth: 480, minWidth: 'unset' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header" style={{ marginBottom: 10 }}>
                            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle size={18} color="var(--primary)" /> Generate Supervision Allotment
                            </h3>
                        </div>
                        <p className="text-muted" style={{ fontSize: 13, marginBottom: 14 }}>
                            Generate supervision allotment for this finalized seating session now?
                        </p>
                        <div className="modal-footer" style={{ marginTop: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setGeneratePromptPlanId(null)}
                                disabled={generatePromptBusy}
                            >
                                Later
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => handleGenerateSupervision(generatePromptPlanId)}
                                disabled={generatePromptBusy}
                            >
                                {generatePromptBusy ? 'Generating...' : 'Generate Now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden printable component */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    {result && <SeatingPlanPreview
                        result={result}
                        planDate={planDate}
                        formattedTimeSlot={formattedTimeSlot}
                    />}
                </div>
            </div>
        </div>
    );
}

function SeatingPlanPreview({ result, planDate, formattedTimeSlot }) {
    const thStyle = {
        border: '1.5px solid #000',
        padding: '8px 12px',
        background: '#fff',
        color: '#000',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        textAlign: 'center'
    };

    const tdStyle = {
        border: '1.5px solid #000',
        padding: '10px 12px',
        textAlign: 'center'
    };

    return (
        <div style={{
            padding: '24px',
            maxWidth: '800px',
            margin: '0 auto',
            fontFamily: 'sans-serif',
            color: '#000',
            background: '#fff',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ flex: '1 0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', textTransform: 'uppercase' }}>Jawahar Education Society's</h2>
                    <h1 style={{ margin: '6px 0', fontSize: '1.5rem', fontWeight: 'bold' }}>A.C. Patil College of Engineering, Kharghar</h1>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Exam Section Dept.</h3>
                    <h4 style={{ margin: '16px 0 0 0', fontSize: '1.1rem', fontWeight: 'bold' }}>
                        Seating Arrangement - {result.examType === 'internals' ? 'Internal Exam' : 'Term End Exam'}
                    </h4>
                    <div style={{ marginTop: 12, fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', gap: 32 }}>
                        <span>Date: {planDate || '__________'}</span>
                        <span>Time: {formattedTimeSlot || '__________'}</span>
                    </div>
                </div>

                {/* Stats removed from PDF for cleaner output */}

                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                    marginBottom: 30,
                    border: '2px solid #000'
                }}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, width: '15%' }}>Room No.</th>
                            {result.examType === 'term_ends' ? (
                                <>
                                    <th style={thStyle}>Year</th>
                                    <th style={thStyle}>Division</th>
                                    <th style={thStyle}>Roll Numbers</th>
                                    <th style={thStyle}>Students</th>
                                </>
                            ) : (
                                <>
                                    <th style={thStyle}>FE</th>
                                    <th style={thStyle}>SE</th>
                                    <th style={thStyle}>TE</th>
                                    <th style={thStyle}>BE</th>
                                    <th style={{ ...thStyle, fontSize: '10px' }}>Division Details</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {result.rooms.map((room, idx) => {
                            // Format division details with line breaks and bold years for PDF
                            let divDetailsJSX = <span>-</span>;
                            if (result.examType === 'internals' && room.divisions) {
                                const divElements = [];
                                ['FE', 'SE', 'TE', 'BE'].forEach(year => {
                                    if (room.divisions[year] && room.divisions[year].length > 0) {
                                        room.divisions[year].forEach((d, dIdx) => {
                                            const divLabel = d.division && d.division !== 'Default' ? `-${d.division}` : '';
                                            divElements.push(
                                                <div key={`${year}-${dIdx}`} style={{ marginBottom: '2px' }}>
                                                    <span style={{ fontWeight: 'bold' }}>{year}</span>{divLabel}({d.rollStart}-{d.rollEnd})
                                                </div>
                                            );
                                        });
                                    }
                                });
                                if (divElements.length > 0) {
                                    divDetailsJSX = <>{divElements}</>;
                                }
                            }

                            // Fallback for PDF: derive year-wise ranges when explicit division map is unavailable.
                            if (
                                result.examType === 'internals'
                                && (
                                    divDetailsJSX.props?.children === '-'
                                    || (room.divisions && Object.keys(room.divisions).length === 0)
                                )
                            ) {
                                const fallback = [];
                                ['FE', 'SE', 'TE', 'BE'].forEach((year) => {
                                    const count = Number(room[year] || 0);
                                    if (count > 0) {
                                        fallback.push(
                                            <div key={`pdf-fallback-${idx}-${year}`} style={{ marginBottom: '2px' }}>
                                                <span style={{ fontWeight: 'bold' }}>{year}</span>(1-{count})
                                            </div>
                                        );
                                    }
                                });
                                if (fallback.length > 0) divDetailsJSX = <>{fallback}</>;
                            }

                            return (
                                <tr key={idx}>
                                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>Room {room.physicalRoom}</td>
                                    {result.examType === 'term_ends' ? (
                                        <>
                                            <td style={{ ...tdStyle, fontWeight: 'bold' }}>{room.year}</td>
                                            <td style={tdStyle}>{room.division && room.division !== 'Default' ? room.division : '-'}</td>
                                            <td style={tdStyle}>
                                                {room.rollStart && room.rollEnd
                                                    ? `${room.rollStart}-${room.rollEnd}`
                                                    : `1-${room.students}`}
                                            </td>
                                            <td style={tdStyle}>{room.students}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={tdStyle}>{room.FE || '-'}</td>
                                            <td style={tdStyle}>{room.SE || '-'}</td>
                                            <td style={tdStyle}>{room.TE || '-'}</td>
                                            <td style={tdStyle}>{room.BE || '-'}</td>
                                            <td style={{ ...tdStyle, textAlign: 'left', lineHeight: '1.6', paddingLeft: '16px' }}>{divDetailsJSX}</td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Signature section - pushed to bottom */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 'auto',
                fontWeight: 'bold',
                padding: '80px 20px 0 20px',
                pageBreakInside: 'avoid'
            }}>
                <div style={{ textAlign: 'center', width: '30%' }}>
                    <div style={{ borderTop: '2px solid #000', paddingTop: '8px' }}>Prepared By</div>
                </div>
                <div style={{ textAlign: 'center', width: '30%' }}>
                    <div style={{ borderTop: '2px solid #000', paddingTop: '8px' }}>Incharge Exam Section</div>
                </div>
                <div style={{ textAlign: 'center', width: '30%' }}>
                    <div style={{ borderTop: '2px solid #000', paddingTop: '8px' }}>Principal</div>
                </div>
            </div>
        </div>
    );
}
