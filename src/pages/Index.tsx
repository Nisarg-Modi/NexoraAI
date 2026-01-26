import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Sparkles, Globe, Zap, LogOut, MessageSquare, Search, Crown, FileText, User, Mic, Radio, ScanLine } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import ContactsList from "@/components/ContactsList";
import SemanticSearch from "@/components/SemanticSearch";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import { DocumentWallet } from "@/components/DocumentWallet";
import { ProfileEditor } from "@/components/ProfileEditor";
import { AdminDashboard } from "@/components/AdminDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useSemanticSearch } from "@/hooks/useSemanticSearch";
import nexoraLogo from "@/assets/nexora-logo.png";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import DarkModeToggle from "@/components/DarkModeToggle";
import { VoiceProfileManager } from '@/components/VoiceProfileManager';
import { ScannerTranslator } from '@/components/ScannerTranslator';

import { UpdatesView } from "@/components/UpdatesView";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { OptimizedImage } from "@/components/ui/optimized-image";

const Index = () => {
  const [currentView, setCurrentView] = useState<'home' | 'contacts' | 'chat'>('contacts');
  const [selectedContact, setSelectedContact] = useState<{ userId: string; name: string; isGroup?: boolean; conversationId?: string } | null>(null);
  const { signOut, user } = useAuth();
  const { isAdmin } = useAdminCheck();
  
  // Initialize semantic search hook for real-time embedding generation
  useSemanticSearch();
  
  // Initialize online presence tracking
  useOnlinePresence();

  const handleStartChat = (contactUserId: string, contactName: string) => {
    setSelectedContact({ userId: contactUserId, name: contactName, isGroup: false });
    setCurrentView('chat');
  };

  const handleStartGroupChat = (conversationId: string, groupName: string) => {
    setSelectedContact({ userId: '', name: groupName, isGroup: true, conversationId });
    setCurrentView('chat');
  };

  if (currentView === 'chat' && selectedContact) {
    return (
      <ChatInterface
        contactUserId={selectedContact.userId}
        contactName={selectedContact.name}
        isGroup={selectedContact.isGroup}
        conversationId={selectedContact.conversationId}
        onBack={() => {
          setCurrentView('contacts');
          setSelectedContact(null);
        }}
        onStartDirectChat={handleStartChat}
      />
    );
  }

  if (currentView === 'contacts') {
    return (
      <div className="min-h-screen bg-background relative">
        {/* Header with sign out */}
        <div className="sticky top-0 z-20 bg-card/80 backdrop-blur-sm border-b border-border px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OptimizedImage src={nexoraLogo} alt="Nexora" className="h-6 sm:h-8" priority />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <DarkModeToggle />
            <ThemeSwitcher />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="hover:bg-primary/10 text-xs sm:text-sm px-2 sm:px-3"
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
        
        {/* Main Content with Tabs */}
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-6">
          <Tabs defaultValue="profile" className="w-full">
            {/* Mobile: Scrollable horizontal tabs */}
            <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
            <TabsList className={`inline-flex sm:grid w-max sm:w-full gap-1 sm:gap-0 mb-4 sm:mb-6 ${isAdmin ? 'sm:grid-cols-9' : 'sm:grid-cols-8'}`}>
                <TabsTrigger value="profile" className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">Profile</span>
                </TabsTrigger>
                <TabsTrigger value="contacts" className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">Contacts</span>
                </TabsTrigger>
                <TabsTrigger value="syncs" className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <Radio className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">Syncs</span>
                </TabsTrigger>
                <TabsTrigger value="voices" className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">Voices</span>
                </TabsTrigger>
                <TabsTrigger value="wallet" className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">Wallet</span>
                </TabsTrigger>
                <TabsTrigger value="scanner" className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <ScanLine className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">Scanner</span>
                </TabsTrigger>
                <TabsTrigger value="search" className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">Search</span>
                </TabsTrigger>
                <TabsTrigger value="subscription" className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                  <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">Premium</span>
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="admin" className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                    <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline sm:inline">Admin</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
            
            <TabsContent value="contacts">
              <ContactsList 
                onStartChat={handleStartChat}
                onStartGroupChat={handleStartGroupChat}
              />
            </TabsContent>
            
            <TabsContent value="syncs" className="min-h-[60vh]">
              <UpdatesView />
            </TabsContent>
            
            
            <TabsContent value="voices">
              <VoiceProfileManager />
            </TabsContent>
            
            <TabsContent value="profile">
              <ProfileEditor />
            </TabsContent>
            
            <TabsContent value="wallet">
              <DocumentWallet />
            </TabsContent>
            
            <TabsContent value="scanner">
              <ScannerTranslator />
            </TabsContent>
            
            <TabsContent value="search">
              <SemanticSearch 
                onResultClick={(conversationId, messageId) => {
                  // Navigate to the conversation
                  console.log('Navigate to conversation:', conversationId, messageId);
                  // You can implement navigation to specific message here
                }}
              />
            </TabsContent>
            
            <TabsContent value="subscription">
              <SubscriptionManagement />
            </TabsContent>
            
            {isAdmin && (
              <TabsContent value="admin">
                <AdminDashboard />
              </TabsContent>
            )}
          </Tabs>
        </div>
        
        <PWAInstallBanner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Header with user info */}
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-20 flex items-center gap-2 sm:gap-4">
        <DarkModeToggle />
        <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[150px] md:max-w-none">
          {user?.email}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="hover:bg-primary/10 text-xs sm:text-sm"
        >
          <LogOut className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
      {/* Animated background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-48 sm:w-72 md:w-96 h-48 sm:h-72 md:h-96 bg-primary/20 rounded-full blur-3xl aurora-bg" />
        <div className="absolute bottom-1/4 right-1/4 w-48 sm:w-72 md:w-96 h-48 sm:h-72 md:h-96 bg-secondary/20 rounded-full blur-3xl aurora-bg" style={{ animationDelay: "4s" }} />
      </div>

      {/* Hero Section */}
      <div className="relative z-10 container mx-auto px-4 py-12 sm:py-16 md:py-20">
        <div className="text-center max-w-4xl mx-auto space-y-4 sm:space-y-6 md:space-y-8 animate-slide-up">
          {/* Logo */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <OptimizedImage src={nexoraLogo} alt="Nexora" className="h-16 sm:h-20 md:h-24 lg:h-32" priority />
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight">
            <span className="gradient-text">Nexora</span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-primary font-light px-4">
            Smarter chats, stronger bonds, brighter future.
          </p>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            Experience intelligent communication with secure TLS encryption. AI-powered features that understand context, enhance conversations, and keep you connected.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-4 sm:pt-6 md:pt-8 px-4">
            <Button 
              onClick={() => setCurrentView('contacts')}
              size="lg"
              className="w-full sm:w-auto bg-primary hover:bg-primary-glow text-primary-foreground shadow-lg glow-hover text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6"
            >
              <Sparkles className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
              Try Nexora AI
            </Button>
            <Button 
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-primary/30 hover:bg-primary/10 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6"
            >
              Learn More
            </Button>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 justify-center pt-6 sm:pt-8 md:pt-12 px-4">
            <FeaturePill icon={<Shield className="w-3 h-3 sm:w-4 sm:h-4" />} text="TLS Encrypted" />
            <FeaturePill icon={<Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />} text="AI Tone Shifting" />
            <FeaturePill icon={<Globe className="w-3 h-3 sm:w-4 sm:h-4" />} text="Live Translation" />
            <FeaturePill icon={<Zap className="w-3 h-3 sm:w-4 sm:h-4" />} text="Smart Features" />
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mt-12 sm:mt-16 md:mt-24 max-w-6xl mx-auto px-2">
          <FeatureCard
            icon={<Shield className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-secondary" />}
            title="Secure Communication"
            description="Industry-standard TLS encryption protects your messages in transit and stored securely on our servers."
          />
          <FeatureCard
            icon={<Sparkles className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary" />}
            title="Nexora AI Assistant"
            description="Context-aware AI that drafts replies, shifts tone, and translates—enhancing your conversations."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-accent" />}
            title="Lightning Fast"
            description="Optimized QUIC protocol delivers messages in <300ms. Works seamlessly offline."
          />
        </div>
      </div>
    </div>
  );
};

const FeaturePill = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full bg-card border border-primary/20 text-xs sm:text-sm">
    {icon}
    <span className="whitespace-nowrap">{text}</span>
  </div>
);

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 hover:border-primary/50 transition-all duration-300 glow-hover">
    <div className="mb-3 sm:mb-4">{icon}</div>
    <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-1.5 sm:mb-2">{title}</h3>
    <p className="text-sm sm:text-base text-muted-foreground">{description}</p>
  </div>
);

export default Index;
