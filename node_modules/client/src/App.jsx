import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import Prelogin from "./views/Prelogin.jsx";
import Register from "./views/Register.jsx";
import SignIn from "./views/SignIn.jsx";
import Dashboard from "./views/Dashboard.jsx";
import JoinMeeting from "./views/JoinMeeting.jsx";
import MeetRoom from "./views/MeetRoom.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Prelogin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/signin" element={<SignIn />} />
          <Route
            path="/dashboard"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
          />
          <Route
            path="/join"
            element={<ProtectedRoute><JoinMeeting /></ProtectedRoute>}
          />
          <Route
            path="/meet/:code"
            element={<ProtectedRoute><MeetRoom /></ProtectedRoute>}
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
