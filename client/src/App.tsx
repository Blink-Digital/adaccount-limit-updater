import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ResetSpendCap from "@/pages/reset-spend-cap";
import AdAccountSpend from "@/pages/ad-account-spend";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/reset-spend-cap" component={ResetSpendCap} />
      <Route path="/ad-account-spend" component={AdAccountSpend} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
