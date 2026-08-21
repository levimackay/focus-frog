import Frog from "./frog/Frog";
import Button from "./common/Button";
import "./Home.css";

export interface HomeProps {
  reducedMotion: boolean;
  frogName: string;
  onStartSession: () => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
}

export default function Home({
  reducedMotion,
  frogName,
  onStartSession,
  onOpenStats,
  onOpenSettings,
}: HomeProps) {
  return (
    <div className="home-screen">
      <nav className="home-nav" aria-label="Primary">
        <Button variant="ghost" onClick={onOpenStats}>
          Frog Report
        </Button>
        <Button variant="ghost" onClick={onOpenSettings}>
          Settings
        </Button>
      </nav>

      <div className="home-hero">
        <Frog mood="idle" size={160} reducedMotion={reducedMotion} label={`${frogName}, waiting`} />
        <h1>{frogName} is ready when you are.</h1>
        <p>Set a goal, pick a duration, and let the frog keep you honest.</p>
        <Button variant="primary" size="lg" onClick={onStartSession}>
          Start a session
        </Button>
      </div>
    </div>
  );
}
