import { queryOptions } from "@tanstack/react-query";
import { getPublicSubjects } from "./subjects.functions";

export const publicSubjectsOptions = queryOptions({
  queryKey: ["public-subjects"],
  queryFn: () => getPublicSubjects(),
  staleTime: 5_000,
  refetchOnWindowFocus: "always",
});