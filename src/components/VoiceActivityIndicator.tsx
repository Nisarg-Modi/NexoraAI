import { cn } from '@/lib/utils';

interface VoiceActivityIndicatorProps {
  isSpeaking: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VoiceActivityIndicator = ({
  isSpeaking,
  size = 'md',
  className,
}: VoiceActivityIndicatorProps) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-full bg-primary transition-all duration-150',
            sizeClasses[size],
            isSpeaking
              ? 'animate-pulse opacity-100'
              : 'opacity-30'
          )}
          style={{
            animationDelay: isSpeaking ? `${i * 100}ms` : '0ms',
            transform: isSpeaking ? `scaleY(${1 + Math.sin(i) * 0.5})` : 'scaleY(1)',
          }}
        />
      ))}
    </div>
  );
};

interface SpeakingBorderProps {
  isSpeaking: boolean;
  children: React.ReactNode;
  className?: string;
}

export const SpeakingBorder = ({
  isSpeaking,
  children,
  className,
}: SpeakingBorderProps) => {
  return (
    <div
      className={cn(
        'relative transition-all duration-200',
        isSpeaking && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        className
      )}
    >
      {children}
      {isSpeaking && (
        <div className="absolute -top-1 -right-1 flex items-center justify-center">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
        </div>
      )}
    </div>
  );
};

interface VoiceWaveformProps {
  isSpeaking: boolean;
  bars?: number;
  className?: string;
}

export const VoiceWaveform = ({
  isSpeaking,
  bars = 5,
  className,
}: VoiceWaveformProps) => {
  return (
    <div className={cn('flex items-end gap-0.5 h-4', className)}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1 bg-primary rounded-full transition-all duration-100',
            isSpeaking ? 'opacity-100' : 'opacity-30'
          )}
          style={{
            height: isSpeaking
              ? `${Math.max(20, Math.random() * 100)}%`
              : '20%',
            animationDelay: `${i * 50}ms`,
            transition: 'height 100ms ease-out',
          }}
        />
      ))}
    </div>
  );
};
