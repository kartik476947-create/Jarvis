import type { ProcessEvent } from '../../types';
import { RiskBadge } from '../Common';

interface ProcessEventTableProps {
  events: ProcessEvent[];
}

export const ProcessEventTable = ({ events }: ProcessEventTableProps) => (
  <table>
    <thead>
      <tr>
        <th>TIME</th>
        <th>EVENT</th>
        <th>PROCESS</th>
        <th>PID</th>
      </tr>
    </thead>
    <tbody>
      {events.length === 0 ? (
        <tr>
          <td colSpan={4}>No process events</td>
        </tr>
      ) : (
        events.map((event, i) => (
          <tr key={i}>
            <td>{event.time}</td>
            <td>
              <RiskBadge
                level={event.event === 'CREATE' ? 'safe' : 'warn'}
                text={event.event}
              />
            </td>
            <td>{event.process}</td>
            <td>{event.eventid}</td>
          </tr>
        ))
      )}
    </tbody>
  </table>
);
