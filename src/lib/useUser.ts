import { useRouteContext } from "@tanstack/react-router";

export function useUserId(): string {
  return useRouteContext({ from: "/_authenticated" }).user.id;
}
