import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "captain" | "player";
}

export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { user } = useAuth();

  // If not logged in, redirect to login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If role is required and doesn't match, redirect based on user's role
  if (requiredRole && user.role !== requiredRole) {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (user.role === "captain") return <Navigate to="/captain" replace />;
    if (user.role === "player") return <Navigate to="/player" replace />;
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
