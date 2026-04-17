import { useEffect, useMemo, useState } from 'react';
import { Activity, Funnel, Search, ShieldCheck } from 'lucide-react';
import api from '../../api';
import Alert from '../../components/Alert';

const KNOWN_ENTITY_TYPES = [
    'auth',
    'users',
    'staff-roles',
    'categories',
    'titles',
    'examiner-types',
    'payment-units',
    'remuneration-rates',
    'theory-rates',
    'rules',
    'branches',
    'branch-config',
    'rooms',
    'curriculum',
    'seating',
    'supervision',
    'voucher',
    'audit-logs'
];

const KNOWN_ACTION_TYPES = ['create', 'update', 'delete', 'login', 'view'];

function fmtDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
}

function prettyJson(value) {
    if (!value) return '{}';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function actionBadgeClass(actionType) {
    const key = String(actionType || '').toLowerCase();
    if (key === 'create') return 'badge-action-create';
    if (key === 'update') return 'badge-action-update';
    if (key === 'delete') return 'badge-action-delete';
    if (key === 'login') return 'badge-action-login';
    return 'badge-action-default';
}

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

function titleCase(value) {
    const text = String(value || '').replace(/[-_]+/g, ' ').trim();
    if (!text) return '-';
    return text
        .split(' ')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function displayValue(value) {
    if (value === null || typeof value === 'undefined' || value === '') return '-';
    if (typeof value === 'object') return prettyJson(value);
    return String(value);
}

export default function AuditLogs() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [actionTypes, setActionTypes] = useState([]);
    const [entityTypes, setEntityTypes] = useState([]);

    const [searchInput, setSearchInput] = useState('');
    const [draftFilters, setDraftFilters] = useState({
        actionType: '',
        entityType: '',
        outcome: '',
        fromDateTime: '',
        toDateTime: '',
        sortBy: '',
        sortOrder: ''
    });
    const [appliedFilters, setAppliedFilters] = useState({
        search: '',
        actionType: '',
        entityType: '',
        outcome: '',
        fromDateTime: '',
        toDateTime: '',
        sortBy: '',
        sortOrder: ''
    });

    const [hiddenEntityTypes, setHiddenEntityTypes] = useState(['audit-logs']);
    const [hiddenActionTypes, setHiddenActionTypes] = useState(['view']);

    const [selectedLog, setSelectedLog] = useState(null);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

    useEffect(() => {
        async function loadMeta() {
            try {
                const result = await api.get('/audit-logs/meta');
                setActionTypes(result.data?.actionTypes || []);
                setEntityTypes(result.data?.entityTypes || []);
            } catch {
                // Keep page usable even if metadata fails.
            }
        }

        loadMeta();
    }, []);

    useEffect(() => {
        async function loadLogs() {
            setLoading(true);
            setError('');
            try {
                const result = await api.get('/audit-logs', {
                    params: {
                        page,
                        pageSize,
                        search: appliedFilters.search || undefined,
                        actionType: appliedFilters.actionType || undefined,
                        entityType: appliedFilters.entityType || undefined,
                        outcome: appliedFilters.outcome || undefined,
                        fromDateTime: appliedFilters.fromDateTime || undefined,
                        toDateTime: appliedFilters.toDateTime || undefined,
                        sortBy: appliedFilters.sortBy || undefined,
                        sortOrder: appliedFilters.sortOrder || undefined
                    }
                });
                setRows(result.data?.rows || []);
                setTotal(result.data?.total || 0);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load audit logs.');
            } finally {
                setLoading(false);
            }
        }

        loadLogs();
    }, [page, pageSize, appliedFilters]);

    async function openDetail(auditId) {
        setError('');
        try {
            const result = await api.get(`/audit-logs/${auditId}`);
            setSelectedLog(result.data || null);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load audit detail.');
        }
    }

    function resetFilters() {
        setPage(1);
        setSearchInput('');
        setDraftFilters({ actionType: '', entityType: '', outcome: '', fromDateTime: '', toDateTime: '', sortBy: '', sortOrder: '' });
        setAppliedFilters({ search: '', actionType: '', entityType: '', outcome: '', fromDateTime: '', toDateTime: '', sortBy: '', sortOrder: '' });
        setHiddenEntityTypes(['audit-logs']);
        setHiddenActionTypes(['view']);
    }

    function applyFilters() {
        setPage(1);
        setAppliedFilters({
            search: searchInput,
            actionType: draftFilters.actionType,
            entityType: draftFilters.entityType,
            outcome: draftFilters.outcome,
            fromDateTime: draftFilters.fromDateTime,
            toDateTime: draftFilters.toDateTime,
            sortBy: draftFilters.sortBy,
            sortOrder: draftFilters.sortOrder
        });
    }

    function applySort(columnKey) {
        setPage(1);
        setAppliedFilters((prev) => {
            let nextSortBy = columnKey;
            let nextSortOrder = 'asc';

            if (prev.sortBy === columnKey && prev.sortOrder === 'asc') {
                nextSortOrder = 'desc';
            } else if (prev.sortBy === columnKey && prev.sortOrder === 'desc') {
                nextSortBy = '';
                nextSortOrder = '';
            }

            const next = { ...prev, sortBy: nextSortBy, sortOrder: nextSortOrder };
            setDraftFilters((draft) => ({ ...draft, sortBy: next.sortBy, sortOrder: next.sortOrder }));
            return next;
        });
    }

    function sortArrow(columnKey) {
        if (appliedFilters.sortBy !== columnKey) return '↕';
        return appliedFilters.sortOrder === 'asc' ? '↑' : '↓';
    }

    function toggleHiddenEntity(entity) {
        const key = normalizeKey(entity);
        setHiddenEntityTypes((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    }

    function toggleHiddenAction(action) {
        const key = normalizeKey(action);
        setHiddenActionTypes((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    }

    const entityCandidates = useMemo(() => {
        const merged = new Set([...KNOWN_ENTITY_TYPES, ...entityTypes, ...rows.map((r) => r.entity_type)]);
        return Array.from(merged).filter(Boolean).sort((a, b) => a.localeCompare(b));
    }, [entityTypes, rows]);

    const actionCandidates = useMemo(() => {
        const merged = new Set([...KNOWN_ACTION_TYPES, ...actionTypes, ...rows.map((r) => r.action_type)]);
        return Array.from(merged).filter(Boolean).sort((a, b) => a.localeCompare(b));
    }, [actionTypes, rows]);

    const visibleRows = useMemo(() => {
        return rows.filter((r) => {
            const entityKey = normalizeKey(r.entity_type);
            const actionKey = normalizeKey(r.action_type);
            return !hiddenEntityTypes.includes(entityKey) && !hiddenActionTypes.includes(actionKey);
        });
    }, [rows, hiddenActionTypes, hiddenEntityTypes]);

    return (
        <div className="voucher-container audit-logs-page">
            <div className="page-header">
                <div>
                    <div className="page-title"><ShieldCheck size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Audit Logs</div>
                    <div className="page-subtitle">Track user actions, outcomes, and system events in a structured timeline.</div>
                </div>
            </div>

            {error && <Alert type="error">{error}</Alert>}

            <div className="card audit-filter-card" style={{ marginBottom: 14 }}>
                <div className="audit-filters-topline">
                    <div className="audit-filters-title"><Funnel size={16} /> Filters</div>
                    <div className="audit-total">Total Records: {total}</div>
                </div>

                <div className="audit-filters-grid audit-filters-grid-two">
                    <div className="form-group">
                        <label className="form-label">Action Type</label>
                        <select
                            className="form-control"
                            value={draftFilters.actionType}
                            onChange={(e) => setDraftFilters((prev) => ({ ...prev, actionType: e.target.value }))}
                        >
                            <option value="">All</option>
                            {actionTypes.map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Entity Type</label>
                        <select
                            className="form-control"
                            value={draftFilters.entityType}
                            onChange={(e) => setDraftFilters((prev) => ({ ...prev, entityType: e.target.value }))}
                        >
                            <option value="">All</option>
                            {entityCandidates.map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}
                        </select>
                    </div>
                </div>

                <div className="audit-filters-grid audit-filters-grid-two">
                    <div className="form-group">
                        <label className="form-label">Outcome</label>
                        <select
                            className="form-control"
                            value={draftFilters.outcome}
                            onChange={(e) => setDraftFilters((prev) => ({ ...prev, outcome: e.target.value }))}
                        >
                            <option value="">All</option>
                            <option value="success">Success</option>
                            <option value="failure">Failure</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Search</label>
                        <div className="audit-search-wrap">
                            <input
                                className="form-control"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') applyFilters();
                                }}
                                placeholder="User, action, entity, summary"
                            />
                            <button type="button" className="btn btn-secondary audit-search-btn" onClick={applyFilters}>
                                <Search size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="audit-filters-grid audit-filters-grid-two">
                    <div className="form-group">
                        <label className="form-label">From Date & Time</label>
                        <input
                            type="datetime-local"
                            className="form-control"
                            value={draftFilters.fromDateTime}
                            onChange={(e) => setDraftFilters((prev) => ({ ...prev, fromDateTime: e.target.value }))}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">To Date & Time</label>
                        <input
                            type="datetime-local"
                            className="form-control"
                            value={draftFilters.toDateTime}
                            onChange={(e) => setDraftFilters((prev) => ({ ...prev, toDateTime: e.target.value }))}
                        />
                    </div>
                </div>

                <div className="audit-hidden-box">
                    <div className="audit-hidden-title">Hidden Categories (Not shown in results)</div>
                    <div className="audit-chip-row">
                        {entityCandidates.map((entity) => {
                            const key = normalizeKey(entity);
                            const hidden = hiddenEntityTypes.includes(key);
                            return (
                                <button
                                    key={entity}
                                    type="button"
                                    className={`audit-chip ${hidden ? 'hidden' : 'shown'}`}
                                    onClick={() => toggleHiddenEntity(entity)}
                                >
                                    {hidden ? 'Hidden:' : 'Show:'} {titleCase(entity)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="audit-hidden-box">
                    <div className="audit-hidden-title">Hidden Action Types</div>
                    <div className="audit-chip-row">
                        {actionCandidates.map((action) => {
                            const key = normalizeKey(action);
                            const hidden = hiddenActionTypes.includes(key);
                            return (
                                <button
                                    key={action}
                                    type="button"
                                    className={`audit-chip ${hidden ? 'hidden' : 'shown'}`}
                                    onClick={() => toggleHiddenAction(action)}
                                >
                                    {hidden ? 'Hidden:' : 'Show:'} {titleCase(action)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="audit-filters-actions">
                    <button type="button" className="btn btn-secondary" onClick={resetFilters}>Reset Filters</button>
                    <button type="button" className="btn btn-primary" onClick={applyFilters}>Apply</button>
                </div>
            </div>

            <div className="card">
                <div className="audit-table-title"><Activity size={16} /> Recent Activity</div>
                {loading ? (
                    <div style={{ padding: 16 }}>Loading audit logs...</div>
                ) : visibleRows.length === 0 ? (
                    <div style={{ padding: 16 }}>No audit logs found for current filters.</div>
                ) : (
                    <div className="table-wrap">
                        <table className="table audit-table">
                            <colgroup>
                                <col style={{ width: '210px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ minWidth: '360px' }} />
                                <col style={{ width: '90px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => applySort('occurred_at')}>
                                            When {sortArrow('occurred_at')}
                                        </button>
                                    </th>
                                    <th>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => applySort('actor_username')}>
                                            User {sortArrow('actor_username')}
                                        </button>
                                    </th>
                                    <th>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => applySort('action_type')}>
                                            Action {sortArrow('action_type')}
                                        </button>
                                    </th>
                                    <th>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => applySort('entity_type')}>
                                            Entity {sortArrow('entity_type')}
                                        </button>
                                    </th>
                                    <th>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => applySort('outcome')}>
                                            Outcome {sortArrow('outcome')}
                                        </button>
                                    </th>
                                    <th>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => applySort('change_summary')}>
                                            Summary {sortArrow('change_summary')}
                                        </button>
                                    </th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((r) => (
                                    <tr key={r.audit_id}>
                                        <td className="audit-cell-when">{fmtDate(r.occurred_at)}</td>
                                        <td>{r.actor_username || '-'}</td>
                                        <td>
                                            <span className={`badge ${actionBadgeClass(r.action_type)}`}>
                                                {titleCase(r.action_type)}
                                            </span>
                                        </td>
                                        <td>{titleCase(r.entity_type)}{r.entity_id ? ` #${r.entity_id}` : ''}</td>
                                        <td>
                                            <span className={`badge ${String(r.outcome || '').toLowerCase() === 'success' ? 'badge-success' : 'badge-danger'}`}>
                                                {r.outcome || '-'}
                                            </span>
                                        </td>
                                        <td className="audit-cell-summary">{r.change_summary || '-'}</td>
                                        <td>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openDetail(r.audit_id)}>View</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="audit-pagination-row">
                    <div>Page {page} of {totalPages} ({total} records)</div>
                    <div className="audit-pagination-actions">
                        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                    </div>
                </div>
            </div>

            {selectedLog && (
                <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
                    <div className="card audit-detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="audit-detail-header">
                            <h3>Audit Detail #{selectedLog.audit_id}</h3>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>Close</button>
                        </div>
                        <div className="audit-detail-content">
                            <div className="audit-detail-sections">
                                <section className="audit-detail-section">
                                    <h4>What Happened</h4>
                                    <div className="audit-kv-grid">
                                        <div className="audit-kv-item"><span>Time</span><strong>{fmtDate(selectedLog.occurred_at)}</strong></div>
                                        <div className="audit-kv-item"><span>Action</span><strong>{titleCase(selectedLog.action_type)}</strong></div>
                                        <div className="audit-kv-item"><span>Entity</span><strong>{titleCase(selectedLog.entity_type)}{selectedLog.entity_id ? ` #${selectedLog.entity_id}` : ''}</strong></div>
                                        <div className="audit-kv-item"><span>Outcome</span><strong>{titleCase(selectedLog.outcome)}</strong></div>
                                        <div className="audit-kv-item audit-kv-item-full"><span>Summary</span><strong>{displayValue(selectedLog.change_summary)}</strong></div>
                                    </div>
                                </section>

                                <section className="audit-detail-section">
                                    <h4>Who Triggered It</h4>
                                    <div className="audit-kv-grid">
                                        <div className="audit-kv-item"><span>User</span><strong>{displayValue(selectedLog.actor_username)}</strong></div>
                                        <div className="audit-kv-item"><span>Role</span><strong>{titleCase(selectedLog.actor_role)}</strong></div>
                                        <div className="audit-kv-item"><span>User ID</span><strong>{displayValue(selectedLog.actor_user_id)}</strong></div>
                                        <div className="audit-kv-item"><span>Request ID</span><strong>{displayValue(selectedLog.request_id)}</strong></div>
                                    </div>
                                </section>

                                <section className="audit-detail-section">
                                    <h4>Request Context</h4>
                                    <div className="audit-kv-grid">
                                        <div className="audit-kv-item audit-kv-item-full"><span>Endpoint</span><strong>{displayValue(selectedLog.endpoint)}</strong></div>
                                        <div className="audit-kv-item"><span>Status Code</span><strong>{displayValue(selectedLog.status_code)}</strong></div>
                                        <div className="audit-kv-item"><span>IP Address</span><strong>{displayValue(selectedLog.ip_address)}</strong></div>
                                        <div className="audit-kv-item audit-kv-item-full"><span>User Agent</span><strong>{displayValue(selectedLog.user_agent)}</strong></div>
                                    </div>
                                </section>

                                <section className="audit-detail-section">
                                    <h4>Payload Details</h4>
                                    <div className="audit-kv-grid">
                                        <div className="audit-kv-item audit-kv-item-full">
                                            <span>Request Metadata</span>
                                            <pre className="audit-detail-json small">{prettyJson(selectedLog.metadata || {})}</pre>
                                        </div>
                                        <div className="audit-kv-item audit-kv-item-full">
                                            <span>New Values</span>
                                            <pre className="audit-detail-json small">{prettyJson(selectedLog.new_values || {})}</pre>
                                        </div>
                                        <div className="audit-kv-item audit-kv-item-full">
                                            <span>Old Values</span>
                                            <pre className="audit-detail-json small">{prettyJson(selectedLog.old_values || {})}</pre>
                                        </div>
                                    </div>
                                </section>

                                <details className="audit-raw-toggle">
                                    <summary>View Raw JSON</summary>
                                    <pre className="audit-detail-json">{prettyJson(selectedLog)}</pre>
                                </details>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
