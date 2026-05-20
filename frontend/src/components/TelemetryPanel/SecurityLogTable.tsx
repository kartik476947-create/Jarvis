import type { SecurityEvent } from '../../types';
import { RiskBadge } from '../Common';

interface SecurityLogTableProps {
  events: SecurityEvent[];
}

export const SecurityLogTable = ({ events }: SecurityLogTableProps) => (
  <table>
    <thead>
      <tr>
        <th>EVENT ID</th>
        <th>SEVERITY</th>
        <th>DESCRIPTION</th>
        <th>USER</th>
      </tr>
    </thead>
    <tbody>
      {events.length === 0 ? (
        <tr>
          <td colSpan={4}>No security events</td>
        </tr>
      ) : (
        events.map((event, i) => (
          <tr key={i}>
            <td>{event.eventid}</td>
            <td>
              <RiskBadge level={event.severity === 'CRITICAL' ? 'err' : event.severity === 'WARNING' ? 'warn' : 'safe'} text={event.severity} />
            </td>
            <td>{event.description}</td>
            <td>{event.user}</td>
          </tr>
        ))
      )}
    </tbody>
  </table>
);
