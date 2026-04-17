import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ClipboardList, FileText, User, Loader2, Printer } from 'lucide-react';
import api from '../api';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

function normalizeVoucherText(value) {
    return String(value || '').trim().toLowerCase();
}

function getQuantityLabelFromUnitName(unitName) {
    const normalized = String(unitName || '').trim().toLowerCase();
    if (!normalized) return 'No. Of Units';
    if (normalized.includes('group')) return 'No. Of Groups';
    if (normalized.includes('student')) return 'No. Of Students';
    return `No. Of ${String(unitName).trim()}`;
}

function buildVoucherClaimSignatureClient({ examDate, item }) {
    const baseParts = [
        `exam_date:${normalizeVoucherText(examDate)}`,
        `type:${normalizeVoucherText(item.type)}`,
        `subject:${normalizeVoucherText(item.subject)}`,
        `semester:${String(item.semester || '').trim()}`,
        `branch:${normalizeVoucherText(item.branch)}`
    ];

    if (item.type === 'theory') {
        baseParts.push(
            `max_marks:${String(item.max_marks ?? '').trim()}`,
            `activity_type:${normalizeVoucherText(item.activity_type)}`,
            `category_id:${String(item.category_id ?? 'none').trim()}`
        );
    } else if (item.type === 'practical') {
        baseParts.push(
            `category_id:${String(item.category_id ?? '').trim()}`,
            `title_id:${String(item.title_id ?? '').trim()}`,
            `examiner_type_id:${String(item.examiner_type_id ?? '').trim()}`,
            `unit_id:${String(item.unit_id ?? '').trim()}`,
            `max_marks:${item.max_marks == null || item.max_marks === '' ? 'null' : String(item.max_marks).trim()}`
        );
    }

    return baseParts.join('|');
}

function buildVoucherItemUniquenessKey(item) {
    const baseParts = [
        normalizeVoucherText(item.examiner_name),
        normalizeVoucherText(item.subject),
        normalizeVoucherText(item.semester),
        normalizeVoucherText(item.branch),
        normalizeVoucherText(item.type)
    ];

    if (item.type === 'theory') {
        baseParts.push(
            `max_marks:${String(item.max_marks ?? '').trim()}`,
            `activity_type:${normalizeVoucherText(item.activity_type)}`
        );
    } else if (item.type === 'practical') {
        baseParts.push(
            `title_id:${String(item.title_id ?? '').trim()}`,
            `examiner_type_id:${String(item.examiner_type_id ?? '').trim()}`,
            `unit_id:${String(item.unit_id ?? '').trim()}`,
            `max_marks:${item.max_marks == null || item.max_marks === '' ? 'null' : String(item.max_marks).trim()}`
        );
    }

    return baseParts.join('|');
}

function buildCurriculumOptionLabel(row) {
    return row.course_code ? `${row.course_code} - ${row.course_name}` : row.course_name;
}

function isProjectCurriculumSubject(row) {
    const name = String(row?.course_name || '').toLowerCase();
    return name.includes('mini project') || name.includes('major project');
}

function isLabCurriculumSubject(row) {
    if (!row) return false;
    return row.end_sem_max_marks == null && !isProjectCurriculumSubject(row);
}

function isTheoryCurriculumSubject(row) {
    if (!row) return false;
    return row.is_theory === true || String(row.subject_type || '').toLowerCase() === 'theory' || row.end_sem_max_marks != null;
}

function normalizeCategoryName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isLabCoursesCategory(name) {
    const normalized = normalizeCategoryName(name);
    return normalized.includes('lab') && (normalized.includes('course') || normalized.includes('courses'));
}

function isProjectTermWorkCategory(name) {
    const normalized = normalizeCategoryName(name);
    const hasProject = normalized.includes('project');
    const hasTermLike = normalized.includes('term') || normalized.includes('ter');
    const hasWork = normalized.includes('work');
    return hasProject && hasTermLike && hasWork;
}

function filterCurriculumSubjectsForContext(rows, examType, selectedCategoryName) {
    return rows.filter((row) => {
        if (examType === 'theory') {
            return isTheoryCurriculumSubject(row);
        }

        if (isLabCoursesCategory(selectedCategoryName)) {
            return isLabCurriculumSubject(row);
        }

        if (isProjectTermWorkCategory(selectedCategoryName)) {
            return isProjectCurriculumSubject(row);
        }

        return isLabCurriculumSubject(row) || isProjectCurriculumSubject(row);
    });
}

export default function VoucherGenerator() {
    const { hasPermission } = useAuth();
    const canViewVoucherSummary = hasPermission('view_vouchers');

    const [examType, setExamType] = useState('practical');
    const [theorySectionMode, setTheorySectionMode] = useState('end_sem'); // 'end_sem' | 'ia'
    const [categories, setCategories] = useState([]);
    const [titles, setTitles] = useState([]);
    const [examinerTypes, setExaminerTypes] = useState([]);
    const [paymentUnits, setPaymentUnits] = useState([]);
    const [theoryRates, setTheoryRates] = useState([]);
    const [branches, setBranches] = useState([]);
    const [rules, setRules] = useState({}); // Store system rules

    // Document header
    const [examMonth, setExamMonth] = useState('Nov');
    const [examYear, setExamYear] = useState(new Date().getFullYear().toString());

    // Common row fields
    const [examinerName, setExaminerName] = useState(''); // Moved to row level
    const [subject, setSubject] = useState('');
    const [semester, setSemester] = useState('');
    const [branch, setBranch] = useState('');
    const [ta, setTa] = useState('');

    // Practical form
    const [categoryId, setCategoryId] = useState('');
    const [titleId, setTitleId] = useState('');
    const [examinerTypeId, setExaminerTypeId] = useState('');
    const [unitId, setUnitId] = useState('');
    const [maxMarks, setMaxMarks] = useState('');
    const [maxMarksOptions, setMaxMarksOptions] = useState([]);
    const [quantity, setQuantity] = useState('');

    // Theory form
    const [theoryMaxMarks, setTheoryMaxMarks] = useState('');
    const [activityType, setActivityType] = useState('');
    const [numPapers, setNumPapers] = useState('');

    // Cart items
    const [items, setItems] = useState([]);

    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [savedPlans, setSavedPlans] = useState([]);
    const [remainingStudentsFromServer, setRemainingStudentsFromServer] = useState(null);
    const [capacityLoading, setCapacityLoading] = useState(false);
    const [editingItemId, setEditingItemId] = useState(null);
    const [curriculumSubjects, setCurriculumSubjects] = useState([]);
    const [subjectsLoading, setSubjectsLoading] = useState(false);
    const [summaryDepartment, setSummaryDepartment] = useState('ALL');
    const [summaryScope, setSummaryScope] = useState('monthly');
    const [summaryMonth, setSummaryMonth] = useState(String(new Date().getMonth() + 1));
    const [summaryYear, setSummaryYear] = useState(String(new Date().getFullYear()));
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState('');
    const [summaryData, setSummaryData] = useState({ totals: null, rows: [] });

    const printRef = useRef();
    const handlePrint = useReactToPrint({ content: () => printRef.current });

    useEffect(() => {
        Promise.all([
            api.get('/categories'),
            api.get('/titles'),
            api.get('/examiner-types'),
            api.get('/payment-units'),
            api.get('/theory-rates'),
            api.get('/branches'),
            api.get('/rules'),
            api.get('/voucher/plans').catch(() => ({ data: [] }))
        ]).then(([cats, tits, exmns, units, theory, branchesRes, rulesRes, plansRes]) => {
            setCategories(cats.data);
            setTitles(tits.data);
            setExaminerTypes(exmns.data);
            setPaymentUnits(units.data);
            setTheoryRates(theory.data);
            setBranches(branchesRes.data);
            setSavedPlans(plansRes.data || []);
            // Convert rules array to object keyed by rule_key for easy access
            const rulesMap = {};
            rulesRes.data.forEach(rule => {
                rulesMap[rule.rule_key] = parseFloat(rule.rule_value);
            });
            setRules(rulesMap);
        });
    }, []);

    useEffect(() => {
        if (!canViewVoucherSummary) return;
        loadVoucherSummary();
    }, [canViewVoucherSummary, summaryDepartment, summaryScope, summaryMonth, summaryYear]);

    async function loadSavedPlans() {
        try {
            const res = await api.get('/voucher/plans');
            setSavedPlans(res.data || []);
        } catch {
            // non-blocking
        }
    }

    async function loadVoucherSummary({ department = summaryDepartment, scope = summaryScope, month = summaryMonth, year = summaryYear } = {}) {
        if (!canViewVoucherSummary) return;

        try {
            setSummaryLoading(true);
            setSummaryError('');

            const params = {
                scope,
                year: Number(year)
            };
            if (scope === 'monthly') {
                params.month = Number(month);
            }
            if (department && department !== 'ALL') {
                params.branch_code = department;
            }

            const res = await api.get('/voucher/summary', { params });
            setSummaryData({
                totals: res.data?.totals || null,
                rows: Array.isArray(res.data?.rows) ? res.data.rows : []
            });
        } catch (err) {
            setSummaryError(err.response?.data?.error || 'Failed to load vouchers summary.');
            setSummaryData({ totals: null, rows: [] });
        } finally {
            setSummaryLoading(false);
        }
    }

    async function downloadVoucherSummary() {
        if (!canViewVoucherSummary) return;

        try {
            const params = {
                scope: summaryScope,
                year: Number(summaryYear)
            };
            if (summaryScope === 'monthly') {
                params.month = Number(summaryMonth);
            }
            if (summaryDepartment && summaryDepartment !== 'ALL') {
                params.branch_code = summaryDepartment;
            }

            const res = await api.get('/voucher/summary/export', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            const disposition = res.headers['content-disposition'] || '';
            const matched = disposition.match(/filename="?([^\"]+)"?/);
            link.download = matched?.[1] || 'vouchers-summary.csv';

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setSummaryError(err.response?.data?.error || 'Failed to download summary.');
        }
    }

    async function openSavedPlan(planId) {
        setError('');
        setSuccess('');
        try {
            const res = await api.get(`/voucher/plans/${planId}`);
            setResult(res.data);
            setSuccess(`Loaded saved voucher plan #${planId}.`);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load saved voucher plan.');
        }
    }

    const selectedCategoryForTitles = categories.find((c) => String(c.category_id) === String(categoryId));
    const selectedCategoryNameForTitles = String(selectedCategoryForTitles?.category_name || '');
    const iaMode = examType === 'theory' && theorySectionMode === 'ia';
    const iaDefaultTitle = titles.find((t) => String(t.title_name || '').trim().toLowerCase() === 'term test') || titles[0] || null;
    const iaDefaultCategoryId = iaDefaultTitle ? String(iaDefaultTitle.category_id) : '';
    const iaDefaultTitleId = iaDefaultTitle ? String(iaDefaultTitle.title_id) : '';
    const iaDefaultUnit = paymentUnits.find((u) => String(u.unit_name || '').toLowerCase().includes('student')) || paymentUnits[0] || null;
    const iaDefaultUnitId = iaDefaultUnit ? String(iaDefaultUnit.unit_id) : '';
    const filteredTitles = titles
        .filter(t => !categoryId || String(t.category_id) === String(categoryId))
        .filter((t) => {
            if (!isLabCoursesCategory(selectedCategoryNameForTitles)) return true;
            const name = String(t.title_name || '').toLowerCase();
            return !name.includes('term test');
        });

    useEffect(() => {
        setMaxMarks('');
        setMaxMarksOptions([]);
        if (titleId && examinerTypeId && unitId) {
            api.get('/remuneration-rates/options', {
                params: { title_id: titleId, examiner_type_id: examinerTypeId, unit_id: unitId }
            }).then(r => {
                setMaxMarksOptions(r.data);
                if (r.data.length === 1) setMaxMarks(r.data[0] === null ? '' : String(r.data[0]));
            }).catch(() => setMaxMarksOptions([]));
        }
    }, [titleId, examinerTypeId, unitId]);

    useEffect(() => {
        if (!titleId) {
            setUnitId('');
            return;
        }
        const selectedTitle = titles.find(t => String(t.title_id) === String(titleId));
        if (selectedTitle) {
            const titleNameLower = selectedTitle.title_name.toLowerCase();
            const isGroupBased = titleNameLower.includes('project') || titleNameLower.includes('seminar');
            const targetUnit = paymentUnits.find(u =>
                isGroupBased
                    ? u.unit_name.toLowerCase().includes('group')
                    : u.unit_name.toLowerCase().includes('student')
            );
            if (targetUnit) {
                setUnitId(String(targetUnit.unit_id));
            }
        }
    }, [titleId, titles, paymentUnits]);

    // Auto-calculate TA per 30 units whenever quantity/numPapers changes
    useEffect(() => {
        const qty = examType === 'practical' ? parseInt(quantity || 0) : parseInt(numPapers || 0);
        if (qty > 0) {
            const taRate = rules.TA_RATE || 200;
            const taUnitCount = rules.TA_UNIT_COUNT || 30;
            const calculatedTa = Math.ceil(qty / taUnitCount) * taRate;
            setTa(String(calculatedTa));
        } else {
            setTa('');
        }
    }, [quantity, numPapers, examType, rules]);

    // Auto-set theoryMaxMarks from inferred subject marks in end_sem mode
    useEffect(() => {
        if (examType === 'theory' && theorySectionMode === 'end_sem' && subject) {
            const selectedSubject = curriculumSubjects.find(row => String(row.course_name) === String(subject));
            if (selectedSubject?.end_sem_max_marks) {
                setTheoryMaxMarks(String(selectedSubject.end_sem_max_marks));
            }
        }
    }, [subject, examType, theorySectionMode, curriculumSubjects]);

    useEffect(() => {
        let active = true;

        if (!branch || !semester) {
            setRemainingStudentsFromServer(null);
            setCapacityLoading(false);
            return undefined;
        }

        async function loadCapacity() {
            try {
                setCapacityLoading(true);
                const selectedSubjectForCapacity = curriculumSubjects.find((row) => String(row.course_name) === String(subject));
                const theoryMaxMarksForCapacity = theorySectionMode === 'ia'
                    ? (selectedSubjectForCapacity?.iat_max_marks ?? '')
                    : (selectedSubjectForCapacity?.end_sem_max_marks ?? '');
                const effectiveCategoryId = iaMode ? iaDefaultCategoryId : categoryId;
                const effectiveTitleId = iaMode ? iaDefaultTitleId : titleId;
                const effectiveUnitId = iaMode ? iaDefaultUnitId : unitId;
                const res = await api.get('/voucher/capacity', {
                    params: {
                        branch_code: branch,
                        semester: Number(semester),
                        exam_date: `${examMonth} ${examYear}`,
                        type: examType === 'theory' && theorySectionMode === 'ia' ? 'practical' : examType,
                        subject: subject || undefined,
                        category_id: effectiveCategoryId || undefined,
                        title_id: effectiveTitleId || undefined,
                        examiner_type_id: examinerTypeId || undefined,
                        unit_id: effectiveUnitId || undefined,
                        max_marks: examType === 'theory'
                            ? (theoryMaxMarksForCapacity === '' ? undefined : theoryMaxMarksForCapacity)
                            : (maxMarks === '' ? (maxMarksOptions.includes(null) ? 'null' : undefined) : maxMarks),
                        activity_type: activityType || undefined
                    }
                });
                if (!active) return;
                setRemainingStudentsFromServer(Number(res.data?.remaining_students ?? res.data?.max_available_students ?? 0));
            } catch {
                if (!active) return;
                setRemainingStudentsFromServer(null);
            } finally {
                if (active) setCapacityLoading(false);
            }
        }

        loadCapacity();
        return () => {
            active = false;
        };
    }, [branch, semester, examType, theorySectionMode, subject, categoryId, titleId, examinerTypeId, unitId, maxMarks, activityType, examMonth, examYear, maxMarksOptions, curriculumSubjects]);

    useEffect(() => {
        let active = true;

        if (!branch || !semester) {
            setCurriculumSubjects([]);
            setSubjectsLoading(false);
            return undefined;
        }

        const selectedBranch = branches.find((br) => String(br.branch_code) === String(branch));
        if (!selectedBranch?.branch_id) {
            setCurriculumSubjects([]);
            setSubjectsLoading(false);
            return undefined;
        }

        async function loadSubjects() {
            try {
                setSubjectsLoading(true);
                const res = examType === 'theory'
                    ? await api.get('/curriculum/resolved-theory', {
                        params: {
                            branchId: Number(selectedBranch.branch_id),
                            semester: Number(semester)
                        }
                    })
                    : await api.get('/curriculum', {
                        params: {
                            branchId: Number(selectedBranch.branch_id),
                            semester: Number(semester),
                            categoryId: categoryId ? Number(categoryId) : undefined
                        }
                    });

                if (!active) return;

                const sem = Number(semester);
                const rows = examType === 'theory'
                    ? (Array.isArray(res.data?.rows) ? res.data.rows : [])
                    : (Array.isArray(res.data) ? res.data : []);
                const selectedCategory = categories.find((c) => String(c.category_id) === String(categoryId));
                const selectedCategoryName = String(selectedCategory?.category_name || '');

                const filtered = rows
                    .filter((row) => Number(row.semester) === sem)
                    .filter((row) => {
                        if (examType === 'theory') {
                            return isTheoryCurriculumSubject(row);
                        }

                        if (isLabCoursesCategory(selectedCategoryName)) {
                            return isLabCurriculumSubject(row);
                        }

                        if (isProjectTermWorkCategory(selectedCategoryName)) {
                            return isProjectCurriculumSubject(row);
                        }

                        // Default practical pool: lab + project subjects only.
                        return isLabCurriculumSubject(row) || isProjectCurriculumSubject(row);
                    })
                    .sort((a, b) => String(a.course_name || '').localeCompare(String(b.course_name || '')));

                setCurriculumSubjects(filtered);
            } catch {
                if (!active) return;
                setCurriculumSubjects([]);
            } finally {
                if (active) setSubjectsLoading(false);
            }
        }

        loadSubjects();
        return () => {
            active = false;
        };
    }, [branch, semester, branches, examType, categoryId, categories]);

    const theoryMaxMarkOptions = [...new Set(theoryRates.map(r => r.max_marks))].sort((a, b) => a - b);
    const theoryActivityOptions = [...new Set(
        theoryRates.filter(r => !theoryMaxMarks || String(r.max_marks) === String(theoryMaxMarks)).map(r => r.activity_type)
    )];

    function handleAddItem(e) {
        e.preventDefault();
        setError('');

        const trimmedExaminerName = String(examinerName || '').trim();
        const trimmedSubject = String(subject || '').trim();
        const trimmedBranch = String(branch || '').trim();

        if (!trimmedExaminerName) {
            setError('Please enter the Examiner Name.');
            return;
        }

        if (!trimmedSubject) {
            setError('Please select Subject / Paper from curriculum list.');
            return;
        }

        if (!semester || Number(semester) < 1 || Number(semester) > 8) {
            setError('Please select a semester between 1 and 8.');
            return;
        }

        if (!trimmedBranch) {
            setError('Please select a branch.');
            return;
        }

        const baseItem = {
            id: Date.now(),
            examiner_name: trimmedExaminerName,
            subject: trimmedSubject,
            semester: Number(semester),
            branch: trimmedBranch,
            ta: Number(ta || 0)
        };

        const selectedSubjectRow = visibleCurriculumSubjects.find((row) => String(row.course_name) === String(trimmedSubject));
        const inferredEndSemMarks = selectedSubjectRow?.end_sem_max_marks ?? null;
        const inferredIaMarks = selectedSubjectRow?.iat_max_marks ?? null;

        if (examType === 'theory' && theorySectionMode === 'end_sem') {
            if (!inferredEndSemMarks || !activityType || !numPapers) {
                setError('Please fill all theory fields.');
                return;
            }
            const requestedPapers = Number(numPapers);
            if (theoryMaxClaimable != null && requestedPapers > theoryMaxClaimable) {
                setError(`Cannot add item: No. of Papers (${requestedPapers}) exceeds remaining max (${theoryMaxClaimable}) for this subject context.`);
                return;
            }
            const nextItem = {
                ...baseItem,
                type: 'theory',
                max_marks: Number(inferredEndSemMarks),
                activity_type: String(activityType || '').trim(),
                num_papers: requestedPapers,
                label: `Theory: ${activityType} (${inferredEndSemMarks}M) - ${numPapers} papers`
            };

            const duplicateItem = items.find(existing => (
                existing.id !== editingItemId
                && buildVoucherItemUniquenessKey(existing) === buildVoucherItemUniquenessKey(nextItem)
            ));
            if (duplicateItem) {
                setError(`This moderator already has the same voucher item (${nextItem.subject}, Sem ${nextItem.semester}, ${nextItem.branch}). Use a different moderator or edit the existing line.`);
                return;
            }

            if (editingItemId) {
                setItems(items.map(existing => existing.id === editingItemId ? { ...nextItem, id: editingItemId } : existing));
                setEditingItemId(null);
            } else {
                setItems([...items, nextItem]);
            }

            // Keep current class/exam context for faster repeated entry.
            setNumPapers('');
        } else {
            if (!examinerTypeId || !quantity || (!iaMode && (!categoryId || !titleId))) {
                setError(examType === 'theory' ? 'Please fill all Internal Examination fields.' : 'Please fill all practical fields.');
                return;
            }
            const resolvedCategoryId = iaMode ? iaDefaultCategoryId : categoryId;
            const resolvedTitleId = iaMode ? iaDefaultTitleId : titleId;
            const resolvedUnitId = iaMode ? iaDefaultUnitId : unitId;

            if (!resolvedCategoryId || !resolvedTitleId) {
                setError('Internal Examination defaults are not configured. Please configure a Term Test title in Voucher Config.');
                return;
            }
            if (!resolvedUnitId) {
                setError('Payment Unit could not be resolved for the selected title. Please check title configuration.');
                return;
            }
            const resolvedMaxMarks = examType === 'theory' ? inferredIaMarks : (maxMarks ? Number(maxMarks) : undefined);
            if ((examType === 'theory' && !resolvedMaxMarks) || (examType !== 'theory' && maxMarksOptions.some(v => v !== null) && !maxMarks)) {
                setError('Please select Max Marks.');
                return;
            }
            const tName = titles.find(t => String(t.title_id) === String(resolvedTitleId))?.title_name;
            const eName = examinerTypes.find(e => String(e.examiner_type_id) === String(examinerTypeId))?.type_name;
            const requestedQuantity = Number(quantity);

            if (practicalMaxClaimable != null && requestedQuantity > practicalMaxClaimable) {
                setError(`Cannot add item: ${practicalQuantityLabel} (${requestedQuantity}) exceeds remaining max (${practicalMaxClaimable}) for this subject context.`);
                return;
            }

            const nextItem = {
                ...baseItem,
                type: 'practical',
                voucher_mode: examType === 'theory' ? 'theory_ia' : 'practical',
                category_id: Number(resolvedCategoryId),
                title_id: Number(resolvedTitleId),
                examiner_type_id: Number(examinerTypeId),
                unit_id: Number(resolvedUnitId),
                max_marks: resolvedMaxMarks,
                quantity: requestedQuantity,
                label: examType === 'theory'
                    ? `Internal Examination: ${tName} - ${eName} - ${quantity} units`
                    : `Practical: ${tName} - ${eName} - ${quantity} units`
            };

            const duplicateItem = items.find(existing => (
                existing.id !== editingItemId
                && buildVoucherItemUniquenessKey(existing) === buildVoucherItemUniquenessKey(nextItem)
            ));
            if (duplicateItem) {
                setError(`This moderator already has the same voucher item (${nextItem.subject}, Sem ${nextItem.semester}, ${nextItem.branch}). Use a different moderator or edit the existing line.`);
                return;
            }

            if (editingItemId) {
                setItems(items.map(existing => existing.id === editingItemId ? { ...nextItem, id: editingItemId } : existing));
                setEditingItemId(null);
            } else {
                setItems([...items, nextItem]);
            }

            // Keep current class/exam context for faster repeated entry.
            setQuantity('');
        }
    }

    function removeItem(id) {
        setItems(items.filter(i => i.id !== id));
        if (editingItemId === id) {
            setEditingItemId(null);
        }
    }

    function startEditingItem(item) {
        setError('');
        setEditingItemId(item.id);
        if (item.type === 'theory') {
            setExamType('theory');
            setTheorySectionMode('end_sem');
        } else if (item.voucher_mode === 'theory_ia') {
            setExamType('theory');
            setTheorySectionMode('ia');
        } else {
            setExamType('practical');
        }
        setExaminerName(String(item.examiner_name || ''));
        setSubject(String(item.subject || ''));
        setSemester(String(item.semester || ''));
        setBranch(String(item.branch || ''));
        setTa(String(item.ta || ''));

        if (item.type === 'theory') {
            setTheoryMaxMarks(String(item.max_marks || ''));
            setActivityType(String(item.activity_type || ''));
            setNumPapers(String(item.num_papers || ''));

            setCategoryId('');
            setTitleId('');
            setExaminerTypeId('');
            setUnitId('');
            setMaxMarks('');
            setQuantity('');
        } else {
            setCategoryId(String(item.category_id || ''));
            setTitleId(String(item.title_id || ''));
            setExaminerTypeId(String(item.examiner_type_id || ''));
            setUnitId(String(item.unit_id || ''));
            setMaxMarks(item.max_marks == null ? '' : String(item.max_marks));
            setQuantity(String(item.quantity || ''));

            setTheoryMaxMarks('');
            setActivityType('');
            setNumPapers('');
        }
    }

    function cancelEditing() {
        setEditingItemId(null);
        setError('');
    }

    async function handleGenerate() {
        if (items.length === 0) {
            setError('Please add at least one item to the voucher.');
            return;
        }

        setError(''); setSuccess(''); setResult(null); setLoading(true);
        try {
            const payload = {
                exam_date: `${examMonth} ${examYear}`,
                items: items
            };
            const res = await api.post('/voucher/calculate-batch', payload);
            setResult(res.data);
            if (res.data?.plan_id) {
                setSuccess(`Voucher generated and saved as plan #${res.data.plan_id}.`);
            }
            await loadSavedPlans();
        } catch (err) {
            const details = err.response?.data?.details;
            const detailText = Array.isArray(details) && details.length
                ? details.join(' | ')
                : '';
            setError(detailText || err.response?.data?.error || 'Batch calculation failed.');
        } finally {
            setLoading(false);
        }
    }

    function reset() {
        setResult(null);
        setError('');
        setSuccess('');
        setItems([]);
        setExaminerName('');
        setSubject('');
        setSemester('');
        setBranch('');
        setTa('');
        // Month/Year typically stay the same between batches, so we don't reset them.
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
    const summaryMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const summaryYears = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i);
    const effectiveDraftCategoryId = iaMode ? iaDefaultCategoryId : categoryId;
    const effectiveDraftTitleId = iaMode ? iaDefaultTitleId : titleId;
    const effectiveDraftUnitId = iaMode ? iaDefaultUnitId : unitId;
    const selectedSubjectForDraft = curriculumSubjects.find((row) => String(row.course_name) === String(subject));
    const iaMaxMarksForDraft = selectedSubjectForDraft?.iat_max_marks ?? '';
    const selectedPaymentUnit = paymentUnits.find((u) => String(u.unit_id) === String(effectiveDraftUnitId));
    const practicalQuantityLabel = getQuantityLabelFromUnitName(selectedPaymentUnit?.unit_name);
    const practicalDraftSignature = buildVoucherClaimSignatureClient({
        examDate: `${examMonth} ${examYear}`,
        item: {
            type: 'practical',
            subject,
            semester: Number(semester || 0),
            branch,
            category_id: effectiveDraftCategoryId || '',
            title_id: effectiveDraftTitleId || '',
            examiner_type_id: examinerTypeId || '',
            unit_id: effectiveDraftUnitId || '',
            max_marks: iaMode
                ? (iaMaxMarksForDraft === '' ? '' : iaMaxMarksForDraft)
                : (maxMarks === '' ? (maxMarksOptions.includes(null) ? null : '') : maxMarks)
        }
    });
    const pendingClaimedForContext = items
        .filter((item) => item.type === 'practical' && item.id !== editingItemId)
        .filter((item) => buildVoucherClaimSignatureClient({ examDate: `${examMonth} ${examYear}`, item }) === practicalDraftSignature)
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const practicalMaxClaimable = remainingStudentsFromServer == null
        ? null
        : Math.max(0, Number(remainingStudentsFromServer) - pendingClaimedForContext);
    const practicalQuantityLabelWithMax = practicalMaxClaimable == null
        ? practicalQuantityLabel
        : `${practicalQuantityLabel} (Max: ${practicalMaxClaimable})`;

    const selectedCategory = categories.find((c) => String(c.category_id) === String(categoryId));
    const selectedCategoryName = String(selectedCategory?.category_name || '');
    const visibleCurriculumSubjects = filterCurriculumSubjectsForContext(curriculumSubjects, examType, selectedCategoryName);
    const selectedSubjectRow = visibleCurriculumSubjects.find((row) => String(row.course_name) === String(subject));
    const inferredEndSemMarks = selectedSubjectRow?.end_sem_max_marks ?? '';
    const inferredIaMarks = selectedSubjectRow?.iat_max_marks ?? '';

    const theoryDraftSignature = buildVoucherClaimSignatureClient({
        examDate: `${examMonth} ${examYear}`,
        item: {
            type: 'theory',
            subject,
            semester: Number(semester || 0),
            branch,
            max_marks: String(examType === 'theory' && theorySectionMode === 'ia' ? inferredIaMarks : inferredEndSemMarks),
            activity_type: activityType || ''
        }
    });
    const pendingClaimedTheory = items
        .filter((item) => item.type === 'theory' && item.id !== editingItemId)
        .filter((item) => buildVoucherClaimSignatureClient({ examDate: `${examMonth} ${examYear}`, item }) === theoryDraftSignature)
        .reduce((sum, item) => sum + Number(item.num_papers || 0), 0);
    const theoryMaxClaimable = remainingStudentsFromServer == null
        ? null
        : Math.max(0, Number(remainingStudentsFromServer) - pendingClaimedTheory);
    const theoryQuantityLabelWithMax = theoryMaxClaimable == null
        ? 'No. of Papers'
        : `No. of Papers (Max: ${theoryMaxClaimable})`;

    return (
        <div className="voucher-container" style={{ maxWidth: '1100px' }}>
            <div className="page-header">
                <div>
                    <div className="page-title">Voucher Generation</div>
                    <div className="page-subtitle">Add multiple subjects and classes for multiple examiners, then generate the final voucher sheet.</div>
                </div>
            </div>

            {!result ? (
                <>
                <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 5.5fr) minmax(0, 3.5fr)', alignItems: 'start' }}>

                    {/* LEFT COLUMN: Add Item Form */}
                    <form className="card" onSubmit={handleAddItem}>
                        <div className="voucher-header-bar" style={{ padding: '16px 20px', margin: '-24px -24px 24px -24px' }}>
                            <h2 style={{ fontSize: '1rem' }}>1. Add Item</h2>
                        </div>

                        <div className="form-group mb-4">
                            <label className="form-label">Exam Type</label>
                            <div className="flex gap-2">
                                <button type="button" id="type-practical"
                                    className={`btn ${examType === 'practical' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setExamType('practical')}><ClipboardList size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> TW / Oral / Practical</button>
                                <button type="button" id="type-theory"
                                    className={`btn ${examType === 'theory' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setExamType('theory')}><FileText size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> Theory</button>
                            </div>
                        </div>

                        {examType === 'theory' && (
                            <div className="form-group mb-4">
                                <label className="form-label">Theory Examination Type</label>
                                <div className="flex gap-2">
                                    <button type="button" id="theory-ia"
                                        style={{
                                            border: `2px solid ${theorySectionMode === 'ia' ? 'var(--primary)' : 'var(--border)'}`,
                                            backgroundColor: 'transparent',
                                            color: theorySectionMode === 'ia' ? 'var(--primary)' : 'var(--text)',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: theorySectionMode === 'ia' ? '600' : '500',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onClick={() => setTheorySectionMode('ia')}>Internal Examination (IA)</button>
                                    <button type="button" id="theory-end-sem"
                                        style={{
                                            border: `2px solid ${theorySectionMode === 'end_sem' ? 'var(--primary)' : 'var(--border)'}`,
                                            backgroundColor: 'transparent',
                                            color: theorySectionMode === 'end_sem' ? 'var(--primary)' : 'var(--text)',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: theorySectionMode === 'end_sem' ? '600' : '500',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onClick={() => setTheorySectionMode('end_sem')}>End Sem Examination</button>
                                </div>
                            </div>
                        )}

                        <div className="form-group mb-4">
                            <label className="form-label">Moderator / Examiner Name</label>
                            <input id="examiner-name" className="form-control" placeholder="Full name (e.g. V.B. PAWAR)" value={examinerName} onChange={e => setExaminerName(e.target.value)} required />
                        </div>

                        {(examType === 'practical' || (examType === 'theory' && theorySectionMode === 'ia')) && (
                            <div className="form-group mb-4">
                                <label className="form-label">Examiner Type</label>
                                <select id="examiner-type-select" className="form-control" value={examinerTypeId} onChange={e => setExaminerTypeId(e.target.value)} required>
                                    <option value="">— Select —</option>
                                    {examinerTypes.map(e => <option key={e.examiner_type_id} value={e.examiner_type_id}>{e.type_name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="grid-2 mb-4">
                            <div className="form-group">
                                <label className="form-label">Branch</label>
                                <select id="branch" className="form-control" value={branch} onChange={e => setBranch(e.target.value)} required>
                                    <option value="">— Select Branch —</option>
                                    {branches.map(br => <option key={br.branch_id} value={br.branch_code}>{br.branch_name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Semester</label>
                                <select id="semester" className="form-control" value={semester} onChange={e => setSemester(e.target.value)} required>
                                    <option value="">— Select Semester —</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5</option>
                                    <option value="6">6</option>
                                    <option value="7">7</option>
                                    <option value="8">8</option>
                                </select>
                            </div>
                        </div>

                        <div className="divider" style={{ margin: '24px 0' }} />

                        {(examType === 'practical' || (examType === 'theory' && theorySectionMode === 'ia')) ? (
                            <div className="flex-col gap-4">
                                {examType === 'practical' && (
                                    <div className="grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Category</label>
                                            <select id="category-select" className="form-control" value={categoryId} onChange={e => { setCategoryId(e.target.value); setTitleId(''); }} required>
                                                <option value="">— Select Category —</option>
                                                {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Title</label>
                                            <select id="title-select" className="form-control" value={titleId} onChange={e => setTitleId(e.target.value)} required disabled={!categoryId}>
                                                <option value="">— Select Title —</option>
                                                {filteredTitles.map(t => <option key={t.title_id} value={t.title_id}>{t.title_name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Subject / Paper</label>
                                    <select id="subject" className="form-control" value={subject} onChange={e => setSubject(e.target.value)} required disabled={!branch || !semester || subjectsLoading}>
                                        <option value="">
                                            {!branch || !semester
                                                ? '— Select Branch and Semester first —'
                                                : subjectsLoading
                                                    ? 'Loading subjects...'
                                                    : visibleCurriculumSubjects.length
                                                        ? '— Select Subject —'
                                                        : 'No curriculum subjects found for selected semester'}
                                        </option>
                                        {subject && !visibleCurriculumSubjects.some((row) => String(row.course_name) === String(subject)) && (
                                            <option value={subject}>{subject}</option>
                                        )}
                                        {visibleCurriculumSubjects.map((row) => (
                                            <option key={row.subject_id} value={row.course_name}>
                                                {buildCurriculumOptionLabel(row)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Max Marks</label>
                                        {examType === 'theory' && theorySectionMode === 'ia' ? (
                                            <input className="form-control" value={inferredIaMarks || ''} readOnly disabled placeholder="Auto from curriculum IA marks" />
                                        ) : maxMarksOptions.length === 0 && !(titleId && examinerTypeId && unitId) ? (
                                            <select className="form-control" disabled><option>— Select params first —</option></select>
                                        ) : maxMarksOptions.length === 0 ? (
                                            <select className="form-control" disabled><option>No rates found</option></select>
                                        ) : (
                                            <select id="max-marks" className="form-control" value={maxMarks} onChange={e => setMaxMarks(e.target.value)} required={maxMarksOptions.some(v => v !== null)}>
                                                {maxMarksOptions.includes(null) && maxMarksOptions.length === 1 ? <option value="">N/A</option> : <option value="">— Select Max Marks —</option>}
                                                {maxMarksOptions.filter(v => v !== null).map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">
                                            {capacityLoading ? `${practicalQuantityLabel} (Max: ...)` : practicalQuantityLabelWithMax}
                                        </label>
                                        <input id="quantity" className="form-control" type="number" min="1" max={practicalMaxClaimable == null ? undefined : practicalMaxClaimable} placeholder="e.g. 30" value={quantity} onChange={e => setQuantity(e.target.value)} required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">T.A. (₹) (Auto per 30 units)</label>
                                    <input id="ta" className="form-control" type="number" min="0" placeholder="e.g. 200" value={ta} onChange={e => setTa(e.target.value)} />
                                </div>
                            </div>
                        ) : (
                            <div className="flex-col gap-4">
                                <div className="form-group">
                                    <label className="form-label">Subject / Paper</label>
                                    <select id="subject" className="form-control" value={subject} onChange={e => setSubject(e.target.value)} required disabled={!branch || !semester || subjectsLoading}>
                                        <option value="">
                                            {!branch || !semester
                                                ? '— Select Branch and Semester first —'
                                                : subjectsLoading
                                                    ? 'Loading subjects...'
                                                    : visibleCurriculumSubjects.length
                                                        ? '— Select Subject —'
                                                        : 'No curriculum subjects found for selected semester'}
                                        </option>
                                        {subject && !visibleCurriculumSubjects.some((row) => String(row.course_name) === String(subject)) && (
                                            <option value={subject}>{subject}</option>
                                        )}
                                        {visibleCurriculumSubjects.map((row) => (
                                            <option key={row.subject_id} value={row.course_name}>
                                                {buildCurriculumOptionLabel(row)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid-3">
                                    <div className="form-group">
                                        <label className="form-label">Max Marks</label>
                                        <input id="theory-max-marks" className="form-control" value={inferredEndSemMarks || ''} readOnly disabled placeholder="Auto from curriculum End Sem marks" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Activity Type</label>
                                        <select id="activity-type" className="form-control" value={activityType} onChange={e => setActivityType(e.target.value)} required disabled={!theoryMaxMarks}>
                                            <option value="">— Select —</option>
                                            {theoryActivityOptions.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">
                                            {capacityLoading ? `${theoryQuantityLabelWithMax} (Max: ...)` : theoryQuantityLabelWithMax}
                                        </label>
                                        <input id="num-papers" className="form-control" type="number" min="1" max={theoryMaxClaimable == null ? undefined : theoryMaxClaimable} placeholder="e.g. 50" value={numPapers} onChange={e => setNumPapers(e.target.value)} required />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 text-right" style={{ display: 'flex', gap: '8px' }}>
                            <button id="add-item-btn" className="btn btn-secondary" type="submit" style={{ width: '100%', border: '1px dashed var(--border)', background: 'var(--bg-3)' }}>
                                {editingItemId ? 'Save Item Changes' : '+ Add Item to Voucher'}
                            </button>
                            {editingItemId && (
                                <button type="button" className="btn btn-secondary" onClick={cancelEditing}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>

                    {/* RIGHT COLUMN: Pending Items Cart & Generation */}
                    <div className="flex-col gap-4">
                        <div className="card">
                            <div className="voucher-header-bar" style={{ padding: '16px 20px', margin: '-24px -24px 16px -24px', background: 'var(--surface)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                                <h2 style={{ fontSize: '1rem' }}>2. Pending Voucher Items</h2>
                            </div>

                            {items.length === 0 ? (
                                <div className="text-center text-muted py-6" style={{ padding: '40px 0' }}>
                                    No items added yet.<br />Fill out the form and click "Add Item".
                                </div>
                            ) : (
                                <div className="flex-col gap-2">
                                    {items.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            onClick={() => startEditingItem(item)}
                                            style={{
                                                padding: '12px 14px',
                                                border: editingItemId === item.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '12px',
                                                position: 'relative',
                                                background: editingItemId === item.id ? 'var(--bg-2)' : 'var(--bg)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <button
                                                type="button"
                                                className="remove-item-btn"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    removeItem(item.id);
                                                }}
                                                style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                                            >×</button>
                                            <div style={{ fontWeight: 600, color: 'var(--primary-light)', paddingRight: 20, fontSize: '13px' }}>{idx + 1}. {item.subject}</div>
                                            <div style={{ color: 'var(--text)', marginTop: 4, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <User size={14} /> {item.examiner_name}
                                            </div>
                                            <div style={{ color: 'var(--text-2)', marginTop: 2 }}>
                                                {item.semester} • {item.branch} {item.ta > 0 ? ` • T.A: ₹${item.ta}` : ''}
                                            </div>
                                            {editingItemId === item.id && (
                                                <div style={{ color: 'var(--primary-light)', marginTop: 6, fontSize: '11px', fontWeight: 600 }}>
                                                    Editing this item
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="card">
                            <div className="voucher-header-bar" style={{ padding: '16px 20px', margin: '-24px -24px 20px -24px' }}>
                                <h2 style={{ fontSize: '1rem' }}>3. Generate Voucher</h2>
                            </div>

                            <div className="grid-2 mb-4">
                                <div className="form-group">
                                    <label className="form-label">Exam Month</label>
                                    <select className="form-control" value={examMonth} onChange={e => setExamMonth(e.target.value)}>
                                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Exam Year</label>
                                    <select className="form-control" value={examYear} onChange={e => setExamYear(e.target.value)}>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>

                            {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
                            {success && <Alert type="success" dismissible onDismiss={() => setSuccess('')}>{success}</Alert>}

                            <button id="calculate-btn" className="btn btn-primary" onClick={handleGenerate} disabled={items.length === 0 || loading} style={{ width: '100%', fontSize: '1rem', padding: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {loading ? (
                                    <><Loader2 size={18} className="animate-spin" /> Generating…</>
                                ) : (
                                    <><FileText size={18} /> Generate Final Voucher</>
                                )}
                            </button>
                        </div>

                        <div className="card" style={{ marginTop: 14 }}>
                            <div className="voucher-header-bar" style={{ padding: '16px 20px', margin: '-24px -24px 14px -24px', background: 'var(--surface)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                                <h2 style={{ fontSize: '1rem' }}>Saved Voucher Plans</h2>
                            </div>

                            {!savedPlans.length ? (
                                <div className="text-muted" style={{ fontSize: 13 }}>No saved voucher plans yet.</div>
                            ) : (
                                <div className="flex-col gap-2">
                                    {savedPlans.slice(0, 8).map((plan) => (
                                        <div key={plan.plan_id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 13 }}>Plan #{plan.plan_id} - {plan.exam_date || '-'}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{plan.item_count} item(s) - Rs. {Number(plan.grand_total || 0).toFixed(2)}</div>
                                            </div>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openSavedPlan(plan.plan_id)}>
                                                View
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>

                </div>

                {canViewVoucherSummary && (
                    <div className="card" style={{ marginTop: 16 }}>
                        <div className="voucher-header-bar" style={{ padding: '16px 20px', margin: '-24px -24px 14px -24px', background: 'var(--surface)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                            <h2 style={{ fontSize: '1rem' }}>Vouchers Summary</h2>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
                            <div className="form-group">
                                <label className="form-label">Summary Type</label>
                                <select className="form-control" value={summaryScope} onChange={(e) => setSummaryScope(e.target.value)}>
                                    <option value="monthly">Monthly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Department</label>
                                <select className="form-control" value={summaryDepartment} onChange={(e) => setSummaryDepartment(e.target.value)}>
                                    <option value="ALL">All Departments (Entire Institution)</option>
                                    {branches.map((br) => (
                                        <option key={br.branch_id} value={br.branch_code}>{br.branch_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Month</label>
                                <select className="form-control" value={summaryMonth} onChange={(e) => setSummaryMonth(e.target.value)} disabled={summaryScope === 'yearly'}>
                                    {summaryMonthNames.map((name, idx) => (
                                        <option key={name} value={String(idx + 1)}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Year</label>
                                <select className="form-control" value={summaryYear} onChange={(e) => setSummaryYear(e.target.value)}>
                                    {summaryYears.map((yearVal) => (
                                        <option key={yearVal} value={String(yearVal)}>{yearVal}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', background: 'var(--bg-2)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Gross Total</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>Rs. {Number(summaryData.totals?.gross_total || 0).toFixed(2)}</div>
                            </div>
                            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', background: 'var(--bg)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Headcount / Volume</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{Number(summaryData.totals?.headcount_volume || 0)}</div>
                            </div>
                            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', background: 'var(--bg)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Total Remuneration</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Rs. {Number(summaryData.totals?.total_remuneration || 0).toFixed(2)}</div>
                            </div>
                            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', background: 'var(--bg)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Total T.A.</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Rs. {Number(summaryData.totals?.total_ta || 0).toFixed(2)}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                {summaryDepartment === 'ALL' ? 'Institution View' : `Department View: ${summaryDepartment}`} • {summaryScope === 'yearly' ? `Year ${summaryYear}` : `${summaryMonthNames[Number(summaryMonth) - 1]} ${summaryYear}`}
                            </div>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={downloadVoucherSummary}>Download Summary</button>
                        </div>

                        {summaryError && <Alert type="error" dismissible onDismiss={() => setSummaryError('')}>{summaryError}</Alert>}

                        {summaryLoading ? (
                            <div className="text-muted" style={{ fontSize: 13 }}>Loading summary...</div>
                        ) : !summaryData.rows.length ? (
                            <div className="text-muted" style={{ fontSize: 13 }}>No data available for this selection.</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Department</th>
                                            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Vouchers</th>
                                            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Headcount</th>
                                            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Remuneration</th>
                                            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>T.A.</th>
                                            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Gross</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summaryData.rows.map((row) => (
                                            <tr key={row.branch_code || row.branch_name}>
                                                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{row.branch_name || row.branch_code}</td>
                                                <td style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{Number(row.voucher_count || 0)}</td>
                                                <td style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{Number(row.headcount_volume || 0)}</td>
                                                <td style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Rs. {Number(row.total_remuneration || 0).toFixed(2)}</td>
                                                <td style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Rs. {Number(row.total_ta || 0).toFixed(2)}</td>
                                                <td style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Rs. {Number(row.gross_total || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
                </>
            ) : (
                <div style={{ maxWidth: 860, margin: '0 auto' }}>
                    {success && <Alert type="success" dismissible onDismiss={() => setSuccess('')}>{success}</Alert>}
                    <div className="flex gap-2 mb-4 no-print" style={{ justifyContent: 'space-between' }}>
                        <div>
                            <button className="btn btn-secondary" onClick={() => setResult(null)}>← Edit Items</button>
                            <button className="btn btn-secondary" onClick={reset} style={{ marginLeft: 8 }}>+ New Voucher</button>
                        </div>
                        <button id="print-btn" className="btn btn-primary" onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Printer size={16} /> Print Voucher
                        </button>
                    </div>

                    <div ref={printRef}>
                        <VoucherPreview data={result} />
                    </div>
                </div>
            )}
        </div>
    );
}

function VoucherPreview({ data }) {
    const [expandedRows, setExpandedRows] = useState({});

    const toggleRow = (examinerName, i) => {
        const key = `${examinerName}-${i}`;
        setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Group items by examiner_name
    const groupedItems = data.items.reduce((acc, item) => {
        const name = item.examiner_name || 'UNKNOWN EXAMINER';
        if (!acc[name]) acc[name] = [];
        acc[name].push(item);
        return acc;
    }, {});

    const thStyle = {
        border: '1px solid #000',
        padding: '8px 12px',
        background: '#fff', // White or very light grey, no distracting color
        color: '#000',      // Black text
        fontWeight: 'bold', // Bold font
        textTransform: 'uppercase'
    };

    return (
        <div className="voucher-card voucher-print-area" style={{ maxWidth: 900, background: '#fff', color: '#000', margin: '0 auto' }}>
            <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', textTransform: 'uppercase' }}>Jawahar Education Society's</h2>
                <h1 style={{ margin: '6px 0', fontSize: '1.5rem', fontWeight: 'bold' }}>A.C. Patil College of Engineering, Kharghar</h1>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Exam Section Dept.</h3>
                <h4 style={{ margin: '16px 0 0 0', fontSize: '1.1rem', fontWeight: 'bold' }}>
                    Remuneration for Moderators {data.exam_date ? ` ${data.exam_date}` : ''}
                </h4>
            </div>

            <div className="voucher-body" style={{ padding: '16px 24px 32px' }}>
                {Object.keys(groupedItems).map((examinerName, idx) => {
                    const items = groupedItems[examinerName];
                    const moderatorTotal = items.reduce((sum, item) => sum + item.amount, 0);

                    return (
                        <div key={idx} style={{ marginBottom: 40, pageBreakInside: 'avoid' }}>
                            <div style={{ marginBottom: 12, fontSize: '1.1rem', fontWeight: 'bold' }}>
                                Moderator's Name: <span style={{ textTransform: 'uppercase' }}>{examinerName}</span>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: 16 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...thStyle, textAlign: 'left' }}>Subject</th>
                                        <th style={{ ...thStyle, textAlign: 'center', width: '80px' }}>Sem</th>
                                        <th style={{ ...thStyle, textAlign: 'center', width: '100px' }}>Branch</th>
                                        <th style={{ ...thStyle, textAlign: 'center', width: '100px' }}>No. of<br />Students/Papers</th>
                                        <th style={{ ...thStyle, textAlign: 'right', width: '100px' }}>Remu. (₹)</th>
                                        <th style={{ ...thStyle, textAlign: 'right', width: '80px' }}>T.A. (₹)</th>
                                        <th style={{ ...thStyle, textAlign: 'right', width: '120px' }}>Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, i) => {
                                        const rowKey = `${examinerName}-${i}`;
                                        const isExpanded = !!expandedRows[rowKey];
                                        return (
                                            <React.Fragment key={i}>
                                                <tr onClick={() => toggleRow(examinerName, i)} style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#f8fafc' : 'transparent', transition: 'background-color 0.2s' }} title="Click to view cost breakdown">
                                                    <td style={{ border: '1px solid #000', padding: '10px 12px', verticalAlign: 'top' }}>
                                                        {item.subject}
                                                        {item.minimum_applied && <span className="no-print" style={{ display: 'block', fontSize: '10px', color: '#666', fontStyle: 'italic', marginTop: 4 }}>*Min ₹100 floor applied</span>}
                                                    </td>
                                                    <td style={{ border: '1px solid #000', padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>{item.semester}</td>
                                                    <td style={{ border: '1px solid #000', padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>{item.branch}</td>
                                                    <td style={{ border: '1px solid #000', padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity || item.num_papers}</td>
                                                    <td style={{ border: '1px solid #000', padding: '10px 12px', textAlign: 'right', verticalAlign: 'top' }}>{item.remu.toFixed(2)}</td>
                                                    <td style={{ border: '1px solid #000', padding: '10px 12px', textAlign: 'right', verticalAlign: 'top' }}>{item.ta > 0 ? item.ta.toFixed(2) : '-'}</td>
                                                    <td style={{ border: '1px solid #000', padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>{item.amount.toFixed(2)}</td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="no-print" style={{ backgroundColor: '#f1f5f9' }}>
                                                        <td colSpan="7" style={{ border: '1px solid #000', padding: '12px 16px', fontSize: '13px' }}>
                                                            <div style={{ fontWeight: 'bold', color: '#334155', marginBottom: 6 }}>Calculation Breakdown:</div>
                                                            {item.type === 'practical' ? (
                                                                <div>
                                                                    Rate per {item.payment_unit}: <span style={{ fontWeight: 'bold' }}>₹{item.rate_applied?.toFixed(2) || '0.00'}</span> &times; {item.quantity} = <span style={{ fontWeight: 'bold' }}>₹{item.raw_remu?.toFixed(2) || '0.00'}</span>
                                                                    <div style={{ color: '#64748b', marginTop: 4, fontSize: '11px' }}>Title: {item.title_name} | Examiner Type: {item.examiner_type}</div>
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    Rate per Paper: <span style={{ fontWeight: 'bold' }}>₹{item.rate_applied?.toFixed(2) || '0.00'}</span> &times; {item.num_papers} papers = <span style={{ fontWeight: 'bold' }}>₹{item.raw_remu?.toFixed(2) || '0.00'}</span>
                                                                    <div style={{ color: '#64748b', marginTop: 4, fontSize: '11px' }}>Activity: {item.activity_type}</div>
                                                                </div>
                                                            )}
                                                            {item.minimum_applied && (
                                                                <div style={{ color: '#ea580c', marginTop: 6, fontWeight: 'bold' }}>
                                                                    &rarr; Minimum ₹100 floor enforced. Final Remuneration = ₹{item.remu.toFixed(2)}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                    <tr>
                                        <td colSpan="6" style={{ border: '1px solid #000', padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Total Amount</td>
                                        <td style={{ border: '1px solid #000', padding: '12px', textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #000' }}>{moderatorTotal.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    );
                })}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontWeight: 'bold', padding: '0 20px', pageBreakInside: 'avoid' }}>
                    <div style={{ textAlign: 'center', width: '30%' }}>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>Name & Signature of Moderator</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '30%' }}>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>Incharge Exam Section</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '30%' }}>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>Principal</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
