import { Router, Route, Navigate } from "@solidjs/router";
import { Component } from "solid-js";
import Home from "./app/routes/home";
import Layout from "./layout";
import CreateScenario from "./app/routes/create-scenario";
import { EditScenario } from "./app/features/edit-scenario";
import Play from "./app/routes/play";

const App: Component = () => {
  return (
    <Router root={Layout}>
      <Route path={"/"} component={Home} />
      <Route path={"/create-scenario"} component={CreateScenario} />
      <Route
        path={"/edit-scenario/"}
        component={() => <Navigate href={"/"} />}
      />
      <Route path={"/edit-scenario/:id"} component={EditScenario} />
      <Route path={"/play/"} component={() => <Navigate href={"/"} />} />
      <Route path={"/play/:id"} component={Play} />
    </Router>
  );
};

export default App;
