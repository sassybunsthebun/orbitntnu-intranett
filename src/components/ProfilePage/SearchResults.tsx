import type { Member, Team, TeamHistory } from '@prisma/client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import MemberInfo from '../General/MemberInfo';

interface SearchResultsProps {
  members: Member[];
  teamHistories: TeamHistory[];
  teams: Team[]
}

// Helper function to get team name by tid
export const getTeamName = (teamID: number, teams: Team[]) => {
  const matchedTeam = teams.find((team) => team.teamID === teamID);
  return matchedTeam ? matchedTeam.teamName : 'N/A';
};

export const getCurrentTeam = (teamHistories: TeamHistory[], member: Member, teams: Team[]) => {
  const currentTeam = teamHistories.find(
    (team) =>
      team.memberID === member.memberID &&
      (team.endYear === undefined || team.endYear === null)
  );

  return currentTeam ? getTeamName(currentTeam?.teamID, teams) : "N/A";
};

export function capitalizeFirstLetter(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export const getRole = (member: Member, teamHistories: TeamHistory[]) => {
  const currentTeam = teamHistories.find(
    (team) =>
      team.memberID === member.memberID &&
      (team.endYear === undefined || team.endYear === null)
  );

  if (!currentTeam) {
    return "Unknown Team"
  }

  if (currentTeam && currentTeam.teamID == 1) {
    return currentTeam.cPosition;
  }

  return capitalizeFirstLetter(currentTeam.priviledges.toLowerCase())
};

const SearchResults = ({ members, teamHistories, teams }: SearchResultsProps) => {
  const router = useRouter();
  const session = useSession();

  const handleBoxClick = (member: Member) => {
    void router.push(session.data?.user.email === member.orbitMail ? "profile/me" : `/profile/${member.memberID}`)
  };

  // Sort members alphabetically by first name
  const sortedMembers = members.filter(member => teamHistories.some(history => history.memberID === member.memberID) && member.activeStatus).sort((a, b) => a.firstName.localeCompare(b.firstName));

  return (
    <>
      <div className="flex items-center flex-col justify-center">
        <div className="flex flex-wrap justify-center">
          {sortedMembers.map((member) => (
            <MemberInfo key={member.memberID} member={member} teams={teams} teamHistories={teamHistories} onClick={() => handleBoxClick(member)}/>
          ))}
        </div>
      </div>
      <div className="flex items-center flex-col justify-center">
        {members.filter(member => !member.activeStatus).length > 0 && (
          <div>
            <h2 className='mt-10'>Inactive members / missing key data:</h2>
            <div className="flex flex-wrap justify-center">
              {members.filter(member => !member.activeStatus).map((member) => (
                <MemberInfo key={member.memberID} member={member} teams={teams} teamHistories={teamHistories} onClick={() => handleBoxClick(member)}/>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};


export default SearchResults;
