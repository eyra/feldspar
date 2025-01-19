import { PropsUIPage, isPropsUIPageEnd } from "../../../types/pages";
import { ReactFactoryContext } from "../factory";
import { EndPage } from "../ui/pages/end_page";
import { PageFactory } from "./base";
import React from "react";

export class EndPageFactory implements PageFactory {
  createPage(page: PropsUIPage, context: ReactFactoryContext) {
    if (isPropsUIPageEnd(page)) {
      return <EndPage {...page} {...context} />;
    }
    return null;
  }
}
