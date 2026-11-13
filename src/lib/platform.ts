import { queryOptions } from "@tanstack/react-query";
import { getPublicPlatform } from "./platform.functions";

export const publicPlatformOptions = queryOptions({ queryKey: ["public-platform"], queryFn: () => getPublicPlatform(), staleTime: 30_000 });

export function annualPrice(monthly: number) { return monthly * 10; }