import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { initNativePlugins } from "@/lib/native";
import { ModeProvider } from "@/contexts/ModeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import HelpWidget from "./components/HelpWidget";

// Lazy-loaded routes — split into per-route chunks to speed initial load
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ModeSelectPage = lazy(() => import("./pages/ModeSelectPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const BrowseProfilesPage = lazy(() => import("./pages/BrowseProfilesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SuspendedPage = lazy(() => import("./pages/SuspendedPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const SitePage = lazy(() => import("./pages/SitePage"));
const DownloadPage = lazy(() => import("./pages/DownloadPage"));
const BrowseGroupsPage = lazy(() => import("./pages/BrowseGroupsPage"));
const CreateGroupRequestPage = lazy(() => import("./pages/CreateGroupRequestPage"));
const GroupRequestDetailPage = lazy(() => import("./pages/GroupRequestDetailPage"));
const MoodRoomsPage = lazy(() => import("./pages/MoodRoomsPage"));

// Admin bundle — separate chunks per page
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminModeration = lazy(() => import("./pages/admin/AdminModeration"));
const AdminChats = lazy(() => import("./pages/admin/AdminChats"));
const AdminTickets = lazy(() => import("./pages/admin/AdminTickets"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminPages = lazy(() => import("./pages/admin/AdminPages"));
const AdminPaymentInfo = lazy(() => import("./pages/admin/AdminPaymentInfo"));
const AdminGroups = lazy(() => import("./pages/admin/AdminGroups"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminMoodRooms = lazy(() => import("./pages/admin/AdminMoodRooms"));
const AdminBlockedEmails = lazy(() => import("./pages/admin/AdminBlockedEmails"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
    Loading…
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.is_suspended) return <Navigate to="/suspended" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminRole();

  if (authLoading || adminLoading) return <RouteFallback />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <BrowserRouter>
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/suspended" element={<SuspendedPage />} />
        <Route path="/mode-select" element={<ProtectedRoute><ModeSelectPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/chats" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/chat/:chatId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/browse" element={<ProtectedRoute><BrowseProfilesPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute><BrowseGroupsPage /></ProtectedRoute>} />
        <Route path="/groups/new" element={<ProtectedRoute><CreateGroupRequestPage /></ProtectedRoute>} />
        <Route path="/groups/:id" element={<ProtectedRoute><GroupRequestDetailPage /></ProtectedRoute>} />
        <Route path="/mood-rooms" element={<ProtectedRoute><MoodRoomsPage /></ProtectedRoute>} />
        {/* Public pages */}
        <Route path="/page/:slug" element={<SitePage />} />
        <Route path="/download" element={<DownloadPage />} />
        {/* Legacy redirect */}
        <Route path="/unlock-dark-mode" element={<Navigate to="/subscription" replace />} />
        {/* Admin routes */}
        <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/moderation" element={<AdminRoute><AdminModeration /></AdminRoute>} />
        <Route path="/admin/chats" element={<AdminRoute><AdminChats /></AdminRoute>} />
        <Route path="/admin/tickets" element={<AdminRoute><AdminTickets /></AdminRoute>} />
        <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
        <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
        <Route path="/admin/pages" element={<AdminRoute><AdminPages /></AdminRoute>} />
        <Route path="/admin/payment-info" element={<AdminRoute><AdminPaymentInfo /></AdminRoute>} />
        <Route path="/admin/groups" element={<AdminRoute><AdminGroups /></AdminRoute>} />
        <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
        <Route path="/admin/mood-rooms" element={<AdminRoute><AdminMoodRooms /></AdminRoute>} />
        <Route path="/admin/blocked-emails" element={<AdminRoute><AdminBlockedEmails /></AdminRoute>} />
        {/* Legacy redirect */}
        <Route path="/admin/payments" element={<Navigate to="/admin/subscriptions" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

const App = () => {
  useEffect(() => {
    initNativePlugins();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ModeProvider>
        <AuthProvider>
          <NotificationProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AppRoutes />
              <HelpWidget />
            </TooltipProvider>
          </NotificationProvider>
        </AuthProvider>
      </ModeProvider>
    </QueryClientProvider>
  );
};

export default App;
