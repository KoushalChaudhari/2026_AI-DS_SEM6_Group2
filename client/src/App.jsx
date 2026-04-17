import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';
import VoucherGenerator from './pages/VoucherGenerator';
import SeatingArrangement from './pages/SeatingArrangement';
import InternalExamTimetable from './pages/InternalExamTimetable';
import Categories from './pages/admin/Categories';
import Titles from './pages/admin/Titles';
import ExaminerTypes from './pages/admin/ExaminerTypes';
import PaymentUnits from './pages/admin/PaymentUnits';
import RemunerationRates from './pages/admin/RemunerationRates';
import TheoryRates from './pages/admin/TheoryRates';
import Users from './pages/admin/Users';
import Rules from './pages/admin/Rules';
import AdminRooms from './pages/admin/AdminRooms';
import Branches from './pages/admin/Branches';
import VoucherConfig from './pages/admin/VoucherConfig';
import CurriculumSettings from './pages/admin/CurriculumSettings';
import StaffRoles from './pages/admin/StaffRoles';
import SupervisionAllotments from './pages/admin/SupervisionAllotments';
import AuditLogs from './pages/admin/AuditLogs';
import Forbidden from './pages/Forbidden';
import { useAuth } from './context/AuthContext';

function RequireAuth({ children }) {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!localStorage.getItem('token')) return <Navigate to="/login" replace />;
    const isAdmin = String(user.role || '').toLowerCase() === 'admin' || String(user.username || '').toLowerCase() === 'admin';
    if (!isAdmin) return <Navigate to="/" replace />;
    return children;
}

function RequirePermission({ permissionKey, children }) {
    const { loading, hasPermission } = useAuth();
    if (!localStorage.getItem('token')) return <Navigate to="/login" replace />;
    if (loading) return null;
    if (!hasPermission(permissionKey)) return <Navigate to="/403" replace />;
    return children;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
                    <Route index element={<RequirePermission permissionKey="create_vouchers"><VoucherGenerator /></RequirePermission>} />
                    <Route path="403" element={<Forbidden />} />
                    <Route path="seating" element={<SeatingArrangement />} />
                    <Route path="internal-timetable" element={<InternalExamTimetable />} />
                    <Route path="supervision-allotments" element={<RequirePermission permissionKey="view_supervision"><SupervisionAllotments /></RequirePermission>} />
                    <Route path="staff-roles" element={<Navigate to="/admin/staff-roles" replace />} />
                    <Route path="admin/staff-roles" element={<RequirePermission permissionKey="manage_staff"><StaffRoles /></RequirePermission>} />
                    <Route path="admin/audit-logs" element={<RequirePermission permissionKey="view_audit_logs"><AuditLogs /></RequirePermission>} />
                    <Route path="admin/voucher-config" element={<RequireAdmin><VoucherConfig /></RequireAdmin>} />
                    <Route path="admin/curriculum-settings" element={<RequirePermission permissionKey="curriculum_settings"><CurriculumSettings /></RequirePermission>} />
                    <Route path="admin/categories" element={<RequireAdmin><Categories /></RequireAdmin>} />
                    <Route path="admin/titles" element={<RequireAdmin><Titles /></RequireAdmin>} />
                    <Route path="admin/examiner-types" element={<RequireAdmin><ExaminerTypes /></RequireAdmin>} />
                    <Route path="admin/payment-units" element={<RequireAdmin><PaymentUnits /></RequireAdmin>} />
                    <Route path="admin/remuneration-rates" element={<RequireAdmin><RemunerationRates /></RequireAdmin>} />
                    <Route path="admin/theory-rates" element={<RequireAdmin><TheoryRates /></RequireAdmin>} />
                    <Route path="admin/rules" element={<RequireAdmin><Rules /></RequireAdmin>} />
                    <Route path="admin/users" element={<RequireAdmin><Users /></RequireAdmin>} />
                    <Route path="admin/rooms" element={<RequireAdmin><AdminRooms /></RequireAdmin>} />
                    <Route path="admin/branches" element={<RequireAdmin><Branches /></RequireAdmin>} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
