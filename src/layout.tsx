import type { Component } from "solid-js";
import { Route, Router } from "@solidjs/router";
import Home from "./app/routes/home";
import Navbar from "./app/shared/Navbar";

const Layout: Component = () => {
  return (
    <>
      <Navbar />
      <main>
        <Router>
          <Route path={"/"} component={Home} />
        </Router>
      </main>
    </>
  );
};

export default Layout;
