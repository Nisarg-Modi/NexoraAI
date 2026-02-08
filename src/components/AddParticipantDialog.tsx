import { useState, useEffect } from 'react';
import { Search, UserPlus, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Contact {
  id: string;
  contact_user_id: string;
  contact_name: string | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface AddParticipantDialogProps {
  open: boolean;
  onClose: () => void;
  callId: string;
  currentParticipantIds: string[];
  onParticipantAdded: (userId: string, name: string) => void;
}

export const AddParticipantDialog = ({
  open,
  onClose,
  callId,
  currentParticipantIds,
  onParticipantAdded,
}: AddParticipantDialogProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchContacts();
    }
  }, [open]);

  const fetchContacts = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from('contacts')
      .select('id, contact_user_id, contact_name')
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error fetching contacts:', error);
      return;
    }

    if (data) {
      const contactsWithProfiles = await Promise.all(
        data.map(async (contact) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', contact.contact_user_id)
            .single();

          return {
            ...contact,
            profiles: profile || { display_name: null, avatar_url: null },
          };
        })
      );
      setContacts(contactsWithProfiles);
    }
  };

  const addParticipant = async (contact: Contact) => {
    setLoading(true);
    try {
      // Add participant to call
      const { error } = await supabase.from('call_participants').insert({
        call_id: callId,
        user_id: contact.contact_user_id,
        status: 'invited',
      });

      if (error) throw error;

      const displayName = contact.contact_name || contact.profiles?.display_name || 'Unknown';
      onParticipantAdded(contact.contact_user_id, displayName);
      
      toast({
        title: 'Participant invited',
        description: `${displayName} has been invited to the call`,
      });
    } catch (error) {
      console.error('Error adding participant:', error);
      toast({
        title: 'Error',
        description: 'Failed to add participant',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    if (currentParticipantIds.includes(contact.contact_user_id)) return false;
    
    const name = contact.contact_name || contact.profiles?.display_name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Add Participant
          </DialogTitle>
          <DialogDescription>
            Invite a contact to join this call
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-64">
            <div className="space-y-2">
              {filteredContacts.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {contacts.length === 0 ? 'No contacts found' : 'No available contacts'}
                </p>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => addParticipant(contact)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={contact.profiles?.avatar_url || undefined} />
                        <AvatarFallback>
                          {(contact.contact_name || contact.profiles?.display_name || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {contact.contact_name || contact.profiles?.display_name || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" disabled={loading}>
                      <Phone className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
