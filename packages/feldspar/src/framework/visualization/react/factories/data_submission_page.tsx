import { PropsUIPage, isPropsUIPageDataSubmission } from "../../../types/pages";
import { ReactFactoryContext } from "../factory";
import { DataSubmissionPage } from "../ui/pages/data_submission_page";
import { PageFactory } from "./base";
import React from "react";
import { PromptFactory } from "../ui/prompts/factory";

export class DataSubmissionPageFactory implements PageFactory {
  private promptFactories: PromptFactory[];

  constructor({
    promptFactories = [],
  }: { promptFactories?: PromptFactory[] } = {}) {
    this.promptFactories = promptFactories;
  }

  createPage(page: PropsUIPage, context: ReactFactoryContext) {
    if (isPropsUIPageDataSubmission(page)) {
      return (
        <DataSubmissionPage
          {...page}
          {...context}
          promptFactories={this.promptFactories}
        />
      );
    }
    return null;
  }
}
