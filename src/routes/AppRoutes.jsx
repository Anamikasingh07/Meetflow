import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "../pages/Home/Home";
import PreJoin from "../pages/PreJoin/PreJoin";
import MeetingRoom from "../pages/MeetingRoom/MeetingRoom";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/prejoin/:roomId" element={<PreJoin />} />
        <Route path="/meeting/:roomId" element={<MeetingRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;