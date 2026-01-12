import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Crown, Briefcase, Users, Loader2, Check, X, Clock, Inbox } from "lucide-react";
import { toast } from "sonner";
import { BadgeType, badgeConfig } from "@/components/UserBadges";

interface BadgeRequest {
  id: string;
  user_id: string;
  badge: BadgeType;
  reason: string | null;
  status: string;
  created_at: string;
  user?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

export const BadgeRequestsAdmin = () => {
  const [requests, setRequests] = useState<BadgeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState<{ request: BadgeRequest } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      // Fetch all pending requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('badge_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (requestsError) throw requestsError;

      if (!requestsData || requestsData.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // Fetch user profiles for the requests
      const userIds = [...new Set(requestsData.map(r => r.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Combine requests with user data
      const requestsWithUsers = requestsData.map(request => ({
        ...request,
        badge: request.badge as BadgeType,
        user: profiles?.find(p => p.user_id === request.user_id)
      }));

      setRequests(requestsWithUsers);
    } catch (error: any) {
      toast.error("Failed to load requests: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (request: BadgeRequest) => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Grant the badge
      const { error: badgeError } = await supabase
        .from('user_badges')
        .insert({
          user_id: request.user_id,
          badge: request.badge,
          granted_by: user?.id
        });

      if (badgeError) {
        if (badgeError.code === '23505') {
          toast.error("User already has this badge");
        } else {
          throw badgeError;
        }
        return;
      }

      // Update request status
      const { error: updateError } = await supabase
        .from('badge_requests')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      toast.success(`Badge "${request.badge}" approved for ${request.user?.display_name}`);
      loadRequests();
    } catch (error: any) {
      toast.error("Failed to approve request: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const rejectRequest = async () => {
    if (!rejectDialog) return;
    
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('badge_requests')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim() || null
        })
        .eq('id', rejectDialog.request.id);

      if (error) throw error;

      toast.success(`Badge request rejected`);
      setRejectDialog(null);
      setRejectionReason("");
      loadRequests();
    } catch (error: any) {
      toast.error("Failed to reject request: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getBadgeIcon = (badge: BadgeType) => {
    switch (badge) {
      case 'premium':
        return <Crown className="h-4 w-4 text-amber-500" />;
      case 'staff':
        return <Briefcase className="h-4 w-4 text-blue-500" />;
      case 'partner':
        return <Users className="h-4 w-4 text-purple-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Badge Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Pending Badge Requests ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No pending badge requests</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Badge Requested</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={request.user?.avatar_url || undefined} />
                          <AvatarFallback>
                            {request.user?.display_name?.substring(0, 2).toUpperCase() || "??"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.user?.display_name}</p>
                          <p className="text-sm text-muted-foreground">@{request.user?.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${badgeConfig[request.badge].bgColor} ${badgeConfig[request.badge].textColor} border-0`}>
                        {getBadgeIcon(request.badge)}
                        <span className="ml-1 capitalize">{request.badge}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground max-w-xs truncate">
                        {request.reason || <span className="italic">No reason provided</span>}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveRequest(request)}
                          disabled={processing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRejectDialog({ request })}
                          disabled={processing}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Badge Request</DialogTitle>
            <DialogDescription>
              Reject the {rejectDialog?.request.badge} badge request from{" "}
              {rejectDialog?.request.user?.display_name}. Optionally provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rejection Reason (Optional)</label>
            <Textarea
              placeholder="Explain why this request is being rejected..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)} disabled={processing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={rejectRequest} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
