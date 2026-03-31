import { Router, Route } from "@solidjs/router";
import { Component } from "solid-js";
import Home from "./app/routes/home";
import Layout from "./layout";
import CreateScenario from "./app/routes/create-scenario";

const App: Component = () => {
  return (
    <Router root={Layout}>
      <Route path={"/"} component={Home} />
      <Route path={"/create-scenario"} component={CreateScenario} />
    </Router>
  );
};

export default App;
