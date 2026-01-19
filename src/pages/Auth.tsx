import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sparkles, Shield, Zap, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import nexoraLogo from "@/assets/nexora-logo.png";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import DarkModeToggle from "@/components/DarkModeToggle";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
});

const loginSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
});

const signupSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username too long").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(50, "Display name too long"),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format (use E.164 format: +1234567890)").optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"], { required_error: "Please select your gender" }),
});

type AuthMode = "login" | "signup" | "forgot-password";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">();
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      forgotPasswordSchema.parse({ email });

      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setResetEmailSent(true);
        toast({
          title: "Check your email",
          description: "We've sent you a password reset link.",
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      if (mode === "login") {
        loginSchema.parse({ username, password });

        try {
          // Get email from username with rate limiting
          const { data: emailData, error: emailError } = await supabase.rpc(
            'get_email_by_username_rate_limited',
            { input_username: username.trim() }
          );

          // Generic error to prevent username enumeration
          if (emailError) {
            // Check if it's a rate limit error
            if (emailError.message?.includes('Too many login attempts')) {
              toast({
                title: "Too many attempts",
                description: "Please wait a few minutes before trying again.",
                variant: "destructive",
              });
              await supabase.rpc('record_login_attempt', {
                identifier_text: username.trim(),
                was_successful: false
              });
              return;
            }
            
            // Generic error for any other issue
            toast({
              title: "Login failed",
              description: "Invalid credentials. Please check your username and password.",
              variant: "destructive",
            });
            await supabase.rpc('record_login_attempt', {
              identifier_text: username.trim(),
              was_successful: false
            });
            return;
          }

          if (!emailData) {
            toast({
              title: "Login failed",
              description: "Invalid credentials. Please check your username and password.",
              variant: "destructive",
            });
            await supabase.rpc('record_login_attempt', {
              identifier_text: username.trim(),
              was_successful: false
            });
            return;
          }

          const { error } = await supabase.auth.signInWithPassword({
            email: emailData,
            password,
          });

          if (error) {
            // Generic error message to prevent username enumeration
            toast({
              title: "Login failed",
              description: "Invalid credentials. Please check your username and password.",
              variant: "destructive",
            });
            await supabase.rpc('record_login_attempt', {
              identifier_text: username.trim(),
              was_successful: false
            });
          } else {
            // Record successful login
            await supabase.rpc('record_login_attempt', {
              identifier_text: username.trim(),
              was_successful: true
            });
            toast({
              title: "Welcome back!",
              description: "Successfully logged in.",
            });
            navigate("/");
          }
        } catch (error) {
          toast({
            title: "Login failed",
            description: "An error occurred. Please try again.",
            variant: "destructive",
          });
        }
      } else if (mode === "signup") {
        signupSchema.parse({
          username, 
          email, 
          password, 
          displayName, 
          phoneNumber: phoneNumber || undefined,
          gender
        });
        
        // Check if username is available (case-insensitive)
        const { data: isAvailable, error: checkError } = await supabase.rpc(
          'is_username_available',
          { check_username: username.trim() }
        );

        if (checkError || !isAvailable) {
          toast({
            title: "Username taken",
            description: "This username is already in use. Please choose a different one.",
            variant: "destructive",
          });
          return;
        }
        
        const redirectUrl = `${window.location.origin}/`;
        
        const { data: authData, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              display_name: displayName.trim(),
              username: username.trim(),
              gender: gender,
            },
          },
        });

        // Check for duplicate username after signup attempt
        if (error && error.message.includes("duplicate key value violates unique constraint")) {
          toast({
            title: "Registration failed",
            description: "An account with this information already exists. Please try a different username.",
            variant: "destructive",
          });
          return;
        }

        // Update profile_private with phone number if provided (secure table with owner-only access)
        if (!error && authData.user && phoneNumber) {
          await supabase
            .from('profiles_private')
            .insert({ 
              user_id: authData.user.id,
              phone_number: phoneNumber.trim() 
            })
            .select()
            .single();
        }

        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please login instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Account created!",
            description: "Welcome to Nexora. You can now start chatting.",
          });
          navigate("/");
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dark/Light mode toggle */}
      <div className="absolute top-4 right-4 z-20">
        <DarkModeToggle />
      </div>

      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 aurora-bg" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />

      <Card className="w-full max-w-md p-8 bg-card/80 backdrop-blur-xl border-border/50 relative z-10">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img 
              src={nexoraLogo} 
              alt="Nexora" 
              className="h-28 w-auto animate-logo-glow"
            />
          </div>
          <p className="text-sm text-muted-foreground italic mb-4">
            Smarter chats, stronger bonds, brighter future.
          </p>
          <p className="text-muted-foreground text-sm">
            {mode === "login" && "Welcome back"}
            {mode === "signup" && "Join the intelligent messaging platform"}
            {mode === "forgot-password" && "Reset your password"}
          </p>
        </div>

        {/* Forgot Password Form */}
        {mode === "forgot-password" ? (
          <div className="space-y-4">
            {resetEmailSent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <p className="text-muted-foreground">
                  We've sent a password reset link to <strong>{email}</strong>. 
                  Please check your email and follow the instructions.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMode("login");
                    setResetEmailSent(false);
                    setEmail("");
                  }}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-muted border-border"
                    maxLength={255}
                  />
                  <p className="text-xs text-muted-foreground">
                    We'll send you a link to reset your password
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary-glow"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMode("login");
                    setEmail("");
                  }}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </form>
            )}
          </div>
        ) : (
          /* Auth Form */
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder={mode === "login" ? "Enter your username" : "Choose a username"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-muted border-border"
                maxLength={30}
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">
                  Only letters, numbers, and underscores allowed
                </p>
              )}
            </div>

            {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-muted border-border"
                  maxLength={255}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="How should we call you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="bg-muted border-border"
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  This is how others will see you
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number (optional)</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="bg-muted border-border"
                  maxLength={15}
                />
                <p className="text-xs text-muted-foreground">
                  Use international format with + (e.g., +1234567890)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Gender</Label>
                <RadioGroup value={gender} onValueChange={(value) => setGender(value as "male" | "female" | "other")} required>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" />
                    <Label htmlFor="male" className="font-normal cursor-pointer">Male</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" />
                    <Label htmlFor="female" className="font-normal cursor-pointer">Female</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="font-normal cursor-pointer">Other</Label>
                  </div>
                </RadioGroup>
              </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-muted border-border"
                minLength={8}
                maxLength={100}
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              )}
            </div>

            {mode === "login" && (
              <button
                type="button"
                onClick={() => setMode("forgot-password")}
                className="text-sm text-primary hover:underline"
              >
                Forgot your password?
              </button>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary-glow"
              disabled={loading}
            >
              {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>
        )}

        {/* Toggle Login/Signup */}
        {mode !== "forgot-password" && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setEmail("");
                setDisplayName("");
                setPhoneNumber("");
                setGender(undefined);
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {mode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        )}

        {/* Features */}
        <div className="mt-8 pt-6 border-t border-border space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-muted-foreground">End-to-end encrypted</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-muted-foreground">AI-powered assistance</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-muted-foreground">Real-time messaging</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
