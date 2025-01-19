import { PropsUIPage } from "../../types/pages";
import { Payload } from "../../types/commands";
import { PageFactory } from "./factories/base";
import { EndPageFactory } from "./factories/end_page";
import { DonationPageFactory } from "./factories/donation_page";
import { JSX } from "react";
import React from "react";

export interface ReactFactoryContext {
  locale: string;
  resolve?: (payload: Payload) => void;
}

export default class ReactFactory {
  private factories: PageFactory[];

  constructor() {
    this.factories = [
      new EndPageFactory(),
      new DonationPageFactory()
    ];
  }

  createPage(page: PropsUIPage, context: ReactFactoryContext): JSX.Element {
    for (const factory of this.factories) {
      const element = factory.createPage(page, context);
      if (element !== null) {
        return element;
      }
    }
    throw TypeError("Unknown page: " + JSON.stringify(page));
  }

  registerFactory(factory: PageFactory): void {
    this.factories.push(factory);
  }
}
