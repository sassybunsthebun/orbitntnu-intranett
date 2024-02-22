import BreakLine from "@/components/General/Breakline";
import Button from "@/components/General/Button";
import Icons from "@/components/General/Icons";
import MemberInfo from "@/components/General/MemberInfo";
import SearchBar from "@/components/General/SearchBar";
import Layout from "@/templates/Layout";
import { api } from "@/utils/api";
import type { Team, TeamHistory, Member } from "@prisma/client";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

const TeamsPage = () => {
    const membersData = api.members.getMembers.useQuery();
    const members: Member[] = membersData.data ?? [];

    const teamHistoriesData = api.teamHistories.getTeamHistories.useQuery();
    const teamHistories: TeamHistory[] = teamHistoriesData.data ?? [];

    const teamsData = api.teams.getTeams.useQuery();
    const teams: Team[] = teamsData.data ?? [];

    const router = useRouter();
    const { teamID } = router.query;

    const session = useSession();

    const [edit, setEdit] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState("");

    const teamHistoriesQuery = api.teamHistories.terminateTeamHistory.useMutation();
    const updateMemberQuery = api.members.updateMemberInformation.useMutation();

    const createTeamHistoriesQuery = api.teamHistories.createTeamHistory.useMutation();

    // Function to handle removing a member
    const handleRemoveMember = (member: Member) => {
        // Display a confirmation dialog
        const isSure = window.confirm(`Are you sure you want to remove ${member.firstName} ${member.lastName} from this team?`);

        // If user confirms, call the API to remove the member
        if (isSure) {
            const currentTeamHistory: TeamHistory | undefined = teamHistories.find((history): history is TeamHistory =>
                history?.memberID === member.memberID &&
                history?.endSem === null &&
                history?.endYear === null &&
                history?.teamID === Number(teamID)
            );

            if (currentTeamHistory && typeof currentTeamHistory.teamHistoryID === 'number') {
                void teamHistoriesQuery.mutateAsync({
                    teamHistoryID: Number(currentTeamHistory?.teamHistoryID),
                });
            } else {
                console.error("currentTeamHistory is not of the correct type or not found");
            }


            // Function to check if there is any team history entry with the same MemberID where endSem and endYear are both null
            const isMemberActive = teamHistories.some(history => history.memberID === member.memberID && history.endSem === null && history.endYear === null);

            if (!isMemberActive) {
                // Update the member to inactive if no active team history entry exists
                void updateMemberQuery.mutateAsync({
                    ...member,
                    activeStatus: false
                });
            }
        }
    };

    const handleAddMember = (member: Member) => {
        // Display a confirmation dialog
        const isSure = window.confirm(`Are you sure you want to add ${member.firstName} ${member.lastName} to this team?`);

        // If user confirms, call the API to remove the member
        if (isSure) {
            void createTeamHistoriesQuery.mutateAsync({
                priviledges: "MEMBER",
                memberID: member.memberID,
                teamID: Number(teamID),
            })

            void updateMemberQuery.mutateAsync({
                ...member,
                activeStatus: true
            });
        }
    }

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
    };

    const handleChangeTL = (members: Member[], currentTeamLeader: Member) => {
        // Prompt the user to select a member from the provided array of members
        const selectedMember = window.prompt(`Choose the member you wish to promote as the new team leader:\n${members.map(member => `${member.firstName} ${member.lastName}`).join('\n')}`);

        // Find the selected member object from the array based on the user's input
        const newTeamLeader = members.find(member => `${member.firstName} ${member.lastName}` === selectedMember);

        // Check if a member is selected and the user confirms the action
        if (newTeamLeader && window.confirm(`Are you sure you want to change the team leader to ${newTeamLeader.firstName} ${newTeamLeader.lastName}?`)) {

            const oldTLHistory: TeamHistory | undefined = teamHistories.find((history): history is TeamHistory =>
                history?.memberID === currentTeamLeader.memberID &&
                history?.endSem === null &&
                history?.endYear === null &&
                history?.teamID === Number(teamID)
            );

            const newTLHistory: TeamHistory | undefined = teamHistories.find((history): history is TeamHistory =>
                history?.memberID === newTeamLeader.memberID &&
                history?.endSem === null &&
                history?.endYear === null &&
                history?.teamID === Number(teamID)
            );

            try {
                // Perform API call to update the team leader

                // Optional: Update the previous team leader's role to a regular member
                if (currentTeamLeader) {

                    void teamHistoriesQuery.mutateAsync({
                        teamHistoryID: Number(oldTLHistory?.teamHistoryID),
                    })

                    void teamHistoriesQuery.mutateAsync({
                        teamHistoryID: Number(newTLHistory?.teamHistoryID),
                    })

                    void createTeamHistoriesQuery.mutateAsync({
                        priviledges: "LEADER",
                        memberID: newTeamLeader.memberID,
                        teamID: Number(teamID),
                    })

                    void createTeamHistoriesQuery.mutateAsync({
                        priviledges: "MEMBER",
                        memberID: currentTeamLeader.memberID,
                        teamID: Number(teamID),
                    })
                }
                void router.push("/team/" + String(teamID));

                // Notify the user about the successful update
                alert(`Successfully updated the team leader to ${newTeamLeader.firstName} ${newTeamLeader.lastName}`);
            } catch (error) {
                console.error('Error occurred while updating the team leader:', error);
                alert('Failed to update the team leader. Please try again later.');
            }
        } else {
            // Handle if the user cancels or provides invalid input
            alert('Operation canceled or invalid selection.');
        }
    };

    const filteredMembers = members.filter(member => {
        // Convert searchQuery and member names to lowercase for case-insensitive search
        const searchValue = searchQuery.toLowerCase();
        const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();


        const isInTeam = teamHistories.filter(history => {
            return history.memberID === member.memberID && history.endSem === null && history.endYear === null;
        }).some(history => history.memberID === member.memberID && history.teamID === Number(teamID));

        return !isInTeam && (fullName.includes(searchValue) || member.orbitMail.toLowerCase().includes(searchValue));
    });

    if (teamID == "find") {
        const sessionMember = members.find(member => member.orbitMail === session.data?.user.email);

        if (sessionMember) {
            const sessionMemberID = sessionMember.memberID;
            const teamHistoriesFromSession = teamHistories.filter(history => {
                return history.memberID === sessionMemberID && history.endSem === null && history.endYear === null;
            });

            void router.push("/team/" + teamHistoriesFromSession[0]?.teamID)
        }
    }

    // Filter teamHistories to find all entries with the same teamID as the session member
    const teamHistoriesFromUrl = teamHistories.filter(history => {
        return history.teamID === Number(teamID) && history.endSem === null && history.endYear === null;
    });
    // Extract the memberIDs from these teamHistories
    const memberTeamHistories = teamHistoriesFromUrl.map(history => history.memberID);

    // Find members with these extracted memberIDs
    const membersInTeam = members.filter(member => memberTeamHistories.includes(member.memberID));

    // Find the team leader among the members
    const teamLeader = membersInTeam.find(member => {
        const teamHistory = teamHistoriesFromUrl.find(history => history.memberID === member.memberID);
        return teamHistory && teamHistory.priviledges === "LEADER";
    });

    if (!router.isReady || teamID === "find") {
        return (
            <Layout>
                <h2 className="flex flex-row items-center justify-center h-full">Thinking...</h2>
            </Layout>
        )
    };

    const sessionMember = members.find(member => member.orbitMail === session.data?.user.email);

    if (sessionMember) {
        const isLeaderOrBoard = teamHistories.find((history): history is TeamHistory =>
            history?.memberID === sessionMember.memberID &&
            history?.endSem === null &&
            history?.endYear === null &&
            history?.teamID === Number(teamID)
        )?.priviledges === "LEADER"
            || teamHistories.find((history): history is TeamHistory =>
                history?.memberID === sessionMember.memberID &&
                history?.endSem === null &&
                history?.endYear === null &&
                history?.teamID === 1) !== undefined;

        return (
            <Layout>
                {!isLeaderOrBoard ? (
                    // Render content when the user is not a leader or board member
                    <>
                        <div className='md:flex justify-between items-center'>
                            <ul className='items-center flex flex-row gap-6'>
                                <Link href="/team/teamlist">
                                    <Icons name="ArrowLeft_lg" />
                                </Link>
                                <h1>{teamID && teams.find((team) => team.teamID === Number(teamID))?.teamName}</h1>
                            </ul>
                        </div>
                        <BreakLine />
                        <div className="flex justify-center flex-wrap">
                            {/* Render the team leader first */}
                            {teamLeader && (
                                <MemberInfo isTeamLead={true} member={teamLeader} teams={teams} teamHistories={teamHistories} onClick={() => void router.push("/profile/" + teamLeader.memberID)} />
                            )}
                            {membersInTeam.map((member) => (
                                // Skip rendering the team leader again
                                !teamLeader || member.memberID !== teamLeader.memberID ? (
                                    <MemberInfo key={member.memberID} member={member} teams={teams} teamHistories={teamHistories} onClick={() => void router.push("/profile/" + member.memberID)} />
                                ) : null
                            ))}
                        </div>
                    </>
                ) : (
                    // Render content when the user is a leader or board member
                    <>
                        <div className='md:flex justify-between items-center'>
                            <ul className='items-center flex flex-row gap-6'>
                                <Link href="/team/teamlist">
                                    <Icons name="ArrowLeft_lg" />
                                </Link>
                                <h1>{teamID && teams.find((team) => team.teamID === Number(teamID))?.teamName}</h1>
                            </ul>
                            <div className="md:mt-0 mt-4">
                                <Button label={edit ? 'Finish Editing' : 'Edit Team'} onClick={() => setEdit(!edit)} icon={edit ? 'Check' : 'Settings'} />
                            </div>
                        </div>
                        <BreakLine />
                        {edit ? (
                            // Render content when not in edit mode
                            <>
                                <h2 className="mb-2">Current members in your team:</h2>
                                <div className="flex justify-center flex-wrap">
                                    {teamLeader && (
                                        <MemberInfo
                                            isTeamLead={true}
                                            member={teamLeader}
                                            teams={teams}
                                            teamHistories={teamHistories}
                                            icon1="Arrow45Up"
                                            icon1Click={() => {
                                                void handleChangeTL(membersInTeam, teamLeader);
                                            }}
                                        />
                                    )}
                                    {membersInTeam.map((member) => (
                                        // Skip rendering the team leader again
                                        !teamLeader || member.memberID !== teamLeader.memberID ? (
                                            <MemberInfo
                                                key={member.memberID} // Add a unique key prop
                                                member={member}
                                                teams={teams}
                                                teamHistories={teamHistories}
                                                icon1="Cross"
                                                icon1Click={() => {
                                                    handleRemoveMember(member);
                                                }}
                                            />
                                        ) : null // Return null if you don't want to render the member
                                    ))}
                                </div>
                                <BreakLine />
                                <h2 className="mb-2">Members up for grabs:</h2>
                                <SearchBar onChange={handleSearchChange} />
                                {/* Display filtered members */}
                                {filteredMembers.length > 0 && (
                                    <div>
                                        <div className="flex flex-wrap justify-center">
                                            {filteredMembers.map((member) => (
                                                <MemberInfo
                                                    key={member.memberID} // Add a unique key prop
                                                    member={member}
                                                    teams={teams}
                                                    teamHistories={teamHistories}
                                                    icon1="AddPerson"
                                                    icon1Click={() => {
                                                        handleAddMember(member);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex justify-center flex-wrap">
                                    {/* Render the team leader first */}
                                    {teamLeader && (
                                        <MemberInfo isTeamLead={true} member={teamLeader} teams={teams} teamHistories={teamHistories} onClick={() => void router.push("/profile/" + teamLeader.memberID)} />
                                    )}
                                    {membersInTeam.map((member) => (
                                        // Skip rendering the team leader again
                                        !teamLeader || member.memberID !== teamLeader.memberID ? (
                                            <MemberInfo key={member.memberID} member={member} teams={teams} teamHistories={teamHistories} onClick={() => void router.push("/profile/" + member.memberID)} />
                                        ) : null
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </Layout>
        );
    }
}

export default TeamsPage;