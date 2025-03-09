import { PropsUIPage } from "../../../types/pages";
import { ReactFactoryContext } from "../factory";
import { JSX } from "react";

export interface PageFactory {
  createPage(page: PropsUIPage, context: ReactFactoryContext): JSX.Element | null;
}
