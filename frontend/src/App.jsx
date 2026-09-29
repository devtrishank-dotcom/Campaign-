import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Lists from "./pages/Lists";
import Templates from "./pages/Templates";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Surveys from "./pages/Surveys";
import SurveyDetail from "./pages/SurveyDetail";
import Reports from "./pages/Reports";
import Roles from "./pages/Roles";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import Profile from "./pages/Profile";

function Protected({ children, perm }) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return <Spinner label="Checking session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (perm && !hasPermission(perm)) {
    return (
      <div className="card pad">
        <div className="alert err">You don't have permission to view this page.</div>
      </div>
    );
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={loading ? <Spinner /> : user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/contacts" element={<Protected perm="contacts.manage"><Contacts /></Protected>} />
        <Route path="/lists" element={<Protected perm="lists.manage"><Lists /></Protected>} />
        <Route path="/templates" element={<Protected perm="templates.manage"><Templates /></Protected>} />
        <Route path="/campaigns" element={<Protected perm="campaigns.manage"><Campaigns /></Protected>} />
        <Route path="/campaigns/:id" element={<Protected perm="campaigns.manage"><CampaignDetail /></Protected>} />
        <Route path="/surveys" element={<Protected perm="surveys.manage"><Surveys /></Protected>} />
        <Route path="/surveys/:id" element={<Protected perm="surveys.manage"><SurveyDetail /></Protected>} />
        <Route path="/reports" element={<Protected perm="reports.view"><Reports /></Protected>} />
        <Route path="/roles" element={<Protected perm="roles.manage"><Roles /></Protected>} />
        <Route path="/users" element={<Protected perm="users.manage"><Users /></Protected>} />
        <Route path="/settings" element={<Protected perm="settings.manage"><Settings /></Protected>} />
        <Route path="/support" element={<Support />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
