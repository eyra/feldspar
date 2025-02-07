import { PropsUIPage, isPropsUIPageDonation } from "../../../types/pages";
import { ReactFactoryContext } from "../factory";
import { DonationPage } from "../ui/pages/donation_page";
import { PageFactory } from "./base";
import React from "react";
import { PromptFactory } from "../ui/prompts/factory";

export class DonationPageFactory implements PageFactory {
  private promptFactories: PromptFactory[];

  constructor({
    promptFactories = [],
  }: { promptFactories?: PromptFactory[] } = {}) {
    this.promptFactories = promptFactories;
  }

  createPage(page: PropsUIPage, context: ReactFactoryContext) {
    if (isPropsUIPageDonation(page)) {
      return (
        <DonationPage
          {...page}
          {...context}
          promptFactories={this.promptFactories}
        />
      );
    }
    return null;
  }
}
