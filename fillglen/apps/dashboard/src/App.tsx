import { NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Tracker from "./pages/Tracker";
import JobDetail from "./pages/JobDetail";
import Resumes from "./pages/Resumes";
import Answers from "./pages/Answers";
import ProfilePage from "./pages/Profile";
import JobBoard from "./pages/JobBoard";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import LiveDemo from "./pages/LiveDemo";
import SignIn from "./pages/SignIn";

const links = [
  ["/", "Home"],
  ["/tracker", "Tracker"],
  ["/resumes", "Resumes"],
  ["/answers", "Answers"],
  ["/profile", "Profile"],
  ["/board", "Job board"],
  ["/live", "Live window"],
  ["/settings", "Settings"],
];

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-6 px-6 py-4 border-b border-[#d9d0c4] bg-[#fffbf5]">
        <NavLink to="/" className="flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" width={28} height={28} alt="" />
          Fillglen
        </NavLink>
        <nav className="flex flex-wrap gap-4 text-sm text-[#5c6b64]">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "text-ink" : "")} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="px-6 py-6 max-w-6xl mx-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/tracker/:id" element={<JobDetail />} />
          <Route path="/resumes" element={<Resumes />} />
          <Route path="/answers" element={<Answers />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/board" element={<JobBoard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/live" element={<LiveDemo />} />
          <Route path="/signin" element={<SignIn />} />
        </Routes>
      </main>
    </div>
  );
}
