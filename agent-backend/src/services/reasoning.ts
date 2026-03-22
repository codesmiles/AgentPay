import { aiProvider } from "./aiProvider";
import type { ReasoningInput, ReasoningOutput } from "../types";

export async function reasonAboutPayment(input: ReasoningInput): Promise<ReasoningOutput> {
    return aiProvider.reasonAboutPayment(input);
}

export { aiProvider };
