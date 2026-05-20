import type { FileEvent } from '../../types';
import { RiskBadge } from '../Common';

interface FileEventTableProps {
  events: FileEvent[];
}

export const FileEventTable = ({ events }: FileEventTableProps) => (
  <table>
    <thead>
      <tr>
        <th>TIME</th>
        <th>ACTION</th>
        <th>FILEPATH</th>
      </tr>
    </thead>
    <tbody>
      {events.length === 0 ? (
        <tr>
          <td colSpan={3}>No file events</td>
        </tr>
      ) : (
        events.map((event, i) => (
          <tr key={i}>
            <td>{event.time}</td>
            <td>
              <RiskBadge
                level={event.action === 'DELETE' ? 'err' : 'safe'}
                text={event.action}
              />
            </td>
            <td>{event.filepath}</td>
          </tr>
        ))
      )}
    </tbody>
  </table>
);
