import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  endDate: string;
  onComplete?: () => void;
  className?: string;
}

const CountdownTimer = ({ endDate, onComplete, className = '' }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const difference = end - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        onComplete?.();
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [endDate, onComplete]);

  if (timeLeft.isExpired) {
    return (
      <div className={`flex items-center gap-2 text-red-500 ${className}`}>
        <Clock className="h-4 w-4" />
        <span className="font-medium">انتهى الوقت</span>
      </div>
    );
  }

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-primary text-primary-foreground font-mono font-bold text-xs sm:text-sm md:text-lg px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg min-w-[28px] sm:min-w-[36px] md:min-w-[40px] text-center">
        {value.toString().padStart(2, '0')}
      </div>
      <span className="text-[8px] sm:text-[10px] md:text-xs text-muted-foreground mt-0.5 sm:mt-1">{label}</span>
    </div>
  );

  return (
    <div className={`flex items-center gap-0.5 sm:gap-1 md:gap-2 ${className}`}>
      <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-primary animate-pulse flex-shrink-0" />
      <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap justify-center">
        {timeLeft.days > 0 && (
          <>
            <TimeBlock value={timeLeft.days} label="يوم" />
            <span className="text-primary font-bold text-xs sm:text-sm">:</span>
          </>
        )}
        <TimeBlock value={timeLeft.hours} label="ساعة" />
        <span className="text-primary font-bold text-xs sm:text-sm">:</span>
        <TimeBlock value={timeLeft.minutes} label="دقيقة" />
        <span className="text-primary font-bold text-xs sm:text-sm">:</span>
        <TimeBlock value={timeLeft.seconds} label="ثانية" />
      </div>
    </div>
  );
};

export default CountdownTimer;
