import { Response, CommandUIRender } from "../../types/commands";
import { PropsUIPage } from "../../types/pages";
import VisualizationFactory from "./factory";
import { JSX } from "react";
import React from "react";

export default class ReactEngine {
  factory: VisualizationFactory;
  locale!: string;
  private setState?: (state: { elements: JSX.Element[] }) => void;

  constructor(factory: VisualizationFactory) {
    this.factory = factory;
  }

  start(
    container: HTMLElement,
    locale: string,
    setState: (state: { elements: JSX.Element[] }) => void
  ): void {
    console.log("[ReactEngine] started");
    this.locale = locale;
    this.setState = setState;
  }

  async render(command: CommandUIRender): Promise<Response> {
    console.debug("[ReactEngine] render", command);
    const payload = await this.renderPage(command.page);
    console.log("[ReactEngine] render done", command, payload);
    return { __type__: "Response", command, payload };
  }

  renderPage(props: PropsUIPage): Promise<any> {
    return new Promise<any>((resolve) => {
      const context = { locale: this.locale, resolve };
      const page = this.factory.createPage(props, context);
      this.updateElements([page]);
    });
  }

  private updateElements(elements: JSX.Element[]): void {
    if (!this.setState) return;
    const elementsWithKeys = elements.map((element, index) =>
      React.cloneElement(element, { key: `feldspar-element-${index}` })
    );
    this.setState({ elements: elementsWithKeys });
  }

  terminate(): void {
    this.setState = undefined;
  }
}
