import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Briefcase, Users, Loader2, Clock, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BadgeType, badgeConfig } from "@/components/UserBadges";

interface BadgeRequest {
  id: string;
  badge: BadgeType;
  reason: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

export const BadgeRequestForm = () => {
  const [requests, setRequests] = useState<BadgeRequest[]>([]);
  const [userBadges, setUserBadges] = useState<BadgeType[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | "">("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load existing requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('badge_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Load user's current badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('user_badges')
        .select('badge')
        .eq('user_id', user.id);

      if (badgesError) throw badgesError;

      setRequests((requestsData || []) as BadgeRequest[]);
      setUserBadges((badgesData || []).map(b => b.badge as BadgeType));
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async () => {
    if (!selectedBadge) {
      toast.error("Please select a badge type");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('badge_requests')
        .insert({
          user_id: user.id,
          badge: selectedBadge,
          reason: reason.trim() || null,
          status: 'pending'
        });

      if (error) {
        if (error.code === '23505') {
          toast.error("You already have a pending request for this badge");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Badge request submitted successfully!");
      setSelectedBadge("");
      setReason("");
      loadUserData();
    } catch (error: any) {
      toast.error("Failed to submit request: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('badge_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success("Request cancelled");
      loadUserData();
    } catch (error: any) {
      toast.error("Failed to cancel request: " + error.message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'approved':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  // Get available badges (not already owned and no pending request)
  const availableBadges = (['premium', 'staff', 'partner'] as BadgeType[]).filter(badge => 
    !userBadges.includes(badge) && 
    !requests.some(r => r.badge === badge && r.status === 'pending')
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Request a Badge
        </CardTitle>
        <CardDescription>
          Apply for special badges that showcase your role or status in the community.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Badges */}
        {userBadges.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Your Current Badges</h4>
            <div className="flex flex-wrap gap-2">
              {userBadges.map(badge => {
                const config = badgeConfig[badge];
                return (
                  <Badge key={badge} className={`${config.bgColor} ${config.textColor} border-0`}>
                    {getBadgeIcon(badge)}
                    <span className="ml-1 capitalize">{badge}</span>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Request Form */}
        {availableBadges.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Badge Type</label>
              <Select value={selectedBadge} onValueChange={(value) => setSelectedBadge(value as BadgeType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a badge to request" />
                </SelectTrigger>
                <SelectContent>
                  {availableBadges.includes('premium') && (
                    <SelectItem value="premium">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        Premium - For premium subscribers
                      </div>
                    </SelectItem>
                  )}
                  {availableBadges.includes('partner') && (
                    <SelectItem value="partner">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-purple-500" />
                        Partner - For community partners
                      </div>
                    </SelectItem>
                  )}
                  {availableBadges.includes('staff') && (
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-blue-500" />
                        Staff - For team members
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Request (Optional)</label>
              <Textarea
                placeholder="Explain why you should receive this badge..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{reason.length}/500 characters</p>
            </div>

            <Button onClick={submitRequest} disabled={submitting || !selectedBadge}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {userBadges.length === 3 
              ? "You already have all available badges!"
              : "You have pending requests for all remaining badges."}
          </p>
        )}

        {/* Request History */}
        {requests.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Your Request History</h4>
            <div className="space-y-2">
              {requests.map(request => (
                <div 
                  key={request.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {getBadgeIcon(request.badge)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{request.badge}</span>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                      {request.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1">
                          Reason: {request.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  {request.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => cancelRequest(request.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
