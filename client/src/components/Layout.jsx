import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, LayoutGrid, Building2, Users, LogOut, ChevronLeft, GraduationCap, CalendarDays, BookOpen, ClipboardCheck, ShieldCheck } from 'lucide-react';
import AccountSettings from './AccountSettings';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
    const navigate = useNavigate();
    const { user, hasPermission, isAdminAccount } = useAuth();
    const isAdmin = isAdminAccount;
    const canManageStaff = hasPermission('manage_staff');
    const canCreateVouchers = hasPermission('create_vouchers');
    const canViewSeating = hasPermission('view_seating');
    const canViewTimetable = hasPermission('view_timetable');
    const canCurriculumSettings = hasPermission('curriculum_settings');
    const canViewSupervision = hasPermission('view_supervision');
    const canSystemSettings = hasPermission('system_settings');
    const canConfigureRoles = hasPermission('configure_roles');
    const canViewAuditLogs = hasPermission('view_audit_logs');
    const showAdminPanel = isAdmin || canManageStaff;
    const [showSettings, setShowSettings] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
    const sidebarExpanded = !isSidebarCollapsed;
    const expandedSidebarWidth = 200;
    const collapsedSidebarWidth = 72;

    const remunerationNavItems = [
        ...(canCreateVouchers
            ? [{ to: '/', icon: <FileText size={18} />, label: 'Voucher Generator', exact: true }]
            : [])
    ];

    const examinationNavItems = [
        ...(canViewTimetable ? [{ to: '/internal-timetable', icon: <CalendarDays size={18} />, label: 'Internal Timetable' }] : []),
        ...(canViewSeating ? [{ to: '/seating', icon: <LayoutGrid size={18} />, label: 'Seating Arrangement' }] : []),
        ...(canViewSupervision ? [{ to: '/supervision-allotments', icon: <ClipboardCheck size={18} />, label: 'Supervision Allotments' }] : [])
    ];

    const adminNavItems = [
        ...((isAdmin || canSystemSettings) ? [{ to: '/admin/voucher-config', icon: <FileText size={18} />, label: 'Voucher Config' }] : []),
        ...((isAdmin || canCurriculumSettings) ? [{ to: '/admin/curriculum-settings', icon: <BookOpen size={18} />, label: 'Curriculum Settings' }] : []),
        ...((isAdmin || canSystemSettings) ? [{ to: '/admin/branches', icon: <GraduationCap size={18} />, label: 'Branches' }] : []),
        ...((isAdmin || canSystemSettings) ? [{ to: '/admin/rooms', icon: <Building2 size={18} />, label: 'Campus Rooms' }] : []),
        ...(isAdmin ? [{ to: '/admin/users', icon: <Users size={18} />, label: 'Users' }] : []),
        ...((isAdmin || canManageStaff || canConfigureRoles) ? [{ to: '/admin/staff-roles', icon: <Users size={18} />, label: 'Staff & Roles' }] : []),
        ...(canViewAuditLogs ? [{ to: '/admin/audit-logs', icon: <ShieldCheck size={18} />, label: 'Audit Logs' }] : [])
    ];

    const totalNavItems = remunerationNavItems.length + examinationNavItems.length + (showAdminPanel ? adminNavItems.length : 0);
    const densityClass = totalNavItems >= 8
        ? 'sidebar-density-dense'
        : totalNavItems >= 6
            ? 'sidebar-density-compact'
            : 'sidebar-density-normal';

    const springTransition = {
        type: 'spring',
        stiffness: 300,
        damping: 20,
        mass: 0.9
    };

    const navRevealTransition = {
        duration: 0.24,
        ease: [0.22, 1, 0.36, 1]
    };

    const sectionRevealTransition = {
        duration: 0.34,
        ease: [0.22, 1, 0.36, 1]
    };

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', String(isSidebarCollapsed));
        document.documentElement.setAttribute('data-sidebar-state', isSidebarCollapsed ? 'collapsed' : 'expanded');
    }, [isSidebarCollapsed]);

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    }

    const navItem = (item, index) => (
        <NavLink
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={item.label}
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <motion.span
                            className="nav-active-fill"
                            initial={false}
                            animate={{ scaleX: sidebarExpanded ? 1 : 0.34 }}
                            transition={springTransition}
                        />
                    )}
                    <span className="nav-icon">{item.icon}</span>
                    <AnimatePresence initial={false}>
                        {sidebarExpanded && (
                            <motion.span
                                className="nav-label"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                transition={{ ...navRevealTransition, delay: index * 0.04 }}
                            >
                                {item.label}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </>
            )}
        </NavLink>
    );

    return (
        <div className="app-shell">
            <motion.aside
                className={`sidebar ${densityClass} ${isSidebarCollapsed ? 'collapsed' : ''}`}
                initial={false}
                animate={{
                    width: sidebarExpanded ? expandedSidebarWidth : collapsedSidebarWidth,
                    minWidth: sidebarExpanded ? expandedSidebarWidth : collapsedSidebarWidth,
                    maxWidth: sidebarExpanded ? expandedSidebarWidth : collapsedSidebarWidth,
                    flexBasis: sidebarExpanded ? expandedSidebarWidth : collapsedSidebarWidth
                }}
                transition={springTransition}
            >
                <div className="sidebar-logo">
                    <motion.div
                        className="sidebar-logo-lockup"
                        aria-label="A C Patil College of Engineering"
                        initial={false}
                        animate={{ gap: sidebarExpanded ? 10 : 0, justifyContent: sidebarExpanded ? 'flex-start' : 'center' }}
                        transition={springTransition}
                    >
                        <motion.img
                            src="/ACPCE_logo_resized.png"
                            alt="ACPCE Logo"
                            className="sidebar-logo-mark"
                            initial={false}
                            animate={{ scale: sidebarExpanded ? 1 : 0.92, borderRadius: sidebarExpanded ? 6 : 12 }}
                            transition={springTransition}
                        />
                        <AnimatePresence initial={false}>
                            {sidebarExpanded && (
                                <motion.div
                                    className="sidebar-logo-text"
                                    initial={{ opacity: 0, x: -8, filter: 'blur(8px)' }}
                                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, x: -6, filter: 'blur(8px)' }}
                                    transition={{ ...navRevealTransition, delay: 0.08 }}
                                >
                                    <div className="sidebar-logo-title">A C Patil</div>
                                    <div className="sidebar-logo-subtitle">
                                        <span className="subtitle-regular">College</span>
                                        <span className="subtitle-italic">of</span>
                                        <span className="subtitle-regular">Engineering</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                    <motion.button
                        type="button"
                        className="sidebar-toggle"
                        onClick={() => setIsSidebarCollapsed(prev => !prev)}
                        aria-label={isSidebarCollapsed ? 'Expand navigation panel' : 'Collapse navigation panel'}
                        title={isSidebarCollapsed ? 'Expand' : 'Collapse'}
                        initial={false}
                        animate={{ rotate: sidebarExpanded ? 0 : 180, x: sidebarExpanded ? -2 : 2 }}
                        transition={springTransition}
                    >
                        <ChevronLeft size={18} />
                    </motion.button>
                </div>
                <nav className="sidebar-nav">
                    {remunerationNavItems.length > 0 && (
                        <>
                            <AnimatePresence initial={false}>
                                {sidebarExpanded && (
                                    <motion.div
                                        className="nav-section-label"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -6 }}
                                        transition={{ ...sectionRevealTransition, delay: 0.08 }}
                                    >
                                        Remuneration
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            {remunerationNavItems.map((item, index) => navItem(item, index))}
                        </>
                    )}

                    {examinationNavItems.length > 0 && (
                        <>
                            <AnimatePresence initial={false}>
                                {sidebarExpanded && (
                                    <motion.div
                                        className="nav-section-label"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -6 }}
                                        transition={{ ...sectionRevealTransition, delay: remunerationNavItems.length * 0.04 + 0.12 }}
                                    >
                                        Examination
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            {examinationNavItems.map((item, index) => navItem(item, remunerationNavItems.length + index))}
                        </>
                    )}

                    {showAdminPanel && adminNavItems.length > 0 && (
                        <>
                            <AnimatePresence initial={false}>
                                {sidebarExpanded && (
                                    <motion.div
                                        className="nav-section-label"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -6 }}
                                        transition={{ ...sectionRevealTransition, delay: (remunerationNavItems.length + examinationNavItems.length) * 0.04 + 0.16 }}
                                    >
                                        Configuration
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            {adminNavItems.map((item, index) => navItem(item, remunerationNavItems.length + examinationNavItems.length + index))}
                        </>
                    )}
                </nav>
                <div className="sidebar-footer">
                    <button 
                        className="user-info-btn" 
                        onClick={() => setShowSettings(true)}
                        title="Account Settings"
                    >
                        <div className="user-avatar">{user.username?.[0]?.toUpperCase() || 'U'}</div>
                        <div className="user-meta">
                            <div className="user-name">{user.username}</div>
                            <div className="user-role">{user.role}</div>
                        </div>
                    </button>
                    <button 
                        className="btn btn-secondary btn-sm btn-logout" 
                        onClick={logout}
                        title="Logout"
                    >
                        <span className="logout-icon"><LogOut size={16} /></span>
                        <span className="logout-label">Logout</span>
                    </button>
                </div>
            </motion.aside>
            <main className="main-content">
                <Outlet />
            </main>
            <AccountSettings
                user={user}
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </div>
    );
}

