import { Crown, Users, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeType = "premium" | "staff" | "partner";

interface UserBadgesProps {
  badges: BadgeType[];
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  className?: string;
}

const badgeConfig: Record<BadgeType, {
  icon: React.ElementType;
  label: string;
  bgColor: string;
  textColor: string;
  iconColor: string;
}> = {
  premium: {
    icon: Crown,
    label: "Premium",
    bgColor: "bg-amber-500/20",
    textColor: "text-amber-600 dark:text-amber-400",
    iconColor: "text-amber-500",
  },
  staff: {
    icon: Briefcase,
    label: "Staff",
    bgColor: "bg-blue-500/20",
    textColor: "text-blue-600 dark:text-blue-400",
    iconColor: "text-blue-500",
  },
  partner: {
    icon: Users,
    label: "Partner",
    bgColor: "bg-purple-500/20",
    textColor: "text-purple-600 dark:text-purple-400",
    iconColor: "text-purple-500",
  },
};

const sizeConfig = {
  sm: {
    icon: "w-3 h-3",
    container: "px-1.5 py-0.5 text-[10px] gap-0.5",
    iconOnly: "w-4 h-4",
  },
  md: {
    icon: "w-3.5 h-3.5",
    container: "px-2 py-1 text-xs gap-1",
    iconOnly: "w-5 h-5",
  },
  lg: {
    icon: "w-4 h-4",
    container: "px-2.5 py-1.5 text-sm gap-1.5",
    iconOnly: "w-6 h-6",
  },
};

export const UserBadges = ({
  badges,
  size = "md",
  showLabels = false,
  className,
}: UserBadgesProps) => {
  if (badges.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {badges.map((badge) => {
        const config = badgeConfig[badge];
        const sizes = sizeConfig[size];
        const Icon = config.icon;

        if (!showLabels) {
          return (
            <div
              key={badge}
              className={cn(
                "rounded-full flex items-center justify-center",
                config.bgColor,
                sizes.iconOnly
              )}
              title={config.label}
            >
              <Icon className={cn(sizes.icon, config.iconColor)} />
            </div>
          );
        }

        return (
          <span
            key={badge}
            className={cn(
              "inline-flex items-center rounded-full font-medium",
              config.bgColor,
              config.textColor,
              sizes.container
            )}
          >
            <Icon className={cn(sizes.icon, config.iconColor)} />
            {config.label}
          </span>
        );
      })}
    </div>
  );
};

export const BadgeIcon = ({
  badge,
  size = "md",
  className,
}: {
  badge: BadgeType;
  size?: "sm" | "md" | "lg";
  className?: string;
}) => {
  const config = badgeConfig[badge];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center",
        config.bgColor,
        sizes.iconOnly,
        className
      )}
      title={config.label}
    >
      <Icon className={cn(sizes.icon, config.iconColor)} />
    </div>
  );
};

export { badgeConfig };
