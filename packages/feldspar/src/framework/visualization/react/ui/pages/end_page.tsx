import { Weak } from "../../../../helpers";
import { PropsUIPageEnd } from "../../../../types/pages";
import { ReactFactoryContext } from "../../factory";
import { Page } from "./templates/page";
import TextBundle from "../../../../text_bundle";
import { Translator } from "../../../../translator";
import { BodyLarge, Title1 } from "../elements/text";
import { JSX } from "react";
import React from "react";

type Props = Weak<PropsUIPageEnd> & ReactFactoryContext;

export const EndPage = (props: Props): JSX.Element => {
  const { title, text } = prepareCopy(props);

  const body: JSX.Element = (
    <>
      <Title1 text={title} />
      <BodyLarge text={text} />
    </>
  );

  return <Page body={body} />;
};

interface Copy {
  title: string;
  text: string;
}

function prepareCopy({ locale }: Props): Copy {
  return {
    title: Translator.translate(title, locale),
    text: Translator.translate(text, locale),
  };
}

const title = new TextBundle()
  .add("en", "Thank you")
  .add("de", "Danke")
  .add("it", "Grazie")
  .add("nl", "Bedankt");

const text = new TextBundle()
  .add(
    "en",
    "Thank you for your participation. You can now close the page or refresh to restart the DataSubmission flow."
  )
  .add(
    "de",
    "Herzlichen Dank für Ihre Teilnahme. Sie können diese Seite nun schließen oder die Seite aktualisieren, um die Datenspende erneut durchzuführen."
  )
  .add(
    "it",
    "Grazie per la tua partecipazione. Ora puoi chiudere la pagina o aggiornare per riavviare il flusso di donazione."
  )
  .add(
    "nl",
    "Hartelijk dank voor uw deelname. U kunt deze pagina nu sluiten of de pagina verversen om de flow nogmaals te doorlopen."
  );
