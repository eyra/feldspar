import { PropsUIPage, isPropsUIPageError } from "../../../types/pages";
import { ReactFactoryContext } from "../factory";
import { ErrorPage } from "../ui/pages/error_page";
import { PageFactory } from "./base";
import React from "react";

export class ErrorPageFactory implements PageFactory {
  createPage(page: PropsUIPage, context: ReactFactoryContext) {
    if (isPropsUIPageError(page)) {
      return <ErrorPage {...page} {...context} />;
    }
    return null;
  }
}
