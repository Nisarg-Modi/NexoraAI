import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallDurationTimerProps {
  startTime?: Date;
  className?: string;
  showIcon?: boolean;
}

export const CallDurationTimer = ({
  startTime,
  className,
  showIcon = true,
}: CallDurationTimerProps) => {
  const [duration, setDuration] = useState(0);
  const startTimeRef = useRef<Date>(startTime || new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (startTime) {
      startTimeRef.current = startTime;
    }
  }, [startTime]);

  useEffect(() => {
    // Calculate initial duration if startTime is in the past
    const initialDuration = Math.floor(
      (Date.now() - startTimeRef.current.getTime()) / 1000
    );
    setDuration(Math.max(0, initialDuration));

    // Update every second
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - startTimeRef.current.getTime()) / 1000
      );
      setDuration(Math.max(0, elapsed));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-sm font-medium text-muted-foreground',
        className
      )}
    >
      {showIcon && <Clock className="w-4 h-4" />}
      <span className="tabular-nums">{formatDuration(duration)}</span>
    </div>
  );
};

export default CallDurationTimer;
