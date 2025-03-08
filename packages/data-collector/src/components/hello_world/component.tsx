import React from "react";
import { PropsUIPromptHelloWorld } from "./types";
import { ReactFactoryContext } from "@eyra/feldspar";

type Props = PropsUIPromptHelloWorld & ReactFactoryContext;

export const HelloWorld: React.FC<Props> = ({ text }) => {
  return <div>{text} from Python to React</div>;
};
