import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createHashRouter } from "react-router-dom";

import App from "./App";
import { MatchesFeed } from "./pages/MatchesFeed";
import { MatchLobby } from "./pages/MatchLobby";
import { TeamVariants } from "./pages/TeamVariants";
import { LiveMatch } from "./pages/LiveMatch";
import { FinishedMatch } from "./pages/FinishedMatch";
import { Feedback } from "./pages/Feedback";
import { Profile } from "./pages/Profile";
import { PlayerProfile } from "./pages/PlayerProfile";
import { Admin } from "./pages/Admin";
import "./styles/globals.css";

const futureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
};

const router = createHashRouter(
  [
    {
      path: "/",
      element: <App />,
      children: [
        { index: true, element: <Navigate to="/matches" replace /> },
        { path: "matches", element: <MatchesFeed /> },
        { path: "matches/:matchId", element: <MatchLobby /> },
        { path: "matches/:matchId/finished", element: <FinishedMatch /> },
        { path: "matches/:matchId/players/:tgId", element: <PlayerProfile /> },
        { path: "matches/:matchId/teams", element: <TeamVariants /> },
        { path: "matches/:matchId/live", element: <LiveMatch /> },
        { path: "matches/:matchId/feedback", element: <Feedback /> },
        { path: "profile", element: <Profile /> },
        { path: "players/:tgId", element: <PlayerProfile /> },
        { path: "admin", element: <Admin /> },
        { path: "*", element: <Navigate to="/matches" replace /> }
      ]
    }
  ],
  { future: futureFlags }
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} future={futureFlags} />
  </React.StrictMode>
);
