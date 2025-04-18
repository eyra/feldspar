import { PromptFactory, ReactFactoryContext } from "@eyra/feldspar";
import React from "react";
import { HelloWorld } from "../components/hello_world/component";
import { PropsUIPromptHelloWorld } from "../components/hello_world/types";

export class HelloWorldFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext) {
    if (this.isHelloWorld(body)) {
      return <HelloWorld {...body} {...context} />;
    }
    return null;
  }

  private isHelloWorld(body: unknown): body is PropsUIPromptHelloWorld {
    return (
      (body as PropsUIPromptHelloWorld).__type__ === "PropsUIPromptHelloWorld"
    );
  }
}
