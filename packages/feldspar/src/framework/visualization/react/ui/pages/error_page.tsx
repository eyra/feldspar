import { Weak } from "../../../../helpers";
import { PropsUIPageError } from "../../../../types/pages";
import { ReactFactoryContext } from "../../factory";
import { Page } from "./templates/page";
import TextBundle from "../../../../text_bundle";
import { Translator } from "../../../../translator";
import { BodyLarge, Title1 } from "../elements/text";
import { JSX } from "react";
import React from "react";

type Props = Weak<PropsUIPageError> & ReactFactoryContext;

export const ErrorPage = (props: Props): JSX.Element => {
  const { title, text } = prepareCopy(props);

  const body: JSX.Element = (
    <>
      <Title1 text={title} />
      <BodyLarge text={text} />
      {props.message && (
        <div className="mt-4 p-4 bg-grey6 rounded-md">
          <p className="text-sm text-grey1">{props.message}</p>
        </div>
      )}
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
  .add("en", "Something went wrong")
  .add("de", "Etwas ist schief gelaufen")
  .add("it", "Qualcosa è andato storto")
  .add("es", "Algo salió mal")
  .add("nl", "Er is iets misgegaan")
  .add("ro", "Ceva nu a funcționat corect")
  .add("lt", "Kažkas nutiko");

const text = new TextBundle()
  .add(
    "en",
    "We're sorry, but your data donation could not be completed. Please try again later or contact support if the problem persists."
  )
  .add(
    "de",
    "Es tut uns leid, aber Ihre Datenspende konnte nicht abgeschlossen werden. Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support."
  )
  .add(
    "it",
    "Siamo spiacenti, ma la tua donazione non è stata completata. Riprova più tardi o contatta l'assistenza."
  )
  .add(
    "es",
    "Lo sentimos, pero su donación no se pudo completar. Inténtelo de nuevo más tarde o contacte con soporte."
  )
  .add(
    "nl",
    "Het spijt ons, maar uw datadonatie kon niet worden voltooid. Probeer het later opnieuw of neem contact op met ondersteuning."
  )
  .add(
    "ro",
    "Ne pare rău, dar donația dvs. nu a putut fi finalizată. Vă rugăm să încercați din nou mai târziu sau să contactați asistența."
  )
  .add(
    "lt",
    "Atsiprašome, bet jūsų duomenų donacija nepavyko. Pabandykite vėliau arba susisiekite su palaikymu."
  );
