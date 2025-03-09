import { PropsUIPrompt } from "../../../../../types/prompts";
import { ReactFactoryContext } from "../../../factory";
import { JSX } from "react";

export interface PromptFactory {
  create(prompt: PropsUIPrompt, context: ReactFactoryContext): JSX.Element | null;
}