import { PropsUIPage, isPropsUIPageDonation } from "../../../types/pages";
import { ReactFactoryContext } from "../factory";
import { DonationPage } from "../ui/pages/donation_page";
import { PageFactory } from "./base";
import React from "react";

export class DonationPageFactory implements PageFactory {
  createPage(page: PropsUIPage, context: ReactFactoryContext) {
    if (isPropsUIPageDonation(page)) {
      return <DonationPage {...page} {...context} />;
    }
    return null;
  }
}
