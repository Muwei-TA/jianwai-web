import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Link } from "react-router-dom";
import App from "./App";
import { SessionProvider } from "./session";
import Home from "./pages/Home";
import { Auth, Verify } from "./pages/Auth";
import { Clubs, ClubPage, Join } from "./pages/Clubs";
import Workspace from "./pages/Workspace";
const EditorPage = lazy(() => import("./pages/Editor"));
import Post from "./pages/Post";
import Reviews from "./pages/Reviews";
import "./styles.css";
const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/clubs", element: <Clubs /> },
      { path: "/clubs/:id", element: <ClubPage /> },
      { path: "/join", element: <Join /> },
      { path: "/login", element: <Auth /> },
      { path: "/register", element: <Auth register /> },
      { path: "/verify", element: <Verify /> },
      { path: "/workspace", element: <Workspace /> },
      {
        path: "/write/:id",
        element: (
          <Suspense
            fallback={
              <p className="loading" role="status">
                正在打开创作间…
              </p>
            }
          >
            <EditorPage />
          </Suspense>
        ),
      },
      { path: "/posts/:id", element: <Post /> },
      { path: "/reviews", element: <Reviews /> },
      {
        path: "*",
        element: (
          <div className="empty">
            <h1>这一页还没有写下</h1>
            <Link className="btn" to="/">
              回到首页
            </Link>
          </div>
        ),
      },
    ],
  },
]);
createRoot(document.getElementById("root")!).render(
  <SessionProvider>
    <RouterProvider router={router} />
  </SessionProvider>,
);
