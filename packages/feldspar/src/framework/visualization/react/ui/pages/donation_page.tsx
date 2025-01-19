import React, { JSX } from "react";
import { Weak } from "../../../../helpers";
import TextBundle from "../../../../text_bundle";
import { Translator } from "../../../../translator";
import { Translatable } from "../../../../types/elements";
import { PropsUIPageDonation } from "../../../../types/pages";
import { ReactFactoryContext } from "../../factory";
import { Title1 } from "../elements/text";
import { Page } from "./templates/page";
import { createPromptFactoriesWithDefaults } from "../prompts/factory";

type Props = Weak<PropsUIPageDonation> & ReactFactoryContext;

export const DonationPage = (props: Props): JSX.Element => {
  const { title } = prepareCopy(props);
  const { locale } = props;
  const promptFactories = createPromptFactoriesWithDefaults(props.promptFactories);

  function renderBody(props: Props): JSX.Element {
    const context = { locale: locale, resolve: props.resolve };
    const body = props.body;

    for (const factory of promptFactories) {
      const element = factory.create(body, context);
      if (element !== null) {
        return element;
      }
    }

    throw new TypeError("No factory found for body type");
  }

  const body: JSX.Element = (
    <>
      <Title1 text={title} />
      {renderBody(props)}
    </>
  );

  return <Page body={body} />;
};

interface Copy {
  title: string;
  forwardButton: string;
}

function prepareCopy({ header: { title }, locale }: Props): Copy {
  return {
    title: Translator.translate(title, locale),
    forwardButton: Translator.translate(forwardButtonLabel(), locale),
  };
}

const forwardButtonLabel = (): Translatable => {
  return new TextBundle()
    .add("en", "Skip")
    .add("de", "Überspringen")
    .add("nl", "Overslaan");
};
