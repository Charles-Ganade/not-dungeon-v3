import type { Component, JSX } from "solid-js";
import { Route, Router } from "@solidjs/router";
import Home from "./app/routes/home";
import Navbar from "./app/shared/Navbar";

const Layout: Component = (props: { children?: JSX.Element }) => {
  return (
    <>
      <Navbar />
      <main>{props.children}</main>
    </>
  );
};

const App: Component = () => {
  return (
    <Router root={Layout}>
      <Route path={"/"} component={Home} />
    </Router>
  );
};

export default App;
