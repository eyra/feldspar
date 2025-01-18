import * as ReactDOM from "react-dom/client";
import { VisualisationEngine } from "../../types/modules";
import { Response, Payload, CommandUIRender } from "../../types/commands";
import { PropsUIPage } from "../../types/pages";
import VisualisationFactory from "./factory";
import { Main } from "./main";
import { JSX } from "react";
import React from "react";

export default class ReactEngine implements VisualisationEngine {
  factory: VisualisationFactory;
  container?: HTMLElement;
  locale!: string;

  constructor(factory: VisualisationFactory) {
    this.factory = factory;
  }

  start(container: HTMLElement, locale: string): void {
    console.log("[ReactEngine] started");
    this.container = container;
    this.locale = locale;
  }

  async render(command: CommandUIRender): Promise<Response> {
    const payload = await this.renderPage(command.page);
    return { __type__: "Response", command, payload };
  }

  async renderPage(props: PropsUIPage): Promise<any> {
    return new Promise<any>((resolve) => {
      const context = { locale: this.locale, resolve };
      const page = this.factory.createPage(props, context);
      this.renderElements([page]);
    });
  }

  renderElements(elements: JSX.Element[]): void {
    if (!this.container) return;
    const root = ReactDOM.createRoot(this.container);
    root.render(<Main elements={elements} />);
  }

  terminate(): void {
    if (this.container) {
      const root = ReactDOM.createRoot(this.container);
      root.unmount();
    }
  }
}
