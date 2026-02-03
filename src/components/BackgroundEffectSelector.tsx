import { Eye, Sparkles, CircleDashed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VideoEffect } from '@/hooks/useVideoEffects';

interface BackgroundEffectSelectorProps {
  currentEffect: VideoEffect;
  onEffectChange: (effect: VideoEffect) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const BackgroundEffectSelector = ({
  currentEffect,
  onEffectChange,
  isLoading = false,
  disabled = false,
}: BackgroundEffectSelectorProps) => {
  const effects: { value: VideoEffect; label: string; icon: React.ReactNode }[] = [
    { value: 'none', label: 'No effect', icon: <Eye className="w-4 h-4" /> },
    { value: 'blur', label: 'Blur background', icon: <CircleDashed className="w-4 h-4" /> },
    { value: 'blur-strong', label: 'Strong blur', icon: <Sparkles className="w-4 h-4" /> },
  ];

  const currentEffectConfig = effects.find(e => e.value === currentEffect);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="lg"
          variant={currentEffect !== 'none' ? 'default' : 'secondary'}
          className="rounded-full w-14 h-14 relative"
          disabled={disabled || isLoading}
          title="Background effects"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <CircleDashed className="w-6 h-6" />
          )}
          {currentEffect !== 'none' && !isLoading && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="mb-2">
        {effects.map((effect) => (
          <DropdownMenuItem
            key={effect.value}
            onClick={() => onEffectChange(effect.value)}
            className={currentEffect === effect.value ? 'bg-accent' : ''}
          >
            <span className="mr-2">{effect.icon}</span>
            {effect.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
