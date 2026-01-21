import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { GlobalIncomingCallListener } from "@/components/GlobalIncomingCallListener";
import { prefetchCriticalRoutes } from "@/hooks/useRoutePrefetch";
// Lazy load all page components for code-splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Meetings = lazy(() => import("./pages/Meetings"));
const MeetingDetails = lazy(() => import("./pages/MeetingDetails"));
const VoiceProfiles = lazy(() => import("./pages/VoiceProfiles"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const SharedDocument = lazy(() => import("./pages/SharedDocument"));
const Install = lazy(() => import("./pages/Install"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  // Prefetch critical routes when the app loads
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(() => prefetchCriticalRoutes(), { timeout: 2000 });
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(prefetchCriticalRoutes, 2000);
      return () => clearTimeout(id);
    }
  }, []);

  return (
    <>
      <GlobalIncomingCallListener />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meetings"
            element={
              <ProtectedRoute>
                <Meetings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meeting/:meetingId"
            element={
              <ProtectedRoute>
                <MeetingDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/voice-profiles"
            element={
              <ProtectedRoute>
                <VoiceProfiles />
              </ProtectedRoute>
            }
          />
          <Route path="/profile/:username" element={<PublicProfile />} />
          <Route path="/shared-document" element={<SharedDocument />} />
          <Route path="/install" element={<Install />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
