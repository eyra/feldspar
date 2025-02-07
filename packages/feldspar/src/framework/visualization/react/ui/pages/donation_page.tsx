import React, { JSX, useCallback } from "react";
import { Weak } from "../../../../helpers";
import TextBundle from "../../../../text_bundle";
import { Translator } from "../../../../translator";
import { Translatable } from "../../../../types/elements";
import { PropsUIPageDonation } from "../../../../types/pages";
import { ReactFactoryContext } from "../../factory";
import { Title1 } from "../elements/text";
import { Page } from "./templates/page";
import { createPromptFactoriesWithDefaults, PromptContext } from "../prompts/factory";

type Props = Weak<PropsUIPageDonation> & ReactFactoryContext;

export const DonationPage = (props: Props): JSX.Element => {
  const { title } = prepareCopy(props);
  const { locale } = props;
  const promptFactories = createPromptFactoriesWithDefaults(
    props.promptFactories
  );
  const donationData = React.useRef<Map<string, string>>(new Map());

  const onDonationDataChanged = useCallback((key: string, value: any)=> {
    console.log("onDonationDataChanged", key, value);
    donationData.current.set(key, value);
  }, [donationData]);

  function onDonate(): void {
    const donationDataObject = Object.fromEntries(donationData.current);
    console.log("onDonate", JSON.stringify(donationDataObject));
    props.resolve?.({ __type__: "PayloadJSON", value: JSON.stringify(donationDataObject) });
  }

  function renderBodyItem(bodyItem: any, context: PromptContext): JSX.Element | null {
    for (const factory of promptFactories) {
      const element = factory.create(bodyItem, context);
      if (element !== null) {
        return element;
      }
    }
    return null;
  }

  function renderBody(props: Props): JSX.Element[] {
    const context = { locale: locale, resolve: props.resolve, onDonationDataChanged, onDonate};
    const bodyItems = Array.isArray(props.body) ? props.body : [props.body];

    return bodyItems.map((item, index) => {
      const element = renderBodyItem(item, context);
      if (element === null) {
        throw new TypeError(`No factory found for body item at index ${index}`);
      }
      return <React.Fragment key={index}>{element}</React.Fragment>;
    });
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
}

function prepareCopy({ header: { title }, locale }: Props): Copy {
  return {
    title: Translator.translate(title, locale),
  };
}
