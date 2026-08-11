import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api, formatDateTime, initials, titleCase } from '../api';
import { Card, ErrorBanner, Loading, StatusBadge } from '../components/ui';

export default function UsersTeams() {
  const [people, setPeople] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/teams')])
      .then(([userData, teamData]) => {
        setPeople(userData);
        setTeams(teamData);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <ErrorBanner error={error} />;
  if (!people) return <Loading label="Loading people…" />;

  return (
    <>
      <div className="banner banner-info">
        <Users size={16} />
        <div>
          A role sets what someone can do; their team sets which modules they can read. Both are
          enforced server-side — the chat agent and the report APIs refuse data outside a caller's
          scope rather than hiding it in the UI.
        </div>
      </div>

      <Card title="Teams" subtitle="Reviewing teams and their data scope" noBody>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Team</th>
                <th>Data scope</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td className="primary-cell">{team.name}</td>
                  <td>
                    <div className="row wrap" style={{ gap: 5 }}>
                      {(team.scope_modules || []).map((module) => (
                        <span className="badge badge-indigo" key={module}>
                          {titleCase(module)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="row">
                      <div className="avatar-stack">
                        {team.members.slice(0, 4).map((member) => (
                          <span className="avatar sm" key={member.id} title={member.full_name}>
                            {initials(member.full_name)}
                          </span>
                        ))}
                      </div>
                      {team.member_count > 4 && <span className="small muted">+{team.member_count - 4}</span>}
                      {!team.member_count && <span className="small faint">No members</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Users" noBody>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Team</th>
                <th>Last sign-in</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id}>
                  <td>
                    <div className="row">
                      <span className="avatar sm">{initials(person.full_name || person.email)}</span>
                      <div>
                        <div className="primary-cell">{person.full_name}</div>
                        <div className="muted-cell">{person.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-violet">{titleCase(person.role)}</span>
                  </td>
                  <td className="small">{person.team?.name || '—'}</td>
                  <td className="small nowrap">{formatDateTime(person.last_login_at)}</td>
                  <td>
                    <StatusBadge status={person.is_active ? 'connected' : 'paused'} label={person.is_active ? 'Active' : 'Disabled'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
