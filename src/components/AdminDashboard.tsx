import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, Loader2, Shield, ShieldCheck, User, Trash2, BadgeCheck, BadgeX, Crown, Briefcase, Users } from "lucide-react";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import { UserBadges, BadgeType, badgeConfig } from "@/components/UserBadges";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserProfile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: string | null;
  created_at: string;
  roles: AppRole[];
  is_verified: boolean;
  badges: BadgeType[];
}

interface RevokeConfirmation {
  userId: string;
  role: AppRole;
  displayName: string;
}

interface DeleteConfirmation {
  userId: string;
  displayName: string;
  username: string;
}

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [revokeConfirmation, setRevokeConfirmation] = useState<RevokeConfirmation | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin === true) {
      loadAllUsers();
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Authentication required");
        navigate("/auth");
        return;
      }

      setCurrentUserId(user.id);

      // Check admin role using the has_role function
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data === true);
        
        if (data !== true) {
          toast.error("Unauthorized: Admin access required");
        }
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    } finally {
      setCheckingAdmin(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url, status, created_at, is_verified')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch all user badges
      const { data: userBadges, error: badgesError } = await supabase
        .from('user_badges')
        .select('user_id, badge');

      if (badgesError) throw badgesError;

      // Combine profiles with their roles and badges
      const usersWithRolesAndBadges = (profiles || []).map(profile => ({
        ...profile,
        is_verified: profile.is_verified ?? false,
        roles: (roles || [])
          .filter(r => r.user_id === profile.user_id)
          .map(r => r.role),
        badges: (userBadges || [])
          .filter(b => b.user_id === profile.user_id)
          .map(b => b.badge as BadgeType)
      }));

      setUsers(usersWithRolesAndBadges);
    } catch (error: any) {
      toast.error("Failed to load users: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: !currentStatus })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(currentStatus ? "Verification removed" : "User verified successfully");
      loadAllUsers();
    } catch (error: any) {
      toast.error("Failed to update verification: " + error.message);
    }
  };

  const grantBadge = async (userId: string, badge: BadgeType) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('user_badges')
        .insert({ user_id: userId, badge, granted_by: user?.id });

      if (error) {
        if (error.code === '23505') {
          toast.error("User already has this badge");
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Badge "${badge}" granted successfully`);
      loadAllUsers();
    } catch (error: any) {
      toast.error("Failed to grant badge: " + error.message);
    }
  };

  const revokeBadge = async (userId: string, badge: BadgeType) => {
    try {
      const { error } = await supabase
        .from('user_badges')
        .delete()
        .eq('user_id', userId)
        .eq('badge', badge);

      if (error) throw error;

      toast.success(`Badge "${badge}" revoked successfully`);
      loadAllUsers();
    } catch (error: any) {
      toast.error("Failed to revoke badge: " + error.message);
    }
  };

  const grantRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) {
        if (error.code === '23505') {
          toast.error("User already has this role");
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Role "${role}" granted successfully`);
      loadAllUsers();
    } catch (error: any) {
      toast.error("Failed to grant role: " + error.message);
    }
  };

  const handleRoleClick = (userId: string, role: AppRole, displayName: string) => {
    if (role === 'admin') {
      setRevokeConfirmation({ userId, role, displayName });
    } else {
      revokeRole(userId, role);
    }
  };

  const revokeRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      toast.success(`Role "${role}" revoked successfully`);
      setRevokeConfirmation(null);
      loadAllUsers();
    } catch (error: any) {
      toast.error("Failed to revoke role: " + error.message);
    }
  };

  const deleteUser = async (userId: string) => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      toast.success("User deleted successfully");
      setDeleteConfirmation(null);
      loadAllUsers();
    } catch (error: any) {
      toast.error("Failed to delete user: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return <ShieldAlert className="h-3 w-3" />;
      case 'moderator':
        return <ShieldCheck className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  // Show loading while checking admin status
  if (checkingAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Verifying admin access...</span>
        </CardContent>
      </Card>
    );
  }

  // Show unauthorized message if not admin
  if (isAdmin === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You do not have permission to access the Admin Dashboard. 
            This area is restricted to administrators only.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show loading while fetching users
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading users...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          All Users ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Badges</TableHead>
              <TableHead>Manage Badges</TableHead>
              <TableHead>Current Roles</TableHead>
              <TableHead>Manage Roles</TableHead>
              <TableHead>Actions</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.user_id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>
                        {user.display_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.display_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">@{user.username}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant={user.is_verified ? "default" : "outline"}
                    size="sm"
                    className={user.is_verified 
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                    }
                    onClick={() => toggleVerification(user.user_id, user.is_verified)}
                    title={user.is_verified ? "Click to remove verification" : "Click to verify user"}
                  >
                    {user.is_verified ? (
                      <>
                        <BadgeCheck className="h-4 w-4 mr-1" />
                        Verified
                      </>
                    ) : (
                      <>
                        <BadgeX className="h-4 w-4 mr-1" />
                        Unverified
                      </>
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.badges.length > 0 ? (
                      user.badges.map((badge) => {
                        const config = badgeConfig[badge];
                        const Icon = config.icon === Crown ? Crown : config.icon === Briefcase ? Briefcase : Users;
                        return (
                          <Badge
                            key={badge}
                            className={`flex items-center gap-1 cursor-pointer hover:opacity-80 ${config.bgColor} ${config.textColor} border-0`}
                            onClick={() => revokeBadge(user.user_id, badge)}
                            title="Click to revoke"
                          >
                            <Icon className="h-3 w-3" />
                            {badge}
                            <span className="ml-1 text-xs">×</span>
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">No badges</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    onValueChange={(value) => grantBadge(user.user_id, value as BadgeType)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Add badge" />
                    </SelectTrigger>
                    <SelectContent>
                      {!user.badges.includes('premium') && (
                        <SelectItem value="premium">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-500" />
                            Premium
                          </div>
                        </SelectItem>
                      )}
                      {!user.badges.includes('staff') && (
                        <SelectItem value="staff">
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-blue-500" />
                            Staff
                          </div>
                        </SelectItem>
                      )}
                      {!user.badges.includes('partner') && (
                        <SelectItem value="partner">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-500" />
                            Partner
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <Badge
                          key={role}
                          variant={getRoleBadgeVariant(role)}
                          className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                          onClick={() => handleRoleClick(user.user_id, role, user.display_name)}
                          title="Click to revoke"
                        >
                          {getRoleIcon(role)}
                          {role}
                          <span className="ml-1 text-xs">×</span>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No roles</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    onValueChange={(value) => grantRole(user.user_id, value as AppRole)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Add role" />
                    </SelectTrigger>
                    <SelectContent>
                      {!user.roles.includes('admin') && (
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4" />
                            Admin
                          </div>
                        </SelectItem>
                      )}
                      {!user.roles.includes('moderator') && (
                        <SelectItem value="moderator">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            Moderator
                          </div>
                        </SelectItem>
                      )}
                      {!user.roles.includes('user') && (
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            User
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteConfirmation({
                      userId: user.user_id,
                      displayName: user.display_name,
                      username: user.username
                    })}
                    disabled={user.user_id === currentUserId}
                    title={user.user_id === currentUserId ? "Cannot delete yourself" : "Delete user"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <AlertDialog open={!!revokeConfirmation} onOpenChange={() => setRevokeConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Revoke Admin Access
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke admin access from{" "}
              <span className="font-semibold">{revokeConfirmation?.displayName}</span>?
              This action will remove their administrative privileges immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (revokeConfirmation) {
                  revokeRole(revokeConfirmation.userId, revokeConfirmation.role);
                }
              }}
            >
              Revoke Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirmation} onOpenChange={() => setDeleteConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete User Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to permanently delete the account for{" "}
                <span className="font-semibold">{deleteConfirmation?.displayName}</span>{" "}
                (@{deleteConfirmation?.username})?
              </p>
              <p className="text-destructive font-medium">
                This action cannot be undone. All user data will be permanently removed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmation) {
                  deleteUser(deleteConfirmation.userId);
                }
              }}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
