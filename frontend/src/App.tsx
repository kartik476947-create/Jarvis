import { Header } from './components/Layout/Header';
import { StatusBar } from './components/Layout/StatusBar';
import { Workspace } from './components/Layout/Workspace';
import './styles/global.css';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Header />
      <StatusBar />
      <Workspace />
    </div>
  );
}
