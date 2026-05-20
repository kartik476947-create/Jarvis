import type { NetworkConnection } from '../../types';
import { RiskBadge } from '../Common';

interface NetworkTableProps {
  connections: NetworkConnection[];
}

export const NetworkTable = ({ connections }: NetworkTableProps) => (
  <table>
    <thead>
      <tr>
        <th>PROCESS</th>
        <th>REMOTE IP</th>
        <th>PORT</th>
        <th>STATUS</th>
      </tr>
    </thead>
    <tbody>
      {connections.length === 0 ? (
        <tr>
          <td colSpan={4}>No active connections</td>
        </tr>
      ) : (
        connections.slice(0, 50).map((conn, i) => {
          const [ip, port] = conn.remote_addr.split(':');
          return (
            <tr key={i}>
              <td>{conn.process}</td>
              <td>{ip || 'N/A'}</td>
              <td>{port || 'N/A'}</td>
              <td>
                <RiskBadge
                  level={conn.status === 'ESTABLISHED' ? 'safe' : 'warn'}
                  text={conn.status}
                />
              </td>
            </tr>
          );
        })
      )}
    </tbody>
  </table>
);
