import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Swords, Crown, Shield } from "lucide-react";

interface TeamConfig {
  team_a_name: string;
  team_b_name: string;
  team_a_color: string;
  team_b_color: string;
  prize_for_winning_team?: string;
}

interface TeamBattleDisplayProps {
  teamConfig: TeamConfig;
  teamACount: number;
  teamBCount: number;
  userTeam?: 'A' | 'B' | null;
  showJoinButtons?: boolean;
  onJoinTeam?: (team: 'A' | 'B') => void;
  isCompact?: boolean;
}

const TeamBattleDisplay = memo(({
  teamConfig,
  teamACount,
  teamBCount,
  userTeam,
  isCompact = false
}: TeamBattleDisplayProps) => {
  const total = teamACount + teamBCount;
  const teamAPercent = total > 0 ? (teamACount / total) * 100 : 50;
  const teamBPercent = total > 0 ? (teamBCount / total) * 100 : 50;
  const leadingTeam = teamACount > teamBCount ? 'A' : teamBCount > teamACount ? 'B' : null;

  if (isCompact) {
    return (
      <div className="bg-gradient-to-r from-blue-500/10 via-transparent to-red-500/10 rounded-lg p-2 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="font-medium">{teamConfig.team_a_name}</span>
            {leadingTeam === 'A' && <Crown className="h-3 w-3 text-yellow-500" />}
          </div>
          <Swords className="h-3 w-3 text-muted-foreground" />
          <div className="flex items-center gap-1">
            {leadingTeam === 'B' && <Crown className="h-3 w-3 text-yellow-500" />}
            <span className="font-medium">{teamConfig.team_b_name}</span>
            <div className="w-3 h-3 rounded-full bg-red-500" />
          </div>
        </div>
        
        <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-blue-200 to-red-200">
          <div 
            className="absolute inset-y-0 left-0 bg-blue-500 transition-all duration-500"
            style={{ width: `${teamAPercent}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{teamACount} عضو</span>
          <span>{teamBCount} عضو</span>
        </div>
        
        {userTeam && (
          <Badge 
            className={`w-full justify-center text-xs ${
              userTeam === 'A' ? 'bg-blue-500' : 'bg-red-500'
            } text-white`}
          >
            <Shield className="h-3 w-3 ml-1" />
            أنت في فريق {userTeam === 'A' ? teamConfig.team_a_name : teamConfig.team_b_name}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-red-500/10 rounded-xl p-4 space-y-4 border border-border/50">
      <div className="flex items-center justify-center gap-2 text-sm font-medium">
        <Swords className="h-5 w-5 text-primary" />
        <span>منافسة الفرق</span>
      </div>
      
      <div className="flex items-stretch gap-4">
        {/* Team A */}
        <div className={`flex-1 text-center p-3 rounded-lg ${
          leadingTeam === 'A' ? 'bg-blue-500/20 ring-2 ring-blue-500' : 'bg-blue-500/10'
        } ${userTeam === 'A' ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}>
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-500 flex items-center justify-center mb-2">
            <Users className="h-6 w-6 text-white" />
          </div>
          <h4 className="font-bold text-blue-600">{teamConfig.team_a_name}</h4>
          <p className="text-2xl font-bold">{teamACount}</p>
          <p className="text-xs text-muted-foreground">عضو</p>
          {leadingTeam === 'A' && (
            <Badge className="mt-2 bg-yellow-500 text-white gap-1">
              <Crown className="h-3 w-3" />
              متقدم
            </Badge>
          )}
          {userTeam === 'A' && (
            <Badge className="mt-2 bg-blue-500 text-white gap-1">
              <Shield className="h-3 w-3" />
              فريقك
            </Badge>
          )}
        </div>
        
        {/* VS */}
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
            VS
          </div>
        </div>
        
        {/* Team B */}
        <div className={`flex-1 text-center p-3 rounded-lg ${
          leadingTeam === 'B' ? 'bg-red-500/20 ring-2 ring-red-500' : 'bg-red-500/10'
        } ${userTeam === 'B' ? 'ring-2 ring-red-400 ring-offset-2' : ''}`}>
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500 flex items-center justify-center mb-2">
            <Users className="h-6 w-6 text-white" />
          </div>
          <h4 className="font-bold text-red-600">{teamConfig.team_b_name}</h4>
          <p className="text-2xl font-bold">{teamBCount}</p>
          <p className="text-xs text-muted-foreground">عضو</p>
          {leadingTeam === 'B' && (
            <Badge className="mt-2 bg-yellow-500 text-white gap-1">
              <Crown className="h-3 w-3" />
              متقدم
            </Badge>
          )}
          {userTeam === 'B' && (
            <Badge className="mt-2 bg-red-500 text-white gap-1">
              <Shield className="h-3 w-3" />
              فريقك
            </Badge>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="relative h-4 rounded-full overflow-hidden bg-gradient-to-r from-blue-100 to-red-100">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
            style={{ width: `${teamAPercent}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference">
            {Math.round(teamAPercent)}% - {Math.round(teamBPercent)}%
          </div>
        </div>
      </div>
      
      {teamConfig.prize_for_winning_team && (
        <p className="text-xs text-center text-muted-foreground">
          🏆 الفريق الفائز يحصل على: {teamConfig.prize_for_winning_team}
        </p>
      )}
    </div>
  );
});

TeamBattleDisplay.displayName = "TeamBattleDisplay";

export default TeamBattleDisplay;
